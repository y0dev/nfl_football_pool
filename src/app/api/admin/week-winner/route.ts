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
      .maybeSingle(); // Use maybeSingle() instead of single() to avoid errors when no row exists

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 is "no rows returned" which is expected when no winner exists
      console.error('Error checking for existing winner:', checkError);
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to check for existing winner',
          details: checkError.message 
        },
        { status: 500 }
      );
    }

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
      // Check if this is a duplicate key error (code 23505)
      // This can happen if the unique constraint doesn't include season_type
      // In that case, try to update the existing record instead
      if (insertError.code === '23505') {
        console.log('Duplicate key error detected, attempting to update existing winner...');
        
        // Try to update the existing record
        const { data: updatedWinner, error: updateError } = await supabase
          .from('weekly_winners')
          .update({
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
          .eq('pool_id', poolId)
          .eq('week', parseInt(week))
          .eq('season', parseInt(season))
          .select()
          .single();
        
        if (updateError) {
          console.error('Error updating weekly winner:', updateError);
          return NextResponse.json(
            { 
              success: false,
              error: 'Failed to update weekly winner',
              details: updateError.message,
              code: updateError.code
            },
            { status: 500 }
          );
        }
        
        return NextResponse.json({
          success: true,
          message: 'Weekly winner updated successfully',
          winner: updatedWinner
        });
      }
      
      console.error('Error inserting weekly winner:', insertError);
      console.error('Insert data:', {
        pool_id: poolId,
        week: parseInt(week),
        season: parseInt(season),
        season_type: parseInt(seasonType),
        winner_name: winnerName,
        winner_points: parseInt(winnerPoints),
        winner_correct_picks: parseInt(winnerCorrectPicks)
      });
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to insert weekly winner',
          details: insertError.message,
          code: insertError.code
        },
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
