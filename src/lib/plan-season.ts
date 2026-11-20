// Pure, client-safe season rule for paid plans — no DB imports, so admin
// dashboards can use the same check the server enforces. Re-exported from
// src/lib/plan.ts.
import { getNFLSeasonYear } from './utils';

export type AdminPlanRow = {
  plan?: string | null;
  trial_ends_at?: string | null;
  addon_pools?: number | null;
  billing_exempt?: boolean | null;
  plan_season?: number | null;
} | null;

/**
 * Whether a stored paid plan still applies this season. A Standard purchase
 * (and the add-on pools stacked on it) covers one NFL season: once
 * getNFLSeasonYear() rolls past plan_season (Feb 14 after the Super Bowl),
 * the account is effectively Free until it buys the new season. Comped
 * accounts and rows without a plan_season (pre-migration / not season-bound)
 * never lapse.
 */
export function isPaidPlanCurrent(row: AdminPlanRow, currentSeason: number = getNFLSeasonYear()): boolean {
  if (!row || (row.plan ?? 'free') === 'free') return false;
  if (row.billing_exempt) return true;
  if (row.plan_season == null) return true;
  return row.plan_season >= currentSeason;
}
