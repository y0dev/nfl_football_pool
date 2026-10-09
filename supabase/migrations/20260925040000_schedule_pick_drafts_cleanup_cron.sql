-- Schedules the cleanup-pick-drafts Edge Function to run every Wednesday,
-- sweeping any pick_drafts rows left over from a week whose games are all
-- finished (see supabase/functions/cleanup-pick-drafts/index.ts for the
-- "all finished" check that makes this safe to run on a fixed schedule
-- rather than depending on exact timing). Wednesday is comfortably after
-- Monday Night Football wraps up every week's games.
--
-- Reuses the 'service_role_key' Vault secret created by
-- 20260803220827_schedule_winners_and_scores_cron.sql — that migration
-- must already be applied (it is, on this project) before this one, or the
-- net.http_post call below has no key to authenticate with.
--
-- Timezone: pg_cron schedules are evaluated in the database's configured
-- timezone, which defaults to UTC on Supabase-hosted projects (unmodified
-- here). 15:00 UTC is mid-to-late morning across the US, and — the part
-- that actually matters — every NFL game from the target week is long over
-- by any time on Wednesday, so the exact hour has no bearing on
-- correctness; the Edge Function's own "all games finished" check is what
-- actually guards against deleting a still-in-progress week's draft.
--
-- Concurrency: cleanup-pick-drafts acquires a lock (see
-- supabase/functions/_shared/cron-lock.ts) before doing any work, same as
-- the other two scheduled functions, so an overlapping tick is skipped
-- rather than running concurrently against the same rows.
select cron.schedule(
  'cleanup-pick-drafts',
  '0 15 * * 3',
  $$
  select net.http_post(
    url := 'https://muvtenjtdzlwcwmzksxy.supabase.co/functions/v1/cleanup-pick-drafts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- cron.schedule is idempotent by job name — re-running this migration
-- updates the existing schedule rather than duplicating it.
