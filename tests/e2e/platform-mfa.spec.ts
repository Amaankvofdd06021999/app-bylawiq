import { openPage, submitSignIn } from './support/sign-in';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { assertLocalSupabase, seedMfaAccounts, totpAt, waitForTotpWindow, type SeededAccount } from './support/local-mfa';

/**
 * Platform admin console with MFA, against the local Supabase stack (see support/local-mfa.ts).
 * Admin pages deny access without an aal2 session, and the admin enrols an authenticator and passes a step-up code.
 */

const expectSlow = expect.configure({ timeout: 20_000 }); // above the UI's 15-second deadline, below the test budget
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
  await submitSignIn(page);
  await expectSlow(page).not.toHaveURL(/\/login/);
}

const consoleHeading = (page: Page) => page.getByRole('heading', { name: 'Platform Admin Console' });

test('an ordinary user is sent away from the platform console', async ({ page }) => {
  await signIn(page, ordinary);
  await page.goto('/admin/platform');
  await expectSlow(page).not.toHaveURL(/\/admin\/platform/);
  await expectSlow(consoleHeading(page)).toHaveCount(0);
});

test('an admin without an authenticator is sent to MFA setup, not the console', async ({ page }) => {
  await signIn(page, admin);
  await page.goto('/admin/platform');
  await expectSlow(page).toHaveURL(/\/admin\/platform\/mfa$/);
  await expectSlow(page.getByRole('heading', { name: 'Set up your authenticator app' })).toBeVisible();
  await expectSlow(consoleHeading(page)).toHaveCount(0);
});

test('an admin enrols an authenticator and then reaches the console', async ({ page }) => {
  // Enrolment waits for a fresh TOTP window, which can take up to 30 seconds, so it needs more than the default budget.
  test.setTimeout(120_000);
  await signIn(page, admin);
  await page.goto('/admin/platform/mfa');
  await page.getByRole('button', { name: 'Start setup' }).click();

  const secret = (await page.locator('.mfa-enrollment code').textContent())?.trim() ?? '';
  expectSlow(secret).toMatch(/^[A-Z2-7]+=*$/);
  enrolledSecret = secret;
  enrolledCode = totpAt(secret);

  // Type the code early in its 30-second window, so it is still valid when the server checks it.
  await waitForTotpWindow();
  await page.fill('#mfa-code', totpAt(secret));
  await page.getByRole('button', { name: 'Finish setup' }).click();

  // The UI gives up after 15 seconds (CHECK_DEADLINE_MS); the server must answer within that bound.
  await expectSlow(page).toHaveURL(/\/admin\/platform$/, { timeout: 20_000 });
  await expectSlow(consoleHeading(page)).toBeVisible();
});

test('a new sign-in needs a step-up code, a wrong code is refused, and the right code opens the console', async ({
  browser,
}) => {
  // The step-up waits for the next 30-second TOTP window, which can take longer than the default test timeout.
  test.setTimeout(150_000);
  expectSlow(enrolledSecret).not.toBe('');
  const context: BrowserContext = await browser.newContext();
  const page = await context.newPage();
  try {
    await signIn(page, admin);
    await page.goto('/admin/platform');
    await expectSlow(page).toHaveURL(/\/admin\/platform\/mfa$/);
    await expectSlow(page.getByRole('heading', { name: 'Confirm it is you' })).toBeVisible();
    // Wait for hydration: typing before the form has React state leaves the button disabled.
    await page.waitForLoadState('networkidle');

    await page.fill('#mfa-code', '000000');
    await page.getByRole('button', { name: 'Confirm' }).click();
    // Scoped by id: Next.js also renders a role="alert" element of its own.
    await expectSlow(page.locator('#mfa-error')).toHaveText(/not valid/);
    await expectSlow(consoleHeading(page)).toHaveCount(0);

    // The enrolment test used the code for the current 30-second step. Wait for the next step so the code is fresh.
    // Poll the clock until the authenticator moves to a new window, instead of sleeping a fixed time.
    await expect
      .poll(() => totpAt(enrolledSecret), { timeout: 45_000, intervals: [1_000] })
      .not.toBe(enrolledCode);
    await page.fill('#mfa-code', totpAt(enrolledSecret));
    await page.getByRole('button', { name: 'Confirm' }).click();

    await expectSlow(page).toHaveURL(/\/admin\/platform$/);
    await expectSlow(consoleHeading(page)).toBeVisible();
  } finally {
    await context.close();
  }
});

test('a verification that does not answer is released after a deadline, and the code can be entered again', async ({
  browser,
}) => {
  // The held request is released after 30 seconds, so the test needs more than the default budget.
  test.setTimeout(90_000);
  const context = await browser.newContext({ extraHTTPHeaders: { 'x-real-ip': testClientIp } });
  const page = await context.newPage();
  try {
    await signIn(page, admin);
    await openPage(page, '/admin/platform');
    await expectSlow(page).toHaveURL(/\/admin\/platform\/mfa$/);

    // Hold the first verification request open. Server actions are POSTs that carry the Next-Action header.
    let held = false;
    await page.route('**/admin/platform/mfa', async (route) => {
      if (!route.request().headers()['next-action'] || held) return route.continue();
      held = true;
      await new Promise((resolve) => setTimeout(resolve, 30_000));
      return route.abort();
    });

    await page.fill('#mfa-code', '000000');
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expectSlow(page.locator('#mfa-error')).toContainText('did not finish', { timeout: 25_000 });
    await expectSlow(page.getByRole('button', { name: 'Confirm' })).toBeEnabled();
    await expectSlow(page.locator('#mfa-code')).toBeEnabled();
  } finally {
    await context.close();
  }
});
