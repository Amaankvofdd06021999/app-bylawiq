import { execFileSync } from 'node:child_process';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { submitSignIn } from './support/sign-in';
import { assertLocalSupabase } from './support/local-mfa';
import { seedSingleBuildingManager, type SliceAccount } from './support/slice-seed';

/**
 * LTO filing, real app, local stack: an adopted amendment leaves an update on the home screen. The update escalates with age,
 * a refused reference explains why, and a valid filing removes the update. Another building's manager does not see it.
 */

test.describe.configure({ mode: 'serial' });
test.setTimeout(240_000);

const TITLE = `Filing ${Date.now()}`;
let managerA: SliceAccount;
let managerB: SliceAccount;

function psql(sql: string): string {
  return execFileSync(
    'docker',
    [
      'exec',
      '-i',
      'supabase_db_bylawiq',
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-At',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    { input: sql, encoding: 'utf8' },
  ).trim();
}

/** Backdates the open filing notice for this bylaw, to put it on a stated point of the schedule. */
function ageFilingNotice(days: number) {
  psql(
    `update public.notifications n set created_at = now() - interval '${days} days' from public.bylaw_versions v where v.id = n.target_id and n.type = 'unfiled_adoption' and v.building_id = '${managerA.buildingId}';`,
  );
}

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

async function session(browser: Browser, account: SliceAccount) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, account);
  return { page, close: () => context.close() };
}

async function moveBylaw(
  page: Page,
  nextStep: string,
  fill: (dialog: import('@playwright/test').Locator) => Promise<void>,
) {
  await page.goto(`/b/${managerA.buildingId}/bylaws`);
  await page.getByRole('button', { name: `Edit ${TITLE}` }).click();
  await page.getByRole('button', { name: `Move to ${nextStep}` }).click();
  const dialog = page.getByRole('dialog').last();
  await fill(dialog);
  await dialog.getByRole('button', { name: 'Save changes' }).click();
}

test.beforeAll(async () => {
  assertLocalSupabase();
  // Single-building managers: the building home is the screen that lists updates (the portfolio home does not).
  const stamp = `${Date.now()}`;
  managerA = await seedSingleBuildingManager(`lto-${stamp}`);
  managerB = await seedSingleBuildingManager(`lto-other-${stamp}`);
});

test('an adopted amendment leaves an update that escalates, and a refused reference is explained', async ({
  browser,
}) => {
  const s = await session(browser, managerA);
  try {
    await s.page.goto(`/b/${managerA.buildingId}/bylaws`);
    await s.page.getByRole('button', { name: 'New bylaw' }).first().click();
    await s.page.getByLabel('Title', { exact: true }).fill(TITLE);
    await s.page.locator('input[name=section]').fill('8.1');
    await s.page.getByLabel('Your amendment').fill('Quiet hours run from 10 pm to 7 am.');
    await s.page.getByRole('button', { name: 'Save new version' }).click();
    await expect(s.page.getByRole('button', { name: `Edit ${TITLE}` })).toBeVisible();

    await moveBylaw(s.page, 'Proposed', async (d) => {
      await d.getByLabel('Legal review').selectOption('counsel');
    });
    await moveBylaw(s.page, 'Voted', async (d) => {
      await d.getByLabel('Votes for').fill('3');
      await d.getByLabel('Votes against').fill('0');
      await d.getByLabel('Abstentions').fill('0');
    });
    await moveBylaw(s.page, 'Adopted', async (d) => {
      await d.getByLabel(/I have verified the supporting records/).check();
    });

    // Wait for the adoption to be written before reading the home screen (as the notices spec does).
    await expect
      .poll(
        () =>
          psql(
            `select count(*) from public.notifications n join public.bylaw_versions v on v.id = n.target_id where v.building_id = '${managerA.buildingId}' and n.type = 'unfiled_adoption' and n.state = 'new'`,
          ),
        { timeout: 20_000, intervals: [1_000] },
      )
      .toBe('1');

    // A new notice is informational: no "needs action" yet.
    await s.page.goto(`/b/${managerA.buildingId}/home`);
    await expect(s.page.getByText('Filing record needed')).toBeVisible();
    await expect(s.page.getByText('needs action')).toHaveCount(0);

    // After 20 days it is a warning on the home screen.
    ageFilingNotice(20);
    await s.page.reload();
    await expect(s.page.getByText('needs action')).toBeVisible();
    // The Updates screen shows the same escalation as the home screen.
    await s.page.goto(`/b/${managerA.buildingId}/updates`);
    await expect(s.page.getByText('Needs action', { exact: true })).toBeVisible();

    // After 70 days it is overdue.
    ageFilingNotice(70);
    await s.page.goto(`/b/${managerA.buildingId}/home`);
    await expect(s.page.getByText('overdue: record the LTO filing')).toBeVisible();
    await s.page.goto(`/b/${managerA.buildingId}/updates`);
    await expect(s.page.getByText('Overdue', { exact: true })).toBeVisible();

    // A reference that fails the rule is refused, with the reason shown in the dialog. The bylaw stays adopted.
    await s.page.goto(`/b/${managerA.buildingId}/bylaws`);
    await s.page.getByRole('button', { name: `Edit ${TITLE}` }).click();
    await s.page.getByRole('button', { name: 'Move to Filed' }).click();
    const dialog = s.page.getByRole('dialog').last();
    await dialog.getByLabel('Verified LTO filing reference').fill('AB');
    await dialog.getByLabel('Effective date').fill('2026-10-01');
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(dialog.getByText('Enter the LTO filing reference', { exact: false })).toBeVisible();
  } finally {
    await s.close();
  }
});

test('a valid filing removes the update, and another building never sees it', async ({ browser }) => {
  const a = await session(browser, managerA);
  try {
    await moveBylaw(a.page, 'Filed', async (d) => {
      await d.getByLabel('Verified LTO filing reference').fill('LTO-2026/1234');
      await d.getByLabel('Effective date').fill('2026-10-01');
    });
    // Wait for the filing to be written before reading the home screen. Saving the dialog returns before the write
    // commits on a slower browser (this failed on mobile in CI at 79b1071).
    await expect
      .poll(
        () =>
          psql(
            `select count(*) from public.notifications n join public.bylaw_versions v on v.id = n.target_id where v.building_id = '${managerA.buildingId}' and n.type = 'unfiled_adoption' and n.state = 'actioned'`,
          ),
        { timeout: 20_000, intervals: [1_000] },
      )
      .toBe('1');
    await a.page.goto(`/b/${managerA.buildingId}/home`);
    await expect(a.page.getByText('Filing record needed')).toHaveCount(0);
  } finally {
    await a.close();
  }

  const b = await session(browser, managerB);
  try {
    await b.page.goto(`/b/${managerA.buildingId}/home`);
    await expect(b.page.getByText('Filing record needed')).toHaveCount(0);
  } finally {
    await b.close();
  }
});
