import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { debugLog } from '@/lib/utils';

interface ParticipantData {
  participant_id: string;
  name: string;
  email: string;
  total_points: number;
  total_correct: number;
  total_picks: number;
  weeks_won: number;
  weekly_scores: Array<{
    week: number;
    points: number;
    correct: number;
    total: number;
  }>;
}

interface PickData {
  id: string;
  participant_id: string;
  game_id: string;
  predicted_winner: string;
  confidence_points: number;
  participants: { name: string; email: string };
  game_winner?: string | null;
  game_status?: string;
}


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const poolId = searchParams.get('poolId');
    const season = searchParams.get('season');
    const periodName = searchParams.get('periodName');
    
    debugLog('Period leaderboard API request:', {
      poolId,
      season,
      periodName
    });
    
    if (!poolId || !season || !periodName) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();
    
    // Get period weeks using the same logic as export
    const periodWeeks = getPeriodWeeks(periodName);
    if (periodWeeks.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid period name' },
        { status: 400 }
      );
    }

    // Get all participants in the pool
    const { data: participants, error: participantsError } = await supabase
      .from('participants')
      .select('id, name, email')
      .eq('pool_id', poolId)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (participantsError) {
      console.error('Error fetching participants:', participantsError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch participants' },
        { status: 500 }
      );
    }

    if (!participants || participants.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No participants found in this pool' },
        { status: 404 }
      );
    }

    // Get all picks for the period weeks
    const { data: picksData, error: picksError } = await supabase
      .from('picks')
      .select(`
        id,
        participant_id,
        game_id,
        predicted_winner,
        confidence_points,
        participants!inner(name, email)
      `)
      .eq('pool_id', poolId)
      .in('game_id', await getGameIdsForWeeks(supabase, periodWeeks, parseInt(season)));

    if (picksError) {
      console.error('Error fetching picks:', picksError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch picks data' },
        { status: 500 }
      );
    }

    // Get all games for the period weeks
    const { data: gamesData, error: gamesError } = await supabase
      .from('games')
      .select('*')
      .eq('season', parseInt(season))
      .eq('season_type', 2)
      .in('week', periodWeeks);

    if (gamesError) {
      console.error('Error fetching games:', gamesError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch games data' },
        { status: 500 }
      );
    }

    // Create a map of games by ID for easy lookup
    const gamesMap = new Map(gamesData?.map(game => [game.id, game]) || []);

    // Calculate period totals for each participant using the same logic as export
    const participantTotals = new Map<string, ParticipantData>();
    
    participants.forEach(participant => {
      participantTotals.set(participant.id, {
        participant_id: participant.id,
        name: participant.name,
        email: participant.email,
        total_points: 0,
        total_correct: 0,
        total_picks: 0,
        weeks_won: 0,
        weekly_scores: []
      });
    });

    // Group picks by participant and week
    const participantWeekPicks = new Map<string, Map<number, Array<PickData>>>();
    
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
        participants: pick.participants as unknown as { name: string; email: string },
        game_winner: game.winner,
        game_status: game.status
      });
    });

    // Calculate totals for each participant
    participantWeekPicks.forEach((weekPicks, participantId) => {
      // debugLog('Participant week picks:', weekPicks);
      const participant = participantTotals.get(participantId);
      if (!participant) return;

      let totalPoints = 0;
      let totalCorrectPicks = 0;
      let totalPicks = 0;
      debugLog('Participant:', participant);
      // Process each week
      periodWeeks.forEach(week => {
        const weekPicksData = weekPicks.get(week) || [];
        let weekPoints = 0;
        let weekCorrectPicks = 0;
        const weekTotalPicks = weekPicksData.length;
        if (week === 2) {
          debugLog('Week picks data:', weekPicksData[0]);
        }
        // debugLog('Week:', week);
        // debugLog('Week picks data:', weekPicksData);
        weekPicksData.forEach((pick: PickData) => {
          const isCorrect = pick.game_winner && pick.predicted_winner.toLowerCase() === pick.game_winner.toLowerCase();
          if (isCorrect) {
            weekPoints += pick.confidence_points;
            weekCorrectPicks++;
          }
        });
        debugLog('Week points:', weekPoints);
        debugLog('Week correct picks:', weekCorrectPicks);
        debugLog('Week total picks:', weekTotalPicks);
        totalPoints += weekPoints;
        totalCorrectPicks += weekCorrectPicks;
        totalPicks += weekTotalPicks;

        // Add to weekly breakdown
        participant.weekly_scores.push({
          week: week,
          points: weekPoints,
          correct: weekCorrectPicks,
          total: weekTotalPicks
        });

        // Note: We'll calculate week winners after processing all participants
        // This ensures we have all the data before determining winners
      });

      participant.total_points = totalPoints;
      participant.total_correct = totalCorrectPicks;
      participant.total_picks = totalPicks;
      // weeks_won will be calculated after all participants are processed
    });

    // Reset weeks_won to 0 for all participants before calculating
    debugLog('Resetting weeks_won to 0 for all participants');
    participantTotals.forEach(participant => {
      debugLog(`Resetting ${participant.name}: ${participant.weeks_won} -> 0`);
      participant.weeks_won = 0;
    });

    // Debug: Check for duplicate participant IDs
    const participantIds = Array.from(participantTotals.keys());
    const uniqueIds = new Set(participantIds);
    if (participantIds.length !== uniqueIds.size) {
      debugLog('WARNING: Duplicate participant IDs found!', participantIds);
    }
    debugLog('Total participants:', participantIds.length);
    debugLog('Unique participant IDs:', uniqueIds.size);

    // Convert to array and sort by total points
    const leaderboard = Array.from(participantTotals.values())
      .sort((a, b) => b.total_points - a.total_points);
    
    // Debug: Show final weeks_won counts and weekly_scores
    debugLog('\n=== Final Results ===');
    leaderboard.forEach(p => {
      debugLog(`${p.name}: ${p.weeks_won} weeks won`);
      debugLog(`  Weekly scores:`, p.weekly_scores);
    });

    
    // debugLog('Leaderboard:', leaderboard);
    // Create weekly winners data and calculate weeks_won
    const weeklyWinners: Array<{
      week: number;
      winner_name: string;
      winner_points: number;
      winner_correct_picks: number;
      tie_breaker_used: boolean;
      total_participants: number;
    }> = [];

    // Track week winners for weeks_won calculation
    const weekWinners = new Map<number, string[]>(); // week -> array of winner participant IDs
    
    // Only process weeks that have participants with points (completed weeks)
    const completedWeeks = periodWeeks.filter(week => {
      const hasParticipantsWithPoints = Array.from(participantTotals.values())
        .some(p => p.weekly_scores.some(ws => ws.week === week && ws.points > 0));
      return hasParticipantsWithPoints;
    });
    
    debugLog('Completed weeks (with points):', completedWeeks);
    debugLog('All period weeks:', periodWeeks);
    
    // Debug: Show weekly scores for each participant
    debugLog('\n=== Weekly Scores for All Participants ===');
    Array.from(participantTotals.values()).forEach(p => {
      debugLog(`${p.name}:`, p.weekly_scores);
    });
    
    completedWeeks.forEach(week => {
      debugLog(`Creating weekly winner data for week ${week}`);
      
      const weekParticipants = Array.from(participantTotals.values())
        .filter(p => p.weekly_scores.some((ws) => ws.week === week))
        .map(p => ({
          ...p,
          weekPoints: p.weekly_scores.find((ws) => ws.week === week)?.points || 0
        }))
        .filter(p => p.weekPoints > 0) // Only consider participants with points
        .sort((a, b) => b.weekPoints - a.weekPoints);
        
      debugLog(`Week ${week} participants for weekly winners:`, weekParticipants);
      
      if (weekParticipants.length > 0) {
        const winner = weekParticipants[0];
        debugLog(`Week ${week} winner:`, winner);
        
        // Find all participants with the same highest points (in case of ties)
        const maxPoints = winner.weekPoints;
        const winners = weekParticipants.filter(p => p.weekPoints === maxPoints);
        
        debugLog(`Week ${week} - Max points: ${maxPoints}`);
        debugLog(`Week ${week} - All participants with max points:`, winners.map(w => `${w.name} (${w.weekPoints} points)`));
        debugLog(`Week ${week} - Winner IDs to store:`, winners.map(w => w.participant_id));
        
        // Store winners for this week
        weekWinners.set(week, winners.map(w => w.participant_id));
        
        weeklyWinners.push({
          week: week,
          winner_name: winner.name,
          winner_points: winner.weekPoints,
          winner_correct_picks: winner.weekly_scores.find((ws) => ws.week === week)?.correct || 0,
          tie_breaker_used: false, // We could implement tie breaker logic here
          total_participants: weekParticipants.length
        });
      } else {
        debugLog(`No participants with points for week ${week}`);
      }
    });

    // Calculate weeks_won based on actual week winners (only for completed weeks)
    debugLog('\n=== Calculating weeks_won from actual week winners ===');
    debugLog('Processing weeks_won for completed weeks:', Array.from(weekWinners.keys()));
    weekWinners.forEach((winnerIds, week) => {
      debugLog(`Week ${week} winners:`, winnerIds);
      winnerIds.forEach(winnerId => {
        const participant = participantTotals.get(winnerId);
        if (participant) {
          const beforeWins = participant.weeks_won;
          participant.weeks_won++;
          debugLog(`Awarded week ${week} win to ${participant.name} - wins: ${beforeWins} -> ${participant.weeks_won}`);
        } else {
          debugLog(`ERROR: Could not find participant ${winnerId} in participantTotals`);
        }
      });
    });

    // Update the final leaderboard with corrected weeks_won values
    const finalLeaderboard = Array.from(participantTotals.values())
      .sort((a, b) => b.total_points - a.total_points);

    debugLog('\n=== Final Results with Corrected weeks_won ===');
    finalLeaderboard.forEach(p => {
      debugLog(`${p.name}: ${p.weeks_won} weeks won`);
    });

    // Get period winner (highest total points)
    const periodWinner = leaderboard.length > 0 ? {
      id: `period-winner-${poolId}-${season}-${periodName}`,
      pool_id: poolId,
      season: parseInt(season),
      period_name: periodName,
      winner_participant_id: leaderboard[0].participant_id,
      winner_name: leaderboard[0].name,
      winner_points: leaderboard[0].total_points,
      winner_correct_picks: leaderboard[0].total_correct,
      tie_breaker_used: false,
      total_participants: participants.length,
      created_at: new Date().toISOString()
    } : null;

    debugLog('Calculated leaderboard:', leaderboard);
    debugLog('Calculated weekly winners:', weeklyWinners);
    debugLog('Calculated period winner:', periodWinner);

    return NextResponse.json({
      success: true,
      data: {
        periodWinner,
        weeklyWinners,
        leaderboard: finalLeaderboard,
        periodInfo: {
          name: periodName,
          weeks: periodWeeks,
          totalWeeks: periodWeeks.length
        }
      }
    });

  } catch (error) {
    console.error('Error fetching period leaderboard:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function getPeriodWeeks(periodName: string): number[] {
  switch (periodName) {
    case 'Period 1':
      return [1, 2, 3, 4];
    case 'Period 2':
      return [5, 6, 7, 8, 9];
    case 'Period 3':
      return [10, 11, 12, 13, 14];
    case 'Period 4':
      return [15, 16, 17, 18];
    default:
      return [];
  }
}

async function getGameIdsForWeeks(supabase: ReturnType<typeof getSupabaseServiceClient>, weeks: number[], season: number): Promise<string[]> {
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

  return games?.map((game) => game.id) || [];
}
