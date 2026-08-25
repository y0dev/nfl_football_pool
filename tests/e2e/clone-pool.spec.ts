import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

// ─────────────────────────────────────────────────────────────
// Clone Pool — real DB integration test against the super-admin
// clone route (/api/admin/clone-pool). clonePool()/adminClonePool()
// are Next.js Server Actions, unreachable via Playwright's `request`
// fixture directly, but the super-admin path wraps the exact same
// performClone() logic behind a real REST route — so this exercises
// the real clone behavior end-to-end.
//
// Setup/teardown seed and clean up throwaway rows directly via the
// Supabase service client, the same pattern tests/e2e/stripe-payment.spec.ts
// uses for its real-flow test.
// ─────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY!
);

const SUPER_ADMIN_EMAIL = 'superadmin@test.com';
let superAdminId: string;

test.beforeAll(async () => {
  const { data: superAdmin, error } = await supabase.from('admins').select('id').eq('email', SUPER_ADMIN_EMAIL).single();
  if (error || !superAdmin) throw new Error(`Could not find seeded super admin: ${error?.message}`);
  superAdminId = superAdmin.id;
});

test.describe('POST /api/admin/clone-pool — auth boundaries', () => {
  test('rejects requests with no session', async ({ request }) => {
    const res = await request.post('/api/admin/clone-pool', {
      data: { poolId: '00000000-0000-0000-0000-000000000000' },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('rejects a caller that is not a super admin, even for a non-existent pool', async ({ request }) => {
    // performClone() checks the caller's super-admin status BEFORE looking
    // up the pool, so an unauthorized caller always gets 403 regardless of
    // whether poolId exists — a 400 "Pool not found." here instead would
    // leak pool-existence to a caller who was never allowed to ask.
    const res = await request.post('/api/admin/clone-pool', {
      headers: { Cookie: 'sh-session=00000000-0000-0000-0000-000000000000' },
      data: { poolId: '00000000-0000-0000-0000-000000000000' },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('rejects a pool that does not exist', async ({ request }) => {
    const res = await request.post('/api/admin/clone-pool', {
      headers: { Cookie: `sh-session=${superAdminId}` },
      data: { poolId: '00000000-0000-0000-0000-000000000000' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});

test.describe('POST /api/admin/clone-pool — plan enforcement', () => {
  test('blocks cloning for a Free-plan owner (server-side, not just UI)', async ({ request }) => {
    test.setTimeout(30000);
    const ownerEmail = `e2e-clone-free-${Date.now()}@sundayhuddle.net`;
    let ownerId: string | undefined;
    let poolId: string | undefined;

    try {
      const { data: owner } = await supabase
        .from('admins')
        .insert({ email: ownerEmail, password_hash: 'google_oauth', full_name: 'E2E Free Owner', is_super_admin: false, is_active: true, plan: 'free' })
        .select('id')
        .single();
      ownerId = owner!.id;

      const { data: pool } = await supabase
        .from('pools')
        .insert({ name: 'Free Plan Pool', created_by: ownerEmail, season: 2020, is_active: true })
        .select('id')
        .single();
      poolId = pool!.id;

      const res = await request.post('/api/admin/clone-pool', {
        headers: { Cookie: `sh-session=${superAdminId}` },
        data: { poolId },
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toMatch(/standard plan/i);
    } finally {
      if (poolId) await supabase.from('pools').delete().eq('id', poolId);
      if (ownerId) await supabase.from('admins').delete().eq('id', ownerId);
    }
  });
});

test.describe('POST /api/admin/clone-pool — Standard-plan owner: full clone behavior', () => {
  test('copies settings and active participants, bumps season, excludes picks/scores', async ({ request }) => {
    test.setTimeout(30000);
    const ownerEmail = `e2e-clone-owner-${Date.now()}@sundayhuddle.net`;
    let ownerId: string | undefined;
    let huddleId: string | undefined;
    let sourcePoolId: string | undefined;
    let clonedPoolId: string | undefined;

    try {
      // ── Seed: Standard-plan commissioner, Huddle, an "old season" pool
      // with non-default settings, two active participants + one inactive
      // one, and a pick + a score row on the source pool (to prove the
      // clone excludes gameplay history).
      const { data: owner } = await supabase
        .from('admins')
        .insert({ email: ownerEmail, password_hash: 'google_oauth', full_name: 'E2E Clone Owner', is_super_admin: false, is_active: true, plan: 'standard' })
        .select('id')
        .single();
      ownerId = owner!.id;

      const { data: huddle } = await supabase
        .from('huddles')
        .insert({ name: "E2E Clone Owner's Huddle", commissioner_email: ownerEmail })
        .select('id')
        .single();
      huddleId = huddle!.id;

      const { data: sourcePool } = await supabase
        .from('pools')
        .insert({
          name: 'Legacy Season Pool',
          created_by: ownerEmail,
          season: 2020,
          huddle_id: huddleId,
          is_active: true,
          is_private: true,
          join_password: 'secret123',
          season_scope: [2],
          tie_breaker_method: 'total_score',
        })
        .select('id')
        .single();
      sourcePoolId = sourcePool!.id;

      const { data: participants } = await supabase
        .from('participants')
        .insert([
          { pool_id: sourcePoolId, name: 'Alice', email: 'alice@e2e-clone.test', is_active: true },
          { pool_id: sourcePoolId, name: 'Bob', email: 'bob@e2e-clone.test', is_active: true },
          { pool_id: sourcePoolId, name: 'Retired Carol', email: 'carol@e2e-clone.test', is_active: false },
        ])
        .select('id, name');
      const alice = participants!.find(p => p.name === 'Alice')!;

      await supabase.from('picks').insert({
        participant_id: alice.id, pool_id: sourcePoolId, game_id: null,
        predicted_winner: 'Some Team', confidence_points: 10,
      });
      await supabase.from('scores').insert({
        participant_id: alice.id, pool_id: sourcePoolId, week: 1, season: 2020, points: 10,
      });

      // ── Act: real clone via the real super-admin API route
      const res = await request.post('/api/admin/clone-pool', {
        headers: { Cookie: `sh-session=${superAdminId}` },
        data: { poolId: sourcePoolId },
      });
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.participantsCloned).toBe(2); // active participants only — Carol excluded
      clonedPoolId = body.poolId;

      // ── Assert: pool settings copied, season bumped to the current one
      const { data: clonedPool } = await supabase
        .from('pools')
        .select('*')
        .eq('id', clonedPoolId)
        .single();
      expect(clonedPool.is_private).toBe(true);
      expect(clonedPool.join_password).toBe('secret123');
      expect(clonedPool.season_scope).toEqual([2]);
      expect(clonedPool.tie_breaker_method).toBe('total_score');
      expect(clonedPool.huddle_id).toBe(huddleId);
      expect(clonedPool.season).not.toBe(2020);

      // ── Assert: only active participants copied
      const { data: clonedParticipants } = await supabase
        .from('participants')
        .select('name, email')
        .eq('pool_id', clonedPoolId);
      expect(clonedParticipants).toHaveLength(2);
      expect(clonedParticipants!.map(p => p.name).sort()).toEqual(['Alice', 'Bob']);

      // ── Assert: no picks/scores/standings carried into the new pool
      const { count: pickCount } = await supabase
        .from('picks')
        .select('*', { count: 'exact', head: true })
        .eq('pool_id', clonedPoolId);
      expect(pickCount ?? 0).toBe(0);

      const { count: scoreCount } = await supabase
        .from('scores')
        .select('*', { count: 'exact', head: true })
        .eq('pool_id', clonedPoolId);
      expect(scoreCount ?? 0).toBe(0);

      // ── Assert: the original pool is untouched
      const { data: originalPool } = await supabase
        .from('pools')
        .select('season, is_active')
        .eq('id', sourcePoolId)
        .single();
      expect(originalPool?.season).toBe(2020);
      expect(originalPool?.is_active).toBe(true);

      const { count: originalPickCount } = await supabase
        .from('picks')
        .select('*', { count: 'exact', head: true })
        .eq('pool_id', sourcePoolId);
      expect(originalPickCount).toBe(1);
    } finally {
      if (clonedPoolId) {
        await supabase.from('participants').delete().eq('pool_id', clonedPoolId);
        await supabase.from('pools').delete().eq('id', clonedPoolId);
      }
      if (sourcePoolId) {
        await supabase.from('picks').delete().eq('pool_id', sourcePoolId);
        await supabase.from('scores').delete().eq('pool_id', sourcePoolId);
        await supabase.from('participants').delete().eq('pool_id', sourcePoolId);
        await supabase.from('pools').delete().eq('id', sourcePoolId);
      }
      if (huddleId) await supabase.from('huddles').delete().eq('id', huddleId);
      if (ownerId) await supabase.from('admins').delete().eq('id', ownerId);
    }
  });
});
