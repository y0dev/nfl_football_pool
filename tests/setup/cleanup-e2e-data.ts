// Sweeps up pools (and their commissioners/huddles) created by the e2e
// suite. Individual specs already delete what they create in their own
// try/finally blocks — this is a safety net for anything that leaked
// because a spec crashed before its cleanup ran, or was written without one.
//
// Matching is deliberately broad but safe: every spec file in tests/e2e
// names its test pools with an "E2E " prefix and/or creates commissioners
// under emails matching e2e-*@sundayhuddle.{net,test} (verified against the
// whole suite, not assumed) — a real commissioner is never going to match
// either pattern, so there's no risk of touching real data.
//
// pool_id everywhere in the schema is `ON DELETE CASCADE` (participants,
// picks, scores, tie_breakers, payout_configs, payout_records, survivor/
// pickem tables — see src/lib/supabase.ts) — deleting the `pools` row itself
// is enough to clean up everything under it. huddles.commissioner_email has
// no such FK, so it's swept separately.
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

const TEST_EMAIL_PATTERN = 'e2e-%@sundayhuddle.%';
const TEST_POOL_NAME_PATTERNS = ['E2E %', 'Manual Verify %'];

export async function cleanupE2eTestData(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.log('⚠️  Supabase env vars not found — skipped e2e test data cleanup');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🧹 Sweeping leftover e2e test data...');

  // Pools: matched by name prefix OR by owner email pattern, since a couple
  // of specs create pools whose name doesn't start with "E2E " but whose
  // created_by clearly does (and vice versa).
  const orFilter = [
    ...TEST_POOL_NAME_PATTERNS.map(p => `name.ilike.${p}`),
    `created_by.ilike.${TEST_EMAIL_PATTERN}`,
  ].join(',');

  const { data: pools, error: poolsFindError } = await supabase
    .from('pools')
    .select('id, name, created_by')
    .or(orFilter);

  if (poolsFindError) {
    console.error('❌ Error finding leftover e2e pools:', poolsFindError);
  } else if (pools && pools.length > 0) {
    const { error: poolsDeleteError } = await supabase
      .from('pools')
      .delete()
      .in('id', pools.map(p => p.id));
    if (poolsDeleteError) {
      console.error('❌ Error deleting leftover e2e pools:', poolsDeleteError);
    } else {
      console.log(`✅ Deleted ${pools.length} leftover e2e pool(s): ${pools.map(p => p.name).join(', ')}`);
    }
  } else {
    console.log('✅ No leftover e2e pools found');
  }

  // Commissioners created directly by tests that never made it into a pool
  // (or whose pool was already cleaned above).
  const { data: commissioners, error: commissionersFindError } = await supabase
    .from('commissioners')
    .select('id, email')
    .ilike('email', TEST_EMAIL_PATTERN);

  if (commissionersFindError) {
    console.error('❌ Error finding leftover e2e commissioners:', commissionersFindError);
  } else if (commissioners && commissioners.length > 0) {
    const { error: commissionersDeleteError } = await supabase
      .from('commissioners')
      .delete()
      .in('id', commissioners.map(c => c.id));
    if (commissionersDeleteError) {
      console.error('❌ Error deleting leftover e2e commissioners:', commissionersDeleteError);
    } else {
      console.log(`✅ Deleted ${commissioners.length} leftover e2e commissioner account(s)`);
    }
  } else {
    console.log('✅ No leftover e2e commissioner accounts found');
  }

  // huddles.commissioner_email is a plain column, not FK-cascaded from
  // commissioners — swept explicitly.
  const { data: huddles, error: huddlesFindError } = await supabase
    .from('huddles')
    .select('id')
    .ilike('commissioner_email', TEST_EMAIL_PATTERN);

  if (huddlesFindError) {
    console.error('❌ Error finding leftover e2e huddles:', huddlesFindError);
  } else if (huddles && huddles.length > 0) {
    const { error: huddlesDeleteError } = await supabase
      .from('huddles')
      .delete()
      .in('id', huddles.map(h => h.id));
    if (huddlesDeleteError) {
      console.error('❌ Error deleting leftover e2e huddles:', huddlesDeleteError);
    } else {
      console.log(`✅ Deleted ${huddles.length} leftover e2e huddle(s)`);
    }
  } else {
    console.log('✅ No leftover e2e huddles found');
  }
}
