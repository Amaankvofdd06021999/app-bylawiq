import { expect, test, type Browser, type Page } from '@playwright/test';
import { assertLocalSupabase } from './support/local-mfa';
import { createLocalAccount, onboard, signInAs, type LocalAccount } from './support/accounts';
import { openPage } from './support/sign-in';

/**
 * Firm review, real app, local stack. A building manager links a strata firm with a code, drafts a notice and sends it to
 * the firm. The firm owner sees it in the inbox, requests changes (a reason is required), then approves the resubmitted
 * draft. The building sees each decision. Another firm and an unlinked building manager cannot see or decide the review.
 */

test.describe.configure({ mode: 'serial' });
test.setTimeout(300_000);

const stamp = `${Date.now()}`;
const FIRM_NAME = `Review firm ${stamp}`;
const BUILDING_NAME = `Review building ${stamp}`;
const FIRST_TITLE = `Council report one ${stamp}`;
const THIRD_TITLE = `Council report three ${stamp}`;
const BODY = 'The council considered the quarterly maintenance plan and noted the reserve fund balance.';

let building: LocalAccount;
let owner: LocalAccount;
let outsider: LocalAccount;
let buildingId: string;

test.beforeAll(async () => {
  assertLocalSupabase();
  building = await createLocalAccount('review-building');
  owner = await createLocalAccount('review-owner');
  outsider = await createLocalAccount('review-outsider');
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

/** The building drafts a notice and sends it to its strata firm for review. Ends with the notice awaiting the firm. */
async function draftAndSend(page: Page, title: string) {
  await openPage(page, `/b/${buildingId}/notices`);
  await page.getByRole('button', { name: 'Draft a notice' }).first().click();
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByLabel('Document content').fill(BODY);
  await page.getByRole('button', { name: 'Save draft' }).click();
  await openPage(page, `/b/${buildingId}/notices`);
  await page.getByRole('button', { name: `Edit ${title}` }).click();
  await page.getByRole('button', { name: 'Send to strata management' }).click();
  await page.getByLabel('Send this draft to your strata management firm to review.').check();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0);
  await openPage(page, `/b/${buildingId}/notices`);
  await page.getByRole('button', { name: `Edit ${title}` }).click();
  await expect(page.getByText('With strata management for review')).toBeVisible();
}

test('a building links a firm with a code, and sends a draft for review', async ({ browser }) => {
  const b = await session(browser, building);
  try {
    buildingId = await onboard(b.page, {
      accountType: 'Building manager',
      name: 'Bea Building',
      organization: `Review strata ${stamp}`,
      building: BUILDING_NAME,
    });
    await openPage(b.page, `/b/${buildingId}/settings`);
    await b.page.getByRole('button', { name: 'Invite your strata management firm' }).click();
    const codeText = await b.page.locator('p[aria-label^="Invitation code"]').textContent();
    const code = (codeText ?? '').replace(/\s+/g, '');
    expect(code.length).toBeGreaterThanOrEqual(6);

    // The firm owner creates the firm, then joins the building with the code.
    const f = await session(browser, owner);
    try {
      await onboard(f.page, {
        accountType: 'Organization admin',
        name: 'Olive Owner',
        organization: FIRM_NAME,
        building: `Firm own ${stamp}`,
      });
      await openPage(f.page, '/workspace');
      await f.page.getByLabel('Building code').fill(code);
      await f.page.getByRole('button', { name: 'Join building' }).click();
      await expect(f.page.getByText('Linked', { exact: true }).first()).toBeVisible();
    } finally {
      await f.close();
    }

    await draftAndSend(b.page, FIRST_TITLE);
  } finally {
    await b.close();
  }
});

test('the firm owner sees the draft in the inbox, requests changes with a reason, and the building sees it', async ({
  browser,
}) => {
  const f = await session(browser, owner);
  try {
    await openPage(f.page, '/workspace');
    await expect(f.page.getByRole('heading', { name: 'Waiting for your review' })).toBeVisible();
    await expect(f.page.getByRole('link', { name: FIRST_TITLE })).toBeVisible();

    await f.page.getByRole('link', { name: FIRST_TITLE }).click();
    await f.page.getByRole('button', { name: `Edit ${FIRST_TITLE}` }).click();
    await f.page.getByRole('button', { name: 'Request changes', exact: true }).click();

    // A reason is required: the empty form does not submit, and the draft stays with the firm.
    await f.page.getByLabel('Send this back to the author.').check();
    await f.page.getByRole('button', { name: 'Save changes' }).click();
    await expect(f.page.getByLabel('What needs to change?')).toBeVisible();

    await f.page.getByLabel('What needs to change?').fill('Cite the bylaw section for the reserve fund.');
    await f.page.getByLabel('Send this back to the author.').check();
    await f.page.getByRole('button', { name: 'Save changes' }).click();
    await expect(f.page.getByRole('table').getByText('Changes requested', { exact: true })).toBeVisible();
    await f.page.getByRole('button', { name: `Edit ${FIRST_TITLE}` }).click();
    await expect(f.page.getByText('Cite the bylaw section for the reserve fund.')).toBeVisible();
  } finally {
    await f.close();
  }

  const b = await session(browser, building);
  try {
    await openPage(b.page, `/b/${buildingId}/notices`);
    await b.page.getByRole('button', { name: `Edit ${FIRST_TITLE}` }).click();
    await b.page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(b.page.getByRole('table').getByText('Changes requested', { exact: true })).toBeVisible();
    await b.page.getByRole('button', { name: `Edit ${FIRST_TITLE}` }).click();
    await expect(b.page.getByText('Cite the bylaw section for the reserve fund.')).toBeVisible();
  } finally {
    await b.close();
  }
});

test('the building resubmits, and the firm owner approves it; the approval persists', async ({ browser }) => {
  const b = await session(browser, building);
  try {
    await openPage(b.page, `/b/${buildingId}/notices`);
    await b.page.getByRole('button', { name: `Edit ${FIRST_TITLE}` }).click();
    await b.page.getByRole('button', { name: 'Send to strata management' }).click();
    await b.page.getByLabel('Send this draft to your strata management firm to review.').check();
    await b.page.getByRole('button', { name: 'Save changes' }).click();
    await expect(b.page.getByRole('button', { name: 'Save changes' })).toHaveCount(0);
    await openPage(b.page, `/b/${buildingId}/notices`);
    await b.page.getByRole('button', { name: `Edit ${FIRST_TITLE}` }).click();
    await expect(b.page.getByText('With strata management for review')).toBeVisible();
  } finally {
    await b.close();
  }

  const f = await session(browser, owner);
  try {
    await openPage(f.page, '/workspace');
    await f.page.getByRole('link', { name: FIRST_TITLE }).click();
    await f.page.getByRole('button', { name: `Edit ${FIRST_TITLE}` }).click();
    await f.page.getByRole('button', { name: 'Approve', exact: true }).click();
    await f.page.getByLabel('I have checked the facts, sources and procedure.').check();
    await f.page.getByRole('button', { name: 'Save changes' }).click();
    await expect(f.page.getByRole('table').getByText('Approved', { exact: true })).toBeVisible();
  } finally {
    await f.close();
  }

  // Reloaded from the database, not from the page that made the decision.
  const b2 = await session(browser, building);
  try {
    await openPage(b2.page, `/b/${buildingId}/notices`);
    await b2.page.getByRole('button', { name: `Edit ${FIRST_TITLE}` }).click();
    await b2.page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(b2.page.getByRole('table').getByText('Approved', { exact: true })).toBeVisible();
  } finally {
    await b2.close();
  }
});

test('another firm and an unlinked view cannot see or decide a pending review', async ({ browser }) => {
  const b = await session(browser, building);
  try {
    // draftAndSend leaves the notice open, so the building's own view of the pending review is on screen.
    await draftAndSend(b.page, THIRD_TITLE);
    // The building itself does not get the firm's decision controls on its own review.
    await expect(b.page.getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0);
    await expect(b.page.getByRole('button', { name: 'Request changes', exact: true })).toHaveCount(0);
  } finally {
    await b.close();
  }

  const o = await session(browser, outsider);
  try {
    await onboard(o.page, {
      accountType: 'Organization admin',
      name: 'Otto Outsider',
      organization: `Other firm ${stamp}`,
      building: `Other firm building ${stamp}`,
    });
    await openPage(o.page, '/workspace');
    await expect(o.page.getByText('Nothing to review')).toBeVisible();
    await expect(o.page.getByRole('link', { name: THIRD_TITLE })).toHaveCount(0);

    // Direct address of the building's notices: the other firm sees none of its drafts and cannot decide them.
    await openPage(o.page, `/b/${buildingId}/notices`);
    await expect(o.page.getByText(THIRD_TITLE)).toHaveCount(0);
    await expect(o.page.getByRole('button', { name: `Edit ${THIRD_TITLE}` })).toHaveCount(0);
  } finally {
    await o.close();
  }
});
