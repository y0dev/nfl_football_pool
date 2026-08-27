// Payout calculation — pure functions, no I/O. Sunday Huddle never collects,
// holds, or transfers money: everything here computes what a commissioner
// SHOULD pay someone based on the rules they configured, for the
// commissioner to act on outside the app. This file must never read or
// write scoring/leaderboard data itself (see Step 18 in the payout spec) —
// callers pass in already-computed standings.

export type TiePolicy = 'split' | 'tie_breaker' | 'commissioner';
export type WeeklyAmountType = 'fixed' | 'percentage';

export interface PayoutPosition {
  place: number;
  percentage: number;
}

export interface PayoutConfig {
  enabled: boolean;
  entryFee: number | null;
  tiePolicy: TiePolicy;
  weeklyEnabled: boolean;
  weeklyAmountType: WeeklyAmountType;
  weeklyAmount: number | null;
  weeklyPositions: PayoutPosition[];
  overallEnabled: boolean;
  overallPositions: PayoutPosition[];
  /** Quarter (Q1-Q4) payouts — only meaningful for pools that have a
   * quarter/period concept at all (currently: Confidence pools with the
   * regular season in scope — see getRegularSeasonPeriods()/period_winners).
   * Same shape and formula as the weekly fields, scoped to a quarter instead
   * of a week; see computeQuarterDollarAmount below. */
  quarterEnabled: boolean;
  quarterAmountType: WeeklyAmountType;
  quarterAmount: number | null;
  quarterPositions: PayoutPosition[];
}

export interface StandingEntry {
  participantId: string;
  participantName: string;
  /** Points, or whatever the ranking is sorted by. Ties are entries with an equal score. */
  score: number;
}

export interface PayoutResult {
  place: number;
  /** Human label — "1st", "T-1st" when tied, etc. */
  placeLabel: string;
  participantId: string;
  participantName: string;
  amount: number;
  tied: boolean;
  /** Only set for tiePolicy 'commissioner' on a tied group — the calculator must not silently guess. */
  needsManualResolution?: boolean;
  note?: string;
}

export const DEFAULT_WEEKLY_POSITIONS: PayoutPosition[] = [{ place: 1, percentage: 100 }];
export const DEFAULT_OVERALL_POSITIONS: PayoutPosition[] = [
  { place: 1, percentage: 50 }, { place: 2, percentage: 30 }, { place: 3, percentage: 20 },
];

/** Absence of a payout_configs row means payout tracking was never
 * configured — every existing pool defaults to exactly this (Step 17). */
export const DEFAULT_PAYOUT_CONFIG: PayoutConfig = {
  enabled: false,
  entryFee: null,
  tiePolicy: 'split',
  weeklyEnabled: false,
  weeklyAmountType: 'fixed',
  weeklyAmount: null,
  weeklyPositions: DEFAULT_WEEKLY_POSITIONS,
  overallEnabled: false,
  overallPositions: DEFAULT_OVERALL_POSITIONS,
  quarterEnabled: false,
  quarterAmountType: 'fixed',
  quarterAmount: null,
  quarterPositions: DEFAULT_WEEKLY_POSITIONS,
};

const FLOAT_TOLERANCE = 0.01;

export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

/**
 * Validates a set of payout positions: non-empty, places are 1..N with no
 * gaps or duplicates, every percentage is a positive finite number, and the
 * percentages sum to exactly 100 (within floating-point tolerance). Returns
 * an error message, or null when valid — the Save button must not allow an
 * invalid configuration through (Step 16).
 */
export function validatePayoutPositions(positions: PayoutPosition[]): string | null {
  if (!positions || positions.length === 0) {
    return 'Add at least one payout position.';
  }

  const places = [...positions.map(p => p.place)].sort((a, b) => a - b);
  for (let i = 0; i < places.length; i++) {
    if (places[i] !== i + 1) {
      return 'Payout positions must be numbered 1st through Nth with no gaps or duplicates.';
    }
  }

  for (const p of positions) {
    if (p.percentage == null || !Number.isFinite(p.percentage)) {
      return `${ordinal(p.place)} place is missing a percentage.`;
    }
    if (p.percentage <= 0) {
      return `${ordinal(p.place)} place percentage must be greater than 0.`;
    }
    // Reject more than 2 decimal places (invalid decimal values — Step 16).
    if (Math.round(p.percentage * 100) !== p.percentage * 100) {
      return `${ordinal(p.place)} place percentage can have at most 2 decimal places.`;
    }
  }

  const total = positions.reduce((sum, p) => sum + p.percentage, 0);
  if (Math.abs(total - 100) > FLOAT_TOLERANCE) {
    return `Payout percentages must total 100% (currently ${total.toFixed(2)}%).`;
  }

  return null;
}

export function validateEntryFee(fee: number | null | undefined): string | null {
  if (fee == null) return null;
  if (!Number.isFinite(fee)) return 'Entry fee must be a number.';
  if (fee < 0) return 'Entry fee cannot be negative.';
  return null;
}

/**
 * `label` defaults to 'weekly' so every existing call site keeps its exact
 * original message text — pass 'quarter' (or any other recurring-payout
 * scope added later) to reuse this same validation with matching wording.
 */
export function validateWeeklyAmount(type: WeeklyAmountType, amount: number | null | undefined, label: string = 'weekly'): string | null {
  if (amount == null || !Number.isFinite(amount)) return `Enter a ${label} payout amount.`;
  if (amount < 0) return `${capitalize(label)} payout amount cannot be negative.`;
  if (type === 'percentage' && amount > 100) return `${capitalize(label)} payout percentage cannot exceed 100%.`;
  return null;
}

function capitalize(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Total contributions if every active participant paid the entry fee. Entry fee is optional — a $0/null fee is a valid, purely competitive pool. */
export function computeTotalPool(entryFee: number | null | undefined, participantCount: number): number {
  if (!entryFee || entryFee <= 0 || participantCount <= 0) return 0;
  return round2(entryFee * participantCount);
}

function computeRecurringDollarAmount(amountType: WeeklyAmountType, amount: number | null, totalPool: number): number {
  if (!amount) return 0;
  if (amountType === 'fixed') return round2(amount);
  return round2(totalPool * (amount / 100));
}

/** Resolves the configured weekly amount into a concrete per-week dollar figure. */
export function computeWeeklyDollarAmount(config: Pick<PayoutConfig, 'weeklyAmountType' | 'weeklyAmount'>, totalPool: number): number {
  return computeRecurringDollarAmount(config.weeklyAmountType, config.weeklyAmount, totalPool);
}

/** Same formula as computeWeeklyDollarAmount, scoped to a quarter instead of
 * a week — confirmed identical on purpose (Part A2 of the quarter-payouts
 * spec): fixed → flat amount; percentage → that % of the total prize pool. */
export function computeQuarterDollarAmount(config: Pick<PayoutConfig, 'quarterAmountType' | 'quarterAmount'>, totalPool: number): number {
  return computeRecurringDollarAmount(config.quarterAmountType, config.quarterAmount, totalPool);
}

/**
 * The season-long amount reserved for the overall payout: total contributions
 * minus the weekly amount projected across every week it will be paid out.
 * Never goes negative — if weekly allocation exceeds the pool, overall gets $0
 * (the UI should flag this as a configuration warning, not silently absorb it).
 */
export function computeOverallAllocation(totalPool: number, weeklyDollarAmount: number, weeksPaid: number): number {
  const weeklyTotal = weeklyDollarAmount * Math.max(0, weeksPaid);
  return round2(Math.max(0, totalPool - weeklyTotal));
}

/**
 * Splits `totalAmount` across `standings` (already sorted best-to-worst) using
 * `positions` (1st..Nth percentages). Participants ranked beyond the last
 * paid position receive nothing. Ties (equal score) are handled per
 * `tiePolicy`:
 *  - 'split': the combined percentage of every position the tied group spans
 *    is summed and divided evenly across the tied participants (Step 14).
 *  - 'tie_breaker': assumes the caller already broke ties before sorting
 *    `standings` (e.g. via the pool's Monday-night tie-breaker) — paid out
 *    positionally with no further splitting.
 *  - 'commissioner': tied participants are flagged `needsManualResolution`
 *    with amount 0 rather than guessing.
 */
export function calculatePayouts(
  positions: PayoutPosition[],
  totalAmount: number,
  standings: StandingEntry[],
  tiePolicy: TiePolicy
): PayoutResult[] {
  const sortedPositions = [...positions].sort((a, b) => a.place - b.place);
  const results: PayoutResult[] = [];

  let index = 0; // 0-based rank index into `standings`
  while (index < standings.length && index < sortedPositions.length) {
    const entry = standings[index];
    // Group every subsequent entry with the same score as a tie.
    let groupEnd = index + 1;
    if (tiePolicy !== 'tie_breaker') {
      while (groupEnd < standings.length && standings[groupEnd].score === entry.score) {
        groupEnd++;
      }
    }
    const groupSize = groupEnd - index;
    const startPlace = index + 1;
    const endPlace = Math.min(groupEnd, sortedPositions.length);
    const isTied = groupSize > 1;

    if (groupSize === 1 || tiePolicy === 'tie_breaker') {
      const position = sortedPositions[index];
      const amount = position ? round2(totalAmount * (position.percentage / 100)) : 0;
      results.push({
        place: startPlace,
        placeLabel: ordinal(startPlace),
        participantId: entry.participantId,
        participantName: entry.participantName,
        amount,
        tied: false,
      });
      index += 1;
      continue;
    }

    if (tiePolicy === 'commissioner') {
      for (let i = index; i < groupEnd; i++) {
        results.push({
          place: startPlace,
          placeLabel: `T-${ordinal(startPlace)}`,
          participantId: standings[i].participantId,
          participantName: standings[i].participantName,
          amount: 0,
          tied: true,
          needsManualResolution: true,
          note: `Tied with ${groupSize - 1} other participant${groupSize > 2 ? 's' : ''} for ${ordinal(startPlace)}–${ordinal(endPlace)} — commissioner must decide the split.`,
        });
      }
      index = groupEnd;
      continue;
    }

    // 'split': combine the percentages of every paid position this tied
    // group occupies (positions beyond the configured count contribute 0),
    // then divide evenly.
    let combinedPercentage = 0;
    for (let p = index; p < endPlace; p++) combinedPercentage += sortedPositions[p].percentage;
    const combinedAmount = round2(totalAmount * (combinedPercentage / 100));
    const perPerson = round2(combinedAmount / groupSize);
    const spanLabel = startPlace === endPlace ? ordinal(startPlace) : `${ordinal(startPlace)}–${ordinal(endPlace)}`;

    for (let i = index; i < groupEnd; i++) {
      results.push({
        place: startPlace,
        placeLabel: `T-${ordinal(startPlace)}`,
        participantId: standings[i].participantId,
        participantName: standings[i].participantName,
        amount: perPerson,
        tied: true,
        note: groupEnd > sortedPositions.length
          ? `Tied for ${spanLabel}; only ${sortedPositions.length - index} paid position${sortedPositions.length - index === 1 ? '' : 's'} covered by this group — split evenly across all ${groupSize} tied participants.`
          : `Tied for ${spanLabel} — combined payout split evenly across ${groupSize} participants.`,
      });
    }
    index = groupEnd;
  }

  return results;
}

const COMMON_SPLITS: Record<number, number[]> = {
  1: [100],
  2: [60, 40],
  3: [50, 30, 20],
  4: [40, 30, 20, 10],
  5: [30, 25, 20, 15, 10],
};

/** A reasonable starting percentage split for N paid positions — used when
 * the commissioner picks "3 winners" etc. and hasn't customized percentages
 * yet. Always sums to exactly 100. Positions beyond 5 split evenly with any
 * remainder (from integer rounding) added to 1st place. */
export function defaultPositionSplit(count: number): PayoutPosition[] {
  const n = Math.max(1, Math.floor(count));
  const preset = COMMON_SPLITS[n];
  if (preset) return preset.map((percentage, i) => ({ place: i + 1, percentage }));

  const base = Math.floor(100 / n);
  const remainder = 100 - base * n;
  return Array.from({ length: n }, (_, i) => ({ place: i + 1, percentage: i === 0 ? base + remainder : base }));
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
