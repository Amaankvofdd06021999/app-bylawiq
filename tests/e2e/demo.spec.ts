import { randomUUID } from 'node:crypto';
import { test, expect, type Page } from '@playwright/test';
import { IDS } from '@/mock/data';
// Business-flow and permission-scoping coverage for the five demo personas (see AGENTS.md §0: scope is
// enforced in the mock store the same way RLS enforces it for real, so these are the demo's equivalent of a
// cross-building leak test). Layout/responsiveness across widths is covered separately in responsive.spec.ts,
// so this file runs once, from the desktop project.
test.beforeEach(({}, info) => {
  test.skip(info.project.name !== 'desktop', 'Not a layout test; runs once');
});
const seaside = IDS.buildings.seaside;
const harbour = IDS.buildings.harbour;
const draftTitle = 'Visitor parking · Draft response';

test('each person lands where their role begins, with navigation scoped to their permissions', async ({
  page,
}) => {
  await page.goto('/demo/start/platform');
  await expect(page).toHaveURL(/\/demo\/admin$/);
  await expect(page.getByRole('heading', { name: 'Platform overview' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0); // no building sidebar
  await expect(page.getByText('Monthly recurring revenue')).toBeVisible();
  await expect(page.getByText('$198.50', { exact: true })).toBeVisible();

  await page.goto('/demo/start/owner');
  await expect(page).toHaveURL(/\/demo\/workspace$/);
  await expect(page.getByRole('heading', { name: /^Welcome back, Dana\./ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your team' })).toBeVisible();

  await page.goto('/demo/start/strata');
  await expect(page).toHaveURL(/\/demo\/workspace$/);
  await expect(page.getByRole('heading', { name: /^Welcome back, Sarah\./ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Needs attention today' })).toBeVisible();

  await page.goto('/demo/start/building');
  await expect(page).toHaveURL(new RegExp('/demo/b/' + seaside + '/home$'));
  await expect(page.getByRole('heading', { name: 'Seaside Towers', level: 1 })).toBeVisible();
  const managerNav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(managerNav.getByRole('link').first()).toHaveText('Home');
  await expect(managerNav.getByRole('link', { name: 'Notices' })).toBeVisible();
  await expect(managerNav.getByRole('link', { name: 'Disputes' })).toBeVisible();

  await page.goto('/demo/start/resident');
  await expect(page).toHaveURL(new RegExp('/demo/b/' + seaside + '/home$'));
  await expect(page.getByRole('heading', { name: 'Hi Priya.' })).toBeVisible();
  const residentNav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(residentNav.getByRole('link').first()).toHaveText('Home');
  // Demo only: paid resident tools (mock-only `chat.resident`); staff sections stay hidden.
  await expect(residentNav.getByRole('link', { name: /^Ask BylawIQ/ })).toBeVisible();
  for (const name of ['Explainers', 'Draft a notice', 'Reply to a letter', 'My drafts', 'Credits'])
    await expect(residentNav.getByRole('link', { name })).toBeVisible();
  await expect(residentNav.getByRole('link', { name: 'Notices' })).toHaveCount(0);
  await expect(residentNav.getByRole('link', { name: 'Disputes' })).toHaveCount(0);
  // Bylaws and Updates need chat.use, same as Notices — a resident has only building.read/vault.read (+ demo chat.resident).
  await expect(residentNav.getByRole('link', { name: 'Bylaws' })).toHaveCount(0);
  await expect(residentNav.getByRole('link', { name: 'Updates' })).toHaveCount(0);
  await expect(residentNav.getByRole('link', { name: 'Documents' })).toBeVisible();
});

test('the platform admin turns resident AI off, and Ask disappears for the resident', async ({ page }) => {
  await page.goto('/demo/start/platform');
  const flag = page.getByRole('switch', { name: 'Resident AI' });
  await expect(flag).toHaveAttribute('aria-checked', 'true');
  await flag.click();
  await expect(flag).toHaveAttribute('aria-checked', 'false');
  await page.goto('/demo/start/resident');
  await expect(
    page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: /^Ask BylawIQ/ }),
  ).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp('/demo/b/' + seaside + '/home$'));
  await expect(page.getByRole('heading', { name: 'AI help is paused' })).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Draft a notice' }),
  ).toHaveCount(0);
  // A direct visit to Ask shows it's paused rather than a question box that can only fail.
  await page.goto('/demo/b/' + seaside + '/ask');
  await expect(page.getByRole('heading', { name: 'Ask is paused' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Ask BylawIQ' })).toHaveCount(0);
});

test('a resident drafts a notice to council from her owner bylaws, and it is saved to her drafts', async ({
  page,
}) => {
  await page.goto('/demo/start/resident');
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Draft a notice' })
    .click();
  await expect(page.getByRole('note', { name: 'Legal notice' })).toContainText(
    'Drafting help for owners needs legal sign-off before launch — demo only',
  );
  await page.getByLabel('Topic').fill('Weekend renovation noise');
  await page.getByLabel('What happened').fill('Renovation noise started at 7:30 am on Saturday.');
  await page
    .getByLabel('What you want council to do')
    .fill('Please remind the owner of the weekend start time.');
  await page.getByRole('button', { name: /^Draft my notice/ }).click();
  await expect(page.getByLabel('Draft text')).toContainText('Bylaw 3.1 says');
  await expect(page.getByLabel('Draft text')).toContainText('Unit 1204');
  await page.getByRole('link', { name: 'My drafts' }).first().click();
  await expect(
    page.getByRole('heading', { name: 'Notice to council · Weekend renovation noise' }),
  ).toBeVisible();
});

test('a resident sees only the documents marked visible to owners', async ({ page }) => {
  await page.goto('/demo/start/resident');
  await page.goto('/demo/b/' + seaside + '/documents');
  for (const title of [
    'Registered bylaws · Consolidated 2025',
    'Building rules · Common areas',
    'Move-in package · Guide for new owners',
  ])
    await expect(page.getByText(title)).toBeVisible();
  for (const title of [
    'Council meeting minutes · June 2026',
    'AGM minutes · March 2026',
    'Insurance summary · 2026–2027',
    'Strata plan · Original filing',
    'Financial statements · 2025',
  ])
    await expect(page.getByText(title)).toHaveCount(0);
});

test("a direct link to a building outside the person's access shows the access-removed notice, not that building's data", async ({
  page,
}) => {
  await page.goto('/demo/start/building'); // James is bound to Seaside only
  await page.goto('/demo/b/' + harbour + '/documents');
  await expect(page).toHaveURL(/\/demo\/workspace\?notice=access_removed$/);
  await expect(page.getByRole('status')).toContainText(/no longer have access/);
});

// The task-7 brief leaves the exact scenario for cross-persona review ambiguous; per the brief for this task,
// it is: James (building manager) sends the seeded Seaside draft to strata management, then Sarah (strata
// manager) sees it in her review inbox and approves it — exercised here through the real "Switch person"
// control, not a cookie workaround: mock/session.ts#startDemo now keeps the same demo session when switching
// persona (only Reset demo reseeds it), so the draft James sends is still there once Sarah switches in.
test("a sent draft reaches strata management's review inbox and can be approved", async ({ page }) => {
  await page.goto('/demo/start/building');
  await page.goto('/demo/b/' + seaside + '/notices');
  await page.getByText(draftTitle).click();
  const editor = page.getByRole('dialog', { name: 'Review document' });
  await editor.getByRole('button', { name: 'Send to strata management' }).click();
  const sendForm = page.getByRole('dialog', { name: 'Send to strata management' });
  await sendForm.getByLabel('Send this draft to your strata management firm to review.').check();
  await sendForm.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('tr', { hasText: draftTitle })).toContainText('Pending review');

  await page.getByRole('link', { name: 'Switch person' }).click();
  await expect(page).toHaveURL(/\/demo$/);
  await page.getByRole('link', { name: /Sarah Chen/ }).click();
  await expect(page).toHaveURL(/\/demo\/workspace$/);
  const inbox = page.getByRole('region', { name: 'Waiting for your review' });
  await expect(inbox.getByRole('link', { name: draftTitle })).toBeVisible();
  await inbox.getByRole('link', { name: draftTitle }).click();
  await expect(page).toHaveURL(new RegExp('/demo/b/' + seaside + '/notices$'));

  await page.getByText(draftTitle).click();
  const review = page.getByRole('dialog', { name: 'Review document' });
  await review.getByRole('button', { name: 'Approve', exact: true }).click();
  const approveForm = page.getByRole('dialog', { name: 'Approve for the building' });
  await approveForm.getByLabel('I have checked the facts, sources and procedure.').check();
  await approveForm.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('tr', { hasText: draftTitle })).toContainText('Approved');
});

// Layered answers: the firm's internal practice is a separate, labelled section for firm staff only.
async function ask(page: Page, question: string) {
  await page.goto('/demo/b/' + seaside + '/ask');
  await page.getByRole('textbox', { name: 'Ask BylawIQ' }).fill(question);
  await page.getByRole('button', { name: 'Send question' }).click();
  await expect(page).toHaveURL(/\/chat\//);
  await expect(
    page.getByRole('heading', { name: 'What Seaside Towers’ bylaws and documents say' }).first(),
  ).toBeVisible();
}
test("a strata manager's answer adds Coastline's internal practice, and a building manager's never does", async ({
  page,
}) => {
  await page.goto('/demo/start/strata');
  await ask(page, 'What is the fine for noise?');
  await expect(page.getByRole('heading', { name: 'What the law says' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /internal practice — not law or bylaw/ })).toBeVisible();

  await page.goto('/demo/start/building');
  await ask(page, 'What is the fine for noise?');
  await expect(page.getByRole('heading', { name: /internal practice/ })).toHaveCount(0);
  await expect(page.getByText(/Coastline/)).toHaveCount(0);
});

// Spends the resident's credits down to `leave` without clicking through dozens of questions: one question through
// the UI (her two free questions are already used, so it costs 1 of her 87 credits), then the same paid question
// sent straight to the demo chat API as her. Returns on that conversation's page.
async function spendCreditsTo(page: Page, leave: number) {
  await page.goto('/demo/start/resident');
  await ask(page, 'What are the quiet hours?');
  const chatId = new URL(page.url()).pathname.split('/chat/')[1];
  // Sent from the page (not `page.request`) so the browser attaches the demo's Secure session cookies.
  const ids = Array.from({ length: 86 - leave }, () => randomUUID());
  const statuses = await page.evaluate(
    async ({ chatId, ids }) => {
      const out: number[] = [];
      for (const id of ids) {
        const r = await fetch('/api/demo/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: chatId,
            message: { id, role: 'user', parts: [{ type: 'text', text: 'What are the quiet hours?' }] },
          }),
        });
        await r.text();
        out.push(r.status);
      }
      return out;
    },
    { chatId, ids },
  );
  expect(statuses.every((x) => x === 200)).toBe(true);
}
test('a resident out of credits buys more from the chat paywall and her question is answered', async ({
  page,
}) => {
  await spendCreditsTo(page, 0);
  await page.getByRole('textbox', { name: 'Message BylawIQ' }).fill('What are the quiet hours?');
  await page.getByRole('button', { name: 'Send message' }).click();
  const paywall = page.getByRole('dialog', { name: 'You’re out of credits' });
  await expect(paywall).toContainText('Demo — no real charge');
  await paywall.getByRole('button', { name: 'Buy 100 credits · $20 and ask' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'What Seaside Towers’ bylaws and documents say' }),
  ).toHaveCount(2);
  await page.goto('/demo/b/' + seaside + '/credits');
  await expect(page.getByText('Bought 100 credits', { exact: true })).toHaveCount(2); // the seeded purchase and this one
});
test('a resident out of credits sees the paywall on Ask before any conversation is started', async ({
  page,
}) => {
  await spendCreditsTo(page, 0);
  await page.goto('/demo/b/' + seaside + '/ask');
  const before = await page.locator('a.activity-row[href*="/chat/"]').count();
  await page.getByRole('textbox', { name: 'Ask BylawIQ' }).fill('What are the quiet hours?');
  await page.getByRole('button', { name: 'Send question' }).click();
  await expect(page.getByRole('dialog', { name: 'You’re out of credits' })).toBeVisible();
  await expect(page).toHaveURL(new RegExp('/demo/b/' + seaside + '/ask$'));
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.locator('a.activity-row[href*="/chat/"]')).toHaveCount(before);
});
test('a resident short of credits buys more from the drafting paywall and her notice is drafted', async ({
  page,
}) => {
  await spendCreditsTo(page, 3);
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Draft a notice' })
    .click();
  await page.getByLabel('Topic').fill('Weekend renovation noise');
  await page.getByLabel('What happened').fill('Renovation noise started at 7:30 am on Saturday.');
  await page
    .getByLabel('What you want council to do')
    .fill('Please remind the owner of the weekend start time.');
  await page.getByRole('button', { name: /^Draft my notice/ }).click();
  const paywall = page.getByRole('dialog', { name: 'You need more credits' });
  await expect(paywall).toContainText('This uses 5 credits and you have 3 credits.');
  await expect(page.getByLabel('Draft text')).toHaveCount(0); // nothing drafted or charged yet
  await paywall.getByRole('button', { name: 'Buy 100 credits · $20 and continue' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByLabel('Draft text')).toContainText('Bylaw 3.1 says');
});
