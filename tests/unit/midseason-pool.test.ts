// A pool created partway through the season: every pool type scores, ranks
// and eliminates only from the pool's first week, and the pages are offered
// only the weeks and quarters the pool exists for.
//
// The schedule: 18 regular-season weeks, two games a week (Thursday night and
// Sunday), Week 1 on Thu Sep 10, 2026. The pool is created Tue Nov 24, 2026,
// so its first week is Week 12 (Thanksgiving, Thu Nov 26).
import test from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDatabase, installServiceClient, type FakeSupabase } from './helpers/pg-supabase';
import { runConfidenceResultsJob, REGULAR_SEASON_PERIODS } from '../../supabase/functions/_shared/confidence-results';
import { computeSurvivorPoolState } from '../../src/lib/survivor';
import { computePickemSeasonSummary } from '../../src/lib/pickem';
import { isBeforePoolStart, periodsForPool, poolStartWeek, scheduledWeeks, weekPredatesPool } from '../../src/lib/pool-start';
import { GET as availablePeriodsGET } from '../../src/app/api/periods/available/route';
import { GET as startWeekGET } from '../../src/app/api/pools/[id]/start-week/route';
import { NextRequest } from 'next/server';

const SEASON = 2026;
const DAY = 86_400_000;
const WEEK1_THURSDAY = Date.parse('2026-09-11T00:20:00Z'); // Thu Sep 10, 8:20pm ET
const CREATED_TUESDAY_BEFORE_WEEK_12 = '2026-11-24T17:00:00Z';
const CREATED_DURING_WEEK_12 = '2026-11-28T12:00:00Z'; // after Thanksgiving night, before Sunday

const thursday = (week: number) => new Date(WEEK1_THURSDAY + (week - 1) * 7 * DAY).toISOString();
const sunday = (week: number) => new Date(WEEK1_THURSDAY + (week - 1) * 7 * DAY + 3 * DAY - 3 * 3_600_000).toISOString();
/** Between the given week's Sunday and the next Thursday. */
const tuesdayAfter = (week: number) => new Date(WEEK1_THURSDAY + (week - 1) * 7 * DAY + 5 * DAY).toISOString();

/** Weeks 1-18; games through `finalThroughWeek` are final, home team winning 24-10. */
async function seedSchedule(db: PGlite, finalThroughWeek: number) {
  for (let w = 1; w <= 18; w++) {
    for (const [slot, kickoff] of [['a', thursday(w)], ['b', sunday(w)]] as const) {
      const final = w <= finalThroughWeek;
      await db.query(
        `INSERT INTO games (id, week, season, season_type, home_team, away_team, home_team_id, away_team_id, kickoff_time, status, winner, home_score, away_score)
         VALUES ($1, $2, $3, 2, $4, $5, $4, $5, $6, $7, $8, $9, $10)`,
        [`g${w}${slot}`, w, SEASON, `H${w}${slot}`, `A${w}${slot}`, kickoff, final ? 'final' : 'scheduled',
          final ? `H${w}${slot}` : null, final ? 24 : null, final ? 10 : null]);
    }
  }
}

async function createPool(db: PGlite, competitionType: string, createdAt: string, names: string[]) {
  const { rows: [pool] } = await db.query<{ id: string }>(
    `INSERT INTO pools (name, season, competition_type, season_scope, created_at)
     VALUES ('E2E Midseason', $1, $2, ARRAY[2], $3) RETURNING id`, [SEASON, competitionType, createdAt]);
  const ids: Record<string, string> = {};
  for (const name of names) {
    const { rows: [p] } = await db.query<{ id: string }>(`INSERT INTO participants (pool_id, name) VALUES ($1, $2) RETURNING id`, [pool.id, name]);
    ids[name] = p.id;
  }
  return { poolId: pool.id, ids };
}

async function setup(): Promise<{ db: PGlite; supabase: FakeSupabase }> {
  const { db, supabase } = await createTestDatabase();
  installServiceClient(supabase);
  return { db, supabase };
}

const rows = async <T>(db: PGlite, sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;

// ---------------------------------------------------------------------------
// The rule itself
// ---------------------------------------------------------------------------

test('a pool starts at the first week whose first game is after it was created', () => {
  const games = Array.from({ length: 18 }, (_, i) => i + 1).flatMap(w => [
    { season_type: 2, week: w, kickoff_time: thursday(w) },
    { season_type: 2, week: w, kickoff_time: sunday(w) },
  ]);
  const weeks = scheduledWeeks(games);
  assert.deepEqual(poolStartWeek('2026-08-01T00:00:00Z', weeks), { seasonType: 2, week: 1 }, 'preseason pool: Week 1');
  assert.deepEqual(poolStartWeek(CREATED_TUESDAY_BEFORE_WEEK_12, weeks), { seasonType: 2, week: 12 });
  assert.deepEqual(poolStartWeek(CREATED_DURING_WEEK_12, weeks), { seasonType: 2, week: 13 }, 'Week 12 already under way');
  assert.equal(poolStartWeek('2027-01-20T00:00:00Z', weeks), null, 'after the last week began');
  assert.equal(weekPredatesPool(Date.parse(thursday(12)), CREATED_TUESDAY_BEFORE_WEEK_12), false);
  assert.equal(weekPredatesPool(Date.parse(thursday(11)), CREATED_TUESDAY_BEFORE_WEEK_12), true);
});

test('a midseason pool is offered only the quarters it exists for', () => {
  const games = Array.from({ length: 18 }, (_, i) => ({ season_type: 2, week: i + 1, kickoff_time: thursday(i + 1) }));
  const names = (created: string | null) => periodsForPool(REGULAR_SEASON_PERIODS, created, games).map(p => p.name);
  assert.deepEqual(names('2026-08-01T00:00:00Z'), ['Q1', 'Q2', 'Q3', 'Q4']);
  assert.deepEqual(names(CREATED_TUESDAY_BEFORE_WEEK_12), ['Q3', 'Q4'], 'Q3 is Weeks 10-14');
  assert.deepEqual(names(tuesdayAfter(14)), ['Q4']);
  assert.deepEqual(names('2027-01-20T00:00:00Z'), [], 'created after the regular season');
  assert.deepEqual(names(null), ['Q1', 'Q2', 'Q3', 'Q4'], 'no creation date: nothing hidden');
  assert.deepEqual(periodsForPool(REGULAR_SEASON_PERIODS, CREATED_TUESDAY_BEFORE_WEEK_12, []).length, 4, 'no schedule yet: nothing hidden');
});

test('week pickers hide only the weeks before the pool started', () => {
  const start = { seasonType: 2, week: 12 };
  assert.equal(isBeforePoolStart(2, 11, start), true);
  assert.equal(isBeforePoolStart(2, 12, start), false);
  assert.equal(isBeforePoolStart(1, 4, start), true, 'preseason is before a regular-season start');
  assert.equal(isBeforePoolStart(3, 1, start), false, 'playoffs come after');
  assert.equal(isBeforePoolStart(2, 1, null), false, 'unknown start: show everything');
});

test('the start-week API tells the pages where a pool begins', async () => {
  const { db } = await setup();
  await seedSchedule(db, 13);
  const startOf = async (createdAt: string) => {
    const { poolId } = await createPool(db, 'NFL_CONFIDENCE', createdAt, ['Ann']);
    const res = await startWeekGET(new NextRequest(`http://localhost/api/pools/${poolId}/start-week`), { params: Promise.resolve({ id: poolId }) });
    const body = await res.json();
    assert.equal(body.success, true, JSON.stringify(body));
    return body.start;
  };
  assert.deepEqual(await startOf('2026-08-01T00:00:00Z'), { seasonType: 2, week: 1 });
  assert.deepEqual(await startOf(CREATED_TUESDAY_BEFORE_WEEK_12), { seasonType: 2, week: 12 });
  assert.deepEqual(await startOf(CREATED_DURING_WEEK_12), { seasonType: 2, week: 13 });
  assert.deepEqual(await startOf('2027-01-20T00:00:00Z'), { seasonType: 2, week: 18 }, 'created after the season: still shows its last week');
});

// ---------------------------------------------------------------------------
// Confidence
// ---------------------------------------------------------------------------

/** Ann picks both games right every week from Week 12 (2 + 1 points); Ben
 * gets the 1-point game right (1 point). */
async function confidencePicks(db: PGlite, poolId: string, ids: Record<string, string>, throughWeek: number) {
  for (let w = 12; w <= throughWeek; w++) {
    await db.query(
      `INSERT INTO picks (participant_id, pool_id, game_id, predicted_winner, confidence_points) VALUES
       ($1, $3, $4, $5, 2), ($1, $3, $6, $7, 1), ($2, $3, $4, $8, 2), ($2, $3, $6, $7, 1)`,
      [ids.Ann, ids.Ben, poolId, `g${w}a`, `H${w}a`, `g${w}b`, `H${w}b`, `A${w}a`]);
  }
}

test('Confidence, mid-season: only weeks from the pool start are scored and won; no quarter is decided early', async () => {
  const { db, supabase } = await setup();
  await seedSchedule(db, 13); // Weeks 12 and 13 played since the pool was created
  const { poolId, ids } = await createPool(db, 'NFL_CONFIDENCE', CREATED_TUESDAY_BEFORE_WEEK_12, ['Ann', 'Ben']);
  await confidencePicks(db, poolId, ids, 13);
  assert.equal((await runConfidenceResultsJob(supabase, { all: true })).success, true);

  const scoreWeeks = await rows<{ week: number }>(db, `SELECT DISTINCT week FROM scores WHERE pool_id = $1 ORDER BY week`, [poolId]);
  assert.deepEqual(scoreWeeks.map(r => r.week), [12, 13], 'no score rows for Weeks 1-11');
  const weekly = await rows<{ week: number; winner_participant_id: string; winner_points: number }>(db,
    `SELECT week, winner_participant_id, winner_points FROM weekly_winners WHERE pool_id = $1 ORDER BY week`, [poolId]);
  assert.deepEqual(weekly, [
    { week: 12, winner_participant_id: ids.Ann, winner_points: 3 },
    { week: 13, winner_participant_id: ids.Ann, winner_points: 3 },
  ]);
  assert.deepEqual(await rows(db, `SELECT period_name FROM period_winners WHERE pool_id = $1`, [poolId]), [],
    'Q1/Q2 never existed for this pool and Q3 (Weeks 10-14) is not over');
  assert.deepEqual(await rows(db, `SELECT 1 FROM season_winners WHERE pool_id = $1`, [poolId]), []);
});

test('Confidence, season over: Q3 and Q4 are decided from the pool\'s weeks only, and the champion from them', async () => {
  const { db, supabase } = await setup();
  await seedSchedule(db, 18);
  const { poolId, ids } = await createPool(db, 'NFL_CONFIDENCE', CREATED_TUESDAY_BEFORE_WEEK_12, ['Ann', 'Ben']);
  await confidencePicks(db, poolId, ids, 18);
  assert.equal((await runConfidenceResultsJob(supabase, { all: true })).success, true);

  const periods = await rows<{ period_name: string; winner_participant_id: string; period_points: number; weeks_won: number }>(db,
    `SELECT period_name, winner_participant_id, period_points, weeks_won FROM period_winners WHERE pool_id = $1 ORDER BY period_name`, [poolId]);
  assert.deepEqual(periods, [
    { period_name: 'Q3', winner_participant_id: ids.Ann, period_points: 9, weeks_won: 3 }, // Weeks 12-14
    { period_name: 'Q4', winner_participant_id: ids.Ann, period_points: 12, weeks_won: 4 }, // Weeks 15-18
  ]);
  const [season] = await rows<{ winner_participant_id: string; total_points: number; weeks_won: number }>(db,
    `SELECT winner_participant_id, total_points, weeks_won FROM season_winners WHERE pool_id = $1`, [poolId]);
  assert.deepEqual(season, { winner_participant_id: ids.Ann, total_points: 21, weeks_won: 7 }, '7 weeks x 3 points');
});

test('Confidence: the quarter selector API hides Q1 and Q2 from a pool created in Week 12', async () => {
  const { db } = await setup();
  await seedSchedule(db, 13);
  const early = await createPool(db, 'NFL_CONFIDENCE', '2026-08-01T00:00:00Z', ['Ann']);
  const late = await createPool(db, 'NFL_CONFIDENCE', CREATED_TUESDAY_BEFORE_WEEK_12, ['Ann']);
  const available = async (poolId: string) => {
    const res = await availablePeriodsGET(new NextRequest(
      `http://localhost/api/periods/available?poolId=${poolId}&season=${SEASON}&currentWeek=14&currentSeasonType=2`));
    const body = await res.json();
    assert.equal(body.success, true, JSON.stringify(body));
    return (body.data.periods as Array<{ name: string }>).map(p => p.name);
  };
  assert.deepEqual(await available(early.poolId), ['Q1', 'Q2', 'Q3']);
  assert.deepEqual(await available(late.poolId), ['Q3']);
});

// ---------------------------------------------------------------------------
// Survivor
// ---------------------------------------------------------------------------

async function survivorPick(db: PGlite, poolId: string, participantId: string, week: number, team: string) {
  await db.query(
    `INSERT INTO survivor_picks (participant_id, pool_id, game_id, season, season_type, week, selected_team) VALUES ($1, $2, $3, $4, 2, $5, $6)`,
    [participantId, poolId, `g${week}a`, SEASON, week, team]);
}

test('Survivor, mid-season: nobody is eliminated for weeks before the pool; missing a pool week still eliminates', async () => {
  const { db } = await setup();
  await seedSchedule(db, 13);
  const { poolId, ids } = await createPool(db, 'SURVIVOR', CREATED_TUESDAY_BEFORE_WEEK_12, ['Ann', 'Ben', 'Cara', 'Dev']);
  await survivorPick(db, poolId, ids.Ann, 12, 'H12a'); // wins
  await survivorPick(db, poolId, ids.Ann, 13, 'H13a'); // wins
  await survivorPick(db, poolId, ids.Ben, 12, 'H12a'); // wins, then no Week 13 pick
  await survivorPick(db, poolId, ids.Dev, 12, 'A12a'); // loses Week 12
  // Cara never picks.

  const state = await computeSurvivorPoolState(poolId, new Date(tuesdayAfter(13)));
  const by = Object.fromEntries(state.participants.map(p => [p.participantName, p]));
  assert.equal(by.Ann.liveStatus, 'ACTIVE');
  assert.deepEqual(by.Ann.picks.map(p => [p.week, p.result]), [[12, 'win'], [13, 'win']]);
  assert.deepEqual([by.Ben.liveStatus, by.Ben.eliminatedWeek, by.Ben.eliminatedReason], ['ELIMINATED', 13, 'no_pick']);
  assert.deepEqual([by.Cara.liveStatus, by.Cara.eliminatedWeek, by.Cara.eliminatedReason], ['ELIMINATED', 12, 'no_pick'],
    'out for missing Week 12, the pool\'s first week, not Week 1');
  assert.deepEqual([by.Dev.liveStatus, by.Dev.eliminatedWeek], ['ELIMINATED', 12]);
  assert.equal(state.activeCount, 1);
});

test('Survivor: a pool created after a week kicked off starts the next week', async () => {
  const { db } = await setup();
  await seedSchedule(db, 13);
  const { poolId, ids } = await createPool(db, 'SURVIVOR', CREATED_DURING_WEEK_12, ['Ann', 'Cara']);
  await survivorPick(db, poolId, ids.Ann, 13, 'H13a');
  const state = await computeSurvivorPoolState(poolId, new Date(tuesdayAfter(13)));
  const by = Object.fromEntries(state.participants.map(p => [p.participantName, p]));
  assert.equal(by.Ann.liveStatus, 'ACTIVE', 'no Week 12 pick needed');
  assert.deepEqual([by.Cara.eliminatedWeek, by.Cara.eliminatedReason], [13, 'no_pick']);
});

// ---------------------------------------------------------------------------
// Pick'em
// ---------------------------------------------------------------------------

async function pickemPick(db: PGlite, poolId: string, participantId: string, gameId: string, week: number, team: string) {
  await db.query(
    `INSERT INTO pickem_picks (participant_id, pool_id, game_id, season, season_type, week, selected_team) VALUES ($1, $2, $3, $4, 2, $5, $6)`,
    [participantId, poolId, gameId, SEASON, week, team]);
}

test('Pick\'em, mid-season: the season summary lists and counts only the pool\'s weeks', async () => {
  const { db } = await setup();
  await seedSchedule(db, 13);
  const { poolId, ids } = await createPool(db, 'PICKEM', CREATED_TUESDAY_BEFORE_WEEK_12, ['Ann', 'Ben']);
  for (const w of [12, 13]) {
    await pickemPick(db, poolId, ids.Ann, `g${w}a`, w, `H${w}a`);
    await pickemPick(db, poolId, ids.Ann, `g${w}b`, w, `H${w}b`);
    await pickemPick(db, poolId, ids.Ben, `g${w}a`, w, `H${w}a`);
    await pickemPick(db, poolId, ids.Ben, `g${w}b`, w, `A${w}b`);
  }
  const summary = await computePickemSeasonSummary(poolId, new Date(tuesdayAfter(13)));
  const by = Object.fromEntries(summary.participants.map(p => [p.participantName, p]));
  assert.deepEqual(by.Ann.weeklyResults.map(r => r.week), [12, 13, 14, 15, 16, 17, 18], 'no Weeks 1-11');
  assert.equal(by.Ann.seasonCorrectCount, 4);
  assert.equal(by.Ben.seasonCorrectCount, 2);
  assert.deepEqual(summary.currentWeek, { week: 14, seasonType: 2 });
  assert.equal(summary.isSeasonComplete, false);
});

test('Pick\'em, season over: the winner is decided over the pool\'s weeks only', async () => {
  const { db } = await setup();
  await seedSchedule(db, 18);
  const { poolId, ids } = await createPool(db, 'PICKEM', CREATED_TUESDAY_BEFORE_WEEK_12, ['Ann', 'Ben']);
  for (let w = 12; w <= 18; w++) {
    await pickemPick(db, poolId, ids.Ann, `g${w}a`, w, `H${w}a`);
    await pickemPick(db, poolId, ids.Ben, `g${w}a`, w, `A${w}a`);
  }
  const summary = await computePickemSeasonSummary(poolId, new Date('2027-01-20T00:00:00Z'));
  assert.equal(summary.isSeasonComplete, true);
  assert.deepEqual(summary.seasonWinnerParticipantIds, [ids.Ann]);
  assert.equal(summary.participants.find(p => p.participantName === 'Ann')!.seasonCorrectCount, 7);
});
