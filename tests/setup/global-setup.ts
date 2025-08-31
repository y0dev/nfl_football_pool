import { chromium, FullConfig } from '@playwright/test';
import { execSync } from 'child_process';
import { join } from 'path';

async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;
  
  if (!baseURL) {
    throw new Error('Base URL is not configured');
  }

  console.log('🚀 Setting up test environment...');
  
  // Step 1: Ensure test data exists in the database
  console.log('📊 Creating test data...');
  try {
    // Run the test data creation script
    const scriptPath = join(process.cwd(), 'scripts', 'create-test-data.ts');
    execSync(`npx tsx ${scriptPath}`, { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    console.log('✅ Test data created successfully');
  } catch (error) {
    console.error('❌ Failed to create test data:', error);
    // Don't fail the setup - tests might still work with existing data
    console.log('⚠️ Continuing with existing data...');
  }
  
  // Step 2: Launch browser and create a new context
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
