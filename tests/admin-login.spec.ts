import { test, expect } from './setup/test-data-setup';

test.describe('Admin Login', () => {
  test('should login successfully and redirect to admin dashboard', async ({ page, testData }) => {
    // Navigate to admin login
    await page.goto('/admin/login');
    
    // Wait for the login form
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    
    // Fill in credentials
    await page.fill('input[name="email"]', testData.users.admin.email);
    await page.fill('input[name="password"]', testData.users.admin.password);
    
    // Submit the form
    await page.click('button[type="submit"]');
    
    // Wait for redirect to admin dashboard
    await expect(page).toHaveURL(/.*\/admin\/dashboard/);
    
    // Verify we're on the admin dashboard
    await expect(page.locator('h1:has-text("Admin Dashboard")')).toBeVisible();
  });

  test('should handle invalid credentials gracefully', async ({ page }) => {
    // Navigate to admin login
    await page.goto('/admin/login');
    
    // Fill in invalid credentials
    await page.fill('input[name="email"]', 'invalid@test.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    
    // Submit the form
    await page.click('button[type="submit"]');
    
    // Should stay on login page and show error
    await expect(page).toHaveURL(/.*\/admin\/login/);
    
    // Check for error message
    await expect(page.locator('[role="alert"], .text-red-600, .text-destructive')).toBeVisible();
  });

  test('should not redirect logged-in users unnecessarily', async ({ adminPage, testData }) => {
    // This test uses the adminPage fixture which should already be logged in
    // We should be on the admin dashboard
    await expect(adminPage).toHaveURL(/.*\/admin\/dashboard/);
    
    // Try to navigate to admin login again
    await adminPage.goto('/admin/login');
    
    // Should be redirected back to admin dashboard
    await expect(adminPage).toHaveURL(/.*\/admin\/dashboard/);
  });
});
