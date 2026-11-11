#!/usr/bin/env tsx

/**
 * Close Season Script
 *
 * Marks pools from a past NFL season as completed (is_active = false)
 * and computes + persists season winners for each pool.
 *
 * The season winner comes from computeSeasonReview() (src/lib/season-review.ts),
 * the same calculation the Close Season button, Season Review and the
 * determine-weekly-winners cron use: most Q1-Q4 periods won, not most
 * points. It is always recomputed and overwrites any stored row.
 *
 * Usage:
 *   npm run close-season                    # closes season 2025 (current year - 1)
 *   npm run close-season -- --season 2023   # closes a specific season
 *   npm run close-season -- --pool <uuid>   # closes one specific pool
 *   npm run close-season -- --dry-run       # preview only, no writes
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { computeSeasonReview } from '../src/lib/season-review';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars. Need NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_SERVICE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const seasonArg = args.includes('--season')
  ? parseInt(args[args.indexOf('--season') + 1], 10)
  : null;
const poolArg = args.includes('--pool')
  ? args[args.indexOf('--pool') + 1]
  : null;
const dryRun = args.includes('--dry-run');

// Default: previous NFL season
const now = new Date();
const month = now.getMonth() + 1;
const day = now.getDate();
const nflCurrentYear = month < 2 || (month === 2 && day < 14)
  ? now.getFullYear() - 1
  : now.getFullYear();

const targetSeason = seasonArg ?? nflCurrentYear - 1;

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n[SH][STATE][SEASON] Season Close Script`);
  console.log(`  Target season : ${targetSeason}`);
  if (poolArg) console.log(`  Pool filter   : ${poolArg}`);
  console.log(`  Dry run       : ${dryRun}`);
  console.log('');

  // Fetch pools for the target season
  let query = supabase
    .from('pools')
    .select('id, name, season, is_active, pool_type, season_scope');

  if (poolArg) {
    query = query.eq('id', poolArg);
  } else {
    query = query.eq('season', targetSeason);
  }

  const { data: pools, error: poolsError } = await query;

  if (poolsError) {
    console.error('[SH][STATE][SEASON] Error fetching pools:', poolsError.message);
    process.exit(1);
  }

  if (!pools || pools.length === 0) {
    console.log(`[SH][STATE][SEASON] No pools found for season ${targetSeason}.`);
    return;
  }

  console.log(`[SH][STATE][SEASON] Found ${pools.length} pool(s) for season ${targetSeason}:\n`);

  const results = {
    closed: [] as string[],
    alreadyClosed: [] as string[],
    winnersComputed: [] as { name: string; winner: string; points: number }[],
    winnersAlreadyExist: [] as string[],
    errors: [] as string[],
  };

  for (const pool of pools) {
    console.log(`  Pool: "${pool.name}" (${pool.id})`);
    console.log(`    is_active : ${pool.is_active}`);

    // 1. Deactivate if still active
    if (pool.is_active) {
      if (dryRun) {
        console.log('    [DRY RUN] Would set is_active = false');
        results.closed.push(pool.name);
      } else {
        const { error } = await supabase
          .from('pools')
          .update({ is_active: false })
          .eq('id', pool.id);

        if (error) {
          console.error(`    ERROR deactivating: ${error.message}`);
          results.errors.push(`${pool.name}: ${error.message}`);
        } else {
          console.log('    ✓ Set is_active = false');
          results.closed.push(pool.name);
        }
      }
    } else {
      console.log('    Already inactive — skipping deactivation');
      results.alreadyClosed.push(pool.name);
    }

    // 2. Season winner — always recomputed, like the Close Season button.
    const { data: existingWinner } = await supabase
      .from('season_winners')
      .select('id, winner_name, total_points')
      .eq('pool_id', pool.id)
      .eq('season', pool.season)
      .maybeSingle();

    const poolSeasonScope = (pool as { season_scope?: number[] }).season_scope ?? [2];

    if (!poolSeasonScope.includes(2)) {
      console.log('    Pool has no regular season in scope — no season winner to compute');
    } else {
      const winner = (await computeSeasonReview(pool.id, pool.season)).seasonWinnerRow;
      if (existingWinner) {
        console.log(`    Stored season winner: ${existingWinner.winner_name} (${existingWinner.total_points} pts)`);
        if (winner && existingWinner.winner_name === winner.winner_name && existingWinner.total_points === winner.total_points) {
          results.winnersAlreadyExist.push(pool.name);
        }
      }

      if (!winner) {
        console.log('    Cannot compute winner — no period has been won yet');
        results.errors.push(`${pool.name}: no scorable picks`);
      } else if (dryRun) {
        console.log(`    [DRY RUN] Would save winner: ${winner.winner_name} (${winner.total_points} pts, ${winner.total_participants} participants, tie=${winner.tie_breaker_used})`);
        results.winnersComputed.push({ name: pool.name, winner: winner.winner_name, points: winner.total_points });
      } else {
        const { error: upsertError } = await supabase
          .from('season_winners')
          .upsert(winner, { onConflict: 'pool_id,season' });

        if (upsertError) {
          console.error(`    ERROR saving winner: ${upsertError.message}`);
          results.errors.push(`${pool.name}: ${upsertError.message}`);
        } else {
          console.log(`    ✓ Winner saved: ${winner.winner_name} | ${winner.total_points} pts | ${winner.total_correct_picks} correct | ${winner.total_participants} participants`);
          results.winnersComputed.push({ name: pool.name, winner: winner.winner_name, points: winner.total_points });
        }
      }
    }

    console.log('');
  }

  // Summary
  console.log('[SH][STATE][SEASON] ── Summary ────────────────────────────');
  console.log(`  Pools newly closed        : ${results.closed.length}`);
  if (results.closed.length) results.closed.forEach(n => console.log(`    - ${n}`));
  console.log(`  Pools already closed      : ${results.alreadyClosed.length}`);
  if (results.alreadyClosed.length) results.alreadyClosed.forEach(n => console.log(`    - ${n}`));
  console.log(`  Winners computed + saved  : ${results.winnersComputed.length}`);
  if (results.winnersComputed.length) results.winnersComputed.forEach(r => console.log(`    - ${r.name} → ${r.winner} (${r.points} pts)`));
  console.log(`  Winners unchanged         : ${results.winnersAlreadyExist.length}`);
  if (results.winnersAlreadyExist.length) results.winnersAlreadyExist.forEach(n => console.log(`    - ${n}`));
  if (results.errors.length) {
    console.log(`  Errors                    : ${results.errors.length}`);
    results.errors.forEach(e => console.log(`    ✗ ${e}`));
  }
  if (dryRun) console.log('\n  [DRY RUN] No changes written to database.');
  console.log('');
  // Exit non-zero on any per-pool failure so automation can't mistake a
  // partial run for success.
  if (results.errors.length > 0) process.exitCode = 1;
}

main().catch(err => {
  console.error('[SH][STATE][SEASON] Fatal error:', err);
  process.exit(1);
});
