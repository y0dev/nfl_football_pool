// Score and winner recalculation against real Postgres (PGlite) running the
// real migration SQL: dirty-marking triggers, the transactional
// apply_confidence_pool_results(), and the cron job's sync loop.
import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDatabase, installServiceClient, type FakeSupabase } from './helpers/pg-supabase';
import { SEASON, correctWeek10, gameId, seedSeason, type SeasonFixture } from './helpers/confidence-fixture';
import { runConfidenceResultsJob } from '../../supabase/functions/_shared/confidence-results';
import { computeSeasonReview } from '../../src/lib/season-review';
import { calculateWeeklyWinners } from '../../src/lib/winner-calculator';
import { POST as closeSeasonPOST } from '../../src/app/api/admin/close-season/route';

async function setup(): Promise<{ db: PGlite; supabase: FakeSupabase; f: SeasonFixture }> {
  const { db, supabase } = await createTestDatabase();
  installServiceClient(supabase);
  const f = await seedSeason(db);
  return { db, supabase, f };
}

const one = async <T>(db: PGlite, sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];
const all = async <T>(db: PGlite, sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;

async function snapshot(db: PGlite, poolId: string) {
  return {
    scores: await all(db, `SELECT participant_id, week, season_type, points, correct_picks, total_picks FROM scores WHERE pool_id = $1 ORDER BY week, participant_id`, [poolId]),
    weekly: await all(db, `SELECT week, winner_participant_id, winner_name, winner_points, winner_correct_picks FROM weekly_winners WHERE pool_id = $1 ORDER BY week`, [poolId]),
    periods: await all(db, `SELECT period_name, winner_participant_id, period_points FROM period_winners WHERE pool_id = $1 ORDER BY period_name`, [poolId]),
    season: await all(db, `SELECT winner_participant_id, total_points, weeks_won FROM season_winners WHERE pool_id = $1`, [poolId]),
  };
}

test('triggers mark a pool dirty when a finished game is corrected, and not for live-score churn', async () => {
  const { db, f } = await setup();
  await db.exec('DELETE FROM confidence_results_dirty');

  await db.query(`INSERT INTO games (id, week, season, season_type, status) VALUES ('live-1', 1, $1, 3, 'live')`, [SEASON]);
  await db.query(`UPDATE games SET home_score = 7 WHERE id = 'live-1'`);
  await db.query(`UPDATE games SET status = 'in' WHERE id = 'live-1'`);
  assert.equal((await all(db, 'SELECT * FROM confidence_results_dirty')).length, 0, 'unfinished game changes mark nothing');

  await correctWeek10(db);
  assert.deepEqual((await all<{ pool_id: string }>(db, 'SELECT pool_id FROM confidence_results_dirty')).map(r => r.pool_id), [f.poolId]);

  await db.exec('DELETE FROM confidence_results_dirty');
  await db.query(`UPDATE picks SET confidence_points = confidence_points WHERE game_id = $1`, [gameId(3, 1)]);
  assert.equal((await all(db, 'SELECT * FROM confidence_results_dirty')).length, 1, 'pick override on a finished game marks the pool');
});

test('correcting an existing final game updates scores and every dependent winner', async () => {
  const { db, supabase, f } = await setup();

  const first = await runConfidenceResultsJob(supabase, { all: true });
  assert.equal(first.success, true);
  assert.equal(first.updated, 1);

  // Before the correction: Alice won Q1-Q3 and the season despite Bob's points.
  assert.equal((await one<{ winner_participant_id: string }>(db, `SELECT winner_participant_id FROM weekly_winners WHERE pool_id = $1 AND week = 10`, [f.poolId])).winner_participant_id, f.alice);
  assert.equal((await one<{ winner_participant_id: string }>(db, `SELECT winner_participant_id FROM period_winners WHERE pool_id = $1 AND period_name = 'Q3'`, [f.poolId])).winner_participant_id, f.alice);
  assert.equal((await one<{ winner_participant_id: string }>(db, `SELECT winner_participant_id FROM season_winners WHERE pool_id = $1`, [f.poolId])).winner_participant_id, f.alice);
  const createdBefore = await one<{ id: string; created_at: string }>(db, `SELECT id, created_at FROM season_winners WHERE pool_id = $1`, [f.poolId]);

  // A second run with nothing changed writes nothing.
  assert.equal((await runConfidenceResultsJob(supabase, { all: true })).results[0].status, 'unchanged');

  await correctWeek10(db);
  const second = await runConfidenceResultsJob(supabase); // dirty-driven, as the cron runs it
  assert.equal(second.success, true);
  assert.equal(second.processed, 1);
  assert.deepEqual(second.results[0].changes, { score_weeks: 1, weekly_upserts: 1, weekly_deletes: 0, period_upserts: 1, period_deletes: 0, season: 'upserted' }, 'only week 10, Q3 and the season change');

  const week10 = await all<{ participant_id: string; points: number }>(db, `SELECT participant_id, points FROM scores WHERE pool_id = $1 AND week = 10`, [f.poolId]);
  assert.equal(week10.find(s => s.participant_id === f.alice)?.points, 5);
  assert.equal(week10.find(s => s.participant_id === f.bob)?.points, 6);
  assert.equal((await one<{ winner_participant_id: string }>(db, `SELECT winner_participant_id FROM weekly_winners WHERE pool_id = $1 AND week = 10`, [f.poolId])).winner_participant_id, f.bob);
  assert.equal((await one<{ winner_participant_id: string }>(db, `SELECT winner_participant_id FROM period_winners WHERE pool_id = $1 AND period_name = 'Q3'`, [f.poolId])).winner_participant_id, f.bob);
  const season = await one<{ id: string; created_at: string; winner_participant_id: string; weeks_won: number }>(db, `SELECT id, created_at, winner_participant_id, weeks_won FROM season_winners WHERE pool_id = $1`, [f.poolId]);
  assert.equal(season.winner_participant_id, f.bob, '2 periods each; Bob has more weeks won');
  assert.equal(season.weeks_won, 16);
  assert.equal(season.id, createdBefore.id, 'updated in place');
  assert.equal((await all(db, 'SELECT * FROM confidence_results_dirty')).length, 0, 'mark cleared after success');
});

test('a failed write leaves every stored row intact, reports failure, and keeps the pool marked', async () => {
  const { db, supabase, f } = await setup();
  await runConfidenceResultsJob(supabase, { all: true });
  const before = await snapshot(db, f.poolId);

  // Fail inside the transaction, after the scores and weekly rows have been
  // rewritten: the period_winners write raises.
  await db.exec(`
    CREATE FUNCTION fail_period_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected period failure'; END $$;
    CREATE TRIGGER fail_period_write BEFORE INSERT OR UPDATE ON period_winners FOR EACH ROW EXECUTE FUNCTION fail_period_write();
  `);
  await correctWeek10(db);
  const run = await runConfidenceResultsJob(supabase);

  assert.equal(run.success, false);
  assert.equal(run.failed, 1);
  assert.match(run.results[0].error ?? '', /injected period failure/);
  assert.deepEqual(await snapshot(db, f.poolId), before, 'scores and winners untouched, nothing deleted');
  assert.equal((await all(db, 'SELECT * FROM confidence_results_dirty')).length, 1, 'still marked, so the next run retries');

  // Once the cause is gone, the retry applies the correction.
  await db.exec('DROP TRIGGER fail_period_write ON period_winners');
  const retry = await runConfidenceResultsJob(supabase);
  assert.equal(retry.success, true);
  assert.equal((await one<{ winner_participant_id: string }>(db, `SELECT winner_participant_id FROM season_winners WHERE pool_id = $1`, [f.poolId])).winner_participant_id, f.bob);
});

test('a read failure is reported as a failed pool, not success', async () => {
  const { db, supabase } = await setup();
  assert.equal((await all(db, 'SELECT * FROM confidence_results_dirty')).length, 1, 'seeding picks on finished games marked the pool');
  await db.exec('ALTER TABLE tie_breakers RENAME TO tie_breakers_gone');
  const run = await runConfidenceResultsJob(supabase);
  assert.equal(run.success, false);
  assert.equal(run.results[0].status, 'failed');
  assert.equal((await all(db, 'SELECT * FROM weekly_winners')).length, 0);
});

test('a mark made while a pool is being computed survives the run', async () => {
  const { db, supabase } = await setup();
  await db.exec(`UPDATE confidence_results_dirty SET marked_at = now() - interval '1 minute'`);
  const realFrom = supabase.from.bind(supabase);
  let bumped = false;
  supabase.from = (table: string) => {
    if (table === 'scores' && !bumped) {
      bumped = true; // a correction lands mid-run
      void db.exec(`UPDATE confidence_results_dirty SET marked_at = now() + interval '1 minute'`);
    }
    return realFrom(table);
  };
  await runConfidenceResultsJob(supabase);
  assert.equal((await all(db, 'SELECT * FROM confidence_results_dirty')).length, 1);
});

test('every calculation path produces the same champion when periods won and points disagree', async () => {
  const { db, supabase, f } = await setup();
  await runConfidenceResultsJob(supabase, { all: true });

  const review = await computeSeasonReview(f.poolId, SEASON);
  const bob = review.participantStats.find(p => p.participant_id === f.bob)!;
  const alice = review.participantStats.find(p => p.participant_id === f.alice)!;
  assert.ok(bob.total_points > alice.total_points, 'fixture: Bob leads on points');
  assert.equal(review.seasonWinner?.winner_participant_id, f.alice, 'Season Review: most periods');

  const cron = await one<Record<string, unknown>>(db, `SELECT * FROM season_winners WHERE pool_id = $1`, [f.poolId]);
  assert.equal(cron.winner_participant_id, f.alice, 'cron');

  // Close Season (route) rewrites the row with its own computation.
  await db.exec('DELETE FROM season_winners');
  const res = await closeSeasonPOST(new NextRequest('http://test/api/admin/close-season', { method: 'POST', body: JSON.stringify({ poolId: f.poolId }) }));
  const body = await res.json();
  assert.equal(body.success, true, JSON.stringify(body));
  const closed = await one<Record<string, unknown>>(db, `SELECT * FROM season_winners WHERE pool_id = $1`, [f.poolId]);
  const strip = (r: Record<string, unknown>) => {
    const rest = { ...r };
    for (const k of ['id', 'created_at', 'updated_at']) delete rest[k];
    return rest;
  };
  assert.deepEqual(strip(closed), strip(cron), 'Close Season writes exactly the row the cron wrote');
  // scripts/close-season.ts persists review.seasonWinnerRow as-is.
  assert.deepEqual(review.seasonWinnerRow, strip(cron), 'Season Review row matches the cron row');
});

test('Edge Function co-winners match Season Review and the admin calculator', async () => {
  const { db, supabase, f } = await setup();
  await runConfidenceResultsJob(supabase, { all: true });
  const review = await computeSeasonReview(f.poolId, SEASON);
  const stored = await all<{ week: number; winner_participant_id: string; winner_name: string; winner_points: number; winner_correct_picks: number }>(
    db, `SELECT week, winner_participant_id, winner_name, winner_points, winner_correct_picks FROM weekly_winners WHERE pool_id = $1 ORDER BY week`, [f.poolId]);

  assert.equal(stored.length, 18);
  assert.deepEqual(
    stored.map(s => [s.week, s.winner_participant_id, s.winner_name, s.winner_points, s.winner_correct_picks]),
    review.weeklyWinners.map(w => [w.week, w.winner_participant_id, w.winner_name, w.winner_points, w.winner_correct_picks]),
  );

  // A shared week: both credited, joined name, primary is first by name.
  const week3 = review.weeklyWinners.find(w => w.week === 3)!;
  assert.deepEqual(week3.winner_participant_ids, [f.alice, f.bob]);
  assert.equal(stored.find(s => s.week === 3)?.winner_name, 'Alice & Bob');

  // Weeks won credit every co-winner, identically in the stored period rows.
  const q1 = await one<{ weeks_won: number; winner_participant_id: string }>(db, `SELECT weeks_won, winner_participant_id FROM period_winners WHERE pool_id = $1 AND period_name = 'Q1'`, [f.poolId]);
  assert.equal(q1.winner_participant_id, f.alice);
  assert.equal(q1.weeks_won, 4);
  assert.equal(review.periodTotals.find(t => t.period_name === 'Q1' && t.participant_id === f.bob)?.weeks_won, 3);

  const calc = await calculateWeeklyWinners(f.poolId, 3, SEASON, 2);
  assert.equal(calc?.winner_participant_id, f.alice);
  assert.equal(calc?.winner_name, 'Alice & Bob');
});

test('co-winner displays show each winner\'s correct picks when they differ', async () => {
  const { supabase, f } = await setup();
  await runConfidenceResultsJob(supabase, { all: true });
  const review = await computeSeasonReview(f.poolId, SEASON);

  const week2 = review.weeklyWinners.find(w => w.week === 2)!;
  assert.equal(week2.winner_name, 'Alice & Bob');
  assert.deepEqual(week2.co_winners.map(w => [w.name, w.correct_picks]), [['Alice', 1], ['Bob', 2]]);
  assert.equal(week2.winner_correct_picks_display, '1 / 2');
  assert.equal(week2.winner_correct_picks, 1, 'the primary (first-named) winner\'s own count');
  assert.equal(review.weeklyWinners.find(w => w.week === 3)?.winner_correct_picks_display, '2', 'same count collapses');

  const { GET: weekWinnerGET } = await import('../../src/app/api/admin/week-winner/route');
  const res = await weekWinnerGET(new NextRequest(`http://test/api/admin/week-winner?poolId=${f.poolId}&week=2&season=${SEASON}&seasonType=2`));
  const body = await res.json();
  assert.equal(body.tiedWinnerName, 'Alice & Bob');
  assert.equal(body.tiedCorrectPicks, '1 / 2');

  const { GET: weeklyGET } = await import('../../src/app/api/admin/winners/weekly/route');
  // The all-weeks branch joins pools!inner(name), which the test client
  // doesn't support; the single-week branch is the live computation.
  const single = await (await weeklyGET(new NextRequest(`http://test/api/admin/winners/weekly?poolId=${f.poolId}&season=${SEASON}&week=2`))).json();
  assert.equal(single.weeklyWinners[0].winner_correct_picks_display, '1 / 2');

  const { GET: periodGET } = await import('../../src/app/api/periods/leaderboard/route');
  const period = await (await periodGET(new NextRequest(`http://test/api/periods/leaderboard?poolId=${f.poolId}&season=${SEASON}&periodName=Q1`))).json();
  if (period.success) {
    assert.equal(period.data.weeklyWinners.find((w: { week: number }) => w.week === 2).winner_correct_picks_display, '1 / 2');
  } else {
    assert.fail(`periods leaderboard failed: ${JSON.stringify(period)}`);
  }
});
