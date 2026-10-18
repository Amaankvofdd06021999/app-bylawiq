import { execFileSync } from 'node:child_process';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { submitSignIn } from './support/sign-in';
import { assertLocalSupabase } from './support/local-mfa';
import { seedSingleBuildingManager, type SliceAccount } from './support/slice-seed';

/**
 * External counsel, real app, local stack: a manager grants counsel one amendment, counsel reads and comments, and the
 * denial paths hold (other building, editing, approving, expiry, revocation).
 */

test.describe.configure({ mode: 'serial' });
test.setTimeout(240_000);

const stamp = Date.now();
const TITLE = `Counsel review ${stamp}`;
const BODY = 'Owners may keep two pets per unit, with council approval for a third.';
let manager: SliceAccount;
let other: SliceAccount;
let counsel: SliceAccount;

function psql(sql: string): string {
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

function grantIdFor(email: string): string {
  return psql(
    `select g.id from public.counsel_grants g join auth.users u on u.id = g.counsel_user_id where lower(u.email) = lower('${email}') and g.revoked_at is null order by g.granted_at desc limit 1;`,
  );
}

/** Picks the amendment whose label contains the title. */
async function pickAmendment(page: Page) {
  const value = await page.locator('option', { hasText: TITLE }).first().getAttribute('value');
  expect(value).toBeTruthy();
  await page.getByLabel('Amendment').selectOption(value as string);
}

function freshClientIp() {
  return `198.51.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;
}

async function session(
  browser: Browser,
  account: SliceAccount,
): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext({ extraHTTPHeaders: { 'x-real-ip': freshClientIp() } });
  const page = await context.newPage();
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[name=email]', account.email);
  await page.fill('input[name=password]', account.password);
  await submitSignIn(page);
  await expect(page).not.toHaveURL(/\/login/);
  return { page, close: () => context.close() };
}

test.beforeAll(async () => {
  assertLocalSupabase();
  manager = await seedSingleBuildingManager(`counsel-${stamp}`);
  other = await seedSingleBuildingManager(`counsel-other-${stamp}`);
  counsel = await seedSingleBuildingManager(`counsel-lawyer-${stamp}`);
});

test('a manager creates an amendment and grants counsel access by email', async ({ browser }) => {
  const s = await session(browser, manager);
  try {
    await s.page.goto(`/b/${manager.buildingId}/bylaws`);
    await s.page.getByRole('button', { name: 'New bylaw' }).first().click();
    await s.page.getByLabel('Title', { exact: true }).fill(TITLE);
    await s.page.locator('input[name=section]').fill('7.1');
    await s.page.getByLabel('Your amendment').fill(BODY);
    await s.page.getByRole('button', { name: 'Save new version' }).click();
    await expect(s.page.getByRole('button', { name: `Edit ${TITLE}` })).toBeVisible();

    await s.page.goto(`/b/${manager.buildingId}/counsel`);
    await expect(s.page.getByRole('heading', { name: 'Grant counsel access' })).toBeVisible();
    await pickAmendment(s.page);

    // A wrong or unknown email is refused with the reason, and nothing is granted.
    await s.page.getByLabel('Counsel’s email address').fill(`nobody-${stamp}@example.invalid`);
    await s.page.getByRole('button', { name: 'Grant access' }).click();
    await expect(s.page.getByText('needs a BylawIQ account')).toBeVisible();

    await s.page.getByLabel('Counsel’s email address').fill(counsel.email);
    await s.page.getByLabel('Access period').selectOption('7');
    await s.page.getByRole('button', { name: 'Grant access' }).click();
    await expect(s.page.getByRole('status')).toContainText('Access granted');
    await expect(s.page.getByText(/Active until/)).toBeVisible();
  } finally {
    await s.close();
  }
});

test('counsel reads the packet, comments, and is refused everything else', async ({ browser }) => {
  const grantId = grantIdFor(counsel.email);
  expect(grantId).toMatch(/^[0-9a-f-]{36}$/);
  const c = await session(browser, counsel);
  try {
    await c.page.goto(`/counsel/${grantId}`);
    await expect(c.page.getByRole('heading', { name: 'Proposed text' })).toBeVisible();
    await expect(c.page.getByText(BODY)).toBeVisible();
    // Counsel cannot edit or approve: there is no editor and no transition control.
    await expect(c.page.getByRole('button', { name: 'Save new version' })).toHaveCount(0);
    await expect(c.page.getByRole('button', { name: /Move to/ })).toHaveCount(0);

    await c.page.getByLabel('Your comment').fill('Please confirm the section number.');
    await c.page.getByRole('button', { name: 'Send comment' }).click();
    await expect(c.page.getByText('Please confirm the section number.')).toBeVisible();

    // Counsel cannot open the manager's counsel page, or the building's bylaws.
    await c.page.goto(`/b/${manager.buildingId}/counsel`);
    await expect(c.page.getByRole('heading', { name: 'Grant counsel access' })).toHaveCount(0);
    await c.page.goto(`/b/${manager.buildingId}/bylaws`);
    await expect(c.page.getByText(TITLE)).toHaveCount(0);
  } finally {
    await c.close();
  }
});

test("another building's manager cannot see or grant on this building", async ({ browser }) => {
  const o = await session(browser, other);
  try {
    await o.page.goto(`/b/${manager.buildingId}/counsel`);
    await expect(o.page.getByRole('heading', { name: 'Grant counsel access' })).toHaveCount(0);
    await expect(o.page.getByText('This page is unavailable.')).toBeVisible();
  } finally {
    await o.close();
  }
});

test('ending access on the manager side ends counsel’s packet', async ({ browser }) => {
  const grantId = grantIdFor(counsel.email);
  const m = await session(browser, manager);
  try {
    await m.page.goto(`/b/${manager.buildingId}/counsel`);
    await m.page.getByRole('button', { name: `End access to ${TITLE}` }).click();
    await expect(m.page.getByRole('status')).toContainText('Access ended');
  } finally {
    await m.close();
  }
  const c = await session(browser, counsel);
  try {
    await c.page.goto(`/counsel/${grantId}`);
    await expect(c.page.getByRole('status')).toContainText('This review is not available');
    await expect(c.page.getByText(BODY)).toHaveCount(0);
  } finally {
    await c.close();
  }
});

test('access that has expired is refused, and cannot be used to comment', async ({ browser }) => {
  // Grant again, then let the grant run out (backdated, as the expiry tests do).
  const m = await session(browser, manager);
  try {
    await m.page.goto(`/b/${manager.buildingId}/counsel`);
    await pickAmendment(m.page);
    await m.page.getByLabel('Counsel’s email address').fill(counsel.email);
    await m.page.getByRole('button', { name: 'Grant access' }).click();
    await expect(m.page.getByRole('status')).toContainText('Access granted');
  } finally {
    await m.close();
  }
  const grantId = grantIdFor(counsel.email);
  psql(
    `update public.counsel_grants set granted_at = now() - interval '10 days', expires_at = now() - interval '1 day' where id = '${grantId}';`,
  );
  const c = await session(browser, counsel);
  try {
    await c.page.goto(`/counsel/${grantId}`);
    await expect(c.page.getByRole('status')).toContainText('This review is not available');
    await c.page.goto(`/counsel/${grantId}`);
    await expect(c.page.getByLabel('Your comment')).toHaveCount(0);
  } finally {
    await c.close();
  }
});
