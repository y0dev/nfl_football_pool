import { test, expect, APIRequestContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

// ─────────────────────────────────────────────────────────────
// Stripe payment E2E — exercises the real purchase flow against
// a Stripe *sandbox* (test mode): /upgrade -> Stripe-hosted
// Checkout -> webhook -> plan flips in the DB.
//
// Requires (local dev only):
//   - STRIPE_* env vars set to sandbox/test values in .env.local
//   - `stripe listen --forward-to localhost:3000/api/stripe/webhook`
//     running so the webhook actually reaches this machine
//
// Creates a real, throwaway commissioner account for the purchase
// (checkout looks up a real admin row) and deletes it afterward.
// Skips entirely if Stripe isn't configured, so this stays safe to
// leave in the suite pre-launch.
//
// /api/admin/create-commissioner rate-limits to 5 registrations/IP/hour.
// The default `npm run test` runs every project (chromium, firefox,
// webkit, Mobile Chrome, Mobile Safari), which would burn 1 registration
// per project and risk tripping that limit alongside other suites. Run
// this file in isolation when iterating:
//   npx playwright test tests/e2e/stripe-payment.spec.ts --project=chromium
// ─────────────────────────────────────────────────────────────

const TEST_PASSWORD = 'e2e-stripe-test-pw-123';

async function createTestCommissioner(request: APIRequestContext) {
  const email = `e2e-billing-${Date.now()}@sundayhuddle.net`;
  const res = await request.post('/api/admin/create-commissioner', {
    data: { email, password: TEST_PASSWORD, fullName: 'E2E Billing Test' },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.success).toBe(true);

  // New commissioners start on a 14-day Standard trial (plan='free' with
  // trial_ends_at set), which hides the upgrade button since they already
  // have Standard access. /api/admin/downgrade-plan won't clear it — it
  // exits early because plan is already 'free' — so clear it directly.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY!
  );
  await supabase.from('admins').update({ trial_ends_at: null }).eq('id', body.admin.id);

  return { id: body.admin.id as string, email };
}

async function deleteTestCommissioner(request: APIRequestContext, adminId: string) {
  await request.post('/api/admin/delete-account', {
    data: { adminId, password: TEST_PASSWORD },
  });
}

async function isStripeSandboxConfigured(request: APIRequestContext) {
  const res = await request.get('/api/admin/plan-status?adminId=00000000-0000-0000-0000-000000000000');
  const body = await res.json();
  return body?.billing?.stripeEnabled === true;
}

test.describe('Stripe Checkout — full purchase flow (sandbox)', () => {
  test('purchasing Standard flips the plan via the real webhook', async ({ page, request }) => {
    test.setTimeout(90000);
    test.skip(!(await isStripeSandboxConfigured(request)), 'Stripe not configured — skipping payment E2E');

    const admin = await createTestCommissioner(request);

    try {
      // Seed the client-side session the same way tests/e2e/auth.spec.ts does
      // for gated pages — avoids driving the login form for an unrelated flow.
      await page.goto('/login');
      await page.evaluate((a) => {
        localStorage.setItem('nfl-pool-user', JSON.stringify({
          id: a.id,
          email: a.email,
          full_name: 'E2E Billing Test',
          is_super_admin: false,
        }));
      }, admin);

      await page.goto('/upgrade');
      await page.getByRole('button', { name: /upgrade to standard/i }).click();

      // Real redirect to Stripe's hosted Checkout page (sandbox/test mode)
      await page.waitForURL(/checkout\.stripe\.com/, { timeout: 15000 });

      // Checkout shows a payment-method picker; "Card" must be selected
      // before the card number/expiry/cvc fields render. A hover-only
      // "Pay with card" button overlays the radio and intercepts normal
      // clicks, so force past it.
      await page.getByRole('radio', { name: 'Card' }).click({ force: true, timeout: 10000 });

      // Stripe surfaces this for agent-driven checkouts — this literally is
      // one, so the honest answer is to check it. It sits off-screen near
      // the footer, so drive it via a native DOM click rather than
      // Playwright's viewport-bound check().
      const aiAgentCheckbox = page.getByRole('checkbox', { name: /AI agent acting on behalf/i });
      if (await aiAgentCheckbox.count().then(c => c > 0).catch(() => false)) {
        await aiAgentCheckbox.evaluate((el: HTMLInputElement) => el.click());
      }

      // Skip Link's "save info" — it pulls in a phone-number requirement
      // that's irrelevant to verifying the purchase flow.
      const saveInfoCheckbox = page.getByRole('checkbox', { name: /save my information/i });
      if (await saveInfoCheckbox.isChecked({ timeout: 3000 }).catch(() => false)) {
        await saveInfoCheckbox.evaluate((el: HTMLInputElement) => el.click());
      }

      await page.getByRole('textbox', { name: 'Card number' }).fill('4242424242424242', { timeout: 8000 });
      await page.getByRole('textbox', { name: 'Expiration' }).fill('12/34', { timeout: 8000 });
      await page.getByRole('textbox', { name: 'CVC' }).fill('123', { timeout: 8000 });

      const nameInput = page.getByRole('textbox', { name: 'Cardholder name' });
      if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nameInput.fill('E2E Billing Test', { timeout: 5000 });
      }
      const zipInput = page.getByRole('textbox', { name: 'ZIP' });
      if (await zipInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await zipInput.fill('10001', { timeout: 5000 });
      }

      await page.getByTestId('hosted-payment-submit-button').click({ timeout: 10000 });

      // Back on our success page — the webhook is the source of truth for the
      // plan change, the redirect only shows a toast. The toast auto-dismisses
      // quickly and its exact timing isn't the point, so this check is
      // best-effort; the plan-status poll below is the real assertion.
      await page.waitForURL(/\/upgrade\?checkout=success/, { timeout: 30000 });
      await page.locator('text=Payment Received').isVisible({ timeout: 5000 }).catch(() => false);

      // Poll plan-status until the webhook (delivered via `stripe listen`)
      // has actually applied the update — it's async relative to the redirect.
      await expect(async () => {
        const res = await request.get(`/api/admin/plan-status?adminId=${admin.id}`);
        const body = await res.json();
        expect(body.plan).toBe('standard');
      }).toPass({ timeout: 20000, intervals: [1000, 2000, 3000] });
    } finally {
      await deleteTestCommissioner(request, admin.id);
    }
  });
});
