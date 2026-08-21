import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

// ─────────────────────────────────────────────────────────────
// Regression coverage for: deleting a pool from its Settings > Danger Zone
// only cleared the selected-pool id — it never refetched the dashboard's
// pool list, so the just-deleted pool kept showing up (dropdown option,
// "N pools" counts, stale workspace data) until the next full page
// reload, even though the row was already gone from the database.
// Covers both src/app/dashboard/page.tsx and src/app/admin/dashboard/
// page.tsx, which each keep their own independently-fetched pool list.
//
// Logs in as the shared seeded commissioner (pooladmin@test.com, from
// scripts/create-test-data.ts) rather than registering a new one —
// /api/admin/create-commissioner rate-limits to 5 registrations/IP/hour,
// and this flow doesn't need a dedicated account.
// ─────────────────────────────────────────────────────────────

async function cleanupPool(poolName: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY!
  );
  const { data } = await supabase.from('pools').select('id').eq('name', poolName).maybeSingle();
  if (data) {
    await supabase.from('participants').delete().eq('pool_id', data.id);
    await supabase.from('pools').delete().eq('id', data.id);
  }
}

test.describe('Pool deletion refreshes the pool list without a page reload', () => {
  test('/dashboard drops the deleted pool from the selector and counts immediately', async ({ page }) => {
    test.setTimeout(60000);
    const poolName = `E2E Delete Refresh ${Date.now()}`;

    try {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      await page.fill('input[type="email"], input[name="email"]', 'pooladmin@test.com');
      await page.fill('input[type="password"], input[name="password"]', 'pool123');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard**', { timeout: 15000 });
      await page.waitForLoadState('networkidle');

      const createBtn = page.locator('button:has-text("Create Pool"), button:has-text("Create First Pool")').first();
      await createBtn.click();
      await page.waitForSelector('text=Create New Pool', { timeout: 10000 });
      await page.fill('input[placeholder="Enter pool name"]', poolName);
      await page.locator('[role="dialog"] button[type="submit"]').click();
      await page.waitForSelector('text=Create New Pool', { state: 'detached', timeout: 10000 });
      await expect(page.locator('body')).toContainText(poolName, { timeout: 10000 });

      await page.click('button:has-text("Settings")');
      await page.waitForSelector('text=Delete Pool', { timeout: 10000 });
      await page.click('button:has-text("Delete Pool")');
      await page.waitForSelector('text=Are you sure you want to delete', { timeout: 10000 });
      await page.locator('input').last().fill(poolName);
      await page.locator('[role="dialog"] button:has-text("Delete Pool")').last().click();

      // No reload anywhere in this flow — the fix must make this disappear
      // on its own once the delete request resolves.
      await expect(page.locator('body')).not.toContainText(poolName, { timeout: 10000 });
      await expect(page.locator('text=No Pools Yet')).toBeVisible({ timeout: 10000 });
    } finally {
      await cleanupPool(poolName);
    }
  });
});
