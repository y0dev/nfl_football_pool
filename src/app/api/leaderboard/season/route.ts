import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const poolId = searchParams.get('poolId');
    const season = searchParams.get('season');
    const currentWeek = searchParams.get('currentWeek');
    const currentSeasonType = searchParams.get('currentSeasonType');

    if (!poolId || !season) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters: poolId and season' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // Get all participants for this pool
    const { data: participants, error: participantsError } = await supabase
      .from('participants')
      .select('id, name')
      .eq('pool_id', poolId);



    if (participantsError) {
      console.error('Error fetching participants:', participantsError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch participants' },
        { status: 500 }
      );
    }

    if (!participants || participants.length === 0) {
      return NextResponse.json(
        { success: true, leaderboard: [] },
        { status: 200 }
      );
    }

    // Parse current week and season type
    const currentWeekNum = currentWeek ? parseInt(currentWeek) : null;
    const currentSeasonTypeNum = currentSeasonType ? parseInt(currentSeasonType) : null;

    // Get games for the season up to the current week and season type
    let gamesQuery = supabase
      .from('games')
      .select('week, season_type')
      .eq('season', parseInt(season))
      .order('week', { ascending: true });

    // If current week and season type are provided, filter games up to that point
    if (currentWeekNum !== null && currentSeasonTypeNum !== null) {
      // Filter games up to the current week within the current season type
      gamesQuery = gamesQuery
        .lte('week', currentWeekNum)
        .eq('season_type', currentSeasonTypeNum);
    }

    const { data: games, error: gamesError } = await gamesQuery;

    if (gamesError) {
      console.error('Error fetching games:', gamesError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch games' },
        { status: 500 }
      );
    }

    // Get unique weeks from games, grouped by season type
    const availableWeeks = [...new Set(games.map(g => g.week))];
    
    // For playoff games, get playoff confidence points for all participants
    const isPlayoffSeasonType = currentSeasonTypeNum === 3;
    const playoffConfidencePointsMap = new Map<string, Record<string, number>>();
    
    if (isPlayoffSeasonType) {
      for (const participant of participants) {
        const { data: playoffPoints, error: playoffError } = await supabase
          .from('playoff_confidence_points')
          .select('team_name, confidence_points')
          .eq('pool_id', poolId)
          .eq('season', parseInt(season))
          .eq('participant_id', participant.id);
        
        if (!playoffError && playoffPoints && playoffPoints.length > 0) {
          const pointsMap: Record<string, number> = {};
          playoffPoints.forEach(item => {
            pointsMap[item.team_name] = item.confidence_points;
          });
          playoffConfidencePointsMap.set(participant.id, pointsMap);
        }
      }
    }

    // Build season leaderboard by calculating scores from picks for each week
    const seasonLeaderboard = await Promise.all(
      participants.map(async (participant) => {
        let totalPoints = 0;
        let weeksPlayed = 0;
        let bestWeek = 0;
        let bestWeekScore = 0;

        // Calculate scores for each available week
        for (const week of availableWeeks) {
          try {
            // Get picks for this participant for this week, filtered by season_type
            let picksQuery = supabase
              .from('picks')
              .select(`
                predicted_winner,
                confidence_points,
                games!inner(winner, home_team, away_team, season_type)
              `)
              .eq('pool_id', poolId)
              .eq('participant_id', participant.id)
              .eq('games.week', week);
            
            // Only filter by season_type if it's provided
            if (currentSeasonTypeNum !== null) {
              picksQuery = picksQuery.eq('games.season_type', currentSeasonTypeNum);
            }
            
            const { data: picks, error: picksError } = await picksQuery;

            if (!picksError && picks && picks.length > 0) {
              // Calculate week score
              let weekScore = 0;
              let correctPicks = 0;

              picks.forEach((pick: any) => {
                const game = pick.games;
                // Only count games that have finished (have winners)
                if (game.winner && pick.predicted_winner === game.winner) {
                  // For playoff games, use playoff confidence points
                  if (isPlayoffSeasonType) {
                    const participantPlayoffPoints = playoffConfidencePointsMap.get(participant.id);
                    if (participantPlayoffPoints && participantPlayoffPoints[pick.predicted_winner]) {
                      weekScore += participantPlayoffPoints[pick.predicted_winner];
                    }
                  } else {
                    // For regular season, use confidence points from picks table
                    weekScore += pick.confidence_points || 0;
                  }
                  correctPicks++;
                }
              });

              if (weekScore > 0) {
                totalPoints += weekScore;
                weeksPlayed++;

                // Track best week performance
                if (weekScore > bestWeekScore) {
                  bestWeekScore = weekScore;
                  bestWeek = week;
                }
              }
            }
          } catch (error) {
            // Skip weeks where participant didn't play or there was an error
            console.warn(`Error processing week ${week} for participant ${participant.id}:`, error);
          }
        }

        const averagePoints = weeksPlayed > 0 ? totalPoints / weeksPlayed : 0;

        return {
          participant_name: participant.name,
          total_points: totalPoints,
          weeks_played: weeksPlayed,
          average_points: averagePoints,
          best_week: bestWeek,
          best_week_score: bestWeekScore,
        };
      })
    );

    // Sort by total points (descending), then by average points (descending)
    const sortedLeaderboard = seasonLeaderboard
      .filter(entry => entry.weeks_played > 0) // Only show participants who played at least one week
      .sort((a, b) => {
        if (b.total_points !== a.total_points) {
          return b.total_points - a.total_points;
        }
        return b.average_points - a.average_points;
      });

    return NextResponse.json({
      success: true,
      leaderboard: sortedLeaderboard,
      season: parseInt(season),
      total_weeks: availableWeeks.length,
      participants_count: participants.length,
      current_week: currentWeek ? parseInt(currentWeek) : null,
      current_season_type: currentSeasonType ? parseInt(currentSeasonType) : null,
      weeks_included: availableWeeks.sort((a, b) => a - b),
    });

  } catch (error) {
    console.error('Error in season leaderboard API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
