// Confidence Pool results: the ONE implementation of weekly scores, weekly
// winners (including co-winners), Q1-Q4 period winners and the season
// champion.
//
// Imported by both runtimes:
//   - src/lib/season-review.ts (Node / Next.js): computeSeasonReview(), which
//     backs Season Review, the leaderboards, and Close Season.
//   - supabase/functions/determine-weekly-winners (Deno): persists the same
//     results to scores / weekly_winners / period_winners / season_winners.
// Before this module existed the two runtimes carried separate ports of the
// rules and drifted apart (the cron crowned the season's top points scorer;
// Season Review crowned whoever won the most periods).
//
// Deliberately has NO imports, so the same file works in Deno and Node.
// Everything here except syncConfidencePool() is pure. syncConfidencePool()
// takes the Supabase client as a parameter.

export const PRESEASON_SEASON_TYPE = 1
export const REGULAR_SEASON_TYPE = 2
export const PLAYOFF_SEASON_TYPE = 3

export interface PeriodDefinition {
  name: string
  startWeek: number
  endWeek: number
  weeks: number[]
}

/** Q1-Q4 boundaries. Must match PERIOD_WEEKS in src/lib/utils.ts; a unit
 * test checks that they agree. */
export const REGULAR_SEASON_PERIODS: PeriodDefinition[] = (() => {
  const names = ['Q1', 'Q2', 'Q3', 'Q4']
  let start = 1
  return [4, 9, 14, 18].map((end, i) => {
    const weeks = Array.from({ length: end - start + 1 }, (_, idx) => start + idx)
    const def = { name: names[i], startWeek: start, endWeek: end, weeks }
    start = end + 1
    return def
  })
})()

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface ResultGame {
  id: string
  week: number
  season_type: number
  winner: string | null
  status: string | null
}

export interface ResultPick {
  participant_id: string
  game_id: string
  predicted_winner: string | null
  confidence_points: number | null
}

export interface ResultParticipant {
  id: string
  name: string
}

export interface ResultTieBreaker {
  participant_id: string
  week: number
  season_type: number | null
  answer: number | string | null
}

export interface ResultPool {
  pool_type: string | null
  tie_breaker_answer: number | string | null
  tie_breaker_question?: string | null
}

export interface ConfidenceResultsInput {
  /** Active participants only. Picks from anyone else are ignored. */
  participants: ResultParticipant[]
  /** Games for one season. Any mix of season types. */
  games: ResultGame[]
  picks: ResultPick[]
  /** Tie-breaker answers for this pool and season. */
  tieBreakers: ResultTieBreaker[]
  pool: ResultPool
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

export interface WeekScore {
  participant_id: string
  name: string
  points: number
  correct_picks: number
  total_picks: number
}

export interface CoWinner {
  participant_id: string
  name: string
  points: number
  correct_picks: number
}

export interface WeekResult {
  season_type: number
  week: number
  /** Every game in the week is finished. Only complete weeks have winners. */
  complete: boolean
  /** The week has a game that hasn't started (newly scheduled, or moved in
   * by a schedule change). Unlike a final game briefly reported live again,
   * this reopens the week: any recorded winner for it is withdrawn. */
  has_unplayed_game: boolean
  /** Participants with at least one pick, points-descending, then by name. */
  scores: WeekScore[]
  /** Empty when there's no winner. More than one on a shared (tied) week,
   * sorted by name, so winners[0] is the same participant everywhere. */
  winners: CoWinner[]
  tie_breaker_used: boolean
  winner_tie_breaker_answer: number | null
  tie_breaker_difference: number | null
}

export interface PeriodTotal {
  participant_id: string
  name: string
  points: number
  correct_picks: number
  /** Weeks won (including shared wins) inside this period only. */
  weeks_won: number
}

export interface PeriodResult {
  period: PeriodDefinition
  /** Every week in the period has games and all of them are finished. */
  complete: boolean
  /** Participants with more than 0 points in the period. */
  totals: PeriodTotal[]
  winner: PeriodTotal | null
  tie_breaker_used: boolean
  winner_tie_breaker_answer: number | null
  tie_breaker_difference: number | null
}

export interface SeasonTotal {
  participant_id: string
  name: string
  total_points: number
  total_correct_picks: number
  total_picks: number
  weeks_won: number
  periods_won: number
}

/** Which step settled a tie on periods won, in the order the engine tries
 * them: the season tie-breaker answer (only when the pool has an answer),
 * otherwise most weeks won; then total points; then name. */
export type ChampionTieBreakerMethod = 'season_answer' | 'weeks_won' | 'total_points' | 'name'

export interface ChampionResult extends SeasonTotal {
  tie_breaker_used: boolean
  /** Null when the champion won outright on periods won. */
  tie_breaker_method: ChampionTieBreakerMethod | null
  winner_tie_breaker_answer: number | null
  tie_breaker_difference: number | null
}

/** The champion explanation shown in Season Review, derived from the method
 * the engine actually used. */
export function describeChampionTieBreak(method: ChampionTieBreakerMethod | null): string | null {
  switch (method) {
    case 'season_answer': return 'Tied on periods won — closest season tie-breaker answer decided it'
    case 'weeks_won': return 'Tied on periods won — most weeks won decided it'
    case 'total_points': return 'Tied on periods won — total points decided it'
    case 'name': return 'Tied on every tie-breaker — decided alphabetically'
    default: return null
  }
}

export interface ConfidenceResults {
  /** Every (season_type, week) in the games, in season_type then week order. */
  weeks: WeekResult[]
  /** Q1-Q4, regular season only. */
  periods: PeriodResult[]
  /** Regular-season totals for every participant, points-descending then name. */
  seasonTotals: SeasonTotal[]
  champion: ChampionResult | null
  /** Every regular-season game is finished. */
  regularSeasonComplete: boolean
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

// games.status has been written with inconsistent casing and vocabulary
// across sync sources ('final', 'Final', 'finished', ESPN's 'post'). A set
// winner is normally the reliable signal, but a tied game has no winner, so a
// terminal status also counts. Mirrored in SQL by
// public.confidence_game_is_finished().
const TERMINAL_GAME_STATUSES = new Set(['final', 'finished', 'post', 'cancelled'])

export function isGameFinished(game: { status?: string | null; winner?: string | null }): boolean {
  if (game.winner != null) return true
  const status = game.status?.toLowerCase()
  return status != null && TERMINAL_GAME_STATUSES.has(status)
}

// In-progress vocabulary, mirroring normalizeGameStatus() in src/types/game.ts.
const LIVE_GAME_STATUSES = new Set(['live', 'in_progress', 'in'])

/** An unfinished game that has kicked off. Any other unfinished game hasn't
 * been played yet. */
export function isGameLive(game: { status?: string | null }): boolean {
  const status = game.status?.toLowerCase()
  return status != null && LIVE_GAME_STATUSES.has(status)
}

export function isNormalPool(pool: Pick<ResultPool, 'pool_type'>): boolean {
  return pool.pool_type === 'normal' || pool.pool_type == null
}

function toNumberOrNull(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

/** The pool's tie-breaker answer, or null if it isn't set. A 0 answer counts
 * as unset, as it always has. */
function poolAnswerOf(pool: ResultPool): number | null {
  const n = toNumberOrNull(pool.tie_breaker_answer)
  return n ? n : null
}

const byName = <T extends { name: string; participant_id: string }>(a: T, b: T) =>
  a.name.localeCompare(b.name) || a.participant_id.localeCompare(b.participant_id)

/** "A", "A & B", "A, B & C". */
export function joinWinnerNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? 'Unknown'
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`
}

/** Correct-pick counts for a winner list, aligned with joinWinnerNames():
 * "9" when every co-winner has the same count, "9 / 8" when they differ. */
export function formatCoWinnerCorrectPicks(winners: Array<{ correct_picks: number }>): string {
  if (winners.length === 0) return '0'
  const counts = winners.map(w => w.correct_picks)
  return counts.every(c => c === counts[0]) ? String(counts[0]) : counts.join(' / ')
}

interface Ranked {
  answer: number | null
  difference: number
}

/** Orders tied contenders by how close their tie-breaker answer is to the
 * pool's answer. Missing answers sort last. Ties fall back to `fallback`,
 * then name, so the result is always the same for the same data. (The old
 * code shuffled randomly when the pool had no answer. That made a recomputed
 * winner change from run to run.) */
function rankByTieBreaker<T extends { participant_id: string; name: string }>(
  tied: T[],
  answerFor: (participantId: string) => number | null,
  poolAnswer: number,
  fallback: (a: T, b: T) => number = () => 0,
): Array<T & Ranked> {
  return tied
    .map(t => {
      const answer = answerFor(t.participant_id)
      return { ...t, answer, difference: answer != null ? Math.abs(answer - poolAnswer) : Infinity }
    })
    .sort((a, b) => (a.difference - b.difference) || fallback(a, b) || byName(a, b))
}

const finiteOrNull = (n: number | undefined | null) => (n != null && Number.isFinite(n) ? n : null)

function seasonTypeOf(tb: ResultTieBreaker): number {
  return tb.season_type ?? REGULAR_SEASON_TYPE
}

/** The participant's tie-breaker answer for the latest week in `weeks` that
 * they answered. */
function latestAnswer(tieBreakers: ResultTieBreaker[], participantId: string, seasonType: number, weeks?: number[]): number | null {
  let best: ResultTieBreaker | null = null
  for (const tb of tieBreakers) {
    if (tb.participant_id !== participantId || seasonTypeOf(tb) !== seasonType) continue
    if (weeks && !weeks.includes(tb.week)) continue
    if (!best || tb.week > best.week) best = tb
  }
  return best ? toNumberOrNull(best.answer) : null
}

// ---------------------------------------------------------------------------
// Computation
// ---------------------------------------------------------------------------

const weekKey = (seasonType: number, week: number) => `${seasonType}-${week}`
/** Chronological position: preseason < regular season < playoffs, then week. */
const weekOrder = (seasonType: number, week: number) => seasonType * 100 + week

export function computeConfidenceResults(input: ConfidenceResultsInput): ConfidenceResults {
  const { pool, tieBreakers } = input
  const participants = [...input.participants].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
  const nameById = new Map(participants.map(p => [p.id, p.name]))
  const normal = isNormalPool(pool)
  const poolAnswer = poolAnswerOf(pool)

  // Group games by week and work out which weeks are complete.
  const gameById = new Map(input.games.map(g => [g.id, g]))
  const weekMeta = new Map<string, { season_type: number; week: number; complete: boolean; has_unplayed_game: boolean }>()
  for (const g of input.games) {
    const key = weekKey(g.season_type, g.week)
    const meta = weekMeta.get(key) ?? { season_type: g.season_type, week: g.week, complete: true, has_unplayed_game: false }
    if (!isGameFinished(g)) {
      meta.complete = false
      if (!isGameLive(g)) meta.has_unplayed_game = true
    }
    weekMeta.set(key, meta)
  }

  // Score every pick from an active participant.
  const entries = new Map<string, Map<string, WeekScore>>() // weekKey -> participant -> score
  for (const pick of input.picks) {
    const game = gameById.get(pick.game_id)
    const name = nameById.get(pick.participant_id)
    if (!game || name === undefined) continue
    const key = weekKey(game.season_type, game.week)
    let byParticipant = entries.get(key)
    if (!byParticipant) entries.set(key, (byParticipant = new Map()))
    let score = byParticipant.get(pick.participant_id)
    if (!score) {
      score = { participant_id: pick.participant_id, name, points: 0, correct_picks: 0, total_picks: 0 }
      byParticipant.set(pick.participant_id, score)
    }
    score.total_picks++
    if (game.winner && pick.predicted_winner === game.winner) {
      score.correct_picks++
      score.points += pick.confidence_points || 0
    }
  }

  const weeks: WeekResult[] = [...weekMeta.values()]
    .sort((a, b) => a.season_type - b.season_type || a.week - b.week)
    .map(meta => {
      const scores = [...(entries.get(weekKey(meta.season_type, meta.week))?.values() ?? [])]
        .sort((a, b) => b.points - a.points || byName(a, b))
      const result: WeekResult = {
        season_type: meta.season_type,
        week: meta.week,
        complete: meta.complete,
        has_unplayed_game: meta.has_unplayed_game,
        scores,
        winners: [],
        tie_breaker_used: false,
        winner_tie_breaker_answer: null,
        tie_breaker_difference: null,
      }
      // Nobody wins a week that isn't over yet, and nobody wins with 0 points.
      if (!meta.complete || scores.length === 0 || scores[0].points <= 0) return result

      const top = scores.filter(s => s.points === scores[0].points)
      const toWinner = (s: WeekScore): CoWinner => ({ participant_id: s.participant_id, name: s.name, points: s.points, correct_picks: s.correct_picks })

      // A tied week is a shared win in a normal pool, including the last week
      // of a quarter: its tie-breaker answers decide the quarter, not the
      // week. Non-normal pools and playoff weeks break the tie.
      if (top.length > 1 && (!normal || meta.season_type === PLAYOFF_SEASON_TYPE)) {
        const answers = new Map(
          tieBreakers
            .filter(tb => tb.week === meta.week && seasonTypeOf(tb) === meta.season_type)
            .map(tb => [tb.participant_id, toNumberOrNull(tb.answer)]),
        )
        const ranked = poolAnswer != null
          ? rankByTieBreaker(top, id => answers.get(id) ?? null, poolAnswer)
          : [...top].sort(byName).map(t => ({ ...t, answer: answers.get(t.participant_id) ?? null, difference: Infinity }))
        result.winners = [toWinner(ranked[0])]
        result.tie_breaker_used = true
        result.winner_tie_breaker_answer = ranked[0].answer
        result.tie_breaker_difference = finiteOrNull(ranked[0].difference)
      } else {
        result.winners = top.map(toWinner) // already name-ordered within equal points
      }
      return result
    })

  const regularWeeks = weeks.filter(w => w.season_type === REGULAR_SEASON_TYPE)
  const regularWeekByNumber = new Map(regularWeeks.map(w => [w.week, w]))
  // A regular-season week with no games blocks its period only while it
  // could still get games: once a later week exists, it's a gap left by a
  // schedule correction (e.g. its last game moved away), not a week to wait
  // for. Otherwise one emptied week would freeze that quarter's stored
  // winner forever.
  const latestWeekOrder = Math.max(-Infinity, ...weeks.map(w => weekOrder(w.season_type, w.week)))
  const regularWeekDone = (week: number) => {
    const w = regularWeekByNumber.get(week)
    return w ? w.complete : weekOrder(REGULAR_SEASON_TYPE, week) < latestWeekOrder
  }
  const weeksWonIn = (participantId: string, weekNumbers?: number[]) =>
    regularWeeks.filter(w => (!weekNumbers || weekNumbers.includes(w.week)) && w.winners.some(x => x.participant_id === participantId)).length

  // Q1-Q4.
  const periodWins = new Map<string, number>()
  const periods: PeriodResult[] = REGULAR_SEASON_PERIODS.map(period => {
    const complete = period.weeks.some(w => regularWeekByNumber.has(w)) && period.weeks.every(regularWeekDone)
    const totals: PeriodTotal[] = []
    for (const p of participants) {
      let points = 0
      let correct = 0
      for (const w of period.weeks) {
        const s = regularWeekByNumber.get(w)?.scores.find(x => x.participant_id === p.id)
        if (s) { points += s.points; correct += s.correct_picks }
      }
      if (points > 0) totals.push({ participant_id: p.id, name: p.name, points, correct_picks: correct, weeks_won: weeksWonIn(p.id, period.weeks) })
    }
    totals.sort((a, b) => b.points - a.points || byName(a, b))

    const result: PeriodResult = { period, complete, totals, winner: null, tie_breaker_used: false, winner_tie_breaker_answer: null, tie_breaker_difference: null }
    if (totals.length === 0) return result

    const top = totals.filter(t => t.points === totals[0].points)
    const breakTie = (tied: PeriodTotal[]) => {
      const ranked = poolAnswer != null
        ? rankByTieBreaker(tied, id => latestAnswer(tieBreakers, id, REGULAR_SEASON_TYPE, period.weeks), poolAnswer)
        : [...tied].sort((a, b) => b.weeks_won - a.weeks_won || byName(a, b)).map(t => ({ ...t, answer: null, difference: Infinity }))
      result.winner = stripRank(ranked[0])
      result.tie_breaker_used = true
      result.winner_tie_breaker_answer = ranked[0].answer
      result.tie_breaker_difference = finiteOrNull(ranked[0].difference)
    }

    if (top.length === 1) {
      result.winner = top[0]
    } else if (!normal) {
      breakTie(top)
    } else {
      // Normal pools: most weeks won inside the period, then tie-breaker.
      const maxWeeksWon = Math.max(...top.map(t => t.weeks_won))
      const stillTied = top.filter(t => t.weeks_won === maxWeeksWon)
      if (stillTied.length === 1) result.winner = stillTied[0]
      else breakTie(stillTied)
    }
    if (result.winner) periodWins.set(result.winner.participant_id, (periodWins.get(result.winner.participant_id) ?? 0) + 1)
    return result
  })

  // Season totals (regular season).
  const seasonTotals: SeasonTotal[] = participants.map(p => {
    let total_points = 0
    let total_correct_picks = 0
    let total_picks = 0
    for (const w of regularWeeks) {
      const s = w.scores.find(x => x.participant_id === p.id)
      if (s) { total_points += s.points; total_correct_picks += s.correct_picks; total_picks += s.total_picks }
    }
    return { participant_id: p.id, name: p.name, total_points, total_correct_picks, total_picks, weeks_won: weeksWonIn(p.id), periods_won: periodWins.get(p.id) ?? 0 }
  }).sort((a, b) => b.total_points - a.total_points || byName(a, b))

  // Season champion: most periods won. Ties: the season tie-breaker answer
  // when the pool has one, otherwise most weeks won; then total points.
  let champion: ChampionResult | null = null
  const maxPeriodWins = Math.max(0, ...seasonTotals.map(t => t.periods_won))
  if (maxPeriodWins > 0) {
    const contenders = seasonTotals.filter(t => t.periods_won === maxPeriodWins)
    const byPoints = (a: SeasonTotal, b: SeasonTotal) => b.total_points - a.total_points
    let best: SeasonTotal & Ranked = { ...contenders[0], answer: null, difference: Infinity }
    let method: ChampionTieBreakerMethod | null = null
    if (contenders.length > 1) {
      const ranked: Array<SeasonTotal & Ranked> = poolAnswer != null
        ? rankByTieBreaker(contenders, id => latestAnswer(tieBreakers, id, REGULAR_SEASON_TYPE), poolAnswer, byPoints)
        : [...contenders].sort((a, b) => b.weeks_won - a.weeks_won || byPoints(a, b) || byName(a, b)).map(t => ({ ...t, answer: null, difference: Infinity }))
      best = ranked[0]
      // The first criterion, in sort order, on which the winner beats the
      // runner-up is the one that decided it.
      const next = ranked[1]
      method = poolAnswer != null && best.difference !== next.difference ? 'season_answer'
        : poolAnswer == null && best.weeks_won !== next.weeks_won ? 'weeks_won'
        : best.total_points !== next.total_points ? 'total_points'
        : 'name'
    }
    champion = {
      ...stripRank(best),
      tie_breaker_used: contenders.length > 1,
      tie_breaker_method: method,
      winner_tie_breaker_answer: best.answer,
      tie_breaker_difference: finiteOrNull(best.difference),
    }
  }

  const regularGames = input.games.filter(g => g.season_type === REGULAR_SEASON_TYPE)
  return {
    weeks,
    periods,
    seasonTotals,
    champion,
    regularSeasonComplete: regularGames.length > 0 && regularGames.every(isGameFinished),
  }
}

function stripRank<T extends object>(row: T & Partial<Ranked>): T {
  const { answer: _a, difference: _d, ...rest } = row as T & Ranked
  return rest as unknown as T
}

// ---------------------------------------------------------------------------
// Persisted rows
// ---------------------------------------------------------------------------

export interface ScoreRow {
  participant_id: string
  points: number
  correct_picks: number
  total_picks: number
}

export interface WeeklyWinnerRow {
  pool_id: string
  week: number
  season: number
  season_type: number
  winner_participant_id: string
  /** Every co-winner on a shared week, e.g. "Jason & Karen". */
  winner_name: string
  winner_points: number
  /** winner_participant_id's own count. */
  winner_correct_picks: number
  tie_breaker_used: boolean
  tie_breaker_question: string | null
  tie_breaker_answer: number | null
  winner_tie_breaker_answer: number | null
  tie_breaker_difference: number | null
  total_participants: number
}

export interface PeriodWinnerRow {
  pool_id: string
  season: number
  period_name: string
  start_week: number
  end_week: number
  winner_participant_id: string
  winner_name: string
  period_points: number
  period_correct_picks: number
  weeks_won: number
  tie_breaker_used: boolean
  tie_breaker_question: string | null
  tie_breaker_answer: number | null
  winner_tie_breaker_answer: number | null
  tie_breaker_difference: number | null
  total_participants: number
}

export interface SeasonWinnerRow {
  pool_id: string
  season: number
  winner_participant_id: string
  winner_name: string
  total_points: number
  total_correct_picks: number
  weeks_won: number
  tie_breaker_used: boolean
  tie_breaker_question: string | null
  tie_breaker_answer: number | null
  winner_tie_breaker_answer: number | null
  tie_breaker_difference: number | null
  total_participants: number
}

export function toWeeklyWinnerRow(poolId: string, season: number, pool: ResultPool, week: WeekResult): WeeklyWinnerRow | null {
  const primary = week.winners[0]
  if (!primary) return null
  return {
    pool_id: poolId,
    week: week.week,
    season,
    season_type: week.season_type,
    winner_participant_id: primary.participant_id,
    winner_name: joinWinnerNames(week.winners.map(w => w.name)),
    winner_points: primary.points,
    winner_correct_picks: primary.correct_picks,
    tie_breaker_used: week.tie_breaker_used,
    tie_breaker_question: pool.tie_breaker_question ?? null,
    tie_breaker_answer: week.tie_breaker_used ? poolAnswerOf(pool) : null,
    winner_tie_breaker_answer: week.winner_tie_breaker_answer,
    tie_breaker_difference: week.tie_breaker_difference,
    total_participants: week.scores.length,
  }
}

export function toPeriodWinnerRow(poolId: string, season: number, period: PeriodResult): PeriodWinnerRow | null {
  const w = period.winner
  if (!w) return null
  return {
    pool_id: poolId,
    season,
    period_name: period.period.name,
    start_week: period.period.startWeek,
    end_week: period.period.endWeek,
    winner_participant_id: w.participant_id,
    winner_name: w.name,
    period_points: w.points,
    period_correct_picks: w.correct_picks,
    weeks_won: w.weeks_won,
    tie_breaker_used: period.tie_breaker_used,
    tie_breaker_question: null,
    tie_breaker_answer: null,
    winner_tie_breaker_answer: period.winner_tie_breaker_answer,
    tie_breaker_difference: period.tie_breaker_difference,
    total_participants: period.totals.length,
  }
}

/** The season_winners row for a champion. Used by the cron and by both Close
 * Season paths, so they all write the same thing. */
export function toSeasonWinnerRow(poolId: string, season: number, results: Pick<ConfidenceResults, 'champion' | 'seasonTotals'>): SeasonWinnerRow | null {
  const c = results.champion
  if (!c) return null
  return {
    pool_id: poolId,
    season,
    winner_participant_id: c.participant_id,
    winner_name: c.name,
    total_points: c.total_points,
    total_correct_picks: c.total_correct_picks,
    weeks_won: c.weeks_won,
    tie_breaker_used: c.tie_breaker_used,
    tie_breaker_question: null,
    tie_breaker_answer: null,
    winner_tie_breaker_answer: c.winner_tie_breaker_answer,
    tie_breaker_difference: c.tie_breaker_difference,
    total_participants: results.seasonTotals.filter(t => t.total_picks > 0).length,
  }
}

// ---------------------------------------------------------------------------
// Write planning: what has to change for the stored rows to match
// ---------------------------------------------------------------------------

export interface ExistingScoreRow extends ScoreRow {
  season_type: number | null
  week: number
}

export interface ExistingResults {
  scores: ExistingScoreRow[]
  weeklyWinners: Array<Partial<WeeklyWinnerRow> & { week: number; season_type: number | null }>
  periodWinners: Array<Partial<PeriodWinnerRow> & { period_name: string }>
  seasonWinner: Partial<SeasonWinnerRow> | null
}

/** Argument to public.apply_confidence_pool_results(). Applied in one
 * transaction, so either every change lands or none do. */
export interface ResultWritePlan {
  scores: Array<{ season_type: number; week: number; rows: ScoreRow[] }>
  weekly_upserts: WeeklyWinnerRow[]
  weekly_deletes: Array<{ season_type: number; week: number }>
  period_upserts: PeriodWinnerRow[]
  period_deletes: string[]
  season_upsert: SeasonWinnerRow | null
  season_delete: boolean
}

export function isEmptyPlan(plan: ResultWritePlan): boolean {
  return plan.scores.length === 0 && plan.weekly_upserts.length === 0 && plan.weekly_deletes.length === 0 &&
    plan.period_upserts.length === 0 && plan.period_deletes.length === 0 && !plan.season_upsert && !plan.season_delete
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return a == null && b == null
  if (typeof a === 'number' || typeof b === 'number') return Number(a) === Number(b)
  return a === b
}

function rowMatches<T extends object>(desired: T, existing: Partial<T> | undefined | null): boolean {
  if (!existing) return false
  return (Object.keys(desired) as Array<keyof T>).every(k => sameValue(desired[k], existing[k]))
}

/**
 * Works out the writes that bring the stored rows in line with `results`.
 *
 * Only complete weeks/periods (and a finished regular season) are written.
 * Those are recomputed every time and corrected if a game result, pick or
 * tie-breaker changed after they were first recorded. Incomplete weeks are
 * left alone, so a game temporarily flipped back to "live" never wipes a
 * recorded result. Two exceptions: a week reopened by a game that hasn't
 * started loses its winner (and the quarter/season winners built on it),
 * and a week with no games left at all loses its scores and winner.
 */
export function planResultWrites(
  poolId: string,
  season: number,
  pool: ResultPool,
  results: ConfidenceResults,
  existing: ExistingResults,
): ResultWritePlan {
  const plan: ResultWritePlan = {
    scores: [], weekly_upserts: [], weekly_deletes: [], period_upserts: [], period_deletes: [], season_upsert: null, season_delete: false,
  }
  const existingSeasonType = (st: number | null) => st ?? REGULAR_SEASON_TYPE

  // A week reopened by a newly scheduled game has no winner until that game
  // is final: withdraw any recorded one, and the quarter and season winners
  // computed from it. Its scores stay (still right for the games played) and
  // are rewritten when the week completes. A week that is incomplete only
  // because a final game is briefly reported live again keeps everything.
  const reopened = results.weeks.filter(w => !w.complete && w.has_unplayed_game)
  for (const week of reopened) {
    if (existing.weeklyWinners.some(w => w.week === week.week && existingSeasonType(w.season_type) === week.season_type)) {
      plan.weekly_deletes.push({ season_type: week.season_type, week: week.week })
    }
  }
  const reopenedRegularWeeks = new Set(reopened.filter(w => w.season_type === REGULAR_SEASON_TYPE).map(w => w.week))
  for (const period of results.periods) {
    if (period.period.weeks.some(w => reopenedRegularWeeks.has(w)) && existing.periodWinners.some(p => p.period_name === period.period.name)) {
      plan.period_deletes.push(period.period.name)
    }
  }
  if (reopenedRegularWeeks.size > 0 && existing.seasonWinner) plan.season_delete = true

  for (const week of results.weeks) {
    if (!week.complete) continue
    const desiredScores: ScoreRow[] = week.scores.map(s => ({ participant_id: s.participant_id, points: s.points, correct_picks: s.correct_picks, total_picks: s.total_picks }))
    const stored = existing.scores.filter(s => s.week === week.week && existingSeasonType(s.season_type) === week.season_type)
    const storedById = new Map(stored.map(s => [s.participant_id, s]))
    const scoresMatch = stored.length === desiredScores.length && desiredScores.every(d => rowMatches(d, storedById.get(d.participant_id)))
    if (!scoresMatch) plan.scores.push({ season_type: week.season_type, week: week.week, rows: desiredScores })

    const desiredWinner = toWeeklyWinnerRow(poolId, season, pool, week)
    const storedWinners = existing.weeklyWinners.filter(w => w.week === week.week && existingSeasonType(w.season_type) === week.season_type)
    if (desiredWinner) {
      if (storedWinners.length !== 1 || !rowMatches(desiredWinner, storedWinners[0])) plan.weekly_upserts.push(desiredWinner)
    } else if (storedWinners.length > 0) {
      plan.weekly_deletes.push({ season_type: week.season_type, week: week.week })
    }
  }

  // Weeks that no longer exist in the schedule (a correction moved or
  // deleted every game in them) keep no scores or winner. Skipped when the
  // season has no games at all, so an empty games read can never wipe a
  // season's results.
  if (results.weeks.length > 0) {
    const present = new Set(results.weeks.map(w => weekKey(w.season_type, w.week)))
    const orphanScoreWeeks = new Map<string, { season_type: number; week: number }>()
    for (const s of existing.scores) {
      const st = existingSeasonType(s.season_type)
      const key = weekKey(st, s.week)
      if (!present.has(key)) orphanScoreWeeks.set(key, { season_type: st, week: s.week })
    }
    for (const w of orphanScoreWeeks.values()) plan.scores.push({ ...w, rows: [] })

    const orphanWinnerWeeks = new Map<string, { season_type: number; week: number }>()
    for (const w of existing.weeklyWinners) {
      const st = existingSeasonType(w.season_type)
      const key = weekKey(st, w.week)
      if (!present.has(key)) orphanWinnerWeeks.set(key, { season_type: st, week: w.week })
    }
    plan.weekly_deletes.push(...orphanWinnerWeeks.values())
  }

  for (const period of results.periods) {
    if (!period.complete) continue
    const desired = toPeriodWinnerRow(poolId, season, period)
    const stored = existing.periodWinners.filter(p => p.period_name === period.period.name)
    if (desired) {
      if (stored.length !== 1 || !rowMatches(desired, stored[0])) plan.period_upserts.push(desired)
    } else if (stored.length > 0) {
      plan.period_deletes.push(period.period.name)
    }
  }

  if (results.regularSeasonComplete) {
    const desired = toSeasonWinnerRow(poolId, season, results)
    if (desired) {
      if (!rowMatches(desired, existing.seasonWinner)) plan.season_upsert = desired
    } else if (existing.seasonWinner) {
      plan.season_delete = true
    }
  }

  return plan
}

// ---------------------------------------------------------------------------
// Sync: load, compute, write (used by the determine-weekly-winners cron)
// ---------------------------------------------------------------------------

/** The slice of the Supabase JS client this module uses. Typed loosely so it
 * accepts the real client in both Deno and Node without importing it. */
// deno-lint-ignore no-explicit-any
type Db = { from: (table: string) => any; rpc: (fn: string, args: Record<string, unknown>) => any }

export interface SyncPool {
  id: string
  name?: string
  season: number
  pool_type: string | null
  tie_breaker_question?: string | null
  tie_breaker_answer: number | string | null
}

export type SyncStatus = 'unchanged' | 'updated' | 'failed'

export interface SyncResult {
  pool_id: string
  status: SyncStatus
  error?: string
  changes?: {
    score_weeks: number
    weekly_upserts: number
    weekly_deletes: number
    period_upserts: number
    period_deletes: number
    season: 'upserted' | 'deleted' | null
  }
}

const PAGE_SIZE = 1000

/** Reads every row of a query, a page at a time. PostgREST caps an unbounded
 * select at 1000 rows, and a season of picks is several thousand. */
async function selectAll<T>(build: () => { range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }> }): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build().range(from, from + PAGE_SIZE - 1)
    if (error) throw toError(error)
    all.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) return all
  }
}

function toError(error: unknown): Error {
  if (error instanceof Error) return error
  const message = (error as { message?: string })?.message
  return new Error(message ?? String(error))
}

async function must<T>(query: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await query
  if (error) throw toError(error)
  return data
}

/** Loads everything the computation needs for one pool and season. */
export async function loadConfidenceResultsInput(supabase: Db, pool: SyncPool): Promise<ConfidenceResultsInput> {
  const [participants, games, tieBreakers] = await Promise.all([
    selectAll<ResultParticipant>(() => supabase.from('participants').select('id, name').eq('pool_id', pool.id).eq('is_active', true).order('id')),
    selectAll<ResultGame>(() => supabase.from('games').select('id, week, season_type, winner, status').eq('season', pool.season).order('id')),
    selectAll<ResultTieBreaker>(() => supabase.from('tie_breakers').select('participant_id, week, season_type, answer').eq('pool_id', pool.id).eq('season', pool.season).order('id')),
  ])
  const picks = games.length === 0 ? [] : await selectAll<ResultPick>(() =>
    supabase.from('picks').select('participant_id, game_id, predicted_winner, confidence_points')
      .eq('pool_id', pool.id).in('game_id', games.map(g => g.id)).order('id'))
  return { participants, games, picks, tieBreakers, pool }
}

async function loadExistingResults(supabase: Db, pool: SyncPool): Promise<ExistingResults> {
  const [scores, weeklyWinners, periodWinners, seasonWinners] = await Promise.all([
    selectAll<ExistingScoreRow>(() => supabase.from('scores').select('participant_id, week, season_type, points, correct_picks, total_picks').eq('pool_id', pool.id).eq('season', pool.season).order('id')),
    selectAll<ExistingResults['weeklyWinners'][number]>(() => supabase.from('weekly_winners').select('*').eq('pool_id', pool.id).eq('season', pool.season).order('id')),
    selectAll<ExistingResults['periodWinners'][number]>(() => supabase.from('period_winners').select('*').eq('pool_id', pool.id).eq('season', pool.season).order('id')),
    selectAll<Partial<SeasonWinnerRow>>(() => supabase.from('season_winners').select('*').eq('pool_id', pool.id).eq('season', pool.season).order('id')),
  ])
  return { scores, weeklyWinners, periodWinners, seasonWinner: seasonWinners[0] ?? null }
}

/**
 * Recomputes one pool's results from picks + games and writes whatever
 * changed, in a single transaction (public.apply_confidence_pool_results).
 * Never throws: a failure comes back as status 'failed' with the error, and
 * the stored rows are left exactly as they were.
 */
export async function syncConfidencePool(supabase: Db, pool: SyncPool): Promise<SyncResult> {
  try {
    const input = await loadConfidenceResultsInput(supabase, pool)
    const results = computeConfidenceResults(input)
    const existing = await loadExistingResults(supabase, pool)
    const plan = planResultWrites(pool.id, pool.season, pool, results, existing)
    if (isEmptyPlan(plan)) return { pool_id: pool.id, status: 'unchanged' }

    await must(supabase.rpc('apply_confidence_pool_results', { p_pool_id: pool.id, p_season: pool.season, p_plan: plan }))
    return {
      pool_id: pool.id,
      status: 'updated',
      changes: {
        score_weeks: plan.scores.length,
        weekly_upserts: plan.weekly_upserts.length,
        weekly_deletes: plan.weekly_deletes.length,
        period_upserts: plan.period_upserts.length,
        period_deletes: plan.period_deletes.length,
        season: plan.season_upsert ? 'upserted' : plan.season_delete ? 'deleted' : null,
      },
    }
  } catch (error) {
    return { pool_id: pool.id, status: 'failed', error: toError(error).message }
  }
}

// ---------------------------------------------------------------------------
// Job: the determine-weekly-winners run, minus the HTTP/lock wrapper
// ---------------------------------------------------------------------------

export const CONFIDENCE_COMPETITION_TYPES = ['NFL_CONFIDENCE', 'NCAA_CONFIDENCE']

export interface JobSummary {
  success: boolean
  processed: number
  updated: number
  failed: number
  results: Array<SyncResult & { pool_name?: string }>
}

/**
 * Syncs every active Confidence pool marked in confidence_results_dirty (or
 * every active Confidence pool when `all` is set). A pool's mark is cleared
 * only after its sync succeeded, and only if it wasn't re-marked meanwhile,
 * so a failed pool is retried on the next run. `success` is false if any
 * pool failed. Throws if the pool list or marks can't be read.
 */
export async function runConfidenceResultsJob(
  supabase: Db,
  opts: { all?: boolean; log?: (event: string, fields?: Record<string, unknown>) => void } = {},
): Promise<JobSummary> {
  const log = opts.log ?? (() => {})

  const dirtyRows = await must<Array<{ pool_id: string; marked_at: string }> | null>(
    supabase.from('confidence_results_dirty').select('pool_id, marked_at'))
  const markedAt = new Map((dirtyRows ?? []).map(r => [r.pool_id, r.marked_at]))

  // Survivor and Pick'em pools have their own services (src/lib/survivor.ts,
  // src/lib/pickem.ts) and never get these rows.
  const activePools = await must<SyncPool[] | null>(supabase
    .from('pools')
    .select('id, name, season, pool_type, tie_breaker_question, tie_breaker_answer')
    .eq('is_active', true)
    .in('competition_type', CONFIDENCE_COMPETITION_TYPES)) ?? []

  const pools = activePools.filter(p => opts.all || markedAt.has(p.id))
  log('pools_loaded', { active_pools: activePools.length, marked: markedAt.size, processing: pools.length })

  const results: JobSummary['results'] = []
  for (const pool of pools) {
    const result = await syncConfidencePool(supabase, pool)
    results.push({ ...result, pool_name: pool.name })
    log('pool_processed', { pool_id: pool.id, status: result.status, ...(result.changes ?? {}), error: result.error })

    const seen = markedAt.get(pool.id)
    if (result.status !== 'failed' && seen) {
      // A change made while this pool was being computed has a later
      // marked_at, so the pool stays marked for the next run.
      const { error } = await supabase.from('confidence_results_dirty').delete().eq('pool_id', pool.id).lte('marked_at', seen)
      if (error) log('clear_mark_failed', { pool_id: pool.id, error: toError(error).message })
    }
  }

  // Marks for pools that are inactive, deleted, or not Confidence pools are
  // never processed; drop them so the cron gate stops firing for them.
  const processable = new Set(activePools.map(p => p.id))
  const stale = [...markedAt.keys()].filter(id => !processable.has(id))
  if (stale.length > 0) {
    const { error } = await supabase.from('confidence_results_dirty').delete().in('pool_id', stale)
    if (error) log('clear_stale_marks_failed', { count: stale.length, error: toError(error).message })
  }

  const failed = results.filter(r => r.status === 'failed').length
  return {
    success: failed === 0,
    processed: results.length,
    updated: results.filter(r => r.status === 'updated').length,
    failed,
    results,
  }
}
