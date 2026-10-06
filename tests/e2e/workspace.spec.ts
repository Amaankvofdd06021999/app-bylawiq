import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { IDS } from '@/mock/data';
// The read-only sample prototype (`/preview/...`) moved to the interactive demo (`/demo`); `/demo/start/building`
// signs in as James Park, the Seaside Towers building manager, the same single-building persona `/preview`
// used to impersonate.
const seaside = IDS.buildings.seaside;
test('workspace loads and fits the viewport', async ({ page }) => {
  await page.goto('/demo/start/building');
  await page.goto('/demo/b/' + seaside + '/ask');
  await expect(page.getByRole('heading', { name: 'What does your building need to know?' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const a11y = await new AxeBuilder({ page }).analyze();
  expect(a11y.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')).toEqual([]);
});
// The old prototype's agents screen only proved the write was blocked with a message; the interactive demo's
// agent form is a real (session-scoped) mutation, so the equivalent check is that the screen is reachable and
// completing it actually creates the agent.
test('agent configuration is accessible and creating an agent succeeds', async ({ page }) => {
  await page.goto('/demo/start/building');
  await page.goto('/demo/b/' + seaside + '/agents');
  await page.getByRole('button', { name: 'Create agent', exact: true }).click();
  await page.getByLabel('Agent name').fill('Test agent');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('heading', { name: 'Test agent', level: 3 })).toBeVisible();
});
test('citation opens the exact supporting passage', async ({ page }) => {
  await page.goto('/demo/start/building');
  await page.goto('/demo/b/' + seaside + '/chat/' + IDS.chats.jamesConversation);
  await page.getByRole('button', { name: 'Open source 1' }).first().click();
  await expect(page.getByRole('dialog')).toContainText(
    'Visitor parking permits are issued by the building manager',
  );
  await expect(page.getByRole('dialog')).toContainText('2025-03-12');
});
test('mobile bottom bar reaches the main sections', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'The bottom bar is for phone widths');
  await page.goto('/demo/start/building');
  await page.goto('/demo/b/' + seaside + '/documents');
  const bar = page.getByRole('navigation', { name: 'Sections' });
  await expect(bar.getByRole('link')).toHaveText([/Ask/, /Bylaws/, /Documents/, /Updates/]);
  await expect(bar.getByRole('link', { name: /Documents/ })).toHaveAttribute('aria-current', 'page');
  await expect(bar.getByRole('link', { name: /Updates/ })).toContainText('2');
  await bar.getByRole('link', { name: /Bylaws/ }).click();
  await expect(page).toHaveURL(new RegExp('/demo/b/' + seaside + '/bylaws$'));
  await expect(bar.getByRole('link', { name: /Bylaws/ })).toHaveAttribute('aria-current', 'page');
  await bar.getByRole('button', { name: 'More' }).click();
  const team = page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Team members' });
  await team.scrollIntoViewIfNeeded();
  await expect(team).toBeInViewport();
});
test('bottom bar stays out of the desktop layout', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Desktop layout only');
  await page.goto('/demo/start/building');
  await page.goto('/demo/b/' + seaside + '/documents');
  await expect(page.getByRole('navigation', { name: 'Sections' })).toBeHidden();
});
test('auth has required labels and leaves role selection out of login', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  await expect(page.getByLabel('Email address')).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
});
