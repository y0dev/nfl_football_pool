import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;
  
  if (!baseURL) {
    throw new Error('Base URL is not configured');
  }

  console.log('🚀 Setting up test environment...');
  
  // Launch browser and create a new context
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to the application
    console.log(`📍 Navigating to ${baseURL}`);
    await page.goto(baseURL);
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Check if the application is running
    const title = await page.title();
    console.log(`✅ Application loaded with title: ${title}`);
    
    // Verify basic functionality is working
    const isAppRunning = await page.locator('body').isVisible();
    if (!isAppRunning) {
      throw new Error('Application is not responding properly');
    }
    
    console.log('✅ Test environment setup completed successfully');
    
  } catch (error) {
    console.error('❌ Failed to setup test environment:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;
