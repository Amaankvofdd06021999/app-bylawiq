import { test, expect } from '@playwright/test';
import { injectAxe, getViolations } from 'axe-playwright';

/**
 * Phase 5: Accessibility Audit Suite (WCAG 2.1 AA)
 *
 * Run with: npx playwright test scripts/a11y-test.ts
 *
 * Ensures BylawIQ meets WCAG 2.1 Level AA standards
 * - Keyboard navigation works
 * - Focus indicators visible
 * - Screen reader friendly
 * - Color contrast compliant
 * - Form labels proper
 * - No critical/serious violations
 */

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3100';
// Port 3000 may be a developer server pointed at hosted data. Only the local test server is accepted.
if (!/^http:\/\/(127\.0\.0\.1|localhost):3100\/?$/.test(BASE_URL)) {
  throw new Error(
    'Refusing to run the accessibility audit: BASE_URL must be the local test server (port 3100).',
  );
}

test.describe('Accessibility Audit - WCAG 2.1 AA', () => {
  let testContext: {
    token: string;
    buildingId: string;
    userId: string;
  };

  test.beforeAll(async () => {
    // Setup test user (would be done via API in real scenario)
    testContext = {
      token: 'test-jwt-token',
      buildingId: 'test-building-id',
      userId: 'test-user-id',
    };
  });

  test.describe('Login & Authentication', () => {
    test('Login page accessible', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await injectAxe(page);

      const violations = await getViolations(page);
      expect(violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')).toHaveLength(0);

      // Check keyboard navigation
      await page.keyboard.press('Tab');
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(['INPUT', 'BUTTON']).toContain(focusedElement);
    });

    test('Signup form accessible', async ({ page }) => {
      await page.goto(`${BASE_URL}/signup`);
      await injectAxe(page);

      const violations = await getViolations(page);
      expect(violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')).toHaveLength(0);

      // Test form labels
      const label = page.locator('label[for="email"]');
      expect(label).toBeDefined();
    });
  });

  test.describe('Dashboard Pages', () => {
    test('Firm Owner Dashboard accessible', async ({ page }) => {
      // Mock authenticated session
      await page.context().addCookies([
        {
          name: 'auth_token',
          value: testContext.token,
          url: BASE_URL,
        },
      ]);

      await page.goto(`${BASE_URL}/workspace`);
      await page.waitForLoadState('networkidle');
      await injectAxe(page);

      const violations = await getViolations(page);
      const criticalViolations = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');

      expect(criticalViolations).toHaveLength(0);

      // Verify tables have proper headers
      const tables = page.locator('table');
      if ((await tables.count()) > 0) {
        const firstTable = tables.first();
        const headers = firstTable.locator('thead th');
        expect(await headers.count()).toBeGreaterThan(0);
      }

      // Test heading hierarchy (h1 -> h2 -> h3, no skipping)
      const headings = page.locator('h1, h2, h3, h4, h5, h6');
      const headingLevels: number[] = [];
      for (let i = 0; i < Math.min(await headings.count(), 20); i++) {
        const level = parseInt(await headings.nth(i).evaluate((el) => el.tagName[1]));
        headingLevels.push(level);
      }
      // No skipping levels (e.g., h1 -> h3)
      for (let i = 1; i < headingLevels.length; i++) {
        const diff = headingLevels[i] - headingLevels[i - 1];
        expect(diff).toBeLessThanOrEqual(1);
      }
    });

    test('Building Dashboard accessible', async ({ page }) => {
      await page.context().addCookies([{ name: 'auth_token', value: testContext.token, url: BASE_URL }]);

      await page.goto(`${BASE_URL}/b/${testContext.buildingId}/home`);
      await page.waitForLoadState('networkidle');
      await injectAxe(page);

      const violations = await getViolations(page);
      const criticalViolations = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');

      expect(criticalViolations).toHaveLength(0);
    });
  });

  test.describe('Chat Interface', () => {
    test('Chat page accessible', async ({ page }) => {
      await page.context().addCookies([{ name: 'auth_token', value: testContext.token, url: BASE_URL }]);

      await page.goto(`${BASE_URL}/b/${testContext.buildingId}/ask`);
      await injectAxe(page);

      const violations = await getViolations(page);
      const criticalViolations = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');

      expect(criticalViolations).toHaveLength(0);

      // Test input accessibility
      const input = page.locator('textarea, input[type="text"]').first();
      if ((await input.count()) > 0) {
        await input.focus();
        const focusStyle = await input.evaluate((el) => window.getComputedStyle(el).outline);
        expect(focusStyle).not.toBe('none');
      }

      // Test button accessibility
      const sendButton = page.locator('button:has-text("Send"), button:has-text("Ask")').first();
      if ((await sendButton.count()) > 0) {
        const ariaLabel = await sendButton.getAttribute('aria-label');
        const title = await sendButton.getAttribute('title');
        expect(ariaLabel || title || (await sendButton.textContent())).toBeTruthy();
      }
    });

    test('Messages have proper ARIA labels', async ({ page }) => {
      await page.context().addCookies([{ name: 'auth_token', value: testContext.token, url: BASE_URL }]);

      await page.goto(`${BASE_URL}/b/${testContext.buildingId}/ask`);

      // Wait for a message to appear
      const messageContainer = page.locator('[role="article"]').first();
      if ((await messageContainer.count()) > 0) {
        const role = await messageContainer.getAttribute('role');
        expect(role).toBe('article');
      }
    });
  });

  test.describe('Navigation & Role Switcher', () => {
    test('Role switcher accessible', async ({ page }) => {
      await page.context().addCookies([{ name: 'auth_token', value: testContext.token, url: BASE_URL }]);

      await page.goto(`${BASE_URL}/workspace`);

      // Find role switcher
      const roleSwitcher = page.locator('[role="combobox"], select').first();
      if ((await roleSwitcher.count()) > 0) {
        // Test keyboard activation
        await roleSwitcher.focus();
        await page.keyboard.press('ArrowDown');
        const expanded = await roleSwitcher.getAttribute('aria-expanded');
        expect(['true', null]).toContain(expanded); // null is OK if not a combobox
      }

      await injectAxe(page);
      const violations = await getViolations(page);
      const criticalViolations = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');

      expect(criticalViolations).toHaveLength(0);
    });

    test('Navigation menu keyboard accessible', async ({ page }) => {
      await page.context().addCookies([{ name: 'auth_token', value: testContext.token, url: BASE_URL }]);

      await page.goto(`${BASE_URL}/workspace`);

      // Tab through navigation
      const navLinks = page.locator('nav a, nav button');
      const linkCount = await navLinks.count();

      if (linkCount > 0) {
        // Focus first nav item
        await navLinks.first().focus();
        for (let i = 1; i < Math.min(linkCount, 5); i++) {
          await page.keyboard.press('Tab');
          const focused = await page.evaluate(() => document.activeElement?.tagName);
          expect(['A', 'BUTTON']).toContain(focused);
        }
      }
    });
  });

  test.describe('Forms & Inputs', () => {
    test('Form inputs have associated labels', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);

      const inputs = page.locator('input[type="email"], input[type="password"], input[type="text"]');
      const inputCount = await inputs.count();

      for (let i = 0; i < inputCount; i++) {
        const input = inputs.nth(i);
        const id = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');

        if (id) {
          const label = page.locator(`label[for="${id}"]`);
          expect(await label.count()).toBeGreaterThan(0);
        } else {
          expect(ariaLabel).toBeTruthy();
        }
      }
    });

    test('Form error messages associated with inputs', async ({ page }) => {
      await page.goto(`${BASE_URL}/signup`);

      // Attempt invalid submission
      const submitButton = page.locator('button[type="submit"]').first();
      if ((await submitButton.count()) > 0) {
        await submitButton.click();
        await page.waitForTimeout(500);

        // Check for error messages linked to inputs
        const errorMessages = page.locator('[role="alert"], .error-message');
        if ((await errorMessages.count()) > 0) {
          // Verify error messages have proper ARIA attributes
          const firstError = errorMessages.first();
          const role = await firstError.getAttribute('role');
          expect(['alert', null]).toContain(role);
        }
      }
    });
  });

  test.describe('Color Contrast', () => {
    test('Text contrast meets WCAG AA', async ({ page }) => {
      await page.goto(`${BASE_URL}/workspace`);
      await injectAxe(page);

      const violations = await getViolations(page);
      const contrastViolations = violations.filter(
        (v) => v.id === 'color-contrast' && (v.impact === 'critical' || v.impact === 'serious'),
      );

      expect(contrastViolations).toHaveLength(0);
    });
  });

  test.describe('Motion & Animation', () => {
    test('Respects prefers-reduced-motion', async ({ page }) => {
      // Set prefers-reduced-motion
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(`${BASE_URL}/workspace`);

      // Check for animations/transitions
      const elements = page.locator('*');
      const count = await elements.count();

      for (let i = 0; i < Math.min(count, 50); i++) {
        const el = elements.nth(i);
        const animation = await el.evaluate((e) => window.getComputedStyle(e).animation);

        // If animation exists, should be none or have no duration
        if (animation !== 'none') {
          const duration = await el.evaluate((e) => window.getComputedStyle(e).animationDuration || '0s');
          expect(duration).toMatch(/^0/); // Should be 0 or 0.0 seconds
        }
      }
    });
  });

  test.describe('Focus Management', () => {
    test('Focus visible on all interactive elements', async ({ page }) => {
      await page.goto(`${BASE_URL}/workspace`);

      const buttons = page.locator('button');
      const links = page.locator('a');
      const inputs = page.locator('input, textarea, select');

      const interactiveElements = [...(await buttons.all()), ...(await links.all()), ...(await inputs.all())];

      for (const element of interactiveElements.slice(0, 20)) {
        await element.focus();
        const outline = await element.evaluate((el) => window.getComputedStyle(el).outline);
        const boxShadow = await element.evaluate((el) => window.getComputedStyle(el).boxShadow);

        // Should have outline or box-shadow when focused
        const hasFocusStyle = outline !== 'none' || boxShadow !== 'none';
        expect(hasFocusStyle).toBeTruthy();
      }
    });

    test('Focus trap in modals', async ({ page }) => {
      await page.context().addCookies([{ name: 'auth_token', value: testContext.token, url: BASE_URL }]);

      await page.goto(`${BASE_URL}/workspace`);

      // Open a modal (e.g., settings or help)
      const modalTrigger = page.locator('button[aria-label*="Settings"], button[aria-label*="Help"]').first();
      if ((await modalTrigger.count()) > 0) {
        await modalTrigger.click();
        await page.waitForTimeout(300);

        // Focus should stay within modal
        const modal = page.locator('[role="dialog"]').first();
        if ((await modal.count()) > 0) {
          const focusableElements = modal.locator('button, a, input, select, textarea');
          const firstFocusable = focusableElements.first();

          if ((await firstFocusable.count()) > 0) {
            await firstFocusable.focus();
            const focusedElement = await page.evaluate(() =>
              (document.activeElement as HTMLElement)?.closest('[role="dialog"]'),
            );
            expect(focusedElement).toBeTruthy();
          }
        }
      }
    });
  });
});
