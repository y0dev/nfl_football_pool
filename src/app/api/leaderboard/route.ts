import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { debugLog } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const poolId = searchParams.get('poolId');
    const week = searchParams.get('week');
    const seasonType = searchParams.get('seasonType');
    const season = searchParams.get('season');
    debugLog('Leaderboard API request:', {
      poolId,
      week,
      seasonType,
      season
    });

    if (!poolId || !week || !seasonType) {
      return NextResponse.json(
        { error: 'Pool ID, week, and season type are required' },
        { status: 400 }
      );
    }

    const weekNumber = parseInt(week);
    const seasonTypeNumber = parseInt(seasonType);
    const seasonNumber = season ? parseInt(season) : undefined;

    if (isNaN(weekNumber) || isNaN(seasonTypeNumber)) {
      return NextResponse.json(
        { error: 'Invalid week or season type' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // First, get all participants in the pool
    const { data: participants, error: participantsError } = await supabase
      .from('participants')
      .select('id, name')
      .eq('pool_id', poolId)
      .eq('is_active', true);

    if (participantsError) {
      console.error('Error loading participants:', participantsError);
      return NextResponse.json(
        { error: 'Failed to load participants' },
        { status: 500 }
      );
    }

    if (!participants || participants.length === 0) {
      return NextResponse.json({
        success: true,
        leaderboard: [],
        participants: [],
        games: []
      });
    }

    // Get games for the specified week and season type
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('*')
      .eq('week', weekNumber)
      .eq('season_type', seasonTypeNumber)
      .order('kickoff_time', { ascending: true });

    if (gamesError) {
      console.error('Error loading games:', gamesError);
      return NextResponse.json(
        { error: 'Failed to load games' },
        { status: 500 }
      );
    }

    if (!games || games.length === 0) {
      return NextResponse.json({
        success: true,
        leaderboard: [],
        participants: participants,
        games: []
      });
    }

    // Get picks for all participants in this pool for these games
    const { data: picks, error: picksError } = await supabase
      .from('picks')
      .select(`
        id,
        participant_id,
        game_id,
        predicted_winner,
        confidence_points
      `)
      .eq('pool_id', poolId)
      .in('game_id', games.map(g => g.id));

    if (picksError) {
      console.error('Error loading picks:', picksError);
      return NextResponse.json(
        { error: 'Failed to load picks' },
        { status: 500 }
      );
    }

    // Create a map of picks by participant and game
    const picksMap = new Map<string, Map<string, any>>();
    picks?.forEach(pick => {
      if (!picksMap.has(pick.participant_id)) {
        picksMap.set(pick.participant_id, new Map());
      }
      picksMap.get(pick.participant_id)!.set(pick.game_id, pick);
    });

    // Build leaderboard entries
    const leaderboard = participants.map(participant => {
      const participantPicks = picksMap.get(participant.id) || new Map();
      let totalPoints = 0;
      let correctPicks = 0;
      let totalPicks = 0;
      const gamePoints: { [gameId: string]: number } = {};
      const picks: any[] = [];

      games.forEach(game => {
        const pick = participantPicks.get(game.id);
        if (pick) {
          totalPicks++;
          picks.push({
            id: pick.id,
            participant_id: participant.id,
            participant_name: participant.name,
            game_id: game.id,
            home_team: game.home_team,
            away_team: game.away_team,
            predicted_winner: pick.predicted_winner,
            confidence_points: pick.confidence_points,
            week: game.week,
            season_type: game.season_type,
            game_status: game.status,
            game_winner: game.winner,
            home_score: game.home_score,
            away_score: game.away_score
          });

          // Calculate points for this game
          let points = 0;
          if ((game.status === 'final' || game.status === 'post') && game.winner) {
            if (pick.predicted_winner === game.winner) {
              points = pick.confidence_points;
              correctPicks++;
            }
          }
          
          gamePoints[game.id] = points;
          totalPoints += points;
        } else {
          // No pick for this game
          picks.push({
            id: null,
            participant_id: participant.id,
            participant_name: participant.name,
            game_id: game.id,
            home_team: game.home_team,
            away_team: game.away_team,
            predicted_winner: null,
            confidence_points: 0,
            week: game.week,
            season_type: game.season_type,
            game_status: game.status,
            game_winner: game.winner,
            home_score: game.home_score,
            away_score: game.away_score
          });
          gamePoints[game.id] = 0;
        }
      });

      return {
        participant_id: participant.id,
        participant_name: participant.name,
        total_points: totalPoints,
        correct_picks: correctPicks,
        total_picks: totalPicks,
        game_points: gamePoints,
        picks: picks
      };
    });

    // Sort by total points (descending)
    leaderboard.sort((a, b) => b.total_points - a.total_points);

    return NextResponse.json({
      success: true,
      leaderboard: leaderboard,
      participants: participants,
      games: games
    });

  } catch (error) {
    console.error('Error in leaderboard API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
