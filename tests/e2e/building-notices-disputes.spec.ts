import { expect, test, type Browser, type Page } from '@playwright/test';
import { submitSignIn } from './support/sign-in';
import { assertLocalSupabase } from './support/local-mfa';
import { psqlScalar, seedSingleBuildingManager, type SliceAccount } from './support/slice-seed';

/**
 * Building manager, real app, local stack. A bylaw moves through the real steps to adopted, and the adoption leaves a
 * persisted "filing record needed" notification that the home shows as an update. A failed adoption (votes against) is
 * refused and says why. A dispute is logged as resolved and leaves the home. Another building's manager cannot see this
 * building's updates, bylaws or disputes, by direct id. A dispute summary that is too short is refused.
 */

test.describe.configure({ mode: 'serial' });
test.setTimeout(240_000);

const stamp = `${Date.now()}`;
const BYLAW = `Quiet hours ${stamp}`;
const FAILED_BYLAW = `Parking rules ${stamp}`;
const DISPUTE = `Noise complaint ${stamp}`;
const UPDATE = 'Filing record needed';

let manager: SliceAccount;
let other: SliceAccount;

test.beforeAll(async () => {
  assertLocalSupabase();
  manager = await seedSingleBuildingManager(`nd-${stamp}`);
  other = await seedSingleBuildingManager(`nd-other-${stamp}`);
});

async function signIn(page: Page, account: SliceAccount) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[name=email]', account.email);
  await page.fill('input[name=password]', account.password);
  await submitSignIn(page);
  await expect(page).not.toHaveURL(/\/login/);
  // A token issued in the same second as the next request can be read as 'issued in the future' on the local stack.
  await page.waitForTimeout(1_500);
}

async function session(
  browser: Browser,
  account: SliceAccount,
): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext({
    extraHTTPHeaders: {
      'x-real-ip': `198.51.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`,
    },
  });
  const page = await context.newPage();
  await signIn(page, account);
  return { page, close: () => context.close() };
}

/** Creates a bylaw through the bylaws screen and returns to its row. */
async function createBylaw(page: Page, title: string) {
  await page.goto(`/b/${manager.buildingId}/bylaws`);
  await page.getByRole('button', { name: 'New bylaw' }).first().click();
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.locator('input[name=section]').fill('4.1');
  await page.getByLabel('Your amendment').fill('Quiet hours run from 10 pm to 7 am on weekdays.');
  await page.getByRole('button', { name: 'Save new version' }).click();
  await expect(page.getByRole('button', { name: `Edit ${title}` })).toBeVisible();
}

/** Moves the bylaw one step through the transition dialog; the button names the next step. */
async function moveBylaw(
  page: Page,
  title: string,
  nextStep: string,
  fill: (dialog: import('@playwright/test').Locator) => Promise<void>,
) {
  await page.goto(`/b/${manager.buildingId}/bylaws`);
  await page.getByRole('button', { name: `Edit ${title}` }).click();
  await page.getByRole('button', { name: `Move to ${nextStep}` }).click();
  const dialog = page.getByRole('dialog').last();
  await fill(dialog);
  await dialog.getByRole('button', { name: 'Save changes' }).click();
}

test('an adopted bylaw without a filing record leaves an update on the home, saved in the database', async ({
  browser,
}) => {
  const s = await session(browser, manager);
  try {
    await createBylaw(s.page, BYLAW);
    await moveBylaw(s.page, BYLAW, 'Proposed', async (d) => {
      await d.getByLabel('Legal review').selectOption('counsel');
    });
    await moveBylaw(s.page, BYLAW, 'Voted', async (d) => {
      await d.getByLabel('Votes for').fill('3');
      await d.getByLabel('Votes against').fill('0');
      await d.getByLabel('Abstentions').fill('0');
    });
    await moveBylaw(s.page, BYLAW, 'Adopted', async (d) => {
      await d.getByLabel(/I have verified the supporting records/).check();
    });

    await expect
      .poll(
        () =>
          psqlScalar(
            `select count(*) from public.notifications n join public.bylaw_versions v on v.id = n.target_id where v.building_id = '${manager.buildingId}' and n.type = 'unfiled_adoption' and n.state = 'new'`,
          ),
        { timeout: 20_000, intervals: [1_000] },
      )
      .toBe('1');

    await s.page.goto(`/b/${manager.buildingId}/home`);
    await expect(s.page.getByText(UPDATE)).toBeVisible();
  } finally {
    await s.close();
  }
});

test('an adoption without a majority is refused, and the refusal says why', async ({ browser }) => {
  const s = await session(browser, manager);
  try {
    await createBylaw(s.page, FAILED_BYLAW);
    await moveBylaw(s.page, FAILED_BYLAW, 'Proposed', async (d) => {
      await d.getByLabel('Legal review').selectOption('counsel');
    });
    await moveBylaw(s.page, FAILED_BYLAW, 'Voted', async (d) => {
      await d.getByLabel('Votes for').fill('1');
      await d.getByLabel('Votes against').fill('2');
      await d.getByLabel('Abstentions').fill('0');
    });
    await s.page.goto(`/b/${manager.buildingId}/bylaws`);
    await s.page.getByRole('button', { name: `Edit ${FAILED_BYLAW}` }).click();
    await s.page.getByRole('button', { name: 'Move to Adopted' }).click();
    const dialog = s.page.getByRole('dialog').last();
    await dialog.getByLabel(/I have verified the supporting records/).check();
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(dialog.getByRole('alert')).toContainText('not available at the current stage');
    // Nothing was adopted, so no update was written for this bylaw.
    expect(
      psqlScalar(
        `select count(*) from public.bylaw_versions where building_id = '${manager.buildingId}' and status = 'adopted' and node_id in (select node_id from public.bylaw_versions where building_id = '${manager.buildingId}' and status = 'voted')`,
      ),
    ).toBe('0');
  } finally {
    await s.close();
  }
});

test('a dispute with a summary that is too short is refused; a logged resolution removes the dispute from the home', async ({
  browser,
}) => {
  const s = await session(browser, manager);
  try {
    await s.page.goto(`/b/${manager.buildingId}/disputes`);
    await s.page.getByRole('button', { name: 'Open dispute' }).first().click();
    const opening = s.page.getByRole('dialog').last();
    await opening.locator('input[name=title]').fill(DISPUTE);
    await opening.locator('select[name=category]').selectOption({ label: 'Noise' });
    await opening.locator('input[name=unit]').fill('6C');
    await opening.getByRole('button', { name: 'Save changes' }).click();
    await expect
      .poll(
        () =>
          psqlScalar(
            `select count(*) from public.disputes where building_id = '${manager.buildingId}' and title = '${DISPUTE}'`,
          ),
        { timeout: 30_000, intervals: [1_000] },
      )
      .toBe('1');

    // Failure: a summary of two characters is refused, and the dispute is not changed.
    await s.page.goto(`/b/${manager.buildingId}/disputes`);
    await s.page.getByRole('button', { name: DISPUTE }).first().click();
    await s.page.getByRole('button', { name: 'Log event' }).click();
    const short = s.page.getByRole('dialog').last();
    await short.getByLabel('Stage').selectOption('resolved');
    await short.getByLabel('When did this happen?').fill('2026-10-01T09:00');
    await short.getByLabel('Factual summary').fill('ok');
    await short.getByLabel(/I confirm this event is accurate/).check();
    await short.getByRole('button', { name: 'Save changes' }).click();
    await expect(short.getByRole('alert')).toContainText('Check the highlighted fields');
    expect(
      psqlScalar(
        `select count(*) from public.dispute_events e join public.disputes d on d.id = e.dispute_id where d.building_id = '${manager.buildingId}' and d.title = '${DISPUTE}'`,
      ),
    ).toBe('0');

    // Success: a valid resolution is recorded, and the closed dispute leaves the home.
    await s.page.goto(`/b/${manager.buildingId}/disputes`);
    await s.page.getByRole('button', { name: DISPUTE }).first().click();
    await s.page.getByRole('button', { name: 'Log event' }).click();
    const resolve = s.page.getByRole('dialog').last();
    await resolve.getByLabel('Stage').selectOption('resolved');
    await resolve.getByLabel('When did this happen?').fill('2026-10-01T09:00');
    await resolve.getByLabel('Factual summary').fill('Both parties agreed to quiet hours after 10 pm.');
    await resolve.getByLabel(/I confirm this event is accurate/).check();
    await resolve.getByRole('button', { name: 'Save changes' }).click();
    await expect
      .poll(
        () =>
          psqlScalar(
            `select count(*) from public.dispute_events e join public.disputes d on d.id = e.dispute_id where d.building_id = '${manager.buildingId}' and d.title = '${DISPUTE}' and e.stage = 'resolved'`,
          ),
        { timeout: 30_000, intervals: [1_000] },
      )
      .toBe('1');
    await s.page.goto(`/b/${manager.buildingId}/home`);
    await expect(s.page.getByText(DISPUTE)).toHaveCount(0);
  } finally {
    await s.close();
  }
});

test("another building's manager cannot see this building's updates, bylaws or disputes, by direct id", async ({
  browser,
}) => {
  const o = await session(browser, other);
  try {
    await o.page.goto(`/b/${manager.buildingId}/home`);
    await expect(o.page.getByText(UPDATE)).toHaveCount(0);
    await expect(o.page.getByText(DISPUTE)).toHaveCount(0);
    await o.page.goto(`/b/${manager.buildingId}/bylaws`);
    await expect(o.page.getByText(BYLAW)).toHaveCount(0);
    await expect(o.page.getByRole('button', { name: 'New bylaw' })).toHaveCount(0);
    await o.page.goto(`/b/${manager.buildingId}/disputes`);
    await expect(o.page.getByText(DISPUTE)).toHaveCount(0);
  } finally {
    await o.close();
  }
});
