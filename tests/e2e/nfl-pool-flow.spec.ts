import { test, expect } from '@playwright/test';
import { TestHelpers, testData, selectors } from '../utils/test-helpers';

test.describe('NFL Football Pool - End to End Tests', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    
    // Navigate to the home page
    await page.goto('/');
    await helpers.waitForPageLoad();
  });

  test.describe('Homepage and Navigation', () => {
    test('should display homepage with proper content', async ({ page }) => {
      // Check if the page loads correctly
      await expect(page).toHaveTitle(/NFL/);
      
      // Verify main navigation elements are present
      await helpers.expectElementVisible('nav');
      
      // Check for login/register buttons
      await helpers.expectElementVisible('a[href="/login"]');
      await helpers.expectElementVisible('a[href="/register"]');
    });

    test('should navigate to login page', async ({ page }) => {
      await page.click('a[href="/login"]');
      await helpers.waitForNavigation();
      await helpers.expectURLContains('/login');
    });

    test('should navigate to register page', async ({ page }) => {
      await page.click('a[href="/register"]');
      await helpers.waitForNavigation();
      await helpers.expectURLContains('/register');
    });
  });

  test.describe('User Authentication', () => {
    test('should allow user registration', async ({ page }) => {
      await page.goto('/register');
      await helpers.waitForPageLoad();

      // Fill registration form
      await helpers.fillField('input[name="email"]', testData.users.participant.email);
      await helpers.fillField('input[name="password"]', testData.users.participant.password);
      await helpers.fillField('input[name="fullName"]', testData.users.participant.name);
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Wait for successful registration (redirect or success message)
      await helpers.waitForNavigation();
      
      // Verify user is logged in or redirected appropriately
      await helpers.expectURLContains('/participant');
    });

    test('should allow user login', async ({ page }) => {
      await page.goto('/login');
      await helpers.waitForPageLoad();

      // Fill login form
      await helpers.fillField('input[name="email"]', testData.users.participant.email);
      await helpers.fillField('input[name="password"]', testData.users.participant.password);
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Wait for successful login
      await helpers.waitForNavigation();
      
      // Verify user is logged in
      await helpers.expectURLContains('/participant');
    });

    test('should handle invalid login credentials', async ({ page }) => {
      await page.goto('/login');
      await helpers.waitForPageLoad();

      // Fill login form with invalid credentials
      await helpers.fillField('input[name="email"]', 'invalid@email.com');
      await helpers.fillField('input[name="password"]', 'wrongpassword');
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Verify error message is displayed
      await helpers.expectElementVisible('[data-testid="error-message"]');
    });
  });

  test.describe('Pool Management', () => {
    test('should allow admin to create a new pool', async ({ page }) => {
      // Login as admin first
      await page.goto('/login');
      await helpers.waitForPageLoad();
      await helpers.fillField('input[name="email"]', testData.users.admin.email);
      await helpers.fillField('input[name="password"]', testData.users.admin.password);
      await page.click('button[type="submit"]');
      await helpers.waitForNavigation();

      // Navigate to admin dashboard
      await page.goto('/admin/dashboard');
      await helpers.waitForPageLoad();

      // Click create pool button
      await page.click('[data-testid="create-pool-button"]');
      
      // Fill pool creation form
      await helpers.fillField('input[name="name"]', testData.pools.testPool.name);
      await helpers.fillField('textarea[name="description"]', testData.pools.testPool.description);
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Verify pool was created
      await helpers.expectElementContainsText('[data-testid="pool-list"]', testData.pools.testPool.name);
    });

    test('should allow users to join an existing pool', async ({ page }) => {
      // Login as participant
      await page.goto('/login');
      await helpers.waitForPageLoad();
      await helpers.fillField('input[name="email"]', testData.users.participant.email);
      await helpers.fillField('input[name="password"]', testData.users.participant.password);
      await page.click('button[type="submit"]');
      await helpers.waitForNavigation();

      // Navigate to pools page
      await page.goto('/pools');
      await helpers.waitForPageLoad();

      // Click join pool button for an existing pool
      await page.click('[data-testid="join-pool-button"]');
      
      // Verify join pool dialog/form appears
      await helpers.expectElementVisible('[data-testid="join-pool-dialog"]');
    });

    test('should allow admin to share pool with participants', async ({ page }) => {
      // Login as admin
      await page.goto('/login');
      await helpers.waitForPageLoad();
      await helpers.fillField('input[name="email"]', testData.users.admin.email);
      await helpers.fillField('input[name="password"]', testData.users.admin.password);
      await page.click('button[type="submit"]');
      await helpers.waitForNavigation();

      // Navigate to pool management page
      await page.goto('/admin/pools');
      await helpers.waitForPageLoad();

      // Find a pool and click the share button
      const shareButton = page.locator('button:has-text("Share")').first();
      await shareButton.click();

      // Verify share modal opens
      await helpers.expectElementVisible('[role="dialog"]');
      await helpers.expectElementVisible('h2:has-text("Share Pool")');

      // Verify share link is generated
      const shareLink = page.locator('input[readonly]');
      await expect(shareLink).toHaveValue(/\/invite\?pool=/);

      // Test copy functionality
      const copyButton = page.locator('button:has-text("Copy")');
      await copyButton.click();

      // Verify copy success feedback
      await helpers.expectElementVisible('button:has-text("Copied!")');
    });
  });

  test.describe('Picks Submission', () => {
    test('should allow users to submit weekly picks', async ({ page }) => {
      // Login as participant
      await page.goto('/login');
      await helpers.waitForPageLoad();
      await helpers.fillField('input[name="email"]', testData.users.participant.email);
      await helpers.fillField('input[name="password"]', testData.users.participant.password);
      await page.click('button[type="submit"]');
      await helpers.waitForNavigation();

      // Navigate to a specific pool's picks page
      await page.goto('/pool/test-pool-id/picks');
      await helpers.waitForPageLoad();

      // Wait for picks form to load
      await helpers.waitForElement('[data-testid="picks-form"]');
      
      // Select picks for games (assuming there are games available)
      const gamePicks = page.locator('[data-testid="game-pick"]');
      const gameCount = await gamePicks.count();
      
      if (gameCount > 0) {
        // Make picks for available games
        for (let i = 0; i < Math.min(gameCount, 3); i++) {
          const gamePick = gamePicks.nth(i);
          await gamePick.click();
          
          // Select a team (assuming there's a team selection dropdown)
          const teamSelect = gamePick.locator('select');
          if (await teamSelect.count() > 0) {
            await helpers.selectOption('select', 'Team A');
          }
        }
        
        // Submit picks
        await page.click('[data-testid="submit-picks-button"]');
        
        // Verify submission success
        await helpers.expectElementVisible('[data-testid="success-message"]');
      }
    });

    test('should prevent duplicate pick submissions', async ({ page }) => {
      // Login as participant
      await page.goto('/login');
      await helpers.waitForPageLoad();
      await helpers.fillField('input[name="email"]', testData.users.participant.email);
      await helpers.fillField('input[name="password"]', testData.users.admin.password);
      await page.click('button[type="submit"]');
      await helpers.waitForNavigation();

      // Navigate to picks page
      await page.goto('/pool/test-pool-id/picks');
      await helpers.waitForPageLoad();

      // Try to submit picks again
      await page.click('[data-testid="submit-picks-button"]');
      
      // Verify error message about duplicate submission
      await helpers.expectElementVisible('[data-testid="error-message"]');
    });
  });

  test.describe('Leaderboard and Scoring', () => {
    test('should display leaderboard correctly', async ({ page }) => {
      // Navigate to leaderboard page
      await page.goto('/leaderboard');
      await helpers.waitForPageLoad();

      // Verify leaderboard is displayed
      await helpers.expectElementVisible('[data-testid="leaderboard"]');
      
      // Check if leaderboard has rows
      const leaderboardRows = page.locator('[data-testid="leaderboard-row"]');
      await expect(leaderboardRows).toHaveCount.greaterThan(0);
    });

    test('should calculate and display scores correctly', async ({ page }) => {
      // Navigate to leaderboard page
      await page.goto('/leaderboard');
      await helpers.waitForPageLoad();

      // Verify score calculations are displayed
      await helpers.expectElementVisible('[data-testid="total-score"]');
      await helpers.expectElementVisible('[data-testid="weekly-score"]');
      
      // Check if scores are numeric values
      const totalScore = await helpers.getElementText('[data-testid="total-score"]');
      expect(parseInt(totalScore)).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Commissioners Management System', () => {
    test('should allow super admin to access commissioners management', async ({ page }) => {
      // Login as super admin
      await page.goto('/login');
      await helpers.waitForPageLoad();
      await helpers.fillField('input[name="email"]', testData.users.superAdmin.email);
      await helpers.fillField('input[name="password"]', testData.users.superAdmin.password);
      await page.click('button[type="submit"]');
      await helpers.waitForNavigation();

      // Navigate to commissioners management page
      await page.goto('/admin/commissioners');
      await helpers.waitForPageLoad();

      // Verify commissioners management page loads
      await helpers.expectElementVisible('h1:has-text("Commissioners Management")');
      await helpers.expectElementVisible('[data-testid="commissioners-list"]');
    });

    test('should prevent regular admins from accessing commissioners management', async ({ page }) => {
      // Login as regular admin
      await page.goto('/login');
      await helpers.waitForPageLoad();
      await helpers.fillField('input[name="email"]', testData.users.admin.email);
      await helpers.fillField('input[name="password"]', testData.users.admin.password);
      await page.click('button[type="submit"]');
      await helpers.waitForNavigation();

      // Try to access commissioners management page
      await page.goto('/admin/commissioners');
      await helpers.waitForPageLoad();

      // Should be redirected to dashboard
      await helpers.expectURLContains('/dashboard');
    });

    test('should display commissioners list with proper information', async ({ page }) => {
      // Login as super admin
      await page.goto('/login');
      await helpers.waitForPageLoad();
      await helpers.fillField('input[name="email"]', testData.users.superAdmin.email);
      await helpers.fillField('input[name="password"]', testData.users.superAdmin.password);
      await page.click('button[type="submit"]');
      await helpers.waitForNavigation();

      // Navigate to commissioners management page
      await page.goto('/admin/commissioners');
      await helpers.waitForPageLoad();

      // Verify commissioners list displays
      await helpers.expectElementVisible('[data-testid="commissioners-list"]');
      
      // Check for commissioner information
      const commissionerCards = page.locator('[data-testid="commissioner-card"]');
      if (await commissionerCards.count() > 0) {
        await helpers.expectElementVisible('[data-testid="commissioner-name"]');
        await helpers.expectElementVisible('[data-testid="commissioner-email"]');
        await helpers.expectElementVisible('[data-testid="commissioner-status"]');
      }
    });

    test('should allow super admin to reset commissioner password', async ({ page }) => {
      // Login as super admin
      await page.goto('/login');
      await helpers.waitForPageLoad();
      await helpers.fillField('input[name="email"]', testData.users.superAdmin.email);
      await helpers.fillField('input[name="password"]', testData.users.superAdmin.password);
      await page.click('button[type="submit"]');
      await helpers.waitForNavigation();

      // Navigate to commissioners management page
      await page.goto('/admin/commissioners');
      await helpers.waitForPageLoad();

      // Click reset password button for a commissioner
      const resetPasswordButton = page.locator('button:has-text("Reset Password")').first();
      await resetPasswordButton.click();

      // Verify reset password modal opens
      await helpers.expectElementVisible('[role="dialog"]');
      await helpers.expectElementVisible('h2:has-text("Reset Password")');

      // Fill new password
      const passwordInput = page.locator('input[type="password"]');
      await passwordInput.fill('NewPassword123');

      // Submit password reset
      const submitButton = page.locator('button:has-text("Reset Password")');
      await submitButton.click();

      // Verify success message
      await helpers.expectElementVisible('[data-testid="success-toast"]');
    });

    test('should allow super admin to toggle commissioner status', async ({ page }) => {
      // Login as super admin
      await page.goto('/login');
      await helpers.waitForPageLoad();
      await helpers.fillField('input[name="email"]', testData.users.superAdmin.email);
      await helpers.fillField('input[name="password"]', testData.users.superAdmin.password);
      await page.click('button[type="submit"]');
      await helpers.waitForNavigation();

      // Navigate to commissioners management page
      await page.goto('/admin/commissioners');
      await helpers.waitForPageLoad();

      // Find a commissioner and click deactivate button
      const deactivateButton = page.locator('button:has-text("Deactivate")').first();
      await deactivateButton.click();

      // Verify status change
      await helpers.expectElementVisible('[data-testid="success-toast"]');
      
      // Verify button text changed to "Activate"
      await helpers.expectElementVisible('button:has-text("Activate")');
    });

    test('should allow super admin to delete commissioner safely', async ({ page }) => {
      // Login as super admin
      await page.goto('/login');
      await helpers.waitForPageLoad();
      await helpers.fillField('input[name="email"]', testData.users.superAdmin.email);
      await helpers.fillField('input[name="password"]', testData.users.superAdmin.password);
      await page.click('button[type="submit"]');
      await helpers.waitForNavigation();

      // Navigate to commissioners management page
      await page.goto('/admin/commissioners');
      await helpers.waitForPageLoad();

      // Click delete button for a commissioner
      const deleteButton = page.locator('button:has-text("Delete")').first();
      await deleteButton.click();

      // Verify confirmation dialog opens
      await helpers.expectElementVisible('[role="alertdialog"]');
      await helpers.expectElementVisible('h2:has-text("Delete Commissioner")');

      // Confirm deletion
      const confirmButton = page.locator('button:has-text("Delete Permanently")');
      await confirmButton.click();

      // Verify success message
      await helpers.expectElementVisible('[data-testid="success-toast"]');
    });

    test('should prevent deletion of commissioner with active pools', async ({ page }) => {
      // Login as super admin
      await page.goto('/login');
      await helpers.waitForPageLoad();
      await helpers.fillField('input[name="email"]', testData.users.superAdmin.email);
      await helpers.fillField('input[name="password"]', testData.users.superAdmin.password);
      await page.click('button[type="submit"]');
      await helpers.waitForNavigation();

      // Navigate to commissioners management page
      await page.goto('/admin/commissioners');
      await helpers.waitForPageLoad();

      // Try to delete a commissioner with active pools
      const deleteButton = page.locator('button:has-text("Delete")').first();
      await deleteButton.click();

      // Verify confirmation dialog opens
      await helpers.expectElementVisible('[role="alertdialog"]');

      // Confirm deletion
      const confirmButton = page.locator('button:has-text("Delete Permanently")');
      await confirmButton.click();

      // Verify error message about active pools
      await helpers.expectElementVisible('[data-testid="error-toast"]');
    });
  });

  test.describe('Admin Functions', () => {
    test('should allow admin to manage participants', async ({ page }) => {
      // Login as admin
      await page.goto('/login');
      await helpers.waitForPageLoad();
      await helpers.fillField('input[name="email"]', testData.users.admin.email);
      await helpers.fillField('input[name="password"]', testData.users.admin.password);
      await page.click('button[type="submit"]');
      await helpers.waitForNavigation();

      // Navigate to admin dashboard
      await page.goto('/admin/dashboard');
      await helpers.waitForPageLoad();

      // Verify admin panel is visible
      await helpers.expectElementVisible('[data-testid="admin-panel"]');
      
      // Check participant management section
      await helpers.expectElementVisible('[data-testid="participant-management"]');
    });

    test('should allow admin to send reminders', async ({ page }) => {
      // Login as admin
      await page.goto('/login');
      await helpers.waitForPageLoad();
      await helpers.fillField('input[name="email"]', testData.users.admin.email);
      await helpers.fillField('input[name="password"]', testData.users.admin.password);
      await page.click('button[type="submit"]');
      await helpers.waitForNavigation();

      // Navigate to reminders page
      await page.goto('/admin/reminders');
      await helpers.waitForPageLoad();

      // Verify reminders functionality
      await helpers.expectElementVisible('[data-testid="send-reminders-button"]');
      
      // Click send reminders button
      await page.click('[data-testid="send-reminders-button"]');
      
      // Verify confirmation or success message
      await helpers.expectElementVisible('[data-testid="success-message"]');
    });

    test('should allow admin to override picks', async ({ page }) => {
      // Login as admin
      await page.goto('/login');
      await helpers.waitForPageLoad();
      await helpers.fillField('input[name="email"]', testData.users.admin.email);
      await helpers.fillField('input[name="password"]', testData.users.admin.password);
      await page.click('button[type="submit"]');
      await helpers.waitForNavigation();

      // Navigate to override picks page
      await page.goto('/admin/override-picks');
      await helpers.waitForPageLoad();

      // Verify override picks functionality
      await helpers.expectElementVisible('h1:has-text("Override Participant Picks")');
      
      // Check for pool selection
      await helpers.expectElementVisible('select[aria-label="Pool"]');
    });

    test('should allow admin to perform NFL sync', async ({ page }) => {
      // Login as admin
      await page.goto('/login');
      await helpers.waitForPageLoad();
      await helpers.fillField('input[name="email"]', testData.users.admin.email);
      await helpers.fillField('input[name="password"]', testData.users.admin.password);
      await page.click('button[type="submit"]');
      await helpers.waitForNavigation();

      // Navigate to NFL sync page
      await page.goto('/admin/nfl-sync');
      await helpers.waitForPageLoad();

      // Verify NFL sync functionality
      await helpers.expectElementVisible('h1:has-text("NFL Data Synchronization")');
      
      // Check for sync button
      await helpers.expectElementVisible('button:has-text("Sync Now")');
      
      // Check for sync history
      await helpers.expectElementVisible('[data-testid="sync-history"]');
    });
  });

  test.describe('Commissioner Dashboard', () => {
    test('should display commissioner dashboard with proper features', async ({ page }) => {
      // Login as commissioner
      await page.goto('/login');
      await helpers.waitForPageLoad();
      await helpers.fillField('input[name="email"]', testData.users.admin.email);
      await helpers.fillField('input[name="password"]', testData.users.admin.password);
      await page.click('button[type="submit"]');
      await helpers.waitForNavigation();

      // Navigate to commissioner dashboard
      await page.goto('/dashboard');
      await helpers.waitForPageLoad();

      // Verify commissioner dashboard loads
      await helpers.expectElementVisible('h1:has-text("Commissioner Dashboard")');
      
      // Check for quick action cards
      await helpers.expectElementVisible('[data-testid="quick-actions"]');
      await helpers.expectElementVisible('button:has-text("Create Pool")');
      await helpers.expectElementVisible('button:has-text("Pool Management")');
      await helpers.expectElementVisible('button:has-text("Leaderboards")');
      await helpers.expectElementVisible('button:has-text("Send Reminders")');
      await helpers.expectElementVisible('button:has-text("Override Picks")');
    });

    test('should redirect super admins from commissioner dashboard', async ({ page }) => {
      // Login as super admin
      await page.goto('/login');
      await helpers.waitForPageLoad();
      await helpers.fillField('input[name="email"]', testData.users.superAdmin.email);
      await helpers.fillField('input[name="password"]', testData.users.superAdmin.password);
      await page.click('button[type="submit"]');
      await helpers.waitForNavigation();

      // Try to access commissioner dashboard
      await page.goto('/dashboard');
      await helpers.waitForPageLoad();

      // Should be redirected to admin dashboard
      await helpers.expectURLContains('/admin/dashboard');
    });
  });

  test.describe('Pool Management Page Updates', () => {
    test('should display pool management with share functionality', async ({ page }) => {
      // Login as admin
      await page.goto('/login');
      await helpers.waitForPageLoad();
      await helpers.fillField('input[name="email"]', testData.users.admin.email);
      await helpers.fillField('input[name="password"]', testData.users.admin.password);
      await page.click('button[type="submit"]');
      await helpers.waitForNavigation();

      // Navigate to pool management page
      await page.goto('/admin/pools');
      await helpers.waitForPageLoad();

      // Verify pool management page loads
      await helpers.expectElementVisible('h1:has-text("Pool Management")');
      
      // Check for share button on pools
      const shareButtons = page.locator('button:has-text("Share")');
      if (await shareButtons.count() > 0) {
        await helpers.expectElementVisible('button:has-text("Share")');
      }
    });

    test('should filter pools based on user role', async ({ page }) => {
      // Login as commissioner
      await page.goto('/login');
      await helpers.waitForPageLoad();
      await helpers.fillField('input[name="email"]', testData.users.admin.email);
      await helpers.fillField('input[name="password"]', testData.users.admin.password);
      await page.click('button[type="submit"]');
      await helpers.waitForNavigation();

      // Navigate to pool management page
      await page.goto('/admin/pools');
      await helpers.waitForPageLoad();

      // Verify only commissioner's pools are shown
      await helpers.expectElementVisible('h1:has-text("Pool Management")');
      
      // Check that the page shows "My Pools" for commissioners
      await helpers.expectElementVisible('h2:has-text("My Pools")');
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test('should work correctly on mobile devices', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Navigate to homepage
      await page.goto('/');
      await helpers.waitForPageLoad();
      
      // Verify mobile navigation works
      await helpers.expectElementVisible('[data-testid="mobile-menu-button"]');
      
      // Open mobile menu
      await page.click('[data-testid="mobile-menu-button"]');
      
      // Verify mobile menu items are visible
      await helpers.expectElementVisible('[data-testid="mobile-menu"]');
    });
  });

  test.describe('Error Handling', () => {
    test('should handle 404 errors gracefully', async ({ page }) => {
      // Navigate to non-existent page
      await page.goto('/non-existent-page');
      
      // Verify 404 page is displayed
      await helpers.expectElementVisible('[data-testid="404-page"]');
    });

    test('should handle API errors gracefully', async ({ page }) => {
      // Mock API error response
      await helpers.mockAPIResponse('/api/pools', { error: 'Database connection failed' });
      
      // Navigate to pools page
      await page.goto('/pools');
      await helpers.waitForPageLoad();
      
      // Verify error message is displayed
      await helpers.expectElementVisible('[data-testid="error-message"]');
    });
  });

  test.describe('Performance and Loading', () => {
    test('should load pages within acceptable time', async ({ page }) => {
      const startTime = Date.now();
      
      // Navigate to homepage
      await page.goto('/');
      await helpers.waitForPageLoad();
      
      const loadTime = Date.now() - startTime;
      
      // Verify page loads within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });

    test('should handle large datasets efficiently', async ({ page }) => {
      // Navigate to leaderboard with many participants
      await page.goto('/leaderboard');
      await helpers.waitForPageLoad();
      
      // Verify page loads without performance issues
      await helpers.expectElementVisible('[data-testid="leaderboard"]');
      
      // Check if pagination is implemented for large datasets
      const pagination = page.locator('[data-testid="pagination"]');
      if (await pagination.count() > 0) {
        await helpers.expectElementVisible('[data-testid="pagination"]');
      }
    });
  });
});
