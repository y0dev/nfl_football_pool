import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { Pick } from '@/types/game';
import { pickStorage } from '@/lib/pick-storage';
import { debugLog, DAYS_BEFORE_GAME, isDummyData, simulatePicksEnabled, debugError} from '@/lib/utils';
import { computeWeekUnlockStatus } from '@/lib/week-unlock-status';
import { checkPoolAccessFromRequest } from '@/lib/pool-access';

export async function POST(request: NextRequest) {
  try {

    if (isDummyData() || simulatePicksEnabled()) {
      return NextResponse.json({
        success: true,
        message: 'Picks submitted successfully (simulated — not written to the database)'
      });
    }

    const { picks, mondayNightScore }: { picks: Pick[], mondayNightScore?: number | null } = await request.json();
    debugLog('Picks:', picks);
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

    if (!firstPick.pool_id) {
      return NextResponse.json(
        { success: false, error: 'Invalid pool ID.' },
        { status: 400 }
      );
    }

    const access = await checkPoolAccessFromRequest(firstPick.pool_id, request);
    if (!access.allowed) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
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
    debugLog('Check error:', checkError);
    if (checkError) {
      debugError('Error checking existing picks:', checkError);
      return NextResponse.json(
        { success: false, error: 'Failed to check existing picks' },
        { status: 500 }
      );
    }

    debugLog('Existing picks:', existingPicks);

    // Check if games are locked
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, status, kickoff_time, week, season, season_type')
      .in('id', gameIds);
    debugLog('Games:', games);
    if (gamesError) {
      debugError('Error checking games:', gamesError);
      return NextResponse.json(
        { success: false, error: 'Failed to validate games' },
        { status: 500 }
      );
    }

    // Determine if this is a playoff week from the already fetched games
    const isPlayoff = games && games.length > 0 && games[0].season_type === 3;

    const now = new Date();

    // Single source of truth for the unlock window (7 days before the
    // FIRST kickoff, same rule for every season type) — this used to be a
    // separate inline calculation that (a) read games?.[0] as "the first
    // game" even though that query isn't ordered by kickoff_time, so with
    // multiple games it could lock/unlock based on the wrong game, and
    // (b) gave playoff weeks a more lenient rule (only locked once
    // finished, skipping the 7-day window) that the client-side check
    // never applied — a real client/server mismatch a participant could
    // have exploited by calling this endpoint directly during that gap.
    // computeWeekUnlockStatus sorts by kickoff_time itself and applies the
    // same rule everywhere, matching what WeeklyPick already shows.
    //
    // Deliberately no dev-mode bypass here: the client's dev-only "force
    // unlocked" toggle (weekly-pick.tsx) only ever affected what's
    // *displayed* — the payload it sends this endpoint has always been
    // identical regardless, so this check has always been the real
    // gatekeeper in every environment. Giving it new dev-only leniency
    // would be a behavior change beyond what's needed here, not a fix.
    const sortedByKickoff = [...(games ?? [])].sort(
      (a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime()
    );
    const firstGame = sortedByKickoff[0];
    const weekIsLocked = !computeWeekUnlockStatus(sortedByKickoff, firstGame?.week ?? 0, firstGame?.season_type ?? 2, null, now);

    if (firstGame) {
      const daysToKickoffDebug = (new Date(firstGame.kickoff_time).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      debugLog('Week lock check:', {
        firstGameId: firstGame.id,
        kickoffTime: firstGame.kickoff_time,
        currentTime: now.toISOString(),
        daysToKickoff: daysToKickoffDebug.toFixed(2),
        daysBeforeGame: DAYS_BEFORE_GAME,
        weekIsLocked,
        isPlayoff,
        gameStatus: firstGame.status,
      });
    }

    if (weekIsLocked) {
      const daysToKickoff = firstGame
        ? (new Date(firstGame.kickoff_time).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        : 0;
      let errorMessage = 'Week is locked - ';
      if (!firstGame) {
        errorMessage += 'no games found for this week';
      } else if (daysToKickoff > DAYS_BEFORE_GAME) {
        errorMessage += `picks can only be submitted within ${DAYS_BEFORE_GAME} days of the first game (currently ${daysToKickoff.toFixed(1)} days away)`;
      } else if (new Date(firstGame.kickoff_time) <= now) {
        errorMessage += 'games have already started';
      } else if (firstGame.status?.toLowerCase() !== 'scheduled') {
        errorMessage += `game status is '${firstGame.status.toLowerCase()}' (not scheduled)`;
      } else {
        errorMessage += 'picks are not currently open for this week';
      }

      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 400 }
      );
    }

    // Check if picks already exist - for playoff games, allow updates
    if (existingPicks && existingPicks.length > 0) {
      if (!isPlayoff) {
        // For regular season, don't allow resubmission
        return NextResponse.json(
          { success: false, error: 'Picks already submitted for this week' },
          { status: 400 }
        );
      } else {
        // For playoff games, delete existing picks and reinsert (update)
        const { error: deleteError } = await supabase
          .from('picks')
          .delete()
          .eq('participant_id', firstPick.participant_id)
          .eq('pool_id', firstPick.pool_id)
          .in('game_id', gameIds);
        
        if (deleteError) {
          debugError('Error deleting existing playoff picks:', deleteError);
          return NextResponse.json(
            { success: false, error: 'Failed to update existing picks' },
            { status: 500 }
          );
        }
        
        debugLog('Deleted existing playoff picks, will insert new ones');
      }
    }

    // Validate confidence points (skip for playoff games as they use playoff_confidence_points table)
    if (!isPlayoff) {
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
      debugError('Error submitting picks:', error);
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
        debugError('Error loading full games for Monday night identification:', fullGamesError);
      }

      // For Super Bowl (season_type === 3, week === 4), use the Super Bowl game itself
      // For regular season, use the Monday night game
      let tieBreakerGameId: string | null = null;
      
      if (seasonType === 3 && week === 4) {
        // Super Bowl: use the Super Bowl game (should be the only game)
        tieBreakerGameId = fullGames && fullGames.length > 0 ? fullGames[0].id : null;
      } else {
        // Regular season: use Monday night game
        const { getMondayNightGame } = await import('@/lib/monday-night-utils');
        const mondayNightGame = getMondayNightGame(fullGames || []);
        tieBreakerGameId = mondayNightGame?.id || null;
      }
      
      const { error: tieBreakerError } = await supabase
        .from('tie_breakers')
        .upsert({
          participant_id: firstPick.participant_id,
          pool_id: firstPick.pool_id,
          week: week,
          season: season,
          season_type: seasonType,
          answer: mondayNightScore,
          game_id: tieBreakerGameId
        }, {
          onConflict: 'participant_id,pool_id,week,season,season_type'
        });

      if (tieBreakerError) {
        debugError('Error saving Monday night score:', tieBreakerError);
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
    debugError('Error submitting picks:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
