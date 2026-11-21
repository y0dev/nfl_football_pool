// Schedule and result corrections after a week was finalized must reach the
// Confidence dirty-results pipeline, so no finalized week keeps stale scores
// or winners: game insertion, deletion, movement between weeks/seasons, and
// a corrected final score approved through the admin NFL sync.
//
// The invariant checked after every scenario: once the dirty-driven cron
// job has run, a forced full recompute of every pool changes nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDatabase, installServiceClient, type FakeSupabase } from './helpers/pg-supabase';
import { SEASON, away, gameId, home, seedSeason, type SeasonFixture } from './helpers/confidence-fixture';
import { runConfidenceResultsJob } from '../../supabase/functions/_shared/confidence-results';
import { diffGame, type DbGameRow } from '../../src/lib/nfl-sync';
import { createSessionToken } from '../../src/lib/session';
import { POST as applySyncPOST } from '../../src/app/api/admin/nfl-sync/apply/route';
import type { NFLGame } from '../../src/lib/nfl-api';

async function setup(prepare?: (db: PGlite, f: SeasonFixture) => Promise<void>): Promise<{ db: PGlite; supabase: FakeSupabase; f: SeasonFixture }> {
  const { db, supabase } = await createTestDatabase();
  installServiceClient(supabase);
  const f = await seedSeason(db);
  if (prepare) await prepare(db, f);
  const first = await runConfidenceResultsJob(supabase, { all: true });
  assert.equal(first.success, true);
  await db.exec('DELETE FROM confidence_results_dirty');
  return { db, supabase, f };
}

const all = async <T>(db: PGlite, sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
const dirty = async (db: PGlite) => (await all<{ pool_id: string }>(db, 'SELECT pool_id FROM confidence_results_dirty')).map(r => r.pool_id).sort();
const weekPoints = async (db: PGlite, poolId: string, week: number) =>
  Object.fromEntries((await all<{ participant_id: string; points: number }>(db,
    `SELECT participant_id, points FROM scores WHERE pool_id = $1 AND week = $2 AND season_type = 2`, [poolId, week])).map(r => [r.participant_id, r.points]));
const weekWinners = async (db: PGlite, poolId: string, week: number) =>
  (await all<{ winner_participant_id: string }>(db, `SELECT winner_participant_id FROM weekly_winners WHERE pool_id = $1 AND week = $2`, [poolId, week])).map(r => r.winner_participant_id);

/** Runs the cron job the way pg_cron does (dirty-driven), then proves a
 * forced full recompute has nothing left to fix. */
async function settleAndAssertFresh(supabase: FakeSupabase) {
  const run = await runConfidenceResultsJob(supabase);
  assert.equal(run.success, true);
  const full = await runConfidenceResultsJob(supabase, { all: true });
  assert.deepEqual(full.results.map(r => r.status), full.results.map(() => 'unchanged'), 'no pool kept stale results');
  return run;
}

test('a finished game inserted into a finalized week is scored', async () => {
  const { db, supabase, f } = await setup();
  await db.query(
    `INSERT INTO games (id, week, season, season_type, home_team, away_team, status, winner)
     VALUES ('g-10-4', 10, $1, 2, 'H10-4', 'A10-4', 'final', 'H10-4')`, [SEASON]);
  assert.deepEqual(await dirty(db), [f.poolId]);
  await db.query(
    `INSERT INTO picks (participant_id, pool_id, game_id, predicted_winner, confidence_points) VALUES ($1, $2, 'g-10-4', 'H10-4', 4)`,
    [f.cara, f.poolId]);

  await settleAndAssertFresh(supabase);
  assert.equal((await weekPoints(db, f.poolId, 10))[f.cara], 5, 'Cara 1 + 4');
});

test('deleting a finished game removes its points from the finalized week', async () => {
  const { db, supabase, f } = await setup();
  await db.query(`DELETE FROM picks WHERE game_id = $1`, [gameId(10, 1)]);
  await db.exec('DELETE FROM confidence_results_dirty');
  await db.query(`DELETE FROM games WHERE id = $1`, [gameId(10, 1)]);
  assert.deepEqual(await dirty(db), [f.poolId], 'the game delete itself marks the pool');

  await settleAndAssertFresh(supabase);
  const pts = await weekPoints(db, f.poolId, 10);
  assert.equal(pts[f.alice], 3, 'Alice loses the 3 from game 1');
  assert.equal(pts[f.bob], 2);
});

test('deleting a cancelled (unfinished) game completes its week and crowns a winner', async () => {
  const { db, supabase, f } = await setup(async db => {
    await db.query(`UPDATE games SET status = 'scheduled', winner = NULL WHERE id = $1`, [gameId(13, 3)]);
  });
  assert.deepEqual(await weekWinners(db, f.poolId, 13), [], 'incomplete week has no winner yet');

  await db.query(`DELETE FROM picks WHERE game_id = $1`, [gameId(13, 3)]);
  assert.deepEqual(await dirty(db), [], 'picks on an unfinished game never mark');
  await db.query(`DELETE FROM games WHERE id = $1`, [gameId(13, 3)]);
  assert.deepEqual(await dirty(db), [f.poolId]);

  await settleAndAssertFresh(supabase);
  assert.equal((await weekWinners(db, f.poolId, 13)).length, 1, 'week 13 now has its (shared) winner row');
});

test('moving a postponed game out of its week completes that week', async () => {
  const { db, supabase, f } = await setup(async db => {
    await db.query(`UPDATE games SET status = 'scheduled', winner = NULL WHERE id = $1`, [gameId(12, 3)]);
  });
  assert.deepEqual(await weekWinners(db, f.poolId, 12), []);

  await db.query(`UPDATE games SET week = 18 WHERE id = $1`, [gameId(12, 3)]);
  assert.deepEqual(await dirty(db), [f.poolId], 'unfinished game moved between weeks marks the pool');

  await settleAndAssertFresh(supabase);
  assert.equal((await weekWinners(db, f.poolId, 12)).length, 1, 'week 12 now complete and has a winner');
});

test('moving a finished game to another week rescores both weeks', async () => {
  const { db, supabase, f } = await setup();
  await db.query(`UPDATE games SET week = 11 WHERE id = $1`, [gameId(10, 1)]);
  assert.deepEqual(await dirty(db), [f.poolId]);

  await settleAndAssertFresh(supabase);
  assert.equal((await weekPoints(db, f.poolId, 10))[f.alice], 3, 'week 10 lost game 1');
  assert.equal((await weekPoints(db, f.poolId, 11))[f.alice], 8, 'week 11 gained it');
});

const periodRow = async (db: PGlite, poolId: string, period: string) =>
  (await all<{ winner_participant_id: string; period_points: number }>(db,
    `SELECT winner_participant_id, period_points FROM period_winners WHERE pool_id = $1 AND period_name = $2`, [poolId, period]))[0];
const seasonRow = async (db: PGlite, poolId: string) =>
  (await all<{ winner_participant_id: string; total_points: number }>(db,
    `SELECT winner_participant_id, total_points FROM season_winners WHERE pool_id = $1`, [poolId]))[0];

test('removing the last game in a finalized week deletes its scores and winner and reconciles the period and season', async () => {
  const { db, supabase, f } = await setup();
  assert.equal((await periodRow(db, f.poolId, 'Q2')).period_points, 26, 'Alice: 6 + 4 x 5 before');
  const seasonBefore = await seasonRow(db, f.poolId);

  // Remove week 5 one game at a time, running the cron between each, so the
  // last delete is the one that empties a week that was already finalized.
  for (const g of [1, 2, 3]) {
    await db.query(`DELETE FROM picks WHERE game_id = $1`, [gameId(5, g)]);
    await db.query(`DELETE FROM games WHERE id = $1`, [gameId(5, g)]);
    await settleAndAssertFresh(supabase);
  }

  assert.deepEqual(await weekPoints(db, f.poolId, 5), {}, 'no scores left for the removed week');
  assert.deepEqual(await weekWinners(db, f.poolId, 5), [], 'no weekly winner left for the removed week');
  const q2 = await periodRow(db, f.poolId, 'Q2');
  assert.equal(q2.period_points, 20, 'Q2 recomputed without week 5');
  const seasonAfter = await seasonRow(db, f.poolId);
  assert.equal(seasonAfter.total_points, seasonBefore.total_points - 6, "season total drops by Alice's week-5 points");
});

test('moving every game out of a finalized week leaves no stale rows for it', async () => {
  const { db, supabase, f } = await setup();
  await db.query(`UPDATE games SET week = 8 WHERE week = 7 AND season = $1`, [SEASON]);
  assert.deepEqual(await dirty(db), [f.poolId]);

  const run = await settleAndAssertFresh(supabase);
  assert.equal(run.results[0].changes?.weekly_deletes, 1, 'week 7 winner deleted');
  assert.deepEqual(await weekPoints(db, f.poolId, 7), {});
  assert.deepEqual(await weekWinners(db, f.poolId, 7), []);
  assert.equal((await weekPoints(db, f.poolId, 8))[f.alice], 10, 'week 8 now holds both weeks');
  assert.ok(await periodRow(db, f.poolId, 'Q2'), 'Q2 still has a winner with week 7 empty');
});

// ---- Schedule changes that reopen a finalized week ----

const stored = async (db: PGlite, poolId: string) => ({
  week10: await weekWinners(db, poolId, 10),
  q3: (await periodRow(db, poolId, 'Q3'))?.winner_participant_id ?? null,
  season: (await seasonRow(db, poolId))?.winner_participant_id ?? null,
});

test('a newly scheduled game inserted into a finalized week withdraws its winner until the game is final', async () => {
  const { db, supabase, f } = await setup();
  assert.deepEqual(await stored(db, f.poolId), { week10: [f.alice], q3: f.alice, season: f.alice }, 'finalized before');
  const pointsBefore = await weekPoints(db, f.poolId, 10);

  await db.query(
    `INSERT INTO games (id, week, season, season_type, home_team, away_team, status)
     VALUES ('g-10-4', 10, $1, 2, 'H10-4', 'A10-4', 'scheduled')`, [SEASON]);
  assert.deepEqual(await dirty(db), [f.poolId], 'an unfinished game inserted into a finalized week marks the pool');
  await db.query(
    `INSERT INTO picks (participant_id, pool_id, game_id, predicted_winner, confidence_points) VALUES ($1, $2, 'g-10-4', 'H10-4', 4)`,
    [f.bob, f.poolId]);

  const run = await settleAndAssertFresh(supabase);
  assert.deepEqual(run.results[0].changes, { score_weeks: 0, weekly_upserts: 0, weekly_deletes: 1, period_upserts: 0, period_deletes: 1, season: 'deleted' });
  assert.deepEqual(await stored(db, f.poolId), { week10: [], q3: null, season: null }, 'no stale finalized winner while the game is unresolved');
  assert.deepEqual(await weekPoints(db, f.poolId, 10), pointsBefore, 'scores for the games already played stay');

  // The game finishes: Bob's 4 points take week 10, Q3 and the season.
  await db.query(`UPDATE games SET status = 'final', winner = 'H10-4' WHERE id = 'g-10-4'`);
  await settleAndAssertFresh(supabase);
  assert.deepEqual(await stored(db, f.poolId), { week10: [f.bob], q3: f.bob, season: f.bob });
  assert.equal((await weekPoints(db, f.poolId, 10))[f.bob], 9);
});

test("moving an unplayed game into a finalized week withdraws that week's winner and completes the week it left", async () => {
  const { db, supabase, f } = await setup(async db => {
    await db.query(`UPDATE games SET status = 'scheduled', winner = NULL WHERE id = $1`, [gameId(12, 3)]);
  });
  assert.deepEqual(await weekWinners(db, f.poolId, 12), [], 'week 12 open: its game was postponed');
  assert.deepEqual(await weekWinners(db, f.poolId, 10), [f.alice]);

  await db.query(`UPDATE games SET week = 10 WHERE id = $1`, [gameId(12, 3)]);
  assert.deepEqual(await dirty(db), [f.poolId]);

  await settleAndAssertFresh(supabase);
  assert.deepEqual(await weekWinners(db, f.poolId, 10), [], 'week 10 reopened by the rescheduled game');
  assert.equal((await weekWinners(db, f.poolId, 12)).length, 1, 'week 12 complete without it');
  assert.equal((await periodRow(db, f.poolId, 'Q3')), undefined, 'Q3 winner withdrawn');
});

test("a final game briefly reported live again keeps the finalized week's winner", async () => {
  const { db, supabase, f } = await setup();
  await db.query(`UPDATE games SET status = 'in', winner = NULL WHERE id = $1`, [gameId(10, 1)]);
  assert.deepEqual(await dirty(db), [f.poolId]);
  const run = await runConfidenceResultsJob(supabase);
  assert.equal(run.results[0].status, 'unchanged');
  assert.deepEqual(await stored(db, f.poolId), { week10: [f.alice], q3: f.alice, season: f.alice });
});

test('scheduling a future week marks nothing', async () => {
  const { db } = await setup();
  await db.query(
    `INSERT INTO games (id, week, season, season_type, home_team, away_team, status)
     VALUES ('po-1', 1, $1, 3, 'HP', 'AP', 'scheduled')`, [SEASON]);
  assert.deepEqual(await dirty(db), [], 'no finished game in that week, so nothing to reopen');
});

test('moving a game to another season marks pools in both seasons', async () => {
  const { db, f } = await setup();
  const { rows: [other] } = await db.query<{ id: string }>(`INSERT INTO pools (name, season) VALUES ('E2E Other Season', $1) RETURNING id`, [SEASON - 1]);
  await db.exec('DELETE FROM confidence_results_dirty');
  await db.query(`UPDATE games SET season = $1 WHERE id = $2`, [SEASON - 1, gameId(18, 1)]);
  assert.deepEqual(await dirty(db), [f.poolId, other.id].sort());
});

test('live-score churn on an unfinished game marks nothing', async () => {
  const { db } = await setup(async db => {
    await db.query(`UPDATE games SET status = 'scheduled', winner = NULL WHERE id = $1`, [gameId(14, 3)]);
  });
  await db.query(`UPDATE games SET status = 'live', home_score = 7, away_score = 3 WHERE id = $1`, [gameId(14, 3)]);
  await db.query(`UPDATE games SET home_score = 14 WHERE id = $1`, [gameId(14, 3)]);
  assert.deepEqual(await dirty(db), []);
});

// ---------------------------------------------------------------------------
// Admin NFL sync: a corrected final approved via preview -> apply.
// ---------------------------------------------------------------------------

const SYNC_TABLES = `
CREATE TABLE admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email varchar NOT NULL, full_name varchar,
  is_super_admin boolean DEFAULT true, is_active boolean DEFAULT true, created_at timestamptz DEFAULT now()
);
CREATE TABLE commissioners (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email varchar NOT NULL, is_active boolean DEFAULT true);
CREATE TABLE nfl_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), status varchar NOT NULL DEFAULT 'pending_review',
  season integer, season_type integer, week integer,
  applied_count integer NOT NULL DEFAULT 0, rejected_count integer NOT NULL DEFAULT 0, stale_count integer NOT NULL DEFAULT 0,
  reviewed_at timestamptz, reviewed_by varchar
);
CREATE TABLE nfl_sync_proposed_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sync_run_id uuid REFERENCES nfl_sync_runs(id),
  external_game_id varchar NOT NULL, change_type varchar NOT NULL, field_diffs jsonb, proposed_payload jsonb NOT NULL,
  base_snapshot jsonb, decision varchar NOT NULL DEFAULT 'pending', decided_at timestamptz
);
CREATE TABLE audit_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), action varchar, admin_id uuid, entity varchar, entity_id varchar, details jsonb);
`;

async function proposeAndApply(db: PGlite, incoming: NFLGame) {
  const { rows: [existing] } = await db.query<DbGameRow>(`SELECT * FROM games WHERE id = $1`, [incoming.id]);
  const change = diffGame(incoming, existing ?? null);
  assert.ok(change, 'the provider data differs from the stored game');

  const { rows: [run] } = await db.query<{ id: string }>(`INSERT INTO nfl_sync_runs (season, week) VALUES ($1, $2) RETURNING id`, [incoming.season, incoming.week]);
  await db.query(
    `INSERT INTO nfl_sync_proposed_changes (sync_run_id, external_game_id, change_type, field_diffs, proposed_payload, base_snapshot)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [run.id, change.externalGameId, change.changeType, JSON.stringify(change.fieldDiffs), JSON.stringify(change.proposedPayload),
      change.baseSnapshot ? JSON.stringify(change.baseSnapshot) : null]);

  const { rows: [admin] } = await db.query<{ id: string }>(`INSERT INTO admins (email) VALUES ('e2e-sync@sundayhuddle.test') RETURNING id`);
  const req = new NextRequest('http://test/api/admin/nfl-sync/apply', { method: 'POST', body: JSON.stringify({ runId: run.id, approveAll: true }) });
  req.cookies.set('sh-session', createSessionToken(admin.id));
  const body = await (await applySyncPOST(req)).json();
  assert.equal(body.success, true, body.error);
  assert.equal(body.appliedCount, 1);
  return change;
}

function providerGame(week: number, game: number, overrides: Partial<NFLGame> = {}): NFLGame {
  const kickoff = new Date(Date.UTC(SEASON, 8, 10 + week * 7)).toISOString();
  return {
    id: gameId(week, game), week, season: SEASON, season_type: 2,
    home_team: home(week, game), away_team: away(week, game),
    date: kickoff, time: kickoff,
    status: 'finished', home_score: 24, away_score: 10,
    home_team_id: undefined as unknown as string, away_team_id: undefined as unknown as string,
    ...overrides,
  };
}

test('admin-approved corrected final score reaches the dirty pipeline and flips the week', async () => {
  process.env.SESSION_SECRET ??= 'unit-test-session-secret';
  const { db, supabase, f } = await setup();
  await db.exec(SYNC_TABLES);

  // Stored as a home win; ESPN's corrected final is an away win.
  const change = await proposeAndApply(db, providerGame(10, 3, { home_score: 17, away_score: 20 }));
  assert.equal(change.fieldDiffs.winner?.new, away(10, 3));
  assert.deepEqual(await dirty(db), [f.poolId], 'applying the approval marked the pool');

  await settleAndAssertFresh(supabase);
  assert.deepEqual(await weekWinners(db, f.poolId, 10), [f.bob], 'week 10 flips to Bob (see correctWeek10)');
});

test('admin-approved reschedule moves a game between weeks and rescores both', async () => {
  process.env.SESSION_SECRET ??= 'unit-test-session-secret';
  const { db, supabase, f } = await setup(async db => {
    await db.query(`UPDATE games SET status = 'scheduled', winner = NULL WHERE id = $1`, [gameId(12, 3)]);
  });
  await db.exec(SYNC_TABLES);

  const change = await proposeAndApply(db, providerGame(12, 3, { week: 18, status: 'scheduled', home_score: undefined, away_score: undefined }));
  assert.deepEqual(change.fieldDiffs.week, { old: 12, new: 18 }, 'the week move is proposed');
  assert.ok(change.summaryLines.includes('Week changed: 12 → 18'));
  assert.deepEqual(await dirty(db), [f.poolId]);

  await settleAndAssertFresh(supabase);
  assert.equal((await weekWinners(db, f.poolId, 12)).length, 1, 'week 12 complete without the postponed game');
});

test('pending approvals recorded before week tracking are not treated as stale', async () => {
  const { isChangeStale } = await import('../../src/lib/nfl-sync');
  const row: DbGameRow = {
    id: 'x', week: 12, season: SEASON, season_type: 2, home_team: 'H', away_team: 'A',
    kickoff_time: '2026-11-29T18:00:00Z', home_score: null, away_score: null, winner: null, status: 'scheduled',
    home_team_id: null, away_team_id: null,
  };
  const legacySnapshot = {
    kickoff_time: '2026-11-29T18:00:00+00:00', home_score: null, away_score: null, winner: null, status: 'scheduled',
    home_team: 'H', away_team: 'A', home_team_id: null, away_team_id: null,
  };
  assert.equal(isChangeStale({ changeType: 'updated', baseSnapshot: legacySnapshot }, row), false);
  assert.equal(isChangeStale({ changeType: 'updated', baseSnapshot: { ...legacySnapshot, week: 11 } }, row), true, 'a recorded week that moved is stale');
});
