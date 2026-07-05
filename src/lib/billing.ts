// Billing feature flags — safe to import from both server and client code.
// NEXT_PUBLIC_* and NODE_ENV are inlined at build time by Next.js.

/**
 * Whether pricing info (the /pricing page, nav links to it, and dollar
 * amounts on /upgrade) is visible.
 *
 * - `NEXT_PUBLIC_ENABLE_PRICING=true`  → always visible
 * - `NEXT_PUBLIC_ENABLE_PRICING=false` → always hidden
 * - unset → visible in development, hidden in production (pricing stays
 *   private until Stripe is live; plan limits are enforced regardless)
 */
export function isPricingVisible(): boolean {
  const flag = process.env.NEXT_PUBLIC_ENABLE_PRICING;
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return process.env.NODE_ENV !== 'production';
}

/**
 * Whether Stripe is configured. Server-side only — the secret vars are not
 * exposed to the client (client code learns this via /api/admin/plan-status).
 */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}
