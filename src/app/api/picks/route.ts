import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const poolId = searchParams.get('poolId');
    const participantId = searchParams.get('participantId');
    const week = searchParams.get('week');
    const seasonType = searchParams.get('seasonType');
    const includeGames = searchParams.get('includeGames') === 'true';
    const includeParticipants = searchParams.get('includeParticipants') === 'true';
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Picks API - Query params:', { poolId, participantId, week, seasonType, includeGames, includeParticipants });
    }
    if (!poolId) {
      return NextResponse.json(
        { success: false, error: 'Pool ID is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();
    if (process.env.NODE_ENV === 'development') {
      console.log('Picks API - Supabase client:', supabase);
    }
    // Build the select statement based on what's requested
    let selectStatement = 'id, participant_id, pool_id, game_id, predicted_winner, confidence_points, created_at';
    console.log('Picks API - Select statement:', selectStatement);
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
    if (process.env.NODE_ENV === 'development') {
      console.log('Picks API - Select statement:', selectStatement);
    }
    if (includeParticipants) {
      selectStatement += `, participants (
        id,
        name,
        email
      )`;
    }
    if (process.env.NODE_ENV === 'development') {
      console.log('Picks API - Select statement:', selectStatement);
    }
    let query = supabase
      .from('picks')
      .select(selectStatement)
      .eq('pool_id', poolId);
    if (process.env.NODE_ENV === 'development') {
      console.log('Picks API - Query:', query);
    }
    if (participantId) {
      query = query.eq('participant_id', participantId);
    }
    if (process.env.NODE_ENV === 'development') {
      console.log('Picks API - Query:', query);
    }
    if (week) {
      if (includeGames) {
        // If including games, filter by games.week
        query = query.eq('games.week', parseInt(week));
      } else {
        // If not including games, we need to join with games to filter by week
        query = query.eq('games.week', parseInt(week));
      }
    }
    if (process.env.NODE_ENV === 'development') {
      console.log('Picks API - Query:', query);
    }
    if (seasonType) {
      if (includeGames) {
        // If including games, filter by games.season_type
        query = query.eq('games.season_type', parseInt(seasonType));
      } else {
        // If not including games, we need to join with games to filter by season_type
        query = query.eq('games.season_type', parseInt(seasonType));
      }
    }

    // Order by confidence points for consistent ordering
    query = query.order('confidence_points', { ascending: true });
    if (process.env.NODE_ENV === 'development') {
      console.log('Picks API - Query:', query);
    }
    const { data: picks, error } = await query;
    if (process.env.NODE_ENV === 'development') {
      console.log('Picks API - Picks:', picks);
    }
    if (error) {
      console.error('Error fetching picks:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch picks' },
        { status: 500 }
      );
    }
    if (process.env.NODE_ENV === 'development') {
      console.log('Picks API - Picks:', picks);
    }
    // If filtering by week/season but not including games, we need to filter the results
    let filteredPicks = picks;
    if ((week || seasonType) && !includeGames) {
      // Get games for the week/season to filter picks
      let gamesQuery = supabase
        .from('games')
        .select('id, week, season_type');
      if (process.env.NODE_ENV === 'development') {
        console.log('Picks API - Games query:', gamesQuery);
      }
      if (week) {
        gamesQuery = gamesQuery.eq('week', parseInt(week));
      }
      if (seasonType) {
        gamesQuery = gamesQuery.eq('season_type', parseInt(seasonType));
      }
      if (process.env.NODE_ENV === 'development') {
        console.log('Picks API - Games query:', gamesQuery);
      }
      const { data: games } = await gamesQuery;
      if (process.env.NODE_ENV === 'development') {
        console.log('Picks API - Games:', games);
      }
      if (games) {
        const gameIds = games.map(g => g.id);
        filteredPicks = picks?.filter(pick => gameIds.includes(pick.game_id)) || [];
      }
    }
    if (process.env.NODE_ENV === 'development') {
      console.log('Picks API - Filtered picks:', filteredPicks);
    }       
    if (process.env.NODE_ENV === 'development') {
      console.log('Picks API - Query params:', { poolId, participantId, week, seasonType, includeGames, includeParticipants });
      console.log('Picks API - Results:', { count: filteredPicks?.length || 0 });
    }

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
    console.error('Error in picks GET API:', error);
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
