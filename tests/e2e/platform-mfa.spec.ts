import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { assertLocalSupabase, seedMfaAccounts, totpAt, type SeededAccount } from './support/local-mfa';

/**
 * Platform admin console with MFA, against the local Supabase stack (see support/local-mfa.ts).
 * Admin pages deny access without an aal2 session, and the admin enrols an authenticator and passes a step-up code.
 */

test.describe.configure({ mode: 'serial' });

// The app limits sign-ins per client IP (10 per 15 minutes). Each run gets its own address, so repeated local runs
// do not share one bucket. Test-only: the header is set by this suite, not by production code.
const testClientIp = `198.51.100.${Math.floor(Math.random() * 250) + 1}`;
test.use({ extraHTTPHeaders: { 'x-real-ip': testClientIp } });

let admin: SeededAccount;
let ordinary: SeededAccount;
// Set by the enrolment test; the step-up test needs the same factor.
let enrolledSecret = '';
// The code shown for the enrolment's 30-second window. A step-up code must come from a different window.
let enrolledCode = '';

test.beforeAll(async () => {
  assertLocalSupabase();
  ({ admin, ordinary } = await seedMfaAccounts());
});

async function signIn(page: Page, account: SeededAccount) {
  await page.goto('/login');
  // Wait for hydration, or the fields can be filled before the form is live and the values are lost.
  await page.waitForLoadState('networkidle');
  await page.fill('input[name=email]', account.email);
  await page.fill('input[name=password]', account.password);
  await page.click('button[type=submit]');
  await expect(page).not.toHaveURL(/\/login/);
}

const consoleHeading = (page: Page) => page.getByRole('heading', { name: 'Platform Admin Console' });

test('an ordinary user is sent away from the platform console', async ({ page }) => {
  await signIn(page, ordinary);
  await page.goto('/admin/platform');
  await expect(page).not.toHaveURL(/\/admin\/platform/);
  await expect(consoleHeading(page)).toHaveCount(0);
});

test('an admin without an authenticator is sent to MFA setup, not the console', async ({ page }) => {
  await signIn(page, admin);
  await page.goto('/admin/platform');
  await expect(page).toHaveURL(/\/admin\/platform\/mfa$/);
  await expect(page.getByRole('heading', { name: 'Set up your authenticator app' })).toBeVisible();
  await expect(consoleHeading(page)).toHaveCount(0);
});

test('an admin enrols an authenticator and then reaches the console', async ({ page }) => {
  await signIn(page, admin);
  await page.goto('/admin/platform/mfa');
  await page.getByRole('button', { name: 'Start setup' }).click();

  const secret = (await page.locator('.mfa-enrollment code').textContent())?.trim() ?? '';
  expect(secret).toMatch(/^[A-Z2-7]+=*$/);
  enrolledSecret = secret;
  enrolledCode = totpAt(secret);

  await page.fill('#mfa-code', totpAt(secret));
  await page.getByRole('button', { name: 'Finish setup' }).click();

  await expect(page).toHaveURL(/\/admin\/platform$/);
  await expect(consoleHeading(page)).toBeVisible();
});

test('a new sign-in needs a step-up code, a wrong code is refused, and the right code opens the console', async ({
  browser,
}) => {
  // The step-up waits for the next 30-second TOTP window, which can take longer than the default test timeout.
  test.setTimeout(150_000);
  expect(enrolledSecret).not.toBe('');
  const context: BrowserContext = await browser.newContext();
  const page = await context.newPage();
  try {
    await signIn(page, admin);
    await page.goto('/admin/platform');
    await expect(page).toHaveURL(/\/admin\/platform\/mfa$/);
    await expect(page.getByRole('heading', { name: 'Confirm it is you' })).toBeVisible();

    await page.fill('#mfa-code', '000000');
    await page.getByRole('button', { name: 'Confirm' }).click();
    // Scoped by id: Next.js also renders a role="alert" element of its own.
    await expect(page.locator('#mfa-error')).toHaveText(/not valid/);
    await expect(consoleHeading(page)).toHaveCount(0);

    // The enrolment test used the code for the current 30-second step. Wait for the next step so the code is fresh.
    // Poll the clock until the authenticator moves to a new window, instead of sleeping a fixed time.
    await expect
      .poll(() => totpAt(enrolledSecret), { timeout: 45_000, intervals: [1_000] })
      .not.toBe(enrolledCode);
    await page.fill('#mfa-code', totpAt(enrolledSecret));
    await page.getByRole('button', { name: 'Confirm' }).click();

    await expect(page).toHaveURL(/\/admin\/platform$/);
    await expect(consoleHeading(page)).toBeVisible();
  } finally {
    await context.close();
  }
});
