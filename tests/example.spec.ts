import { test, expect } from '@playwright/test';

test.describe('Basic Application Test', () => {
  test('should load the homepage', async ({ page }) => {
    // Navigate to the homepage
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Check if the page title contains expected text
    const title = await page.title();
    console.log('Page title:', title);
    
    // Verify the page loaded successfully
    expect(page.url()).toContain('localhost:3000');
    
    // Check if the page has content
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toBeTruthy();
    
    // Take a screenshot for verification
    await page.screenshot({ path: 'test-results/homepage.png' });
  });

  test('should have navigation elements', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check for common navigation elements
    const hasNavigation = await page.locator('nav, header, [role="navigation"]').count() > 0;
    expect(hasNavigation).toBeTruthy();
    
    // Check for common links (adjust based on your actual navigation)
    const links = page.locator('a');
    const linkCount = await links.count();
    console.log(`Found ${linkCount} links on the page`);
    
    expect(linkCount).toBeGreaterThan(0);
  });

  test('should be responsive', async ({ page }) => {
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Take desktop screenshot
    await page.screenshot({ path: 'test-results/desktop.png' });
    
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000); // Wait for layout adjustment
    
    // Take mobile screenshot
    await page.screenshot({ path: 'test-results/mobile.png' });
    
    // Verify page still works on mobile
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toBeTruthy();
  });
});
