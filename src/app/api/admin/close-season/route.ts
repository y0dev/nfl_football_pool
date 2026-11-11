import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { computeSeasonReview } from '@/lib/season-review';
import { debugError } from '@/lib/utils';

/**
 * Season winner for the close-season action: the season_winners row that
 * computeSeasonReview() produces, which is the same row the
 * determine-weekly-winners cron and scripts/close-season.ts write. Always
 * recomputed, never read back from the table.
 */
async function computeSeasonWinner(poolId: string, season: number) {
  const review = await computeSeasonReview(poolId, season);
  return review.seasonWinnerRow;
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
    const notes: string[] = [];
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
          // Nothing scorable yet (no picks, or no period won). Not a failed
          // write, so it doesn't fail the request.
          notes.push(`${pool.name}: no score data to compute winner`);
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

    // A failed deactivate or winner write must not read as success — the
    // Pool Settings UI shows "winner recorded" whenever success is true.
    return NextResponse.json({
      success: errors.length === 0,
      error: errors.length > 0 ? errors.join('; ') : undefined,
      closed,
      alreadyClosed,
      winnersComputed,
      winnersAlreadyExist,
      notes,
      errors,
      totalProcessed: pools.length,
    }, { status: errors.length === 0 ? 200 : 500 });
  } catch (error) {
    debugError('close-season error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
