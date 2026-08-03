import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { debugError, getRegularSeasonPeriods } from '@/lib/utils';

// Backs the period selector on the public leaderboard's Period tab. A period
// is "available" once it has started (not only once it's fully complete) —
// the period-leaderboard endpoint already computes live partial standings
// for an in-progress period, same as the Weekly tab does for the current week.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const poolId = searchParams.get('poolId');
    const season = searchParams.get('season');
    const currentWeekParam = searchParams.get('currentWeek');
    const currentSeasonTypeParam = searchParams.get('currentSeasonType');

    if (!poolId || !season) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    let currentWeek = currentWeekParam ? parseInt(currentWeekParam) : null;
    let currentSeasonType = currentSeasonTypeParam ? parseInt(currentSeasonTypeParam) : null;

    // Caller (the leaderboard page) already knows the pool's current
    // week/season type via loadCurrentWeek() — only fall back to inferring
    // it from the latest game row if that wasn't passed.
    if (currentWeek === null || currentSeasonType === null) {
      const { data: currentGame, error: gameError } = await supabase
        .from('games')
        .select('week, season_type')
        .eq('season', parseInt(season))
        .order('week', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (gameError) {
        return NextResponse.json(
          { success: false, error: 'Failed to get current week' },
          { status: 500 }
        );
      }

      currentWeek = currentGame?.week ?? 1;
      currentSeasonType = currentGame?.season_type ?? 2;
    }

    // Q1-Q4 are a regular-season construct — playoffs get no period selector.
    const periods = getRegularSeasonPeriods();

    const availablePeriods = currentSeasonType === 2
      ? periods.filter(period => currentWeek! >= period.startWeek)
      : periods; // once in playoffs, the full regular season has passed

    // Check which periods have official winners recorded (informational only
    // — a period without one yet still shows live/partial standings).
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

    const periodsWithStatus = availablePeriods.map(period => ({
      ...period,
      isCalculated: calculatedPeriods.has(period.name),
      isComplete: currentSeasonType !== 2 || currentWeek! > period.endWeek,
      isCurrent: currentSeasonType === 2 && currentWeek! >= period.startWeek && currentWeek! <= period.endWeek,
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
    debugError('Error fetching available periods:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
