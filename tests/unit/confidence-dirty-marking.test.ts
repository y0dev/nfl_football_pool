// Dirty-marking must never fail the write that fired it. Repeated pool ids
// (every same-pool UPDATE trigger passes ARRAY[OLD.pool_id, NEW.pool_id])
// used to abort pick/participant/tie-breaker updates on real Postgres with
// "ON CONFLICT DO UPDATE command cannot affect row a second time" — see
// supabase/migrations/20261119130000_dedupe_confidence_dirty_marking.sql.
//
// Runs on PGlite, and also on a real PostgreSQL server when
// TEST_DATABASE_URL is set (CI does this) — PGlite's millisecond clock hid
// the original bug.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase } from './helpers/pg-supabase';
import { REAL_POSTGRES_URL, createRealPostgresDatabase, type SqlDb } from './helpers/real-postgres';

const SEASON = 2026;

async function pglite(): Promise<SqlDb> {
  const { db } = await createTestDatabase();
  return {
    query: async <T>(sql: string, params: unknown[] = []) => ({ rows: (await db.query<T>(sql, params)).rows }),
    exec: (sql: string) => db.exec(sql),
    close: () => db.close(),
  };
}

const engines: Array<{ name: string; create: () => Promise<SqlDb>; skip?: string }> = [
  { name: 'PGlite', create: pglite },
  {
    name: 'PostgreSQL',
    create: createRealPostgresDatabase,
    ...(REAL_POSTGRES_URL ? {} : { skip: 'set TEST_DATABASE_URL to run against a real PostgreSQL server' }),
  },
];

async function seed(db: SqlDb) {
  const pool = async (name: string) =>
    (await db.query<{ id: string }>(`INSERT INTO pools (name, season) VALUES ($1, $2) RETURNING id`, [name, SEASON])).rows[0].id;
  const poolA = await pool('E2E Dirty A');
  const poolB = await pool('E2E Dirty B');
  const participant = async (poolId: string, name: string) =>
    (await db.query<{ id: string }>(`INSERT INTO participants (pool_id, name) VALUES ($1, $2) RETURNING id`, [poolId, name])).rows[0].id;
  const alice = await participant(poolA, 'Alice');
  const bob = await participant(poolA, 'Bob');

  for (let g = 1; g <= 8; g++) {
    await db.query(
      `INSERT INTO games (id, week, season, season_type, home_team, away_team, status, winner, home_score, away_score)
       VALUES ($1, 10, $2, 2, $3, $4, 'final', $3, 24, 10)`,
      [`dm-${g}`, SEASON, `H${g}`, `A${g}`]);
  }
  for (const [pid, offset] of [[alice, 0], [bob, 8]] as const) {
    for (let g = 1; g <= 8; g++) {
      await db.query(
        `INSERT INTO picks (participant_id, pool_id, game_id, predicted_winner, confidence_points) VALUES ($1, $2, $3, $4, $5)`,
        [pid, poolA, `dm-${g}`, `H${g}`, g + offset]);
    }
  }
  await db.query(
    `INSERT INTO tie_breakers (participant_id, pool_id, week, season, answer) VALUES ($1, $2, 10, $3, 40)`, [alice, poolA, SEASON]);
  await db.exec('DELETE FROM confidence_results_dirty');
  return { poolA, poolB, alice, bob };
}

const dirtyPools = async (db: SqlDb) =>
  (await db.query<{ pool_id: string }>('SELECT pool_id FROM confidence_results_dirty ORDER BY pool_id')).rows.map(r => r.pool_id);

for (const engine of engines) {
  test(`[${engine.name}] mark_confidence_pools_dirty de-duplicates repeated and NULL ids`, { skip: engine.skip }, async () => {
    const db = await engine.create();
    try {
      const { poolA, poolB } = await seed(db);
      // 10,000 copies spans many clock ticks on any engine — this failed
      // before the fix even under PGlite.
      await db.query(
        `SELECT mark_confidence_pools_dirty(array_fill($1::uuid, ARRAY[10000]) || array_fill($2::uuid, ARRAY[10000]) || ARRAY[NULL::uuid])`,
        [poolA, poolB]);
      assert.deepEqual(await dirtyPools(db), [poolA, poolB].sort());

      // Re-marking an already-dirty pool with duplicates refreshes it.
      await db.query(`SELECT mark_confidence_pools_dirty(ARRAY[$1::uuid, $1::uuid])`, [poolA]);
      assert.equal((await dirtyPools(db)).length, 2);
    } finally {
      await db.close();
    }
  });

  test(`[${engine.name}] same-pool pick UPDATEs on a finished game never fail`, { skip: engine.skip }, async () => {
    const db = await engine.create();
    try {
      const { poolA, alice } = await seed(db);
      // Each fires the trigger with ARRAY[OLD.pool_id, NEW.pool_id] = [A, A].
      for (let i = 0; i < 300; i++) {
        await db.query(
          `UPDATE picks SET predicted_winner = $1 WHERE participant_id = $2 AND game_id = 'dm-1'`,
          [i % 2 === 0 ? 'A1' : 'H1', alice]);
      }
      const { rows: [pick] } = await db.query<{ predicted_winner: string }>(
        `SELECT predicted_winner FROM picks WHERE participant_id = $1 AND game_id = 'dm-1'`, [alice]);
      assert.equal(pick.predicted_winner, 'H1', 'the last update landed');
      assert.deepEqual(await dirtyPools(db), [poolA]);

      // One statement updating every pick in the pool (16 row triggers).
      await db.exec('DELETE FROM confidence_results_dirty');
      await db.query(`UPDATE picks SET confidence_points = confidence_points WHERE pool_id = $1`, [poolA]);
      assert.deepEqual(await dirtyPools(db), [poolA]);
    } finally {
      await db.close();
    }
  });

  test(`[${engine.name}] same-pool participant and tie-breaker UPDATEs never fail`, { skip: engine.skip }, async () => {
    const db = await engine.create();
    try {
      const { poolA, alice, bob } = await seed(db);
      for (let i = 0; i < 200; i++) {
        await db.query(`UPDATE participants SET name = $1 WHERE id = $2`, [`Alice ${i}`, alice]);
        await db.query(`UPDATE tie_breakers SET answer = $1 WHERE participant_id = $2`, [i, alice]);
      }
      await db.query(`UPDATE participants SET is_active = true WHERE pool_id = $1`, [poolA]);
      assert.deepEqual(await dirtyPools(db), [poolA]);
      const { rows } = await db.query<{ name: string }>(`SELECT name FROM participants WHERE id = $1`, [alice]);
      assert.equal(rows[0].name, 'Alice 199');
      assert.ok(bob);
    } finally {
      await db.close();
    }
  });

  test(`[${engine.name}] moving a pick to another pool marks both pools`, { skip: engine.skip }, async () => {
    const db = await engine.create();
    try {
      const { poolA, poolB, alice } = await seed(db);
      await db.query(`UPDATE picks SET pool_id = $1 WHERE participant_id = $2 AND game_id = 'dm-2'`, [poolB, alice]);
      assert.deepEqual(await dirtyPools(db), [poolA, poolB].sort());
    } finally {
      await db.close();
    }
  });
}
