import Stripe from 'stripe';
import { isStripeConfigured } from './billing';

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
// Both are one-time (per-season) prices, matching the "$30/season" model —
// no auto-renewing subscriptions.
export const PRODUCTS: Record<BillingProduct, { priceEnv: string; label: string }> = {
  standard:   { priceEnv: 'STRIPE_PRICE_STANDARD',   label: 'Standard plan (per season)' },
  addon_pool: { priceEnv: 'STRIPE_PRICE_ADDON_POOL', label: 'Add-on pool (per season)' },
};

export function getPriceId(product: BillingProduct): string | null {
  return process.env[PRODUCTS[product].priceEnv] ?? null;
}
