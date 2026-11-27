import { test, expect } from '@playwright/test';
import { signInAs } from '../utils/session';

// ─────────────────────────────────────────────────────────────
// Auth E2E tests — sign-in, registration and account settings.
// Registration's account creation is mocked; the account-settings tests
// use the seeded demo commissioner (read-only: nothing is saved).
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
    // A real attempt for an account that doesn't exist: loginUser (a server
    // action) answers with the same generic error as for a wrong password.
    await page.fill('input[type="email"]', `nobody-${Date.now()}@example.com`);
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
    // requestMagicLink is a server action and runs for real: for an address
    // with no account it sends nothing but still answers "sent" (no account
    // enumeration). It can take several seconds on a cold dev server.
    await page.getByRole('button', { name: /magic link/i }).click();
    await page.fill('input[type="email"]', `no-account-${Date.now()}@example.com`);
    await page.getByRole('button', { name: /send magic link/i }).click();

    await expect(page.locator('text=Magic Link Sent')).toBeVisible({ timeout: 20000 });
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
    // After creating the account the page signs in with a server action
    // (a POST back to /register) and redirects. Hold that request so the
    // success banner stays up long enough to check; no account is made.
    await page.route('**/register**', async route => {
      if (route.request().method() === 'POST') {
        await new Promise(resolve => setTimeout(resolve, 3000));
        await route.abort();
      } else {
        await route.continue();
      }
    });

    await page.fill('input[autocomplete="name"]', 'Test Commissioner');
    await page.fill('input[type="email"]', 'newcommish@example.com');
    await page.locator('input[autocomplete="new-password"]').first().fill('securepassword123');
    await page.locator('input[autocomplete="new-password"]').last().fill('securepassword123');
    await page.getByRole('button', { name: /create commissioner/i }).click();

    await expect(page.getByText(/Account created!/)).toBeVisible({ timeout: 5000 });
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

// Signed in as the demo commissioner global setup seeds (pooladmin@test.com,
// scripts/create-test-data.ts) — see tests/utils/session.ts.
const ACCOUNT_EMAIL = 'pooladmin@test.com';
const ACCOUNT_NAME = 'Pool Admin';

test.describe('Account settings page', () => {
  test.beforeEach(async ({ page, context }) => {
    await signInAs(context, ACCOUNT_EMAIL);
    await page.goto('/admin/account');
    await page.waitForLoadState('networkidle');
  });

  test('renders account settings with email and name', async ({ page }) => {
    await expect(page.getByText(ACCOUNT_EMAIL).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(ACCOUNT_NAME, { exact: true }).first()).toBeVisible();
  });

  test('change password with mismatched confirmation shows error', async ({ page }) => {
    await expect(page.getByText(ACCOUNT_EMAIL).first()).toBeVisible({ timeout: 15000 });

    await page.getByPlaceholder('Enter current password').fill('oldpassword');
    await page.getByPlaceholder('At least 8 characters').fill('newpassword123');
    await page.getByPlaceholder('Repeat new password').fill('differentpassword');
    await page.getByRole('button', { name: /update password/i }).click();

    await expect(page.getByText("New passwords don't match")).toBeVisible({ timeout: 3000 });
  });

  test('delete account button is visible for non-super-admin', async ({ page }) => {
    await expect(page.getByText(ACCOUNT_EMAIL).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Danger Zone')).toBeVisible();
    await page.getByRole('button', { name: /delete account/i }).click();
    await expect(page.locator('text=Confirm Account Deletion')).toBeVisible();
  });
});
