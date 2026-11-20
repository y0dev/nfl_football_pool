// Optional real-PostgreSQL target for SQL that behaves differently under
// PGlite (e.g. clock_timestamp() resolution: PGlite ticks in milliseconds,
// Postgres in microseconds). Set TEST_DATABASE_URL to a server you can
// CREATE DATABASE on; each call gets a fresh, throwaway database with the
// same schema + migrations the PGlite tests use, dropped by close().
//
// Locally:  docker run --rm -d -p 54329:5432 -e POSTGRES_PASSWORD=postgres postgres:17
//           TEST_DATABASE_URL=postgres://postgres:postgres@localhost:54329/postgres npm run test:unit
// CI sets it via a postgres service container (.github/workflows/ci.yml).
import { randomBytes } from 'node:crypto';
import { Client } from 'pg';
import { testSchemaScripts } from './pg-supabase';

export const REAL_POSTGRES_URL = process.env.TEST_DATABASE_URL || null;

export interface SqlDb {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<unknown>;
  close(): Promise<void>;
}

export interface RealPostgresDb extends SqlDb {
  /** Opens another connection to the same database (for concurrency
   * tests). Closed automatically by close(). */
  connect(): Promise<Client>;
}

export async function createRealPostgresDatabase(): Promise<RealPostgresDb> {
  if (!REAL_POSTGRES_URL) throw new Error('TEST_DATABASE_URL is not set');

  const name = `sh_test_${randomBytes(6).toString('hex')}`;
  const admin = new Client({ connectionString: REAL_POSTGRES_URL });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);

  const url = new URL(REAL_POSTGRES_URL);
  url.pathname = `/${name}`;
  const client = new Client({ connectionString: url.toString() });
  await client.connect();

  try {
    for (const script of testSchemaScripts()) await client.query(script);
    await client.query('DELETE FROM confidence_results_dirty');
  } catch (e) {
    await client.end();
    await admin.query(`DROP DATABASE IF EXISTS ${name}`);
    await admin.end();
    throw e;
  }

  const extra: Client[] = [];
  return {
    query: async <T>(sql: string, params: unknown[] = []) => ({ rows: (await client.query(sql, params)).rows as T[] }),
    exec: (sql: string) => client.query(sql),
    connect: async () => {
      const c = new Client({ connectionString: url.toString() });
      await c.connect();
      extra.push(c);
      return c;
    },
    close: async () => {
      await Promise.all(extra.map(c => c.end().catch(() => {})));
      await client.end();
      await admin.query(`DROP DATABASE IF EXISTS ${name}`);
      await admin.end();
    },
  };
}
