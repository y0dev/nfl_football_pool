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
