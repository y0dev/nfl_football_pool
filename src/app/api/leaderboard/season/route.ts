import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const poolId = searchParams.get('poolId');
    const season = searchParams.get('season');
    const week = searchParams.get('week'); // Optional: limit to weeks up to this point

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

    // Get games for the season, optionally limited to weeks up to the specified week
    let gamesQuery = supabase
      .from('games')
      .select('week, season_type')
      .eq('season', parseInt(season))
      .order('week', { ascending: true });
    
    if (week && !isNaN(parseInt(week))) {
      gamesQuery = gamesQuery.lte('week', parseInt(week));
    }
    
    const { data: games, error: gamesError } = await gamesQuery;

    if (gamesError) {
      console.error('Error fetching games:', gamesError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch games' },
        { status: 500 }
      );
    }

    // Get unique weeks from games
    const availableWeeks = [...new Set(games.map(g => g.week))];

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
            // Get picks for this participant for this week
            const { data: picks, error: picksError } = await supabase
              .from('picks')
              .select(`
                predicted_winner,
                confidence_points,
                games!inner(winner, home_team, away_team)
              `)
              .eq('pool_id', poolId)
              .eq('participant_id', participant.id)
              .eq('games.week', week);

            if (!picksError && picks && picks.length > 0) {
              // Calculate week score
              let weekScore = 0;
              let correctPicks = 0;

              picks.forEach((pick: { predicted_winner: string; confidence_points: number; games: { winner: string | null }[] }) => {
                const game = pick.games[0]; // Get the first (and should be only) game
                if (game && game.winner && pick.predicted_winner === game.winner) {
                  weekScore += pick.confidence_points;
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
      week_scope: week ? parseInt(week) : null,
      total_weeks: availableWeeks.length,
      participants_count: participants.length,
    });

  } catch (error) {
    console.error('Error in season leaderboard API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
