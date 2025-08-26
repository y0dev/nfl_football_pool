import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { getOrCalculateWeeklyWinners } from '@/lib/winner-calculator';

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
      // Get or calculate winner for specific week
      const weeklyWinner = await getOrCalculateWeeklyWinners(poolId, parseInt(week), parseInt(season));
      
      if (weeklyWinner) {
        return NextResponse.json({
          success: true,
          weeklyWinners: [weeklyWinner]
        });
      } else {
        return NextResponse.json({
          success: true,
          weeklyWinners: []
        });
      }
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
        console.error('Error fetching weekly winners:', error);
        return NextResponse.json(
          { error: 'Failed to fetch weekly winners' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        weeklyWinners: weeklyWinners || []
      });
    }

  } catch (error) {
    console.error('Error in weekly winners API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
