import Stripe from 'stripe';
import { isStripeConfigured } from './billing';
import { getActiveSale, getAddonPoolPrice, getStandardPrice, type SaleId } from './pricing';

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
// All are one-time (per-season) prices — no auto-renewing subscriptions.
export const PRODUCTS: Record<BillingProduct, { priceEnv: string; label: string }> = {
  standard:   { priceEnv: 'STRIPE_PRICE_STANDARD',   label: 'Standard plan (per season)' },
  addon_pool: { priceEnv: 'STRIPE_PRICE_ADDON_POOL', label: 'Add-on pool (per season)' },
};

// Each sale in SALES (src/lib/pricing.ts) has its own Standard price id. The
// add-on sale price is the same in every sale, so they share one id.
export const SALE_PRICE_ENV: Record<SaleId, Record<BillingProduct, string>> = {
  preseason:    { standard: 'STRIPE_PRICE_STANDARD_SALE',              addon_pool: 'STRIPE_PRICE_ADDON_POOL_SALE' },
  thanksgiving: { standard: 'STRIPE_PRICE_STANDARD_SALE_THANKSGIVING', addon_pool: 'STRIPE_PRICE_ADDON_POOL_SALE' },
  playoffs:     { standard: 'STRIPE_PRICE_STANDARD_SALE_PLAYOFFS',     addon_pool: 'STRIPE_PRICE_ADDON_POOL_SALE' },
};

export interface CheckoutPrice {
  priceId: string;
  /** What the pricing page shows right now, in cents — checked against Stripe. */
  amountCents: number;
  saleId: SaleId | null;
}

// Sale-aware, on the server's clock. Returns null (and the checkout route
// responds 503) rather than falling back to the regular price when a sale is
// running but its price id isn't set — never charge a price that doesn't
// match what the customer was shown.
export function getCheckoutPrice(product: BillingProduct, now: Date = new Date()): CheckoutPrice | null {
  const sale = getActiveSale(now);
  const env = sale ? SALE_PRICE_ENV[sale.id][product] : PRODUCTS[product].priceEnv;
  const priceId = process.env[env];
  if (!priceId) return null;
  const dollars = (product === 'standard' ? getStandardPrice(now) : getAddonPoolPrice(now)).effective;
  return { priceId, amountCents: dollars * 100, saleId: sale?.id ?? null };
}

/**
 * Why a Stripe price can't be charged for `expected`, or null when it can.
 * Catches a price id pasted into the wrong env var (e.g. the $30 playoff
 * price set as the Thanksgiving one) before anyone is charged.
 */
export function checkoutPriceMismatch(
  price: { active: boolean; type: string; currency: string; unit_amount: number | null },
  expected: CheckoutPrice,
): string | null {
  if (!price.active) return 'price is archived';
  if (price.type !== 'one_time') return `price is ${price.type}, not one_time`;
  if (price.currency !== 'usd') return `price currency is ${price.currency}, not usd`;
  if (price.unit_amount !== expected.amountCents) {
    return `price is ${price.unit_amount} cents but the page shows ${expected.amountCents}`;
  }
  return null;
}
