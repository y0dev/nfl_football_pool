// Central price list — the only place dollar amounts live. Safe to import
// from client components (NEXT_PUBLIC_* is inlined at build time).
//
// Sales are env-toggled per product:
//   NEXT_PUBLIC_SALE_STANDARD=30   → Standard shows $50 struck through, $30 active
//   NEXT_PUBLIC_SALE_ADDON=10      → same treatment for add-on pools
//   (unset, 0, or >= list price    → no sale, list price shown)
//   NEXT_PUBLIC_SALE_LABEL=...     → optional badge text, defaults to "Sale"
//
// Stripe note: the STRIPE_PRICE_* env vars must point at prices matching the
// *effective* amount shown here — see the Sales section of
// docs/stripe-billing-setup.md when changing a sale.

export interface PriceInfo {
  /** Regular (list) price in whole dollars. */
  list: number;
  /** Active sale price, or null when not on sale. */
  sale: number | null;
  /** What the customer actually pays right now. */
  effective: number;
  onSale: boolean;
}

function withSale(list: number, saleRaw: string | undefined): PriceInfo {
  const n = Number(saleRaw);
  const sale = saleRaw && Number.isFinite(n) && n > 0 && n < list ? n : null;
  return { list, sale, effective: sale ?? list, onSale: sale !== null };
}

export function getStandardPricing(): PriceInfo {
  return withSale(50, process.env.NEXT_PUBLIC_SALE_STANDARD);
}

export function getAddonPricing(): PriceInfo {
  return withSale(15, process.env.NEXT_PUBLIC_SALE_ADDON);
}

export function getSaleLabel(): string {
  return process.env.NEXT_PUBLIC_SALE_LABEL || 'Sale';
}
