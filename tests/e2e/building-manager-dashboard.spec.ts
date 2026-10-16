import { submitSignIn } from './support/sign-in';
import { expect, test, type Page } from '@playwright/test';
import { assertLocalSupabase } from './support/local-mfa';
import {
  documentStatus,
  seedSingleBuildingManager,
  psqlScalar,
  type SliceAccount,
} from './support/slice-seed';

/**
 * Building manager, real app, local stack: the home shows the building from the database; an upload waits for
 * confirmation there; confirming makes it ready there; an opened dispute appears there. Another building's manager
 * cannot open this building's home, by direct id.
 */

test.describe.configure({ mode: 'serial' });
test.setTimeout(240_000);

const EFFECTIVE = '2024-01-01';
const TITLE = 'Pet rules';
const DISPUTE = 'Repeated late-night noise';

let manager: SliceAccount;
let other: SliceAccount;

test.beforeAll(async () => {
  assertLocalSupabase();
  manager = await seedSingleBuildingManager('dash');
  other = await seedSingleBuildingManager('dash-other');
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
  // A token issued in the same second as the next request can be read as 'issued in the future' (PGRST303) by the
  // database API on the local stack. One second clears it; the app is not changed for this.
  await page.waitForTimeout(1_500);
}

const home = (account: SliceAccount) => `/b/${account.buildingId}/home`;

test('the building home shows the real building, with nothing waiting', async ({ page }) => {
  await signIn(page, manager);
  await page.goto(home(manager));
  await expect(page.getByText(manager.buildingName).first()).toBeVisible();
  await expect(page.getByText('In order')).toBeVisible();
  await expect(page.getByText('0 ready')).toBeVisible();
  await expect(page.getByText('Plan and seats')).toHaveCount(0);
  await expect(page.getByText('Demo code')).toHaveCount(0);
});

test('an upload waits for confirmation on the home, and confirming it makes it ready there', async ({
  page,
}) => {
  await signIn(page, manager);
  await page.goto(`/b/${manager.buildingId}/documents`);
  await page.getByRole('button', { name: 'Upload document' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[name=file]').setInputFiles({
    name: 'pet-rules.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(
      'Pets are limited to two per unit under the pet rules adopted in 2024. Dogs must be leashed in common areas at all times.'.padEnd(
        200,
        ' ',
      ),
    ),
  });
  await dialog.locator('input[name=title]').fill(TITLE);
  await dialog.locator('select[name=type]').selectOption('rules');
  await dialog.locator('input[name=effectiveDate]').fill(EFFECTIVE);
  await dialog.locator('input[name=consent]').check();
  await dialog.getByRole('button', { name: 'Upload & index' }).click();

  await expect
    .poll(() => documentStatus(TITLE, manager.buildingId), { timeout: 150_000, intervals: [2_000] })
    .toBe('review');
  await page.goto(home(manager));
  await expect(page.getByText('Waiting for confirmation').first()).toBeVisible();
  await expect(page.getByText('1 waiting')).toBeVisible();

  await page.goto(`/b/${manager.buildingId}/documents`);
  await page.getByRole('button', { name: TITLE }).first().click();
  await page.getByRole('button', { name: 'Confirm detected structure' }).click();
  await expect
    .poll(() => documentStatus(TITLE, manager.buildingId), { timeout: 30_000, intervals: [1_000] })
    .toBe('ready');
  await page.goto(home(manager));
  await expect(page.getByText('1 ready')).toBeVisible();
  await expect(page.getByText('In order')).toBeVisible();
  await expect(page.getByText('None', { exact: true }).first()).toBeVisible();
});

test('an opened dispute is recorded and appears on the home with its reference', async ({ page }) => {
  await signIn(page, manager);
  await page.goto(`/b/${manager.buildingId}/disputes`);
  await page.getByRole('button', { name: 'Open dispute' }).first().click();
  const dialog = page.getByRole('dialog').last();
  await dialog.locator('input[name=title]').fill(DISPUTE);
  await dialog.locator('select[name=category]').selectOption({ label: 'Noise' });
  await dialog.locator('input[name=unit]').fill('4B');
  await dialog.getByRole('button', { name: 'Save changes' }).click();

  await expect
    .poll(
      () =>
        psqlScalar(
          `select count(*) from public.disputes where building_id = '${manager.buildingId}' and title = '${DISPUTE}'`,
        ),
      {
        timeout: 30_000,
        intervals: [1_000],
      },
    )
    .toBe('1');
  await page.goto(home(manager));
  await expect(page.getByText(DISPUTE)).toBeVisible();
});

test("another building's manager cannot open this building's home, by direct id", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await signIn(page, other);
    await page.goto(home(manager));
    await expect(page.getByText(manager.buildingName)).toHaveCount(0);
    await expect(page.getByText(DISPUTE)).toHaveCount(0);
    await expect(page.getByText('Documents ready for Ask')).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("another building's home shows its own building and none of this one's data", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await signIn(page, other);
    await page.goto(home(other));
    await expect(page.getByText(other.buildingName).first()).toBeVisible();
    await expect(page.getByText(DISPUTE)).toHaveCount(0);
    await expect(page.getByText('1 ready')).toHaveCount(0);
  } finally {
    await context.close();
  }
});
