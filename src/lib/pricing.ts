// Central price list — the only place dollar amounts and sale dates live.
// Safe to import from client components.
//
// Sales run on a calendar (SALES below): each has a start and end, a badge
// label and its own Standard / add-on prices, and is live only between its
// dates — nobody has to remember to switch it off. Like NFL Sunday Ticket,
// the price steps down as fewer weeks remain. The page and checkout use the
// same getActiveSale(); checkout runs it on the server's clock and charges
// exactly that amount (Stripe price_data, src/lib/stripe.ts), so a sale needs
// no Stripe setup. See the Sales section of docs/stripe-billing-setup.md.
//
// NEXT_PUBLIC_SALE (build-time) overrides the calendar:
//   unset            → follow the calendar
//   off              → no sale, whatever the date
//   <sale id>        → force that sale on (e.g. to test it in dev)

export type SaleId = 'preseason' | 'thanksgiving' | 'rest_of_season' | 'playoffs';

export interface Sale {
  id: SaleId;
  /** Badge text on /pricing and /upgrade. */
  label: string;
  /** Inclusive start / exclusive end, ISO with a US Eastern offset. */
  starts: string;
  ends: string;
  /** Sale prices in whole dollars. */
  standard: number;
  addon: number;
}

export interface PriceInfo {
  /** Regular (list) price in whole dollars. */
  list: number;
  /** Sale price, or null when no sale is running. */
  sale: number | null;
  /** What the customer actually pays right now. */
  effective: number;
  onSale: boolean;
  /** Badge text of the running sale, or null. */
  saleLabel: string | null;
}

export const STANDARD_LIST = 60;
export const ADDON_LIST = 20;

// Must not overlap (tests/unit/pricing.test.ts checks).
export const SALES: readonly Sale[] = [
  // Thanksgiving through Cyber Monday.
  { id: 'thanksgiving', label: 'Thanksgiving Sale', starts: '2026-11-26T00:00:00-05:00', ends: '2026-12-01T00:00:00-05:00', standard: 40, addon: 15 },
  // After Cyber Monday through Week 18: fewer weeks left, so no return to $60.
  { id: 'rest_of_season', label: 'Rest of Season', starts: '2026-12-01T00:00:00-05:00', ends: '2027-01-11T00:00:00-05:00', standard: 40, addon: 15 },
  // Day after Week 18 until the season rolls over (getNFLSeasonYear, Feb 14).
  { id: 'playoffs', label: 'Playoff Sale', starts: '2027-01-11T00:00:00-05:00', ends: '2027-02-14T00:00:00-05:00', standard: 30, addon: 15 },
  // Run-up to the 2027 kickoff.
  { id: 'preseason', label: 'Preseason Sale', starts: '2027-08-01T00:00:00-04:00', ends: '2027-09-10T00:00:00-04:00', standard: 50, addon: 15 },
];

export function getActiveSale(now: Date = new Date()): Sale | null {
  const override = process.env.NEXT_PUBLIC_SALE;
  if (override === 'off' || override === 'false') return null;
  const forced = SALES.find(s => s.id === override);
  if (forced) return forced;
  const t = now.getTime();
  return SALES.find(s => Date.parse(s.starts) <= t && t < Date.parse(s.ends)) ?? null;
}

// Self-serve 7-day Standard trial on signup, offered from the Pricing page.
// On by default — set NEXT_PUBLIC_TRIAL_ENABLED=false to fall back to a
// plain "Upgrade to Standard" CTA (e.g. once trials are no longer offered)
// without a code change.
export const TRIAL_DAYS = 7;

export function isTrialEnabled(): boolean {
  return process.env.NEXT_PUBLIC_TRIAL_ENABLED !== 'false';
}

function priceInfo(list: number, pick: (sale: Sale) => number, now: Date): PriceInfo {
  const sale = getActiveSale(now);
  const salePrice = sale ? pick(sale) : null;
  return { list, sale: salePrice, effective: salePrice ?? list, onSale: sale !== null, saleLabel: sale?.label ?? null };
}

export function getStandardPrice(now: Date = new Date()): PriceInfo {
  return priceInfo(STANDARD_LIST, s => s.standard, now);
}

export function getAddonPoolPrice(now: Date = new Date()): PriceInfo {
  return priceInfo(ADDON_LIST, s => s.addon, now);
}

// No-refund policy — one string so checkout, the pricing/upgrade pages, the
// receipt email and the Terms all say the same thing.
export const ALL_SALES_FINAL = 'All sales are final — no refunds.';
export const ALL_SALES_FINAL_DETAIL =
  'All sales are final. Purchases are non-refundable, including if you downgrade, stop using Sunday Huddle, or your pool ends early.';

/** "2026–27" for the season that kicks off in 2026 and ends at the Super Bowl. */
export function seasonLabel(season: number): string {
  return `${season}–${String((season + 1) % 100).padStart(2, '0')}`;
}
