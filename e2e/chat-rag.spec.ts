import { test, expect } from '@playwright/test';

/**
 * E2E tests for RAG system and chat functionality
 * Tests retrieval, verification gate, and multi-role access
 */

test.describe('RAG System - Retrieval & Verification', () => {
  test('resident can ask question and get grounded answer', async ({ page, context }) => {
    // Login as resident
    await page.goto('/');
    await page.fill('[name="email"]', 'resident@test.local');
    await page.fill('[name="password"]', 'testpass123');
    await page.click('button:has-text("Sign in")');
    await page.waitForNavigation();

    // Navigate to building chat
    await page.goto('/b/test-building/chat');
    await expect(page.locator('text=Building Chat')).toBeVisible();

    // Send question
    await page.fill('[name="message"]', 'What are the quiet hours in my building?');
    await page.click('button:has-text("Send")');

    // Wait for response
    await page.waitForSelector('text=/quiet hours|silence|noise/', { timeout: 10000 });

    // Verify response has citations
    const response = page.locator('[data-testid="assistant-message"]').last();
    const text = await response.textContent();
    expect(text).toMatch(/\[\d+\]/); // Should have [1], [2], etc.

    // Verify disclaimer is shown
    await expect(page.locator('text=Not legal advice')).toBeVisible();
  });

  test('resident questions are rate limited (10/hour)', async ({ page, context }) => {
    // Setup: create resident session
    const browserContext = await context.browser()?.newContext();
    if (!browserContext) throw new Error('No browser context');

    const newPage = await browserContext.newPage();
    await newPage.goto('/');
    await newPage.fill('[name="email"]', 'resident@test.local');
    await newPage.fill('[name="password"]', 'testpass123');
    await newPage.click('button:has-text("Sign in")');
    await newPage.waitForNavigation();
    await newPage.goto('/b/test-building/chat');

    // Send 10 questions rapidly
    for (let i = 1; i <= 10; i++) {
      await newPage.fill('[name="message"]', `Question ${i}?`);
      await newPage.click('button:has-text("Send")');
      await newPage.waitForSelector('[data-testid="assistant-message"]');
    }

    // 11th question should be rate limited
    await newPage.fill('[name="message"]', 'Question 11?');
    await newPage.click('button:has-text("Send")');

    // Should show rate limit message
    await expect(
      newPage.locator('text=Too many requests|rate limit|Try again shortly')
    ).toBeVisible({ timeout: 5000 });

    await browserContext.close();
  });

  test('verification gate rejects unsourced answers', async ({ page, context }) => {
    // This is an internal validation test
    // The gate should reject answers that don't cite retrieval results

    // Note: In production, residents never see rejected answers
    // This test would run against the internal API or a test endpoint
    const response = await page.request.post('/api/chat/verify', {
      data: {
        text: 'Most buildings require...',
        sources: [], // Empty = unsourced
      },
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.passed).toBe(false);
  });

  test('cross-building leakage is prevented', async ({ page, context }) => {
    // Resident from Building A cannot see Building B's data

    // Login as resident of Building A
    await page.goto('/');
    await page.fill('[name="email"]', 'resident-a@test.local');
    await page.fill('[name="password"]', 'testpass123');
    await page.click('button:has-text("Sign in")');
    await page.waitForNavigation();

    // Try to access Building B's chat (should fail)
    await page.goto('/b/building-b-id/chat');
    await expect(page.locator('text=not authorized|forbidden|access denied')).toBeVisible();
  });

  test('building manager can access all building documents', async ({ page, context }) => {
    // Login as building manager
    await page.goto('/');
    await page.fill('[name="email"]', 'manager@test.local');
    await page.fill('[name="password"]', 'testpass123');
    await page.click('button:has-text("Sign in")');
    await page.waitForNavigation();

    // Navigate to building chat
    await page.goto('/b/test-building/chat');

    // Send question
    await page.fill(
      '[name="message"]',
      'Show me all staff-only documents about enforcement'
    );
    await page.click('button:has-text("Send")');

    // Should get detailed response with staff documents
    await page.waitForSelector('[data-testid="assistant-message"]');
    const response = await page.locator('[data-testid="assistant-message"]').last().textContent();
    expect(response).toBeTruthy();
  });

  test('strata manager can search across portfolio', async ({ page, context }) => {
    // Login as strata manager
    await page.goto('/');
    await page.fill('[name="email"]', 'strata@test.local');
    await page.fill('[name="password"]', 'testpass123');
    await page.click('button:has-text("Sign in")');
    await page.waitForNavigation();

    // Go to portfolio chat
    await page.goto('/portfolio/chat');

    // Ask cross-building question
    await page.fill(
      '[name="message"]',
      'Which of my buildings have the most restrictive noise bylaws?'
    );
    await page.click('button:has-text("Send")');

    // Should return comparative analysis
    await page.waitForSelector('[data-testid="assistant-message"]');
    const response = await page.locator('[data-testid="assistant-message"]').last().textContent();
    expect(response).toMatch(/Building A|Building B|Building C/);
  });
});

test.describe('Query Expansion & Intent Classification', () => {
  test('query expansion improves retrieval', async ({ request }) => {
    // Query "can we tow a car" should expand to include "vehicle removal"
    const response = await request.post('/api/chat/expand-query', {
      data: {
        query: 'can we tow a car',
        building: 'test-building',
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.variants.length).toBeGreaterThan(1);
    expect(data.variants.some((v: string) => v.includes('vehicle'))).toBeTruthy();
  });

  test('intent classification routes correctly', async ({ request }) => {
    // "What is section 3.2?" should be classified as document_search
    const response = await request.post('/api/chat/classify-intent', {
      data: {
        query: 'What does section 3.2 say?',
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.intent).toBe('document_search');
    expect(data.confidence).toBeGreaterThan(0.7);
  });

  test('out of scope questions are declined', async ({ request }) => {
    // "How to sue the building" should be declined
    const response = await request.post('/api/chat/classify-intent', {
      data: {
        query: 'How do I sue the building over this?',
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.intent).toBe('out_of_scope');
  });
});

test.describe('Billing & Credits', () => {
  test('resident can see free questions remaining', async ({ page, context }) => {
    // Login as resident
    await page.goto('/');
    await page.fill('[name="email"]', 'resident@test.local');
    await page.fill('[name="password"]', 'testpass123');
    await page.click('button:has-text("Sign in")');
    await page.waitForNavigation();

    // Navigate to building chat
    await page.goto('/b/test-building/chat');

    // Should see "2 free questions remaining"
    await expect(page.locator('text=free questions|credits remaining')).toBeVisible();
  });

  test('free questions are used first', async ({ page, context }) => {
    // Send 2 questions, should show as free
    await page.goto('/');
    await page.fill('[name="email"]', 'resident@test.local');
    await page.fill('[name="password"]', 'testpass123');
    await page.click('button:has-text("Sign in")');
    await page.waitForNavigation();

    await page.goto('/b/test-building/chat');

    // Question 1 (free)
    await page.fill('[name="message"]', 'Question 1?');
    await page.click('button:has-text("Send")');
    await page.waitForSelector('[data-testid="assistant-message"]');
    await expect(page.locator('text=1 free question remaining')).toBeVisible();

    // Question 2 (free)
    await page.fill('[name="message"]', 'Question 2?');
    await page.click('button:has-text("Send")');
    await page.waitForSelector('[data-testid="assistant-message"]');
    await expect(page.locator('text=0 free questions')).toBeVisible();

    // Question 3 should require credits
    await page.fill('[name="message"]', 'Question 3?');
    await page.click('button:has-text("Send")');
    await expect(page.locator('text=Get credits|Buy credits|$2 per question')).toBeVisible();
  });

  test('resident can purchase credits', async ({ page, context }) => {
    // Login as resident
    await page.goto('/');
    await page.fill('[name="email"]', 'resident@test.local');
    await page.fill('[name="password"]', 'testpass123');
    await page.click('button:has-text("Sign in")');
    await page.waitForNavigation();

    // Go to billing page
    await page.goto('/b/test-building/billing');

    // Buy credits
    await page.click('button:has-text("10 questions")');
    await page.click('button:has-text("Purchase")');

    // Should see confirmation
    await expect(page.locator('text=Successfully added|Added.*credits')).toBeVisible();

    // Check wallet shows new balance
    await page.goto('/b/test-building/chat');
    await expect(page.locator('text=10 credits|10 questions remaining')).toBeVisible();
  });
});

test.describe('Analytics & Monitoring', () => {
  test('building manager can see analytics', async ({ page, context }) => {
    // Login as building manager
    await page.goto('/');
    await page.fill('[name="email"]', 'manager@test.local');
    await page.fill('[name="password"]', 'testpass123');
    await page.click('button:has-text("Sign in")');
    await page.waitForNavigation();

    // Go to analytics
    await page.goto('/b/test-building/analytics');

    // Should see chat metrics
    await expect(page.locator('text=Total questions|Average cost|Verification rate')).toBeVisible();
  });

  test('platform admin can see system-wide analytics', async ({ page, context }) => {
    // Login as platform admin
    await page.goto('/');
    await page.fill('[name="email"]', 'admin@bylawiq.local');
    await page.fill('[name="password"]', 'adminpass123');
    await page.click('button:has-text("Sign in")');
    await page.waitForNavigation();

    // Go to admin dashboard
    await page.goto('/admin/platform');

    // Should see system analytics
    await expect(
      page.locator('text=Total queries|Buildings active|Average cost per query')
    ).toBeVisible();
  });
});
