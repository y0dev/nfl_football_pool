import { test, expect } from '@playwright/test';

// ─────────────────────────────────────────────────────────────
// /api/admin/week-winner — exercised directly via Playwright's request
// context against the real linked database, matching verify-admin-status.spec.ts.
// Assertions here are read-only / non-mutating on purpose (rejection paths,
// or an insert that's expected to be rejected as a duplicate) so this test
// never writes a new row into production data.
//
// Covers the bug fixed alongside this file: a client-side caller resolved
// a pool's "current week" against today's real-world NFL season instead of
// the pool's own season, then POSTed a winner under the wrong season while
// scoring the pool's real games — producing a duplicate weekly_winners row
// with the same winner/points under the wrong season year. The POST route
// now validates `season` against the pool's actual `pools.season` before
// writing.
// ─────────────────────────────────────────────────────────────

const REAL_POOL_ID = '3ebf3aa8-6fda-41ba-8ab2-d93f5b7a7b5d'; // "NFL Confidence Pool 2025", season 2025
const REAL_POOL_SEASON = 2025;

test.describe('POST /api/admin/week-winner', () => {
  test('rejects a season that does not match the pool\'s actual season', async ({ request }) => {
    const res = await request.post('/api/admin/week-winner', {
      data: {
        poolId: REAL_POOL_ID,
        week: 1,
        season: REAL_POOL_SEASON + 1, // wrong on purpose
        seasonType: 2,
        winnerName: 'Test Winner',
        winnerPoints: 100,
        winnerCorrectPicks: 10,
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/season mismatch/i);
  });

  test('returns 404 for a pool that does not exist', async ({ request }) => {
    const res = await request.post('/api/admin/week-winner', {
      data: {
        poolId: '00000000-0000-0000-0000-000000000000',
        week: 1,
        season: 2025,
        seasonType: 2,
        winnerName: 'Test Winner',
        winnerPoints: 100,
        winnerCorrectPicks: 10,
      },
    });
    expect(res.status()).toBe(404);
  });

  test('returns 409 (not 500) when a winner already exists for the correct season', async ({ request }) => {
    // Week 5 already has a stored winner for this pool/season — the correct
    // season passes validation, and the existing-winner check should reject
    // with 409 rather than silently overwriting or inserting a duplicate.
    const res = await request.post('/api/admin/week-winner', {
      data: {
        poolId: REAL_POOL_ID,
        week: 5,
        season: REAL_POOL_SEASON,
        seasonType: 2,
        winnerName: 'Should Not Be Written',
        winnerPoints: 999,
        winnerCorrectPicks: 99,
      },
    });
    expect(res.status()).toBe(409);
  });

  test('rejects a request missing required fields', async ({ request }) => {
    const res = await request.post('/api/admin/week-winner', { data: { poolId: REAL_POOL_ID } });
    expect(res.status()).toBe(400);
  });
});

test.describe('GET /api/admin/week-winner', () => {
  test('returns the existing winner for a real completed week', async ({ request }) => {
    const res = await request.get(
      `/api/admin/week-winner?poolId=${REAL_POOL_ID}&week=5&seasonType=2&season=${REAL_POOL_SEASON}`
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.winnerExists).toBe(true);
    expect(body.winner.winner_name).toBe('Jason');
  });

  test('returns winnerExists: false for a week with no stored winner', async ({ request }) => {
    const res = await request.get(
      `/api/admin/week-winner?poolId=${REAL_POOL_ID}&week=4&seasonType=2&season=${REAL_POOL_SEASON}`
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.winnerExists).toBe(false);
  });

  test('rejects a request missing required query params', async ({ request }) => {
    const res = await request.get(`/api/admin/week-winner?poolId=${REAL_POOL_ID}`);
    expect(res.status()).toBe(400);
  });
});
