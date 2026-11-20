// Survivor finalization after a score correction, and atomic playoff pick
// replacement. Runs src/lib/survivor.ts against PGlite with the real
// survivor migrations (including replace_survivor_pick()).
import test from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDatabase, installServiceClient, type FakeSupabase } from './helpers/pg-supabase';
import { NextRequest } from 'next/server';
import { computeSurvivorPoolState, describeSurvivorFinalization, finalizeSurvivorSeason, resolveSurvivorWinners, submitSurvivorPick } from '../../src/lib/survivor';
import { createSessionToken } from '../../src/lib/session';
import { POST as survivorFinalizePOST } from '../../src/app/api/survivor/finalize/route';

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

// ---- Commissioner re-finalization (the route the admin panel calls) ----

test('commissioner re-finalization: a corrected result marks the pool outdated until re-finalized', async () => {
  process.env.SESSION_SECRET ??= 'unit-test-session-secret';
  const { db } = await setup();
  await db.exec(`
    CREATE TABLE admins (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email varchar NOT NULL, is_active boolean DEFAULT true);
    CREATE TABLE commissioners (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email varchar NOT NULL, is_active boolean DEFAULT true);
  `);
  const p = await createPool(db, [2]);
  const { rows: [owner] } = await db.query<{ id: string }>(`INSERT INTO commissioners (email) VALUES ('e2e-owner@sundayhuddle.test') RETURNING id`);
  const { rows: [stranger] } = await db.query<{ id: string }>(`INSERT INTO commissioners (email) VALUES ('e2e-other@sundayhuddle.test') RETURNING id`);
  await db.query(`UPDATE pools SET created_by = 'e2e-owner@sundayhuddle.test' WHERE id = $1`, [p.poolId]);

  await game(db, { id: 'w1-kc', week: 1, seasonType: 2, home: 'KC', away: 'DEN', kickoff: '2026-09-10T00:20:00Z', status: 'final', homeScore: 24, awayScore: 10 });
  await game(db, { id: 'w1-buf', week: 1, seasonType: 2, home: 'BUF', away: 'MIA', kickoff: '2026-09-13T17:00:00Z', status: 'final', homeScore: 10, awayScore: 20 });
  await game(db, { id: 'w2-sf', week: 2, seasonType: 2, home: 'SF', away: 'NYJ', kickoff: '2026-09-20T17:00:00Z', status: 'final', homeScore: 30, awayScore: 3 });
  await pick(db, p.poolId, p.A, 'w1-kc', 2, 1, 'KC');
  await pick(db, p.poolId, p.A, 'w2-sf', 2, 2, 'SF');
  await pick(db, p.poolId, p.B, 'w1-buf', 2, 1, 'MIA');
  await pick(db, p.poolId, p.B, 'w2-sf', 2, 2, 'NYJ');
  await pick(db, p.poolId, p.C, 'w1-buf', 2, 1, 'BUF');

  const finalizeAs = async (accountId: string) => {
    const req = new NextRequest('http://test/api/survivor/finalize', { method: 'POST', body: JSON.stringify({ poolId: p.poolId }) });
    req.cookies.set('sh-session', createSessionToken(accountId));
    const res = await survivorFinalizePOST(req);
    return { status: res.status, body: await res.json() };
  };
  const storedWinners = async () =>
    (await db.query<{ winner_participant_ids: string[] }>(`SELECT winner_participant_ids FROM survivor_winners WHERE pool_id = $1`, [p.poolId])).rows[0]?.winner_participant_ids;

  let state = await computeSurvivorPoolState(p.poolId);
  assert.equal(state.finalization.status, 'not_finalized');
  assert.equal(state.finalization.readyToFinalize, true, 'every game is final');
  assert.deepEqual(state.finalization.currentWinnerIds, [p.A]);

  assert.equal((await finalizeAs(stranger.id)).status, 403, 'another commissioner cannot finalize this pool');
  assert.equal(await storedWinners(), undefined);

  const first = await finalizeAs(owner.id);
  assert.equal(first.status, 200);
  assert.deepEqual(first.body.winnerParticipantIds, [p.A]);
  state = await computeSurvivorPoolState(p.poolId);
  assert.equal(state.finalization.status, 'up_to_date');

  // Correction after finalizing: KC actually lost week 1.
  await db.query(`UPDATE games SET home_score = 10, away_score = 24 WHERE id = 'w1-kc'`);
  state = await computeSurvivorPoolState(p.poolId);
  assert.equal(state.finalization.status, 'outdated', 'the admin panel shows "Re-finalize needed"');
  assert.deepEqual(state.finalization.finalizedWinnerIds, [p.A]);
  assert.deepEqual(state.finalization.currentWinnerIds, [p.B]);
  assert.deepEqual(await storedWinners(), [p.A], 'nothing re-finalizes on its own');

  const second = await finalizeAs(owner.id);
  assert.equal(second.status, 200);
  assert.deepEqual(await storedWinners(), [p.B], 'persisted winner matches current results');
  state = await computeSurvivorPoolState(p.poolId);
  assert.equal(state.finalization.status, 'up_to_date');
  assert.equal(state.participants.find(x => x.participantId === p.B)!.status, 'WINNER');
});

test('finalization readiness: not ready mid-season while several players are alive', () => {
  const alive = (id: string) => ({ participantId: id, liveStatus: 'ACTIVE' as const, picks: [] });
  const midSeason = { gameCount: 10, allGamesFinal: false };
  const f = describeSurvivorFinalization([alive('a'), alive('b')], { endOfSeasonRule: 'all_remaining_winners' }, null, midSeason);
  assert.equal(f.status, 'not_finalized');
  assert.equal(f.readyToFinalize, false);
  assert.equal(describeSurvivorFinalization([alive('a')], { endOfSeasonRule: 'all_remaining_winners' }, null, midSeason).readyToFinalize, true, 'one player left');
});

const RULE = { endOfSeasonRule: 'all_remaining_winners' } as const;
const pendingPick = (seasonType: number, week: number) =>
  ({ week, seasonType, gameId: `g-${seasonType}-${week}`, selectedTeam: 'X', selectedTeamName: 'X', result: 'pending' as const, margin: 0 });

test('finalization readiness: an empty schedule is never ready', () => {
  const f = describeSurvivorFinalization(
    [{ participantId: 'a', liveStatus: 'ACTIVE', picks: [] }], RULE, null, { gameCount: 0, allGamesFinal: true });
  assert.equal(f.readyToFinalize, false);
  assert.match(f.notReadyReason!, /No games are scheduled/);
});

test('finalization readiness: one player left but a pending pick before the last elimination blocks it', () => {
  // A's week-5 game is unfinished. If A lost it, A went out before B (week 6)
  // and B would win, so the winner still depends on that game.
  const participants = [
    { participantId: 'a', liveStatus: 'ACTIVE' as const, picks: [pendingPick(2, 5)] },
    { participantId: 'b', liveStatus: 'ELIMINATED' as const, eliminatedSeasonType: 2, eliminatedWeek: 6, picks: [] },
  ];
  const f = describeSurvivorFinalization(participants, RULE, null, { gameCount: 20, allGamesFinal: false });
  assert.equal(f.readyToFinalize, false);
  assert.match(f.notReadyReason!, /isn't final yet/);
});

test("finalization readiness: the last player's pending pick after every elimination does not block it", () => {
  const participants = [
    { participantId: 'a', liveStatus: 'ACTIVE' as const, picks: [pendingPick(2, 7)] },
    { participantId: 'b', liveStatus: 'ELIMINATED' as const, eliminatedSeasonType: 2, eliminatedWeek: 6, picks: [] },
  ];
  const f = describeSurvivorFinalization(participants, RULE, null, { gameCount: 20, allGamesFinal: false });
  assert.equal(f.readyToFinalize, true);
  assert.equal(f.notReadyReason, null);
});

test('finalization readiness: in a wipeout any pending pick blocks it', () => {
  const participants = [
    { participantId: 'a', liveStatus: 'ELIMINATED' as const, eliminatedSeasonType: 2, eliminatedWeek: 6, picks: [pendingPick(2, 4)] },
    { participantId: 'b', liveStatus: 'ELIMINATED' as const, eliminatedSeasonType: 2, eliminatedWeek: 6, picks: [] },
  ];
  assert.equal(describeSurvivorFinalization(participants, RULE, null, { gameCount: 20, allGamesFinal: false }).readyToFinalize, false);
});

test('finalize rejects an empty schedule and leaves no winner row', async () => {
  const { db } = await setup();
  const p = await createPool(db, [2]);
  const res = await finalizeSurvivorSeason(p.poolId);
  assert.equal(res.success, false);
  assert.match((res as { error: string }).error, /No games are scheduled/);
  const { rows } = await db.query(`SELECT 1 FROM survivor_winners WHERE pool_id = $1`, [p.poolId]);
  assert.equal(rows.length, 0);
});

test('an outdated pool cannot be re-finalized while an unfinished game could change the winner', async () => {
  const { db } = await setup();
  const p = await createPool(db, [2]);
  await game(db, { id: 'w1-kc', week: 1, seasonType: 2, home: 'KC', away: 'DEN', kickoff: '2026-09-10T00:20:00Z', status: 'final', homeScore: 24, awayScore: 10 });
  await game(db, { id: 'w1-buf', week: 1, seasonType: 2, home: 'BUF', away: 'MIA', kickoff: '2026-09-13T17:00:00Z', status: 'final', homeScore: 10, awayScore: 20 });
  await game(db, { id: 'w2-sf', week: 2, seasonType: 2, home: 'SF', away: 'NYJ', kickoff: '2026-09-20T17:00:00Z', status: 'final', homeScore: 30, awayScore: 3 });
  await pick(db, p.poolId, p.A, 'w1-kc', 2, 1, 'KC');
  await pick(db, p.poolId, p.A, 'w2-sf', 2, 2, 'SF');
  await pick(db, p.poolId, p.B, 'w1-buf', 2, 1, 'MIA');
  await pick(db, p.poolId, p.B, 'w2-sf', 2, 2, 'NYJ');
  await pick(db, p.poolId, p.C, 'w1-buf', 2, 1, 'BUF');
  assert.deepEqual((await finalizeSurvivorSeason(p.poolId)).success, true);

  // A's week-1 game is reopened (score correction in progress) and B's
  // week-2 loss is corrected to a win. Stored winner A is now outdated, but
  // A's week-1 game decides whether A or B wins.
  await db.query(`UPDATE games SET status = 'in_progress' WHERE id = 'w1-kc'`);
  await db.query(`UPDATE games SET home_score = 3, away_score = 30 WHERE id = 'w2-sf'`);
  let state = await computeSurvivorPoolState(p.poolId);
  assert.equal(state.finalization.status, 'outdated');
  assert.equal(state.finalization.readyToFinalize, false);

  const blocked = await finalizeSurvivorSeason(p.poolId);
  assert.equal(blocked.success, false);
  assert.equal((blocked as { notReady?: boolean }).notReady, true);
  const stored = (await db.query<{ winner_participant_ids: string[] }>(`SELECT winner_participant_ids FROM survivor_winners WHERE pool_id = $1`, [p.poolId])).rows[0];
  assert.deepEqual(stored.winner_participant_ids, [p.A], 'stored winner untouched');

  // Once the game is final again the commissioner can re-finalize.
  await db.query(`UPDATE games SET status = 'final' WHERE id = 'w1-kc'`);
  state = await computeSurvivorPoolState(p.poolId);
  assert.equal(state.finalization.readyToFinalize, true);
  assert.equal((await finalizeSurvivorSeason(p.poolId)).success, true);
});
