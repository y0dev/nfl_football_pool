import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { computeSeasonReview } from '@/lib/season-review';
import { debugLog, debugError } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const poolId = searchParams.get('poolId');
    const season = searchParams.get('season');

    if (!poolId || !season) {
      return NextResponse.json(
        { error: 'Pool ID and season are required' },
        { status: 400 }
      );
    }

    // Q1-Q4 periods are a regular-season construct — a pool that doesn't
    // include regular season in its scope has no periods to report.
    const supabase = getSupabaseServiceClient();
    const { data: pool } = await supabase
      .from('pools')
      .select('season_scope')
      .eq('id', poolId)
      .single();

    if (pool && !(pool.season_scope ?? [2]).includes(2)) {
      return NextResponse.json({ success: true, periodWinners: [] });
    }

    // Delegates to the same centralized computation the Season Review tab
    // uses, rather than the old winner-calculator.ts implementation (which
    // cached results that never invalidated).
    const review = await computeSeasonReview(poolId, parseInt(season));

    return NextResponse.json({
      success: true,
      periodWinners: review.quarterlyWinners,
    });

  } catch (error) {
    debugError('Error in period winners API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { season, poolId: singlePoolId, quarter } = body;

    if (!season) {
      return NextResponse.json(
        { error: 'Season is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // Get target pools — a single pool if poolId was given, else every
    // active pool for the season.
    let poolQuery = supabase
      .from('pools')
      .select('id, name, season_scope')
      .eq('season', parseInt(season));
    poolQuery = singlePoolId ? poolQuery.eq('id', singlePoolId) : poolQuery.eq('is_active', true);

    const { data: allPools, error: poolsError } = await poolQuery;

    if (poolsError) {
      debugError('Error fetching pools:', poolsError);
      return NextResponse.json(
        { error: 'Failed to fetch pools' },
        { status: 500 }
      );
    }

    // Q1-Q4 periods are a regular-season construct — skip pools that don't
    // include regular season (season_type 2) in scope (e.g. preseason-only),
    // since generating a "Q1" winner from their weeks 1-4 preseason data
    // would be meaningless and mislabel it as a regular-season quarter.
    const pools = (allPools ?? []).filter(p => (p.season_scope ?? [2]).includes(2));
    const skippedPools = (allPools ?? []).filter(p => !(p.season_scope ?? [2]).includes(2));

    if (!pools || pools.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active pools with regular season in scope for the season',
        poolsProcessed: 0,
        poolsSkipped: skippedPools.length,
      });
    }

    let poolsProcessed = 0;
    const results: Array<Record<string, unknown>> = [];
    const poolErrors: Array<{ poolId: string; poolName: string; error: string }> = [];

    for (const pool of pools) {
      try {
        debugLog(`Computing period winners for pool: ${pool.name} (${pool.id})`);
        const review = await computeSeasonReview(pool.id, parseInt(season));
        const periods = quarter && quarter !== 'all'
          ? review.quarterlyWinners.filter(q => q.period_name === quarter)
          : review.quarterlyWinners;

        for (const winner of periods) {
          results.push({
            poolId: pool.id,
            poolName: pool.name,
            period: winner.period_name,
            winner: winner.winner_name,
            points: winner.period_points,
            correctPicks: winner.period_correct_picks,
            status: 'computed',
          });
        }
        poolsProcessed++;
      } catch (error) {
        debugError(`Error processing pool ${pool.name}:`, error);
        poolErrors.push({
          poolId: pool.id,
          poolName: pool.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${poolsProcessed} pools`,
      poolsProcessed,
      poolsSkipped: skippedPools.length,
      results,
      errors: poolErrors,
    });

  } catch (error) {
    debugError('Error in period winners generation API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
