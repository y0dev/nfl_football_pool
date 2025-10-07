import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';

export interface SeasonReviewData {
  seasonWinner: any;
  quarterlyWinners: any[];
  weeklyWinners: any[];
  participantStats: {
    participant_id: string;
    name: string;
    total_points: number;
    total_correct_picks: number;
    total_picks: number;
    weeks_won: number;
    best_week: {
      week: number;
      points: number;
      correct_picks: number;
    };
    worst_week: {
      week: number;
      points: number;
      correct_picks: number;
    };
    average_points_per_week: number;
    consistency_score: number; // Lower standard deviation = more consistent
  }[];
  seasonStats: {
    total_weeks: number;
    total_participants: number;
    total_games: number;
    average_points_per_week: number;
    highest_weekly_score: number;
    lowest_weekly_score: number;
    tie_breakers_used: number;
    most_wins_by_participant: string;
    most_wins_count: number;
    closest_weekly_margin: number;
    biggest_weekly_blowout: number;
  };
}

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

    // Get season winner
    const { data: seasonWinner } = await supabase
      .from('season_winners')
      .select(`
        *,
        pools!inner(name)
      `)
      .eq('pool_id', poolId)
      .eq('season', seasonNum)
      .single();

    // Get quarterly winners
    const { data: quarterlyWinners } = await supabase
      .from('period_winners')
      .select(`
        *,
        pools!inner(name)
      `)
      .eq('pool_id', poolId)
      .eq('season', seasonNum)
      .in('period_name', ['Q1', 'Q2', 'Q3', 'Q4'])
      .order('period_name');

    // Get all weekly winners
    const { data: weeklyWinners } = await supabase
      .from('weekly_winners')
      .select(`
        *,
        pools!inner(name)
      `)
      .eq('pool_id', poolId)
      .eq('season', seasonNum)
      .order('week');

    // Get all participant scores for the season
    const { data: scores } = await supabase
      .from('scores')
      .select(`
        participant_id,
        week,
        points,
        correct_picks,
        total_picks,
        participants!inner(name)
      `)
      .eq('pool_id', poolId)
      .eq('season', seasonNum)
      .order('participant_id, week');

    // Get total games for the season
    const { data: games } = await supabase
      .from('games')
      .select('id')
      .eq('pool_id', poolId)
      .eq('season', seasonNum)
      .eq('season_type', 2); // Regular season

    // Calculate participant statistics
    const participantMap = new Map<string, any>();
    
    if (scores) {
      scores.forEach(score => {
        const participantId = score.participant_id;
        const participantName = (score.participants as any)?.name || 'Unknown';
        
        if (!participantMap.has(participantId)) {
          participantMap.set(participantId, {
            participant_id: participantId,
            name: participantName,
            weekly_scores: [],
            total_points: 0,
            total_correct_picks: 0,
            total_picks: 0,
            weeks_won: 0
          });
        }
        
        const participant = participantMap.get(participantId);
        participant.weekly_scores.push({
          week: score.week,
          points: score.points,
          correct_picks: score.correct_picks,
          total_picks: score.total_picks
        });
        participant.total_points += score.points;
        participant.total_correct_picks += score.correct_picks;
        participant.total_picks += score.total_picks;
      });
    }

    // Count weeks won for each participant
    if (weeklyWinners) {
      weeklyWinners.forEach(winner => {
        if (winner.winner_participant_id) {
          const participant = participantMap.get(winner.winner_participant_id);
          if (participant) {
            participant.weeks_won++;
          }
        }
      });
    }

    // Calculate additional stats for each participant
    const participantStats = Array.from(participantMap.values()).map(participant => {
      const weeklyPoints = participant.weekly_scores.map((s: any) => s.points);
      const bestWeek = participant.weekly_scores.reduce((best: any, current: any) => 
        current.points > best.points ? current : best, participant.weekly_scores[0] || {});
      const worstWeek = participant.weekly_scores.reduce((worst: any, current: any) => 
        current.points < worst.points ? current : worst, participant.weekly_scores[0] || {});
      
      const averagePoints = participant.weekly_scores.length > 0 
        ? participant.total_points / participant.weekly_scores.length 
        : 0;
      
      // Calculate consistency score (lower standard deviation = more consistent)
      const variance = weeklyPoints.length > 0 
        ? weeklyPoints.reduce((sum: number, points: number) => sum + Math.pow(points - averagePoints, 2), 0) / weeklyPoints.length
        : 0;
      const consistencyScore = Math.sqrt(variance);

      return {
        participant_id: participant.participant_id,
        name: participant.name,
        total_points: participant.total_points,
        total_correct_picks: participant.total_correct_picks,
        total_picks: participant.total_picks,
        weeks_won: participant.weeks_won,
        best_week: bestWeek,
        worst_week: worstWeek,
        average_points_per_week: Math.round(averagePoints * 100) / 100,
        consistency_score: Math.round(consistencyScore * 100) / 100
      };
    });

    // Calculate season statistics
    const allWeeklyPoints = participantStats.flatMap(p => 
      participantMap.get(p.participant_id)?.weekly_scores.map((s: any) => s.points) || []
    );
    
    // Calculate weekly margins and blowouts
    let closestWeeklyMargin = 0;
    let biggestWeeklyBlowout = 0;
    
    if (weeklyWinners && weeklyWinners.length > 0) {
      // Get all scores for each week to calculate margins
      const weeklyScores = new Map<number, number[]>();
      
      if (scores) {
        scores.forEach(score => {
          if (!weeklyScores.has(score.week)) {
            weeklyScores.set(score.week, []);
          }
          weeklyScores.get(score.week)!.push(score.points);
        });
      }
      
      // Calculate margins for each week
      weeklyScores.forEach((weekScores, week) => {
        if (weekScores.length > 1) {
          const sortedScores = weekScores.sort((a, b) => b - a);
          const margin = sortedScores[0] - sortedScores[1];
          
          if (closestWeeklyMargin === 0 || margin < closestWeeklyMargin) {
            closestWeeklyMargin = margin;
          }
          
          if (margin > biggestWeeklyBlowout) {
            biggestWeeklyBlowout = margin;
          }
        }
      });
    }
    
    const seasonStats = {
      total_weeks: weeklyWinners?.length || 0,
      total_participants: participantStats.length,
      total_games: games?.length || 0,
      average_points_per_week: allWeeklyPoints.length > 0 
        ? Math.round((allWeeklyPoints.reduce((sum, points) => sum + points, 0) / allWeeklyPoints.length) * 100) / 100
        : 0,
      highest_weekly_score: allWeeklyPoints.length > 0 ? Math.max(...allWeeklyPoints) : 0,
      lowest_weekly_score: allWeeklyPoints.length > 0 ? Math.min(...allWeeklyPoints) : 0,
      tie_breakers_used: weeklyWinners?.filter(w => w.tie_breaker_used).length || 0,
      most_wins_by_participant: participantStats.length > 0 
        ? participantStats.reduce((most, current) => current.weeks_won > most.weeks_won ? current : most).name
        : '',
      most_wins_count: participantStats.length > 0 
        ? Math.max(...participantStats.map(p => p.weeks_won))
        : 0,
      closest_weekly_margin: closestWeeklyMargin,
      biggest_weekly_blowout: biggestWeeklyBlowout
    };

    const seasonReviewData: SeasonReviewData = {
      seasonWinner,
      quarterlyWinners: quarterlyWinners || [],
      weeklyWinners: weeklyWinners || [],
      participantStats: participantStats.sort((a, b) => b.total_points - a.total_points),
      seasonStats
    };

    return NextResponse.json({
      success: true,
      data: seasonReviewData
    });

  } catch (error) {
    console.error('Error in season review API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
