-- Restricts determine-weekly-winners' actual work to when there's a genuine
-- completion to record, instead of running its full pool/week/period/season
-- sweep on every */10 pg_cron tick, 24/7, all season.
--
-- Mirrors the function's own three completion tiers (see
-- supabase/functions/determine-weekly-winners/index.ts): a week's winner
-- (weekly_winners), a quarter's winner (period_winners, only at the Q1-Q4
-- boundary weeks 4/9/14/18), and the season winner (season_winners, only at
-- week 18). All three require every relevant game to be finished AND the
-- corresponding row to not already exist — exactly the function's own
-- isGameFinished + "already_recorded" checks, duplicated here in SQL so the
-- gate can decide before invoking the function at all.
--
-- This intentionally does NOT try to detect "we're mid-way through a week"
-- (unlike update-game-scores' simpler kickoff-passed gate) — determine-
-- weekly-winners has no useful partial-week work; it only ever writes
-- something once a week/period/season is fully complete, so the exact
-- completion check below is both correct and the natural gate.
--
-- cron.schedule is idempotent by job name, so running this updates the
-- existing job in place rather than duplicating it.
select cron.schedule(
  'determine-weekly-winners',
  '5,15,25,35,45,55 * * * *',
  $$
  do $body$
  begin
    if exists (
      with finished_weeks as (
        select g.season, g.season_type, g.week,
               bool_and(g.winner is not null or lower(g.status) in ('final', 'finished', 'cancelled')) as all_finished
        from games g
        group by g.season, g.season_type, g.week
      ),
      quarters(period_name, start_week, end_week) as (
        values ('Q1', 1, 4), ('Q2', 5, 9), ('Q3', 10, 14), ('Q4', 15, 18)
      )
      select 1
      from pools p
      join finished_weeks fw on fw.season = p.season
      where p.is_active = true
        and fw.all_finished
        and (
          -- Weekly winner not yet recorded for this finished week.
          not exists (
            select 1 from weekly_winners ww
            where ww.pool_id = p.id and ww.season = p.season
              and ww.season_type = fw.season_type and ww.week = fw.week
          )
          -- Or this finished week ends a quarter (regular season only) whose
          -- period winner isn't recorded yet.
          or (
            fw.season_type = 2
            and exists (select 1 from quarters q where q.end_week = fw.week)
            and not exists (
              select 1 from games g2
              join quarters q on q.end_week = fw.week
              where g2.season = p.season and g2.season_type = 2
                and g2.week between q.start_week and q.end_week
                and not (g2.winner is not null or lower(g2.status) in ('final', 'finished', 'cancelled'))
            )
            and not exists (
              select 1 from period_winners pw
              join quarters q on q.end_week = fw.week
              where pw.pool_id = p.id and pw.season = p.season and pw.period_name = q.period_name
            )
          )
          -- Or this finished week is the last regular-season week whose
          -- season winner isn't recorded yet.
          or (
            fw.season_type = 2 and fw.week = 18
            and not exists (
              select 1 from games g3
              where g3.season = p.season and g3.season_type = 2
                and not (g3.winner is not null or lower(g3.status) in ('final', 'finished', 'cancelled'))
            )
            and not exists (
              select 1 from season_winners sw where sw.pool_id = p.id and sw.season = p.season
            )
          )
        )
      limit 1
    ) then
      perform net.http_post(
        url := 'https://muvtenjtdzlwcwmzksxy.supabase.co/functions/v1/determine-weekly-winners',
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
