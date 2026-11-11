// Survivor finalization after a score correction, and atomic playoff pick
// replacement. Runs src/lib/survivor.ts against PGlite with the real
// survivor migrations (including replace_survivor_pick()).
import test from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDatabase, installServiceClient, type FakeSupabase } from './helpers/pg-supabase';
import { computeSurvivorPoolState, finalizeSurvivorSeason, resolveSurvivorWinners, submitSurvivorPick } from '../../src/lib/survivor';

const SEASON = 2026;

async function createPool(db: PGlite, scope: number[]) {
  const { rows: [pool] } = await db.query<{ id: string }>(
    `INSERT INTO pools (name, season, competition_type, season_scope, created_at)
     VALUES ('E2E Survivor', $1, 'SURVIVOR', $2, '2026-01-01T00:00:00Z') RETURNING id`, [SEASON, scope]);
  const ids: Record<string, string> = {};
  for (const name of ['A', 'B', 'C']) {
    const { rows: [p] } = await db.query<{ id: string }>(`INSERT INTO participants (pool_id, name) VALUES ($1, $2) RETURNING id`, [pool.id, name]);
    ids[name] = p.id;
  }
  return { poolId: pool.id, ...ids } as { poolId: string; A: string; B: string; C: string };
}

async function game(db: PGlite, g: { id: string; week: number; seasonType: number; home: string; away: string; kickoff: string; status: string; homeScore?: number; awayScore?: number }) {
  await db.query(
    `INSERT INTO games (id, week, season, season_type, home_team, away_team, home_team_id, away_team_id, kickoff_time, status, home_score, away_score)
     VALUES ($1, $2, $3, $4, $5, $6, $5, $6, $7, $8, $9, $10)`,
    [g.id, g.week, SEASON, g.seasonType, g.home, g.away, g.kickoff, g.status, g.homeScore ?? null, g.awayScore ?? null]);
}

async function pick(db: PGlite, poolId: string, participantId: string, gameId: string, seasonType: number, week: number, team: string) {
  await db.query(
    `INSERT INTO survivor_picks (participant_id, pool_id, game_id, season, season_type, week, selected_team) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [participantId, poolId, gameId, SEASON, seasonType, week, team]);
}

async function setup(): Promise<{ db: PGlite; supabase: FakeSupabase }> {
  const { db, supabase } = await createTestDatabase();
  installServiceClient(supabase);
  return { db, supabase };
}

test('a winner whose winning game is corrected to a loss is not a winner after re-finalization', async () => {
  const { db } = await setup();
  const p = await createPool(db, [2]);
  await game(db, { id: 'w1-kc', week: 1, seasonType: 2, home: 'KC', away: 'DEN', kickoff: '2026-09-10T00:20:00Z', status: 'final', homeScore: 24, awayScore: 10 });
  await game(db, { id: 'w1-buf', week: 1, seasonType: 2, home: 'BUF', away: 'MIA', kickoff: '2026-09-13T17:00:00Z', status: 'final', homeScore: 10, awayScore: 20 });
  await game(db, { id: 'w2-sf', week: 2, seasonType: 2, home: 'SF', away: 'NYJ', kickoff: '2026-09-20T17:00:00Z', status: 'final', homeScore: 30, awayScore: 3 });
  await pick(db, p.poolId, p.A, 'w1-kc', 2, 1, 'KC');   // wins
  await pick(db, p.poolId, p.A, 'w2-sf', 2, 2, 'SF');   // wins
  await pick(db, p.poolId, p.B, 'w1-buf', 2, 1, 'MIA'); // wins
  await pick(db, p.poolId, p.B, 'w2-sf', 2, 2, 'NYJ');  // loses week 2
  await pick(db, p.poolId, p.C, 'w1-buf', 2, 1, 'BUF'); // loses week 1

  const first = await finalizeSurvivorSeason(p.poolId);
  assert.deepEqual(first, { success: true, winnerParticipantIds: [p.A], resolution: 'last_active' });

  // Correction: KC actually lost week 1. A was eliminated before B.
  await db.query(`UPDATE games SET home_score = 10, away_score = 24 WHERE id = 'w1-kc'`);

  const state = await computeSurvivorPoolState(p.poolId);
  const a = state.participants.find(x => x.participantId === p.A)!;
  assert.equal(a.status, 'WINNER', 'still shown as the declared winner until re-finalized');
  assert.equal(a.liveStatus, 'ELIMINATED', 'but no longer eligible');

  const second = await finalizeSurvivorSeason(p.poolId);
  assert.deepEqual(second, { success: true, winnerParticipantIds: [p.B], resolution: 'wipeout_last_standing' });

  const after = await computeSurvivorPoolState(p.poolId);
  assert.equal(after.participants.find(x => x.participantId === p.A)!.status, 'ELIMINATED');
  assert.equal(after.participants.find(x => x.participantId === p.B)!.status, 'WINNER');

  // Idempotent: finalizing again with no new corrections changes nothing.
  assert.deepEqual(await finalizeSurvivorSeason(p.poolId), second);
});

test('a re-finalized winner that is still alive stays the winner', async () => {
  const { db } = await setup();
  const p = await createPool(db, [2]);
  await game(db, { id: 'w1', week: 1, seasonType: 2, home: 'KC', away: 'DEN', kickoff: '2026-09-10T00:20:00Z', status: 'final', homeScore: 24, awayScore: 10 });
  await pick(db, p.poolId, p.A, 'w1', 2, 1, 'KC');
  await pick(db, p.poolId, p.B, 'w1', 2, 1, 'DEN');
  const first = await finalizeSurvivorSeason(p.poolId);
  assert.deepEqual(first.success && first.winnerParticipantIds, [p.A]);
  const again = await finalizeSurvivorSeason(p.poolId);
  assert.deepEqual(again, { success: true, winnerParticipantIds: [p.A], resolution: 'last_active' });
});

test('wipeout ordering counts a playoff exit as outlasting a regular-season one', () => {
  const r = resolveSurvivorWinners([
    { participantId: 'reg18', liveStatus: 'ELIMINATED', eliminatedWeek: 18, eliminatedSeasonType: 2, picks: [] },
    { participantId: 'po1', liveStatus: 'ELIMINATED', eliminatedWeek: 1, eliminatedSeasonType: 3, picks: [] },
  ], { endOfSeasonRule: 'all_remaining_winners' });
  assert.deepEqual(r, { success: true, winnerParticipantIds: ['po1'], resolution: 'wipeout_last_standing' });
});

test('resolution ignores persisted winners entirely: only live eligibility counts', () => {
  const r = resolveSurvivorWinners([
    { participantId: 'old-winner', liveStatus: 'ELIMINATED', eliminatedWeek: 1, eliminatedSeasonType: 2, picks: [] },
    { participantId: 'alive', liveStatus: 'ACTIVE', picks: [] },
  ], { endOfSeasonRule: 'all_remaining_winners' });
  assert.deepEqual(r, { success: true, winnerParticipantIds: ['alive'], resolution: 'last_active' });
});

// ---- Playoff pick replacement ----

async function playoffSetup() {
  const { db, supabase } = await setup();
  const p = await createPool(db, [2, 3]);
  const soon = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  await game(db, { id: 'reg-1', week: 1, seasonType: 2, home: 'KC', away: 'DEN', kickoff: '2026-09-10T00:20:00Z', status: 'final', homeScore: 24, awayScore: 10 });
  await game(db, { id: 'po-1', week: 1, seasonType: 3, home: 'BUF', away: 'KC', kickoff: soon, status: 'scheduled' });
  await game(db, { id: 'po-2', week: 1, seasonType: 3, home: 'PHI', away: 'DAL', kickoff: soon, status: 'scheduled' });
  await pick(db, p.poolId, p.A, 'reg-1', 2, 1, 'KC');  // KC is now used
  await pick(db, p.poolId, p.A, 'po-2', 3, 1, 'PHI');  // current playoff pick
  return { db, supabase, p };
}

async function playoffPicks(db: PGlite, participantId: string) {
  return (await db.query<{ selected_team: string; game_id: string }>(
    `SELECT selected_team, game_id FROM survivor_picks WHERE participant_id = $1 AND season_type = 3 ORDER BY selected_team`, [participantId])).rows;
}

test('playoff replacement: a validation failure keeps the previous pick', async () => {
  const { db, supabase, p } = await playoffSetup();
  const res = await submitSurvivorPick({ participantId: p.A, poolId: p.poolId, gameId: 'po-1', selectedTeam: 'KC' });
  assert.equal(res.success, false);
  assert.match((res as { error: string }).error, /already used this team/);
  assert.deepEqual(await playoffPicks(db, p.A), [{ selected_team: 'PHI', game_id: 'po-2' }]);
  assert.equal(supabase.rpcCalls.length, 0, 'rejected before any write');
});

test('playoff replacement: an insertion failure keeps the previous pick', async () => {
  const { db, p } = await playoffSetup();
  // Fails the insert inside replace_survivor_pick, after its delete ran.
  await db.exec(`
    CREATE FUNCTION fail_buf_insert() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.selected_team = 'BUF' THEN RAISE EXCEPTION 'injected insert failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER fail_buf_insert BEFORE INSERT ON survivor_picks FOR EACH ROW EXECUTE FUNCTION fail_buf_insert();
  `);
  const res = await submitSurvivorPick({ participantId: p.A, poolId: p.poolId, gameId: 'po-1', selectedTeam: 'BUF' });
  assert.deepEqual(res, { success: false, error: 'Failed to save pick. Please try again.' });
  assert.deepEqual(await playoffPicks(db, p.A), [{ selected_team: 'PHI', game_id: 'po-2' }]);
});

test('playoff replacement: a failed call keeps the previous pick', async () => {
  const { db, supabase, p } = await playoffSetup();
  supabase.failNextRpc('replace_survivor_pick', 'network error');
  const res = await submitSurvivorPick({ participantId: p.A, poolId: p.poolId, gameId: 'po-1', selectedTeam: 'BUF' });
  assert.equal(res.success, false);
  assert.deepEqual(await playoffPicks(db, p.A), [{ selected_team: 'PHI', game_id: 'po-2' }]);
});

test('playoff replacement: a valid change replaces the pick', async () => {
  const { db, p } = await playoffSetup();
  const res = await submitSurvivorPick({ participantId: p.A, poolId: p.poolId, gameId: 'po-1', selectedTeam: 'BUF', submittedBy: 'A' });
  assert.deepEqual(res, { success: true });
  assert.deepEqual(await playoffPicks(db, p.A), [{ selected_team: 'BUF', game_id: 'po-1' }]);
  // Re-picking the team being replaced this week is not a reuse.
  assert.deepEqual(await submitSurvivorPick({ participantId: p.A, poolId: p.poolId, gameId: 'po-1', selectedTeam: 'BUF' }), { success: true });
});

test('replace_survivor_pick re-checks team reuse in the database and rolls back', async () => {
  // The race the app-side check can't close: the reuse appears between the
  // app's validation and the RPC.
  const { db, p } = await playoffSetup();
  await assert.rejects(
    db.query(`SELECT replace_survivor_pick($1, $2, 'po-1', $3, 3, 1, 'KC')`, [p.A, p.poolId, SEASON]),
    /SURVIVOR_TEAM_ALREADY_USED/,
  );
  assert.deepEqual(await playoffPicks(db, p.A), [{ selected_team: 'PHI', game_id: 'po-2' }]);
});
