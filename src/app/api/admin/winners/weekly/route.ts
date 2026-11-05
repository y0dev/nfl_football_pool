import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { computeSeasonReview, getTiedWinnerName } from '@/lib/season-review';
import { debugError } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const poolId = searchParams.get('poolId');
    const season = searchParams.get('season');
    const week = searchParams.get('week'); // Optional: specific week

    if (!poolId || !season) {
      return NextResponse.json(
        { error: 'Pool ID and season are required' },
        { status: 400 }
      );
    }

    if (week) {
      // Delegates to the same centralized computation the Season Review tab
      // uses, rather than the old winner-calculator.ts implementation (which
      // cached results that never invalidated). A tied week comes back as
      // one entry listing every co-winner.
      const review = await computeSeasonReview(poolId, parseInt(season));
      const weeklyWinner = review.weeklyWinners.find(w => w.week === parseInt(week));

      return NextResponse.json({
        success: true,
        weeklyWinners: weeklyWinner ? [weeklyWinner] : []
      });
    } else {
      // Get all weekly winners for the season
      const supabase = getSupabaseServiceClient();
      
      const { data: weeklyWinners, error } = await supabase
        .from('weekly_winners')
        .select(`
          *,
          pools!inner(name)
        `)
        .eq('pool_id', poolId)
        .eq('season', parseInt(season))
        .order('week', { ascending: true });

      if (error) {
        debugError('Error fetching weekly winners:', error);
        return NextResponse.json(
          { error: 'Failed to fetch weekly winners' },
          { status: 500 }
        );
      }

      // One stored row per week — fill in co-winners on tied regular-season weeks.
      const review = await computeSeasonReview(poolId, parseInt(season)).catch(error => {
        debugError('Error checking for tied week winners:', error);
        return null;
      });

      return NextResponse.json({
        success: true,
        weeklyWinners: (weeklyWinners || []).map(row => {
          const tiedName = review && row.season_type === 2 ? getTiedWinnerName(review, row.week) : null;
          return tiedName ? { ...row, winner_name: tiedName } : row;
        })
      });
    }

  } catch (error) {
    debugError('Error in weekly winners API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
