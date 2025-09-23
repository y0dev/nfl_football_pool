import { getSupabaseClient } from './supabase';
import { PERIOD_WEEKS } from './utils';

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
  season: number = new Date().getFullYear(),
  seasonType: number = 2
): Promise<string> {
  try {
    const supabase = getSupabaseClient();
    
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

    // Get picks for these games
    const { data: picks, error: picksError } = await supabase
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
      .in('game_id', games.map(g => g.id))
      .order('participants.name', { ascending: true });

    if (picksError) {
      console.error('Error fetching picks for export:', picksError);
      throw new Error('Failed to fetch picks data');
    }

    if (!picks || picks.length === 0) {
      throw new Error('No picks found for this week');
    }

    // Get Monday night scores if this is a period week
    const isPeriodWeek = PERIOD_WEEKS.includes(week as typeof PERIOD_WEEKS[number]);
    let mondayNightScores: any[] = [];
    
    if (isPeriodWeek) {
      const { data: tieBreakers, error: tieBreakerError } = await supabase
        .from('tie_breakers')
        .select(`
          participant_id,
          answer,
          participants!inner(name)
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

    // Transform data for CSV export
    const exportData: WeeklyExportData[] = picks.map((pick: any) => {
      const game = gamesMap.get(pick.game_id);
      const participant = pick.participants;
      
      if (!game) {
        console.warn(`Game not found for pick ${pick.id}, game_id: ${pick.game_id}`);
        return null;
      }

      const isCorrect = game.winner && pick.predicted_winner.toLowerCase() === game.winner.toLowerCase();
      const pointsEarned = isCorrect ? pick.confidence_points : 0;

      return {
        participant_id: pick.participant_id,
        participant_name: participant.name,
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
    }).filter(Boolean); // Remove any null entries

    // Create CSV content
    const csvContent = createWeeklyPicksCSV(exportData, mondayNightScores, week, season);
    
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
    const supabase = getSupabaseClient();
    
    // Get period weeks
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

    // Get scores for all weeks in the period
    const { data: scores, error: scoresError } = await supabase
      .from('scores')
      .select(`
        participant_id,
        week,
        points,
        correct_picks,
        total_picks,
        rank,
        participants!inner(name)
      `)
      .eq('pool_id', poolId)
      .eq('season', season)
      .in('week', periodWeeks)
      .order('participant_id', { ascending: true })
      .order('week', { ascending: true });

    if (scoresError) {
      console.error('Error fetching scores:', scoresError);
      throw new Error('Failed to fetch scores data');
    }

    // Get weekly winners for the period
    const { data: weeklyWinners, error: winnersError } = await supabase
      .from('weekly_winners')
      .select('week, winner_participant_id')
      .eq('pool_id', poolId)
      .eq('season', season)
      .in('week', periodWeeks);

    if (winnersError) {
      console.error('Error fetching weekly winners:', winnersError);
    }

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

    // Process scores data
    scores?.forEach(score => {
      const participant = participantTotals.get(score.participant_id);
      if (participant) {
        participant.total_points += score.points || 0;
        participant.total_correct_picks += score.correct_picks || 0;
        participant.total_picks += score.total_picks || 0;
        
        participant.weekly_breakdown.push({
          week: score.week,
          points: score.points || 0,
          correct_picks: score.correct_picks || 0,
          total_picks: score.total_picks || 0,
          rank: score.rank || 0
        });
      }
    });

    // Count weeks won
    weeklyWinners?.forEach(winner => {
      const participant = participantTotals.get(winner.winner_participant_id);
      if (participant) {
        participant.weeks_won += 1;
      }
    });

    // Convert to array and sort by total points
    const exportData = Array.from(participantTotals.values())
      .sort((a, b) => b.total_points - a.total_points);

    // Create CSV content
    const csvContent = createPeriodDataCSV(exportData, periodWeeks);
    
    return csvContent;
    
  } catch (error) {
    console.error('Failed to export period data:', error);
    throw error;
  }
}

/**
 * Create CSV content for weekly picks export
 */
function createWeeklyPicksCSV(
  picksData: WeeklyExportData[], 
  mondayNightScores: any[], 
  week: number, 
  season: number
): string {
  const headers = [
    'Participant Name',
    'Game',
    'Predicted Winner',
    'Confidence Points',
    'Game Status',
    'Actual Winner',
    'Home Score',
    'Away Score',
    'Is Correct',
    'Points Earned',
    'Kickoff Time'
  ];

  const rows = [headers];

  // Group picks by participant
  const participantGroups = new Map<string, WeeklyExportData[]>();
  picksData.forEach(pick => {
    if (!participantGroups.has(pick.participant_name)) {
      participantGroups.set(pick.participant_name, []);
    }
    participantGroups.get(pick.participant_name)!.push(pick);
  });

  // Create rows for each participant
  participantGroups.forEach((picks, participantName) => {
    picks.forEach(pick => {
      const row = [
        participantName,
        `${pick.away_team} @ ${pick.home_team}`,
        pick.predicted_winner,
        pick.confidence_points.toString(),
        pick.game_status,
        pick.game_winner || 'TBD',
        pick.home_score?.toString() || 'TBD',
        pick.away_score?.toString() || 'TBD',
        pick.is_correct ? 'Yes' : 'No',
        pick.points_earned.toString(),
        new Date(pick.kickoff_time).toLocaleString()
      ];
      rows.push(row);
    });
  });

  // Add Monday night scores section if applicable
  if (mondayNightScores.length > 0) {
    rows.push([]); // Empty row
    rows.push(['MONDAY NIGHT SCORES (TIE BREAKERS)']);
    rows.push(['Participant Name', 'Predicted Score', 'Week', 'Season']);
    
    mondayNightScores.forEach(score => {
      rows.push([
        score.participants.name,
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
  const headers = [
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

  periodData.forEach(participant => {
    const row = [
      participant.participant_name,
      participant.period_name,
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
 * Get period weeks based on period name
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

/**
 * Download CSV file
 */
function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
