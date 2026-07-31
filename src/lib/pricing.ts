// Central price list — the only place dollar amounts live. Safe to import
// from client components (NEXT_PUBLIC_* is inlined at build time).
//
// Sale mode is a single on/off switch, so a promotion is just an env change:
//   NEXT_PUBLIC_SALE=true    → sale prices shown (struck-through list price +
//                              badge) and sale Stripe price IDs charged at checkout
//   NEXT_PUBLIC_SALE=false / unset → regular prices, no badge, regular Stripe prices
//   NEXT_PUBLIC_SALE_LABEL=... → optional badge text, defaults to "Launch Special"
//
// The matching Stripe price IDs (STRIPE_PRICE_STANDARD[_SALE] /
// STRIPE_PRICE_ADDON_POOL[_SALE]) are resolved in src/lib/stripe.ts using the
// same isSaleEnabled() flag, so the displayed price and the charged price can
// never drift apart. See the Sales section of docs/stripe-billing-setup.md.

export interface PriceInfo {
  /** Regular (list) price in whole dollars. */
  list: number;
  /** Sale price, or null when sale mode is off. */
  sale: number | null;
  /** What the customer actually pays right now. */
  effective: number;
  onSale: boolean;
}

const STANDARD_LIST = 50;
const STANDARD_SALE = 40;
const ADDON_LIST = 20;
const ADDON_SALE = 15;

export function isSaleEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SALE === 'true';
}

function priceInfo(list: number, sale: number): PriceInfo {
  const onSale = isSaleEnabled();
  return { list, sale: onSale ? sale : null, effective: onSale ? sale : list, onSale };
}

export function getStandardPrice(): PriceInfo {
  return priceInfo(STANDARD_LIST, STANDARD_SALE);
}

export function getAddonPoolPrice(): PriceInfo {
  return priceInfo(ADDON_LIST, ADDON_SALE);
}

export function getSaleLabel(): string {
  return process.env.NEXT_PUBLIC_SALE_LABEL || 'Launch Special';
}
