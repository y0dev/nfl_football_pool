import { test, expect } from '@playwright/test';

// ─────────────────────────────────────────────────────────────
// Subscription visibility endpoints backing the dashboard's Subscription
// Summary card, the Account page's Subscription section, and the Purchases
// page (see src/lib/subscription.ts). A non-existent admin should resolve to
// safe free-plan defaults rather than error, matching /api/admin/plan-status.
// ─────────────────────────────────────────────────────────────

const NON_EXISTENT_ADMIN_ID = '00000000-0000-0000-0000-000000000000';

test.describe('GET /api/admin/subscription-summary', () => {
  test('requires adminId', async ({ request }) => {
    const res = await request.get('/api/admin/subscription-summary');
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('resolves a non-existent admin to free-plan defaults, not an error', async ({ request }) => {
    const res = await request.get(`/api/admin/subscription-summary?adminId=${NON_EXISTENT_ADMIN_ID}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.plan).toBe('free');
    expect(body.huddlesUsed).toBe(0);
    expect(body.participantsTotal).toBe(0);
    expect(body.addonPools).toBe(0);
    expect(typeof body.poolLimit).toBe('number');
    expect(typeof body.billing.stripeEnabled).toBe('boolean');
  });
});

test.describe('GET /api/admin/purchases', () => {
  test('requires adminId', async ({ request }) => {
    const res = await request.get('/api/admin/purchases');
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('returns an empty list for an admin with no purchases (also covers a missing payments table)', async ({ request }) => {
    const res = await request.get(`/api/admin/purchases?adminId=${NON_EXISTENT_ADMIN_ID}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.purchases)).toBe(true);
    expect(body.purchases.length).toBe(0);
  });
});
