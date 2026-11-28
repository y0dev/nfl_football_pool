import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import { createPool } from '../../src/actions/createPool';
import { signInAs } from '../utils/session';
loadEnv({ path: '.env.local' });

// ─────────────────────────────────────────────────────────────
// Pool settings (src/components/admin/pool-settings.tsx): the Settings tab
// of a pool in the commissioner dashboard — rename, validation, the private
// pool password, and the guarded Delete Pool dialog.
//
// Each test gets its own throwaway commissioner and pool (an e2e-* email and
// an "E2E " pool name, so the global teardown sweeps anything left behind).
// ─────────────────────────────────────────────────────────────

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY!);

interface Fixture { email: string; commissionerId: string; poolId: string; poolName: string }

async function seed(): Promise<Fixture> {
  const stamp = Date.now();
  const email = `e2e-pool-settings-${stamp}@sundayhuddle.test`;
  const { data: owner, error } = await supabase
    .from('commissioners')
    .insert({ email, password_hash: 'google_oauth', full_name: 'E2E Settings Owner', is_active: true })
    .select('id')
    .single();
  if (error || !owner) throw new Error(`Failed to seed commissioner: ${error?.message}`);
  const poolName = `E2E Settings Pool ${stamp}`;
  const created = await createPool({ name: poolName, created_by: email, season_scope: [2] });
  if (!created.success) throw new Error(`Failed to create pool: ${created.error}`);
  return { email, commissionerId: owner.id, poolId: created.data.id as string, poolName };
}

async function cleanup(f: Fixture | undefined) {
  if (!f) return;
  await supabase.from('participants').delete().eq('pool_id', f.poolId);
  await supabase.from('pools').delete().eq('id', f.poolId);
  await supabase.from('huddles').delete().eq('commissioner_email', f.email);
  await supabase.from('commissioners').delete().eq('id', f.commissionerId);
}

const poolRow = async (poolId: string) =>
  (await supabase.from('pools').select('name, is_private, private_password_encrypted').eq('id', poolId).single()).data!;

/** Opens the dashboard's Settings tab for the commissioner's only pool. The
 * first tab click occasionally renders nothing (see pool-delete-refresh);
 * retrying it routes around that without hiding a real failure. */
async function openSettings(page: Page) {
  await page.goto('/dashboard');
  for (let attempt = 1; ; attempt++) {
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    try {
      await expect(page.getByPlaceholder('Enter pool name')).toBeVisible({ timeout: 5000 });
      return;
    } catch (err) {
      if (attempt === 4) throw err;
    }
  }
}

test.describe('Pool settings', () => {
  let f: Fixture | undefined;
  test.beforeEach(async ({ context }) => {
    f = await seed();
    await signInAs(context, f.email);
  });
  test.afterEach(async () => { await cleanup(f); f = undefined; });

  test('shows the pool\'s current settings', async ({ page }) => {
    await openSettings(page);
    await expect(page.getByPlaceholder('Enter pool name')).toHaveValue(f!.poolName);
    await expect(page.getByRole('button', { name: 'Public', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Private', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /save settings/i })).toBeEnabled();
  });

  test('renaming the pool saves the new name', async ({ page }) => {
    await openSettings(page);
    const newName = `${f!.poolName} Renamed`;
    await page.getByPlaceholder('Enter pool name').fill(newName);
    await page.getByRole('button', { name: /save settings/i }).click();

    await expect(page.getByText('Pool settings updated successfully').first()).toBeVisible({ timeout: 10000 });
    expect((await poolRow(f!.poolId)).name).toBe(newName);
  });

  test('a name under 3 characters is refused and nothing is saved', async ({ page }) => {
    await openSettings(page);
    await page.getByPlaceholder('Enter pool name').fill('ab');
    await page.getByRole('button', { name: /save settings/i }).click();

    await expect(page.getByText('Pool name must be at least 3 characters')).toBeVisible();
    expect((await poolRow(f!.poolId)).name).toBe(f!.poolName);
  });

  test('a private pool needs a password, and mismatched entries are refused', async ({ page }) => {
    await openSettings(page);
    await page.getByRole('button', { name: 'Private', exact: true }).click();
    await expect(page.getByText(/No password set yet/)).toBeVisible();

    await page.getByRole('button', { name: 'Set Password' }).click();
    await page.getByPlaceholder('At least 4 characters').fill('touchdown');
    await page.getByPlaceholder('Re-enter password').fill('fieldgoal');
    await page.getByRole('button', { name: 'Save Password' }).click();
    await expect(page.getByText('Passwords do not match.')).toBeVisible();
    expect((await poolRow(f!.poolId)).private_password_encrypted).toBeNull();

    await page.getByPlaceholder('Re-enter password').fill('touchdown');
    await page.getByRole('button', { name: 'Save Password' }).click();
    await expect(page.getByText(/Previous access to this pool has been revoked/).first()).toBeVisible({ timeout: 10000 });
    const row = await poolRow(f!.poolId);
    expect(row.is_private).toBe(true);
    expect(row.private_password_encrypted).toBeTruthy(); // stored encrypted, never as plaintext
  });

  test('Delete Pool only unlocks once the exact pool name is typed, and Cancel keeps the pool', async ({ page }) => {
    await openSettings(page);
    await page.getByRole('button', { name: 'Delete Pool' }).click();
    const dialog = page.getByRole('dialog');
    const confirm = dialog.getByRole('button', { name: 'Delete Pool' });
    await expect(confirm).toBeDisabled();

    await dialog.getByPlaceholder('Enter pool name to confirm').fill('Not the pool name');
    await expect(confirm).toBeDisabled();
    await dialog.getByPlaceholder('Enter pool name to confirm').fill(f!.poolName);
    await expect(confirm).toBeEnabled();

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    expect((await poolRow(f!.poolId)).name).toBe(f!.poolName);
  });
});
