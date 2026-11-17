// Frequent, lightweight job: refreshes ONLY status/home_score/away_score/winner
// on the `games` table from ESPN. Does not touch scores, weekly_winners,
// period_winners, or season_winners — see determine-weekly-winners for that.
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { withSupabase } from "jsr:@supabase/server@^1"
import { tryAcquireLock, releaseLock } from '../_shared/cron-lock.ts'
import { fetchScoreboardEvents, planGameUpdates, scoreboardDates } from '../_shared/espn-score-sync.ts'

const JOB_NAME = 'update-game-scores'

// Structured, single-line, secret-free logs — every field here is either an
// id, a count, or a duration, never a key/token/credential.
function log(event: string, fields: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ prefix: '[SH][CRON][SYNC]', fn: 'update-game-scores', event, ...fields, ts: new Date().toISOString() }))
}

// auth: 'secret' — only callers presenting a real secret (service-role) key
// on the `apikey` header can invoke this (pg_cron, another Edge Function,
// or a manual admin test). Requires this function's `verify_jwt` deploy
// setting to be false (see supabase/config.toml). ctx.supabaseAdmin is a
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
      // Only fetch games that aren't finished yet, so completed games (and
      // anything derived from them downstream) are never re-touched here.
      const { data: openGames, error: openGamesError } = await supabase
        .from('games')
        .select('id, home_team, away_team, status, kickoff_time')
        .eq('is_active', true)
        .in('status', ['scheduled', 'live'])

      if (openGamesError) throw openGamesError

      if (!openGames || openGames.length === 0) {
        log('complete', { checked: 0, updated: 0, reason: 'no_open_games', duration_ms: Date.now() - startedAt })
        return Response.json({ success: true, message: 'No open games to update', updated: 0, checked: 0 })
      }

      log('open_games_loaded', { open_game_count: openGames.length })

      // Scoreboard days: each open game's kickoff date (±1 day) plus today,
      // so a game missed on its day is still caught up later. See
      // scoreboardDates() in ../_shared/espn-score-sync.ts.
      const dates = scoreboardDates(openGames)
      const events = await fetchScoreboardEvents(dates)
      log('espn_events_fetched', { dates, event_count: events.length })

      let updated = 0
      const failures: Array<{ id: string; error: string }> = []
      const now = new Date().toISOString()

      for (const { id, update } of planGameUpdates(openGames, events)) {
        const { error: updateError } = await supabase
          .from('games')
          .update({ ...update, updated_at: now })
          .eq('id', id)

        if (updateError) {
          console.error(`[SH][CRON][SYNC] Failed to update game ${id}:`, updateError)
          failures.push({ id, error: updateError.message })
          continue
        }
        updated++
      }

      if (failures.length > 0) {
        log('error', { checked: openGames.length, updated, failed: failures.length, duration_ms: Date.now() - startedAt })
        return Response.json({
          success: false,
          error: `Failed to update ${failures.length} game(s)`,
          failures,
          updated,
          checked: openGames.length,
          timestamp: now,
        }, { status: 500 })
      }

      log('complete', { checked: openGames.length, updated, duration_ms: Date.now() - startedAt })

      return Response.json({
        success: true,
        message: `Updated ${updated} of ${openGames.length} open games`,
        updated,
        checked: openGames.length,
        timestamp: now,
      })
    } catch (error) {
      log('error', { message: (error as Error).message, duration_ms: Date.now() - startedAt })
      console.error('[SH][CRON][SYNC] Error in update-game-scores function:', error)
      return Response.json({ success: false, error: (error as Error).message }, { status: 500 })
    } finally {
      await releaseLock(supabase, JOB_NAME)
    }
  }),
}
