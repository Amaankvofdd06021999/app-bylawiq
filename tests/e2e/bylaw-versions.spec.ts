import { expect, test, type Page } from '@playwright/test';
import { submitSignIn } from './support/sign-in';
import { assertLocalSupabase } from './support/local-mfa';
import { seedSliceManagers, type SliceAccount } from './support/slice-seed';

/**
 * Structured bylaws, real app, local stack: a building manager creates a bylaw section, edits it into a second version, and
 * compares the two versions word by word. Another building's manager does not see the bylaw.
 */

test.describe.configure({ mode: 'serial' });
test.setTimeout(180_000);

let managerA: SliceAccount;
let managerB: SliceAccount;

test.beforeAll(async () => {
  assertLocalSupabase();
  ({ managerA, managerB } = await seedSliceManagers());
});

function freshClientIp() {
  return `198.51.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;
}

async function signIn(page: Page, account: SliceAccount) {
  await page.setExtraHTTPHeaders({ 'x-real-ip': freshClientIp() });
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[name=email]', account.email);
  await page.fill('input[name=password]', account.password);
  await submitSignIn(page);
  await expect(page).not.toHaveURL(/\/login/);
}

const TITLE = `Pets ${Date.now()}`;
const FIRST = 'Two pets per unit.';
const SECOND = 'Two pets per unit, or three with council approval.';

test('a manager creates a bylaw, edits it, and compares the two versions', async ({ page }) => {
  await signIn(page, managerA);
  await page.goto(`/b/${managerA.buildingId}/bylaws`);
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: 'New bylaw' }).first().click();
  await page.getByLabel('Title', { exact: true }).fill(TITLE);
  await page.locator('input[name=section]').fill('5.1');
  await page.getByLabel('Your amendment').fill(FIRST);
  await page.getByRole('button', { name: 'Save new version' }).click();
  await expect(page.getByRole('button', { name: `Edit ${TITLE}` })).toBeVisible();

  await page.getByRole('button', { name: `Edit ${TITLE}` }).click();
  await expect(page.getByRole('heading', { name: 'Version history' })).toBeVisible();
  await expect(page.getByText('First version of this section.')).toBeVisible();

  await page.getByLabel('Your amendment').fill(SECOND);
  await page.getByLabel('Reason for change').fill('Council approved a third pet.');
  await page.getByRole('button', { name: 'Save new version' }).click();

  await page.getByRole('button', { name: `Edit ${TITLE}` }).click();
  await expect(page.locator('.bylaw-history strong', { hasText: /^Version 2$/ })).toBeVisible();
  await page.getByText('Compare with version 1').click();
  await expect(
    page.locator('.bylaw-history ins', { hasText: 'or three with council approval' }),
  ).toBeVisible();
  await expect(page.locator('.bylaw-history del', { hasText: 'Two' })).toHaveCount(0);
});

test('advisory checks show a blocker, and the save still succeeds while the rules are unreviewed', async ({
  page,
}) => {
  await signIn(page, managerA);
  await page.goto(`/b/${managerA.buildingId}/bylaws`);
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'New bylaw' }).first().click();
  await page.getByLabel('Title', { exact: true }).fill(`Rentals ${Date.now()}`);
  await page.locator('input[name=section]').fill('6.1');
  await page.getByLabel('Your amendment').fill('Owners must not rent their units to tenants.');
  await expect(page.getByRole('heading', { name: 'Advisory checks' })).toBeVisible();
  await expect(page.getByText('Blocker:')).toBeVisible();
  await expect(page.getByText('not legal approval', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Save new version' }).click();
  await expect(page.getByRole('button', { name: /^Edit Rentals/ })).toBeVisible();
});

test("another building's manager does not see the bylaw or its history", async ({ page }) => {
  await signIn(page, managerB);
  await page.goto(`/b/${managerA.buildingId}/bylaws`);
  await expect(page.getByRole('button', { name: `Edit ${TITLE}` })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Version history' })).toHaveCount(0);
});
