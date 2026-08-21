// deno-lint-ignore-file no-explicit-any
// For each active pool: once every game in a week is finished, computes that
// week's scores from picks + games.winner and records the weekly winner.
// Also finalizes quarterly (Q1-Q4) and season winners once their games are
// complete. Idempotent — skips anything already recorded in weekly_winners /
// period_winners / season_winners, so it's safe to run on a recurring schedule.
//
// This is a Supabase Edge Function, so it can't import src/lib/winner-calculator.ts
// directly — the logic below is a Deno-compatible port of it, using the same
// tie-breaker rules (weeks-won, then Monday-night tie-breaker answer).
//
// Every week/period/season entry in the response always carries a `status`
// (and `reason` when nothing was written) instead of being silently omitted
// — an empty-looking `weeks: []` used to be indistinguishable between "still
// mid-season, nothing finished yet" (expected) and "something is actually
// broken" (not expected). It's the former unless a status says otherwise.
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { withSupabase } from "jsr:@supabase/server@^1"
import { tryAcquireLock, releaseLock } from '../_shared/cron-lock.ts'

const JOB_NAME = 'determine-weekly-winners'

const REGULAR_SEASON_TYPE = 2
const SUPER_BOWL_SEASON_TYPE = 3
const PERIOD_WEEKS = [4, 9, 14, 18]
const QUARTERS: Record<number, { name: string; startWeek: number; endWeek: number }> = {
  4:  { name: 'Q1', startWeek: 1, endWeek: 4 },
  9:  { name: 'Q2', startWeek: 5, endWeek: 9 },
  14: { name: 'Q3', startWeek: 10, endWeek: 14 },
  18: { name: 'Q4', startWeek: 15, endWeek: 18 },
}

// Structured, single-line, secret-free logs — every field here is either an
// id, a count, or a duration, never a key/token/credential.
function log(event: string, fields: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ fn: 'determine-weekly-winners', event, ...fields, ts: new Date().toISOString() }))
}

// auth: 'secret' — only callers presenting a real secret (service-role)
// key on the `apikey` header can invoke this (pg_cron, another Edge
// Function, or a manual admin test). Requires this function's `verify_jwt`
// deploy setting to be false (see supabase/config.toml) — otherwise
// Supabase's platform-level JWT check would reject a secret-key caller
// before ctx.authMode ever gets evaluated. ctx.supabaseAdmin is a
// pre-configured, RLS-bypassing client — no manual createClient() call or
// env-var reads needed.
export default {
  fetch: withSupabase({ auth: 'secret' }, async (_req, ctx) => {
    const supabase = ctx.supabaseAdmin
    const startedAt = Date.now()
    log('start')

    const acquired = await tryAcquireLock(supabase, JOB_NAME)
    if (!acquired) {
      log('skipped_concurrent_run', { duration_ms: Date.now() - startedAt })
      return Response.json({ success: true, skipped: true, reason: 'A previous run is still in progress' })
    }

    try {
      // Confidence-only: this function reads picks/scores/tie_breakers,
      // which Survivor and Pick'em pools never populate (they each have
      // their own authoritative service — src/lib/survivor.ts and
      // src/lib/pickem.ts — computed live, not via this cron). Without this
      // filter every active Survivor/Pick'em pool would silently get a
      // bogus "weekly winner" computed from empty Confidence tables.
      const { data: pools, error: poolsError } = await supabase
        .from('pools')
        .select('id, name, season, pool_type, tie_breaker_question, tie_breaker_answer')
        .eq('is_active', true)
        .in('competition_type', ['NFL_CONFIDENCE', 'NCAA_CONFIDENCE'])

      if (poolsError) throw poolsError

      log('pools_loaded', { pool_count: pools?.length ?? 0 })

      const summary: any[] = []
      for (const pool of pools ?? []) {
        summary.push(await processPool(supabase, pool))
      }

      const weeksCreated = summary.reduce((n, p) => n + p.weeks.filter((w: any) => w.status === 'created').length, 0)
      const periodsCreated = summary.reduce((n, p) => n + p.periods.filter((pd: any) => pd.status === 'created').length, 0)
      const seasonsCreated = summary.filter(p => p.season?.status === 'created').length

      log('complete', {
        pool_count: summary.length,
        weeks_created: weeksCreated,
        periods_created: periodsCreated,
        seasons_created: seasonsCreated,
        duration_ms: Date.now() - startedAt,
      })

      return Response.json({ success: true, pools: summary.length, summary })
    } catch (error) {
      log('error', { message: (error as Error).message, duration_ms: Date.now() - startedAt })
      console.error('Error in determine-weekly-winners function:', error)
      return Response.json({ success: false, error: (error as Error).message }, { status: 500 })
    } finally {
      await releaseLock(supabase, JOB_NAME)
    }
  }),
}

function nameOf(row: any): string {
  const p = Array.isArray(row.participants) ? row.participants[0] : row.participants
  return p?.name || 'Unknown'
}

// Deliberately NOT a status-string match — games.status has been written
// with inconsistent casing across historical sync runs ('final', 'Final',
// 'finished' have all been observed for the same terminal state). `winner`
// being set is normally the reliable signal regardless of status casing —
// but a small number of real games end in a tie (no winner) with a terminal
// status, so status is also checked as a fallback to avoid permanently
// blocking scoring for weeks containing a tie game.
const TERMINAL_GAME_STATUSES = new Set(['final', 'finished', 'cancelled'])
function isGameFinished(game: { status?: string | null; winner?: string | null }): boolean {
  if (game.winner != null) return true
  const status = game.status?.toLowerCase()
  return status != null && TERMINAL_GAME_STATUSES.has(status)
}

async function processPool(supabase: any, pool: any) {
  const weeksProcessed: any[] = []
  const periodsProcessed: any[] = []
  let seasonProcessed: any = null

  const { data: seasonTypeRows } = await supabase
    .from('games')
    .select('season_type')
    .eq('season', pool.season)
  const seasonTypes = [...new Set((seasonTypeRows ?? []).map((r: any) => r.season_type))]

  if (seasonTypes.length === 0) {
    log('pool_no_games_for_season', { pool_id: pool.id, season: pool.season })
  }

  for (const seasonType of seasonTypes) {
    const { data: weekRows } = await supabase
      .from('games')
      .select('week')
      .eq('season', pool.season)
      .eq('season_type', seasonType)
    const weeks = [...new Set((weekRows ?? []).map((r: any) => r.week))].sort((a: any, b: any) => a - b)

    for (const week of weeks) {
      weeksProcessed.push(await ensureWeekWinner(supabase, pool, week, seasonType))
    }

    if (seasonType === REGULAR_SEASON_TYPE) {
      for (const quarterWeek of Object.keys(QUARTERS).map(Number)) {
        if (!weeks.includes(quarterWeek)) continue
        periodsProcessed.push(await ensurePeriodWinner(supabase, pool, quarterWeek))
      }
      seasonProcessed = await ensureSeasonWinner(supabase, pool)
    }
  }

  const created = weeksProcessed.filter(w => w.status === 'created').length
  log('pool_processed', {
    pool_id: pool.id,
    season: pool.season,
    weeks_checked: weeksProcessed.length,
    weeks_created: created,
    periods_created: periodsProcessed.filter(p => p.status === 'created').length,
    season_status: seasonProcessed?.status ?? 'not_regular_season',
  })

  return { pool_id: pool.id, pool_name: pool.name, weeks: weeksProcessed, periods: periodsProcessed, season: seasonProcessed }
}

// ---- Weekly winner ----

async function ensureWeekWinner(supabase: any, pool: any, week: number, seasonType: number) {
  const base = { week, season_type: seasonType }

  const { data: existing } = await supabase
    .from('weekly_winners')
    .select('id')
    .eq('pool_id', pool.id).eq('week', week).eq('season', pool.season).eq('season_type', seasonType)
    .maybeSingle()
  if (existing) return { ...base, status: 'already_recorded' }

  const { data: games } = await supabase
    .from('games')
    .select('status, winner')
    .eq('week', week).eq('season', pool.season).eq('season_type', seasonType)
  if (!games || games.length === 0) return { ...base, status: 'no_games' }
  if (!games.every((g: any) => isGameFinished(g))) {
    return { ...base, status: 'not_all_finished', games_finished: games.filter(isGameFinished).length, games_total: games.length }
  }

  await computeAndSaveScores(supabase, pool.id, week, pool.season, seasonType)

  const winner = await calculateWeeklyWinner(supabase, pool, week, seasonType)
  if (!winner) return { ...base, status: 'no_scorable_picks' }

  const { error } = await supabase
    .from('weekly_winners')
    .upsert(winner, { onConflict: 'pool_id,week,season,season_type' })
  if (error) {
    console.error(`Failed to save weekly winner for pool ${pool.id} week ${week}:`, error)
    return { ...base, status: 'save_failed', reason: error.message }
  }
  return { ...base, status: 'created', winner: winner.winner_name }
}

async function computeAndSaveScores(supabase: any, poolId: string, week: number, season: number, seasonType: number) {
  const { data: picks, error: picksError } = await supabase
    .from('picks')
    .select(`participant_id, predicted_winner, confidence_points, games!inner(winner, week, season, season_type)`)
    .eq('pool_id', poolId)
    .eq('games.week', week)
    .eq('games.season', season)
    .eq('games.season_type', seasonType)

  if (picksError) {
    console.error(`Failed to fetch picks for pool ${poolId} week ${week}:`, picksError)
    return
  }

  const scoresMap = new Map<string, { participant_id: string; points: number; correct_picks: number; total_picks: number }>()
  for (const pick of picks ?? []) {
    const game = Array.isArray(pick.games) ? pick.games[0] : pick.games
    if (!scoresMap.has(pick.participant_id)) {
      scoresMap.set(pick.participant_id, { participant_id: pick.participant_id, points: 0, correct_picks: 0, total_picks: 0 })
    }
    const score = scoresMap.get(pick.participant_id)!
    score.total_picks++
    if (game?.winner && pick.predicted_winner === game.winner) {
      score.correct_picks++
      score.points += pick.confidence_points
    }
  }

  await supabase.from('scores').delete().eq('pool_id', poolId).eq('week', week).eq('season', season).eq('season_type', seasonType)

  const rows = Array.from(scoresMap.values()).map(s => ({ ...s, pool_id: poolId, week, season, season_type: seasonType }))
  if (rows.length > 0) {
    const { error } = await supabase.from('scores').insert(rows)
    if (error) console.error(`Failed to insert scores for pool ${poolId} week ${week}:`, error)
    else log('scores_saved', { pool_id: poolId, week, season, season_type: seasonType, rows: rows.length })
  }
}

async function calculateWeeklyWinner(supabase: any, pool: any, week: number, seasonType: number) {
  const { data: scores } = await supabase
    .from('scores')
    .select(`participant_id, points, correct_picks, participants!inner(name)`)
    .eq('pool_id', pool.id).eq('week', week).eq('season', pool.season).eq('season_type', seasonType)
    .order('points', { ascending: false })

  if (!scores || scores.length === 0) return null
  const maxPoints = scores[0].points
  if (maxPoints === 0) return null

  const topScorers = scores.filter((s: any) => s.points === maxPoints)

  let winner = topScorers[0]
  let tieBreakerUsed = false

  if (topScorers.length > 1) {
    const isNormalPool = pool.pool_type === 'normal' || pool.pool_type == null
    const isPeriodWeek = PERIOD_WEEKS.includes(week)
    const isSuperBowl = seasonType === SUPER_BOWL_SEASON_TYPE
    const shouldUseTieBreaker = !isNormalPool || isPeriodWeek || isSuperBowl

    if (shouldUseTieBreaker) {
      const resolved = await resolveTieBreaker(supabase, pool, week, seasonType, topScorers)
      if (resolved.length === 0) return null
      winner = resolved[0]
      tieBreakerUsed = true
    }
  }

  return {
    pool_id: pool.id,
    week,
    season: pool.season,
    season_type: seasonType,
    winner_participant_id: winner.participant_id,
    winner_name: nameOf(winner),
    winner_points: winner.points,
    winner_correct_picks: winner.correct_picks,
    tie_breaker_used: tieBreakerUsed,
    tie_breaker_question: pool.tie_breaker_question ?? null,
    tie_breaker_answer: tieBreakerUsed ? (pool.tie_breaker_answer ?? null) : null,
    winner_tie_breaker_answer: winner.tie_breaker_answer ?? null,
    tie_breaker_difference: winner.tie_breaker_difference ?? null,
    total_participants: scores.length,
  }
}

async function resolveTieBreaker(supabase: any, pool: any, week: number, seasonType: number, tied: any[]) {
  const poolAnswer = pool.tie_breaker_answer
  if (!poolAnswer) {
    return [...tied].sort(() => Math.random() - 0.5)
  }

  const { data: tieBreakers } = await supabase
    .from('tie_breakers')
    .select('participant_id, answer')
    .eq('pool_id', pool.id).eq('week', week).eq('season', pool.season).eq('season_type', seasonType)
    .in('participant_id', tied.map((p: any) => p.participant_id))

  const withDiff = tied.map((p: any) => {
    const tb = tieBreakers?.find((t: any) => t.participant_id === p.participant_id)
    const diff = tb?.answer != null ? Math.abs(tb.answer - poolAnswer) : Infinity
    return { ...p, tie_breaker_answer: tb?.answer, tie_breaker_difference: diff }
  })

  return withDiff.sort((a: any, b: any) => (a.tie_breaker_difference ?? Infinity) - (b.tie_breaker_difference ?? Infinity))
}

// ---- Period (quarterly) winner ----

async function ensurePeriodWinner(supabase: any, pool: any, quarterWeek: number) {
  const quarter = QUARTERS[quarterWeek]
  const base = { period: quarter?.name ?? `week${quarterWeek}` }
  if (!quarter) return { ...base, status: 'unknown_period' }

  const { data: existing } = await supabase
    .from('period_winners')
    .select('id')
    .eq('pool_id', pool.id).eq('season', pool.season).eq('period_name', quarter.name)
    .maybeSingle()
  if (existing) return { ...base, status: 'already_recorded' }

  const { data: games } = await supabase
    .from('games')
    .select('status, winner')
    .eq('season', pool.season).eq('season_type', REGULAR_SEASON_TYPE)
    .gte('week', quarter.startWeek).lte('week', quarter.endWeek)
  if (!games || games.length === 0) return { ...base, status: 'no_games' }
  if (!games.every((g: any) => isGameFinished(g))) {
    return { ...base, status: 'not_all_finished', games_finished: games.filter(isGameFinished).length, games_total: games.length }
  }

  const winner = await calculatePeriodWinner(supabase, pool, quarter)
  if (!winner) return { ...base, status: 'no_scorable_picks' }

  const { error } = await supabase
    .from('period_winners')
    .upsert(winner, { onConflict: 'pool_id,season,period_name' })
  if (error) {
    console.error(`Failed to save period winner for pool ${pool.id} ${quarter.name}:`, error)
    return { ...base, status: 'save_failed', reason: error.message }
  }
  return { ...base, status: 'created', winner: winner.winner_name }
}

async function calculatePeriodWinner(supabase: any, pool: any, quarter: { name: string; startWeek: number; endWeek: number }) {
  const { data: scores } = await supabase
    .from('scores')
    .select(`participant_id, points, correct_picks, participants!inner(name)`)
    .eq('pool_id', pool.id).eq('season', pool.season).eq('season_type', REGULAR_SEASON_TYPE)
    .gte('week', quarter.startWeek).lte('week', quarter.endWeek)

  if (!scores || scores.length === 0) return null

  const totals = new Map<string, any>()
  for (const s of scores) {
    const existing = totals.get(s.participant_id)
    if (existing) {
      existing.period_points += s.points
      existing.period_correct_picks += s.correct_picks
    } else {
      totals.set(s.participant_id, {
        participant_id: s.participant_id,
        participant_name: nameOf(s),
        period_points: s.points,
        period_correct_picks: s.correct_picks,
        weeks_won: 0,
      })
    }
  }

  const { data: weeklyWinners } = await supabase
    .from('weekly_winners')
    .select('winner_participant_id')
    .eq('pool_id', pool.id).eq('season', pool.season).eq('season_type', REGULAR_SEASON_TYPE)
    .gte('week', quarter.startWeek).lte('week', quarter.endWeek)

  for (const w of weeklyWinners ?? []) {
    const t = totals.get(w.winner_participant_id)
    if (t) t.weeks_won++
  }

  const list = Array.from(totals.values()).sort((a: any, b: any) => b.period_points - a.period_points)
  if (list.length === 0) return null

  const maxPoints = list[0].period_points
  const topScorers = list.filter((p: any) => p.period_points === maxPoints)
  const isNormalPool = pool.pool_type === 'normal' || pool.pool_type == null

  let winner = topScorers[0]
  let tieBreakerUsed = false

  if (topScorers.length > 1) {
    if (!isNormalPool) {
      const resolved = await resolvePeriodTieBreaker(supabase, pool, quarter, topScorers)
      if (resolved.length === 0) return null
      winner = resolved[0]
      tieBreakerUsed = true
    } else {
      const sortedByWeeksWon = [...topScorers].sort((a: any, b: any) => b.weeks_won - a.weeks_won)
      const maxWeeksWon = sortedByWeeksWon[0].weeks_won
      const stillTied = sortedByWeeksWon.filter((p: any) => p.weeks_won === maxWeeksWon)
      if (stillTied.length === 1) {
        winner = stillTied[0]
      } else {
        const resolved = await resolvePeriodTieBreaker(supabase, pool, quarter, stillTied)
        if (resolved.length > 0) {
          winner = resolved[0]
          tieBreakerUsed = true
        } else {
          winner = stillTied[0]
        }
      }
    }
  }

  return {
    pool_id: pool.id,
    season: pool.season,
    period_name: quarter.name,
    start_week: quarter.startWeek,
    end_week: quarter.endWeek,
    winner_participant_id: winner.participant_id,
    winner_name: winner.participant_name,
    winner_points: winner.period_points,
    winner_total_picks: 0,
    winner_correct_picks: winner.period_correct_picks,
    winner_weeks_won: winner.weeks_won,
    period_points: winner.period_points,
    period_correct_picks: winner.period_correct_picks,
    weeks_won: winner.weeks_won,
    tie_breaker_used: tieBreakerUsed,
    tie_breaker_question: null,
    tie_breaker_answer: null,
    winner_tie_breaker_answer: winner.tie_breaker_answer ?? null,
    tie_breaker_difference: winner.tie_breaker_difference ?? null,
    total_participants: list.length,
  }
}

async function resolvePeriodTieBreaker(supabase: any, pool: any, quarter: { startWeek: number; endWeek: number }, tied: any[]) {
  const poolAnswer = pool.tie_breaker_answer
  if (!poolAnswer) {
    return [...tied].sort((a: any, b: any) => b.weeks_won - a.weeks_won)
  }

  const { data: tieBreakers } = await supabase
    .from('tie_breakers')
    .select('participant_id, answer, week')
    .eq('pool_id', pool.id).eq('season', pool.season).eq('season_type', REGULAR_SEASON_TYPE)
    .gte('week', quarter.startWeek).lte('week', quarter.endWeek)
    .in('participant_id', tied.map((p: any) => p.participant_id))
    .order('week', { ascending: false })

  const withDiff = tied.map((p: any) => {
    const tb = tieBreakers?.find((t: any) => t.participant_id === p.participant_id)
    const diff = tb?.answer != null ? Math.abs(tb.answer - poolAnswer) : Infinity
    return { ...p, tie_breaker_answer: tb?.answer, tie_breaker_difference: diff }
  })

  return withDiff.sort((a: any, b: any) => (a.tie_breaker_difference ?? Infinity) - (b.tie_breaker_difference ?? Infinity))
}

// ---- Season winner ----

async function ensureSeasonWinner(supabase: any, pool: any) {
  const { data: existing } = await supabase
    .from('season_winners')
    .select('id')
    .eq('pool_id', pool.id).eq('season', pool.season)
    .maybeSingle()
  if (existing) return { status: 'already_recorded' }

  const { data: games } = await supabase
    .from('games')
    .select('status, winner')
    .eq('season', pool.season).eq('season_type', REGULAR_SEASON_TYPE)
  if (!games || games.length === 0) return { status: 'no_games' }
  if (!games.every((g: any) => isGameFinished(g))) {
    return { status: 'not_all_finished', games_finished: games.filter(isGameFinished).length, games_total: games.length }
  }

  const winner = await calculateSeasonWinner(supabase, pool)
  if (!winner) return { status: 'no_scorable_picks' }

  const { error } = await supabase
    .from('season_winners')
    .upsert(winner, { onConflict: 'pool_id,season' })
  if (error) {
    console.error(`Failed to save season winner for pool ${pool.id}:`, error)
    return { status: 'save_failed', reason: error.message }
  }
  return { status: 'created', winner: winner.winner_name }
}

async function calculateSeasonWinner(supabase: any, pool: any) {
  const { data: scores } = await supabase
    .from('scores')
    .select(`participant_id, points, correct_picks, participants!inner(name)`)
    .eq('pool_id', pool.id).eq('season', pool.season).eq('season_type', REGULAR_SEASON_TYPE)

  if (!scores || scores.length === 0) return null

  const totals = new Map<string, any>()
  for (const s of scores) {
    const existing = totals.get(s.participant_id)
    if (existing) {
      existing.total_points += s.points
      existing.total_correct_picks += s.correct_picks
    } else {
      totals.set(s.participant_id, {
        participant_id: s.participant_id,
        participant_name: nameOf(s),
        total_points: s.points,
        total_correct_picks: s.correct_picks,
        weeks_won: 0,
      })
    }
  }

  const { data: weeklyWinners } = await supabase
    .from('weekly_winners')
    .select('winner_participant_id')
    .eq('pool_id', pool.id).eq('season', pool.season).eq('season_type', REGULAR_SEASON_TYPE)

  for (const w of weeklyWinners ?? []) {
    const t = totals.get(w.winner_participant_id)
    if (t) t.weeks_won++
  }

  const list = Array.from(totals.values()).sort((a: any, b: any) => b.total_points - a.total_points)
  if (list.length === 0) return null

  const maxPoints = list[0].total_points
  const topScorers = list.filter((p: any) => p.total_points === maxPoints)
  const isNormalPool = pool.pool_type === 'normal' || pool.pool_type == null

  let winner = topScorers[0]
  let tieBreakerUsed = false

  if (topScorers.length > 1) {
    if (!isNormalPool) {
      const resolved = await resolveSeasonTieBreaker(supabase, pool, topScorers)
      if (resolved.length === 0) return null
      winner = resolved[0]
      tieBreakerUsed = true
    } else {
      winner = [...topScorers].sort((a: any, b: any) => b.weeks_won - a.weeks_won)[0]
    }
  }

  return {
    pool_id: pool.id,
    season: pool.season,
    winner_participant_id: winner.participant_id,
    winner_name: winner.participant_name,
    total_points: winner.total_points,
    total_correct_picks: winner.total_correct_picks,
    weeks_won: winner.weeks_won,
    tie_breaker_used: tieBreakerUsed,
    tie_breaker_question: null,
    tie_breaker_answer: null,
    winner_tie_breaker_answer: winner.tie_breaker_answer ?? null,
    tie_breaker_difference: winner.tie_breaker_difference ?? null,
    total_participants: list.length,
  }
}

async function resolveSeasonTieBreaker(supabase: any, pool: any, tied: any[]) {
  const poolAnswer = pool.tie_breaker_answer
  if (!poolAnswer) {
    return [...tied].sort((a: any, b: any) => b.weeks_won - a.weeks_won)
  }

  const { data: tieBreakers } = await supabase
    .from('tie_breakers')
    .select('participant_id, answer, week')
    .eq('pool_id', pool.id).eq('season', pool.season).eq('season_type', REGULAR_SEASON_TYPE)
    .in('participant_id', tied.map((p: any) => p.participant_id))
    .order('week', { ascending: false })

  const withDiff = tied.map((p: any) => {
    const tb = tieBreakers?.find((t: any) => t.participant_id === p.participant_id)
    const diff = tb?.answer != null ? Math.abs(tb.answer - poolAnswer) : Infinity
    return { ...p, tie_breaker_answer: tb?.answer, tie_breaker_difference: diff }
  })

  return withDiff.sort((a: any, b: any) => (a.tie_breaker_difference ?? Infinity) - (b.tie_breaker_difference ?? Infinity))
}
