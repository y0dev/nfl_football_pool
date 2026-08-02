#!/usr/bin/env tsx

/**
 * Close Season Script
 *
 * Marks pools from a past NFL season as completed (is_active = false)
 * and computes + persists season winners for each pool.
 *
 * Season winner is computed directly from picks + game outcomes
 * (confidence points earned across all weeks), which is authoritative
 * even when the scores table is unpopulated.
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

// ── Season winner from picks + games ─────────────────────────────────────────
interface ParticipantTotal {
  participant_id: string;
  participant_name: string;
  total_points: number;
  total_correct_picks: number;
  weeks_won: number;
}

async function computeSeasonWinnerFromPicks(poolId: string, season: number) {
  // 1. Get all final regular-season games for this season. Season winner is
  // always the regular season champion — preseason/playoff games must not
  // blend into the total.
  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('id, winner, week, season_type')
    .eq('season', season)
    .eq('season_type', 2)
    .not('winner', 'is', null);

  if (gamesError || !games || games.length === 0) {
    console.log('    No final games found for season', season);
    return null;
  }

  const gameWinners = new Map(games.map(g => [g.id, g.winner as string]));

  // 2. Get all picks for this pool (join to game via game_id)
  const { data: picks, error: picksError } = await supabase
    .from('picks')
    .select('participant_id, game_id, predicted_winner, confidence_points')
    .eq('pool_id', poolId)
    .in('game_id', [...gameWinners.keys()]);

  if (picksError || !picks || picks.length === 0) {
    console.log('    No picks found for final games in season', season);
    return null;
  }

  // Get participant names separately
  const participantIds = [...new Set(picks.map(p => p.participant_id))];
  const { data: participants } = await supabase
    .from('participants')
    .select('id, name')
    .in('id', participantIds);
  const nameMap = new Map((participants ?? []).map(p => [p.id, p.name as string]));

  // 3. Compute totals per participant
  const totals = new Map<string, ParticipantTotal>();

  for (const pick of picks) {
    const actualWinner = gameWinners.get(pick.game_id);
    const isCorrect = actualWinner &&
      pick.predicted_winner?.toLowerCase() === actualWinner.toLowerCase();
    const points = isCorrect ? (pick.confidence_points ?? 0) : 0;
    const name = nameMap.get(pick.participant_id) ?? 'Unknown';

    const existing = totals.get(pick.participant_id);
    if (existing) {
      existing.total_points += points;
      if (isCorrect) existing.total_correct_picks += 1;
    } else {
      totals.set(pick.participant_id, {
        participant_id: pick.participant_id,
        participant_name: name,
        total_points: points,
        total_correct_picks: isCorrect ? 1 : 0,
        weeks_won: 0,
      });
    }
  }

  if (totals.size === 0) return null;

  // 4. Tally weekly wins
  const { data: weeklyWinners } = await supabase
    .from('weekly_winners')
    .select('winner_participant_id')
    .eq('pool_id', poolId)
    .eq('season', season)
    .eq('season_type', 2);

  for (const w of weeklyWinners ?? []) {
    const p = totals.get(w.winner_participant_id);
    if (p) p.weeks_won += 1;
  }

  // 5. Rank and pick winner
  const sorted = Array.from(totals.values())
    .sort((a, b) => b.total_points - a.total_points || b.total_correct_picks - a.total_correct_picks);

  const maxPoints = sorted[0].total_points;
  const tied = sorted.filter(p => p.total_points === maxPoints);
  const winner = tied[0];

  return {
    pool_id: poolId,
    season,
    winner_participant_id: winner.participant_id,
    winner_name: winner.participant_name,
    total_points: winner.total_points,
    total_correct_picks: winner.total_correct_picks,
    weeks_won: winner.weeks_won,
    tie_breaker_used: tied.length > 1,
    total_participants: sorted.length,
  };
}

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

    // 2. Check for existing season winner
    const { data: existingWinner } = await supabase
      .from('season_winners')
      .select('id, winner_name, total_points')
      .eq('pool_id', pool.id)
      .eq('season', pool.season)
      .single();

    const poolSeasonScope = (pool as { season_scope?: number[] }).season_scope ?? [2];

    if (existingWinner) {
      console.log(`    Season winner already stored: ${existingWinner.winner_name} (${existingWinner.total_points} pts)`);
      results.winnersAlreadyExist.push(pool.name);
    } else if (!poolSeasonScope.includes(2)) {
      console.log('    Pool has no regular season in scope — no season winner to compute');
    } else {
      // 3. Compute from picks + games
      const winner = await computeSeasonWinnerFromPicks(pool.id, pool.season);

      if (!winner) {
        console.log('    Cannot compute winner — no picks matched to final games');
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
  console.log(`  Winners already stored    : ${results.winnersAlreadyExist.length}`);
  if (results.winnersAlreadyExist.length) results.winnersAlreadyExist.forEach(n => console.log(`    - ${n}`));
  if (results.errors.length) {
    console.log(`  Errors                    : ${results.errors.length}`);
    results.errors.forEach(e => console.log(`    ✗ ${e}`));
  }
  if (dryRun) console.log('\n  [DRY RUN] No changes written to database.');
  console.log('');
}

main().catch(err => {
  console.error('[SH][STATE][SEASON] Fatal error:', err);
  process.exit(1);
});
