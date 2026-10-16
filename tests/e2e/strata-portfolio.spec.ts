import { expect, test, type Page } from '@playwright/test';
import { assertLocalSupabase } from './support/local-mfa';
import { openPage, submitSignIn } from './support/sign-in';
import {
  addFailedUpload,
  portfolioDocumentStatus,
  seedPortfolio,
  type PortfolioAccount,
  type PortfolioFixture,
} from './support/portfolio-seed';

/**
 * Strata manager, real app, local stack: the portfolio lists the buildings the manager is linked to, with counts from
 * the database; a confirmation made in one building changes the portfolio; switching opens the chosen building; a
 * building outside the firm is refused by id; an outsider sees none of the portfolio.
 */

test.describe.configure({ mode: 'serial' });
test.setTimeout(240_000);

let fx: PortfolioFixture;

test.beforeAll(async () => {
  assertLocalSupabase();
  fx = await seedPortfolio();
});

function freshClientIp() {
  return `198.51.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;
}

async function signIn(page: Page, account: PortfolioAccount) {
  await page.setExtraHTTPHeaders({ 'x-real-ip': freshClientIp() });
  await openPage(page, '/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[name=email]', account.email);
  await page.fill('input[name=password]', account.password);
  await submitSignIn(page);
  await expect(page).not.toHaveURL(/\/login/);
  // A token issued in the same second as the next request can be read as "issued in the future" by the local database
  // API (PGRST303). A short pause clears it; the application is not changed for this.
  await page.waitForTimeout(1_500);
}

test('the strata manager’s portfolio lists the linked buildings, with counts from the database', async ({
  page,
}) => {
  await signIn(page, fx.strata);
  await openPage(page, '/workspace');
  await expect(page.getByRole('heading', { name: 'Your buildings' })).toBeVisible();
  await expect(page.getByRole('link', { name: new RegExp(fx.buildingA.name) })).toBeVisible();
  await expect(page.getByRole('link', { name: new RegExp(fx.buildingB.name) })).toBeVisible();
  await expect(page.getByText('1 review').first()).toBeVisible();
  await expect(page.getByText(fx.buildingOther.name)).toHaveCount(0);
});

test('a confirmation made in one building changes the portfolio, and nothing is shown for a building outside the firm', async ({
  page,
}) => {
  await signIn(page, fx.strata);
  await openPage(page, `/b/${fx.buildingA.id}/documents`);
  await page.getByRole('button', { name: 'Pet rules' }).first().click();
  await page.getByRole('button', { name: 'Confirm detected structure' }).click();
  await expect
    .poll(() => portfolioDocumentStatus('Pet rules', fx.buildingA.id), {
      timeout: 30_000,
      intervals: [1_000],
    })
    .toBe('ready');

  await openPage(page, '/workspace');
  await expect(page.getByText('0 review').first()).toBeVisible();
  await expect(page.getByText('1 review')).toHaveCount(0);
});

test('switching opens the chosen building, and another firm’s building is refused by direct id', async ({
  page,
}) => {
  await signIn(page, fx.strata);
  await openPage(page, '/workspace');
  await page.getByRole('link', { name: new RegExp(fx.buildingB.name) }).click();
  await expect(page).toHaveURL(new RegExp(`/b/${fx.buildingB.id}/`));
  await expect(page.getByText(fx.buildingB.name).first()).toBeVisible();

  await openPage(page, `/b/${fx.buildingOther.id}/documents`);
  await expect(page.getByText(fx.buildingOther.name)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Upload document' })).toHaveCount(0);
});

test('a failed upload is flagged on the portfolio', async ({ page }) => {
  addFailedUpload(fx.buildingB.id, fx.owner.id);
  await signIn(page, fx.strata);
  await openPage(page, '/workspace');
  await expect(page.getByText('Needs attention').first()).toBeVisible();
  await expect(page.getByText('1 upload failed').first()).toBeVisible();
});

test('an outsider from another firm sees none of this portfolio', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await signIn(page, fx.outsider);
    await openPage(page, '/workspace');
    await expect(page.getByText(fx.buildingA.name)).toHaveCount(0);
    await expect(page.getByText(fx.buildingB.name)).toHaveCount(0);
    await openPage(page, `/b/${fx.buildingA.id}/documents`);
    await expect(page.getByText(fx.buildingA.name)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Upload document' })).toHaveCount(0);
  } finally {
    await context.close();
  }
});
