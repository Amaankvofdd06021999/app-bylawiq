import { createHash } from 'node:crypto';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { assertLocalSupabase } from './support/local-mfa';
import { createLocalAccount, onboard, signInAs, type LocalAccount } from './support/accounts';
import { openPage } from './support/sign-in';

/**
 * Resident join, real app, local stack. A building manager invites a resident with a unit; the resident signs in with the
 * invited email and accepts; the manager verifies the unit; the resident's home shows it. Denials: a stranger with another
 * email, a link used twice, and another building's manager. A revoked invitation is revoked from the members page; an
 * expired one is expired by moving the invitation's expiry into the past through the local API (a 14-day wait is not
 * practical). The database rules for each case are also covered by supabase/tests/resident_join.test.sql.
 */

test.describe.configure({ mode: 'serial' });
test.setTimeout(300_000);

const stamp = `${Date.now()}`;
const BUILDING_NAME = `Resident building ${stamp}`;
const UNIT = '12A';

let manager: LocalAccount;
let resident: LocalAccount;
let stranger: LocalAccount;
let otherManager: LocalAccount;
let buildingId: string;
let inviteLink: string;

test.beforeAll(async () => {
  assertLocalSupabase();
  manager = await createLocalAccount('join-manager');
  resident = await createLocalAccount('join-resident');
  stranger = await createLocalAccount('join-stranger');
  otherManager = await createLocalAccount('join-other-manager');
});

async function session(
  browser: Browser,
  account: LocalAccount,
): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signInAs(page, account);
  return { page, close: () => context.close() };
}

test('a manager invites a resident with a unit, the resident joins, and the manager verifies the unit', async ({
  browser,
}) => {
  const m = await session(browser, manager);
  try {
    buildingId = await onboard(m.page, {
      accountType: 'Building manager',
      name: 'Mia Manager',
      organization: `Resident strata ${stamp}`,
      building: BUILDING_NAME,
    });
    await openPage(m.page, `/b/${buildingId}/residents`);
    await m.page.getByRole('button', { name: 'Invite Resident' }).click();
    await m.page.getByLabel('Email Address').fill(resident.email);
    await m.page.getByLabel('Unit number').fill(UNIT);
    await m.page.getByRole('button', { name: 'Send Invitation' }).click();
    inviteLink = (await m.page.locator('.link-output a').getAttribute('href')) ?? '';
    expect(inviteLink).toMatch(/\/invite\/[a-f0-9]{64}$/);
    await m.page.getByRole('button', { name: 'Done' }).click();
  } finally {
    await m.close();
  }

  const r = await session(browser, resident);
  try {
    await openPage(r.page, new URL(inviteLink).pathname);
    await r.page.getByRole('button', { name: 'Accept invitation' }).click();
    await expect(r.page.locator('p[role="status"]')).toContainText(
      `Unit ${UNIT} is waiting for your building manager`,
    );
  } finally {
    await r.close();
  }

  const m2 = await session(browser, manager);
  try {
    await openPage(m2.page, `/b/${buildingId}/residents`);
    const row = m2.page.locator('.table-row', { hasText: resident.email });
    await expect(row.getByText('Not verified')).toBeVisible();
    await row.getByRole('button', { name: 'Verify unit' }).click();
    await expect(row.getByText('Verified', { exact: true })).toBeVisible();
  } finally {
    await m2.close();
  }

  // The resident's own home, reloaded from the database, shows the verified unit.
  const r2 = await session(browser, resident);
  try {
    await openPage(r2.page, `/b/${buildingId}/home`);
    await expect(r2.page.locator('p[role="status"]')).toContainText(
      `Unit ${UNIT} is verified by your building manager`,
    );
  } finally {
    await r2.close();
  }
});

test('a stranger with another email cannot accept the invitation, and it cannot be reused', async ({
  browser,
}) => {
  const s = await session(browser, stranger);
  try {
    await openPage(s.page, new URL(inviteLink).pathname);
    await s.page.getByRole('button', { name: 'Accept invitation' }).click();
    await expect(s.page.locator('p[role="alert"]')).toContainText('can’t be used');
    await openPage(s.page, `/b/${buildingId}/ask`);
    await expect(s.page.getByText(BUILDING_NAME)).toHaveCount(0);
  } finally {
    await s.close();
  }

  // The resident who already joined uses the same link again: refused, and the membership is unchanged.
  const r = await session(browser, resident);
  try {
    await openPage(r.page, new URL(inviteLink).pathname);
    await r.page.getByRole('button', { name: 'Accept invitation' }).click();
    await expect(r.page.locator('p[role="alert"]')).toContainText('can’t be used');
  } finally {
    await r.close();
  }
});

test("another building's manager cannot see this building's residents or invite into it", async ({
  browser,
}) => {
  const o = await session(browser, otherManager);
  try {
    await onboard(o.page, {
      accountType: 'Building manager',
      name: 'Otto Other',
      organization: `Other resident strata ${stamp}`,
      building: `Other resident building ${stamp}`,
    });
    await openPage(o.page, `/b/${buildingId}/residents`);
    await expect(o.page.getByRole('button', { name: 'Invite Resident' })).toHaveCount(0);
    await expect(o.page.getByText(resident.email)).toHaveCount(0);
  } finally {
    await o.close();
  }
});

/** Sets an invitation's expiry on the local stack. Waiting 14 days is not possible in a test, so the test moves the clock. */
async function expireInvitation(token: string) {
  const url = assertLocalSupabase();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  const hash = createHash('sha256').update(token).digest('hex');
  const res = await fetch(`${url}/rest/v1/invitations?token_hash=eq.${hash}`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }),
  });
  if (!res.ok) throw new Error(`Moving the invitation clock failed with status ${res.status}`);
}

async function inviteFromResidents(page: Page, email: string): Promise<string> {
  await openPage(page, `/b/${buildingId}/residents`);
  await page.getByRole('button', { name: 'Invite Resident' }).click();
  await page.getByLabel('Email Address').fill(email);
  await page.getByLabel('Unit number').fill('5C');
  await page.getByRole('button', { name: 'Send Invitation' }).click();
  const link = (await page.locator('.link-output a').getAttribute('href')) ?? '';
  await page.getByRole('button', { name: 'Done' }).click();
  return link;
}

test('a revoked invitation is refused, and the manager sees it removed from pending invitations', async ({
  browser,
}) => {
  const revoked = await createLocalAccount('join-revoked');
  const m = await session(browser, manager);
  let link = '';
  try {
    link = await inviteFromResidents(m.page, revoked.email);
    await openPage(m.page, `/b/${buildingId}/members`);
    // Pending invitations are cards: the Revoke button sits in the card whose heading is the invited email.
    await m.page
      .locator('div')
      .filter({ has: m.page.getByRole('heading', { name: revoked.email }) })
      .filter({ has: m.page.getByRole('button', { name: 'Revoke' }) })
      .last()
      .getByRole('button', { name: 'Revoke' })
      .click();
    await openPage(m.page, `/b/${buildingId}/members`);
    await expect(m.page.getByText(revoked.email)).toHaveCount(0);
  } finally {
    await m.close();
  }

  const r = await session(browser, revoked);
  try {
    await openPage(r.page, new URL(link).pathname);
    await r.page.getByRole('button', { name: 'Accept invitation' }).click();
    await expect(r.page.locator('p[role="alert"]')).toContainText('can’t be used');
  } finally {
    await r.close();
  }
});

test('an expired invitation is refused', async ({ browser }) => {
  const expired = await createLocalAccount('join-expired');
  const m = await session(browser, manager);
  let link = '';
  try {
    link = await inviteFromResidents(m.page, expired.email);
  } finally {
    await m.close();
  }
  await expireInvitation(new URL(link).pathname.split('/').pop() ?? '');

  const r = await session(browser, expired);
  try {
    await openPage(r.page, new URL(link).pathname);
    await r.page.getByRole('button', { name: 'Accept invitation' }).click();
    await expect(r.page.locator('p[role="alert"]')).toContainText('can’t be used');
    await openPage(r.page, `/b/${buildingId}/home`);
    await expect(r.page.getByText(BUILDING_NAME)).toHaveCount(0);
  } finally {
    await r.close();
  }
});
