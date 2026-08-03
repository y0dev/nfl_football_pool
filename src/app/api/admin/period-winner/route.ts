import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { debugError, getRegularSeasonPeriods } from '@/lib/utils';

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

    // Determine start and end week by periodName — regular-season Q1-Q4 only
    // (playoffs are a separately-numbered season_type, not extra weeks here).
    const period = getRegularSeasonPeriods().find(p => p.name === periodName);
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
        start_week: period.startWeek,
        end_week: period.endWeek,
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
      debugError('Error upserting period winner:', error);
      return NextResponse.json(
        { error: 'Failed to save period winner' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, winner: data });
  } catch (error) {
    debugError('Error in period-winner POST API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


