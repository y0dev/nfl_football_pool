import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { computeSeasonReview } from '@/lib/season-review';
import { debugError } from '@/lib/utils';

/**
 * Season winner for the close-season action — delegates to the same
 * centralized computeSeasonReview() used by the Season Review tab, rather
 * than maintaining a separate points-primary calculation here. This used
 * to implement its own independent algorithm (highest total points, ties
 * broken by weeks won), which silently disagreed with the periods-won rule
 * the Season Review tab uses — a commissioner closing the season here could
 * see a different "winner" than what Season Review reports for the same
 * pool. periods_won isn't part of season_winners' schema, so it's omitted
 * from the persisted row; the source of truth for that number is always a
 * fresh computeSeasonReview() call, not this cached table.
 */
async function computeSeasonWinner(poolId: string, season: number) {
  const review = await computeSeasonReview(poolId, season);
  if (!review.seasonWinner) return null;
  const w = review.seasonWinner;
  return {
    pool_id: poolId,
    season,
    winner_participant_id: w.winner_participant_id,
    winner_name: w.winner_name,
    total_points: w.total_points,
    total_correct_picks: w.total_correct_picks,
    weeks_won: w.weeks_won,
    tie_breaker_used: w.tie_breaker_used,
    total_participants: review.participantStats.length,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { season, poolId } = body as { season?: number; poolId?: string };

    if (!season && !poolId) {
      return NextResponse.json(
        { success: false, error: 'Provide season or poolId' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // Fetch target pools
    let query = supabase
      .from('pools')
      .select('id, name, season, is_active, pool_type, season_scope');

    if (poolId) {
      query = query.eq('id', poolId);
    } else {
      query = query.eq('season', season!);
    }

    const { data: pools, error: poolsError } = await query;

    if (poolsError) throw poolsError;
    if (!pools || pools.length === 0) {
      return NextResponse.json({ success: true, closed: [], winnersComputed: [], message: 'No pools found' });
    }

    const closed: string[] = [];
    const alreadyClosed: string[] = [];
    const winnersComputed: string[] = [];
    const winnersAlreadyExist: string[] = [];
    const errors: string[] = [];

    for (const pool of pools) {
      // 1. Deactivate
      if (pool.is_active) {
        const { error } = await supabase
          .from('pools')
          .update({ is_active: false })
          .eq('id', pool.id);

        if (error) {
          errors.push(`${pool.name}: failed to deactivate — ${error.message}`);
        } else {
          closed.push(pool.name);
        }
      } else {
        alreadyClosed.push(pool.name);
      }

      // 2. Season winner — always recompute and overwrite rather than
      // trusting a possibly-stale cached row. This is an explicit,
      // human-triggered action (not a hot path), so recomputing every time
      // costs nothing and guarantees the closed-season result reflects
      // current data instead of whatever was cached the first time this
      // pool was closed (which could predate a scoring fix or simply be
      // wrong test data from before the season was actually complete).
      const poolSeasonScope = (pool as { season_scope?: number[] }).season_scope ?? [2];

      if (!poolSeasonScope.includes(2)) {
        // Season winner is a regular-season concept — nothing to compute for
        // a pool that doesn't include regular season in scope.
      } else {
        const winner = await computeSeasonWinner(pool.id, pool.season);
        if (!winner) {
          errors.push(`${pool.name}: no score data to compute winner`);
        } else {
          const { error: upsertError } = await supabase
            .from('season_winners')
            .upsert(winner, { onConflict: 'pool_id,season' });

          if (upsertError) {
            errors.push(`${pool.name}: failed to save winner — ${upsertError.message}`);
          } else {
            winnersComputed.push(`${pool.name} → ${winner.winner_name} (${winner.total_points} pts)`);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      closed,
      alreadyClosed,
      winnersComputed,
      winnersAlreadyExist,
      errors,
      totalProcessed: pools.length,
    });
  } catch (error) {
    debugError('close-season error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
