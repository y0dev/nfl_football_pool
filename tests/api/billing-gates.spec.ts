import { test, expect } from '@playwright/test';

// ─────────────────────────────────────────────────────────────
// Billing gates — the Stripe routes must be safely inert until
// STRIPE_* env vars are configured (503), and validate input once
// they are (400). Both are acceptable so these tests hold across
// pre- and post-launch environments.
// ─────────────────────────────────────────────────────────────

test.describe('POST /api/stripe/checkout', () => {
  test('is gated when Stripe is unconfigured, validates input when configured', async ({ request }) => {
    const res = await request.post('/api/stripe/checkout', { data: {} });
    expect([503, 400]).toContain(res.status());
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('rejects an unknown product', async ({ request }) => {
    const res = await request.post('/api/stripe/checkout', {
      data: { adminId: '00000000-0000-0000-0000-000000000000', product: 'super-mega-plan' },
    });
    expect([503, 400]).toContain(res.status());
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});

test.describe('POST /api/stripe/webhook', () => {
  test('rejects requests without a Stripe signature', async ({ request }) => {
    const res = await request.post('/api/stripe/webhook', { data: { type: 'checkout.session.completed' } });
    expect([503, 400]).toContain(res.status());
  });
});

test.describe('POST /api/pools/join participant limits', () => {
  test('still validates required fields', async ({ request }) => {
    const res = await request.post('/api/pools/join', { data: {} });
    expect(res.status()).toBe(400);
  });

  test('returns 404 for a non-existent pool', async ({ request }) => {
    const res = await request.post('/api/pools/join', {
      data: { poolId: '00000000-0000-0000-0000-000000000000', name: 'Test', email: 'limit-test@example.com' },
    });
    expect(res.status()).toBe(404);
  });
});

test.describe('GET /api/admin/plan-status', () => {
  test('includes billing availability info', async ({ request }) => {
    const res = await request.get('/api/admin/plan-status?adminId=00000000-0000-0000-0000-000000000000');
    // Non-existent admin resolves to the free-plan defaults rather than erroring
    const body = await res.json();
    if (body.success) {
      expect(body.billing).toBeDefined();
      expect(typeof body.billing.pricingVisible).toBe('boolean');
      expect(typeof body.billing.stripeEnabled).toBe('boolean');
      expect(body.poolLimit).toBeGreaterThanOrEqual(1);
      expect(body.participantLimit).toBeGreaterThanOrEqual(15);
    } else {
      expect(res.status()).toBeGreaterThanOrEqual(400);
    }
  });
});
