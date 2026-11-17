// Recomputes Confidence Pool scores, weekly winners, Q1-Q4 period winners and
// the season winner, and writes whatever changed.
//
// Which pools: those marked in confidence_results_dirty (triggers mark a pool
// whenever a finished game's result, a pick on a finished game, a
// tie-breaker answer, a participant, or the pool's tie-breaker settings
// change — see migration 20261110120000). POST {"all": true} reconciles every
// active Confidence pool instead.
//
// How: runConfidenceResultsJob() in ../_shared/confidence-results.ts, the same
// rules computeSeasonReview() (src/lib/season-review.ts) uses, so the stored
// rows match what Season Review and Close Season show. Each pool's changes
// are applied in one transaction (apply_confidence_pool_results), so a
// failure leaves that pool's stored rows untouched. A pool's dirty mark is
// cleared only after its write succeeded, so a failed pool is retried on the
// next tick. Any failure makes the whole response success:false / HTTP 500.
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { withSupabase } from "jsr:@supabase/server@^1"
import { tryAcquireLock, releaseLock } from '../_shared/cron-lock.ts'
import { runConfidenceResultsJob } from '../_shared/confidence-results.ts'

const JOB_NAME = 'determine-weekly-winners'

// Structured, single-line, secret-free logs — every field here is either an
// id, a count, or a duration, never a key/token/credential.
function log(event: string, fields: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ prefix: '[SH][CRON][LEADERBOARD]', fn: 'determine-weekly-winners', event, ...fields, ts: new Date().toISOString() }))
}

// auth: 'secret' — only callers presenting a real secret (service-role)
// key on the `apikey` header can invoke this (pg_cron, another Edge
// Function, or a manual admin test). Requires this function's `verify_jwt`
// deploy setting to be false (see supabase/config.toml) — otherwise
// Supabase's platform-level JWT check would reject a secret-key caller
// before ctx.authMode ever gets evaluated.
export default {
  fetch: withSupabase({ auth: 'secret' }, async (req, ctx) => {
    const supabase = ctx.supabaseAdmin
    const startedAt = Date.now()
    const body = await req.json().catch(() => ({}))
    const all = body?.all === true
    log('start', { all })

    const acquired = await tryAcquireLock(supabase, JOB_NAME)
    if (!acquired) {
      log('skipped_concurrent_run', { duration_ms: Date.now() - startedAt })
      return Response.json({ success: true, skipped: true, reason: 'A previous run is still in progress' })
    }

    try {
      const summary = await runConfidenceResultsJob(supabase, { all, log })
      log('complete', { processed: summary.processed, updated: summary.updated, failed: summary.failed, duration_ms: Date.now() - startedAt })
      return Response.json(summary, { status: summary.success ? 200 : 500 })
    } catch (error) {
      log('error', { message: (error as Error).message, duration_ms: Date.now() - startedAt })
      console.error('[SH][CRON][LEADERBOARD] Error in determine-weekly-winners function:', error)
      return Response.json({ success: false, error: (error as Error).message }, { status: 500 })
    } finally {
      await releaseLock(supabase, JOB_NAME)
    }
  }),
}
