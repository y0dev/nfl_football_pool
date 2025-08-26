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
          id: 'test-pool-id',
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
    
    // Wait for login to complete
    await page.waitForURL('**/participant**');
    
    await use(page);
  },

  // Setup admin page context
  adminPage: async ({ page, testData }, use) => {
    // Login as admin
    await page.goto('/login');
    await page.fill('input[name="email"]', testData.users.admin.email);
    await page.fill('input[name="password"]', testData.users.admin.password);
    await page.click('button[type="submit"]');
    
    // Wait for login to complete and navigate to admin
    await page.waitForURL('**/participant**');
    await page.goto('/admin/dashboard');
    
    await use(page);
  }
});

export { expect } from '@playwright/test';
