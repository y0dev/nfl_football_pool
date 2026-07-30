import { test, expect } from '@playwright/test';

// ─────────────────────────────────────────────────────────────
// Covers things introduced in this pass:
// 1. Free/Standard plans now allow 2 base pools per League (was 1) —
//    see src/lib/plan.ts LIMITS.
// 2. /api/admin/all-pools must reject callers without a verified
//    super-admin x-admin-email header — this was previously wide open
//    (any pool, any commissioner, no auth check at all).
// 3. Plan status now also reports a huddleLimit (Free: 1, Standard: 3) —
//    groundwork for a commissioner running more than one Huddle.
//
// The League/roster server actions themselves (src/actions/huddles.ts,
// src/actions/huddleMembers.ts) are Next.js Server Actions, not REST
// routes, so they aren't reachable via Playwright's `request` fixture
// the way these are — they'd need a real authenticated browser session,
// which this suite doesn't currently have a helper for. Not covered here.
// ─────────────────────────────────────────────────────────────

test.describe('GET /api/admin/plan-status — pool limits', () => {
  test('unknown admin resolves to free-plan defaults with the new 2-pool base limit', async ({ request }) => {
    const res = await request.get('/api/admin/plan-status?adminId=00000000-0000-0000-0000-000000000000');
    const body = await res.json();
    if (body.success) {
      expect(body.poolLimit).toBe(2);
      expect(body.participantLimit).toBe(15);
      expect(body.huddleLimit).toBe(1);
    } else {
      expect(res.status()).toBeGreaterThanOrEqual(400);
    }
  });
});

test.describe('GET /api/admin/all-pools — super-admin only', () => {
  test('rejects requests with no x-admin-email header', async ({ request }) => {
    const res = await request.get('/api/admin/all-pools');
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('rejects a caller that is not a super admin (or does not exist)', async ({ request }) => {
    const res = await request.get('/api/admin/all-pools', {
      headers: { 'x-admin-email': 'not-a-real-admin@example.com' },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});

// /api/admin/transfer-pool previously had NO auth check at all — any caller
// could move any pool to any commissioner. Now super-admin only, same
// x-admin-email pattern as /api/admin/all-pools above.
test.describe('POST /api/admin/transfer-pool — super-admin only', () => {
  test('rejects requests with no x-admin-email header', async ({ request }) => {
    const res = await request.post('/api/admin/transfer-pool', {
      data: { poolId: '00000000-0000-0000-0000-000000000000', newCommissionerEmail: 'someone@example.com' },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('rejects a caller that is not a super admin (or does not exist)', async ({ request }) => {
    const res = await request.post('/api/admin/transfer-pool', {
      headers: { 'x-admin-email': 'not-a-real-admin@example.com' },
      data: { poolId: '00000000-0000-0000-0000-000000000000', newCommissionerEmail: 'someone@example.com' },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});
