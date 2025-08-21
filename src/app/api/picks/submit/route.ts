import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { Pick } from '@/types/game';
import { pickStorage } from '@/lib/pick-storage';

export async function POST(request: NextRequest) {
  try {
    const picks: Pick[] = await request.json();
    if (process.env.NODE_ENV === 'development') {
      console.log('Picks:', picks);
    }
    // Validate picks
    if (picks.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No picks provided' },
        { status: 400 }
      );
    }

    // Validate that all picks have a valid participant_id
    const firstPick = picks[0];
    
    if (!firstPick.participant_id || firstPick.participant_id.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Invalid participant ID. Please select a user first.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // Check if participant has already submitted picks for this week
    const { data: existingPicks, error: checkError } = await supabase
      .from('picks')
      .select('id')
      .eq('participant_id', firstPick.participant_id)
      .eq('pool_id', firstPick.pool_id)
      .eq('game_id', firstPick.game_id);
    if (process.env.NODE_ENV === 'development') {
      console.log('Check error:', checkError);
    }
    if (checkError) {
      console.error('Error checking existing picks:', checkError);
      return NextResponse.json(
        { success: false, error: 'Failed to check existing picks' },
        { status: 500 }
      );
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('Existing picks:', existingPicks);
    }

    if (existingPicks && existingPicks.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Picks already submitted for this week' },
        { status: 400 }
      );
    }

    // Check if games are locked
    const gameIds = picks.map(pick => pick.game_id);
    
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, status, kickoff_time, week, season_type')
      .in('id', gameIds);
    if (process.env.NODE_ENV === 'development') {
      console.log('Games:', games);
    }
    if (gamesError) {
      console.error('Error checking games:', gamesError);
      return NextResponse.json(
        { success: false, error: 'Failed to validate games' },
        { status: 500 }
      );
    }

    const now = new Date();
    const lockedGames = games?.filter(game => {
      const kickoffTime = new Date(game.kickoff_time);
      return kickoffTime <= now || game.status !== 'scheduled';
    });

    if (lockedGames && lockedGames.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Some games are locked and cannot be picked' },
        { status: 400 }
      );
    }

    // Validate confidence points
    const confidencePoints = picks.map(pick => pick.confidence_points);
    
    const uniquePoints = new Set(confidencePoints);
    if (uniquePoints.size !== confidencePoints.length) {
      return NextResponse.json(
        { success: false, error: 'Confidence points must be unique' },
        { status: 400 }
      );
    }

    const sortedPoints = confidencePoints.sort((a, b) => a - b);
    const expectedPoints = Array.from({ length: picks.length }, (_, i) => i + 1);
    
    if (JSON.stringify(sortedPoints) !== JSON.stringify(expectedPoints)) {
      return NextResponse.json(
        { success: false, error: 'Confidence points must be sequential from 1 to number of games' },
        { status: 400 }
      );
    }

    // Prepare picks for database insertion with additional metadata
    const picksToInsert = picks.map(pick => ({
      ...pick,
      created_at: new Date().toISOString()
    }));

    // Insert picks
    const { data, error } = await supabase
      .from('picks')
      .insert(picksToInsert)
      .select();

    if (error) {
      console.error('Error submitting picks:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to submit picks to database' },
        { status: 500 }
      );
    }

    // Delete picks from localStorage
    pickStorage.clearPicks();

    // Log the submission
    const week = games?.[0]?.week || 'unknown';
    await supabase
      .from('audit_logs')
      .insert({
        action: 'submit_picks',
        admin_id: null, // No admin involved in participant pick submission
        entity: 'picks',
        entity_id: firstPick.pool_id,
        details: { 
          participant_id: firstPick.participant_id,
          pool_id: firstPick.pool_id,
          week: week,
          picks_count: picks.length
        }
      });

    return NextResponse.json({
      success: true,
      data: data
    });

  } catch (error) {
    console.error('Error submitting picks:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
