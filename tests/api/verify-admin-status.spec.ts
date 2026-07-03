import { test, expect } from '@playwright/test';

// ─────────────────────────────────────────────────────────────
// /api/admin/verify-status — server-only admin status lookup.
// Exercised directly via Playwright's request context (no browser,
// no seeded session) since this route must work without ever
// touching the Supabase service client from client-side code.
// ─────────────────────────────────────────────────────────────

test.describe('GET /api/admin/verify-status', () => {
  test('returns 400 when adminId is missing', async ({ request }) => {
    const res = await request.get('/api/admin/verify-status');
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('returns isAdmin: false for a non-existent adminId', async ({ request }) => {
    const res = await request.get('/api/admin/verify-status?adminId=00000000-0000-0000-0000-000000000000');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true, isAdmin: false, isSuperAdmin: false });
  });
});
