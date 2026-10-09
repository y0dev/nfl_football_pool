import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import ts from 'typescript';

function load(file, dependencies, processState, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { ...globals, exports, Buffer, process: processState, console: { log() {}, error() {} },
    require(name) { if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`); return dependencies[name]; },
  });
  return exports;
}
const state = { env: { SESSION_SECRET: 'unit-test-signing-key' } };
const session = load('src/lib/session.ts', { 'node:crypto': crypto, 'next/headers': {} }, state);

test('signed sessions round-trip; raw IDs, tampering, expiry and wrong keys fail', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const token = session.createSessionToken(id, 1000);
  assert.equal(session.verifySessionToken(token, 1001), id);
  assert.equal(session.verifySessionToken(id, 1001), null);
  assert.equal(session.verifySessionToken(token + '.extra', 1001), null);
  assert.equal(session.verifySessionToken('x' + token, 1001), null);
  assert.equal(session.verifySessionToken(token, 1000 + session.SESSION_MAX_AGE * 1000), null);
  const other = load('src/lib/session.ts', { 'node:crypto': crypto, 'next/headers': {} }, { env: { SESSION_SECRET: 'other-key' } });
  assert.equal(other.verifySessionToken(token, 1001), null);
});

test('missing signing key fails closed and cannot issue sessions', () => {
  const missing = load('src/lib/session.ts', { 'node:crypto': crypto, 'next/headers': {} }, { env: {} });
  assert.equal(missing.verifySessionToken(session.createSessionToken('admin')), null);
  assert.throws(() => missing.createSessionToken('admin'), /required/);
});

test('forged raw-ID cookie fails admin and ownership guards before DB lookup', async () => {
  let lookups = 0;
  const accounts = load('src/lib/accounts.ts', {
    '@/lib/session': session,
    './supabase-service': { getSupabaseServiceClient() { lookups++; throw new Error('must not query'); } },
    'next/server': { NextResponse: { json: (body, options) => ({ body, ...options }) } },
    'next/headers': { cookies: async () => ({ get: () => ({ value: 'victim-id' }) }) },
  }, state);
  const request = { cookies: { get: () => ({ value: 'victim-id' }) } };
  assert.equal(accounts.callerOwnsAccount(request, 'victim-id'), false);
  assert.equal((await accounts.requireSuperAdmin(request)).ok, false);
  assert.equal((await accounts.requireActionCallerOwnsPool('pool')).ok, false);
  assert.equal(lookups, 0);
});

test('cookie issuer is not exposed as a Server Action', () => {
  const source = fs.readFileSync('src/actions/sessionCookie.ts', 'utf8');
  assert.doesNotMatch(source, /export.*setSessionCookie/);
  assert.doesNotMatch(fs.readFileSync('src/lib/session.ts', 'utf8'), /['"]use server['"]/);
});

for (const mode of ['success', 'rpc-error', 'exception']) {
  test(`database setup exit status: ${mode}`, async () => {
    const processState = { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'test-only' } };
    let calls = 0;
    load('scripts/setup-database.ts', {
      '@supabase/supabase-js': { createClient: () => ({ rpc: async () => {
        calls++;
        if (mode === 'exception') throw new Error('connection failed');
        return { error: mode === 'rpc-error' ? { message: 'SQL RPC unavailable' } : null };
      } }) },
      dotenv: { default: { config() {} } },
      '../src/lib/supabase': new Proxy({}, { get: () => 'SELECT 1;' }),
    }, processState);
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(calls > 0);
    assert.equal(processState.exitCode ?? 0, mode === 'success' ? 0 : 1);
  });
}

test('link redemption atomically rejects concurrent consumers and preserves password on replay', async () => {
  let timestamp = null;
  let storedPassword = 'old';
  const client = { from() {
    let expected;
    let patch;
    return { update(value) { patch = value; return this; }, eq(key, value) { if (key === 'updated_at') expected = value; return this; },
      is(key, value) { expected = value; return this; }, select() { return this; },
      async maybeSingle() {
        if (timestamp !== expected) return { data: null, error: null };
        timestamp = patch.updated_at;
        storedPassword = patch.password_hash ?? storedPassword;
        return { data: { id: 'account' }, error: null };
      },
    };
  } };
  const accounts = load('src/lib/accounts.ts', { '@/lib/session': session,
    './supabase-service': { getSupabaseServiceClient: () => client }, 'next/server': {}, 'next/headers': {},
  }, state);
  const results = await Promise.all([
    accounts.redeemAccountLink('account', 'commissioner', null, { password_hash: 'first' }),
    accounts.redeemAccountLink('account', 'commissioner', null, { password_hash: 'second' }),
  ]);
  assert.equal(results.filter(r => r.redeemed).length, 1);
  assert.equal(storedPassword, 'first');
  assert.equal((await accounts.redeemAccountLink('account', 'commissioner', null)).redeemed, false);
  assert.equal((await accounts.redeemAccountLink('account', 'commissioner', timestamp)).redeemed, true);
});

test('finished quarters and legacy statuses are complete; missing/live weeks are not', () => {
  const game = load('src/types/game.ts', {}, state);
  const display = load('src/lib/period-display.ts', { '@/types/game': game }, state);
  assert.equal(display.isWeekComplete([{ status: 'finished' }, { status: 'Final' }, { status: 'post' }]), true);
  assert.equal(display.isWeekComplete([]), false);
  assert.equal(display.isWeekComplete([{ status: 'finished' }, { status: 'live' }]), false);
  assert.equal(display.isWeekComplete([{ status: 'scheduled' }]), false);
});

test('points chart keeps same-name participants separate and respects selection', () => {
  const display = load('src/lib/period-display.ts', { '@/types/game': load('src/types/game.ts', {}, state) }, state);
  const entries = [
    { participant_id: 'a', name: 'Pat J.', weekly_scores: [{ week: 1, points: 12 }] },
    { participant_id: 'b', name: 'Pat J.', weekly_scores: [{ week: 1, points: 8 }] },
  ];
  const rows = display.periodChartData(entries, [1, 2], ['a', 'b']);
  assert.equal(rows[0].a, 12); assert.equal(rows[0].b, 8); assert.equal(rows[1].a, 0);
  assert.equal('b' in display.periodChartData(entries, [1], ['a'])[0], false);
});

test('magic-link action accepts a token once and rejects legacy, expired and concurrent replays', async () => {
  let updatedAt = null;
  let sessions = 0;
  const signingKey = 'test-only-magic-key';
  const account = { role: 'commissioner', row: { id: 'a', email: 'test@example.invalid', is_active: true, updated_at: null } };
  const action = load('src/actions/magicLink.ts', {
    crypto, '@/lib/accounts': { findAccountByEmail: async () => account,
      redeemAccountLink: async (_id, _role, expected) => {
        if (expected !== updatedAt) return { redeemed: false, error: null };
        updatedAt = 'consumed'; return { redeemed: true, error: null };
      } },
    '@/lib/session': { setSessionCookie: async () => { sessions++; } },
    '@/lib/rate-limit': {}, '@/lib/utils': { debugError() {} },
  }, { env: { SUPABASE_SERVICE_ROLE_KEY: signingKey } });
  function sign(payload) { const encoded = Buffer.from(payload).toString('base64url');
    return encoded + '.' + crypto.createHmac('sha256', signingKey).update(encoded).digest('base64url'); }
  const token = sign(JSON.stringify({ purpose: 'magic', email: account.row.email, expiresAt: Date.now() + 60000, updatedAt: null }));
  const results = await Promise.all([action.verifyMagicLink(token), action.verifyMagicLink(token)]);
  assert.equal(results.filter(r => r.success).length, 1);
  assert.equal(sessions, 1);
  assert.equal((await action.verifyMagicLink(token)).success, false);
  assert.equal((await action.verifyMagicLink(sign(account.row.email + '::' + (Date.now() + 60000)))).success, false);
  const expired = sign(JSON.stringify({ purpose: 'magic', email: account.row.email, expiresAt: Date.now() - 1, updatedAt: null }));
  assert.equal((await action.verifyMagicLink(expired)).expired, true);
});

test('password-reset action allows only one concurrent password write', async () => {
  let consumed = false;
  let writes = 0;
  const key = 'test-only-reset-key';
  const account = { role: 'commissioner', row: { id: 'a', email: 'test@example.invalid', is_active: true, updated_at: null } };
  const action = load('src/actions/passwordReset.ts', {
    crypto, '@/lib/accounts': { findAccountByEmail: async () => account, findAccountById: async () => null,
      redeemAccountLink: async () => { if (consumed) return { redeemed: false, error: null }; consumed = true; writes++; return { redeemed: true, error: null }; } },
    '@/lib/supabase-service': { getSupabaseServiceClient: () => ({ auth: { admin: { updateUserById: async () => ({}) } } }) },
    '@/lib/rate-limit': {}, '@/lib/utils': { debugError() {} }, bcryptjs: { default: { hash: async () => 'test-hash' } },
  }, { env: { SUPABASE_SERVICE_ROLE_KEY: key } });
  const payload = Buffer.from(`reset::${account.row.email}::${Date.now() + 60000}::`).toString('base64url');
  const token = payload + '.' + crypto.createHmac('sha256', key).update(payload).digest('base64url');
  const results = await Promise.all([action.resetPasswordWithToken(token, 'password-one'), action.resetPasswordWithToken(token, 'password-two')]);
  assert.equal(results.filter(r => r.success).length, 1); assert.equal(writes, 1);
});

test('regular-season period API returns chart scores and pick counts limited to that quarter', async () => {
  const review = { periodTotals: [{ period_name: 'Q1', participant_id: 'a', participant_name: 'Alex', points: 42, correct: 6, weeks_won: 1 }],
    quarterlyWinners: [], weeklyWinners: [], weeklyScores: [
      { participant_id: 'a', week: 1, points: 30, correct: 4, total: 8 },
      { participant_id: 'a', week: 2, points: 12, correct: 2, total: 8 },
      { participant_id: 'a', week: 5, points: 99, correct: 9, total: 16 },
      { participant_id: 'b', week: 1, points: 7, correct: 1, total: 8 },
    ] };
  const query = { select() { return this; }, eq() { return this; }, in: async () => ({ data: [] }) };
  const route = load('src/app/api/periods/leaderboard/route.ts', {
    'next/server': { NextResponse: { json: value => value } },
    '@/lib/supabase-service': { getSupabaseServiceClient: () => ({ from: () => query }) },
    '@/lib/utils': { getRegularSeasonPeriods: () => [{ name: 'Q1', weeks: [1, 2, 3, 4] }], debugLog() {}, debugError() {} },
    '@/lib/playoff-utils': {}, '@/lib/season-review': { computeSeasonReview: async () => review },
    '@/types/game': {}, '@/lib/pool-access': { checkPoolAccessFromRequest: async () => ({ allowed: true }) },
  }, state, { URL });
  const response = await route.GET({ url: 'http://localhost/api/periods/leaderboard?poolId=p&season=2026&periodName=Q1' });
  const entry = response.data.leaderboard[0];
  assert.equal(entry.total_picks, 16);
  assert.equal(entry.weekly_scores.length, 2);
  assert.equal(entry.weekly_scores[0].points, 30);
  assert.equal(entry.weekly_scores[1].points, 12);
});

function periodPageHarness(fetchImpl, loading = true) {
  const effects = [], updates = [], rendered = [], authCalls = [], navigations = [];
  let stateIndex = 0;
  const jsx = (type, props) => { rendered.push({ type, props }); return { type, props }; };
  const appNav = () => null;
  const page = load('src/app/periods/[poolId]/[season]/[periodName]/page.tsx', {
    react: { useState: initial => { const index = stateIndex++; return [index === 7 ? loading : initial, value => updates.push({ index, value })]; }, useEffect: fn => effects.push(fn) },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'next/navigation': { useParams: () => ({ poolId: 'p', season: '2026', periodName: '1' }), useRouter: () => ({ push: path => navigations.push(path) }), useSearchParams: () => ({ get: () => null }) },
    'lucide-react': {}, '@/hooks/use-toast': { useToast: () => ({ toast() {} }) },
    '@/lib/utils': { debugLog() {}, debugError() {}, debugWarn() {} }, recharts: {},
    '@/lib/period-display': { isWeekComplete: () => false, periodChartData: () => [] }, '@/types/game': {},
    '@/lib/auth': { useAuth: () => ({ signOut: async () => authCalls.push('logout') }) },
    '@/lib/supabase': { getSupabaseClient: () => ({ auth: { signOut: async () => { throw Error('optional provider unavailable'); } } }) },
    '@/components/layout/AppNav': { AppNav: appNav },
  }, { env: { NODE_ENV: 'production' } }, { fetch: fetchImpl, AbortController });
  page.default();
  return { effects, updates, authCalls, navigations, nav: rendered.find(node => node.type === appNav) };
}

test('failed period load clears old winner, standings, games and completion state', async () => {
  const h = periodPageHarness(async () => { throw Error('network failure'); });
  h.effects[1](); // data loading, after admin verification effect
  await new Promise(resolve => setImmediate(resolve));
  for (const index of [2, 5, 11]) assert.ok(h.updates.some(u => u.index === index && u.value === null));
  for (const index of [3, 4, 10]) assert.ok(h.updates.some(u => u.index === index && Array.isArray(u.value) && !u.value.length));
  assert.ok(h.updates.some(u => u.index === 9 && u.value === false));
  assert.ok(h.updates.some(u => u.index === 7 && u.value === false));
});

test('cancelled period request cannot restore obsolete results', async () => {
  const pending = [];
  const h = periodPageHarness(() => new Promise(resolve => { pending.push(resolve); }));
  const cleanup = h.effects[1]();
  cleanup();
  const before = h.updates.length;
  pending.forEach(resolve => resolve({ json: async () => ({ success: true, data: { leaderboard: [{ name: 'old' }] } }) }));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.updates.length, before);
});

test('period sign-out clears app auth and redirects even if Supabase sign-out fails', async () => {
  const h = periodPageHarness(async () => {}, false);
  assert.ok(h.nav);
  await h.nav.props.onSignOut();
  assert.deepEqual(h.authCalls, ['logout']);
  assert.deepEqual(h.navigations, ['/login']);
});
