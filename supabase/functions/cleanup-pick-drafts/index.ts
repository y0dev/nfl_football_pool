// deno-lint-ignore-file no-explicit-any
// Sweeps pick_drafts once a week's games are all finished — by then the
// week is locked for overrides anyway (see getOverrideEligibility in
// src/lib/season-status.ts), so a leftover draft is permanently dead
// weight, not a still-actionable item for the commissioner. Scheduled for
// Wednesdays (see the pg_cron migration this ships with), comfortably after
// Monday Night Football wraps up every week's games; the "all games
// finished" check is the real safety net regardless of exactly when this
// runs, so a schedule drift or manual invocation can never delete a draft
// for a week that's still in progress.
//
// Deliberately does NOT send any email — the commissioner already got a
// real-time alert when the draft was first created (see
// src/app/api/picks/draft/route.ts's notifyCommissionerOfDraft), so a
// second notification here would just be noise for something they already
// had the whole week to act on.
//
// This is a Supabase Edge Function, so it can't import src/lib/season-status.ts
// directly — isGameFinished below is a Deno-compatible port of the same rule.
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { withSupabase } from "jsr:@supabase/server@^1"
import { tryAcquireLock, releaseLock } from '../_shared/cron-lock.ts'

const JOB_NAME = 'cleanup-pick-drafts'

function log(event: string, fields: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ fn: JOB_NAME, event, ...fields, ts: new Date().toISOString() }))
}

// Same rule as src/lib/season-status.ts's isGameFinished — kept in sync by
// hand since Deno can't import that file. `winner` set is the reliable
// signal regardless of games.status's inconsistent historical casing; a
// small number of real games end in a tie (no winner) with a terminal
// status, so status is checked as a fallback.
const TERMINAL_GAME_STATUSES = new Set(['final', 'finished', 'cancelled'])
function isGameFinished(game: { status?: string | null; winner?: string | null }): boolean {
  if (game.winner != null) return true
  const status = game.status?.toLowerCase()
  return status != null && TERMINAL_GAME_STATUSES.has(status)
}

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
      const { data: draftWeeks, error: draftWeeksError } = await supabase
        .from('pick_drafts')
        .select('season, season_type, week')
      if (draftWeeksError) throw draftWeeksError

      // Distinct (season, season_type, week) combos — pick_drafts can hold
      // many rows (one per participant) for the same week.
      const combos = new Map<string, { season: number; season_type: number; week: number }>()
      for (const row of draftWeeks ?? []) {
        const key = `${row.season}|${row.season_type}|${row.week}`
        if (!combos.has(key)) combos.set(key, row)
      }

      log('combos_found', { combo_count: combos.size })

      const results: any[] = []
      for (const combo of combos.values()) {
        results.push(await cleanupCombo(supabase, combo))
      }

      const deletedCombos = results.filter(r => r.status === 'deleted')
      const totalRowsDeleted = deletedCombos.reduce((n, r) => n + (r.rows_deleted ?? 0), 0)

      log('complete', {
        combos_checked: results.length,
        combos_deleted: deletedCombos.length,
        rows_deleted: totalRowsDeleted,
        duration_ms: Date.now() - startedAt,
      })

      return Response.json({ success: true, combos_checked: results.length, rows_deleted: totalRowsDeleted, results })
    } catch (error) {
      log('error', { message: (error as Error).message, duration_ms: Date.now() - startedAt })
      console.error('Error in cleanup-pick-drafts function:', error)
      return Response.json({ success: false, error: (error as Error).message }, { status: 500 })
    } finally {
      await releaseLock(supabase, JOB_NAME)
    }
  }),
}

async function cleanupCombo(supabase: any, combo: { season: number; season_type: number; week: number }) {
  const base = { season: combo.season, season_type: combo.season_type, week: combo.week }

  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('status, winner')
    .eq('season', combo.season)
    .eq('season_type', combo.season_type)
    .eq('week', combo.week)

  if (gamesError) {
    console.error(`Failed to load games for ${JSON.stringify(base)}:`, gamesError)
    return { ...base, status: 'games_load_failed', reason: gamesError.message }
  }
  if (!games || games.length === 0) {
    // No games on record for this combo at all — can't confirm the week is
    // over, so leave the draft alone rather than guessing.
    return { ...base, status: 'no_games' }
  }
  if (!games.every((g: any) => isGameFinished(g))) {
    return { ...base, status: 'not_all_finished', games_finished: games.filter(isGameFinished).length, games_total: games.length }
  }

  const { data: deleted, error: deleteError } = await supabase
    .from('pick_drafts')
    .delete()
    .eq('season', combo.season)
    .eq('season_type', combo.season_type)
    .eq('week', combo.week)
    .select('id')

  if (deleteError) {
    console.error(`Failed to delete pick_drafts for ${JSON.stringify(base)}:`, deleteError)
    return { ...base, status: 'delete_failed', reason: deleteError.message }
  }

  return { ...base, status: 'deleted', rows_deleted: deleted?.length ?? 0 }
}
