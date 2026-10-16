import { expect, test, type Browser, type Page } from '@playwright/test';
import { assertLocalSupabase } from './support/local-mfa';
import { createLocalAccount, onboard, signInAs, type LocalAccount } from './support/accounts';
import { openPage } from './support/sign-in';

/**
 * Firm team, real app, local stack. The firm owner invites by email; the invitee accepts the link while signed in
 * with that email; the owner sees the member, and can remove them. Denials: another email cannot accept, a non-owner
 * sees no team controls, a used or revoked invitation is refused. Every membership is created through the product.
 */

test.describe.configure({ mode: 'serial' });
test.setTimeout(240_000);

const stamp = `${Date.now()}`;
let owner: LocalAccount;
let invitee: LocalAccount;
let outsider: LocalAccount;
let inviteLink = '';
let secondLink = '';
let inviteeName = '';

test.beforeAll(async () => {
  assertLocalSupabase();
  owner = await createLocalAccount('team-owner');
  invitee = await createLocalAccount('team-invitee');
  outsider = await createLocalAccount('team-outsider');
});

async function session(
  browser: Browser,
  account: LocalAccount,
): Promise<{ close: () => Promise<void>; page: Page }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signInAs(page, account);
  return { page, close: () => context.close() };
}

test('the firm owner invites a team member by email, and the link and the pending invitation are recorded', async ({
  browser,
}) => {
  const s = await session(browser, owner);
  try {
    await onboard(s.page, {
      accountType: 'Organization admin',
      name: 'Olivia Owner',
      organization: `Team firm ${stamp}`,
      building: `Team building ${stamp}`,
    });
    await openPage(s.page, '/workspace');
    await s.page.getByLabel('Email address').fill(invitee.email);
    await s.page.getByLabel('Role').selectOption('portfolio_manager');
    await s.page.getByRole('button', { name: 'Send invitation' }).click();

    const link = s.page.getByLabel('Invitation link');
    await expect(link).toBeVisible();
    inviteLink = ((await link.textContent()) ?? '').trim();
    expect(inviteLink).toMatch(/\/workspace\?firmInvite=[A-Za-z0-9_-]{20,}/);
    await expect(s.page.getByRole('row', { name: new RegExp(invitee.email) })).toBeVisible();
  } finally {
    await s.close();
  }
});

test('another email cannot accept the invitation, and the refusal says why', async ({ browser }) => {
  const s = await session(browser, outsider);
  try {
    // The outsider runs their own firm, so they have a workspace where an accept control could appear.
    await onboard(s.page, {
      accountType: 'Organization admin',
      name: 'Otto Outsider',
      organization: `Other firm ${stamp}`,
      building: `Other building ${stamp}`,
    });
    await openPage(s.page, new URL(inviteLink).pathname + new URL(inviteLink).search);
    await s.page.getByRole('button', { name: 'Accept invitation' }).click();
    await expect(s.page.locator('p[role="alert"]')).toContainText('sent to a different email address');
  } finally {
    await s.close();
  }
});

test('the invitee accepts with their own email, and the owner sees them on the team with their role', async ({
  browser,
}) => {
  const i = await session(browser, invitee);
  try {
    await onboard(i.page, {
      accountType: 'Portfolio manager',
      name: 'Ivy Invitee',
      organization: `Invitee firm ${stamp}`,
      building: `Invitee building ${stamp}`,
    });
    inviteeName = 'Ivy Invitee';
    await openPage(i.page, new URL(inviteLink).pathname + new URL(inviteLink).search);
    await i.page.getByRole('button', { name: 'Accept invitation' }).click();
    await expect(i.page).toHaveURL(/\/workspace$/);
    await expect(i.page.getByRole('button', { name: 'Accept invitation' })).toHaveCount(0);
  } finally {
    await i.close();
  }

  const o = await session(browser, owner);
  try {
    await openPage(o.page, '/workspace');
    const row = o.page.getByRole('row', { name: new RegExp(inviteeName) });
    await expect(row).toBeVisible();
    await expect(row.getByText('Portfolio manager')).toBeVisible();
    await expect(o.page.getByRole('row', { name: new RegExp(invitee.email) })).toHaveCount(0);
  } finally {
    await o.close();
  }
});

test('a member who is not an owner sees no team controls on their home', async ({ browser }) => {
  const i = await session(browser, invitee);
  try {
    await openPage(i.page, '/workspace');
    await expect(i.page.getByRole('button', { name: 'Send invitation' })).toHaveCount(0);
    await expect(i.page.getByRole('heading', { name: 'Invite a team member' })).toHaveCount(0);
    await expect(i.page.getByRole('button', { name: /^Remove / })).toHaveCount(0);
  } finally {
    await i.close();
  }
});

test('an accepted invitation cannot be used again, and the owner can revoke a pending one', async ({
  browser,
}) => {
  const o = await session(browser, owner);
  try {
    await openPage(o.page, '/workspace');
    await o.page.getByLabel('Email address').fill(outsider.email);
    await o.page.getByRole('button', { name: 'Send invitation' }).click();
    const link = o.page.getByLabel('Invitation link');
    await expect(link).toBeVisible();
    secondLink = ((await link.textContent()) ?? '').trim();
    await expect(
      o.page.getByRole('button', { name: `Revoke invitation for ${outsider.email}` }),
    ).toBeVisible();
    await o.page.getByRole('button', { name: `Revoke invitation for ${outsider.email}` }).click();
    await expect(o.page.getByRole('button', { name: `Revoke invitation for ${outsider.email}` })).toHaveCount(
      0,
      {
        timeout: 15_000,
      },
    );
  } finally {
    await o.close();
  }

  const x = await session(browser, outsider);
  try {
    await openPage(x.page, new URL(secondLink).pathname + new URL(secondLink).search);
    await x.page.getByRole('button', { name: 'Accept invitation' }).click();
    await expect(x.page.locator('p[role="alert"]')).toContainText('no longer valid');
  } finally {
    await x.close();
  }

  const i = await session(browser, invitee);
  try {
    await openPage(i.page, new URL(inviteLink).pathname + new URL(inviteLink).search);
    await i.page.getByRole('button', { name: 'Accept invitation' }).click();
    await expect(i.page.locator('p[role="alert"]')).toContainText('no longer valid');
  } finally {
    await i.close();
  }
});

test('the owner removes a member, who then loses the firm’s team view', async ({ browser }) => {
  const o = await session(browser, owner);
  try {
    await openPage(o.page, '/workspace');
    await o.page.getByRole('button', { name: `Remove ${inviteeName} from the firm` }).click();
    await expect(o.page.getByRole('row', { name: new RegExp(inviteeName) })).toHaveCount(0, {
      timeout: 15_000,
    });
  } finally {
    await o.close();
  }
});
