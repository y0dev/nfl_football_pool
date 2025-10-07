import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      poolId,
      season,
      periodName,
      winnerParticipantId,
      winnerName,
      periodPoints,
      periodCorrectPicks,
      totalParticipants
    } = body;

    if (!poolId || !season || !periodName || !winnerName || periodPoints === undefined) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // Determine start and end week by periodName
    const periods: Record<string, { start: number; end: number }> = {
      Q1: { start: 1, end: 4 },
      Q2: { start: 5, end: 8 },
      Q3: { start: 9, end: 12 },
      Q4: { start: 13, end: 16 },
      Playoffs: { start: 17, end: 20 }
    };

    const period = periods[periodName];
    if (!period) {
      return NextResponse.json(
        { error: 'Invalid period name' },
        { status: 400 }
      );
    }

    // Upsert period winner
    const { data, error } = await supabase
      .from('period_winners')
      .upsert({
        pool_id: poolId,
        season: parseInt(String(season)),
        period_name: periodName,
        start_week: period.start,
        end_week: period.end,
        winner_participant_id: winnerParticipantId || null,
        winner_name: winnerName,
        period_points: parseInt(String(periodPoints)),
        period_correct_picks: parseInt(String(periodCorrectPicks || 0)),
        weeks_won: 0,
        tie_breaker_used: false,
        tie_breaker_question: null,
        tie_breaker_answer: null,
        winner_tie_breaker_answer: null,
        tie_breaker_difference: null,
        total_participants: parseInt(String(totalParticipants || 0))
      }, { onConflict: 'pool_id,season,period_name' })
      .select()
      .single();

    if (error) {
      console.error('Error upserting period winner:', error);
      return NextResponse.json(
        { error: 'Failed to save period winner' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, winner: data });
  } catch (error) {
    console.error('Error in period-winner POST API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


