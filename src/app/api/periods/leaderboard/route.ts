import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { debugLog } from '@/lib/utils';
import { getPlayoffConfidencePoints } from '@/lib/playoff-utils';

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
    const seasonTypeParam = searchParams.get('seasonType');
    const seasonType = seasonTypeParam ? parseInt(seasonTypeParam) : 2; // Default to regular season
    
    debugLog('Period leaderboard API request:', {
      poolId,
      season,
      periodName,
      seasonType
    });
    
    if (!poolId || !season || !periodName) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();
    
    // Get tie-breaker weeks using the same logic as export
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

    // Get all picks for the tie-breaker weeks - use same approach as weekly leaderboard
    const gameIds = await getGameIdsForWeeks(supabase, periodWeeks, parseInt(season), seasonType);
    debugLog('Period Leaderboard - Game IDs for weeks:', gameIds);
    debugLog('Period Leaderboard - Number of games:', gameIds.length);
    
    // Also get all games to ensure we have the complete list
    // Use seasonType from parameter (3 for playoffs, 2 for regular season, 1 for preseason)
    const { data: allGames, error: allGamesError } = await supabase
      .from('games')
      .select('id')
      .eq('season', parseInt(season))
      .eq('season_type', seasonType)
      .in('week', periodWeeks);
      
    let finalGameIds = gameIds;
    if (!allGamesError && allGames) {
      const allGameIds = allGames.map(game => game.id);
      // debugLog('Period Leaderboard - All game IDs from direct query:', allGameIds);
      // debugLog('Period Leaderboard - All games count:', allGameIds.length);
      
      // Use the larger set of game IDs
      finalGameIds = allGameIds.length > gameIds.length ? allGameIds : gameIds;
      // debugLog('Period Leaderboard - Using game IDs:', finalGameIds);
    }
    
    // Get picks for all participants in this pool for these games
    const { data: picksData, error: picksError } = await supabase
      .from('picks')
      .select(`
        id,
        participant_id,
        game_id,
        predicted_winner,
        confidence_points
      `)
      .eq('pool_id', poolId)
      .in('game_id', finalGameIds);

    // debugLog('Period Leaderboard - Picks data:', picksData);
    // debugLog('Period Leaderboard - Picks error:', picksError);
    // debugLog('Period Leaderboard - Number of picks:', picksData?.length || 0);
    
    // Debug: Check picks per participant
    if (picksData) {
      const picksPerParticipant = new Map<string, number>();
      picksData.forEach(pick => {
        const count = picksPerParticipant.get(pick.participant_id) || 0;
        picksPerParticipant.set(pick.participant_id, count + 1);
      });
      debugLog('Period Leaderboard - Picks per participant:', Array.from(picksPerParticipant.entries()));
      
      // Calculate expected picks per participant
      const expectedPicksPerParticipant = finalGameIds.length;
      // Display expected picks per participant in debug log
      // debugLog(`Period Leaderboard - Expected picks per participant: ${expectedPicksPerParticipant} (${finalGameIds.length} games)`);
      
      // Check if any participant is missing picks
      const missingPicksParticipants: string[] = [];
      participants.forEach(participant => {
        const actualPicks = picksPerParticipant.get(participant.id) || 0;
        if (actualPicks < expectedPicksPerParticipant) {
          // debugLog(`WARNING: ${participant.name} has only ${actualPicks} picks, expected ${expectedPicksPerParticipant}`);
          missingPicksParticipants.push(participant.id);
        }
      });
      
      // If we have missing picks, try to fetch them individually
      if (missingPicksParticipants.length > 0) {
        // debugLog(`Attempting to fetch missing picks for ${missingPicksParticipants.length} participants`);
        
        for (const participantId of missingPicksParticipants) {
          const { data: additionalPicks, error: additionalError } = await supabase
            .from('picks')
            .select(`
              id,
              participant_id,
              game_id,
              predicted_winner,
              confidence_points
            `)
            .eq('pool_id', poolId)
            .eq('participant_id', participantId)
            .in('game_id', finalGameIds);
            
          if (!additionalError && additionalPicks) {
            debugLog(`Found ${additionalPicks.length} additional picks for participant ${participantId}`);
            picksData.push(...additionalPicks);
          }
        }
        
        // Recalculate picks per participant after adding missing picks
        const updatedPicksPerParticipant = new Map<string, number>();
        picksData.forEach(pick => {
          const count = updatedPicksPerParticipant.get(pick.participant_id) || 0;
          updatedPicksPerParticipant.set(pick.participant_id, count + 1);
        });
        debugLog('Period Leaderboard - Updated picks per participant:', Array.from(updatedPicksPerParticipant.entries()));
        
        // Check if we still have missing picks after the fallback
        const stillMissingPicksParticipants: string[] = [];
        participants.forEach(participant => {
          const actualPicks = updatedPicksPerParticipant.get(participant.id) || 0;
          if (actualPicks < expectedPicksPerParticipant) {
            debugLog(`STILL MISSING: ${participant.name} has only ${actualPicks} picks, expected ${expectedPicksPerParticipant}`);
            stillMissingPicksParticipants.push(participant.id);
          }
        });
        
        if (stillMissingPicksParticipants.length > 0) {
          debugLog(`Creating default picks for ${stillMissingPicksParticipants.length} participants who are still missing picks`);
          
          // For participants still missing picks, create default picks for missing games
          for (const participantId of stillMissingPicksParticipants) {
            const participant = participants.find(p => p.id === participantId);
            const existingPicks = picksData.filter(pick => pick.participant_id === participantId);
            const existingGameIds = new Set(existingPicks.map(pick => pick.game_id));
            
            // Find games this participant doesn't have picks for
            const missingGameIds = finalGameIds.filter(gameId => !existingGameIds.has(gameId));
            
            debugLog(`Creating ${missingGameIds.length} default picks for ${participant?.name || participantId}`);
            
            // Create default picks for missing games
            missingGameIds.forEach(gameId => {
              picksData.push({
                id: `default-${participantId}-${gameId}`,
                participant_id: participantId,
                game_id: gameId,
                predicted_winner: '', // Empty pick
                confidence_points: 0
              });
            });
          }
          
          // Final verification
          const finalPicksPerParticipant = new Map<string, number>();
          picksData.forEach(pick => {
            const count = finalPicksPerParticipant.get(pick.participant_id) || 0;
            finalPicksPerParticipant.set(pick.participant_id, count + 1);
          });
          // debugLog('Period Leaderboard - Final picks per participant:', Array.from(finalPicksPerParticipant.entries()));
        }
      }
    }
    if (picksError) {
      console.error('Error fetching picks:', picksError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch picks data' },
        { status: 500 }
      );
    }

    // Get all games for the tie-breaker weeks
    const { data: gamesData, error: gamesError } = await supabase
      .from('games')
      .select('*')
      .eq('season', parseInt(season))
      .eq('season_type', seasonType)
      .in('week', periodWeeks);

    // Display games data in debug log
    // debugLog('Period Leaderboard - Games data:', gamesData);
    debugLog('Period Leaderboard - Games error:', gamesError);
    debugLog('Period Leaderboard - Number of games:', gamesData?.length || 0);
    
    const totalGamesInQuarter = gamesData?.length || 0;
    debugLog('Period Leaderboard - Total games in quarter:', totalGamesInQuarter);

    // Debug: Check games per week
    if (gamesData) {
      const gamesPerWeek = new Map<number, number>();
      gamesData.forEach(game => {
        const count = gamesPerWeek.get(game.week) || 0;
        gamesPerWeek.set(game.week, count + 1);
      });
      debugLog('Period Leaderboard - Games per week:', Array.from(gamesPerWeek.entries()));
    }

    // Create a map of games by ID for easy lookup
    const gamesMap = new Map(gamesData?.map(game => [game.id, game]) || []);

    // Determine which weeks are completed (all games finished)
    const completedWeeksForTotals = periodWeeks.filter(week => {
      const weekGames = gamesData?.filter(game => game.week === week) || [];
      if (weekGames.length === 0) return false; // No games for this week
      
      const allGamesFinished = weekGames.every(game => {
        const status = game.status?.toLowerCase() || '';
        return status === 'final' || status === 'post';
      });
      
      debugLog(`Week ${week}: ${weekGames.length} games, all finished: ${allGamesFinished}`);
      return allGamesFinished;
    });
    
    debugLog('Completed weeks for quarter totals:', completedWeeksForTotals);

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

    // debugLog('Period Leaderboard - Participants map:', participants);
    // debugLog('Period Leaderboard - Participant totals:', participantTotals);
    
    // For playoff games (seasonType === 3), load playoff confidence points for all participants
    const playoffConfidencePointsMap = new Map<string, Record<string, number>>();
    if (seasonType === 3) {
      debugLog('Loading playoff confidence points for all participants...');
      for (const participant of participants) {
        const pointsMap = await getPlayoffConfidencePoints(poolId, parseInt(season), participant.id);
        if (pointsMap) {
          playoffConfidencePointsMap.set(participant.id, pointsMap);
          debugLog(`Loaded playoff confidence points for ${participant.name}:`, pointsMap);
        } else {
          debugLog(`No playoff confidence points found for ${participant.name}`);
        }
      }
    }
    
    // Group picks by participant and week
    const participantWeekPicks = new Map<string, Map<number, Array<PickData>>>();
    
    // Create a set to track processed picks to avoid duplicates
    const processedPicks = new Set<string>();
    
    picksData?.forEach(pick => {
      const game = gamesMap.get(pick.game_id);
      if (!game) return;
      
      // Create a unique key for this pick to avoid duplicates
      const pickKey = `${pick.participant_id}-${pick.game_id}`;
      if (processedPicks.has(pickKey)) {
        // debugLog(`Skipping duplicate pick: ${pickKey}`);
        return;
      }
      processedPicks.add(pickKey);
      
      const week = game.week;
      if (!participantWeekPicks.has(pick.participant_id)) {
        participantWeekPicks.set(pick.participant_id, new Map());
      }
      if (!participantWeekPicks.get(pick.participant_id)!.has(week)) {
        participantWeekPicks.get(pick.participant_id)!.set(week, []);
      }
      
      // Get participant info from the participants array
      const participant = participants.find(p => p.id === pick.participant_id);
      participantWeekPicks.get(pick.participant_id)!.get(week)!.push({
        ...pick,
        participants: participant ? { name: participant.name, email: participant.email } : { name: 'Unknown', email: '' },
        game_winner: game.winner,
        game_status: game.status
      });
    });

    // Debug: Show participant week picks structure
    debugLog('Period Leaderboard - Participant week picks structure:');
    participantWeekPicks.forEach((weekPicks, participantId) => {
      const participant = participantTotals.get(participantId);
      if (participant) {
        debugLog(`${participant.name} (${participantId}):`, Array.from(weekPicks.keys()).map(week => `${week}: ${weekPicks.get(week)?.length || 0} picks`));
      }
    });

    // Calculate totals for each participant
    participantWeekPicks.forEach((weekPicks, participantId) => {
      const participant = participantTotals.get(participantId);
      if (!participant) return;

      let totalPoints = 0;
      let totalCorrectPicks = 0;
      let totalPicks = 0;
      
      debugLog(`\n=== Processing ${participant.name} ===`);
      
      // Process each week
      periodWeeks.forEach(week => {
        const weekPicksData = weekPicks.get(week) || [];
        let weekPoints = 0;
        let weekCorrectPicks = 0;
        const weekTotalPicks = weekPicksData.length;
        
        debugLog(`Week ${week}: ${weekTotalPicks} picks`);
        
        weekPicksData.forEach((pick: PickData) => {
          const isCorrect = pick.game_winner && pick.predicted_winner.toLowerCase() === pick.game_winner.toLowerCase();
          if (isCorrect) {
            // For playoff games (seasonType === 3), use confidence points from playoff_confidence_points table
            // For regular season, use confidence points from picks table
            let pointsToAdd = pick.confidence_points || 0;
            if (seasonType === 3) {
              const participantPlayoffPoints = playoffConfidencePointsMap.get(participantId);
              if (participantPlayoffPoints && participantPlayoffPoints[pick.predicted_winner]) {
                pointsToAdd = participantPlayoffPoints[pick.predicted_winner];
                debugLog(`  Using playoff confidence points for ${pick.predicted_winner}: ${pointsToAdd}`);
              } else {
                // If no playoff confidence points found, use 0 (shouldn't happen if properly set up)
                pointsToAdd = 0;
                debugLog(`  WARNING: No playoff confidence points found for ${pick.predicted_winner} for participant ${participant.name}`);
              }
            }
            weekPoints += pointsToAdd;
            weekCorrectPicks++;
          }
        });
        
        debugLog(`  Week ${week} results: ${weekPoints} points, ${weekCorrectPicks} correct, ${weekTotalPicks} total picks`);
        
        // Add to totals for all weeks, but only count points for games that have finished
        // This allows real-time standings including partial results from current week
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
      
      debugLog(`  ${participant.name} FINAL TOTALS: ${totalPoints} points, ${totalCorrectPicks} correct, ${totalPicks} total picks`);
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
    let leaderboard = Array.from(participantTotals.values())
      .sort((a, b) => b.total_points - a.total_points);
    
    // Apply top 3 tie-breaker logic for period leaderboard
    const tieBreakerResult = await applyTopThreeTieBreakerLogicForPeriod(leaderboard, poolId, parseInt(season), periodWeeks);
    leaderboard = tieBreakerResult.finalEntries || tieBreakerResult;
    const tieBreakerInfo = tieBreakerResult.tieBreakerInfo || null;
    
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
    
    // Only process weeks that are completed (all games finished) for weeks_won calculation
    // Use the same logic as quarter totals to ensure consistency
    const completedWeeksForWins = completedWeeksForTotals;
    
    debugLog('Completed weeks for weeks_won calculation:', completedWeeksForWins);
    debugLog('All tie-breaker weeks:', periodWeeks);
    
    // Debug: Show weekly scores for each participant
    debugLog('\n=== Weekly Scores for All Participants ===');
    Array.from(participantTotals.values()).forEach(p => {
      debugLog(`${p.name}:`, p.weekly_scores);
    });
    
    completedWeeksForWins.forEach(week => {
      debugLog(`Creating weekly winner data for week ${week}`);
      
      const weekParticipants = Array.from(participantTotals.values())
        .filter(p => p.weekly_scores.some((ws) => ws.week === week))
        .map(p => ({
          ...p,
          weekPoints: p.weekly_scores.find((ws) => ws.week === week)?.points || 0
        }))
        .filter(p => p.weekPoints > 0) // Only consider participants with points
        .sort((a, b) => b.weekPoints - a.weekPoints);
        
      // debugLog(`Week ${week} participants for weekly winners:`, weekParticipants);
      
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
    // debugLog('\n=== Calculating weeks_won from actual week winners ===');
    // debugLog('Processing weeks_won for completed weeks:', Array.from(weekWinners.keys()));
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

    // Update the leaderboard with corrected weeks_won values (keeping tie-breaker order)
    leaderboard.forEach(participant => {
      const participantData = participantTotals.get(participant.participant_id);
      if (participantData) {
        participant.weeks_won = participantData.weeks_won;
      }
    });

    debugLog('\n=== Final Results with Corrected weeks_won ===');
    leaderboard.forEach(p => {
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
      tie_breaker_used: tieBreakerInfo?.wasUsed || false,
      total_participants: participants.length,
      created_at: new Date().toISOString()
    } : null;

    // debugLog('Calculated leaderboard:', leaderboard);
    // debugLog('Calculated weekly winners:', weeklyWinners);
    // debugLog('Calculated period winner:', periodWinner);

    return NextResponse.json({
      success: true,
      data: {
        periodWinner,
        weeklyWinners,
        leaderboard: leaderboard,
        periodInfo: {
          name: periodName,
          weeks: periodWeeks,
          totalWeeks: periodWeeks.length
        },
        games: gamesData || [],
        tieBreakerInfo: tieBreakerInfo
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
    case 'Playoffs':
      // Playoffs include all 4 rounds (weeks 1-4 in postseason)
      return [1, 2, 3, 4];
    default:
      return [];
  }
}

async function getGameIdsForWeeks(supabase: ReturnType<typeof getSupabaseServiceClient>, weeks: number[], season: number, seasonType: number = 2): Promise<string[]> {
  const { data: games, error } = await supabase
    .from('games')
    .select('id')
    .eq('season', season)
    .eq('season_type', seasonType)
    .in('week', weeks);

  if (error) {
    console.error('Error fetching game IDs:', error);
    return [];
  }

  return games?.map((game) => game.id) || [];
}

/**
 * Apply special tie-breaker logic for top 3 positions in period leaderboard
 * - Use Monday night score tie-breaker for everyone in the top 3
 * - If positions 4 and 3 have the same score, use Monday night score to determine who is actually in the top 3
 */
async function applyTopThreeTieBreakerLogicForPeriod(
  entries: ParticipantData[],
  poolId: string,
  season: number,
  periodWeeks: number[]
): Promise<{ finalEntries: ParticipantData[]; tieBreakerInfo: {
  wasUsed: boolean;
  tieBreakerWeek: number | null;
  poolAnswer: number;
  participantsInvolved: Array<{
    participant_id: string;
    name: string;
    points: number;
    mondayNightAnswer: number | null;
    mondayNightDifference: number;
    originalPosition: number;
    finalPosition: number;
  }>;
} | null }> {
  try {
    // If we have less than 4 participants, no special logic needed
    if (entries.length < 4) {
      return { finalEntries: entries, tieBreakerInfo: null };
    }

    // Check if we need to apply Monday night tie-breaker for top 3
    const topThree = entries.slice(0, 3);
    const fourthPlace = entries[3];
    // debugLog('Top three:', topThree);
    // debugLog('Fourth place:', fourthPlace);
    
    // Check for ties within the top 3 and ties for 3rd place with any participants below
    const topThreeScores = topThree.map(entry => entry.total_points);
    const hasTopThreeTies = new Set(topThreeScores).size < topThreeScores.length;
    
    const thirdPlaceScore = topThree[2].total_points;
    // Check if any participant below 3rd place has the same score as 3rd place
    const hasThirdPlaceTies = entries.slice(3).some(entry => entry.total_points === thirdPlaceScore);

    debugLog('Has top three ties:', hasTopThreeTies);
    debugLog('Has third place ties:', hasThirdPlaceTies);
    debugLog('Top three scores:', topThreeScores);
    debugLog('Third place score:', thirdPlaceScore);
    debugLog('Participants below 3rd with same score:', entries.slice(3).filter(e => e.total_points === thirdPlaceScore).map(e => e.name));

    // If no ties in top 3 and no ties for 3rd place, return as is
    if (!hasTopThreeTies && !hasThirdPlaceTies) {
      debugLog('No ties detected, returning original order');
      return { finalEntries: entries, tieBreakerInfo: null };
    }

    // For period leaderboards, we need to find the most recent tie-breaker week
    // that has Monday night scores available
    const supabase = getSupabaseServiceClient();
    
    // Get the most recent week in the period that has tie-breaker data
    const sortedWeeks = [...periodWeeks].sort((a, b) => b - a);
    let tieBreakerWeek = null;
    let tieBreakers = null;
    
    for (const week of sortedWeeks) {
      const { data: weekTieBreakers, error } = await supabase
        .from('tie_breakers')
        .select('participant_id, answer')
        .eq('pool_id', poolId)
        .eq('week', week)
        .eq('season', season)
        .in('participant_id', entries.slice(0, 4).map(e => e.participant_id));

      if (!error && weekTieBreakers && weekTieBreakers.length > 0) {
        tieBreakerWeek = week;
        tieBreakers = weekTieBreakers;
        break;
      }
    }

    if (!tieBreakerWeek || !tieBreakers) {
      debugLog('No Monday night tie-breaker data found for period weeks:', periodWeeks);
      return { finalEntries: entries, tieBreakerInfo: null };
    }

    // Get the pool's Monday night answer for the tie-breaker week
    const { data: pool, error: poolError } = await supabase
      .from('pools')
      .select('tie_breaker_answer')
      .eq('id', poolId)
      .single();

    if (poolError || !pool?.tie_breaker_answer) {
      debugLog('Error loading pool tie-breaker answer:', poolError);
      return { finalEntries: entries, tieBreakerInfo: null };
    }

    debugLog('Pool tie-breaker answer:', pool.tie_breaker_answer);
    const poolAnswer = pool.tie_breaker_answer;

    // Apply tie-breaker logic based on the type of tie
    // eslint-disable-next-line prefer-const
    let finalEntries: ParticipantData[] = [...entries];
    
    if (hasTopThreeTies) {
      debugLog('Applying tie-breaker to tied participants in top 3');
      
      // Group participants by score to identify ties
      const scoreGroups = new Map<number, ParticipantData[]>();
      topThree.forEach(entry => {
        if (!scoreGroups.has(entry.total_points)) {
          scoreGroups.set(entry.total_points, []);
        }
        scoreGroups.get(entry.total_points)!.push(entry);
      });
      
      debugLog('Score groups:', Array.from(scoreGroups.entries()).map(([score, participants]) => ({
        score,
        participants: participants.map(p => p.name)
      })));
      
      // Apply tie-breaker to each group with multiple participants
      let currentIndex = 0;
      for (const [score, participants] of scoreGroups) {
        if (participants.length === 1) {
          // No tie, keep original position
          finalEntries[currentIndex] = participants[0];
          currentIndex++;
        } else {
          // Apply tie-breaker to tied participants
          const tiedWithTieBreakers = participants.map(entry => {
            const tieBreaker = tieBreakers.find(tb => tb.participant_id === entry.participant_id);
            const tieBreakerAnswer = tieBreaker?.answer;
            const difference = tieBreakerAnswer ? Math.abs(tieBreakerAnswer - poolAnswer) : Infinity;
            
            return {
              ...entry,
              mondayNightDifference: difference,
              mondayNightAnswer: tieBreakerAnswer
            };
          });

          // Sort by Monday night difference (closest wins)
          tiedWithTieBreakers.sort((a, b) => a.mondayNightDifference - b.mondayNightDifference);
          
          // Replace tied participants in final entries
          const resolvedTied = tiedWithTieBreakers.map(participant => ({
            participant_id: participant.participant_id,
            name: participant.name,
            email: participant.email,
            total_points: participant.total_points,
            total_correct: participant.total_correct,
            total_picks: participant.total_picks,
            weeks_won: participant.weeks_won,
            weekly_scores: participant.weekly_scores
          }));
          
          // Insert resolved tied participants at their correct positions
          resolvedTied.forEach(participant => {
            finalEntries[currentIndex] = participant;
            currentIndex++;
          });
          
          debugLog(`Resolved tie for score ${score}:`, resolvedTied.map(p => ({
            name: p.name,
            difference: tiedWithTieBreakers.find(t => t.participant_id === p.participant_id)?.mondayNightDifference
          })));
        }
      }
    }
    
    if (hasThirdPlaceTies) {
      debugLog('Applying tie-breaker for 3rd place with participants below');
      
      // Get all participants tied for 3rd place (including 3rd place and any below with same score)
      const thirdPlaceTiedParticipants = entries.filter(entry => entry.total_points === thirdPlaceScore);
      
      debugLog('Participants tied for 3rd place:', thirdPlaceTiedParticipants.map(p => p.name));
      
      // Get tie-breaker data for all tied participants
      const tiedWithTieBreakers = thirdPlaceTiedParticipants.map(entry => {
        const tieBreaker = tieBreakers.find(tb => tb.participant_id === entry.participant_id);
        const tieBreakerAnswer = tieBreaker?.answer;
        const difference = tieBreakerAnswer ? Math.abs(tieBreakerAnswer - poolAnswer) : Infinity;
        
        return {
          ...entry,
          mondayNightDifference: difference,
          mondayNightAnswer: tieBreakerAnswer
        };
      });

      // Sort by Monday night difference (closest wins)
      tiedWithTieBreakers.sort((a, b) => a.mondayNightDifference - b.mondayNightDifference);
      
      debugLog('Tied participants sorted by Monday night score:', tiedWithTieBreakers.map(p => ({
        name: p.name,
        difference: p.mondayNightDifference,
        answer: p.mondayNightAnswer
      })));
      
      // The winner gets 3rd place, others get subsequent positions
      const winner = tiedWithTieBreakers[0];
      const losers = tiedWithTieBreakers.slice(1);
      
      // Find current positions
      const winnerIndex = finalEntries.findIndex(e => e.participant_id === winner.participant_id);
      
      // Move winner to 3rd place if not already there
      if (winnerIndex !== 2) {
        // Remove winner from current position
        const winnerEntry = finalEntries.splice(winnerIndex, 1)[0];
        // Insert at 3rd position
        finalEntries.splice(2, 0, winnerEntry);
        debugLog(`Moved ${winner.name} to 3rd place (was at position ${winnerIndex + 1})`);
      } else {
        debugLog(`${winner.name} already in 3rd place`);
      }
      
      // Move losers to positions after 3rd place
      losers.forEach((loser, index) => {
        const loserIndex = finalEntries.findIndex(e => e.participant_id === loser.participant_id);
        if (loserIndex !== 3 + index) {
          // Remove loser from current position
          const loserEntry = finalEntries.splice(loserIndex, 1)[0];
          // Insert at correct position after 3rd
          finalEntries.splice(3 + index, 0, loserEntry);
          debugLog(`Moved ${loser.name} to position ${4 + index} (was at position ${loserIndex + 1})`);
        }
      });
    }

    // Collect tie-breaker information for the response
    const tieBreakerInfo = {
      wasUsed: hasTopThreeTies || hasThirdPlaceTies,
      tieBreakerWeek: tieBreakerWeek,
      poolAnswer: poolAnswer,
      participantsInvolved: [] as Array<{
        participant_id: string;
        name: string;
        points: number;
        mondayNightAnswer: number | null;
        mondayNightDifference: number;
        originalPosition: number;
        finalPosition: number;
      }>
    };

    // Add tie-breaker information for participants involved
    if (hasTopThreeTies || hasThirdPlaceTies) {
      // Get all participants who were involved in tie-breaking
      const involvedParticipants = new Set<string>();
      
      if (hasTopThreeTies) {
        // Add participants from tied groups in top 3
        const scoreGroups = new Map<number, ParticipantData[]>();
        topThree.forEach(entry => {
          if (!scoreGroups.has(entry.total_points)) {
            scoreGroups.set(entry.total_points, []);
          }
          scoreGroups.get(entry.total_points)!.push(entry);
        });
        
        for (const [, participants] of scoreGroups) {
          if (participants.length > 1) {
            participants.forEach(p => involvedParticipants.add(p.participant_id));
          }
        }
      }
      
      if (hasThirdPlaceTies) {
        // Add participants tied for 3rd place
        const thirdPlaceTiedParticipants = entries.filter(entry => entry.total_points === thirdPlaceScore);
        thirdPlaceTiedParticipants.forEach(p => involvedParticipants.add(p.participant_id));
      }

      // Collect tie-breaker data for involved participants
      involvedParticipants.forEach(participantId => {
        const originalEntry = entries.find(e => e.participant_id === participantId);
        const finalEntry = finalEntries.find(e => e.participant_id === participantId);
        const tieBreaker = tieBreakers?.find(tb => tb.participant_id === participantId);
        
        if (originalEntry && finalEntry) {
          const originalPosition = entries.findIndex(e => e.participant_id === participantId) + 1;
          const finalPosition = finalEntries.findIndex(e => e.participant_id === participantId) + 1;
          
          tieBreakerInfo.participantsInvolved.push({
            participant_id: participantId,
            name: originalEntry.name,
            points: originalEntry.total_points,
            mondayNightAnswer: tieBreaker?.answer || null,
            mondayNightDifference: tieBreaker ? Math.abs(tieBreaker.answer - poolAnswer) : Infinity,
            originalPosition,
            finalPosition
          });
        }
      });
    }

    debugLog('Applied period top 3 tie-breaker logic:', {
      tieBreakerWeek,
      originalTopThree: topThree.map(e => ({ name: e.name, points: e.total_points })),
      finalTopThree: finalEntries.slice(0, 3).map(e => ({ name: e.name, points: e.total_points })),
      hasTopThreeTies,
      hasThirdPlaceTies,
      poolAnswer,
      tieBreakerInfo
    });
    

    return { finalEntries, tieBreakerInfo };
  } catch (error) {
    debugLog('Error applying period top 3 tie-breaker logic:', error);
    return { finalEntries: entries, tieBreakerInfo: null };
  }
}
