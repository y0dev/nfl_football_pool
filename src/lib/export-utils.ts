import { getSupabaseServiceClient } from './supabase';
import { debugLog, PERIOD_WEEKS } from './utils';

export interface WeeklyExportData {
  participant_id: string;
  participant_name: string;
  game_id: string;
  home_team: string;
  away_team: string;
  predicted_winner: string;
  confidence_points: number;
  game_status: string;
  game_winner: string | null;
  home_score: number | null;
  away_score: number | null;
  kickoff_time: string;
  is_correct: boolean;
  points_earned: number;
}

export interface PeriodExportData {
  participant_id: string;
  participant_name: string;
  period_name: string;
  total_points: number;
  total_correct_picks: number;
  total_picks: number;
  weeks_won: number;
  weekly_breakdown: {
    week: number;
    points: number;
    correct_picks: number;
    total_picks: number;
    rank: number;
  }[];
}

/**
 * Export weekly picks data for manual calculation
 */
export async function exportWeeklyPicks(
  poolId: string, 
  week: number, 
  season: number,
  seasonType: number
): Promise<string> {
  try {
    const supabase = getSupabaseServiceClient();
    
    // First get games for the specified week/season/seasonType
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('*')
      .eq('week', week)
      .eq('season', season)
      .eq('season_type', seasonType)
      .order('kickoff_time', { ascending: true });

    if (gamesError) {
      console.error('Error fetching games for export:', gamesError);
      throw new Error('Failed to fetch games data');
    }

    if (!games || games.length === 0) {
      throw new Error('No games found for this week');
    }

     // Get participants first to create a lookup map
     const { data: participants, error: participantsError } = await supabase
       .from('participants')
       .select('id, name')
       .eq('pool_id', poolId)
       .eq('is_active', true);

     if (participantsError) {
       console.error('Error fetching participants:', participantsError);
       throw new Error('Failed to fetch participants');
     }

     if (!participants || participants.length === 0) {
       throw new Error('No participants found in this pool');
     }

     // Create a map of participant IDs to names
     const participantsMap = new Map(participants.map(p => [p.id, p.name]));

     // Get picks for these games
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
       .in('game_id', games.map(g => g.id))
       .order('participant_id', { ascending: true });

    if (picksError) {
      console.error('Error fetching picks for export:', picksError);
      throw new Error('Failed to fetch picks data');
    }

    if (!picks || picks.length === 0) {
      throw new Error('No picks found for this week');
    }

    // debugLog('exportWeeklyPicks - picks', picks);

    // Get Monday night scores if this is a tie-breaker week
    const isPeriodWeek = PERIOD_WEEKS.includes(week as typeof PERIOD_WEEKS[number]);
     let mondayNightScores: { participant_id: string; answer: number }[] = [];
    debugLog('exportWeeklyPicks - isPeriodWeek', isPeriodWeek);
    
     if (isPeriodWeek) {
       const { data: tieBreakers, error: tieBreakerError } = await supabase
         .from('tie_breakers')
         .select(`
           participant_id,
           answer
         `)
         .eq('pool_id', poolId)
         .eq('week', week)
         .eq('season', season);

       if (!tieBreakerError && tieBreakers) {
         mondayNightScores = tieBreakers;
       }
     }

    // Create a map of games by ID for easy lookup
    const gamesMap = new Map(games.map(game => [game.id, game]));
    debugLog('exportWeeklyPicks - gamesMap', gamesMap);
     // Transform data for CSV export
     const exportData: WeeklyExportData[] = picks
       .map((pick: { participant_id: string; game_id: string; predicted_winner: string; confidence_points: number; id: string }) => {
       const game = gamesMap.get(pick.game_id);
       const participantName = participantsMap.get(pick.participant_id) || pick.participant_id;
       debugLog('exportWeeklyPicks - game', game);
       debugLog('exportWeeklyPicks - participantName', participantName);
       if (!game) {
         console.warn(`Game not found for pick ${pick.id}, game_id: ${pick.game_id}`);
         return null;
       }
       debugLog('exportWeeklyPicks - game found');
       const isCorrect = game.winner && pick.predicted_winner.toLowerCase() === game.winner.toLowerCase();
       const pointsEarned = isCorrect ? pick.confidence_points : 0;
       debugLog('exportWeeklyPicks - pointsEarned', pointsEarned);
       return {
         participant_id: pick.participant_id,
         participant_name: participantName,
         game_id: pick.game_id,
         home_team: game.home_team,
         away_team: game.away_team,
         predicted_winner: pick.predicted_winner,
         confidence_points: pick.confidence_points,
         game_status: game.status,
         game_winner: game.winner,
         home_score: game.home_score,
         away_score: game.away_score,
         kickoff_time: game.kickoff_time,
         is_correct: isCorrect,
         points_earned: pointsEarned
       };
     })
     .filter((item): item is WeeklyExportData => item !== null); // Remove any null entries
    debugLog('exportWeeklyPicks - exportData', exportData);
     // Create CSV content
     const csvContent = createWeeklyPicksCSV(exportData, mondayNightScores, week, season, participantsMap);
     // debugLog('exportWeeklyPicks - csvContent', csvContent);
     return csvContent;
    
  } catch (error) {
    console.error('Failed to export weekly picks:', error);
    throw error;
  }
}

/**
 * Export period calculation data for manual verification
 */
export async function exportPeriodData(
  poolId: string, 
  periodName: string, 
  season: number = new Date().getFullYear()
): Promise<string> {
  try {
    const supabase = getSupabaseServiceClient();
    
    // Get tie-breaker weeks
    const periodWeeks = getPeriodWeeks(periodName);
    if (periodWeeks.length === 0) {
      throw new Error('Invalid period name');
    }

    // Get all participants in the pool
    const { data: participants, error: participantsError } = await supabase
      .from('participants')
      .select('id, name')
      .eq('pool_id', poolId)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (participantsError) {
      console.error('Error fetching participants:', participantsError);
      throw new Error('Failed to fetch participants');
    }

    if (!participants || participants.length === 0) {
      throw new Error('No participants found in this pool');
    }

    // Get all picks for the tie-breaker weeks
    const { data: picksData, error: picksError } = await supabase
      .from('picks')
      .select(`
        id,
        participant_id,
        game_id,
        predicted_winner,
        confidence_points,
        participants!inner(name)
      `)
      .eq('pool_id', poolId)
      .in('game_id', await getGameIdsForWeeks(supabase, periodWeeks, season));

    if (picksError) {
      console.error('Error fetching picks:', picksError);
      throw new Error('Failed to fetch picks data');
    }

    // Get all games for the tie-breaker weeks
    const { data: gamesData, error: gamesError } = await supabase
      .from('games')
      .select('*')
      .eq('season', season)
      .eq('season_type', 2)
      .in('week', periodWeeks);

    if (gamesError) {
      console.error('Error fetching games:', gamesError);
      throw new Error('Failed to fetch games data');
    }

    // Create a map of games by ID for easy lookup
    const gamesMap = new Map(gamesData?.map(game => [game.id, game]) || []);

    // Calculate period totals for each participant
    const participantTotals = new Map<string, PeriodExportData>();
    
    participants.forEach(participant => {
      participantTotals.set(participant.id, {
        participant_id: participant.id,
        participant_name: participant.name,
        period_name: periodName,
        total_points: 0,
        total_correct_picks: 0,
        total_picks: 0,
        weeks_won: 0,
        weekly_breakdown: []
      });
    });

    // Group picks by participant and week
    const participantWeekPicks = new Map<string, Map<number, Array<{
      id: string;
      participant_id: string;
      game_id: string;
      predicted_winner: string;
      confidence_points: number;
      participants: { name: string };
      game_winner?: string | null;
      game_status?: string;
    }>>>();
    
    picksData?.forEach(pick => {
      const game = gamesMap.get(pick.game_id);
      if (!game) return;
      
      const week = game.week;
      if (!participantWeekPicks.has(pick.participant_id)) {
        participantWeekPicks.set(pick.participant_id, new Map());
      }
      if (!participantWeekPicks.get(pick.participant_id)!.has(week)) {
        participantWeekPicks.get(pick.participant_id)!.set(week, []);
      }
      participantWeekPicks.get(pick.participant_id)!.get(week)!.push({
        ...pick,
        participants: { name: (pick.participants as any).name },
        game_winner: game.winner,
        game_status: game.status
      });
    });

    // Calculate totals for each participant
    participantWeekPicks.forEach((weekPicks, participantId) => {
      const participant = participantTotals.get(participantId);
      if (!participant) return;

      let totalPoints = 0;
      let totalCorrectPicks = 0;
      let totalPicks = 0;
      let weeksWon = 0;

      // Process each week
      periodWeeks.forEach(week => {
        const weekPicksData = weekPicks.get(week) || [];
        let weekPoints = 0;
        let weekCorrectPicks = 0;
        const weekTotalPicks = weekPicksData.length;

        weekPicksData.forEach((pick: {
          id: string;
          participant_id: string;
          game_id: string;
          predicted_winner: string;
          confidence_points: number;
          participants: { name: string };
          game_winner?: string | null;
          game_status?: string;
        }) => {
          const isCorrect = pick.game_winner && pick.predicted_winner.toLowerCase() === pick.game_winner.toLowerCase();
          if (isCorrect) {
            weekPoints += pick.confidence_points;
            weekCorrectPicks++;
          }
        });

        totalPoints += weekPoints;
        totalCorrectPicks += weekCorrectPicks;
        totalPicks += weekTotalPicks;

        // Add to weekly breakdown
        participant.weekly_breakdown.push({
          week: week,
          points: weekPoints,
          correct_picks: weekCorrectPicks,
          total_picks: weekTotalPicks,
          rank: 0 // We'll calculate rank later
        });

        // Check if this participant won this week (highest points)
        if (weekPoints > 0) {
          const isWeekWinner = Array.from(participantWeekPicks.entries()).every(([otherId, otherWeekPicks]) => {
            if (otherId === participantId) return true;
            const otherWeekPicksData = otherWeekPicks.get(week) || [];
            const otherWeekPoints = otherWeekPicksData.reduce((sum, pick) => {
              const isCorrect = pick.game_winner && pick.predicted_winner.toLowerCase() === pick.game_winner.toLowerCase();
              return sum + (isCorrect ? pick.confidence_points : 0);
            }, 0);
            return weekPoints > otherWeekPoints;
          });
          if (isWeekWinner) weeksWon++;
        }
      });

      participant.total_points = totalPoints;
      participant.total_correct_picks = totalCorrectPicks;
      participant.total_picks = totalPicks;
      participant.weeks_won = weeksWon;
    });

    // Convert to array and sort by total points
    const exportData = Array.from(participantTotals.values())
      .sort((a, b) => b.total_points - a.total_points);

    // Create CSV content
    const csvContent = createPeriodDataCSV(exportData, periodWeeks);
    debugLog('exportPeriodData - csvContent', csvContent);
    return csvContent;
    
  } catch (error) {
    console.error('Failed to export period data:', error);
    throw error;
  }
}

// Helper function to get game IDs for specific weeks
async function getGameIdsForWeeks(supabase: any, weeks: number[], season: number): Promise<string[]> {
  const { data: games, error } = await supabase
    .from('games')
    .select('id')
    .eq('season', season)
    .eq('season_type', 2)
    .in('week', weeks);

  if (error) {
    console.error('Error fetching game IDs:', error);
    return [];
  }

  return games?.map((game: { id: string }) => game.id) || [];
}

/**
 * Create CSV content for weekly picks export
 */
function createWeeklyPicksCSV(
  picksData: WeeklyExportData[], 
  mondayNightScores: { participant_id: string; answer: number }[], 
  week: number, 
  season: number,
  participantsMap: Map<string, string>
): string {
  // Group picks by participant
  const participantGroups = new Map<string, WeeklyExportData[]>();
  picksData.forEach(pick => {
    if (!participantGroups.has(pick.participant_name)) {
      participantGroups.set(pick.participant_name, []);
    }
    participantGroups.get(pick.participant_name)!.push(pick);
  });

  // Get all unique games by game_id and sort them by kickoff time
  const gamesMap = new Map();
  picksData.forEach(pick => {
    if (!gamesMap.has(pick.game_id)) {
      gamesMap.set(pick.game_id, {
        id: pick.game_id,
        home_team: pick.home_team,
        away_team: pick.away_team,
        kickoff_time: pick.kickoff_time,
        status: pick.game_status,
        winner: pick.game_winner,
        home_score: pick.home_score,
        away_score: pick.away_score
      });
    }
  });
  
  const games = Array.from(gamesMap.values()).sort((a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime());
  // debugLog('exportWeeklyPicks - unique games', games);

  // Create headers to match leaderboard structure
  const headers = ['Rank', 'Participant', 'Points', 'Correct'];
  games.forEach(game => {
    headers.push(`${game.away_team} @ ${game.home_team}`);
  });

  debugLog('exportWeeklyPicks - headers', headers);
  const rows = [headers];

  // Create rows for each participant (sorted by total points descending)
  const sortedParticipants = Array.from(participantGroups.entries()).sort((a, b) => {
    const aPoints = a[1].reduce((sum, pick) => sum + pick.points_earned, 0);
    const bPoints = b[1].reduce((sum, pick) => sum + pick.points_earned, 0);
    return bPoints - aPoints; // Sort descending by points
  });

  sortedParticipants.forEach(([participantName, picks], index) => {
    // Calculate total points and correct picks
    const totalPoints = picks.reduce((sum, pick) => sum + pick.points_earned, 0);
    const correctPicks = picks.filter(pick => pick.is_correct).length;
    const totalPicks = picks.length;

    // Create a map of game_id to pick for easy lookup
    const picksMap = new Map(picks.map(pick => [pick.game_id, pick]));

    // Start the row with rank, participant, points, correct
    const row = [
      (index + 1).toString(), // Rank
      participantName,
      totalPoints.toString(),
      `${correctPicks} of ${totalPicks}` // Changed from "3/4" to "3 of 4" to prevent Excel date interpretation
    ];

    // Add pick data for each game (predicted winner + confidence points)
    games.forEach(game => {
      const pick = picksMap.get(game.id);
      if (pick) {
        // Format: "Predicted Winner (Confidence Points)" to match leaderboard
        const pickText = `${pick.predicted_winner} (${pick.confidence_points})`;
        row.push(pickText);
      } else {
        row.push('-');
      }
    });

    rows.push(row);
  });

  // Add Monday night scores if available
  if (mondayNightScores.length > 0) {
    rows.push([]); // Empty row
    rows.push(['MONDAY NIGHT SCORES (TIE BREAKERS)']);
    rows.push(['Participant Name', 'Predicted Score', 'Week', 'Season']);
    
    mondayNightScores.forEach(score => {
      const participantName = participantsMap.get(score.participant_id) || score.participant_id;
      rows.push([
        participantName,
        score.answer.toString(),
        week.toString(),
        season.toString()
      ]);
    });
  }

  return rows.map(row => 
    row.map(cell => `"${cell}"`).join(',')
  ).join('\n');
}

/**
 * Create CSV content for period data export
 */
function createPeriodDataCSV(periodData: PeriodExportData[], periodWeeks: number[]): string {
  debugLog('exportPeriodData - periodData', periodData);
  debugLog('exportPeriodData - periodWeeks', periodWeeks);
  const headers = [
    'Place',
    'Participant Name',
    'Period',
    'Total Points',
    'Total Correct Picks',
    'Total Picks',
    'Weeks Won',
    'Average Points per Week',
    'Accuracy %'
  ];

  // Add weekly breakdown headers
  periodWeeks.forEach(week => {
    headers.push(`Week ${week} Points`);
    headers.push(`Week ${week} Correct`);
    headers.push(`Week ${week} Rank`);
  });

  const rows = [headers];

  periodData.forEach((participant, index) => {
    debugLog('exportPeriodData - participant', participant);
    const row = [
      (index + 1).toString(),
      participant.participant_name,
      participant.period_name.replace('Period', 'Q'),
      participant.total_points.toString(),
      participant.total_correct_picks.toString(),
      participant.total_picks.toString(),
      participant.weeks_won.toString(),
      (participant.total_points / periodWeeks.length).toFixed(2),
      participant.total_picks > 0 ? 
        ((participant.total_correct_picks / participant.total_picks) * 100).toFixed(2) : '0.00'
    ];

    // Add weekly breakdown data
    periodWeeks.forEach(week => {
      debugLog('exportPeriodData - week', week);
      const weekData = participant.weekly_breakdown.find(w => w.week === week);
      row.push(weekData ? weekData.points.toString() : '0');
      row.push(weekData ? weekData.correct_picks.toString() : '0');
      row.push(weekData ? weekData.rank.toString() : 'N/A');
    });

    rows.push(row);
  });

  return rows.map(row => 
    row.map(cell => `"${cell}"`).join(',')
  ).join('\n');
}

/**
 * Get tie-breaker weeks based on period name
 */
function getPeriodWeeks(periodName: string): number[] {
  switch (periodName.toLowerCase()) {
    case 'period 1':
      return [1, 2, 3, 4];
    case 'period 2':
      return [5, 6, 7, 8, 9];
    case 'period 3':
      return [10, 11, 12, 13, 14];
    case 'period 4':
      return [15, 16, 17, 18];
    default:
      return [];
  }
}

