import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Validate environment variables (same fallback as getSupabaseServiceClient
// in src/lib/supabase.ts — some environments only set the NEXT_PUBLIC_ variant)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
  console.error('   SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_SERVICE_KEY:', supabaseServiceKey ? '✅ Set' : '❌ Missing');
  process.exit(1);
}

/**
 * One-off cleanup: the 'pro' plan tier was retired from src/lib/plan.ts
 * (Plan is now 'free' | 'standard' only), but any admins row still holding
 * plan='pro' from before that change used to crash computePlanInfo on read
 * (LIMITS['pro'] is undefined). That crash is now fixed defensively — 'pro'
 * is treated as 'standard' at read time — but the stale value is still
 * sitting in the database. This updates it in place so the data matches
 * what every read path already normalizes it to.
 *
 * Usage:
 *   npx tsx scripts/cleanup-stale-pro-plan.ts          # dry run — lists affected rows only
 *   npx tsx scripts/cleanup-stale-pro-plan.ts --apply  # actually updates them
 */

async function main() {
  const apply = process.argv.includes('--apply');

  const { getSupabaseServiceClient } = await import('../src/lib/supabase');
  const supabase = getSupabaseServiceClient();

  // plan only lives on commissioners now (see scripts/migrate-commissioners.ts)
  const { data: staleAdmins, error } = await supabase
    .from('commissioners')
    .select('id, email, plan')
    .eq('plan', 'pro');

  if (error) {
    console.error('❌ Failed to query commissioners:', error.message);
    process.exit(1);
  }

  if (!staleAdmins || staleAdmins.length === 0) {
    console.log('✅ No commissioners rows with plan=\'pro\' found — nothing to clean up.');
    return;
  }

  console.log(`Found ${staleAdmins.length} commissioner(s) with plan='pro':`);
  staleAdmins.forEach(a => console.log(`   ${a.email} (${a.id})`));

  if (!apply) {
    console.log('\nDry run only — re-run with --apply to update these to plan=\'standard\'.');
    return;
  }

  const { error: updateError, data: updated } = await supabase
    .from('commissioners')
    .update({ plan: 'standard' })
    .eq('plan', 'pro')
    .select('id');

  if (updateError) {
    console.error('❌ Failed to update commissioners:', updateError.message);
    process.exit(1);
  }

  console.log(`✅ Updated ${updated?.length ?? staleAdmins.length} commissioner(s) from plan='pro' to plan='standard'.`);
}

main().catch(err => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
