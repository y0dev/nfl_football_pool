import { test, expect } from '@playwright/test';
import { signInAs } from './utils/session';

// ─────────────────────────────────────────────────────────────
// Super-admin sign-in. There is no separate admin login page any more:
// everyone signs in at /login, and a super admin is sent on to the admin
// dashboard. Old /admin/login links land on /login (src/proxy.ts).
// Uses the demo super admin global setup seeds (superadmin@test.com).
// ─────────────────────────────────────────────────────────────

const SUPER_ADMIN = { email: 'superadmin@test.com', password: 'super123' };

test.describe('Admin Login', () => {
  test('an old /admin/login link goes to the sign-in page', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('a super admin signing in lands on the admin dashboard', async ({ page }) => {
    await page.goto('/admin/login');
    await page.fill('input[type="email"]', SUPER_ADMIN.email);
    await page.fill('input[type="password"]', SUPER_ADMIN.password);
    await page.getByRole('button', { name: /^sign in$/i }).click();

    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 20000 });
    await expect(page.getByText('Manage pools, commissioners, and game data across the entire system.')).toBeVisible({ timeout: 15000 });
  });

  test('wrong credentials stay on the sign-in page with a generic error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', SUPER_ADMIN.email);
    await page.fill('input[type="password"]', 'not-the-password');
    await page.getByRole('button', { name: /^sign in$/i }).click();

    await expect(page.getByText('Invalid email or password.')).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/login$/);
  });

  test('a signed-in super admin opening the sign-in page is sent to the admin dashboard', async ({ page, context }) => {
    await signInAs(context, SUPER_ADMIN.email, 'admins');
    await page.goto('/admin/login');
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 20000 });
  });
});
