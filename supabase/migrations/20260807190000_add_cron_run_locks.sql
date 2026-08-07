-- Lightweight mutual-exclusion table so a scheduled Edge Function invocation
-- can detect and skip if a previous run of the same job is still in flight
-- (or crashed without cleaning up) — prevents concurrent/overlapping runs of
-- determine-weekly-winners and update-game-scores, both of which run on a
-- recurring pg_cron schedule and could otherwise overlap if one run takes
-- longer than the interval between ticks.
create table if not exists cron_run_locks (
  job_name text primary key,
  locked_at timestamptz not null
);

comment on table cron_run_locks is
  'Mutual-exclusion locks for scheduled Edge Functions. A row present and '
  'recent (see each function''s LOCK_STALE_MS) means that job is currently '
  'running; the function deletes its own row when it finishes. A stale row '
  '(older than LOCK_STALE_MS) is treated as an abandoned lock from a crashed '
  'run and is safely overwritten by the next invocation.';
