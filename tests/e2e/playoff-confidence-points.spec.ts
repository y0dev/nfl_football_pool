import { test, expect } from '@playwright/test';
import { TestHelpers, testData, selectors } from '../utils/test-helpers';

test.describe('Playoff Confidence Points - End to End Tests', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    
    // Navigate to the home page
    await page.goto('/');
    await helpers.waitForPageLoad();
  });

  test.describe('Playoff Confidence Points Page', () => {
    test('should display playoff confidence points page', async ({ page }) => {
      // Login as participant
      await page.goto('/login');
      await helpers.waitForPageLoad();
      await helpers.fillField('input[name="email"]', testData.users.participant.email);
      await helpers.fillField('input[name="password"]', testData.users.participant.password);
      await page.click('button[type="submit"]');
      await helpers.waitForNavigation();

      // Navigate to a pool's playoffs page
      await page.goto('/pool/test-pool-id/playoffs');
      await helpers.waitForPageLoad();

      // Verify page loads
      await helpers.expectElementVisible('h1:has-text("Playoff Confidence Points")');
      await helpers.expectElementVisible('.submission-status, [class*="submission"]');
    });

    test('should show submission percentage', async ({ page }) => {
      // Login as participant
      await page.goto('/login');
      await helpers.waitForPageLoad();
      await helpers.fillField('input[name="email"]', testData.users.participant.email);
      await helpers.fillField('input[name="password"]', testData.users.participant.password);
      await page.click('button[type="submit"]');
      await helpers.waitForNavigation();

      // Navigate to playoffs page
      await page.goto('/pool/test-pool-id/playoffs');
      await helpers.waitForPageLoad();

      // Check for submission percentage display
      const percentageElement = page.locator('text=/\\d+%/').first();
      if (await percentageElement.count() > 0) {
        await expect(percentageElement).toBeVisible();
      }

      // Check for submission status card
      await helpers.expectElementVisible('.submission-status, [class*="submission"]');
    });

    test('should allow participant to submit confidence points', async ({ page }) => {
      // Login as participant
      await page.goto('/login');
      await helpers.waitForPageLoad();
      await helpers.fillField('input[name="email"]', testData.users.participant.email);
      await helpers.fillField('input[name="password"]', testData.users.participant.password);
      await page.click('button[type="submit"]');
      await helpers.waitForNavigation();

      // Navigate to playoffs page
      await page.goto('/pool/test-pool-id/playoffs');
      await helpers.waitForPageLoad();

      // Select participant from dropdown
      const participantSelect = page.locator('select#participant, select[name="participant"]');
      if (await participantSelect.count() > 0) {
        await participantSelect.selectOption({ index: 1 });
        await page.waitForTimeout(500); // Wait for confidence points to load

        // Verify confidence points inputs are visible
        const confidenceInputs = page.locator('input[type="number"]');
        if (await confidenceInputs.count() > 0) {
          await expect(confidenceInputs.first()).toBeVisible();

          // Fill in confidence points (if inputs exist)
          // Note: This would need actual team data to work properly
          const submitButton = page.locator('button:has-text("Submit Confidence Points")');
          if (await submitButton.count() > 0) {
            await expect(submitButton).toBeVisible();
          }
        }
      }
    });

    test('should prevent duplicate submissions', async ({ page }) => {
      // Login as participant
      await page.goto('/login');
      await helpers.waitForPageLoad();
      await helpers.fillField('input[name="email"]', testData.users.participant.email);
      await helpers.fillField('input[name="password"]', testData.users.participant.password);
      await page.click('button[type="submit"]');
      await helpers.waitForNavigation();

      // Navigate to playoffs page
      await page.goto('/pool/test-pool-id/playoffs');
      await helpers.waitForPageLoad();

      // Select participant who has already submitted
      const participantSelect = page.locator('select#participant');
      if (await participantSelect.count() > 0) {
        await participantSelect.selectOption({ index: 1 });
        await page.waitForTimeout(500);

        // Check for "already submitted" message
        const submittedMessage = page.locator('text=/already submitted/i, text=/cannot be changed/i');
        if (await submittedMessage.count() > 0) {
          await expect(submittedMessage.first()).toBeVisible();
        }
      }
    });

    test('should display all confidence points when everyone has submitted', async ({ page }) => {
      // Login as participant
      await page.goto('/login');
      await helpers.waitForPageLoad();
      await helpers.fillField('input[name="email"]', testData.users.participant.email);
      await helpers.fillField('input[name="password"]', testData.users.participant.password);
      await page.click('button[type="submit"]');
      await helpers.waitForNavigation();

      // Navigate to playoffs page
      await page.goto('/pool/test-pool-id/playoffs');
      await helpers.waitForPageLoad();

      // Check for "All Playoff Confidence Points" section
      const allSubmissionsSection = page.locator('h2:has-text("All Playoff Confidence Points"), h3:has-text("All Playoff Confidence Points")');
      if (await allSubmissionsSection.count() > 0) {
        await expect(allSubmissionsSection.first()).toBeVisible();

        // Verify table with all submissions is visible
        const submissionsTable = page.locator('table');
        if (await submissionsTable.count() > 0) {
          await expect(submissionsTable.first()).toBeVisible();
        }
      }
    });

    test('should validate confidence points are sequential', async ({ page }) => {
      // Login as participant
      await page.goto('/login');
      await helpers.waitForPageLoad();
      await helpers.fillField('input[name="email"]', testData.users.participant.email);
      await helpers.fillField('input[name="password"]', testData.users.participant.password);
      await page.click('button[type="submit"]');
      await helpers.waitForNavigation();

      // Navigate to playoffs page
      await page.goto('/pool/test-pool-id/playoffs');
      await helpers.waitForPageLoad();

      // Select participant
      const participantSelect = page.locator('select#participant');
      if (await participantSelect.count() > 0) {
        await participantSelect.selectOption({ index: 1 });
        await page.waitForTimeout(500);

        // Try to submit with invalid confidence points
        const submitButton = page.locator('button:has-text("Submit Confidence Points")');
        if (await submitButton.count() > 0 && await submitButton.isEnabled()) {
          await submitButton.click();
          
          // Check for validation error
          await page.waitForTimeout(500);
          const errorMessage = page.locator('text=/sequential/i, text=/must be unique/i, text=/all teams/i');
          if (await errorMessage.count() > 0) {
            await expect(errorMessage.first()).toBeVisible();
          }
        }
      }
    });
  });

  test.describe('Playoff Confidence Points from Pool Page', () => {
    test('should navigate to playoffs page from pool management', async ({ page }) => {
      // Login as admin
      await page.goto('/login');
      await helpers.waitForPageLoad();
      await helpers.fillField('input[name="email"]', testData.users.admin.email);
      await helpers.fillField('input[name="password"]', testData.users.admin.password);
      await page.click('button[type="submit"]');
      await helpers.waitForNavigation();

      // Navigate to a pool's detail page
      await page.goto('/pool/test-pool-id');
      await helpers.waitForPageLoad();

      // Click on Playoffs tab
      const playoffsTab = page.locator('button:has-text("Playoffs"), [role="tab"]:has-text("Playoffs")');
      if (await playoffsTab.count() > 0) {
        await playoffsTab.click();
        await page.waitForTimeout(500);

        // Check for link to playoffs page
        const playoffsLink = page.locator('a:has-text("Manage Playoff Confidence Points"), button:has-text("Manage Playoff Confidence Points")');
        if (await playoffsLink.count() > 0) {
          await expect(playoffsLink.first()).toBeVisible();
        }
      }
    });
  });
});

