import { expect, test } from '@playwright/test';

/**
 * Sign-in recovery, real app: the sign-in request never gets an answer. The form must end the wait with a visible message,
 * and the button must come back so the person can try again. Before the fix, the button stayed busy with no message.
 */

test.describe.configure({ mode: 'serial' });
test.setTimeout(90_000);

test('a sign-in that never answers shows a message and the button comes back', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'x-real-ip': '198.51.100.200' });
  // Hold only the sign-in server action (it carries a Next-Action header). Other requests pass through.
  await page.route('**/login', async (route) => {
    if (route.request().method() === 'POST' && route.request().headers()['next-action']) {
      await new Promise((resolve) => setTimeout(resolve, 45_000));
      await route.abort();
      return;
    }
    await route.continue();
  });

  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[name=email]', 'nobody-recovery-probe@example.invalid');
  await page.fill('input[name=password]', 'a-long-enough-probe-password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByText('That took too long', { exact: false })).toBeVisible({ timeout: 40_000 });
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();
});
