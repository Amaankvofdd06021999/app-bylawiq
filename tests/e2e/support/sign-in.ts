import { expect, type Page } from '@playwright/test';

/**
 * Submits the sign-in form. Under heavy parallel load a submit can be dropped before the server action runs, and the
 * form then waits on the same page. One resubmit covers that. Credentials are unchanged, and a wrong password would
 * still fail the assertion that follows.
 */
export async function submitSignIn(page: Page) {
  await page.click('button[type=submit]');
  try {
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
  } catch {
    await page.click('button[type=submit]');
  }
}
