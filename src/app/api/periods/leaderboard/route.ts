import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { PERIOD_WEEKS } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const poolId = searchParams.get('poolId');
    const season = searchParams.get('season');
    const periodName = searchParams.get('periodName');

    if (!poolId || !season || !periodName) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // Get period winner
    const { data: periodWinner, error: periodError } = await supabase
      .from('period_winners')
      .select(`
        *,
        participants!inner(name, email)
      `)
      .eq('pool_id', poolId)
      .eq('season', parseInt(season))
      .eq('period_name', periodName)
      .single();

    if (periodError && periodError.code !== 'PGRST116') {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch period winner' },
        { status: 500 }
      );
    }

    // Get weekly winners for this period
    const periodWeeks = getPeriodWeeks(periodName);
    const { data: weeklyWinners, error: weeklyError } = await supabase
      .from('weekly_winners')
      .select(`
        *,
        participants!inner(name, email)
      `)
      .eq('pool_id', poolId)
      .eq('season', parseInt(season))
      .in('week', periodWeeks)
      .order('week', { ascending: true });

    if (weeklyError) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch weekly winners' },
        { status: 500 }
      );
    }

    // Get participant standings for this period
    const { data: standings, error: standingsError } = await supabase
      .from('scores')
      .select(`
        participant_id,
        points,
        correct_picks,
        total_picks,
        week,
        participants!inner(name, email)
      `)
      .eq('pool_id', poolId)
      .eq('season', parseInt(season))
      .in('week', periodWeeks)
      .order('participant_id', { ascending: true })
      .order('week', { ascending: true });

    if (standingsError) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch standings' },
        { status: 500 }
      );
    }

    // Calculate period totals for each participant
    const participantTotals = new Map();
    
    standings?.forEach(score => {
      const participantId = score.participant_id;
      const participant = score.participants as any;
      
      if (!participantTotals.has(participantId)) {
        participantTotals.set(participantId, {
          participant_id: participantId,
          name: participant.name,
          email: participant.email,
          total_points: 0,
          total_correct: 0,
          total_picks: 0,
          weeks_won: 0,
          weekly_scores: []
        });
      }
      
      const totals = participantTotals.get(participantId);
      totals.total_points += score.points || 0;
      totals.total_correct += score.correct_picks || 0;
      totals.total_picks += score.total_picks || 0;
      totals.weekly_scores.push({
        week: score.week,
        points: score.points || 0,
        correct: score.correct_picks || 0,
        total: score.total_picks || 0
      });
    });

    // Count weeks won for each participant
    weeklyWinners?.forEach(winner => {
      const participantId = winner.winner_participant_id;
      if (participantTotals.has(participantId)) {
        participantTotals.get(participantId).weeks_won += 1;
      }
    });

    // Convert to array and sort by total points
    const leaderboard = Array.from(participantTotals.values())
      .sort((a, b) => b.total_points - a.total_points);

    return NextResponse.json({
      success: true,
      data: {
        periodWinner: periodWinner ? {
          ...periodWinner,
          winner_name: (periodWinner.participants as any)?.name || 'Unknown'
        } : null,
        weeklyWinners: weeklyWinners?.map(winner => ({
          ...winner,
          winner_name: (winner.participants as any)?.name || 'Unknown'
        })) || [],
        leaderboard,
        periodInfo: {
          name: periodName,
          weeks: periodWeeks,
          totalWeeks: periodWeeks.length
        }
      }
    });

  } catch (error) {
    console.error('Error fetching period leaderboard:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function getPeriodWeeks(periodName: string): number[] {
  switch (periodName) {
    case 'Period 1':
      return [1, 2, 3, 4];
    case 'Period 2':
      return [5, 6, 7, 8, 9];
    case 'Period 3':
      return [10, 11, 12, 13, 14];
    case 'Period 4':
      return [15, 16, 17, 18];
    default:
      return [];
  }
}
