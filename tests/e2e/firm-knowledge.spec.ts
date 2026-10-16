import { expect, test, type Browser, type Page } from '@playwright/test';
import { assertLocalSupabase } from './support/local-mfa';
import { createLocalAccount, onboard, signInAs, type LocalAccount } from './support/accounts';
import { openPage } from './support/sign-in';

/**
 * Firm knowledge, real app, local stack. The firm owner publishes a document (pasted text), sees it persist, and
 * searches it. Failures: text too short; the same text published twice. Another firm's owner sees none of it.
 */

test.describe.configure({ mode: 'serial' });
test.setTimeout(240_000);

const stamp = `${Date.now()}`;
const TITLE = `Pet bylaw template ${stamp}`;
const TEXT = [
  'Pets are limited to two per unit. A pet owner must register each animal with the strata.',
  'Dogs must be leashed in common areas at all times, and owners clean up after their pets.',
].join('\n\n');

let owner: LocalAccount;
let outsider: LocalAccount;

test.beforeAll(async () => {
  assertLocalSupabase();
  owner = await createLocalAccount('kb-owner');
  outsider = await createLocalAccount('kb-outsider');
});

async function session(
  browser: Browser,
  account: LocalAccount,
): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signInAs(page, account);
  return { page, close: () => context.close() };
}

async function publish(page: Page, title: string, text: string) {
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByLabel('Kind').selectOption('template');
  await page.getByLabel('Or paste the text').fill(text);
  await page.getByRole('button', { name: 'Publish to firm knowledge' }).click();
}

test('the firm owner publishes a document, and it persists and can be searched', async ({ browser }) => {
  const s = await session(browser, owner);
  try {
    await onboard(s.page, {
      accountType: 'Organization admin',
      name: 'Kim Knowledge',
      organization: `Knowledge firm ${stamp}`,
      building: `Knowledge building ${stamp}`,
    });
    await openPage(s.page, '/workspace');
    await publish(s.page, TITLE, TEXT);
    await expect(s.page.getByRole('status')).toContainText('Published');
    await expect(
      s.page.getByRole('list', { name: 'Published firm documents' }).getByText(TITLE),
    ).toBeVisible();

    await openPage(s.page, '/workspace');
    await expect(
      s.page.getByRole('list', { name: 'Published firm documents' }).getByText(TITLE),
    ).toBeVisible();

    await s.page.getByRole('searchbox', { name: 'Search firm knowledge' }).fill('leashed');
    await s.page.getByRole('button', { name: 'Search' }).click();
    const results = s.page.getByRole('list', { name: 'Search results' });
    await expect(results.getByText(TITLE)).toBeVisible();
    await expect(results.locator('blockquote')).toContainText('Dogs must be leashed');
  } finally {
    await s.close();
  }
});

test('text that is too short is refused, and nothing is published', async ({ browser }) => {
  const s = await session(browser, owner);
  try {
    await openPage(s.page, '/workspace');
    await publish(s.page, `Too short ${stamp}`, 'Too short.');
    await expect(s.page.locator('p[role="alert"]')).toContainText('Check the highlighted fields');
    await expect(s.page.getByText(`Too short ${stamp}`)).toHaveCount(0);
  } finally {
    await s.close();
  }
});

test('the same text cannot be published twice', async ({ browser }) => {
  const s = await session(browser, owner);
  try {
    await openPage(s.page, '/workspace');
    await publish(s.page, `${TITLE} copy`, TEXT);
    await expect(s.page.locator('p[role="alert"]')).toContainText('already exists');
  } finally {
    await s.close();
  }
});

test('another firm sees none of this library, and its search finds nothing', async ({ browser }) => {
  const s = await session(browser, outsider);
  try {
    await onboard(s.page, {
      accountType: 'Organization admin',
      name: 'Otto Other',
      organization: `Other knowledge firm ${stamp}`,
      building: `Other knowledge building ${stamp}`,
    });
    await openPage(s.page, '/workspace');
    await expect(s.page.getByText(TITLE)).toHaveCount(0);
    await s.page.getByRole('searchbox', { name: 'Search firm knowledge' }).fill('leashed');
    await s.page.getByRole('button', { name: 'Search' }).click();
    await expect(s.page.getByText('No firm documents match')).toBeVisible();
    await expect(s.page.getByRole('list', { name: 'Search results' })).toHaveCount(0);
  } finally {
    await s.close();
  }
});
