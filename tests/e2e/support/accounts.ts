import { randomBytes } from 'node:crypto';
import { expect, type Page } from '@playwright/test';
import { assertLocalSupabase } from './local-mfa';
import { openPage, submitSignIn } from './sign-in';

/**
 * Local accounts for product-flow tests. Only the account itself is created here, through the local auth admin API.
 * Everything that links accounts to firms and buildings is done through the app (onboarding, codes, joins).
 * Local stack only.
 */

export type LocalAccount = { id: string; email: string; password: string };

export async function createLocalAccount(label: string): Promise<LocalAccount> {
  const url = assertLocalSupabase();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  const stamp = `${Date.now()}-${randomBytes(3).toString('hex')}`;
  const email = `e2e-${label}-${stamp}@example.invalid`;
  const password = `E2e-${randomBytes(12).toString('base64url')}-1`;
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!res.ok) throw new Error(`Creating a local test user failed with status ${res.status}`);
  const body = (await res.json()) as { id?: unknown };
  if (typeof body.id !== 'string' || !/^[0-9a-f-]{36}$/.test(body.id))
    throw new Error('Unexpected user id shape');
  return { id: body.id, email, password };
}

export function freshClientIp() {
  return `198.51.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;
}

export async function signInAs(page: Page, account: LocalAccount) {
  await page.setExtraHTTPHeaders({ 'x-real-ip': freshClientIp() });
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[name=email]', account.email);
  await page.fill('input[name=password]', account.password);
  await submitSignIn(page);
  await expect(page).not.toHaveURL(/\/login/);
  // See openPage: a token can be read as "issued in the future" for a moment after sign-in on the local stack.
  await page.waitForTimeout(1_500);
}

/**
 * Creates the workspace through the onboarding screen, as a new user does. Returns the new building's id.
 * The firm owner chooses "Organization admin"; a building manager chooses "Building manager".
 */
export async function onboard(
  page: Page,
  options: {
    accountType: 'Organization admin' | 'Portfolio manager' | 'Building manager';
    name: string;
    organization: string;
    building: string;
  },
): Promise<string> {
  await openPage(page, '/workspace');
  // Wait for hydration: filling the form before React is ready leaves the submit disabled.
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: new RegExp('^' + options.accountType) }).click();
  // Fill each field until its value sticks. Before hydration finishes, React can reset a field that was typed into.
  const fields: [string, string][] = [
    ['Your name', options.name],
    ['Organization or strata name', options.organization],
    ['Your first building', options.building],
  ];
  for (const [label, value] of fields) {
    await expect
      .poll(
        async () => {
          await page.getByLabel(label).fill(value);
          return page.getByLabel(label).inputValue();
        },
        { timeout: 20_000, intervals: [500] },
      )
      .toBe(value);
  }
  await page.getByLabel(/I am authorized to create this workspace/).check();
  // Submit, and if the workspace has not opened in 10 seconds, submit again (a click made before the form's handlers
  // are attached does nothing). A second submit for an existing workspace is refused, so it cannot create a duplicate.
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (/\/b\/[0-9a-f-]{36}\//.test(page.url())) break;
    // A timeout on the click: if the workspace already opened, the button is gone and the click must not wait forever.
    await page.getByRole('button', { name: 'Create workspace' }).click({ timeout: 5_000 }).catch(() => undefined);
    try {
      await expect(page).toHaveURL(/\/b\/[0-9a-f-]{36}\//, { timeout: 10_000 });
      break;
    } catch (e) {
      if (attempt === 3) throw e;
    }
  }
  const match = page.url().match(/\/b\/([0-9a-f-]{36})\//);
  if (!match) throw new Error('Onboarding did not reach a building');
  return match[1];
}
