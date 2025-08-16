import { getSupabaseClient } from '@/lib/supabase';

export interface PickData {
  id: string;
  participant_id: string;
  participant_name: string;
  game_id: string;
  home_team: string;
  away_team: string;
  predicted_winner: string;
  confidence_points: number;
  week: number;
  season_type: number;
  // Add game result fields
  game_status?: string;
  game_winner?: string | null;
  home_score?: number | null;
  away_score?: number | null;
}

export async function loadPicksForLeaderboard(poolId: string, weekNumber: number, seasonType: number) {
  try {
    const supabase = getSupabaseClient();
    
    // First, get the picks data
    const { data: picksData, error: picksError } = await supabase
      .from('picks')
      .select(`
        id,
        participant_id,
        game_id,
        predicted_winner,
        confidence_points,
        participants!inner(
          name
        )
      `)
      .eq('pool_id', poolId);

    if (picksError) {
      console.error('Error loading picks:', picksError);
      return [];
    }

    if (!picksData || picksData.length === 0) {
      console.log('No picks data found');
      return [];
    }

    // Get the game IDs from picks
    const gameIds = [...new Set(picksData.map(pick => pick.game_id))];
    
    // Then, get the games data separately
    const { data: gamesData, error: gamesError } = await supabase
      .from('games')
      .select('*')
      .eq('week', weekNumber)
      .eq('season_type', seasonType)
      .in('id', gameIds);

    if (gamesError) {
      console.error('Error loading games:', gamesError);
      return [];
    }

    // Create a map of games by ID for easy lookup
    const gamesMap = new Map(gamesData?.map(game => [game.id, game]) || []);

    // Transform the data to a more usable format
    const picks: PickData[] = picksData.map(pick => {
      const game = gamesMap.get(pick.game_id);
      // console.log('game', game);
      const transformedPick = {
        id: pick.id,
        participant_id: pick.participant_id,
        participant_name: pick.participants.name || 'Unknown',
        game_id: pick.game_id,
        home_team: game?.home_team || 'Unknown',
        away_team: game?.away_team || 'Unknown',
        predicted_winner: pick.predicted_winner,
        confidence_points: pick.confidence_points,
        week: game?.week || 0,
        season_type: game?.season_type || 0,
        // Include game result fields
        game_status: game?.status || 'unknown',
        game_winner: game?.winner || null,
        home_score: game?.home_score || null,
        away_score: game?.away_score || null
      };
      
      return transformedPick;
    });

    return picks;
  } catch (error) {
    console.error('Error loading picks for leaderboard:', error);
    return [];
  }
}

export interface LeaderboardEntryWithPicks {
  participant_id: string;
  participant_name: string;
  total_points: number;
  correct_picks: number;
  total_picks: number;
  game_points: { [gameId: string]: number };
  picks: PickData[];
}

export async function loadLeaderboardWithPicks(poolId: string, weekNumber: number, seasonType: number): Promise<LeaderboardEntryWithPicks[]> {
  try {
    const picks = await loadPicksForLeaderboard(poolId, weekNumber, seasonType);
    if (picks.length === 0) {
      return [];
    }

    // Group picks by participant
    const participantPicks = new Map<string, PickData[]>();
    picks.forEach(pick => {
      if (!participantPicks.has(pick.participant_id)) {
        participantPicks.set(pick.participant_id, []);
      }
      participantPicks.get(pick.participant_id)!.push(pick);
    });

    // Calculate leaderboard entries using the game data already fetched with picks
    const leaderboardEntries: LeaderboardEntryWithPicks[] = [];

    participantPicks.forEach((participantPicks, participantId) => {
      const participantName = participantPicks[0]?.participant_name || 'Unknown';
      let totalPoints = 0;
      let correctPicks = 0;
      const totalPicks = participantPicks.length;
      const gamePoints: { [gameId: string]: number } = {};

      participantPicks.forEach(pick => {
        let points = 0;

        // Use the game data that was fetched with the picks
        if ((pick.game_status === 'final' || pick.game_status === 'post') && pick.game_winner) {
          if (pick.predicted_winner === pick.game_winner) {
            points = pick.confidence_points;
            correctPicks++;
          }
        }

        gamePoints[pick.game_id] = points;
        totalPoints += points;
      });

      leaderboardEntries.push({
        participant_id: participantId,
        participant_name: participantName,
        total_points: totalPoints,
        correct_picks: correctPicks,
        total_picks: totalPicks,
        game_points: gamePoints,
        picks: participantPicks
      });
    });

    // Sort by total points (descending)
    return leaderboardEntries.sort((a, b) => b.total_points - a.total_points);
  } catch (error) {
    console.error('Error loading leaderboard with picks:', error);
    return [];
  }
}
