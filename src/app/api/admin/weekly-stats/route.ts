import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const poolId = searchParams.get('poolId');
    const season = searchParams.get('season');

    if (!poolId || !season) {
      return NextResponse.json(
        { error: 'Pool ID and season are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();
    const seasonNum = parseInt(season);

    // Get all scores for the pool and season
    const { data: scores, error: scoresError } = await supabase
      .from('scores')
      .select(`
        week,
        points,
        correct_picks,
        total_picks,
        participants!inner(name)
      `)
      .eq('pool_id', poolId)
      .eq('season', seasonNum)
      .order('week');

    if (scoresError) {
      console.error('Error fetching scores:', scoresError);
      return NextResponse.json(
        { error: 'Failed to fetch scores' },
        { status: 500 }
      );
    }

    // Get total participants count
    const { data: participants, error: participantsError } = await supabase
      .from('participants')
      .select('id')
      .eq('pool_id', poolId)
      .eq('is_active', true);

    if (participantsError) {
      console.error('Error fetching participants:', participantsError);
    }

    const totalParticipants = participants?.length || 0;

    // Get games count per week
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('week, id')
      .eq('pool_id', poolId)
      .eq('season', seasonNum)
      .eq('season_type', 2) // Regular season
      .order('week');

    if (gamesError) {
      console.error('Error fetching games:', gamesError);
    }

    // Calculate weekly statistics
    const weeklyStatsMap = new Map<number, {
      week: number;
      total_participants: number;
      total_games: number;
      average_points: number;
      highest_score: number;
      lowest_score: number;
      tie_breakers_used: number;
      scores: number[];
    }>();

    // Initialize weeks
    if (scores) {
      scores.forEach(score => {
        if (!weeklyStatsMap.has(score.week)) {
          weeklyStatsMap.set(score.week, {
            week: score.week,
            total_participants: 0,
            total_games: 0,
            average_points: 0,
            highest_score: 0,
            lowest_score: 0,
            tie_breakers_used: 0,
            scores: []
          });
        }
        
        const weekStats = weeklyStatsMap.get(score.week)!;
        weekStats.scores.push(score.points);
        weekStats.total_participants = Math.max(weekStats.total_participants, totalParticipants);
      });
    }

    // Add games count per week
    if (games) {
      games.forEach(game => {
        if (weeklyStatsMap.has(game.week)) {
          weeklyStatsMap.get(game.week)!.total_games++;
        }
      });
    }

    // Calculate statistics for each week
    const weeklyStats: Array<{
      week: number;
      total_participants: number;
      total_games: number;
      average_points: number;
      highest_score: number;
      lowest_score: number;
      tie_breakers_used: number;
    }> = [];

    weeklyStatsMap.forEach((weekData, week) => {
      if (weekData.scores.length > 0) {
        const sortedScores = weekData.scores.sort((a, b) => b - a);
        const highestScore = sortedScores[0];
        const lowestScore = sortedScores[sortedScores.length - 1];
        const averagePoints = weekData.scores.reduce((sum, score) => sum + score, 0) / weekData.scores.length;

        // Count tie breakers used (multiple people with highest score)
        const tieBreakersUsed = sortedScores.filter(score => score === highestScore).length > 1 ? 1 : 0;

        weeklyStats.push({
          week,
          total_participants: weekData.total_participants,
          total_games: weekData.total_games,
          average_points: averagePoints,
          highest_score: highestScore,
          lowest_score: lowestScore,
          tie_breakers_used: tieBreakersUsed
        });
      }
    });

    // Sort by week
    weeklyStats.sort((a, b) => a.week - b.week);

    return NextResponse.json({
      success: true,
      weeklyStats
    });

  } catch (error) {
    console.error('Error in weekly stats API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
