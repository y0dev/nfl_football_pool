// deno-lint-ignore-file no-explicit-any
// Frequent, lightweight job: refreshes ONLY status/home_score/away_score/winner
// on the `games` table from ESPN. Does not touch scores, weekly_winners,
// period_winners, or season_winners — see determine-weekly-winners for that.
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { withSupabase } from "jsr:@supabase/server@^1"
import { tryAcquireLock, releaseLock } from '../_shared/cron-lock.ts'

const JOB_NAME = 'update-game-scores'

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl'

// Structured, single-line, secret-free logs — every field here is either an
// id, a count, or a duration, never a key/token/credential.
function log(event: string, fields: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ fn: 'update-game-scores', event, ...fields, ts: new Date().toISOString() }))
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
        .select('id, home_team, away_team, status')
        .eq('is_active', true)
        .in('status', ['scheduled', 'live'])

      if (openGamesError) throw openGamesError

      if (!openGames || openGames.length === 0) {
        log('complete', { checked: 0, updated: 0, reason: 'no_open_games', duration_ms: Date.now() - startedAt })
        return Response.json({ success: true, message: 'No open games to update', updated: 0, checked: 0 })
      }

      log('open_games_loaded', { open_game_count: openGames.length })

      const openGameMap = new Map(openGames.map((g: any) => [g.id, g]))

      // A generous +/-3 day window around today, matched by ESPN event id.
      // This sidesteps the app's own inconsistent week-numbering conventions
      // across season types (see nfl-api.ts weekDateRange vs the games table's
      // stored week values for postseason) — we don't need to know the week,
      // just which ESPN events overlap our currently-open games.
      const { start, end } = dateWindow(3)
      const events = await fetchScoreboardEvents(start, end)
      log('espn_events_fetched', { window_start: start, window_end: end, event_count: events.length })

      let updated = 0
      const now = new Date().toISOString()

      for (const event of events) {
        const openGame = openGameMap.get(event.id)
        if (!openGame) continue

        const competition = event.competitions?.[0]
        const state = competition?.status?.type?.state ?? 'pre'
        const status = state === 'post' ? 'finished' : state === 'in' ? 'live' : 'scheduled'

        const homeC = competition?.competitors?.find((c: any) => c.homeAway === 'home')
        const awayC = competition?.competitors?.find((c: any) => c.homeAway === 'away')
        const homeScore = homeC?.score ? parseInt(homeC.score, 10) : null
        const awayScore = awayC?.score ? parseInt(awayC.score, 10) : null

        let winner: string | null = null
        if (status === 'finished' && homeScore != null && awayScore != null) {
          if (homeScore > awayScore) winner = openGame.home_team
          else if (awayScore > homeScore) winner = openGame.away_team
          // else: tie, no winner
        }

        const { error: updateError } = await supabase
          .from('games')
          .update({ status, home_score: homeScore, away_score: awayScore, winner, updated_at: now })
          .eq('id', event.id)

        if (updateError) {
          console.error(`Failed to update game ${event.id}:`, updateError)
          continue
        }
        updated++
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
      console.error('Error in update-game-scores function:', error)
      return Response.json({ success: false, error: (error as Error).message }, { status: 500 })
    } finally {
      await releaseLock(supabase, JOB_NAME)
    }
  }),
}

function dateWindow(days: number): { start: string; end: string } {
  const toYMD = (d: Date) => {
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
    return `${y}${m}${day}`
  }
  const now = new Date()
  const start = new Date(now.getTime() - days * 86_400_000)
  const end = new Date(now.getTime() + days * 86_400_000)
  return { start: toYMD(start), end: toYMD(end) }
}

async function fetchScoreboardEvents(start: string, end: string): Promise<any[]> {
  const url = `${ESPN_BASE}/scoreboard?dates=${start}-${end}`
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'NFL-Confidence-Pool/1.0' },
  })
  if (!response.ok) {
    throw new Error(`ESPN API request failed: ${response.status} ${response.statusText}`)
  }
  const data = await response.json()
  return data.events ?? []
}
