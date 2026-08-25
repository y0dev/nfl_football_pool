import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { checkPoolAccessFromRequest } from '@/lib/pool-access';
import { debugLog, debugError } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const poolId = searchParams.get('poolId');
    const participantId = searchParams.get('participantId');
    const week = searchParams.get('week');
    const seasonType = searchParams.get('seasonType');
    const includeGames = searchParams.get('includeGames') === 'true';
    const includeParticipants = searchParams.get('includeParticipants') === 'true';

    debugLog('Picks API - Query params:', { poolId, participantId, week, seasonType, includeGames, includeParticipants });
    if (!poolId) {
      return NextResponse.json(
        { success: false, error: 'Pool ID is required' },
        { status: 400 }
      );
    }

    const access = await checkPoolAccessFromRequest(poolId, request);
    if (!access.allowed) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    const supabase = getSupabaseServiceClient();
    debugLog('Picks API - Supabase client:', supabase);
    // Build the select statement based on what's requested. This string is
    // reassigned below, so Supabase's query builder can't statically parse
    // it into a column-selection AST and falls back to an untyped row shape
    // — PickRow (used only for the post-processing filter further down)
    // captures the base columns that are always present regardless of the
    // includeGames/includeParticipants flags.
    interface PickRow {
      id: string;
      participant_id: string;
      pool_id: string;
      game_id: string;
      predicted_winner: string;
      confidence_points: number;
      created_at: string;
    }
    let selectStatement = 'id, participant_id, pool_id, game_id, predicted_winner, confidence_points, created_at';
    debugLog('Picks API - Select statement:', selectStatement);
    if (includeGames) {
      selectStatement += `, games (
        id,
        home_team,
        away_team,
        kickoff_time,
        status,
        winner,
        home_score,
        away_score,
        week,
        season_type
      )`;
    }
    debugLog('Picks API - Select statement:', selectStatement);
    if (includeParticipants) {
      selectStatement += `, participants (
        id,
        name,
        email
      )`;
    }
    debugLog('Picks API - Select statement:', selectStatement);
    let query = supabase
      .from('picks')
      .select(selectStatement)
      .eq('pool_id', poolId);
    debugLog('Picks API - Query:', query);
    if (participantId) {
      query = query.eq('participant_id', participantId);
    }
    debugLog('Picks API - Query:', query);
    // Note: We can't filter by games.week or games.season_type directly unless includeGames is true
    // If filtering by week/seasonType without includeGames, we'll filter in post-processing
    if (week && includeGames) {
        query = query.eq('games.week', parseInt(week));
    }
    debugLog('Picks API - Query:', query);
    if (seasonType && includeGames) {
        query = query.eq('games.season_type', parseInt(seasonType));
    }

    // Order by confidence points for consistent ordering
    query = query.order('confidence_points', { ascending: true });
    debugLog('Picks API - Query:', query);
    const { data: picks, error } = await query;
    debugLog('Picks API - Picks:', picks);
    if (error) {
      debugError('Error fetching picks:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch picks' },
        { status: 500 }
      );
    }
    debugLog('Picks API - Picks:', picks);
    // If filtering by week/season but not including games, we need to filter the results
    // (cast up front so `filteredPicks` has one consistent type across both branches below —
    // Supabase's query builder falls back to an untyped error-shaped row since selectStatement
    // is a dynamically-built string, not a statically-parseable literal)
    let filteredPicks = picks as unknown as PickRow[] | null;
    if ((week || seasonType) && !includeGames) {
      // Get games for the week/season to filter picks
      let gamesQuery = supabase
        .from('games')
        .select('id, week, season_type');
      debugLog('Picks API - Games query:', gamesQuery);
      if (week) {
        gamesQuery = gamesQuery.eq('week', parseInt(week));
      }
      if (seasonType) {
        gamesQuery = gamesQuery.eq('season_type', parseInt(seasonType));
      }
      debugLog('Picks API - Games query:', gamesQuery);
      const { data: games } = await gamesQuery;
      debugLog('Picks API - Games:', games);
      if (games) {
        const gameIds = games.map(g => g.id);
        filteredPicks = filteredPicks?.filter((pick) => gameIds.includes(pick.game_id)) || [];
      }
    }
    debugLog('Picks API - Filtered picks:', filteredPicks);
    debugLog('Picks API - Query params:', { poolId, participantId, week, seasonType, includeGames, includeParticipants });
    debugLog('Picks API - Results:', { count: filteredPicks?.length || 0 });

    return NextResponse.json({
      success: true,
      picks: filteredPicks || [],
      meta: {
        poolId,
        participantId,
        week: week ? parseInt(week) : null,
        seasonType: seasonType ? parseInt(seasonType) : null,
        total: filteredPicks?.length || 0
      }
    });

  } catch (error) {
    debugError('Error in picks GET API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Optional: Add POST method to redirect to the submit endpoint
export async function POST(request: NextRequest) {
  // Redirect POST requests to the submit endpoint
  return NextResponse.redirect(new URL('/api/picks/submit', request.url));
}
