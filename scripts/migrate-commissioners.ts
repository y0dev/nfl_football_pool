import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getSupabaseServiceClient } from '../src/lib/supabase-service';

// Data half of the commissioners split. Run scripts/migrate-commissioners.sql
// in the Supabase SQL editor FIRST (creates the commissioners/payments
// tables — this script only does INSERT/DELETE via the normal client, which
// can't create tables).
//
// Preserves each commissioner's existing admins.id when copying, so nothing
// currently logged in gets invalidated (see src/lib/accounts.ts). Verifies
// every row landed in commissioners before deleting anything from admins —
// never deletes on a partial/failed copy. Safe to re-run: upserts on id, and
// re-checks what's left in admins before deleting again.

async function main() {
  const supabase = getSupabaseServiceClient();

  const { data: toMigrate, error: fetchError } = await supabase
    .from('admins')
    .select('id, email, password_hash, full_name, avatar_url, created_at, updated_at, is_active, plan, trial_ends_at, billing_exempt, addon_pools, stripe_customer_id')
    .eq('is_super_admin', false);

  if (fetchError) {
    console.error('Failed to read commissioner rows from admins:', fetchError);
    process.exit(1);
  }

  if (!toMigrate || toMigrate.length === 0) {
    console.log('No is_super_admin=false rows left in admins — nothing to migrate (already done, or table is empty).');
    return;
  }

  console.log(`Found ${toMigrate.length} commissioner row(s) in admins to migrate.`);

  const { error: insertError } = await supabase
    .from('commissioners')
    .upsert(toMigrate, { onConflict: 'id' });

  if (insertError) {
    console.error('Failed to copy rows into commissioners — nothing deleted from admins. Error:', insertError);
    console.error('If this says the table doesn\'t exist, run scripts/migrate-commissioners.sql first.');
    process.exit(1);
  }

  console.log(`Copied ${toMigrate.length} row(s) into commissioners.`);

  // Verify every id we meant to migrate actually landed before deleting the source.
  const migratedIds = toMigrate.map(r => r.id);
  const { data: landed, error: verifyError } = await supabase
    .from('commissioners')
    .select('id')
    .in('id', migratedIds);

  if (verifyError) {
    console.error('Could not verify the copy — leaving admins untouched. Error:', verifyError);
    process.exit(1);
  }

  const landedIds = new Set((landed ?? []).map(r => r.id));
  const missing = migratedIds.filter(id => !landedIds.has(id));
  if (missing.length > 0) {
    console.error(`${missing.length} row(s) did not land in commissioners — leaving admins untouched. Missing ids:`, missing);
    process.exit(1);
  }

  console.log('Verified every migrated row exists in commissioners. Deleting from admins...');

  const { error: deleteError } = await supabase
    .from('admins')
    .delete()
    .eq('is_super_admin', false);

  if (deleteError) {
    console.error('Copy succeeded but delete from admins failed (rows now exist in both tables — re-run is safe once fixed):', deleteError);
    process.exit(1);
  }

  const [{ count: commissionerCount }, { count: remainingAdminCount }, { count: nonSuperAdminLeft }] = await Promise.all([
    supabase.from('commissioners').select('id', { count: 'exact', head: true }),
    supabase.from('admins').select('id', { count: 'exact', head: true }),
    supabase.from('admins').select('id', { count: 'exact', head: true }).eq('is_super_admin', false),
  ]);

  console.log('');
  console.log('Migration complete.');
  console.log(`  commissioners: ${commissionerCount ?? '?'} row(s)`);
  console.log(`  admins remaining: ${remainingAdminCount ?? '?'} row(s) (should all be is_super_admin=true)`);
  console.log(`  admins still is_super_admin=false: ${nonSuperAdminLeft ?? '?'} (should be 0)`);
}

main();
