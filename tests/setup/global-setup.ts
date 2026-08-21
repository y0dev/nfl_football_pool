import { chromium, FullConfig } from '@playwright/test';
import { execSync } from 'child_process';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

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

  // Step 1b: create-test-data.ts deactivates superadmin@test.com /
  // pooladmin@test.com at the end of its own run (it's a standalone demo/
  // verification script and shouldn't leave enabled accounts + pool data
  // sitting around after a manual run) — but several permanent regression
  // specs (admin-authorization, clone-pool, dev-reset-password, nfl-sync)
  // authenticate against those exact two accounts via the x-admin-email
  // header for the rest of this suite. Re-activate them here so the suite
  // has a live super admin / commissioner to test against, without
  // resurrecting the demo pools create-test-data.ts already deleted.
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      await supabase.from('admins').update({ is_active: true }).eq('email', 'superadmin@test.com');
      await supabase.from('commissioners').update({ is_active: true }).eq('email', 'pooladmin@test.com');
      console.log('✅ Re-activated shared test admin accounts for the suite');
    } else {
      console.log('⚠️ Supabase env vars not found — skipped re-activating shared test admin accounts');
    }
  } catch (error) {
    console.error('❌ Failed to re-activate shared test admin accounts:', error);
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
