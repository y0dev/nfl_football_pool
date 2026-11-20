// Playoff pick replacement under real concurrency. replace_survivor_pick()
// serializes per participant with an advisory lock and re-checks team reuse
// after taking it; these tests drive it from several connections at once.
// PGlite has a single connection, so this needs real PostgreSQL
// (TEST_DATABASE_URL — CI provides it; see helpers/real-postgres.ts).
import test from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { REAL_POSTGRES_URL, createRealPostgresDatabase, type RealPostgresDb } from './helpers/real-postgres';

const SEASON = 2026;
const skip = REAL_POSTGRES_URL ? undefined : 'set TEST_DATABASE_URL to run against a real PostgreSQL server';

async function seed(db: RealPostgresDb) {
  const { rows: [pool] } = await db.query<{ id: string }>(
    `INSERT INTO pools (name, season, competition_type, season_scope) VALUES ('E2E Survivor Race', $1, 'SURVIVOR', ARRAY[2,3]) RETURNING id`, [SEASON]);
  const { rows: [a] } = await db.query<{ id: string }>(`INSERT INTO participants (pool_id, name) VALUES ($1, 'A') RETURNING id`, [pool.id]);
  const soon = new Date(Date.now() + 86_400_000).toISOString();
  const teams = ['BUF', 'KC', 'PHI', 'DAL', 'SF', 'GB', 'BAL', 'DET'];
  for (let i = 0; i < teams.length; i += 2) {
    await db.query(
      `INSERT INTO games (id, week, season, season_type, home_team, away_team, home_team_id, away_team_id, kickoff_time, status)
       VALUES ($1, 1, $2, 3, $3, $4, $3, $4, $5, 'scheduled')`, [`po1-${i}`, SEASON, teams[i], teams[i + 1], soon]);
  }
  await db.query(
    `INSERT INTO games (id, week, season, season_type, home_team, away_team, home_team_id, away_team_id, kickoff_time, status)
     VALUES ('po2-0', 2, $1, 3, 'NE', 'NYJ', 'NE', 'NYJ', $2, 'scheduled')`, [SEASON, soon]);
  // Current playoff week-1 pick, and a week-2 pick.
  await db.query(
    `INSERT INTO survivor_picks (participant_id, pool_id, game_id, season, season_type, week, selected_team)
     VALUES ($1, $2, 'po1-0', $3, 3, 1, 'BUF'), ($1, $2, 'po2-0', $3, 3, 2, 'NE')`, [a.id, pool.id, SEASON]);
  const gameFor = (team: string) => `po1-${Math.floor(teams.indexOf(team) / 2) * 2}`;
  return { poolId: pool.id, participantId: a.id, gameFor };
}

const replace = (c: Client, s: { poolId: string; participantId: string }, gameId: string, week: number, team: string) =>
  c.query(`SELECT replace_survivor_pick($1, $2, $3, $4, 3, $5, $6)`, [s.participantId, s.poolId, gameId, SEASON, week, team]);

async function picks(db: RealPostgresDb, participantId: string) {
  return (await db.query<{ week: number; selected_team: string }>(
    `SELECT week, selected_team FROM survivor_picks WHERE participant_id = $1 AND season_type = 3 ORDER BY week`, [participantId])).rows;
}

test('[PostgreSQL] concurrent replacements for one week serialize: the later one wins, nothing is lost or duplicated', { skip }, async () => {
  const db = await createRealPostgresDatabase();
  try {
    const s = await seed(db);
    const [c1, c2] = [await db.connect(), await db.connect()];
    await c1.query('BEGIN');
    await c2.query('BEGIN');
    await replace(c1, s, s.gameFor('KC'), 1, 'KC'); // holds the participant lock
    const second = replace(c2, s, s.gameFor('PHI'), 1, 'PHI'); // must wait for it
    let secondDone = false;
    void second.then(() => { secondDone = true; }, () => { secondDone = true; });
    await new Promise(r => setTimeout(r, 300));
    assert.equal(secondDone, false, 'second replacement blocks while the first is uncommitted');

    await c1.query('COMMIT');
    await second;
    await c2.query('COMMIT');
    assert.deepEqual(await picks(db, s.participantId), [{ week: 1, selected_team: 'PHI' }, { week: 2, selected_team: 'NE' }]);
  } finally {
    await db.close();
  }
});

test('[PostgreSQL] a team claimed by a concurrent pick in another week is rejected and the existing pick kept', { skip }, async () => {
  const db = await createRealPostgresDatabase();
  try {
    const s = await seed(db);
    const [c1, c2] = [await db.connect(), await db.connect()];
    await c1.query('BEGIN');
    await replace(c1, s, s.gameFor('KC'), 1, 'KC'); // week 1 -> KC, uncommitted
    await c2.query('BEGIN');
    // Week 2 -> KC, waits on the lock. The rejection is awaited from the
    // start: it can land as soon as the server commits c1, before c1's
    // COMMIT call returns, and an unobserved rejection fails the test run.
    const clash = assert.rejects(replace(c2, s, 'po2-0', 2, 'KC'), /SURVIVOR_TEAM_ALREADY_USED/, 'the re-check after the lock sees the committed KC pick');
    await new Promise(r => setTimeout(r, 300));
    await c1.query('COMMIT');
    await clash;
    await c2.query('ROLLBACK');
    assert.deepEqual(await picks(db, s.participantId), [{ week: 1, selected_team: 'KC' }, { week: 2, selected_team: 'NE' }], 'week 2 pick preserved');
  } finally {
    await db.close();
  }
});

test('[PostgreSQL] a burst of simultaneous submissions leaves exactly one valid pick per week', { skip }, async () => {
  const db = await createRealPostgresDatabase();
  try {
    const s = await seed(db);
    const clients = await Promise.all(Array.from({ length: 8 }, () => db.connect()));
    const teams = ['KC', 'PHI', 'DAL', 'SF', 'GB', 'BAL', 'DET', 'NE']; // NE is used in week 2 -> must fail
    const results = await Promise.allSettled(clients.map((c, i) =>
      replace(c, s, teams[i] === 'NE' ? 'po2-0' : s.gameFor(teams[i]), 1, teams[i])));

    const failures = results.flatMap((r, i) => (r.status === 'rejected' ? [{ team: teams[i], error: String(r.reason) }] : []));
    assert.deepEqual(failures.map(f => f.team), ['NE'], 'only the reused team fails');
    assert.match(failures[0].error, /SURVIVOR_TEAM_ALREADY_USED/);

    const after = await picks(db, s.participantId);
    assert.equal(after.filter(p => p.week === 1).length, 1, 'one week-1 pick');
    assert.ok(teams.slice(0, 7).includes(after.find(p => p.week === 1)!.selected_team));
    assert.deepEqual(after.filter(p => p.week === 2), [{ week: 2, selected_team: 'NE' }]);
  } finally {
    await db.close();
  }
});
