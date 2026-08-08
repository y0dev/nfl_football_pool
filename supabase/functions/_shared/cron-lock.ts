// Shared mutual-exclusion helper for scheduled Edge Functions — see the
// cron_run_locks table (supabase/migrations/*_add_cron_run_locks.sql).
// Prevents two overlapping invocations of the same job (e.g. a slow run
// still in flight when the next pg_cron tick fires) from racing each other.
// deno-lint-ignore-file no-explicit-any

const LOCK_STALE_MS = 5 * 60 * 1000 // 5 minutes — comfortably longer than either job's expected runtime

export async function tryAcquireLock(supabase: any, jobName: string): Promise<boolean> {
  const { data: existing, error: selectError } = await supabase
    .from('cron_run_locks')
    .select('locked_at')
    .eq('job_name', jobName)
    .maybeSingle()

  // Errors here (e.g. the cron_run_locks table not existing yet) used to be
  // silently swallowed, which made every call fall through to the upsert
  // below, fail the same way, and report "A previous run is still in
  // progress" — indistinguishable from genuine lock contention. Log it
  // explicitly so the real cause shows up in `supabase functions logs`.
  if (selectError) {
    console.error(JSON.stringify({ event: 'lock_select_failed', job_name: jobName, error: selectError.message ?? String(selectError) }))
    return false
  }

  if (existing) {
    const age = Date.now() - new Date(existing.locked_at).getTime()
    if (age < LOCK_STALE_MS) return false // another run is genuinely still in flight
    // else: stale lock from a crashed/killed run — safe to take over
  }

  const { error: upsertError } = await supabase
    .from('cron_run_locks')
    .upsert({ job_name: jobName, locked_at: new Date().toISOString() }, { onConflict: 'job_name' })

  if (upsertError) {
    console.error(JSON.stringify({ event: 'lock_upsert_failed', job_name: jobName, error: upsertError.message ?? String(upsertError) }))
    return false
  }

  return true
}

export async function releaseLock(supabase: any, jobName: string): Promise<void> {
  await supabase.from('cron_run_locks').delete().eq('job_name', jobName)
}
