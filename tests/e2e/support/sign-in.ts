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

/**
 * Opens a page, and reloads it once if the app shows its error view. Used only for the local database API's token
 * timing race (PGRST303, a token read as issued in the future for a moment after sign-in). A second failure still fails.
 */
export async function openPage(page: Page, path: string) {
  await page.goto(path);
  const failed = page.getByRole('heading', { name: /couldn.t open this view/ });
  if (await failed.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await page.waitForTimeout(2_000);
    await page.goto(path);
  }
}
