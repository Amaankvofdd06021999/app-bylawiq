import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type Browser, type Page } from '@playwright/test';
import {
  assertLocalSupabase,
  seedMfaAccounts,
  totpAt,
  waitForTotpWindow,
  type SeededAccount,
} from './support/local-mfa';
import { freshClientIp, signInAs } from './support/accounts';
import { openPage } from './support/sign-in';

/**
 * The MFA verification lease, on the local stack. A verification must hold the admin's lease, so only one runs at a time
 * across server instances. Only the token that took the lease releases it. An expired lease recovers.
 */

const expectSlow = expect.configure({ timeout: 20_000 }); // above the UI's 15-second deadline, below the test budget
test.describe.configure({ mode: 'serial' });
test.setTimeout(240_000);

const BUSY = 'already running';
let admin: SeededAccount;
let adminSecret = '';

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

/** A client signed in as the admin, for the lease RPCs (the lease belongs to the caller's account). */
async function adminClient(): Promise<SupabaseClient> {
  const url = assertLocalSupabase();
  const client = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email: admin.email, password: admin.password });
  if (error) throw new Error(`Signing in the lease client failed: ${error.message}`);
  return client;
}

function serverActionId(): string {
  const manifest = JSON.parse(
    readFileSync(path.join(process.cwd(), '.next', 'server', 'server-reference-manifest.json'), 'utf8'),
  ) as { node: Record<string, { exportedName: string; filename: string }> };
  const hit = Object.entries(manifest.node).find(
    ([, v]) => v.exportedName === 'verifyTotpAction' && v.filename.endsWith('features/admin/mfa/actions.ts'),
  );
  if (!hit) throw new Error('verifyTotpAction is not in the server reference manifest');
  return hit[0];
}

async function stepUpPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ extraHTTPHeaders: { 'x-real-ip': freshClientIp() } });
  const page = await context.newPage();
  await signInAs(page, admin);
  await openPage(page, '/admin/platform');
  await expectSlow(page.getByRole('heading', { name: 'Confirm it is you' })).toBeVisible();
  // Wait for hydration: typing before the form has React state leaves the button disabled.
  await page.waitForLoadState('networkidle');
  return page;
}

test.beforeAll(async () => {
  assertLocalSupabase();
  ({ admin } = await seedMfaAccounts());
});

test('the admin enrols an authenticator', async ({ browser }) => {
  const context = await browser.newContext({ extraHTTPHeaders: { 'x-real-ip': freshClientIp() } });
  const page = await context.newPage();
  try {
    await signInAs(page, admin);
    await openPage(page, '/admin/platform/mfa');
    await page.getByRole('button', { name: 'Start setup' }).click();
    adminSecret = (await page.locator('.mfa-enrollment code').textContent())?.trim() ?? '';
    expectSlow(adminSecret).toMatch(/^[A-Z2-7]+=*$/);
    await waitForTotpWindow();
    await page.fill('#mfa-code', totpAt(adminSecret));
    await page.getByRole('button', { name: 'Finish setup' }).click();
    await expectSlow(page).toHaveURL(/\/admin\/platform$/, { timeout: 20_000 });
  } finally {
    await context.close();
  }
});

test('while a lease is held the form says busy; a stranger cannot release it; the holder releases and the valid code opens the console', async ({
  browser,
}) => {
  // Load the step-up page first, then take the lease right before the attempts. The lease outlasts the page load and
  // sign-in time, so a slow browser cannot run past it.
  const page = await stepUpPage(browser);
  const client = await adminClient();
  const { data: token, error } = await client.rpc('acquire_mfa_verification', { p_ttl_seconds: 60 });
  expectSlow(error).toBeNull();
  expectSlow(typeof token).toBe('string');

  // Busy: the form is refused at once, without calling the auth service, so no session is revoked.
  await page.fill('#mfa-code', '000000');
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expectSlow(page.locator('#mfa-error')).toContainText(BUSY);

  // A release with a token this caller does not hold leaves the lease in place.
  await client.rpc('release_mfa_verification', { p_token: '00000000-0000-4000-8000-000000000000' });
  // The form clears the code after a refusal, so type it again before the next attempt.
  await page.fill('#mfa-code', '000000');
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expectSlow(page.locator('#mfa-error')).toContainText(BUSY);

  // The holder releases; the valid code then opens the console.
  await client.rpc('release_mfa_verification', { p_token: token as string });
  await waitForTotpWindow();
  await page.fill('#mfa-code', totpAt(adminSecret));
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expectSlow(page).toHaveURL(/\/admin\/platform$/, { timeout: 20_000 });
  await expectSlow(page.getByRole('heading', { name: 'Platform Admin Console' })).toBeVisible();
  await page.context().close();
});

test('concurrent verification attempts are serialized: one runs, the others are refused at once', async ({
  browser,
}) => {
  const page = await stepUpPage(browser);
  const actionId = serverActionId();
  const factorId = await factorIdOf();
  const times: number[] = [];
  const bodies = await Promise.all(
    Array.from({ length: 6 }, async () => {
      const start = Date.now();
      const res = await page.context().request.post('/admin/platform', {
        headers: {
          'Next-Action': actionId,
          'Content-Type': 'text/plain;charset=UTF-8',
          Accept: 'text/x-component',
        },
        data: JSON.stringify([{ factorId, code: '000000' }]),
        timeout: 30_000,
      });
      times.push(Date.now() - start);
      return res.text();
    }),
  );
  const refused = bodies.filter((b) => b.includes(BUSY)).length;
  const ran = bodies.filter((b) => b.includes('"ok":false') && !b.includes(BUSY)).length;
  // eslint-disable-next-line no-console
  console.log('lease attempts ms (sorted):', [...times].sort((x, y) => x - y).join(', '));
  // Exactly one attempt ran the verification; the rest were refused by the lease at once.
  expectSlow(ran).toBe(1);
  expectSlow(refused).toBe(5);
  expectSlow(Math.max(...times)).toBeLessThan(15_000);
});

test('an expired lease recovers: the next verification runs', async ({ browser }) => {
  const client = await adminClient();
  const { data: token } = await client.rpc('acquire_mfa_verification', { p_ttl_seconds: 20 });
  expectSlow(typeof token).toBe('string');
  // The holder never releases (a crashed request). The lease expires.
  localDb(
    `update public.mfa_verification_leases set expires_at = now() - interval '1 second' where user_id = '${admin.id}';`,
  );

  const page = await stepUpPage(browser);
  await page.fill('#mfa-code', '000000');
  await page.getByRole('button', { name: 'Confirm' }).click();
  // The attempt runs (a wrong code is refused by the auth service), not the busy message.
  await expectSlow(page.locator('#mfa-error')).toContainText('not valid');
  await expectSlow(page.locator('#mfa-error')).not.toContainText(BUSY);
  await page.context().close();
});

/** The admin's verified factor, from the database (the auth service stores it). */
async function factorIdOf(): Promise<string> {
  const id = localDb(
    `select id from auth.mfa_factors where user_id = '${admin.id}' and status = 'verified' and factor_type = 'totp' limit 1;`,
  );
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error('No verified factor for the admin');
  return id;
}
