import { test, expect } from '@playwright/test';

// ─────────────────────────────────────────────────────────────
// Reminder routes: send-reminders requires an authenticated
// admin caller; urgent-reminders is cron-secret gated only in
// production (dev allows it, so no assertion on it here beyond
// the route existing — exercising it could send real email).
// ─────────────────────────────────────────────────────────────

test.describe('POST /api/admin/send-reminders', () => {
  test('rejects calls without an admin identity header', async ({ request }) => {
    const res = await request.post('/api/admin/send-reminders', {
      data: { participantIds: ['00000000-0000-0000-0000-000000000000'], week: 1, seasonType: 2 },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('rejects calls from an unknown admin email', async ({ request }) => {
    const res = await request.post('/api/admin/send-reminders', {
      headers: { 'x-admin-email': 'not-a-real-admin@nowhere-real.net' },
      data: { participantIds: ['00000000-0000-0000-0000-000000000000'], week: 1, seasonType: 2 },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});
