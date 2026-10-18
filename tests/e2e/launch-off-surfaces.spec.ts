import { expect, test, type Browser, type Page } from '@playwright/test';
import { submitSignIn } from './support/sign-in';
import { assertLocalSupabase } from './support/local-mfa';
import { seedSliceManagers, type SliceAccount } from './support/slice-seed';

/**
 * Launch scope: the building bulletin and billing are off for this release (lib/launch-scope.ts). Each surface is
 * unavailable to every signed-in user: the page does not exist, and the payment webhook refuses before reading its secret.
 */

test.describe.configure({ mode: 'serial' });
test.setTimeout(120_000);

let managerA: SliceAccount;

test.beforeAll(async () => {
  assertLocalSupabase();
  ({ managerA } = await seedSliceManagers());
});

function freshClientIp() {
  return `198.51.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;
}

async function signedInPage(page: Page, account: SliceAccount) {
  await page.setExtraHTTPHeaders({ 'x-real-ip': freshClientIp() });
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[name=email]', account.email);
  await page.fill('input[name=password]', account.password);
  await submitSignIn(page);
  await expect(page).not.toHaveURL(/\/login/);
}

async function withManager(browser: Browser, run: (p: Page) => Promise<void>) {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await signedInPage(page, managerA);
    await run(page);
  } finally {
    await context.close();
  }
}

test('the building bulletin page is unavailable', async ({ browser }) => {
  await withManager(browser, async (page) => {
    await page.goto(`/b/${managerA.buildingId}/bulletin`);
    await expect(page.getByRole('heading', { name: 'This page is unavailable.' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Building Bulletin' })).toHaveCount(0);
  });
});

test('the billing page is unavailable', async ({ browser }) => {
  await withManager(browser, async (page) => {
    await page.goto('/admin/billing');
    await expect(page.getByRole('heading', { name: 'This page is unavailable.' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Billing & Plans' })).toHaveCount(0);
  });
});

test('the AI analytics page is unavailable', async ({ browser }) => {
  await withManager(browser, async (page) => {
    await page.goto('/admin/chat-analytics');
    await expect(page.getByRole('heading', { name: 'This page is unavailable.' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Chat & AI Analytics' })).toHaveCount(0);
  });
});

test('the Stripe webhook refuses every request with 404', async ({ browser }) => {
  await withManager(browser, async (page) => {
    const res = await page.request.post('/api/webhooks/stripe', { data: '{}' });
    expect(res.status()).toBe(404);
  });
});
