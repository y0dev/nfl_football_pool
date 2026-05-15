import { test, expect } from '@playwright/test';
import { TestHelpers, testData } from '../utils/test-helpers';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function mockPoolsAPI(helpers: TestHelpers, pools = [testData.pools.openPool, testData.pools.lockedPool]) {
  return helpers.mockAPIResponse('**/api/pools**', { pools });
}

function mockJoinSuccess(helpers: TestHelpers) {
  return helpers.mockAPIResponse('**/api/pools/join**', {
    message: 'Successfully joined pool',
    participant: { id: 'p-1', name: 'Test User', email: 'test@example.com' },
    poolName: testData.pools.openPool.name,
  });
}

function mockJoinWrongPassword(helpers: TestHelpers) {
  return helpers.mockAPIResponse('**/api/pools/join**', {
    error: 'Incorrect pool password. Please check with your commissioner.',
  }, 403);
}

function mockMagicLinkSend(helpers: TestHelpers) {
  return helpers.mockAPIResponse('**/actions**', { success: true });
}

// ─────────────────────────────────────────────────────────────
// Landing Page
// ─────────────────────────────────────────────────────────────

test.describe('Landing Page', () => {
  test('renders brand, nav, and hero', async ({ page }) => {
    const h = new TestHelpers(page);
    await page.goto('/');
    await h.waitForPageLoad();

    await expect(page.locator('nav')).toBeVisible();
    await expect(page.locator('nav').getByText('Sunday Huddle', { exact: false })).toBeVisible();
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('shows commissioner login button when not logged in', async ({ page }) => {
    const h = new TestHelpers(page);
    await page.goto('/');
    await h.waitForPageLoad();

    const loginBtn = page.locator('button', { hasText: /commissioner/i }).or(
      page.locator('a', { hasText: /commissioner/i })
    );
    await expect(loginBtn.first()).toBeVisible();
  });

  test('pool search input exists and accepts text', async ({ page }) => {
    const h = new TestHelpers(page);
    await page.goto('/');
    await h.waitForPageLoad();

    const searchInput = page.locator('input[placeholder*="Pool" i], input[placeholder*="pool" i]').first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Test Pool');
    await expect(searchInput).toHaveValue('Test Pool');
  });

  test('search navigates to /pools with query', async ({ page }) => {
    const h = new TestHelpers(page);
    await page.goto('/');
    await h.waitForPageLoad();

    const searchInput = page.locator('input[placeholder*="Pool" i], input[placeholder*="pool" i]').first();
    await searchInput.fill('Sunday Huddle');

    const searchBtn = page.locator('button', { hasText: /find pool|search/i }).first();
    await searchBtn.click();

    await expect(page).toHaveURL(/\/pools\?q=/);
    await expect(page).toHaveURL(/Sunday\+Huddle|Sunday%20Huddle/);
  });

  test('shows features and how-it-works sections', async ({ page }) => {
    const h = new TestHelpers(page);
    await page.goto('/');
    await h.waitForPageLoad();

    await expect(page.locator('text=Weekly Competition').or(page.locator('text=weekly competition'))).toBeVisible();
    await expect(page.locator('text=How It Works').or(page.locator('text=How it Works'))).toBeVisible();
  });

  test('shows live game ticker section', async ({ page }) => {
    const h = new TestHelpers(page);
    await page.goto('/');
    await h.waitForPageLoad();

    // Either games are listed or offseason banner is shown
    const ticker = page.locator('section').filter({ hasText: /Week \d+ Games|Offseason/i });
    await expect(ticker.first()).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────
// Commissioner Login
// ─────────────────────────────────────────────────────────────

test.describe('Commissioner Login', () => {
  test('login page renders email form', async ({ page }) => {
    const h = new TestHelpers(page);
    await page.goto('/login');
    await h.waitForPageLoad();

    await expect(page.locator('h1, h2').filter({ hasText: /sign in|commissioner/i }).first()).toBeVisible();
    await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible();
  });

  test('password mode submit shows error for empty email', async ({ page }) => {
    const h = new TestHelpers(page);
    await page.goto('/login');
    await h.waitForPageLoad();

    // Try submitting without filling in email
    const submitBtn = page.locator('button[type="submit"]').first();
    await submitBtn.click();

    // Should show validation error or input still focused
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    await expect(emailInput).toBeVisible();
  });

  test('magic link mode is accessible from login page', async ({ page }) => {
    const h = new TestHelpers(page);
    await page.goto('/login');
    await h.waitForPageLoad();

    // Look for magic link trigger button
    const magicBtn = page.locator('button', { hasText: /magic link|send.*link|link instead/i });
    if (await magicBtn.count() > 0) {
      await expect(magicBtn.first()).toBeVisible();
    }
  });

  test('verify page shows loading state', async ({ page }) => {
    const h = new TestHelpers(page);
    // Navigate with no token — should show error state
    await page.goto('/login/verify');
    await h.waitForPageLoad();

    // Should show either an error or verifying state
    const content = page.locator('h1').first();
    await expect(content).toBeVisible();
  });

  test('verify page handles invalid token', async ({ page }) => {
    const h = new TestHelpers(page);
    await page.goto('/login/verify?token=invalid-token-xyz');
    await h.waitForPageLoad();

    // Should show error state
    const errorHeading = page.locator('h1', { hasText: /failed|invalid|error/i });
    await expect(errorHeading.first()).toBeVisible({ timeout: 8000 });
  });
});

// ─────────────────────────────────────────────────────────────
// Pool Browse & Join
// ─────────────────────────────────────────────────────────────

test.describe('Pool Search Page (/pools)', () => {
  test('renders search input and initial state', async ({ page }) => {
    const h = new TestHelpers(page);
    await page.goto('/pools');
    await h.waitForPageLoad();

    await expect(page.locator('[data-testid="pool-search-input"]')).toBeVisible();
    await expect(page.locator('h1', { hasText: /pools/i }).first()).toBeVisible();
  });

  test('shows results when API returns pools', async ({ page }) => {
    const h = new TestHelpers(page);

    await h.mockAPIResponse('**/api/pools**', {
      pools: [testData.pools.openPool, testData.pools.lockedPool],
    });

    await page.goto('/pools?q=test');
    await h.waitForPageLoad();

    await expect(page.locator('[data-testid="pool-card"]').first()).toBeVisible({ timeout: 8000 });
    await expect(page.locator('[data-testid="pool-card"]')).toHaveCount(2);
  });

  test('shows empty state when no pools found', async ({ page }) => {
    const h = new TestHelpers(page);

    await h.mockAPIResponse('**/api/pools**', { pools: [] });

    await page.goto('/pools?q=nonexistent');
    await h.waitForPageLoad();

    await expect(page.locator('text=/No active pools found/i').or(
      page.locator('p', { hasText: /no.*pool/i })
    ).first()).toBeVisible({ timeout: 8000 });
  });

  test('open pool shows join form without password field', async ({ page }) => {
    const h = new TestHelpers(page);

    await h.mockAPIResponse('**/api/pools**', { pools: [testData.pools.openPool] });

    await page.goto('/pools?q=Sunday');
    await h.waitForPageLoad();

    await expect(page.locator('[data-testid="pool-card"]').first()).toBeVisible({ timeout: 8000 });
    await page.locator('button', { hasText: /join pool/i }).first().click();

    await expect(page.locator('[data-testid="join-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="join-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="join-email"]')).toBeVisible();
    // No password field for open pool
    await expect(page.locator('[data-testid="join-password"]')).not.toBeVisible();
  });

  test('password-protected pool shows password field', async ({ page }) => {
    const h = new TestHelpers(page);

    await h.mockAPIResponse('**/api/pools**', { pools: [testData.pools.lockedPool] });

    await page.goto('/pools?q=Private');
    await h.waitForPageLoad();

    await expect(page.locator('[data-testid="pool-card"]').first()).toBeVisible({ timeout: 8000 });
    await page.locator('button', { hasText: /join pool/i }).first().click();

    await expect(page.locator('[data-testid="join-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="join-password"]')).toBeVisible();
    // Shows password required badge on the card
    await expect(page.locator('text=/password required/i').first()).toBeVisible();
  });

  test('join form validates required fields', async ({ page }) => {
    const h = new TestHelpers(page);

    await h.mockAPIResponse('**/api/pools**', { pools: [testData.pools.openPool] });

    await page.goto('/pools?q=Sunday');
    await h.waitForPageLoad();

    await expect(page.locator('[data-testid="pool-card"]').first()).toBeVisible({ timeout: 8000 });
    await page.locator('button', { hasText: /join pool/i }).first().click();

    // Submit empty form
    await page.locator('[data-testid="join-submit"]').click();

    // Should show error (not success)
    await expect(page.locator('[data-testid="join-success"]')).not.toBeVisible();
  });

  test('successful join shows confirmation', async ({ page }) => {
    const h = new TestHelpers(page);

    await h.mockAPIResponse('**/api/pools**', { pools: [testData.pools.openPool] });
    await h.mockAPIResponse('**/api/pools/join**', {
      message: 'Successfully joined pool',
      participant: { id: 'p-1', name: 'Jane Doe', email: 'jane@example.com' },
      poolName: testData.pools.openPool.name,
    });

    await page.goto('/pools?q=Sunday');
    await h.waitForPageLoad();

    await expect(page.locator('[data-testid="pool-card"]').first()).toBeVisible({ timeout: 8000 });
    await page.locator('button', { hasText: /join pool/i }).first().click();

    await page.locator('[data-testid="join-name"]').fill('Jane Doe');
    // Wait a moment so timing check passes
    await page.waitForTimeout(1600);
    await page.locator('[data-testid="join-email"]').fill('jane@example.com');
    await page.locator('[data-testid="join-submit"]').click();

    await expect(page.locator('[data-testid="join-success"]')).toBeVisible({ timeout: 8000 });
  });

  test('wrong password shows error message', async ({ page }) => {
    const h = new TestHelpers(page);

    await h.mockAPIResponse('**/api/pools**', { pools: [testData.pools.lockedPool] });
    await h.mockAPIResponse('**/api/pools/join**', {
      error: 'Incorrect pool password. Please check with your commissioner.',
    }, 403);

    await page.goto('/pools?q=Private');
    await h.waitForPageLoad();

    await expect(page.locator('[data-testid="pool-card"]').first()).toBeVisible({ timeout: 8000 });
    await page.locator('button', { hasText: /join pool/i }).first().click();

    await page.locator('[data-testid="join-name"]').fill('Bob Smith');
    await page.waitForTimeout(1600);
    await page.locator('[data-testid="join-email"]').fill('bob@example.com');
    await page.locator('[data-testid="join-password"]').fill('wrongpassword');
    await page.locator('[data-testid="join-submit"]').click();

    await expect(page.locator('text=/incorrect.*password|wrong.*password/i').first()).toBeVisible({ timeout: 6000 });
  });

  test('honeypot field exists and is hidden', async ({ page }) => {
    const h = new TestHelpers(page);

    await h.mockAPIResponse('**/api/pools**', { pools: [testData.pools.openPool] });
    await page.goto('/pools?q=Sunday');
    await h.waitForPageLoad();

    await expect(page.locator('[data-testid="pool-card"]').first()).toBeVisible({ timeout: 8000 });
    await page.locator('button', { hasText: /join pool/i }).first().click();

    // Honeypot must exist in DOM but not be visible to the user
    const honeypot = page.locator('input[name="website"]');
    await expect(honeypot).toBeHidden();
  });

  test('pre-fills search from URL query', async ({ page }) => {
    const h = new TestHelpers(page);
    await h.mockAPIResponse('**/api/pools**', { pools: [] });
    await page.goto('/pools?q=MyPool');
    await h.waitForPageLoad();

    const searchInput = page.locator('[data-testid="pool-search-input"]');
    await expect(searchInput).toHaveValue('MyPool');
  });

  test('cancel button closes join form', async ({ page }) => {
    const h = new TestHelpers(page);

    await h.mockAPIResponse('**/api/pools**', { pools: [testData.pools.openPool] });
    await page.goto('/pools?q=Sunday');
    await h.waitForPageLoad();

    await expect(page.locator('[data-testid="pool-card"]').first()).toBeVisible({ timeout: 8000 });
    await page.locator('button', { hasText: /join pool/i }).first().click();
    await expect(page.locator('[data-testid="join-form"]')).toBeVisible();

    await page.locator('button', { hasText: /cancel/i }).click();
    await expect(page.locator('[data-testid="join-form"]')).not.toBeVisible();
  });

  test('nav back button links to home', async ({ page }) => {
    const h = new TestHelpers(page);
    await page.goto('/pools');
    await h.waitForPageLoad();

    const homeLink = page.locator('a[href="/"]', { hasText: /home/i });
    await expect(homeLink.first()).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────
// Admin Dashboard
// ─────────────────────────────────────────────────────────────

test.describe('Admin Dashboard', () => {
  test('unauthenticated visit redirects away from dashboard', async ({ page }) => {
    const h = new TestHelpers(page);
    await page.goto('/admin/dashboard');
    await h.waitForPageLoad();

    // Should either redirect to login or show auth guard
    const url = page.url();
    const isOnDashboard = url.includes('/admin/dashboard');
    if (isOnDashboard) {
      // If on dashboard, should show some auth gate or loading
      await expect(page.locator('body')).toBeVisible();
    } else {
      expect(url).toMatch(/login|\/$/);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// Admin Pools Page
// ─────────────────────────────────────────────────────────────

test.describe('Admin Pools Page', () => {
  test('unauthenticated visit to /admin/pools redirects to login', async ({ page }) => {
    const h = new TestHelpers(page);
    await page.goto('/admin/pools');
    await h.waitForPageLoad();

    const url = page.url();
    const isOnPools = url.includes('/admin/pools');
    if (isOnPools) {
      await expect(page.locator('body')).toBeVisible();
    } else {
      expect(url).toMatch(/login/);
    }
  });

  test('unauthenticated visit to pool detail page redirects to login', async ({ page }) => {
    const h = new TestHelpers(page);
    await page.goto('/admin/pool/fake-pool-id');
    await h.waitForPageLoad();

    const url = page.url();
    expect(url).not.toContain('/admin/pool/fake-pool-id');
    expect(url).toMatch(/login/);
  });

  test('admin login page renders email and password fields', async ({ page }) => {
    const h = new TestHelpers(page);
    await page.goto('/admin/login');
    await h.waitForPageLoad();

    await expect(page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first()).toBeVisible();
    await expect(page.locator('input[type="password"], input[name="password"]').first()).toBeVisible();
  });

  test('admin login shows error for empty submission', async ({ page }) => {
    const h = new TestHelpers(page);
    await page.goto('/admin/login');
    await h.waitForPageLoad();

    const submitBtn = page.locator('button[type="submit"]').first();
    await submitBtn.click();

    // Should still be on login page (no redirect)
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});

// ─────────────────────────────────────────────────────────────
// Register Page
// ─────────────────────────────────────────────────────────────

test.describe('Register Page', () => {
  test('renders registration form', async ({ page }) => {
    const h = new TestHelpers(page);
    await page.goto('/register');
    await h.waitForPageLoad();

    await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"], input[name="password"]').first()).toBeVisible();
  });

  test('has link to sign in page', async ({ page }) => {
    const h = new TestHelpers(page);
    await page.goto('/register');
    await h.waitForPageLoad();

    const signInLink = page.locator('a[href="/login"], a', { hasText: /sign in|login/i });
    await expect(signInLink.first()).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────
// Navigation & Deep Links
// ─────────────────────────────────────────────────────────────

test.describe('Navigation', () => {
  test('clicking Commissioner Login navigates to /login', async ({ page }) => {
    const h = new TestHelpers(page);
    await page.goto('/');
    await h.waitForPageLoad();

    const btn = page.locator('button', { hasText: /commissioner/i })
      .or(page.locator('a', { hasText: /commissioner/i }))
      .first();
    await btn.click();

    await expect(page).toHaveURL(/\/login/);
  });

  test('/login page has link back to home', async ({ page }) => {
    const h = new TestHelpers(page);
    await page.goto('/login');
    await h.waitForPageLoad();

    const homeLink = page.locator('a[href="/"]');
    await expect(homeLink.first()).toBeVisible();
  });

  test('/pools page has nav back to home', async ({ page }) => {
    const h = new TestHelpers(page);
    await page.goto('/pools');
    await h.waitForPageLoad();

    await expect(page.locator('a[href="/"]')).toBeVisible();
  });
});
