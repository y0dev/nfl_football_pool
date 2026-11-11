import { getSupabaseServiceClient } from './supabase-service';
import {
  computeConfidenceResults,
  formatCoWinnerCorrectPicks,
  joinWinnerNames,
  toSeasonWinnerRow,
  REGULAR_SEASON_TYPE,
  type CoWinner,
  type SeasonWinnerRow,
} from '../../supabase/functions/_shared/confidence-results';

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
      .order('id')
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
  /** First of winner_participant_ids — every tied winner is in that list. */
  winner_participant_id: string;
  /** Every participant credited with this week: more than one on a tied week. */
  winner_participant_ids: string[];
  /** Each co-winner with their own points and correct picks, in the same
   * order as winner_participant_ids. */
  co_winners: CoWinner[];
  /** Display name — all tied winners joined, e.g. "Jason & Karen". */
  winner_name: string;
  winner_points: number;
  /** winner_participant_id's own count. Co-winners can differ — show
   * winner_correct_picks_display next to a joined winner_name instead. */
  winner_correct_picks: number;
  /** "9", or "9 / 8" when co-winners' counts differ (same order as the names). */
  winner_correct_picks_display: string;
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

export interface PeriodTotalEntry {
  period_name: string;
  participant_id: string;
  participant_name: string;
  points: number;
  correct: number;
  weeks_won: number;
}

export interface SeasonReviewData {
  poolName: string | null;
  seasonWinner: SeasonChampion | null;
  /** The season_winners row for seasonWinner. Close Season (route and
   * script) and the determine-weekly-winners cron all persist exactly this. */
  seasonWinnerRow: SeasonWinnerRow | null;
  runnerUp: ParticipantStat | null;
  quarterlyWinners: QuarterlyWinner[];
  weeklyWinners: WeeklyWinnerEntry[];
  participantStats: ParticipantStat[];
  /** Every participant's per-period (Q1-Q4) totals, not just the winner —
   * used by /api/periods/leaderboard to render a full period leaderboard. */
  periodTotals: PeriodTotalEntry[];
  weeklyScores: Array<WeekEntry & { participant_id: string; week: number }>;
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

/** The joined co-winner name for a tied week, or null if the week has a sole
 * winner (or none) — for callers showing the single stored weekly_winners row. */
export function getTiedWinnerName(review: Pick<SeasonReviewData, 'weeklyWinners'>, week: number): string | null {
  const entry = review.weeklyWinners.find(w => w.week === week);
  return entry && entry.winner_participant_ids.length > 1 ? entry.winner_name : null;
}

/** Correct-pick display for a tied week ("9 / 8" when the co-winners' counts
 * differ), or null if the week has a sole winner (or none). */
export function getTiedWinnerCorrectPicks(review: Pick<SeasonReviewData, 'weeklyWinners'>, week: number): string | null {
  const entry = review.weeklyWinners.find(w => w.week === week);
  return entry && entry.winner_participant_ids.length > 1 ? entry.winner_correct_picks_display : null;
}

function emptyPayload(poolName: string | undefined): SeasonReviewData {
  return {
    poolName: poolName ?? null,
    seasonWinner: null,
    seasonWinnerRow: null,
    runnerUp: null,
    quarterlyWinners: [],
    weeklyWinners: [],
    participantStats: [],
    periodTotals: [],
    weeklyScores: [],
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
 * Season Review / season standings — the authoritative Confidence Pool
 * computation, used by the Season Review tab, the League Pool Leaderboard
 * tab, both Close Season paths, and (through the shared module it delegates
 * to) the determine-weekly-winners cron. Computed live from picks + games.
 *
 * The scoring and winner rules themselves live in
 * supabase/functions/_shared/confidence-results.ts, so the cron, which runs
 * in Deno, applies exactly the same rules. This function loads the data and
 * adds the display-only stats (streaks, average finish, consistency...).
 *
 * Season Champion: the participant who won the most Q1-Q4 periods. A tie is
 * broken by the season tie-breaker answer when the pool has one, otherwise
 * by most weeks won, then by total regular-season points.
 */
export async function computeSeasonReview(poolId: string, season: number): Promise<SeasonReviewData> {
  const supabase = getSupabaseServiceClient();

  const [poolRes, participantsRes] = await Promise.all([
    supabase.from('pools').select('name, pool_type, tie_breaker_answer, tie_breaker_question').eq('id', poolId).maybeSingle(),
    supabase.from('participants').select('id, name').eq('pool_id', poolId).eq('is_active', true),
  ]);
  if (poolRes.error) throw poolRes.error;
  if (participantsRes.error) throw participantsRes.error;
  const pool = poolRes.data;
  const participants = participantsRes.data ?? [];

  if (participants.length === 0) {
    return emptyPayload(pool?.name);
  }

  // Season review is a regular-season concept — season_type 2 only.
  // games has no pool_id column (shared across pools by season/week).
  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('id, week, season_type, winner, status')
    .eq('season', season)
    .eq('season_type', REGULAR_SEASON_TYPE);
  if (gamesError) throw gamesError;

  if (!games || games.length === 0) {
    return emptyPayload(pool?.name);
  }

  const [picks, tieBreakersRes] = await Promise.all([
    fetchAllPicksForGames(supabase, poolId, games.map(g => g.id)),
    supabase.from('tie_breakers').select('participant_id, week, season_type, answer').eq('pool_id', poolId).eq('season', season),
  ]);
  if (tieBreakersRes.error) throw tieBreakersRes.error;

  const resultPool = {
    pool_type: pool?.pool_type ?? null,
    tie_breaker_answer: pool?.tie_breaker_answer ?? null,
    tie_breaker_question: pool?.tie_breaker_question ?? null,
  };
  const results = computeConfidenceResults({
    participants,
    games,
    picks,
    tieBreakers: tieBreakersRes.data ?? [],
    pool: resultPool,
  });

  const weeks = results.weeks.filter(w => w.season_type === REGULAR_SEASON_TYPE);

  // participantId -> week -> { points, correct, total }
  const weeklyBreakdown = new Map<string, Map<number, WeekEntry>>();
  participants.forEach(p => weeklyBreakdown.set(p.id, new Map()));
  for (const w of weeks) {
    for (const s of w.scores) {
      weeklyBreakdown.get(s.participant_id)?.set(w.week, { points: s.points, correct: s.correct_picks, total: s.total_picks });
    }
  }

  // Weekly winners, per-week finish rank, and streaks.
  const weeklyWinners: WeeklyWinnerEntry[] = [];
  const finishRanks = new Map<string, number[]>(participants.map(p => [p.id, []]));
  const currentStreak = new Map<string, number>(participants.map(p => [p.id, 0]));
  const longestStreak = new Map<string, number>(participants.map(p => [p.id, 0]));

  for (const w of weeks) {
    w.scores.forEach((s, idx) => finishRanks.get(s.participant_id)?.push(idx + 1));

    // Streaks are week-over-week, so an incomplete week must not touch
    // them: no credit for a not-yet-decided leader, and no reset just
    // because someone's week isn't finished yet.
    if (w.complete) {
      const winnerIds = new Set(w.winners.map(x => x.participant_id));
      participants.forEach(p => {
        if (winnerIds.has(p.id)) {
          currentStreak.set(p.id, (currentStreak.get(p.id) ?? 0) + 1);
          longestStreak.set(p.id, Math.max(longestStreak.get(p.id) ?? 0, currentStreak.get(p.id) ?? 0));
        } else if (w.scores.some(s => s.participant_id === p.id)) {
          // Only resets the streak if they actually played and didn't win —
          // a bye/no-picks week doesn't count against a streak.
          currentStreak.set(p.id, 0);
        }
      });
    }

    if (w.winners.length > 0) {
      const primary = w.winners[0];
      weeklyWinners.push({
        week: w.week,
        winner_participant_id: primary.participant_id,
        winner_participant_ids: w.winners.map(x => x.participant_id),
        co_winners: w.winners,
        winner_name: joinWinnerNames(w.winners.map(x => x.name)),
        winner_points: primary.points,
        winner_correct_picks: primary.correct_picks,
        winner_correct_picks_display: formatCoWinnerCorrectPicks(w.winners),
        total_participants: w.scores.length,
      });
    }
  }

  // Q1-Q4. Period winners are shown live, before the period is complete.
  const quarterlyWinners: QuarterlyWinner[] = [];
  const periodTotals: PeriodTotalEntry[] = [];
  for (const period of results.periods) {
    for (const t of period.totals) {
      periodTotals.push({
        period_name: period.period.name,
        participant_id: t.participant_id,
        participant_name: t.name,
        points: t.points,
        correct: t.correct_picks,
        weeks_won: t.weeks_won,
      });
    }
    if (period.winner) {
      quarterlyWinners.push({
        period_name: period.period.name,
        winner_participant_id: period.winner.participant_id,
        winner_name: period.winner.name,
        period_points: period.winner.points,
        period_correct_picks: period.winner.correct_picks,
      });
    }
  }

  // Per-participant season stats, in the same order as results.seasonTotals
  // (points-descending, then name).
  const participantStats: ParticipantStat[] = results.seasonTotals.map(total => {
    const pw = weeklyBreakdown.get(total.participant_id) ?? new Map<number, WeekEntry>();
    const played = [...pw.entries()].filter(([, e]) => e.total > 0).sort(([a], [b]) => a - b);

    let bestWeek = { week: 0, points: 0, correct_picks: 0 };
    let worstWeek = { week: 0, points: 0, correct_picks: 0 };
    played.forEach(([week, e], idx) => {
      if (idx === 0 || e.points > bestWeek.points) bestWeek = { week, points: e.points, correct_picks: e.correct };
      if (idx === 0 || e.points < worstWeek.points) worstWeek = { week, points: e.points, correct_picks: e.correct };
    });

    const avgPoints = played.length > 0 ? total.total_points / played.length : 0;
    const variance = played.length > 0
      ? played.reduce((sum, [, e]) => sum + Math.pow(e.points - avgPoints, 2), 0) / played.length
      : 0;

    const ranks = finishRanks.get(total.participant_id) ?? [];
    const avgFinish = ranks.length > 0 ? ranks.reduce((s, r) => s + r, 0) / ranks.length : 0;

    return {
      participant_id: total.participant_id,
      name: total.name,
      total_points: total.total_points,
      total_correct_picks: total.total_correct_picks,
      total_incorrect_picks: Math.max(0, total.total_picks - total.total_correct_picks),
      total_picks: total.total_picks,
      weeks_won: total.weeks_won,
      period_wins: total.periods_won,
      winning_percentage: played.length > 0 ? Math.round((total.weeks_won / played.length) * 10000) / 100 : 0,
      longest_streak: longestStreak.get(total.participant_id) ?? 0,
      average_weekly_finish: Math.round(avgFinish * 100) / 100,
      best_week: bestWeek,
      worst_week: worstWeek,
      average_points_per_week: Math.round(avgPoints * 100) / 100,
      consistency_score: Math.round(Math.sqrt(variance) * 100) / 100,
    };
  });

  const champion = results.champion;
  const seasonWinner: SeasonChampion | null = champion ? {
    pool_id: poolId,
    season,
    winner_participant_id: champion.participant_id,
    winner_name: champion.name,
    total_points: champion.total_points,
    total_correct_picks: champion.total_correct_picks,
    weeks_won: champion.weeks_won,
    periods_won: champion.periods_won,
    tie_breaker_used: champion.tie_breaker_used,
  } : null;
  const runnerUp = champion
    ? participantStats.find(ps => ps.participant_id !== champion.participant_id) ?? null
    : participantStats[1] ?? null;

  const allWeeklyPoints = weeks.flatMap(w => w.scores.map(s => s.points));

  let closestWeeklyMargin = 0;
  let biggestWeeklyBlowout = 0;
  for (const w of weeks) {
    if (w.scores.length > 1) {
      const margin = w.scores[0].points - w.scores[1].points;
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
    seasonWinnerRow: toSeasonWinnerRow(poolId, season, results),
    runnerUp,
    quarterlyWinners,
    weeklyWinners,
    participantStats,
    periodTotals,
    weeklyScores: Array.from(weeklyBreakdown, ([participant_id, weekMap]) =>
      Array.from(weekMap, ([week, entry]) => ({ participant_id, week, ...entry }))
    ).flat(),
    seasonStats,
  };
}
