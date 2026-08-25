import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

// ─────────────────────────────────────────────────────────────
// Manual NFL Data Sync — preview/approval workflow
// (src/app/api/admin/nfl-sync/{preview,apply,status}/route.ts,
// src/lib/nfl-sync.ts, src/app/admin/nfl-sync/page.tsx).
//
// /preview calls the real ESPN API, so its exact game counts aren't
// deterministic day to day — those assertions here only check response
// shape. The security- and correctness-critical pieces (auth boundaries,
// apply-only-approved, staleness detection, idempotency) are tested by
// seeding nfl_sync_runs/nfl_sync_proposed_changes rows directly and
// calling /apply, which doesn't depend on live provider data at all.
// ─────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY!
);

const SUPER_ADMIN_EMAIL = 'superadmin@test.com';
const COMMISSIONER_EMAIL = 'pooladmin@test.com';
let superAdminId: string;
let commissionerId: string;

test.beforeAll(async () => {
  const { data: superAdmin, error: superAdminError } = await supabase.from('admins').select('id').eq('email', SUPER_ADMIN_EMAIL).single();
  if (superAdminError || !superAdmin) throw new Error(`Could not find seeded super admin: ${superAdminError?.message}`);
  superAdminId = superAdmin.id;

  const { data: commissioner, error: commissionerError } = await supabase.from('commissioners').select('id').eq('email', COMMISSIONER_EMAIL).single();
  if (commissionerError || !commissioner) throw new Error(`Could not find seeded commissioner: ${commissionerError?.message}`);
  commissionerId = commissioner.id;
});

async function seedRun(overrides: Record<string, unknown> = {}) {
  const { data, error } = await supabase
    .from('nfl_sync_runs')
    .insert({
      requested_by: SUPER_ADMIN_EMAIL,
      season: 2099,
      season_type: 2,
      week: 1,
      status: 'pending_review',
      games_checked: 1,
      new_count: 0,
      updated_count: 1,
      unchanged_count: 0,
      ...overrides,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`seed run failed: ${error?.message}`);
  return data.id;
}

async function seedGame(id: string, overrides: Record<string, unknown> = {}) {
  const { error } = await supabase.from('games').insert({
    id,
    week: 1,
    season: 2099,
    season_type: 2,
    home_team: 'Test Home',
    away_team: 'Test Away',
    kickoff_time: '2099-09-07T20:00:00Z',
    status: 'scheduled',
    home_score: null,
    away_score: null,
    home_team_id: 'THM',
    away_team_id: 'TAW',
    is_active: true,
    ...overrides,
  });
  if (error) throw new Error(`seed game failed: ${error.message}`);
}

async function seedProposedChange(runId: string, gameId: string, opts: {
  changeType?: 'new' | 'updated';
  baseSnapshot?: Record<string, unknown> | null;
  proposedPayload?: Record<string, unknown>;
}) {
  const { data, error } = await supabase
    .from('nfl_sync_proposed_changes')
    .insert({
      sync_run_id: runId,
      external_game_id: gameId,
      change_type: opts.changeType ?? 'updated',
      field_diffs: { status: { old: 'scheduled', new: 'live' } },
      proposed_payload: opts.proposedPayload ?? {
        id: gameId, week: 1, season: 2099, season_type: 2,
        home_team: 'Test Home', away_team: 'Test Away',
        kickoff_time: '2099-09-07T20:00:00Z', status: 'live',
        home_score: 7, away_score: 0, winner: null,
        home_team_id: 'THM', away_team_id: 'TAW', is_active: true,
      },
      base_snapshot: opts.baseSnapshot === undefined
        ? { kickoff_time: '2099-09-07T20:00:00Z', home_score: null, away_score: null, winner: null, status: 'scheduled', home_team: 'Test Home', away_team: 'Test Away', home_team_id: 'THM', away_team_id: 'TAW' }
        : opts.baseSnapshot,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`seed proposed change failed: ${error?.message}`);
  return data.id;
}

async function cleanupRun(runId: string) {
  await supabase.from('nfl_sync_proposed_changes').delete().eq('sync_run_id', runId);
  await supabase.from('nfl_sync_runs').delete().eq('id', runId);
}

async function cleanupGame(id: string) {
  await supabase.from('games').delete().eq('id', id);
}

test.describe('NFL Sync — server-side authorization', () => {
  const cases: { name: string; method: 'GET' | 'POST'; url: string; data?: object }[] = [
    { name: 'POST preview', method: 'POST', url: '/api/admin/nfl-sync/preview', data: {} },
    { name: 'POST apply', method: 'POST', url: '/api/admin/nfl-sync/apply', data: { runId: '00000000-0000-0000-0000-000000000000' } },
    { name: 'GET status', method: 'GET', url: '/api/admin/nfl-sync/status' },
    { name: 'POST team-records sync', method: 'POST', url: '/api/admin/nfl-sync', data: {} },
    { name: 'POST season-games/generate', method: 'POST', url: '/api/admin/season-games/generate', data: { weekStart: '20260101', weekEnd: '20260102' } },
    { name: 'POST season-games/submit', method: 'POST', url: '/api/admin/season-games/submit', data: { games: [] } },
    { name: 'POST season-games/rollback', method: 'POST', url: '/api/admin/season-games/rollback', data: { season: 2099 } },
  ];

  for (const c of cases) {
    test(`${c.name} rejects with no session`, async ({ request }) => {
      const res = c.method === 'GET' ? await request.get(c.url) : await request.post(c.url, { data: c.data });
      expect(res.status()).toBe(401);
    });

    test(`${c.name} rejects a commissioner caller`, async ({ request }) => {
      const headers = { Cookie: `sh-session=${commissionerId}` };
      const res = c.method === 'GET' ? await request.get(c.url, { headers }) : await request.post(c.url, { data: c.data, headers });
      expect(res.status()).toBe(403);
    });
  }
});

test.describe('POST /api/admin/nfl-sync/preview — real ESPN data (shape only, not exact counts)', () => {
  test('returns a well-formed preview for the current week', async ({ request }) => {
    const res = await request.post('/api/admin/nfl-sync/preview', {
      headers: { Cookie: `sh-session=${superAdminId}` },
      data: { date: new Date().toISOString() },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    if (body.runId) {
      expect(typeof body.summary.gamesChecked).toBe('number');
      expect(Array.isArray(body.changes)).toBe(true);
      // Idempotency: never returns duplicate proposals for the same external game id
      const ids = body.changes.map((c: { externalGameId: string }) => c.externalGameId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

test.describe('POST /api/admin/nfl-sync/apply — approval, rejection, staleness', () => {
  test('applies only approved changes, leaves rejected ones untouched', async ({ request }) => {
    const gameA = `e2e-apply-a-${Date.now()}`;
    const gameB = `e2e-apply-b-${Date.now()}`;
    await seedGame(gameA);
    await seedGame(gameB);
    const runId = await seedRun({ updated_count: 2 });
    const changeAId = await seedProposedChange(runId, gameA, {});
    const changeBId = await seedProposedChange(runId, gameB, {});

    try {
      const res = await request.post('/api/admin/nfl-sync/apply', {
        headers: { Cookie: `sh-session=${superAdminId}` },
        data: { runId, decisions: { [changeAId]: 'approved', [changeBId]: 'rejected' } },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.appliedCount).toBe(1);
      expect(body.rejectedCount).toBe(1);
      expect(body.staleCount).toBe(0);

      const { data: rowA } = await supabase.from('games').select('status').eq('id', gameA).single();
      expect(rowA?.status).toBe('live'); // proposed_payload's status

      const { data: rowB } = await supabase.from('games').select('status').eq('id', gameB).single();
      expect(rowB?.status).toBe('scheduled'); // untouched
    } finally {
      await cleanupRun(runId);
      await cleanupGame(gameA);
      await cleanupGame(gameB);
    }
  });

  test('refuses to apply a stale change — database moved since the preview was generated', async ({ request }) => {
    const gameId = `e2e-stale-${Date.now()}`;
    await seedGame(gameId);
    const runId = await seedRun();
    const changeId = await seedProposedChange(runId, gameId, {});

    // Simulate "another sync/update occurred" between preview and approval
    await supabase.from('games').update({ status: 'finished', home_score: 24, away_score: 21 }).eq('id', gameId);

    try {
      const res = await request.post('/api/admin/nfl-sync/apply', {
        headers: { Cookie: `sh-session=${superAdminId}` },
        data: { runId, decisions: { [changeId]: 'approved' } },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.appliedCount).toBe(0);
      expect(body.staleCount).toBe(1);
      expect(body.staleChanges).toContain(gameId);

      // The out-of-band update must survive untouched — not overwritten by the stale proposal
      const { data: row } = await supabase.from('games').select('status, home_score, away_score').eq('id', gameId).single();
      expect(row?.status).toBe('finished');
      expect(row?.home_score).toBe(24);
    } finally {
      await cleanupRun(runId);
      await cleanupGame(gameId);
    }
  });

  test('a new-game proposal is stale if the game now already exists', async ({ request }) => {
    const gameId = `e2e-stale-new-${Date.now()}`;
    const runId = await seedRun({ new_count: 1, updated_count: 0 });
    const changeId = await seedProposedChange(runId, gameId, {
      changeType: 'new',
      baseSnapshot: null,
      proposedPayload: {
        id: gameId, week: 1, season: 2099, season_type: 2,
        home_team: 'Test Home', away_team: 'Test Away',
        kickoff_time: '2099-09-07T20:00:00Z', status: 'scheduled',
        home_score: null, away_score: null, winner: null,
        home_team_id: 'THM', away_team_id: 'TAW', is_active: true,
      },
    });

    // Someone else already created this game between preview and approval
    await seedGame(gameId);

    try {
      const res = await request.post('/api/admin/nfl-sync/apply', {
        headers: { Cookie: `sh-session=${superAdminId}` },
        data: { runId, decisions: { [changeId]: 'approved' } },
      });
      const body = await res.json();
      expect(body.appliedCount).toBe(0);
      expect(body.staleCount).toBe(1);
    } finally {
      await cleanupRun(runId);
      await cleanupGame(gameId);
    }
  });

  test('rejects applying a run that was already applied', async ({ request }) => {
    const runId = await seedRun({ status: 'applied' });
    try {
      const res = await request.post('/api/admin/nfl-sync/apply', {
        headers: { Cookie: `sh-session=${superAdminId}` },
        data: { runId, approveAll: true },
      });
      expect(res.status()).toBe(409);
    } finally {
      await cleanupRun(runId);
    }
  });

  test('returns 404 for an unknown run id', async ({ request }) => {
    const res = await request.post('/api/admin/nfl-sync/apply', {
      headers: { Cookie: `sh-session=${superAdminId}` },
      data: { runId: '00000000-0000-0000-0000-000000000000', approveAll: true },
    });
    expect(res.status()).toBe(404);
  });
});

test.describe('POST /api/admin/season-games/rollback — protects real participant data', () => {
  test('refuses to delete games that already have picks', async ({ request }) => {
    const gameId = `e2e-rollback-guard-${Date.now()}`;
    await seedGame(gameId, { season: 2098, season_type: 2, week: 1 });

    const { data: pool } = await supabase.from('pools').insert({ name: 'E2E Rollback Guard Pool', created_by: 'e2e-rollback@sundayhuddle.test', season: 2098, is_active: true }).select('id').single();
    const { data: participant } = await supabase.from('participants').insert({ pool_id: pool!.id, name: 'E2E Participant', is_active: true }).select('id').single();
    await supabase.from('picks').insert({ participant_id: participant!.id, pool_id: pool!.id, game_id: gameId, predicted_winner: 'Test Home', confidence_points: 1 });

    try {
      const res = await request.post('/api/admin/season-games/rollback', {
        headers: { Cookie: `sh-session=${superAdminId}` },
        data: { season: 2098, seasonType: 2, week: 1 },
      });
      expect(res.status()).toBe(409);

      const { data: stillThere } = await supabase.from('games').select('id').eq('id', gameId).maybeSingle();
      expect(stillThere).not.toBeNull();
    } finally {
      await supabase.from('picks').delete().eq('pool_id', pool!.id);
      await supabase.from('participants').delete().eq('pool_id', pool!.id);
      await supabase.from('pools').delete().eq('id', pool!.id);
      await cleanupGame(gameId);
    }
  });

  test('allows rollback when no picks exist', async ({ request }) => {
    const gameId = `e2e-rollback-ok-${Date.now()}`;
    await seedGame(gameId, { season: 2097, season_type: 2, week: 1 });

    const res = await request.post('/api/admin/season-games/rollback', {
      headers: { Cookie: `sh-session=${superAdminId}` },
      data: { season: 2097, seasonType: 2, week: 1 },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.gamesDeleted).toBe(1);

    const { data: gone } = await supabase.from('games').select('id').eq('id', gameId).maybeSingle();
    expect(gone).toBeNull();
  });
});
