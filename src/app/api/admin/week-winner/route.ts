import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const poolId = searchParams.get('poolId');
    const week = searchParams.get('week');
    const season = searchParams.get('season');
    const seasonType = searchParams.get('seasonType');

    if (!poolId || !week || !season || !seasonType) {
      return NextResponse.json(
        { error: 'Missing required parameters: poolId, week, season, seasonType' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // Check if winner already exists in weekly_winners table
    const { data: existingWinner, error } = await supabase
      .from('weekly_winners')
      .select('*')
      .eq('pool_id', poolId)
      .eq('week', parseInt(week))
      .eq('season', parseInt(season))
      .eq('season_type', parseInt(seasonType))
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error('Error checking weekly winner:', error);
      return NextResponse.json(
        { error: 'Failed to check weekly winner' },
        { status: 500 }
      );
    }

    if (existingWinner) {
      return NextResponse.json({
        success: true,
        winnerExists: true,
        winner: existingWinner
      });
    } else {
      return NextResponse.json({
        success: true,
        winnerExists: false,
        winner: null
      });
    }

  } catch (error) {
    console.error('Error in week-winner API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      poolId,
      week,
      season,
      seasonType,
      winnerParticipantId,
      winnerName,
      winnerPoints,
      winnerCorrectPicks,
      totalParticipants
    } = body;

    if (!poolId || !week || !season || !seasonType || !winnerName || winnerPoints === undefined || winnerCorrectPicks === undefined) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // Check if winner already exists to avoid duplicates
    const { data: existingWinner, error: checkError } = await supabase
      .from('weekly_winners')
      .select('id')
      .eq('pool_id', poolId)
      .eq('week', parseInt(week))
      .eq('season', parseInt(season))
      .eq('season_type', parseInt(seasonType))
      .single();

    if (existingWinner) {
      return NextResponse.json({
        success: false,
        error: 'Winner already exists for this week'
      }, { status: 409 });
    }

    // Insert new winner
    const { data: newWinner, error: insertError } = await supabase
      .from('weekly_winners')
      .insert({
        pool_id: poolId,
        week: parseInt(week),
        season: parseInt(season),
        season_type: parseInt(seasonType),
        winner_participant_id: winnerParticipantId || null,
        winner_name: winnerName,
        winner_points: parseInt(winnerPoints),
        winner_correct_picks: parseInt(winnerCorrectPicks),
        total_participants: parseInt(totalParticipants || '0'),
        tie_breaker_used: false,
        tie_breaker_question: null,
        tie_breaker_answer: null,
        winner_tie_breaker_answer: null,
        tie_breaker_difference: null
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting weekly winner:', insertError);
      return NextResponse.json(
        { error: 'Failed to insert weekly winner' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Weekly winner added successfully',
      winner: newWinner
    });

  } catch (error) {
    console.error('Error in week-winner POST API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
