import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { getOrCalculatePeriodWinners } from '@/lib/winner-calculator';

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

    // Define the periods for the season
    const periods = [
      { name: 'Q1', startWeek: 1, endWeek: 4 },
      { name: 'Q2', startWeek: 5, endWeek: 8 },
      { name: 'Q3', startWeek: 9, endWeek: 12 },
      { name: 'Q4', startWeek: 13, endWeek: 16 },
      { name: 'Playoffs', startWeek: 17, endWeek: 20 }
    ];

    const periodWinners = [];

    // Get or calculate winners for each period
    for (const period of periods) {
      const periodWinner = await getOrCalculatePeriodWinners(
        poolId, 
        parseInt(season), 
        period.name, 
        period.startWeek, 
        period.endWeek
      );
      
      if (periodWinner) {
        periodWinners.push(periodWinner);
      }
    }

    return NextResponse.json({
      success: true,
      periodWinners
    });

  } catch (error) {
    console.error('Error in period winners API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { season, generateAllPools } = body;

    if (!season) {
      return NextResponse.json(
        { error: 'Season is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // Get all active pools for the season
    const { data: pools, error: poolsError } = await supabase
      .from('pools')
      .select('id, name')
      .eq('season', parseInt(season))
      .eq('is_active', true);

    if (poolsError) {
      console.error('Error fetching pools:', poolsError);
      return NextResponse.json(
        { error: 'Failed to fetch pools' },
        { status: 500 }
      );
    }

    if (!pools || pools.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active pools found for the season',
        poolsProcessed: 0
      });
    }

    // Define the periods for the season
    const periods = [
      { name: 'Q1', startWeek: 1, endWeek: 4 },
      { name: 'Q2', startWeek: 5, endWeek: 8 },
      { name: 'Q3', startWeek: 9, endWeek: 12 },
      { name: 'Q4', startWeek: 13, endWeek: 16 },
      { name: 'Playoffs', startWeek: 17, endWeek: 20 }
    ];

    let poolsProcessed = 0;
    const results = [];
    const poolErrors = [];

    // Process each pool
    for (const pool of pools) {
      try {
        console.log(`Processing period winners for pool: ${pool.name} (${pool.id})`);
        let poolWinners = 0;
        let poolErrors = 0;
        
        // Get or calculate winners for each period
        for (const period of periods) {
          try {
            const periodWinner = await getOrCalculatePeriodWinners(
              pool.id, 
              parseInt(season), 
              period.name, 
              period.startWeek, 
              period.endWeek
            );
            
            if (periodWinner) {
              results.push({
                poolId: pool.id,
                poolName: pool.name,
                period: period.name,
                winner: periodWinner.winner_name,
                points: periodWinner.period_points,
                correctPicks: periodWinner.period_correct_picks,
                weeksWon: periodWinner.weeks_won,
                tieBreakerUsed: periodWinner.tie_breaker_used,
                tieBreakerAnswer: periodWinner.winner_tie_breaker_answer,
                tieBreakerDifference: periodWinner.tie_breaker_difference,
                totalParticipants: periodWinner.total_participants,
                status: 'generated'
              });
              poolWinners++;
            } else {
              results.push({
                poolId: pool.id,
                poolName: pool.name,
                period: period.name,
                winner: null,
                status: 'no_winner',
                reason: 'Period not completed or no participants'
              });
              poolErrors++;
            }
          } catch (periodError) {
            console.error(`Error processing period ${period.name} for pool ${pool.name}:`, periodError);
            results.push({
              poolId: pool.id,
              poolName: pool.name,
              period: period.name,
              winner: null,
              status: 'error',
              reason: periodError instanceof Error ? periodError.message : 'Unknown error'
            });
            poolErrors++;
          }
        }
        
        poolsProcessed++;
        console.log(`Pool ${pool.name}: ${poolWinners} winners generated, ${poolErrors} issues`);
      } catch (error) {
        console.error(`Error processing pool ${pool.name}:`, error);
        poolErrors.push({
          poolId: pool.id,
          poolName: pool.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        // Continue with other pools even if one fails
      }
    }

    // Calculate summary statistics
    const generatedWinners = results.filter(r => r.status === 'generated').length;
    const noWinners = results.filter(r => r.status === 'no_winner').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    const poolsWithWinners = new Set(results.filter(r => r.status === 'generated').map(r => r.poolName)).size;

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${poolsProcessed} pools`,
      poolsProcessed,
      poolsWithWinners,
      generatedWinners,
      noWinners,
      errors: errorCount,
      results
    });

  } catch (error) {
    console.error('Error in period winners generation API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
