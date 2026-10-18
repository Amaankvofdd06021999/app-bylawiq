import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { submitSignIn } from './support/sign-in';
import { assertLocalSupabase } from './support/local-mfa';
import { seedSingleBuildingManager, type SliceAccount } from './support/slice-seed';

/**
 * Notice delivery, real app, local stack. Sending is off until the sender design is approved, so the send path is tested as
 * refused. Status, masking, permissions and cross-building denial are tested for real.
 *
 * Fixtures are written as the database owner, because the queue function needs a manager session. The records match what the
 * queue function writes (a masked address, one row per resident).
 */

test.describe.configure({ mode: 'serial' });
test.setTimeout(180_000);

const stamp = Date.now();
let manager: SliceAccount;
let other: SliceAccount;
let resident: SliceAccount;
const approvedId = randomUUID();
const draftId = randomUUID();

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
  manager = await seedSingleBuildingManager(`nd-ui-${stamp}`);
  other = await seedSingleBuildingManager(`nd-ui-other-${stamp}`);
  // A resident is an account with no building of its own. A single-building account is bound to one building for good, so
  // a seeded manager account cannot also be a resident of another building.
  const residentEmail = `nd-ui-resident-${stamp}@example.invalid`;
  const residentPassword = 'resident-pw-' + stamp + '-long';
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY as string}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: residentEmail, password: residentPassword, email_confirm: true }),
  });
  const body = (await res.json()) as { id?: string; msg?: string };
  if (!res.ok || !body.id)
    throw new Error(`Creating the resident failed (HTTP ${res.status}): ${body.msg ?? 'no id'}`);
  resident = {
    id: body.id,
    email: residentEmail,
    password: residentPassword,
    buildingId: manager.buildingId,
    buildingName: '',
  };
  // The resident joins the manager's building; two notices exist, one approved and one still a draft.
  psql(
    `insert into public.building_members (building_id, user_id, role, status) values ('${manager.buildingId}', '${resident.id}', 'owner_resident', 'active');`,
  );
  psql(
    `insert into public.generated_documents (id, building_id, kind, title, body_md, status, created_by, approved_by, approved_at)
     values ('${approvedId}', '${manager.buildingId}', 's135_notice', 'Quiet hours ${stamp}', 'Please observe quiet hours.', 'approved', '${manager.id}', '${manager.id}', now());`,
  );
  psql(
    `insert into public.generated_documents (id, building_id, kind, title, body_md, status, created_by)
     values ('${draftId}', '${manager.buildingId}', 's135_notice', 'Draft ${stamp}', 'Not approved yet.', 'draft', '${manager.id}');`,
  );
  // Fixture rows as the queue function would write them: a masked address, one row per resident.
  const masked = `${resident.email[0]}***${resident.email.slice(resident.email.indexOf('@'))}`;
  psql(
    `insert into public.notice_deliveries (building_id, notice_id, recipient_user_id, masked_address, status, attempts, last_error)
     values ('${manager.buildingId}', '${approvedId}', '${resident.id}', '${masked}', 'failed', 1, 'The email could not be sent.');`,
  );
});

test('the manager sees the approved notice, masked residents and their status, and send is refused while sending is off', async ({
  browser,
}) => {
  const m = await session(browser, manager);
  try {
    await m.page.goto(`/b/${manager.buildingId}/notices/${approvedId}`);
    await expect(m.page.getByRole('heading', { name: `Quiet hours ${stamp}` })).toBeVisible();
    await expect(m.page.getByRole('cell', { name: 'Failed', exact: true })).toBeVisible();
    await expect(m.page.getByText('The email could not be sent.')).toBeVisible();
    // Addresses are masked everywhere on the page.
    const html = await m.page.content();
    expect(html).not.toContain(resident.email);
    // Retry is offered for the failed delivery. Sending is off, so the server refuses.
    await expect(m.page.getByRole('button', { name: /Retry 1 failed delivery/ })).toBeVisible();
    await m.page.getByRole('button', { name: 'Send to residents' }).click();
    await expect(m.page.getByText('turned off until the sender design is approved')).toBeVisible();
  } finally {
    await m.close();
  }
});

test('an unapproved notice cannot be sent, and the reason is shown', async ({ browser }) => {
  const m = await session(browser, manager);
  try {
    await m.page.goto(`/b/${manager.buildingId}/notices/${draftId}`);
    await expect(m.page.getByRole('button', { name: 'Send to residents' })).toBeDisabled();
    await expect(m.page.getByText('Only an approved notice can be sent to residents.')).toBeVisible();
    await expect(m.page.getByText('No deliveries yet.')).toBeVisible();
  } finally {
    await m.close();
  }
});

test('a resident cannot open the delivery screen', async ({ browser }) => {
  const r = await session(browser, resident);
  try {
    await r.page.goto(`/b/${manager.buildingId}/notices/${approvedId}`);
    await expect(r.page.getByText('This page is unavailable.')).toBeVisible();
    await expect(r.page.getByRole('button', { name: 'Send to residents' })).toHaveCount(0);
  } finally {
    await r.close();
  }
});

test("another building's manager cannot open this building's delivery screen, by direct id", async ({
  browser,
}) => {
  const o = await session(browser, other);
  try {
    await o.page.goto(`/b/${manager.buildingId}/notices/${approvedId}`);
    await expect(o.page.getByText('This page is unavailable.')).toBeVisible();
    await expect(o.page.getByText(`Quiet hours ${stamp}`)).toHaveCount(0);
  } finally {
    await o.close();
  }
});
