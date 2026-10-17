import { submitSignIn } from './support/sign-in';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { assertLocalSupabase } from './support/local-mfa';
import {
  documentError,
  documentStatus,
  seedSliceManagers,
  type SliceAccount,
  documentId,
} from './support/slice-seed';

/**
 * Vertical slice, real app, local stack: a building manager uploads a bylaw, indexing runs through the Inngest dev
 * server, and the manager confirms the detected structure. Another building's manager cannot see or query the document,
 * by page or by direct building id.
 *
 * Ask is not in this slice. It is off for launch (lib/launch-scope.ts) and its denial is tested in
 * ask-launch-denial.spec.ts. The answer path (retrieval, citations, refusal) can be run again only once it is enabled.
 */

test.describe.configure({ mode: 'serial' });
test.setTimeout(240_000);

const testClientIp = `198.51.100.${Math.floor(Math.random() * 250) + 1}`;
test.use({ extraHTTPHeaders: { 'x-real-ip': testClientIp } });

const TITLE = 'Pet rules';
const EFFECTIVE = '2024-01-01';
const QUOTE = 'Pets are limited to two per unit under the pet rules adopted in 2024.';
const QUESTION = 'Are pets limited per unit?';

let managerA: SliceAccount;
let managerB: SliceAccount;

test.beforeAll(async () => {
  assertLocalSupabase();
  ({ managerA, managerB } = await seedSliceManagers());
});

// The app limits sign-ins per client IP. Each sign-in gets its own address so a run never exhausts one bucket.
function freshClientIp() {
  return `198.51.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;
}

async function signIn(page: Page, account: SliceAccount) {
  await page.setExtraHTTPHeaders({ 'x-real-ip': freshClientIp() });
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[name=email]', account.email);
  await page.fill('input[name=password]', account.password);
  await submitSignIn(page);
  await expect(page).not.toHaveURL(/\/login/);
}

async function waitForStatus(title: string, buildingId: string, status: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  let current = '';
  while (Date.now() < deadline) {
    current = documentStatus(title, buildingId);
    if (current === status || current === 'failed') break;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return current;
}

test('a building manager uploads a bylaw and it is indexed for review', async ({ page }) => {
  await signIn(page, managerA);
  await page.goto(`/b/${managerA.buildingId}/documents`);
  // The header and the empty state both offer the action; either opens the same form.
  await page.getByRole('button', { name: 'Upload document' }).first().click();

  const dialog = page.getByRole('dialog');
  await dialog.locator('input[name=file]').setInputFiles({
    name: 'pet-rules.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(
      `${QUOTE} Dogs must be leashed in common areas at all times. Section 3.2 covers guest parking and visitor access to the garage.`,
    ),
  });
  await dialog.locator('input[name=title]').fill(TITLE);
  await dialog.locator('select[name=type]').selectOption('rules');
  await dialog.locator('input[name=effectiveDate]').fill(EFFECTIVE);
  await dialog.locator('input[name=consent]').check();
  await dialog.getByRole('button', { name: 'Upload & index' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 30_000 });

  // Indexing runs in the Inngest dev server. It must reach review, not failed.
  expect(await waitForStatus(TITLE, managerA.buildingId, 'review', 150_000)).toBe('review');
});

test('the manager confirms the detected structure and the document becomes ready', async ({ page }) => {
  await signIn(page, managerA);
  await page.goto(`/b/${managerA.buildingId}/documents`);
  await page.getByRole('button', { name: TITLE }).first().click();
  await page.getByRole('button', { name: 'Confirm detected structure' }).click();
  expect(await waitForStatus(TITLE, managerA.buildingId, 'ready', 30_000)).toBe('ready');
});

test('a building manager of another building cannot see or query the document', async ({ browser }) => {
  const context: BrowserContext = await browser.newContext({
    extraHTTPHeaders: { 'x-real-ip': testClientIp },
  });
  const page = await context.newPage();
  try {
    await signIn(page, managerB);

    // Direct id: building B's manager opens building A's documents page.
    await page.goto(`/b/${managerA.buildingId}/documents`);
    await expect(page.getByRole('button', { name: TITLE })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Upload document' })).toHaveCount(0);

    // Direct id: building B's manager asks building A's chat.
    await page.goto(`/b/${managerA.buildingId}/chat`);
    // If the page offers an input, ask; if it does not, that is also a denial. The assertion below decides either way.
    const input = page.getByLabel('Ask BylawIQ');
    if ((await input.count()) > 0) {
      await input.fill(QUESTION);
      await page.getByRole('button', { name: 'Send question' }).click();
    }
    await page.waitForTimeout(8_000);
    await expect(page.getByText(QUOTE)).toHaveCount(0);
    await expect(page.getByText('Pets are limited to two per unit', { exact: false })).toHaveCount(0);
  } finally {
    await context.close();
  }
});

async function uploadAs(
  page: Page,
  account: SliceAccount,
  file: { name: string; mimeType: string; buffer: Buffer },
  title: string,
) {
  await signIn(page, account);
  await page.goto(`/b/${account.buildingId}/documents`);
  await page.getByRole('button', { name: 'Upload document' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[name=file]').setInputFiles(file);
  await dialog.locator('input[name=title]').fill(title);
  await dialog.locator('select[name=type]').selectOption('rules');
  await dialog.locator('input[name=effectiveDate]').fill(EFFECTIVE);
  await dialog.locator('input[name=consent]').check();
  await dialog.getByRole('button', { name: 'Upload & index' }).click();
}

test('a file the malware scanner rejects is not indexed, and the manager sees why', async ({ browser }) => {
  const context: BrowserContext = await browser.newContext({
    extraHTTPHeaders: { 'x-real-ip': testClientIp },
  });
  const page = await context.newPage();
  try {
    const title = 'Infected bylaw';
    // The EICAR standard antivirus test string: the local scanner must flag it.
    await uploadAs(
      page,
      managerA,
      {
        name: 'infected.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('EICAR-STANDARD-ANTIVIRUS-TEST-FILE ' + 'x'.repeat(200)),
      },
      title,
    );
    expect(await waitForStatus(title, managerA.buildingId, 'failed', 150_000)).toBe('failed');
    expect(documentError(title, managerA.buildingId)).toMatch(/did not pass the malware scan/);
    expect(documentStatus(title, managerA.buildingId)).not.toBe('ready');
  } finally {
    await context.close();
  }
});

test('a scanned PDF with no text layer is refused with a clear message, and is never indexed', async ({
  browser,
}) => {
  const context: BrowserContext = await browser.newContext({
    extraHTTPHeaders: { 'x-real-ip': testClientIp },
  });
  const page = await context.newPage();
  try {
    const title = 'Scanned minutes';
    // A PDF header with no text layer: the pipeline must refuse it as a scan, not index it.
    const scanned = Buffer.from('%PDF-1.4\n%%EOF\n');
    await uploadAs(page, managerA, { name: 'scan.pdf', mimeType: 'application/pdf', buffer: scanned }, title);
    expect(await waitForStatus(title, managerA.buildingId, 'failed', 150_000)).toBe('failed');
    expect(documentError(title, managerA.buildingId)).toMatch(/scanned/i);
  } finally {
    await context.close();
  }
});

test('an upload over the 4 MB limit is refused in the form, before anything is stored', async ({
  browser,
}) => {
  const context: BrowserContext = await browser.newContext({
    extraHTTPHeaders: { 'x-real-ip': testClientIp },
  });
  const page = await context.newPage();
  try {
    await signIn(page, managerA);
    await page.goto(`/b/${managerA.buildingId}/documents`);
    await page.getByRole('button', { name: 'Upload document' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('input[name=file]').setInputFiles({
      name: 'big.txt',
      mimeType: 'text/plain',
      buffer: Buffer.alloc(4 * 1024 * 1024 + 1, 'a'),
    });
    await dialog.locator('input[name=title]').fill('Too large');
    await dialog.locator('input[name=effectiveDate]').fill(EFFECTIVE);
    await dialog.locator('input[name=consent]').check();
    await dialog.getByRole('button', { name: 'Upload & index' }).click();
    await expect(dialog.getByText(/under 4 MB/)).toBeVisible();
    expect(documentStatus('Too large', managerA.buildingId)).toBe('');
  } finally {
    await context.close();
  }
});

const APP_ORIGIN = 'http://127.0.0.1:3100';

test('a manager of another building cannot upload into building A, by direct id', async ({ browser }) => {
  const context: BrowserContext = await browser.newContext({
    extraHTTPHeaders: { 'x-real-ip': freshClientIp() },
  });
  const page = await context.newPage();
  try {
    await signIn(page, managerB);
    const form = new FormData();
    form.set('buildingId', managerA.buildingId);
    form.set('title', 'Injected from B');
    form.set('type', 'rules');
    form.set('knowledgeBaseId', '');
    form.set('effectiveDate', EFFECTIVE);
    form.set('filingReference', '');
    form.set('consent', 'on');
    form.set(
      'file',
      new Blob(['Pets are banned in building B.'.padEnd(200, ' ')], { type: 'text/plain' }),
      'b.txt',
    );
    const res = await page.request.post(APP_ORIGIN + '/api/upload', {
      multipart: {
        buildingId: managerA.buildingId,
        title: 'Injected from B',
        type: 'rules',
        knowledgeBaseId: '',
        effectiveDate: EFFECTIVE,
        filingReference: '',
        consent: 'on',
        file: {
          name: 'b.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('Pets are banned in building B.'.padEnd(200, ' ')),
        },
      },
      headers: { Origin: APP_ORIGIN },
    });
    expect(res.status()).toBe(403);
    expect(documentStatus('Injected from B', managerA.buildingId)).toBe('');
  } finally {
    await context.close();
  }
});

test('a failed document can be retried by its own building, and another building cannot retry it', async ({
  browser,
}) => {
  const context: BrowserContext = await browser.newContext({
    extraHTTPHeaders: { 'x-real-ip': freshClientIp() },
  });
  const page = await context.newPage();
  try {
    const id = documentId('Infected bylaw', managerA.buildingId);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    await signIn(page, managerB);
    const denied = await page.request.post(APP_ORIGIN + '/api/upload/retry', {
      data: { documentId: id },
      headers: { Origin: APP_ORIGIN },
    });
    // Another building's document is invisible to this manager, so the answer is not-found, not forbidden.
    expect(denied.status()).toBe(404);

    // The scanner counts the scans it receives. It is shared by both projects, so the check is that the retry added a scan.
    const scannerStats = async () =>
      (
        await page.request.get('http://127.0.0.1:' + (process.env.LOCAL_SCANNER_PORT ?? '8790') + '/stats')
      ).json() as Promise<{ scans: number }>;
    const before = (await scannerStats()).scans;
    await signIn(page, managerA);
    const retried = await page.request.post(APP_ORIGIN + '/api/upload/retry', {
      data: { documentId: id },
      headers: { Origin: APP_ORIGIN },
    });
    expect(retried.status()).toBe(200);
    await expect
      .poll(async () => (await scannerStats()).scans, { timeout: 90_000, intervals: [1_000] })
      .toBeGreaterThan(before);
    // The file is still infected, so the reprocessed scan refuses it again, with the same clear reason.    expect(await waitForStatus('Infected bylaw', managerA.buildingId, 'failed', 150_000)).toBe('failed');
    expect(documentError('Infected bylaw', managerA.buildingId)).toMatch(/did not pass the malware scan/);
  } finally {
    await context.close();
  }
});
