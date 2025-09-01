import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';

test.describe('Pool Settings Component', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    
    // Mock the pool data for testing
    await page.addInitScript(() => {
      window.mockPoolData = {
        id: 'test-pool-id',
        name: 'Test Pool 2025',
        description: 'A test pool for testing purposes',
        is_test_mode: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    });
  });

  test('should render pool settings form correctly', async ({ page }) => {
    // Navigate to a page that contains the pool settings component
    await page.goto('/pool/test-pool-id');
    await helpers.waitForPageLoad();

    // Verify the pool settings form is visible
    await helpers.expectElementVisible('[data-testid="pool-settings-form"]');
    
    // Check if form fields are present
    await helpers.expectElementVisible('[data-testid="pool-name-input"]');
    await helpers.expectElementVisible('[data-testid="pool-description-input"]');
    await helpers.expectElementVisible('[data-testid="test-mode-toggle"]');
    await helpers.expectElementVisible('[data-testid="save-settings-button"]');
  });

  test('should display current pool information', async ({ page }) => {
    await page.goto('/pool/test-pool-id');
    await helpers.waitForPageLoad();

    // Verify current pool name is displayed
    await helpers.expectElementContainsText('[data-testid="pool-name-input"]', 'Test Pool 2025');
    
    // Verify current pool description is displayed
    await helpers.expectElementContainsText('[data-testid="pool-description-input"]', 'A test pool for testing purposes');
    
    // Verify test mode toggle reflects current state
    const testModeToggle = page.locator('[data-testid="test-mode-toggle"]');
    await expect(testModeToggle).not.toBeChecked();
  });

  test('should allow editing pool name', async ({ page }) => {
    await page.goto('/pool/test-pool-id');
    await helpers.waitForPageLoad();

    // Clear and fill the pool name field
    await helpers.fillField('[data-testid="pool-name-input"]', 'Updated Test Pool 2025');
    
    // Verify the field contains the new value
    await helpers.expectElementContainsText('[data-testid="pool-name-input"]', 'Updated Test Pool 2025');
  });

  test('should allow editing pool description', async ({ page }) => {
    await page.goto('/pool/test-pool-id');
    await helpers.waitForPageLoad();

    // Clear and fill the pool description field
    await helpers.fillField('[data-testid="pool-description-input"]', 'Updated description for testing');
    
    // Verify the field contains the new value
    await helpers.expectElementContainsText('[data-testid="pool-description-input"]', 'Updated description for testing');
  });

  test('should toggle test mode correctly', async ({ page }) => {
    await page.goto('/pool/test-pool-id');
    await helpers.waitForPageLoad();

    // Click the test mode toggle
    await page.click('[data-testid="test-mode-toggle"]');
    
    // Verify the toggle is now checked
    const testModeToggle = page.locator('[data-testid="test-mode-toggle"]');
    await expect(testModeToggle).toBeChecked();
    
    // Click again to toggle off
    await page.click('[data-testid="test-mode-toggle"]');
    
    // Verify the toggle is now unchecked
    await expect(testModeToggle).not.toBeChecked();
  });

  test('should save settings successfully', async ({ page }) => {
    await page.goto('/pool/test-pool-id');
    await helpers.waitForPageLoad();

    // Make some changes
    await helpers.fillField('[data-testid="pool-name-input"]', 'New Pool Name');
    await helpers.fillField('[data-testid="pool-description-input"]', 'New pool description');
    await page.click('[data-testid="test-mode-toggle"]');
    
    // Click save button
    await page.click('[data-testid="save-settings-button"]');
    
    // Verify success message is displayed
    await helpers.expectElementVisible('[data-testid="success-message"]');
    
    // Verify the changes are persisted
    await helpers.expectElementContainsText('[data-testid="pool-name-input"]', 'New Pool Name');
    await helpers.expectElementContainsText('[data-testid="pool-description-input"]', 'New pool description');
    
    const testModeToggle = page.locator('[data-testid="test-mode-toggle"]');
    await expect(testModeToggle).toBeChecked();
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto('/pool/test-pool-id');
    await helpers.waitForPageLoad();

    // Clear the pool name field
    await helpers.fillField('[data-testid="pool-name-input"]', '');
    
    // Try to save
    await page.click('[data-testid="save-settings-button"]');
    
    // Verify validation error is displayed
    await helpers.expectElementVisible('[data-testid="validation-error"]');
  });

  test('should handle save errors gracefully', async ({ page }) => {
    // Mock API error response
    await helpers.mockAPIResponse('/api/admin/pools/test-pool-id', { 
      error: 'Failed to update pool settings' 
    });

    await page.goto('/pool/test-pool-id');
    await helpers.waitForPageLoad();

    // Make a change
    await helpers.fillField('[data-testid="pool-name-input"]', 'Error Test Name');
    
    // Try to save
    await page.click('[data-testid="save-settings-button"]');
    
    // Verify error message is displayed
    await helpers.expectElementVisible('[data-testid="error-message"]');
    
    // Verify the change is not persisted
    await helpers.expectElementContainsText('[data-testid="pool-name-input"]', 'Test Pool 2025');
  });

  test('should reset form when cancel is clicked', async ({ page }) => {
    await page.goto('/pool/test-pool-id');
    await helpers.waitForPageLoad();

    // Make some changes
    await helpers.fillField('[data-testid="pool-name-input"]', 'Changed Name');
    await helpers.fillField('[data-testid="pool-description-input"]', 'Changed description');
    await page.click('[data-testid="test-mode-toggle"]');
    
    // Click cancel button (if it exists)
    const cancelButton = page.locator('[data-testid="cancel-button"]');
    if (await cancelButton.count() > 0) {
      await cancelButton.click();
      
      // Verify form is reset to original values
      await helpers.expectElementContainsText('[data-testid="pool-name-input"]', 'Test Pool 2025');
      await helpers.expectElementContainsText('[data-testid="pool-description-input"]', 'A test pool for testing purposes');
      
      const testModeToggle = page.locator('[data-testid="test-mode-toggle"]');
      await expect(testModeToggle).not.toBeChecked();
    }
  });

  test('should show loading state during save', async ({ page }) => {
    // Mock slow API response
    await page.route('/api/admin/pools/test-pool-id', async route => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });

    await page.goto('/pool/test-pool-id');
    await helpers.waitForPageLoad();

    // Make a change
    await helpers.fillField('[data-testid="pool-name-input"]', 'Loading Test');
    
    // Click save button
    await page.click('[data-testid="save-settings-button"]');
    
    // Verify loading state is shown
    await helpers.expectElementVisible('[data-testid="loading-spinner"]');
    
    // Verify save button is disabled
    const saveButton = page.locator('[data-testid="save-settings-button"]');
    await expect(saveButton).toBeDisabled();
  });

  test('should be accessible', async ({ page }) => {
    await page.goto('/pool/test-pool-id');
    await helpers.waitForPageLoad();

    // Check for proper ARIA labels
    const nameInput = page.locator('[data-testid="pool-name-input"]');
    await expect(nameInput).toHaveAttribute('aria-label', /pool name/i);
    
    const descriptionInput = page.locator('[data-testid="pool-description-input"]');
    await expect(descriptionInput).toHaveAttribute('aria-label', /pool description/i);
    
    // Check for proper form labels
    await helpers.expectElementVisible('label[for="pool-name"]');
    await helpers.expectElementVisible('label[for="pool-description"]');
    
    // Check keyboard navigation
    await page.keyboard.press('Tab');
    await expect(nameInput).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(descriptionInput).toBeFocused();
  });
});
