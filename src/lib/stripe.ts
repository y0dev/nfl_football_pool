import Stripe from 'stripe';
import { isStripeConfigured } from './billing';
import { isSaleEnabled } from './pricing';

// Server-side Stripe client + product catalog. Everything here is inert until
// the Stripe env vars are set — see docs/stripe-billing-setup.md for the full
// go-live checklist (account, products, webhook, DB migration).

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!isStripeConfigured()) {
    throw new Error('Stripe is not configured (missing STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET)');
  }
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return stripeClient;
}

export type BillingProduct = 'standard' | 'addon_pool';

// Price IDs come from env so test/live mode is a config change, not a deploy.
// Both are one-time (per-season) prices — no auto-renewing subscriptions.
// Each product also has a `_SALE` price ID, used whenever NEXT_PUBLIC_SALE=true
// (see src/lib/pricing.ts) so checkout always charges whatever /pricing shows.
export const PRODUCTS: Record<BillingProduct, { priceEnv: string; saleEnv: string; label: string }> = {
  standard:   { priceEnv: 'STRIPE_PRICE_STANDARD',   saleEnv: 'STRIPE_PRICE_STANDARD_SALE',   label: 'Standard plan (per season)' },
  addon_pool: { priceEnv: 'STRIPE_PRICE_ADDON_POOL', saleEnv: 'STRIPE_PRICE_ADDON_POOL_SALE', label: 'Add-on pool (per season)' },
};

// Sale-aware: returns null (and the checkout route responds 503) rather than
// silently falling back to the regular price if sale mode is on but the
// `_SALE` price ID hasn't been set — never charge a price that doesn't match
// what the customer was shown.
export function getPriceId(product: BillingProduct): string | null {
  const { priceEnv, saleEnv } = PRODUCTS[product];
  return process.env[isSaleEnabled() ? saleEnv : priceEnv] ?? null;
}
