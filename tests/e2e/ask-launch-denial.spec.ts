import { randomUUID } from 'node:crypto';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { submitSignIn } from './support/sign-in';
import { assertLocalSupabase } from './support/local-mfa';
import { seedSliceManagers, type SliceAccount } from './support/slice-seed';

/**
 * Launch scope: AI answers (building-manager Ask) are off for this release. The rule is enforced on the server (lib/launch-scope.ts),
 * so a request that skips the screen is refused too. The Ask screen says so, and the conversation pages do not open.
 */

test.describe.configure({ mode: 'serial' });
test.setTimeout(120_000);

// A well-formed id. The refusal happens before any chat is looked up, so the chat does not need to exist.
const CHAT_ID = randomUUID();
const OFF_MESSAGE = 'not available in this release';

let managerA: SliceAccount;
let managerB: SliceAccount;

test.beforeAll(async () => {
  assertLocalSupabase();
  ({ managerA, managerB } = await seedSliceManagers());
});

// The app limits sign-ins per client IP, so each sign-in gets its own address.
function freshClientIp() {
  return `198.51.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;
}

async function signedInContext(page: Page, account: SliceAccount) {
  await page.setExtraHTTPHeaders({ 'x-real-ip': freshClientIp() });
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[name=email]', account.email);
  await page.fill('input[name=password]', account.password);
  await submitSignIn(page);
  await expect(page).not.toHaveURL(/\/login/);
}

function askRequest(chatId: string) {
  return {
    id: chatId,
    message: {
      id: randomUUID(),
      role: 'user',
      parts: [{ type: 'text', text: 'Are pets limited per unit?' }],
    },
  };
}

test('the Ask screen says Ask is not available and offers no question box', async ({ page }) => {
  await signedInContext(page, managerA);
  await page.goto(`/b/${managerA.buildingId}/ask`);
  await expect(
    page.getByText('Ask is not available in this release', { exact: false }).first(),
  ).toBeVisible();
  await expect(page.getByLabel('Ask BylawIQ')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Send question' })).toHaveCount(0);
});

test('a direct answer request from a building manager is refused with 403', async ({ browser }) => {
  const context: BrowserContext = await browser.newContext();
  const page = await context.newPage();
  try {
    await signedInContext(page, managerA);
    const res = await page.request.post('/api/chat', { data: askRequest(CHAT_ID) });
    expect(res.status()).toBe(403);
    expect(JSON.stringify(await res.json())).toContain(OFF_MESSAGE);
  } finally {
    await context.close();
  }
});

test('the stream and stop routes refuse too', async ({ browser }) => {
  const context: BrowserContext = await browser.newContext();
  const page = await context.newPage();
  try {
    await signedInContext(page, managerA);
    const stream = await page.request.get(`/api/chat/${CHAT_ID}/stream`);
    expect(stream.status()).toBe(403);
    const stop = await page.request.post(`/api/chat/${CHAT_ID}/stop`);
    expect(stop.status()).toBe(403);
  } finally {
    await context.close();
  }
});

test('the conversation page does not open', async ({ page }) => {
  await signedInContext(page, managerA);
  // The page calls notFound() after the layout has started streaming, so the status can stay 200. The check is that no
  // conversation renders: no question box, no send button, and the not-found page is shown instead.
  await page.goto(`/b/${managerA.buildingId}/chat/${CHAT_ID}`);
  await expect(page.getByLabel('Ask BylawIQ')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Send question' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'This page is unavailable.' })).toBeVisible();
});

test("another building's manager is refused the same way, by direct id", async ({ browser }) => {
  const context: BrowserContext = await browser.newContext();
  const page = await context.newPage();
  try {
    await signedInContext(page, managerB);
    const res = await page.request.post('/api/chat', { data: askRequest(CHAT_ID) });
    expect(res.status()).toBe(403);
    await page.goto(`/b/${managerA.buildingId}/ask`);
    await expect(page.getByLabel('Ask BylawIQ')).toHaveCount(0);
  } finally {
    await context.close();
  }
});
