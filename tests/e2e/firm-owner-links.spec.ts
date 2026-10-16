import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { assertLocalSupabase } from './support/local-mfa';
import { createLocalAccount, onboard, signInAs, type LocalAccount } from './support/accounts';
import { openPage } from './support/sign-in';

/**
 * Firm owner, real app, local stack. Every relationship is created through the product: onboarding creates the firm
 * and its buildings; a building manager creates an invitation code on their building; the firm owner redeems it on the
 * firm home; removing access on the building unlinks it from the roster. Denials use other firms and direct ids.
 */

test.describe.configure({ mode: 'serial' });
test.setTimeout(240_000);

const stamp = `${Date.now()}`;
const names = {
  firm: `Firm owner ${stamp}`,
  firmBuilding: `Owner building ${stamp}`,
  solo: `Solo building ${stamp}`,
  outsider: `Outsider firm ${stamp}`,
  outsiderBuilding: `Outsider building ${stamp}`,
};

let owner: LocalAccount;
let manager: LocalAccount;
let outsider: LocalAccount;
let firmBuildingId: string;
let soloBuildingId: string;
let outsiderBuildingId: string;
let inviteCode = '';

test.beforeAll(async () => {
  assertLocalSupabase();
  owner = await createLocalAccount('firm-owner');
  manager = await createLocalAccount('bm-solo');
  outsider = await createLocalAccount('outsider');
});

async function newPage(
  browser: import('@playwright/test').Browser,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  return { context, page: await context.newPage() };
}

async function joinWithCode(page: Page, code: string) {
  await openPage(page, '/workspace');
  await page.getByLabel('Building code').fill(code);
  await page.getByRole('button', { name: 'Join building' }).click();
}

test('a building manager creates a code, and the firm owner joins the building from the firm home', async ({
  browser,
}) => {
  const owned = await newPage(browser);
  try {
    await signInAs(owned.page, owner);
    firmBuildingId = await onboard(owned.page, {
      accountType: 'Organization admin',
      name: 'Olivia Owner',
      organization: names.firm,
      building: names.firmBuilding,
    });
  } finally {
    await owned.context.close();
  }

  const solo = await newPage(browser);
  try {
    await signInAs(solo.page, manager);
    soloBuildingId = await onboard(solo.page, {
      accountType: 'Building manager',
      name: 'Sam Manager',
      organization: 'Sam strata',
      building: names.solo,
    });
    await openPage(solo.page, `/b/${soloBuildingId}/home`);
    await solo.page.getByRole('button', { name: 'Invite your strata management firm' }).click();
    const codeLabel = solo.page.getByLabel(/^Invitation code/);
    await expect(codeLabel).toBeVisible();
    inviteCode = ((await codeLabel.textContent()) ?? '').trim();
    expect(inviteCode).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  } finally {
    await solo.context.close();
  }

  const firm = await newPage(browser);
  try {
    await signInAs(firm.page, owner);
    await joinWithCode(firm.page, inviteCode);
    await expect(firm.page).toHaveURL(new RegExp(`/b/${soloBuildingId}/ask`));

    await openPage(firm.page, '/workspace');
    await expect(firm.page.getByRole('heading', { name: 'Building roster' })).toBeVisible();
    const row = firm.page.getByRole('row', { name: new RegExp(names.solo) });
    await expect(row.getByText('Linked')).toBeVisible();
    await expect(firm.page.getByRole('heading', { name: 'Your team' })).toBeVisible();
    await expect(firm.page.getByText('Olivia Owner').first()).toBeVisible();
  } finally {
    await firm.context.close();
  }
});

test('an invalid code is refused on the firm home, and nothing is linked', async ({ browser }) => {
  const firm = await newPage(browser);
  try {
    await signInAs(firm.page, owner);
    await joinWithCode(firm.page, 'ZZZZ-ZZZZ');
    await expect(firm.page.locator('#join-building-error')).toBeVisible();
    await expect(firm.page).not.toHaveURL(/\/ask$/);
  } finally {
    await firm.context.close();
  }
});

test('another firm sees neither this firm’s roster nor its buildings, and cannot open them by id', async ({
  browser,
}) => {
  const outside = await newPage(browser);
  try {
    await signInAs(outside.page, outsider);
    outsiderBuildingId = await onboard(outside.page, {
      accountType: 'Organization admin',
      name: 'Otto Outsider',
      organization: names.outsider,
      building: names.outsiderBuilding,
    });
    await openPage(outside.page, '/workspace');
    await expect(outside.page.getByText(names.solo)).toHaveCount(0);
    await expect(outside.page.getByText(names.firmBuilding)).toHaveCount(0);
    await openPage(outside.page, `/b/${soloBuildingId}/home`);
    await expect(outside.page.getByText(names.solo)).toHaveCount(0);
    await openPage(outside.page, `/b/${firmBuildingId}/home`);
    await expect(outside.page.getByText(names.firmBuilding)).toHaveCount(0);
  } finally {
    await outside.context.close();
  }
});

test('the firm owner cannot open another firm’s building by id, and sees their own firm’s linked building', async ({
  browser,
}) => {
  const firm = await newPage(browser);
  try {
    await signInAs(firm.page, owner);
    await openPage(firm.page, `/b/${outsiderBuildingId}/home`);
    await expect(firm.page.getByText(names.outsiderBuilding)).toHaveCount(0);
    await openPage(firm.page, '/workspace');
    await expect(firm.page.getByRole('row', { name: new RegExp(names.outsiderBuilding) })).toHaveCount(0);
    await expect(
      firm.page.getByRole('row', { name: new RegExp(names.solo) }).getByText('Linked'),
    ).toBeVisible();
  } finally {
    await firm.context.close();
  }
});

test('removing access on the building unlinks it from the firm roster', async ({ browser }) => {
  const solo = await newPage(browser);
  try {
    await signInAs(solo.page, manager);
    await openPage(solo.page, `/b/${soloBuildingId}/home`);
    await solo.page.getByRole('button', { name: 'Remove access' }).first().click();
    await solo.page.getByRole('dialog').getByRole('button', { name: 'Remove access' }).click();
    await expect(solo.page.getByRole('dialog')).toHaveCount(0, { timeout: 15_000 });
  } finally {
    await solo.context.close();
  }

  const firm = await newPage(browser);
  try {
    await signInAs(firm.page, owner);
    await openPage(firm.page, '/workspace');
    await expect(
      firm.page.getByRole('row', { name: new RegExp(names.solo) }).getByText('Not linked'),
    ).toBeVisible({
      timeout: 15_000,
    });
  } finally {
    await firm.context.close();
  }
});
