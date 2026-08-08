-- Restricts update-game-scores' actual work (the ESPN fetch) to times when
-- there's real syncing to do, instead of calling out to ESPN on every */10
-- pg_cron tick, 24/7, all season.
--
-- Why this was happening: the function's own "any open games?" check
-- (status in ('scheduled','live')) was never actually empty during an
-- active season — next week's games are pre-loaded well in advance with
-- status='scheduled', so they always counted as "open" long before their
-- own kickoff. The result: a full ESPN call on every 10-minute tick even on
-- a random Tuesday afternoon with no NFL games happening at all.
--
-- Deliberately data-driven rather than a day-of-week/hour cron restriction
-- (e.g. "only Thu/Sun/Mon evenings") — the NFL doesn't confine games to a
-- fixed weekly pattern (Thanksgiving, Christmas, Black Friday, late-season
-- Saturdays, international windows all fall outside it), so a hardcoded
-- schedule would silently miss real game days. Instead this fires only when
-- a game that SHOULD already be live or finished by now still shows
-- 'scheduled'/'live' in our data (kickoff_time <= now()) — true exactly
-- when there's real syncing work pending, regardless of which calendar day
-- or time that falls on.
--
-- The pg_cron tick itself still fires every 10 minutes as before; this only
-- gates the net.http_post call (and therefore the ESPN fetch and Edge
-- Function invocation) inside it. The local `exists(...)` check is a cheap
-- in-database query, not an external call, so ticking on the old cadence
-- costs nothing meaningful.
--
-- cron.schedule is idempotent by job name, so re-running this (or the
-- original 20260803220827 migration) updates the existing job in place
-- rather than duplicating it.
select cron.schedule(
  'update-game-scores',
  '*/10 * * * *',
  $$
  do $body$
  begin
    if exists (
      select 1 from games
      where is_active = true
        and status in ('scheduled', 'live')
        and kickoff_time <= now()
    ) then
      perform net.http_post(
        url := 'https://muvtenjtdzlwcwmzksxy.supabase.co/functions/v1/update-game-scores',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
        ),
        body := '{}'::jsonb
      );
    end if;
  end;
  $body$;
  $$
);
