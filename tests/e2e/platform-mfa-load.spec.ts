import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import {
  assertLocalSupabase,
  seedMfaAccounts,
  totpAt,
  waitForTotpWindow,
  type SeededAccount,
} from './support/local-mfa';
import { openPage, submitSignIn } from './support/sign-in';
import { freshClientIp } from './support/accounts';

/**
 * Platform admin step-up under load, against the local stack. The verify server action is the only write in the
 * step-up path; these tests measure how long each verification takes, first through the real form with several admins at
 * once, then by calling the same server action directly with many concurrent requests. A wrong code must come back as a
 * clear refusal in a few seconds, never hang, and the next attempt must still work.
 */

const expectSlow = expect.configure({ timeout: 20_000 }); // above the UI's 15-second deadline, below the test budget
test.describe.configure({ mode: 'serial' });
test.setTimeout(240_000);

const LOAD_USERS = 8;
const DIRECT_CALLS = 24;
const MAX_VERIFY_MS = 5_000;

let admins: SeededAccount[] = [];
let enrolledSecrets: string[] = [];
const enrolTimings: number[] = [];

function localDb(sql: string): string {
  return execFileSync(
    'docker',
    [
      'exec',
      '-i',
      'supabase_db_bylawiq',
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-At',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    { input: sql, encoding: 'utf8' },
  ).trim();
}

/** The server action id for verifyTotpAction, from the build's manifest (the id changes with every build). */
function verifyActionId(): string {
  const manifest = JSON.parse(
    readFileSync(path.join(process.cwd(), '.next', 'server', 'server-reference-manifest.json'), 'utf8'),
  ) as { node: Record<string, { exportedName: string; filename: string }> };
  const hit = Object.entries(manifest.node).find(
    ([, v]) => v.exportedName === 'verifyTotpAction' && v.filename.endsWith('features/admin/mfa/actions.ts'),
  );
  if (!hit) throw new Error('verifyTotpAction is not in the server reference manifest');
  return hit[0];
}

function verifiedFactorId(userId: string): string {
  const id = localDb(
    `select id from auth.mfa_factors where user_id = '${userId}' and status = 'verified' and factor_type = 'totp' limit 1;`,
  );
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error('No verified factor for the admin');
  return id;
}

/** Each context gets its own client address, so the per-address sign-in limit is not shared across this run. */
function newContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({ extraHTTPHeaders: { 'x-real-ip': freshClientIp() } });
}

async function signIn(page: Page, account: SeededAccount) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[name=email]', account.email);
  await page.fill('input[name=password]', account.password);
  await submitSignIn(page);
  await expectSlow(page).not.toHaveURL(/\/login/);
}

/**
 * Signs one admin in. Sign-ins run one at a time in the test below: when eight password sign-ins start together, they stall
 * in the auth service and never return (no error, the button stays busy). The test measures the enrolment steps, which run
 * concurrently once everyone is signed in.
 */
async function openSession(
  browser: Browser,
  account: SeededAccount,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await newContext(browser);
  const page = await context.newPage();
  try {
    await signIn(page, account);
    return { context, page };
  } catch (e) {
    await context.close();
    throw e;
  }
}

/** Runs the enrolment steps for an admin who is already signed in. Returns the TOTP secret. */
async function enrolInSession(page: Page): Promise<string> {
  await page.goto('/admin/platform/mfa');
  await page.getByRole('button', { name: 'Start setup' }).click();
  const secret = (await page.locator('.mfa-enrollment code').textContent())?.trim() ?? '';
  expectSlow(secret).toMatch(/^[A-Z2-7]+=*$/);
  await waitForTotpWindow();
  await page.fill('#mfa-code', totpAt(secret));
  const start = Date.now();
  await page.getByRole('button', { name: 'Finish setup' }).click();
  await expectSlow(page).toHaveURL(/\/admin\/platform$/, { timeout: 20_000 });
  enrolTimings.push(Date.now() - start);
  return secret;
}

test.beforeAll(async () => {
  assertLocalSupabase();
  const seeded = await seedMfaAccounts();
  admins = [seeded.admin];
  for (let i = 1; i < LOAD_USERS; i++) {
    const stamp = `${Date.now()}-${i}`;
    const password = seeded.admin.password;
    const email = `e2e-load-${stamp}@example.invalid`;
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY as string}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    const body = (await res.json()) as { id: string };
    localDb(
      `begin; set local bylawiq.operator = 'e2e-load'; set local bylawiq.reason = 'E2E load fixture'; insert into public.platform_admins (user_id) values ('${body.id}'); commit;`,
    );
    admins.push({ id: body.id, email, password });
  }
});

test('several admins enrol an authenticator at once and every enrolment completes', async ({ browser }) => {
  const sessions: { context: BrowserContext; page: Page }[] = [];
  let secrets: string[] = [];
  try {
    for (const account of admins.slice(0, LOAD_USERS)) sessions.push(await openSession(browser, account));
    secrets = await Promise.all(sessions.map((s) => enrolInSession(s.page)));
  } finally {
    await Promise.all(sessions.map((s) => s.context.close()));
  }
  enrolledSecrets = secrets;
  expectSlow(secrets).toHaveLength(LOAD_USERS);
  // Each enrolment's final verification must finish inside the UI's 15-second deadline, or the admin sees an error.

  console.log('enrol finish ms (sorted):', [...enrolTimings].sort((x, y) => x - y).join(', '));
  expectSlow(Math.max(...enrolTimings)).toBeLessThan(15_000);
});

test('concurrent wrong codes through the form each get a prompt refusal, and nothing hangs', async ({
  browser,
}) => {
  const timings: number[] = [];
  const contexts: BrowserContext[] = [];
  try {
    // Sign-ins one at a time (see openSession); the wrong-code attempts below run concurrently.
    const pages: Page[] = [];
    for (const a of admins.slice(0, LOAD_USERS)) {
      const session = await openSession(browser, a);
      contexts.push(session.context);
      await openPage(session.page, '/admin/platform');
      await expectSlow(session.page.getByRole('heading', { name: 'Confirm it is you' })).toBeVisible();
      // Wait for hydration: typing before the form has React state leaves the button disabled.
      await session.page.waitForLoadState('networkidle');
      pages.push(session.page);
    }
    await Promise.all(
      pages.map(async (page) => {
        await page.fill('#mfa-code', '000000');
        const start = Date.now();
        await page.getByRole('button', { name: 'Confirm' }).click();
        await expectSlow(page.locator('#mfa-error')).toHaveText(/not valid/, {
          timeout: MAX_VERIFY_MS + 10_000,
        });
        timings.push(Date.now() - start);
      }),
    );
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }

  console.log('form verify ms (sorted):', [...timings].sort((x, y) => x - y).join(', '));
  expectSlow(Math.max(...timings)).toBeLessThan(MAX_VERIFY_MS);
});

test('concurrent direct calls to the verify action each return a refusal, and a correct code still succeeds', async ({
  browser,
}) => {
  const admin = admins[0];
  const factorId = verifiedFactorId(admin.id);
  const actionId = verifyActionId();
  const context = await newContext(browser);
  const page = await context.newPage();
  try {
    await signIn(page, admin);
    const call = async (code: string) => {
      const start = Date.now();
      const res = await context.request.post('/admin/platform/mfa', {
        headers: {
          'Next-Action': actionId,
          'Content-Type': 'text/plain;charset=UTF-8',
          Accept: 'text/x-component',
        },
        data: JSON.stringify([{ factorId, code }]),
        timeout: 30_000,
      });
      return { ms: Date.now() - start, status: res.status(), body: await res.text() };
    };
    const results = await Promise.all(Array.from({ length: DIRECT_CALLS }, () => call('000000')));
    const times = results.map((r) => r.ms).sort((x, y) => x - y);

    console.log('direct verify ms (sorted):', times.join(', '));
    for (const r of results) {
      expectSlow(r.status).toBe(200);
      expectSlow(r.body).toContain('"ok":false');
    }
    expectSlow(Math.max(...times)).toBeLessThan(MAX_VERIFY_MS);

    // The next attempt with a valid code is not blocked by the failures before it (the code must be for this window).
    const good = await call(totpAt(enrolledSecrets[0]));
    expectSlow(good.body).toContain('"ok":true');
  } finally {
    await context.close();
  }
});
