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
}

export async function loadPicksForLeaderboard(poolId: string, weekNumber: number, seasonType: number) {
  try {
    const supabase = getSupabaseClient();
    
    // Get all picks for the pool, week, and season type
    const { data: picksData, error } = await supabase
      .from('picks')
      .select(`
        id,
        participant_id,
        game_id,
        predicted_winner,
        confidence_points,
        participants!inner(
          name
        ),
        games!inner(
          home_team,
          away_team,
          week,
          season_type
        )
      `)
      .eq('pool_id', poolId)
      .eq('games.week', weekNumber)
      .eq('games.season_type', seasonType);

    if (error) {
      console.error('Error loading picks for leaderboard:', error);
      return [];
    }

    if (!picksData || picksData.length === 0) {
      return [];
    }

    // Transform the data to a more usable format
    const picks: PickData[] = picksData.map(pick => ({
      id: pick.id,
      participant_id: pick.participant_id,
      participant_name: pick.participants.name,
      game_id: pick.game_id,
      home_team: pick.games.home_team,
      away_team: pick.games.away_team,
      predicted_winner: pick.predicted_winner,
      confidence_points: pick.confidence_points,
      week: pick.games.week,
      season_type: pick.games.season_type
    }));

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

    // Get game results to calculate points
    const supabase = getSupabaseClient();
    const { data: gamesData, error: gamesError } = await supabase
      .from('games')
      .select('id, winner, status')
      .eq('week', weekNumber)
      .eq('season_type', seasonType);

    if (gamesError) {
      console.error('Error loading games for leaderboard:', gamesError);
      return [];
    }

    const gamesMap = new Map(gamesData?.map(game => [game.id, game]) || []);

    // Calculate leaderboard entries
    const leaderboardEntries: LeaderboardEntryWithPicks[] = [];

    participantPicks.forEach((participantPicks, participantId) => {
      const participantName = participantPicks[0]?.participant_name || 'Unknown';
      let totalPoints = 0;
      let correctPicks = 0;
      let totalPicks = participantPicks.length;
      const gamePoints: { [gameId: string]: number } = {};

      participantPicks.forEach(pick => {
        const game = gamesMap.get(pick.game_id);
        let points = 0;

        if (game && game.status === 'final' && game.winner) {
          if (pick.predicted_winner === game.winner) {
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
