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
 * Repair script: merges a pool's participants into its OWN Huddle's roster
 * (huddle_members) — the same merge step transferPoolToCommissioner and
 * confirmPoolTransfer run automatically, but callable standalone for a pool
 * that already moved before the no-email bug (participants added without
 * an email were silently skipped) was fixed. Safe to re-run — participants
 * already linked (huddle_member_id set) are skipped.
 *
 * Usage:
 *   npx tsx scripts/backfill-pool-participants-to-roster.ts --pool-name "NFL Confidence Pool 2025"
 *   npx tsx scripts/backfill-pool-participants-to-roster.ts --pool-id <uuid>
 */

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      args[key] = argv[i + 1];
      i++;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const poolName = args['pool-name'];
  const poolId = args['pool-id'];

  if (!poolName && !poolId) {
    console.error('Usage: npx tsx scripts/backfill-pool-participants-to-roster.ts --pool-name "<name>" (or --pool-id <uuid>)');
    process.exit(1);
  }

  const { getSupabaseServiceClient } = await import('../src/lib/supabase-service');
  const supabase = getSupabaseServiceClient();

  let resolvedPoolId = poolId;
  if (!resolvedPoolId) {
    const { data: matches, error } = await supabase
      .from('pools')
      .select('id, name, huddle_id, created_by, season')
      .ilike('name', poolName!);

    if (error) { console.error('❌ Failed to look up pool:', error.message); process.exit(1); }
    if (!matches || matches.length === 0) { console.error(`❌ No pool found with name "${poolName}".`); process.exit(1); }
    if (matches.length > 1) {
      console.error(`❌ Multiple pools named "${poolName}" — re-run with --pool-id instead:`);
      matches.forEach(m => console.error(`   ${m.id}  (season ${m.season}, owned by ${m.created_by})`));
      process.exit(1);
    }
    resolvedPoolId = matches[0].id;
  }

  const { data: pool } = await supabase
    .from('pools')
    .select('id, name, huddle_id, created_by')
    .eq('id', resolvedPoolId)
    .maybeSingle();

  if (!pool) { console.error(`❌ Pool ${resolvedPoolId} not found.`); process.exit(1); }
  if (!pool.huddle_id) { console.error(`❌ "${pool.name}" isn't assigned to a Huddle yet — nothing to merge into.`); process.exit(1); }

  const { data: huddle } = await supabase.from('huddles').select('id, name').eq('id', pool.huddle_id).single();
  console.log(`Merging participants of "${pool.name}" into Huddle "${huddle?.name}" (${pool.huddle_id})...`);

  const { data: participants, error: participantsError } = await supabase
    .from('participants')
    .select('id, name, email, huddle_member_id')
    .eq('pool_id', pool.id)
    .eq('is_active', true);

  if (participantsError) { console.error('❌ Failed to load participants:', participantsError.message); process.exit(1); }

  let merged = 0;
  let alreadyLinked = 0;
  let skipped = 0;

  for (const participant of participants ?? []) {
    if (participant.huddle_member_id) {
      // Already linked to SOME roster entry — leave alone. Nothing to fix
      // for participants who already went through a working merge.
      alreadyLinked++;
      continue;
    }

    const email = participant.email?.trim().toLowerCase() || null;

    let memberId: string | undefined;
    if (email) {
      const { data: existingMember } = await supabase
        .from('huddle_members')
        .select('id')
        .eq('huddle_id', pool.huddle_id)
        .eq('email', email)
        .maybeSingle();
      memberId = existingMember?.id as string | undefined;
    }

    if (!memberId) {
      const { data: created, error: memberError } = await supabase
        .from('huddle_members')
        .insert({ huddle_id: pool.huddle_id, name: participant.name, email })
        .select('id')
        .single();
      if (memberError) {
        console.error(`   ⚠️  Failed to create roster entry for ${participant.name}:`, memberError.message);
        skipped++;
        continue;
      }
      memberId = created.id;
    }

    const { error: linkError } = await supabase
      .from('participants')
      .update({ huddle_member_id: memberId })
      .eq('id', participant.id);

    if (linkError) {
      console.error(`   ⚠️  Failed to link ${participant.name}:`, linkError.message);
      skipped++;
      continue;
    }

    merged++;
  }

  console.log(`✅ Done. Merged ${merged}, already linked ${alreadyLinked}, skipped ${skipped}.`);
}

main().catch(err => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
