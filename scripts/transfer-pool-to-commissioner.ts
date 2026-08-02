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
 * One-off admin script: moves a pool (and merges its participants into the
 * destination commissioner's Huddle roster) from its current commissioner
 * to a different one. Super-admin only, no approval flow — see
 * src/lib/poolTransfer.ts for the shared logic also used by
 * /api/admin/transfer-pool, and src/actions/huddleTransfers.ts for the
 * commissioner-facing, mutual-approval equivalent that moves an entire
 * Huddle.
 *
 * Usage:
 *   npx tsx scripts/transfer-pool-to-commissioner.ts \
 *     --pool-name "NFL Confidence Pool 2025" \
 *     --to-email reid.cog@gmail.com \
 *     --admin-email your-super-admin-email@example.com \
 *     [--remove-from-source-roster]
 *
 * If more than one pool shares --pool-name, re-run with --pool-id instead
 * (printed in the disambiguation error) to target one exactly.
 *
 * --remove-from-source-roster deactivates the transferred participants'
 * entries on the SOURCE commissioner's League roster, but only for anyone
 * who isn't still active in another pool within that same League — it never
 * touches someone still genuinely part of it.
 */

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  const flags = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      flags.add(key);
    } else {
      args[key] = next;
      i++;
    }
  }
  return { args, flags };
}

async function main() {
  const { args, flags } = parseArgs(process.argv.slice(2));
  const poolName = args['pool-name'];
  const poolId = args['pool-id'];
  const toEmail = args['to-email'];
  const adminEmail = args['admin-email'];
  const removeFromSourceRoster = flags.has('remove-from-source-roster');

  if ((!poolName && !poolId) || !toEmail || !adminEmail) {
    console.error('Usage: npx tsx scripts/transfer-pool-to-commissioner.ts --pool-name "<name>" --to-email <email> --admin-email <email> [--remove-from-source-roster]');
    console.error('   (or --pool-id <uuid> instead of --pool-name, to target one pool exactly)');
    process.exit(1);
  }

  // Imported after env validation so getSupabaseServiceClient() (called
  // lazily inside these modules) sees the loaded env vars.
  const { getSupabaseServiceClient } = await import('../src/lib/supabase');
  const { transferPoolToCommissioner } = await import('../src/lib/poolTransfer');

  const supabase = getSupabaseServiceClient();

  let resolvedPoolId = poolId;
  if (!resolvedPoolId) {
    const { data: matches, error } = await supabase
      .from('pools')
      .select('id, name, created_by, season')
      .ilike('name', poolName!);

    if (error) {
      console.error('❌ Failed to look up pool:', error.message);
      process.exit(1);
    }
    if (!matches || matches.length === 0) {
      console.error(`❌ No pool found with name "${poolName}".`);
      process.exit(1);
    }
    if (matches.length > 1) {
      console.error(`❌ Multiple pools named "${poolName}" — re-run with --pool-id instead:`);
      matches.forEach(m => console.error(`   ${m.id}  (season ${m.season}, owned by ${m.created_by})`));
      process.exit(1);
    }
    resolvedPoolId = matches[0].id;
  }

  console.log(`Transferring pool ${resolvedPoolId} to ${toEmail}...`);
  const result = await transferPoolToCommissioner(resolvedPoolId, toEmail, adminEmail, removeFromSourceRoster);

  if (!result.success) {
    console.error(`❌ Transfer failed: ${result.error}`);
    process.exit(1);
  }

  console.log(`✅ "${result.poolName}" transferred: ${result.fromEmail} → ${result.toEmail}`);
  console.log(`   Now in Huddle "${result.huddleName}" (${result.huddleId})`);
  console.log(`   Merged ${result.mergedMembers} participant(s) into that Huddle's roster.`);
  if (removeFromSourceRoster) {
    console.log(`   Removed ${result.removedFromSourceRoster} participant(s) from the source League's roster (only those no longer in any other pool there).`);
  }
}

main().catch(err => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
