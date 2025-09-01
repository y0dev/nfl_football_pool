import { test as base } from '@playwright/test';

// Extend the base test with test data setup
export const test = base.extend({
  // Setup test data before each test
  testData: async ({}, use) => {
    const testData = {
      users: {
        admin: {
          email: 'admin@test.com',
          password: 'admin123',
          name: 'Test Admin',
          role: 'admin'
        },
        participant: {
          email: 'participant@test.com',
          password: 'participant123',
          name: 'Test Participant',
          role: 'participant'
        },
        superAdmin: {
          email: 'superadmin@test.com',
          password: 'super123',
          name: 'Test Super Admin',
          role: 'super_admin'
        }
      },
      pools: {
        testPool: {
          id: 'dbb6c3a6-2c60-46b0-b260-a2e0c62d4f41',
          name: 'Test Pool 2025',
          description: 'A test pool for end-to-end testing',
          is_test_mode: true,
          created_by: 'admin@test.com'
        },
        familyPool: {
          id: 'family-pool-id',
          name: 'Family Pool 2025',
          description: 'Family friendly pool',
          is_test_mode: false,
          created_by: 'admin@test.com'
        }
      },
      games: {
        week1: [
          {
            id: 'game-1',
            home_team: 'Team A',
            away_team: 'Team B',
            game_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
            week: 1,
            season_type: 'regular'
          },
          {
            id: 'game-2',
            home_team: 'Team C',
            away_team: 'Team D',
            game_time: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // Day after tomorrow
            week: 1,
            season_type: 'regular'
          }
        ]
      },
      picks: {
        participant1: {
          user_id: 'participant-1',
          pool_id: 'test-pool-id',
          game_id: 'game-1',
          predicted_winner: 'Team A',
          confidence_points: 10,
          week: 1
        }
      }
    };

    await use(testData);
  },

  // Setup authenticated page context
  authenticatedPage: async ({ page, testData }, use) => {
    // Login as admin
    await page.goto('/login');
    await page.fill('input[name="email"]', testData.users.admin.email);
    await page.fill('input[name="password"]', testData.users.admin.password);
    await page.click('button[type="submit"]');
    
    // Wait for login to complete - should go to participant dashboard
    await page.waitForURL('**/dashboard**');
    
    await use(page);
  },

  // Setup admin page context with better error handling
  adminPage: async ({ page, testData }, use) => {
    try {
      // Login as admin
      await page.goto('/admin/login');
      
      // Wait for the login form to be visible
      await page.waitForSelector('input[name="email"]', { timeout: 10000 });
      
      await page.fill('input[name="email"]', testData.users.admin.email);
      await page.fill('input[name="password"]', testData.users.admin.password);
      await page.click('button[type="submit"]');
      
      // Wait for login to complete and navigate to admin dashboard
      // Add a longer timeout and better error handling
      try {
        await page.waitForURL('**/admin/dashboard**', { timeout: 15000 });
      } catch (error) {
        console.error('Failed to reach admin dashboard after login:', error);
        
        // Check if we're still on the login page (login failed)
        const currentUrl = page.url();
        if (currentUrl.includes('/admin/login')) {
          // Check for error messages
          const errorElement = page.locator('[role="alert"], .text-red-600, .text-destructive');
          if (await errorElement.isVisible()) {
            const errorText = await errorElement.textContent();
            throw new Error(`Login failed: ${errorText}`);
          }
          throw new Error('Login failed - still on login page');
        }
        
        // Check if we got redirected somewhere else
        throw new Error(`Unexpected redirect after login: ${currentUrl}`);
      }
      
      await use(page);
    } catch (error) {
      console.error('Admin page setup failed:', error);
      throw error;
    }
  }
});

export { expect } from '@playwright/test';
