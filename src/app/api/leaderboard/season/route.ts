import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { fetchAllPicksForGames } from '@/lib/season-review';
import { debugError } from '@/lib/utils';

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
      debugError('Error fetching participants:', participantsError);
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
      .select('id, week, winner')
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
      debugError('Error fetching games:', gamesError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch games' },
        { status: 500 }
      );
    }

    // week -> game ids, and game id -> {week, winner} for O(1) lookups below
    const weekByGameId = new Map<string, number>();
    const winnerByGameId = new Map<string, string | null>();
    games.forEach(g => {
      weekByGameId.set(g.id, g.week);
      winnerByGameId.set(g.id, g.winner);
    });
    const availableWeeks = [...new Set(games.map(g => g.week))];
    const gameIds = games.map(g => g.id);

    // For playoff games, get playoff confidence points for all participants
    // in one query instead of one query per participant.
    const isPlayoffSeasonType = currentSeasonTypeNum === 3;
    const playoffConfidencePointsMap = new Map<string, Record<string, number>>();

    if (isPlayoffSeasonType) {
      const { data: playoffPoints } = await supabase
        .from('playoff_confidence_points')
        .select('participant_id, team_name, confidence_points')
        .eq('pool_id', poolId)
        .eq('season', parseInt(season))
        .in('participant_id', participants.map(p => p.id));

      (playoffPoints ?? []).forEach(item => {
        if (!playoffConfidencePointsMap.has(item.participant_id)) {
          playoffConfidencePointsMap.set(item.participant_id, {});
        }
        playoffConfidencePointsMap.get(item.participant_id)![item.team_name] = item.confidence_points;
      });
    }

    // Single bulk (paginated) fetch for every pick across every relevant
    // week, instead of one query per participant per week (was up to
    // participants x weeks sequential queries — e.g. 17 x 18 = 306 for a
    // full season).
    const picksByParticipantWeek = new Map<string, Map<number, { points: number; correct: number }>>();
    if (gameIds.length > 0) {
      const allPicks = await fetchAllPicksForGames(supabase, poolId, gameIds);

      allPicks.forEach(pick => {
        const week = weekByGameId.get(pick.game_id);
        if (week === undefined) return;
        const winner = winnerByGameId.get(pick.game_id);

        if (!picksByParticipantWeek.has(pick.participant_id)) {
          picksByParticipantWeek.set(pick.participant_id, new Map());
        }
        const weekMap = picksByParticipantWeek.get(pick.participant_id)!;
        if (!weekMap.has(week)) weekMap.set(week, { points: 0, correct: 0 });
        const entry = weekMap.get(week)!;

        // Only count games that have finished (have winners)
        if (winner && pick.predicted_winner === winner) {
          if (isPlayoffSeasonType) {
            const participantPlayoffPoints = playoffConfidencePointsMap.get(pick.participant_id);
            if (participantPlayoffPoints && participantPlayoffPoints[pick.predicted_winner]) {
              entry.points += participantPlayoffPoints[pick.predicted_winner];
            }
          } else {
            entry.points += pick.confidence_points || 0;
          }
          entry.correct++;
        }
      });
    }

    // Build season leaderboard from the pre-grouped picks above.
    const seasonLeaderboard = participants.map(participant => {
      let totalPoints = 0;
      let totalCorrectPicks = 0;
      let weeksPlayed = 0;
      let bestWeek = 0;
      let bestWeekScore = 0;

      const weekMap = picksByParticipantWeek.get(participant.id);

      for (const week of availableWeeks) {
        const entry = weekMap?.get(week);
        if (!entry) continue;

        // "Played" means they submitted picks this week, not that they
        // scored > 0 — a week where every pick happened to be wrong
        // (or hasn't been decided yet) still counts, otherwise weeks
        // played gets understated and averages skew high.
        totalPoints += entry.points;
        totalCorrectPicks += entry.correct;
        weeksPlayed++;

        if (entry.points > bestWeekScore) {
          bestWeekScore = entry.points;
          bestWeek = week;
        }
      }

      const averagePoints = weeksPlayed > 0 ? totalPoints / weeksPlayed : 0;

      return {
        participant_id: participant.id,
        participant_name: participant.name,
        total_points: totalPoints,
        total_correct_picks: totalCorrectPicks,
        weeks_played: weeksPlayed,
        average_points: averagePoints,
        best_week: bestWeek,
        best_week_score: bestWeekScore,
      };
    });

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
    debugError('Error in season leaderboard API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
