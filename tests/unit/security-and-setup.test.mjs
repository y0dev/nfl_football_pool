import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import ts from 'typescript';

function load(file, dependencies, processState) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, Buffer, process: processState, console: { log() {}, error() {} },
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
