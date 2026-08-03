import { getSupabaseServiceClient } from './supabase';
import { getRegularSeasonPeriods } from './utils';

const PICKS_PAGE_SIZE = 1000;

/**
 * Supabase/PostgREST caps an unbounded select at 1000 rows by default — a
 * full season's picks can exceed that (17 participants x ~16 games x 18
 * weeks is close to 5000 rows), so a single `.in('game_id', gameIds)`
 * fetch would silently truncate and understate every total for the tail
 * end of the season. Pages through with .range() instead. Exported so
 * other picks-heavy season aggregations (e.g. /api/leaderboard/season)
 * can reuse it instead of re-deriving the same pagination logic.
 */
export async function fetchAllPicksForGames(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  poolId: string,
  gameIds: string[]
): Promise<Array<{ participant_id: string; game_id: string; predicted_winner: string; confidence_points: number }>> {
  if (gameIds.length === 0) return [];
  const all: Array<{ participant_id: string; game_id: string; predicted_winner: string; confidence_points: number }> = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('picks')
      .select('participant_id, game_id, predicted_winner, confidence_points')
      .eq('pool_id', poolId)
      .in('game_id', gameIds)
      .range(from, from + PICKS_PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PICKS_PAGE_SIZE) break;
    from += PICKS_PAGE_SIZE;
  }
  return all;
}

interface WeekEntry {
  points: number;
  correct: number;
  total: number;
}

export interface ParticipantStat {
  participant_id: string;
  name: string;
  total_points: number;
  total_correct_picks: number;
  total_incorrect_picks: number;
  total_picks: number;
  weeks_won: number;
  period_wins: number;
  winning_percentage: number;
  longest_streak: number;
  average_weekly_finish: number;
  best_week: { week: number; points: number; correct_picks: number };
  worst_week: { week: number; points: number; correct_picks: number };
  average_points_per_week: number;
  consistency_score: number; // lower standard deviation = more consistent
}

export interface QuarterlyWinner {
  period_name: string;
  winner_participant_id: string;
  winner_name: string;
  period_points: number;
  period_correct_picks: number;
}

export interface WeeklyWinnerEntry {
  week: number;
  winner_participant_id: string;
  winner_name: string;
  winner_points: number;
  winner_correct_picks: number;
  total_participants: number;
}

export interface SeasonChampion {
  pool_id: string;
  season: number;
  winner_participant_id: string;
  winner_name: string;
  total_points: number;
  total_correct_picks: number;
  weeks_won: number;
  periods_won: number;
  tie_breaker_used: boolean;
}

export interface SeasonReviewData {
  poolName: string | null;
  seasonWinner: SeasonChampion | null;
  runnerUp: ParticipantStat | null;
  quarterlyWinners: QuarterlyWinner[];
  weeklyWinners: WeeklyWinnerEntry[];
  participantStats: ParticipantStat[];
  seasonStats: {
    total_weeks: number;
    total_participants: number;
    total_games: number;
    average_points_per_week: number;
    highest_weekly_score: number;
    lowest_weekly_score: number;
    most_wins_by_participant: string;
    most_wins_count: number;
    closest_weekly_margin: number;
    biggest_weekly_blowout: number;
  };
}

function emptyPayload(poolName: string | undefined): SeasonReviewData {
  return {
    poolName: poolName ?? null,
    seasonWinner: null,
    runnerUp: null,
    quarterlyWinners: [],
    weeklyWinners: [],
    participantStats: [],
    seasonStats: {
      total_weeks: 0,
      total_participants: 0,
      total_games: 0,
      average_points_per_week: 0,
      highest_weekly_score: 0,
      lowest_weekly_score: 0,
      most_wins_by_participant: '',
      most_wins_count: 0,
      closest_weekly_margin: 0,
      biggest_weekly_blowout: 0,
    },
  };
}

/**
 * Season Review / season standings — the single, centralized computation
 * used by the Season Review tab, the League Pool Leaderboard tab, and the
 * Close Season action. Computed live from picks + games (the same reliable
 * source the public leaderboard uses), not from season_winners/
 * period_winners/weekly_winners/scores — those derived tables were each
 * only ever populated by separate, independently-written calculators
 * (winner-calculator.ts, close-season's own inline logic) that disagreed
 * with each other and with this computation, plus a "skip if a row already
 * exists" cache that never invalidated stale results.
 *
 * Season Champion algorithm (commissioner-defined rule): the participant
 * who won the most Q1-Q4 periods. Ties broken by total regular-season
 * points among the tied participants. This intentionally differs from the
 * old points-primary, weeks-won-tiebreak algorithm previously duplicated
 * in winner-calculator.ts and close-season/route.ts.
 */
export async function computeSeasonReview(poolId: string, season: number): Promise<SeasonReviewData> {
  const supabase = getSupabaseServiceClient();

  const [{ data: pool }, { data: participants }] = await Promise.all([
    supabase.from('pools').select('name').eq('id', poolId).maybeSingle(),
    supabase.from('participants').select('id, name').eq('pool_id', poolId).eq('is_active', true),
  ]);

  if (!participants || participants.length === 0) {
    return emptyPayload(pool?.name);
  }

  // Season review is a regular-season concept — season_type 2 only.
  // games has no pool_id column (shared across pools by season/week).
  const { data: games } = await supabase
    .from('games')
    .select('id, week, winner')
    .eq('season', season)
    .eq('season_type', 2);

  if (!games || games.length === 0) {
    return emptyPayload(pool?.name);
  }

  const weeks = [...new Set(games.map(g => g.week))].sort((a, b) => a - b);
  const weekByGameId = new Map(games.map(g => [g.id, g.week]));
  const winnerByGameId = new Map(games.map(g => [g.id, g.winner]));

  // participantId -> week -> { points, correct, total }
  const weeklyBreakdown = new Map<string, Map<number, WeekEntry>>();
  participants.forEach(p => weeklyBreakdown.set(p.id, new Map()));

  // Single paginated bulk fetch across every week instead of one query per
  // week (was up to ~18 sequential queries for a full season).
  const allPicks = await fetchAllPicksForGames(supabase, poolId, games.map(g => g.id));
  allPicks.forEach(pick => {
    const week = weekByGameId.get(pick.game_id);
    if (week === undefined) return;
    const weekMap = weeklyBreakdown.get(pick.participant_id);
    if (!weekMap) return; // pick from an inactive/removed participant
    if (!weekMap.has(week)) weekMap.set(week, { points: 0, correct: 0, total: 0 });
    const entry = weekMap.get(week)!;
    entry.total++;
    const winner = winnerByGameId.get(pick.game_id);
    if (winner && pick.predicted_winner === winner) {
      entry.correct++;
      entry.points += pick.confidence_points || 0;
    }
  });

  // Weekly winners + per-week rank (for average_weekly_finish) + streaks.
  const weeklyWinners: WeeklyWinnerEntry[] = [];
  const weeksWonCount = new Map<string, number>();
  const periodWinsCount = new Map<string, number>();
  const finishRanks = new Map<string, number[]>();
  const currentStreak = new Map<string, number>();
  const longestStreak = new Map<string, number>();
  participants.forEach(p => {
    weeksWonCount.set(p.id, 0);
    periodWinsCount.set(p.id, 0);
    finishRanks.set(p.id, []);
    currentStreak.set(p.id, 0);
    longestStreak.set(p.id, 0);
  });

  for (const week of weeks) {
    const standings = participants
      .map(p => ({ id: p.id, entry: weeklyBreakdown.get(p.id)?.get(week) }))
      .filter((x): x is { id: string; entry: WeekEntry } => !!x.entry && x.entry.total > 0)
      .sort((a, b) => b.entry.points - a.entry.points);

    standings.forEach((s, idx) => finishRanks.get(s.id)?.push(idx + 1));

    const winner = standings[0];
    const winnerWon = winner && winner.entry.points > 0;
    participants.forEach(p => {
      const wonThisWeek = winnerWon && p.id === winner.id;
      if (wonThisWeek) {
        currentStreak.set(p.id, (currentStreak.get(p.id) ?? 0) + 1);
        longestStreak.set(p.id, Math.max(longestStreak.get(p.id) ?? 0, currentStreak.get(p.id) ?? 0));
      } else if (standings.some(s => s.id === p.id)) {
        // Only resets the streak if they actually played and didn't win —
        // a bye/no-picks week doesn't count against a streak.
        currentStreak.set(p.id, 0);
      }
    });

    if (winnerWon) {
      weeksWonCount.set(winner.id, (weeksWonCount.get(winner.id) ?? 0) + 1);
      weeklyWinners.push({
        week,
        winner_participant_id: winner.id,
        winner_name: participants.find(p => p.id === winner.id)?.name ?? 'Unknown',
        winner_points: winner.entry.points,
        winner_correct_picks: winner.entry.correct,
        total_participants: standings.length,
      });
    }
  }

  // Q1-Q4 period winners.
  const quarterlyWinners: QuarterlyWinner[] = [];
  for (const period of getRegularSeasonPeriods()) {
    let best: { id: string; points: number; correct: number } | null = null;
    participants.forEach(p => {
      const pw = weeklyBreakdown.get(p.id);
      let periodPoints = 0;
      let periodCorrect = 0;
      period.weeks.forEach(week => {
        const entry = pw?.get(week);
        if (entry) { periodPoints += entry.points; periodCorrect += entry.correct; }
      });
      if (periodPoints > 0 && (!best || periodPoints > best.points)) {
        best = { id: p.id, points: periodPoints, correct: periodCorrect };
      }
    });
    if (best) {
      const b = best as { id: string; points: number; correct: number };
      periodWinsCount.set(b.id, (periodWinsCount.get(b.id) ?? 0) + 1);
      quarterlyWinners.push({
        period_name: period.name,
        winner_participant_id: b.id,
        winner_name: participants.find(p => p.id === b.id)?.name ?? 'Unknown',
        period_points: b.points,
        period_correct_picks: b.correct,
      });
    }
  }

  // Per-participant season stats.
  const participantStats: ParticipantStat[] = participants.map(p => {
    const pw = weeklyBreakdown.get(p.id) ?? new Map<number, WeekEntry>();
    const played = [...pw.entries()].filter(([, e]) => e.total > 0);
    const totalPoints = played.reduce((sum, [, e]) => sum + e.points, 0);
    const totalCorrect = played.reduce((sum, [, e]) => sum + e.correct, 0);
    const totalPicksCount = played.reduce((sum, [, e]) => sum + e.total, 0);

    let bestWeek = { week: 0, points: 0, correct_picks: 0 };
    let worstWeek = { week: 0, points: 0, correct_picks: 0 };
    played.forEach(([week, e], idx) => {
      if (idx === 0 || e.points > bestWeek.points) bestWeek = { week, points: e.points, correct_picks: e.correct };
      if (idx === 0 || e.points < worstWeek.points) worstWeek = { week, points: e.points, correct_picks: e.correct };
    });

    const avgPoints = played.length > 0 ? totalPoints / played.length : 0;
    const variance = played.length > 0
      ? played.reduce((sum, [, e]) => sum + Math.pow(e.points - avgPoints, 2), 0) / played.length
      : 0;

    const ranks = finishRanks.get(p.id) ?? [];
    const avgFinish = ranks.length > 0 ? ranks.reduce((s, r) => s + r, 0) / ranks.length : 0;
    const weeksWon = weeksWonCount.get(p.id) ?? 0;

    return {
      participant_id: p.id,
      name: p.name,
      total_points: totalPoints,
      total_correct_picks: totalCorrect,
      total_incorrect_picks: Math.max(0, totalPicksCount - totalCorrect),
      total_picks: totalPicksCount,
      weeks_won: weeksWon,
      period_wins: periodWinsCount.get(p.id) ?? 0,
      winning_percentage: played.length > 0 ? Math.round((weeksWon / played.length) * 10000) / 100 : 0,
      longest_streak: longestStreak.get(p.id) ?? 0,
      average_weekly_finish: Math.round(avgFinish * 100) / 100,
      best_week: bestWeek,
      worst_week: worstWeek,
      average_points_per_week: Math.round(avgPoints * 100) / 100,
      consistency_score: Math.round(Math.sqrt(variance) * 100) / 100,
    };
  }).sort((a, b) => b.total_points - a.total_points);

  // Season Champion — most periods won, tie-broken by total points.
  const maxPeriodWins = Math.max(0, ...[...periodWinsCount.values()]);
  let seasonWinner: SeasonChampion | null = null;
  let runnerUp: ParticipantStat | null = null;
  if (maxPeriodWins > 0) {
    const contenders = participantStats.filter(ps => (periodWinsCount.get(ps.participant_id) ?? 0) === maxPeriodWins);
    const champion = contenders[0]; // participantStats is already points-sorted descending
    seasonWinner = {
      pool_id: poolId,
      season,
      winner_participant_id: champion.participant_id,
      winner_name: champion.name,
      total_points: champion.total_points,
      total_correct_picks: champion.total_correct_picks,
      weeks_won: champion.weeks_won,
      periods_won: maxPeriodWins,
      tie_breaker_used: contenders.length > 1,
    };
    runnerUp = participantStats.find(ps => ps.participant_id !== champion.participant_id) ?? null;
  } else {
    runnerUp = participantStats[1] ?? null;
  }

  const allWeeklyPoints = [...weeklyBreakdown.values()]
    .flatMap(pw => [...pw.values()].filter(e => e.total > 0).map(e => e.points));

  let closestWeeklyMargin = 0;
  let biggestWeeklyBlowout = 0;
  for (const week of weeks) {
    const weekPoints = participants
      .map(p => weeklyBreakdown.get(p.id)?.get(week))
      .filter((e): e is WeekEntry => !!e && e.total > 0)
      .map(e => e.points)
      .sort((a, b) => b - a);
    if (weekPoints.length > 1) {
      const margin = weekPoints[0] - weekPoints[1];
      if (closestWeeklyMargin === 0 || margin < closestWeeklyMargin) closestWeeklyMargin = margin;
      if (margin > biggestWeeklyBlowout) biggestWeeklyBlowout = margin;
    }
  }

  const seasonStats = {
    total_weeks: weeklyWinners.length,
    total_participants: participantStats.length,
    total_games: games.length,
    average_points_per_week: allWeeklyPoints.length > 0
      ? Math.round((allWeeklyPoints.reduce((s, pts) => s + pts, 0) / allWeeklyPoints.length) * 100) / 100
      : 0,
    highest_weekly_score: allWeeklyPoints.length > 0 ? Math.max(...allWeeklyPoints) : 0,
    lowest_weekly_score: allWeeklyPoints.length > 0 ? Math.min(...allWeeklyPoints) : 0,
    most_wins_by_participant: participantStats.length > 0
      ? participantStats.reduce((most, cur) => (cur.weeks_won > most.weeks_won ? cur : most)).name
      : '',
    most_wins_count: participantStats.length > 0 ? Math.max(...participantStats.map(p => p.weeks_won)) : 0,
    closest_weekly_margin: closestWeeklyMargin,
    biggest_weekly_blowout: biggestWeeklyBlowout,
  };

  return {
    poolName: pool?.name ?? null,
    seasonWinner,
    runnerUp,
    quarterlyWinners,
    weeklyWinners,
    participantStats,
    seasonStats,
  };
}
