import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const poolId = searchParams.get('poolId');
    const season = searchParams.get('season');

    if (!poolId || !season) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // Get current week from games
    const { data: currentGame, error: gameError } = await supabase
      .from('games')
      .select('week, season_type')
      .eq('season', parseInt(season))
      .order('week', { ascending: false })
      .limit(1)
      .single();

    if (gameError) {
      return NextResponse.json(
        { success: false, error: 'Failed to get current week' },
        { status: 500 }
      );
    }

    const currentWeek = currentGame?.week || 1;
    const currentSeasonType = currentGame?.season_type || 2;

    // Define periods
    const periods = [
      { name: 'Period 1', weeks: [1, 2, 3, 4], endWeek: 4 },
      { name: 'Period 2', weeks: [5, 6, 7, 8, 9], endWeek: 9 },
      { name: 'Period 3', weeks: [10, 11, 12, 13, 14], endWeek: 14 },
      { name: 'Period 4', weeks: [15, 16, 17, 18], endWeek: 18 }
    ];

    // Filter periods that have passed
    const availablePeriods = periods.filter(period => {
      // For regular season, check if the period has ended
      if (currentSeasonType === 2) {
        return currentWeek >= period.endWeek;
      }
      // For playoffs, all regular season periods are available
      return true;
    });

    // Check which periods have winners calculated
    const { data: periodWinners, error: winnersError } = await supabase
      .from('period_winners')
      .select('period_name')
      .eq('pool_id', poolId)
      .eq('season', parseInt(season));

    if (winnersError) {
      return NextResponse.json(
        { success: false, error: 'Failed to check period winners' },
        { status: 500 }
      );
    }

    const calculatedPeriods = new Set(periodWinners?.map(p => p.period_name) || []);

    // Add status to each period
    const periodsWithStatus = availablePeriods.map(period => ({
      ...period,
      isCalculated: calculatedPeriods.has(period.name),
      isCurrent: currentWeek >= period.weeks[0] && currentWeek <= period.endWeek && currentSeasonType === 2
    }));

    return NextResponse.json({
      success: true,
      data: {
        periods: periodsWithStatus,
        currentWeek,
        currentSeasonType
      }
    });

  } catch (error) {
    console.error('Error fetching available periods:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
