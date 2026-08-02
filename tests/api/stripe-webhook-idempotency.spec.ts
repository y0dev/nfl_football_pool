import { test, expect, APIRequestContext } from '@playwright/test';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

// ─────────────────────────────────────────────────────────────
// Posts a synthetic, properly-signed checkout.session.completed event
// directly at /api/stripe/webhook — no real Stripe Checkout session needed,
// since this targets the webhook's own idempotency guard rather than the
// full purchase UI (that's tests/e2e/stripe-payment.spec.ts).
//
// Regression coverage for: the addon_pool branch does `current + quantity`,
// an increment rather than a set — without the idempotency check, Stripe
// redelivering the same event (network retry, etc.) would double-count
// purchased pools. Signs the payload with Stripe's own test-header helper:
// https://stripe.com/docs/webhooks/test
//
// Creates a real, throwaway commissioner (checkout/webhook look up a real
// admin row) and deletes it afterward. Skips if Stripe isn't configured.
// ─────────────────────────────────────────────────────────────

const TEST_PASSWORD = 'e2e-webhook-test-pw-123';

async function createTestCommissioner(request: APIRequestContext) {
  const email = `e2e-webhook-${Date.now()}@sundayhuddle.net`;
  const res = await request.post('/api/admin/create-commissioner', {
    data: { email, password: TEST_PASSWORD, fullName: 'E2E Webhook Test' },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.success).toBe(true);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY!
  );
  await supabase.from('commissioners').update({ trial_ends_at: null, plan: 'standard', addon_pools: 0 }).eq('id', body.admin.id);

  return { id: body.admin.id as string, email, supabase };
}

async function deleteTestCommissioner(request: APIRequestContext, adminId: string) {
  await request.post('/api/admin/delete-account', {
    data: { adminId, password: TEST_PASSWORD },
  });
}

function buildCheckoutCompletedEvent(adminId: string, sessionId: string) {
  return {
    id: `evt_test_${sessionId}`,
    object: 'event',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: sessionId,
        object: 'checkout.session',
        customer: 'cus_test_fixture',
        payment_intent: `pi_test_${sessionId}`,
        amount_total: 1500,
        currency: 'usd',
        metadata: { adminId, product: 'addon_pool', quantity: '1' },
      },
    },
  };
}

async function paymentRowCount(supabase: SupabaseClient, sessionId: string) {
  const { count } = await supabase
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('stripe_session_id', sessionId);
  return count ?? 0;
}

test.describe('Stripe webhook — idempotency', () => {
  test('redelivering the same checkout.session.completed event does not double-apply an addon_pool purchase', async ({ request }) => {
    test.setTimeout(30000);

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const apiKey = process.env.STRIPE_SECRET_KEY;
    test.skip(!webhookSecret || !apiKey, 'Stripe not configured — skipping webhook idempotency test');

    const admin = await createTestCommissioner(request);
    const sessionId = `cs_test_idem_${Date.now()}`;
    const payload = JSON.stringify(buildCheckoutCompletedEvent(admin.id, sessionId));
    const stripe = new Stripe(apiKey!);
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret! });

    try {
      const post = () => request.post('/api/stripe/webhook', {
        data: payload,
        headers: { 'Content-Type': 'application/json', 'stripe-signature': header },
      });

      const first = await post();
      expect(first.ok()).toBeTruthy();

      const afterFirst = await admin.supabase.from('commissioners').select('addon_pools').eq('id', admin.id).single();
      expect(afterFirst.data?.addon_pools).toBe(1);
      expect(await paymentRowCount(admin.supabase, sessionId)).toBe(1);

      // Redeliver the identical event — simulates a Stripe retry.
      const second = await post();
      expect(second.ok()).toBeTruthy();

      const afterSecond = await admin.supabase.from('commissioners').select('addon_pools').eq('id', admin.id).single();
      expect(afterSecond.data?.addon_pools).toBe(1); // not 2 — the redelivery must be a no-op
      expect(await paymentRowCount(admin.supabase, sessionId)).toBe(1); // still exactly one payment row
    } finally {
      await deleteTestCommissioner(request, admin.id);
    }
  });
});
