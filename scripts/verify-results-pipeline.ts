// Controlled end-to-end check of the deployed Confidence results pipeline:
// dirty-marking triggers -> pg_cron gate -> determine-weekly-winners ->
// apply_confidence_pool_results.
//
//   npm run verify-results-pipeline            # wait for the real cron (proves it runs)
//   npm run verify-results-pipeline -- --invoke  # call the Edge Function directly
//
// Uses NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local,
// and SUPABASE_SECRET_KEY (sb_secret_...) for --invoke: the Edge Functions'
// auth: 'secret' mode rejects the legacy JWT service_role key.
// Everything it creates lives in a random fake season (2900-2999) under an
// "E2E "-prefixed pool, so no real pool or game is touched, and it is all
// deleted at the end (the e2e teardown sweep also catches leftovers).
//
// Scenario:
//   1. Two finished weeks are scored: Alice wins week 1, Bob week 2.
//   2. A corrected final score (week 1, game 2) flips week 1, Q1 and the
//      season to Bob.
//   3. Week 2's games move into week 1 (a schedule correction that empties
//      week 2): week 2 keeps no scores or winner.
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY;
const functionKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });
const invoke = process.argv.includes('--invoke');
if (invoke && !functionKey?.startsWith('sb_secret_')) {
  console.error('--invoke needs SUPABASE_SECRET_KEY (sb_secret_..., Project Settings -> API Keys)');
  process.exit(1);
}
const TIMEOUT_MS = invoke ? 120_000 : 20 * 60_000; // cron ticks are minutes apart
const POLL_MS = invoke ? 3_000 : 20_000;

const season = 2900 + Math.floor(Math.random() * 100);
const tag = `${season}-${Date.now()}`;
const gid = (week: number, n: number) => `e2e-pipeline-${tag}-w${week}-${n}`;
let poolId: string | null = null;
const ids: Record<'alice' | 'bob', string> = { alice: '', bob: '' };

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
/** JSON with object keys sorted, so row order never affects a comparison. */
function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`).join(',')}}`;
}
function must<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}

async function preflight() {
  // Each probe distinguishes "missing" (migration not applied) from "present".
  const dirty = await supabase.from('confidence_results_dirty').select('pool_id').limit(1);
  if (dirty.error) throw new Error(`confidence_results_dirty missing — apply migrations (${dirty.error.message})`);
  const rpc = await supabase.rpc('apply_confidence_pool_results', { p_pool_id: null, p_season: null, p_plan: null });
  if (!rpc.error?.message.includes('pool, season and plan are required')) {
    throw new Error(`apply_confidence_pool_results not deployed as expected (${rpc.error?.message ?? 'no error'})`);
  }
  console.log('✓ migrations: confidence_results_dirty and apply_confidence_pool_results present');
}

async function runFunction() {
  for (let attempt = 1; attempt <= 6; attempt++) {
    const res = await fetch(`${url}/functions/v1/determine-weekly-winners`, {
      method: 'POST', headers: { apikey: functionKey!, 'Content-Type': 'application/json' }, body: '{}',
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`determine-weekly-winners HTTP ${res.status}: ${JSON.stringify(body)}`);
    if (!body.skipped) return;
    console.log('  function busy (another run holds the lock), retrying…');
    await sleep(10_000);
  }
  throw new Error('determine-weekly-winners stayed locked');
}

interface Snapshot {
  scores: Record<number, Record<string, number>>;
  weekly: Record<number, string>;
  q1: string | null;
  season: { winner: string; points: number } | null;
  dirty: boolean;
}

async function snapshot(): Promise<Snapshot> {
  const [scores, weekly, periods, seasonRows, dirty] = await Promise.all([
    supabase.from('scores').select('participant_id, week, points').eq('pool_id', poolId!),
    supabase.from('weekly_winners').select('week, winner_participant_id').eq('pool_id', poolId!),
    supabase.from('period_winners').select('period_name, winner_participant_id').eq('pool_id', poolId!),
    supabase.from('season_winners').select('winner_participant_id, total_points').eq('pool_id', poolId!),
    supabase.from('confidence_results_dirty').select('pool_id').eq('pool_id', poolId!),
  ]);
  const name = (id: string) => (id === ids.alice ? 'Alice' : id === ids.bob ? 'Bob' : id);
  const s: Snapshot = { scores: {}, weekly: {}, q1: null, season: null, dirty: (must(dirty, 'dirty') ?? []).length > 0 };
  for (const r of must(scores, 'scores') ?? []) (s.scores[r.week] ??= {})[name(r.participant_id)] = r.points;
  for (const r of must(weekly, 'weekly') ?? []) s.weekly[r.week] = name(r.winner_participant_id);
  s.q1 = (must(periods, 'periods') ?? []).filter(p => p.period_name === 'Q1').map(p => name(p.winner_participant_id))[0] ?? null;
  const sw = (must(seasonRows, 'season') ?? [])[0];
  s.season = sw ? { winner: name(sw.winner_participant_id), points: sw.total_points } : null;
  return s;
}

async function expectState(label: string, expected: Omit<Snapshot, 'dirty'>) {
  if (invoke) await runFunction();
  const deadline = Date.now() + TIMEOUT_MS;
  let last: Snapshot | null = null;
  while (Date.now() < deadline) {
    last = await snapshot();
    const { dirty, ...actual } = last;
    if (!dirty && stable(actual) === stable(expected)) {
      console.log(`✓ ${label}`);
      return;
    }
    await sleep(POLL_MS);
  }
  throw new Error(`${label}: timed out.\n  expected ${stable(expected)}\n  last     ${stable(last)}`);
}

async function expectMarked(label: string) {
  // The cron may clear the mark before we look; that is fine, the next
  // expectState() still proves the change was processed.
  const s = await snapshot();
  console.log(s.dirty ? `✓ ${label}: pool marked dirty` : `  ${label}: mark already consumed (cron ran in between)`);
}

async function setup() {
  const pool = must(await supabase.from('pools').insert({
    name: `E2E Results Pipeline ${tag}`, created_by: 'e2e-pipeline@sundayhuddle.test', season,
    is_active: true, competition_type: 'NFL_CONFIDENCE', pool_type: 'normal',
  }).select('id').single(), 'create pool');
  poolId = pool!.id;
  for (const who of ['alice', 'bob'] as const) {
    const p = must(await supabase.from('participants').insert({ pool_id: poolId, name: who === 'alice' ? 'Alice' : 'Bob' }).select('id').single(), 'participant');
    ids[who] = p!.id;
  }
  const games = [1, 2].flatMap(week => [1, 2].map(n => ({
    id: gid(week, n), season, season_type: 2, week, home_team: `H${n}`, away_team: `A${n}`,
    home_team_id: `H${n}`, away_team_id: `A${n}`, kickoff_time: new Date(Date.UTC(season, 8, week * 7)).toISOString(),
    status: 'final', home_score: 21, away_score: 10, winner: `H${n}`,
  })));
  // A finished, unpicked week-5 game: weeks 3-4 have no games but a later
  // week exists, so Q1 counts as complete and gets a period_winners row.
  games.push({ ...games[0], id: gid(5, 1), week: 5, kickoff_time: new Date(Date.UTC(season, 8, 35)).toISOString() });
  must(await supabase.from('games').insert(games), 'games');
  const pick = (who: 'alice' | 'bob', week: number, n: number, home: boolean, conf: number) =>
    ({ participant_id: ids[who], pool_id: poolId, game_id: gid(week, n), predicted_winner: home ? `H${n}` : `A${n}`, confidence_points: conf });
  must(await supabase.from('picks').insert([
    pick('alice', 1, 1, true, 2), pick('alice', 1, 2, true, 1),   // 3
    pick('bob', 1, 1, true, 1), pick('bob', 1, 2, false, 2),      // 1
    pick('alice', 2, 1, true, 2), pick('alice', 2, 2, false, 1),  // 2
    pick('bob', 2, 1, true, 2), pick('bob', 2, 2, true, 1),       // 3
  ]), 'picks');
}

async function cleanup() {
  if (poolId) {
    for (const table of ['picks', 'scores', 'weekly_winners', 'period_winners', 'season_winners', 'tie_breakers', 'participants', 'confidence_results_dirty']) {
      await supabase.from(table).delete().eq('pool_id', poolId);
    }
    await supabase.from('pools').delete().eq('id', poolId);
  }
  await supabase.from('games').delete().like('id', `e2e-pipeline-${tag}-%`);
  await supabase.from('confidence_results_dirty').delete().eq('pool_id', poolId ?? '00000000-0000-0000-0000-000000000000');
}

// Ctrl+C would otherwise exit without the finally below, leaving the fake
// games behind (the e2e sweep only removes pools).
process.once('SIGINT', () => {
  console.log('\nInterrupted — cleaning up…');
  cleanup().finally(() => process.exit(130));
});

async function main() {
  console.log(`Results pipeline check (${invoke ? 'direct invoke' : 'waiting for cron'}), fake season ${season}`);
  await preflight();
  try {
    await setup();
    await expectMarked('new finished games');
    await expectState('1. initial scoring', {
      scores: { 1: { Alice: 3, Bob: 1 }, 2: { Alice: 2, Bob: 3 } }, weekly: { 1: 'Alice', 2: 'Bob' },
      q1: 'Alice', season: { winner: 'Alice', points: 5 },
    });

    must(await supabase.from('games').update({ home_score: 10, away_score: 21, winner: 'A2' }).eq('id', gid(1, 2)), 'correct game');
    await expectMarked('corrected final');
    await expectState('2. corrected final flips week 1, Q1 and the season', {
      scores: { 1: { Alice: 2, Bob: 3 }, 2: { Alice: 2, Bob: 3 } }, weekly: { 1: 'Bob', 2: 'Bob' },
      q1: 'Bob', season: { winner: 'Bob', points: 6 },
    });

    must(await supabase.from('games').update({ week: 1 }).in('id', [gid(2, 1), gid(2, 2)]), 'move week 2');
    await expectMarked('schedule correction');
    await expectState('3. emptied week 2 keeps no scores or winner', {
      scores: { 1: { Alice: 4, Bob: 6 } }, weekly: { 1: 'Bob' },
      q1: 'Bob', season: { winner: 'Bob', points: 6 },
    });
    console.log('\nAll checks passed.');
  } finally {
    await cleanup();
    console.log('Cleaned up test pool and games.');
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error(`\n✗ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
