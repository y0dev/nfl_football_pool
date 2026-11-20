// In-process Postgres (PGlite) plus a small stand-in for the Supabase JS
// client, so unit tests can run the app's real queries and the real
// migration SQL (functions, triggers) without a Supabase project.
//
// Covers the subset of the query builder the code under test uses: select /
// insert / upsert / update / delete, eq / neq / in / gt / gte / lt / lte / is,
// order, range, limit, single, maybeSingle, and rpc(). No embedded joins.
import fs from 'node:fs';
import path from 'node:path';
import { PGlite, types } from '@electric-sql/pglite';

type Row = Record<string, unknown>;
type Result = { data: unknown; error: { message: string; code?: string } | null };

const ident = (name: string) => {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) throw new Error(`Unsupported identifier: ${name}`);
  return `"${name}"`;
};

class Query implements PromiseLike<Result> {
  private op: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
  private columns = '*';
  private returning = false;
  private where: Array<{ sql: (n: () => string) => string; values: unknown[] }> = [];
  private orders: string[] = [];
  private limitN: number | null = null;
  private offsetN = 0;
  private mode: 'many' | 'single' | 'maybe' = 'many';
  private payload: Row[] = [];
  private onConflict: string | null = null;

  constructor(private db: PGlite, private table: string) {}

  select(columns = '*') {
    if (this.op === 'select') this.columns = columns;
    else this.returning = true;
    return this;
  }
  insert(rows: Row | Row[]) { this.op = 'insert'; this.payload = Array.isArray(rows) ? rows : [rows]; return this; }
  upsert(rows: Row | Row[], opts: { onConflict?: string } = {}) {
    this.op = 'upsert'; this.payload = Array.isArray(rows) ? rows : [rows]; this.onConflict = opts.onConflict ?? null; return this;
  }
  update(values: Row) { this.op = 'update'; this.payload = [values]; return this; }
  delete() { this.op = 'delete'; return this; }

  private filter(col: string, opSql: string, value: unknown) {
    this.where.push({ sql: n => `${ident(col)} ${opSql} ${n()}`, values: [value] });
    return this;
  }
  eq(c: string, v: unknown) { return this.filter(c, '=', v); }
  neq(c: string, v: unknown) { return this.filter(c, '<>', v); }
  gt(c: string, v: unknown) { return this.filter(c, '>', v); }
  gte(c: string, v: unknown) { return this.filter(c, '>=', v); }
  lt(c: string, v: unknown) { return this.filter(c, '<', v); }
  lte(c: string, v: unknown) { return this.filter(c, '<=', v); }
  is(c: string, v: null) { this.where.push({ sql: () => `${ident(c)} IS ${v === null ? 'NULL' : String(v)}`, values: [] }); return this; }
  in(c: string, values: unknown[]) {
    if (values.length === 0) { this.where.push({ sql: () => 'false', values: [] }); return this; }
    this.where.push({ sql: n => `${ident(c)} IN (${values.map(() => n()).join(', ')})`, values });
    return this;
  }
  order(c: string, opts: { ascending?: boolean } = {}) { this.orders.push(`${ident(c)} ${opts.ascending === false ? 'DESC' : 'ASC'}`); return this; }
  range(from: number, to: number) { this.offsetN = from; this.limitN = to - from + 1; return this; }
  limit(n: number) { this.limitN = n; return this; }
  single() { this.mode = 'single'; return this; }
  maybeSingle() { this.mode = 'maybe'; return this; }

  private build(): { sql: string; params: unknown[] } {
    const params: unknown[] = [];
    const next = () => `$${params.length + 1}`;
    const push = (v: unknown) => { const p = next(); params.push(v); return p; };
    const whereSql = () => {
      if (this.where.length === 0) return '';
      return ' WHERE ' + this.where.map(w => {
        let i = 0;
        return w.sql(() => push(w.values[i++]));
      }).join(' AND ');
    };
    const cols = this.columns.split(',').map(c => c.trim()).filter(Boolean);
    const selectList = cols.length === 1 && cols[0] === '*' ? '*' : cols.map(ident).join(', ');
    const table = ident(this.table);

    if (this.op === 'select') {
      let sql = `SELECT ${selectList} FROM ${table}${whereSql()}`;
      if (this.orders.length) sql += ` ORDER BY ${this.orders.join(', ')}`;
      if (this.limitN != null) sql += ` LIMIT ${this.limitN}`;
      if (this.offsetN) sql += ` OFFSET ${this.offsetN}`;
      return { sql, params };
    }
    if (this.op === 'delete') return { sql: `DELETE FROM ${table}${whereSql()}${this.returning ? ' RETURNING *' : ''}`, params };
    if (this.op === 'update') {
      const sets = Object.entries(this.payload[0]).map(([k, v]) => `${ident(k)} = ${push(encode(v))}`).join(', ');
      return { sql: `UPDATE ${table} SET ${sets}${whereSql()}${this.returning ? ' RETURNING *' : ''}`, params };
    }
    const keys = [...new Set(this.payload.flatMap(r => Object.keys(r)))];
    const values = this.payload.map(r => `(${keys.map(k => (k in r ? push(encode(r[k])) : 'DEFAULT')).join(', ')})`).join(', ');
    let sql = `INSERT INTO ${table} (${keys.map(ident).join(', ')}) VALUES ${values}`;
    if (this.op === 'upsert') {
      const conflict = (this.onConflict ?? 'id').split(',').map(c => ident(c.trim())).join(', ');
      const updates = keys.map(k => `${ident(k)} = EXCLUDED.${ident(k)}`).join(', ');
      sql += ` ON CONFLICT (${conflict}) DO UPDATE SET ${updates}`;
    }
    if (this.returning) sql += ' RETURNING *';
    return { sql, params };
  }

  private async run(): Promise<Result> {
    try {
      const { sql, params } = this.build();
      const { rows } = await this.db.query<Row>(sql, params);
      if (this.mode === 'single') {
        if (rows.length !== 1) return { data: null, error: { message: `Expected 1 row, got ${rows.length}`, code: 'PGRST116' } };
        return { data: rows[0], error: null };
      }
      if (this.mode === 'maybe') {
        if (rows.length > 1) return { data: null, error: { message: `Expected at most 1 row, got ${rows.length}`, code: 'PGRST116' } };
        return { data: rows[0] ?? null, error: null };
      }
      return { data: this.op === 'select' || this.returning ? rows : null, error: null };
    } catch (e) {
      return { data: null, error: { message: (e as Error).message, code: (e as { code?: string }).code } };
    }
  }

  then<A = Result, B = never>(onfulfilled?: ((value: Result) => A | PromiseLike<A>) | null, onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null) {
    return this.run().then(onfulfilled, onrejected);
  }
}

function encode(v: unknown): unknown {
  if (v != null && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v)) return JSON.stringify(v);
  return v;
}

export interface FakeSupabase {
  from(table: string): Query;
  rpc(fn: string, args?: Row): Promise<Result>;
  /** Calls made through rpc(), for assertions. */
  rpcCalls: Array<{ fn: string; args: Row }>;
  /** Make the next rpc() call to `fn` fail without reaching the database. */
  failNextRpc(fn: string, message?: string): void;
}

export function createFakeSupabase(db: PGlite): FakeSupabase {
  const failures = new Map<string, string>();
  const client: FakeSupabase = {
    rpcCalls: [],
    from: (table: string) => new Query(db, table),
    async rpc(fn: string, args: Row = {}) {
      client.rpcCalls.push({ fn, args });
      if (failures.has(fn)) {
        const message = failures.get(fn)!;
        failures.delete(fn);
        return { data: null, error: { message } };
      }
      try {
        const params: unknown[] = [];
        const named = Object.entries(args).map(([k, v]) => {
          params.push(encode(v));
          return `${ident(k)} => $${params.length}${v != null && typeof v === 'object' && !Array.isArray(v) ? '::jsonb' : ''}`;
        }).join(', ');
        const { rows } = await db.query<Row>(`SELECT ${ident(fn)}(${named}) AS result`, params);
        return { data: rows[0]?.result ?? null, error: null };
      } catch (e) {
        return { data: null, error: { message: (e as Error).message, code: (e as { code?: string }).code } };
      }
    },
    failNextRpc(fn: string, message = 'injected rpc failure') { failures.set(fn, message); },
  };
  return client;
}

const MIGRATIONS = path.resolve(__dirname, '../../../supabase/migrations');

/** Tables as they exist in production (docs/migrations/prior_to_huddles.txt
 * plus the unique keys the app's upserts rely on), trimmed to the columns
 * the code under test touches. */
const BASE_SCHEMA = `
DO $roles$ BEGIN
  -- Roles are cluster-wide, so a real Postgres server may already have them.
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
END $roles$;
CREATE SCHEMA cron;
CREATE FUNCTION cron.schedule(text, text, text) RETURNS bigint LANGUAGE sql AS 'SELECT 1::bigint';

CREATE TABLE pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL,
  season integer NOT NULL,
  is_active boolean DEFAULT true,
  pool_type varchar DEFAULT 'normal',
  competition_type varchar DEFAULT 'NFL_CONFIDENCE',
  tie_breaker_question varchar,
  tie_breaker_answer numeric,
  season_scope integer[] DEFAULT ARRAY[2],
  type_settings jsonb,
  is_private boolean DEFAULT false,
  private_password_encrypted text,
  private_password_version integer,
  created_by varchar,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid REFERENCES pools(id),
  name varchar NOT NULL,
  email varchar,
  is_active boolean DEFAULT true
);
CREATE TABLE games (
  id varchar PRIMARY KEY,
  week integer NOT NULL,
  season integer NOT NULL,
  season_type integer NOT NULL DEFAULT 2,
  home_team varchar, away_team varchar,
  home_team_id varchar, away_team_id varchar,
  kickoff_time timestamptz,
  status varchar DEFAULT 'scheduled',
  winner varchar,
  home_score integer, away_score integer,
  is_active boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);
CREATE TABLE picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid REFERENCES participants(id),
  pool_id uuid REFERENCES pools(id),
  game_id varchar REFERENCES games(id),
  predicted_winner varchar NOT NULL,
  confidence_points integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE tie_breakers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid REFERENCES participants(id),
  pool_id uuid REFERENCES pools(id),
  week integer NOT NULL,
  season integer NOT NULL,
  season_type integer DEFAULT 2,
  answer numeric NOT NULL
);
CREATE TABLE scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid REFERENCES participants(id),
  pool_id uuid REFERENCES pools(id),
  week integer NOT NULL, season integer NOT NULL, season_type integer NOT NULL DEFAULT 2,
  points integer DEFAULT 0, correct_picks integer DEFAULT 0, total_picks integer DEFAULT 0,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
  UNIQUE (participant_id, pool_id, week, season, season_type)
);
CREATE TABLE weekly_winners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES pools(id),
  week integer NOT NULL, season integer NOT NULL, season_type smallint,
  winner_participant_id uuid REFERENCES participants(id),
  winner_name varchar NOT NULL, winner_points integer NOT NULL, winner_correct_picks integer NOT NULL,
  tie_breaker_used boolean DEFAULT false, tie_breaker_question varchar, tie_breaker_answer numeric,
  winner_tie_breaker_answer numeric, tie_breaker_difference numeric, total_participants integer NOT NULL,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
  UNIQUE (pool_id, week, season, season_type)
);
CREATE TABLE period_winners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES pools(id),
  season integer NOT NULL, period_name varchar NOT NULL, start_week integer NOT NULL, end_week integer NOT NULL,
  winner_participant_id uuid REFERENCES participants(id),
  winner_name varchar NOT NULL, period_points integer NOT NULL, period_correct_picks integer NOT NULL,
  weeks_won integer NOT NULL DEFAULT 0,
  tie_breaker_used boolean DEFAULT false, tie_breaker_question varchar, tie_breaker_answer numeric,
  winner_tie_breaker_answer numeric, tie_breaker_difference numeric, total_participants integer NOT NULL,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
  UNIQUE (pool_id, season, period_name)
);
CREATE TABLE season_winners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES pools(id),
  season integer NOT NULL,
  winner_participant_id uuid REFERENCES participants(id),
  winner_name varchar NOT NULL, total_points integer NOT NULL, total_correct_picks integer NOT NULL,
  weeks_won integer NOT NULL DEFAULT 0,
  tie_breaker_used boolean DEFAULT false, tie_breaker_question varchar, tie_breaker_answer numeric,
  winner_tie_breaker_answer numeric, tie_breaker_difference numeric, total_participants integer NOT NULL,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
  UNIQUE (pool_id, season)
);
`;

/** The migrations under test, applied verbatim. */
const MIGRATION_FILES = [
  '20260820120000_add_survivor_pool_tables.sql',
  '20261110120000_recalculate_confidence_results.sql',
  '20261110130000_atomic_survivor_pick_replacement.sql',
  '20261119130000_dedupe_confidence_dirty_marking.sql',
  '20261119140000_confidence_dirty_on_schedule_changes.sql',
];

/** The full test schema as SQL scripts, in order — for running the same
 *  schema on a real Postgres server (see helpers/real-postgres.ts). */
export function testSchemaScripts(): string[] {
  return [BASE_SCHEMA, ...MIGRATION_FILES.map(file => fs.readFileSync(path.join(MIGRATIONS, file), 'utf8'))];
}

export async function createTestDatabase(): Promise<{ db: PGlite; supabase: FakeSupabase }> {
  const db = new PGlite({
    parsers: {
      // PostgREST returns numeric as a JSON number and timestamps as full-
      // precision strings; match that.
      [types.NUMERIC]: (v: string) => Number(v),
      [types.TIMESTAMPTZ]: (v: string) => v,
      [types.TIMESTAMP]: (v: string) => v,
    },
  });
  await db.exec(BASE_SCHEMA);
  for (const file of MIGRATION_FILES) {
    await db.exec(fs.readFileSync(path.join(MIGRATIONS, file), 'utf8'));
  }
  // The migration's backfill marks pools; tests start from a clean slate.
  await db.exec('DELETE FROM confidence_results_dirty');
  return { db, supabase: createFakeSupabase(db) };
}

/** Points the app's getSupabaseServiceClient() at the fake client. */
export function installServiceClient(supabase: FakeSupabase) {
  (globalThis as { __supabaseServiceClient?: unknown }).__supabaseServiceClient = supabase;
}
