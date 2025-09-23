import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { calculateWeeklyWinners } from '@/lib/winner-calculator';
import { PERIOD_WEEKS, SUPER_BOWL_SEASON_TYPE } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const { 
      poolId, 
      week, 
      season 
    }: { 
      poolId?: string;
      week: number;
      season: number;
    } = await request.json();

    // Validate required fields
    if (!week || !season) {
      return NextResponse.json(
        { success: false, error: 'Week and season are required' },
        { status: 400 }
      );
    }

    // Validate that this is a period week or Super Bowl
    const isPeriodWeek = PERIOD_WEEKS.includes(week as typeof PERIOD_WEEKS[number]);
    
    // For Super Bowl, we need to check season_type
    let isSuperBowl = false;
    if (!isPeriodWeek) {
      const supabase = getSupabaseServiceClient();
      const { data: games } = await supabase
        .from('games')
        .select('season_type')
        .eq('week', week)
        .eq('season', season)
        .limit(1)
        .single();
      
      isSuperBowl = games?.season_type === SUPER_BOWL_SEASON_TYPE;
    }
    
    if (!isPeriodWeek && !isSuperBowl) {
      return NextResponse.json(
        { success: false, error: 'Tie breakers can only be calculated for period weeks or Super Bowl' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // Check if all games for this week are finished
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('status')
      .eq('week', week)
      .eq('season', season);

    if (gamesError) {
      return NextResponse.json(
        { success: false, error: 'Failed to check games status' },
        { status: 500 }
      );
    }

    if (!games || games.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No games found for this week' },
        { status: 404 }
      );
    }

    // Check if all games are finished
    const allGamesFinished = games.every(game => 
      game.status === 'final' || game.status === 'post' || game.status === 'cancelled'
    );

    if (!allGamesFinished) {
      return NextResponse.json(
        { success: false, error: 'Not all games have finished for this week' },
        { status: 400 }
      );
    }

    let poolsToProcess = [];

    if (poolId) {
      // Calculate for specific pool
      poolsToProcess = [{ id: poolId }];
    } else {
      // Calculate for all pools
      const { data: pools, error: poolsError } = await supabase
        .from('pools')
        .select('id, name')
        .eq('season', season)
        .eq('is_active', true);

      if (poolsError) {
        return NextResponse.json(
          { success: false, error: 'Failed to fetch pools' },
          { status: 500 }
        );
      }

      poolsToProcess = pools || [];
    }

    const results = [];
    const errors = [];

    // Calculate tie breakers for each pool
    for (const pool of poolsToProcess) {
      try {
        const winner = await calculateWeeklyWinners(pool.id, week, season);
        if (winner) {
          results.push({
            poolId: pool.id,
            poolName: pool.name,
            winner: winner.winner_name,
            points: winner.winner_points,
            tieBreakerUsed: winner.tie_breaker_used
          });
        } else {
          errors.push({
            poolId: pool.id,
            poolName: pool.name,
            error: 'No winner calculated'
          });
        }
      } catch (error) {
        console.error(`Error calculating tie breakers for pool ${pool.id}:`, error);
        errors.push({
          poolId: pool.id,
          poolName: pool.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Tie breakers calculated for ${results.length} pools`,
      results,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error calculating tie breakers:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
