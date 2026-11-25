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

// Checkout charges the amount from src/lib/pricing.ts directly (Stripe
// `price_data`) against one Stripe product per BillingProduct, so the charge
// can't differ from the page and a new sale needs no Stripe price. Products
// come from env so test/live mode is a config change, not a deploy. The
// product id can be set directly, or is read off the product's regular price
// (the setup before price_data, so existing deployments keep working).
// All purchases are one-time (per season) — no auto-renewing subscriptions.
export const PRODUCTS: Record<BillingProduct, { productEnv: string; priceEnv: string; label: string }> = {
  standard:   { productEnv: 'STRIPE_PRODUCT_STANDARD',   priceEnv: 'STRIPE_PRICE_STANDARD',   label: 'Standard plan (per season)' },
  addon_pool: { productEnv: 'STRIPE_PRODUCT_ADDON_POOL', priceEnv: 'STRIPE_PRICE_ADDON_POOL', label: 'Add-on pool (per season)' },
};

export interface CheckoutPrice {
  /** What the pricing page shows right now, in cents — the amount charged. */
  amountCents: number;
  saleId: SaleId | null;
}

/** The current price on the server's clock — never anything the browser sent. */
export function getCheckoutPrice(product: BillingProduct, now: Date = new Date()): CheckoutPrice {
  const sale = getActiveSale(now);
  const dollars = (product === 'standard' ? getStandardPrice(now) : getAddonPoolPrice(now)).effective;
  return { amountCents: Math.round(dollars * 100), saleId: sale?.id ?? null };
}

const resolvedProducts = new Map<BillingProduct, string>();

/** The Stripe product to charge against, or null when neither env var is set. */
export async function getStripeProductId(product: BillingProduct): Promise<string | null> {
  const { productEnv, priceEnv } = PRODUCTS[product];
  const direct = process.env[productEnv];
  if (direct) return direct;
  const cached = resolvedProducts.get(product);
  if (cached) return cached;
  const priceId = process.env[priceEnv];
  if (!priceId) return null;
  const price = await getStripe().prices.retrieve(priceId);
  const productId = typeof price.product === 'string' ? price.product : price.product.id;
  resolvedProducts.set(product, productId);
  return productId;
}
