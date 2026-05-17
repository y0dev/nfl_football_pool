import { test, expect } from '@playwright/test';

// ─────────────────────────────────────────────────────────────
// Auth E2E tests
// All network calls are mocked — no real DB needed.
// ─────────────────────────────────────────────────────────────

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
  });

  test('renders sign-in form', async ({ page }) => {
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('invalid login shows generic error — no credential leakage', async ({ page }) => {
    await page.route('**/actions**', route => route.continue());

    await page.route('**', async route => {
      if (route.request().url().includes('loginUser') || route.request().method() === 'POST') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Invalid email or password.' }) });
      } else {
        await route.continue();
      }
    });

    await page.fill('input[type="email"]', 'nobody@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Error must be visible
    const errorText = page.locator('text=Invalid email or password');
    await expect(errorText).toBeVisible({ timeout: 5000 });

    // Must NOT reveal which field was wrong
    await expect(page.locator('text=No account found')).not.toBeVisible();
    await expect(page.locator('text=Incorrect password')).not.toBeVisible();
  });

  test('magic link toggle shows email input', async ({ page }) => {
    await page.getByRole('button', { name: /magic link/i }).click();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /send magic link/i })).toBeVisible();
  });

  test('magic link sent state shows confirmation', async ({ page }) => {
    await page.route('**/api/magic-link**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
    );
    await page.route('**/actions**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
    );

    await page.getByRole('button', { name: /magic link/i }).click();
    await page.fill('input[type="email"]', 'commissioner@example.com');
    await page.getByRole('button', { name: /send magic link/i }).click();

    await expect(page.locator('text=Magic Link Sent')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Register page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');
  });

  test('renders registration form', async ({ page }) => {
    await expect(page.locator('input[autocomplete="name"]')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /create commissioner/i })).toBeVisible();
  });

  test('successful registration shows success feedback', async ({ page }) => {
    await page.route('**/api/admin/create-commissioner**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Commissioner created successfully' }),
      })
    );

    await page.fill('input[autocomplete="name"]', 'Test Commissioner');
    await page.fill('input[type="email"]', 'newcommish@example.com');
    await page.locator('input[autocomplete="new-password"]').first().fill('securepassword123');
    await page.locator('input[autocomplete="new-password"]').last().fill('securepassword123');
    await page.getByRole('button', { name: /create commissioner/i }).click();

    // Should show success toast
    await expect(page.locator('text=Commissioner account created')).toBeVisible({ timeout: 5000 });
  });

  test('password mismatch shows validation error', async ({ page }) => {
    await page.fill('input[autocomplete="name"]', 'Test Commissioner');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.locator('input[autocomplete="new-password"]').first().fill('password123');
    await page.locator('input[autocomplete="new-password"]').last().fill('different456');
    await page.getByRole('button', { name: /create commissioner/i }).click();

    await expect(page.locator("text=Passwords don't match")).toBeVisible({ timeout: 3000 });
  });
});

test.describe('Account settings page', () => {
  test.beforeEach(async ({ page }) => {
    // Simulate a logged-in admin via localStorage
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.setItem('nfl-pool-user', JSON.stringify({
        id: 'test-admin-id',
        email: 'commissioner@example.com',
        full_name: 'Test Commissioner',
        is_super_admin: false,
      }));
    });

    // Mock admin verification
    await page.route('**/admins**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [{ id: 'test-admin-id', is_active: true, is_super_admin: false }] }),
      })
    );

    await page.goto('/admin/account');
    await page.waitForLoadState('networkidle');
  });

  test('renders account settings with email and name', async ({ page }) => {
    // Wait for guard to pass or show the page
    const emailText = page.locator('text=commissioner@example.com');
    await expect(emailText).toBeVisible({ timeout: 8000 });
    await expect(page.locator('text=Test Commissioner')).toBeVisible();
  });

  test('change password with mismatched confirmation shows error', async ({ page }) => {
    await expect(page.locator('text=commissioner@example.com')).toBeVisible({ timeout: 8000 });

    const pwInputs = page.locator('input[type="password"]');
    await pwInputs.nth(0).fill('oldpassword');
    await pwInputs.nth(1).fill('newpassword123');
    await pwInputs.nth(2).fill('differentpassword');
    await page.getByRole('button', { name: /update password/i }).click();

    await expect(page.locator("text=passwords don't match")).toBeVisible({ timeout: 3000 });
  });

  test('delete account button is visible for non-super-admin', async ({ page }) => {
    await expect(page.locator('text=commissioner@example.com')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('text=Danger Zone')).toBeVisible();
    await page.getByRole('button', { name: /delete account/i }).click();
    await expect(page.locator('text=Confirm Account Deletion')).toBeVisible();
  });
});
