import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { Pick } from '@/types/game';
import { pickStorage } from '@/lib/pick-storage';
import { debugLog, DAYS_BEFORE_GAME } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const { picks, mondayNightScore }: { picks: Pick[], mondayNightScore?: number | null } = await request.json();
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

    // Get game IDs for validation
    const gameIds = picks.map(pick => pick.game_id);
    
    // Check if participant has already submitted picks for this week
    const { data: existingPicks, error: checkError } = await supabase
      .from('picks')
      .select('id')
      .eq('participant_id', firstPick.participant_id)
      .eq('pool_id', firstPick.pool_id)
      .in('game_id', gameIds); // Check all games in the week
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
    
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, status, kickoff_time, week, season, season_type')
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
    
    // Week is locked if:
    // 1. First game is more than DAYS_BEFORE_GAME days away (too early to submit)
    // 2. First game has already started
    // 3. First game status is not 'scheduled' (finished, in progress, etc.)
    const firstGame = games?.[0];
    let weekIsLocked = false;
    let daysToKickoff = 0;
    let firstGameKickoff: Date | null = null;
    
    if (firstGame) {
      firstGameKickoff = new Date(firstGame.kickoff_time);
      daysToKickoff = (firstGameKickoff.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      
      // Week is locked if:
      // - More than DAYS_BEFORE_GAME days before kickoff (too early to submit)
      // - Game has already started (past kickoff time)
      // - Game status is not 'scheduled' (finished, in progress, etc.)
      weekIsLocked = daysToKickoff > DAYS_BEFORE_GAME || 
                     firstGameKickoff <= now || 
                     firstGame.status.toLowerCase() !== 'scheduled';
      
      debugLog('Week lock check:', {
        firstGameId: firstGame.id,
        kickoffTime: firstGameKickoff.toISOString(),
        currentTime: now.toISOString(),
        daysToKickoff: daysToKickoff.toFixed(2),
        daysBeforeGame: DAYS_BEFORE_GAME,
        weekIsLocked,
        gameStatus: firstGame.status,
        lockReason: daysToKickoff > DAYS_BEFORE_GAME ? 'Too early to submit' : 
                   firstGameKickoff <= now ? 'Game started' : 
                   firstGame.status.toLowerCase() !== 'scheduled' ? 'Game not scheduled' : 'Unknown'
      });
    }

    if (weekIsLocked) {
      let errorMessage = 'Week is locked - ';
      if (daysToKickoff > DAYS_BEFORE_GAME) {
        errorMessage += `picks can only be submitted within ${DAYS_BEFORE_GAME} days of the first game (currently ${daysToKickoff.toFixed(1)} days away)`;
      } else if (firstGameKickoff && firstGameKickoff <= now) {
        errorMessage += 'games have already started';
      } else if (firstGame && firstGame.status !== 'scheduled') {
        errorMessage += `game status is '${firstGame.status.toLowerCase()}' (not scheduled)`;
      }
      
      return NextResponse.json(
        { success: false, error: errorMessage },
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

    // Save Monday night score to tie_breakers table if provided
    if (mondayNightScore !== null && mondayNightScore !== undefined) {
      const week = games?.[0]?.week || 1;
      const season = games?.[0]?.season || new Date().getFullYear();
      const seasonType = games?.[0]?.season_type || 2;
      
      // Get full game data for Monday night game identification
      const { data: fullGames, error: fullGamesError } = await supabase
        .from('games')
        .select('*')
        .eq('week', week)
        .eq('season', season)
        .eq('season_type', seasonType);

      if (fullGamesError) {
        console.error('Error loading full games for Monday night identification:', fullGamesError);
      }

      // Import the Monday night utility to identify the correct game
      const { getMondayNightGame } = await import('@/lib/monday-night-utils');
      const mondayNightGame = getMondayNightGame(fullGames || []);
      
      const { error: tieBreakerError } = await supabase
        .from('tie_breakers')
        .upsert({
          participant_id: firstPick.participant_id,
          pool_id: firstPick.pool_id,
          week: week,
          season: season,
          season_type: seasonType,
          answer: mondayNightScore,
          game_id: mondayNightGame?.id || null
        }, {
          onConflict: 'participant_id,pool_id,week,season,season_type'
        });

      if (tieBreakerError) {
        console.error('Error saving Monday night score:', tieBreakerError);
        // Don't fail the entire submission for tie breaker errors
      }
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
