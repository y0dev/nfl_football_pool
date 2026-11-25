// When a pool's season starts. Pure and client-safe.
//
// A pool created partway through a season only takes part in the weeks whose
// first game kicks off at or after the pool was created. A week already under
// way at creation is skipped too: nobody could have picked its early games.
// Survivor's no-pick rule, Pick'em's season summary and the Q1-Q4 selector
// all use this one rule, so a midseason pool never shows, scores or
// eliminates anyone for weeks it didn't exist for.

export interface ScheduledWeek {
  seasonType: number;
  week: number;
  /** Earliest kickoff in the week, as ms since the epoch. */
  firstKickoff: number;
}

export interface PoolStart {
  seasonType: number;
  week: number;
}

const toMs = (value: string | number | Date) => (value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value));

/** True when the week began before the pool existed. */
export function weekPredatesPool(firstKickoff: number, poolCreatedAt: string | number | Date): boolean {
  return firstKickoff < toMs(poolCreatedAt);
}

/** Groups games into weeks with each week's first kickoff, oldest first. */
export function scheduledWeeks(games: Array<{ season_type: number; week: number; kickoff_time: string | null }>): ScheduledWeek[] {
  const byWeek = new Map<string, ScheduledWeek>();
  for (const g of games) {
    if (!g.kickoff_time) continue;
    const kickoff = Date.parse(g.kickoff_time);
    if (Number.isNaN(kickoff)) continue;
    const key = `${g.season_type}-${g.week}`;
    const existing = byWeek.get(key);
    if (!existing) byWeek.set(key, { seasonType: g.season_type, week: g.week, firstKickoff: kickoff });
    else if (kickoff < existing.firstKickoff) existing.firstKickoff = kickoff;
  }
  return [...byWeek.values()].sort((a, b) => a.firstKickoff - b.firstKickoff);
}

/**
 * The first week the pool takes part in, or null when every scheduled week
 * began before the pool was created (or nothing is scheduled yet).
 */
export function poolStartWeek(poolCreatedAt: string | number | Date, weeks: ScheduledWeek[]): PoolStart | null {
  const first = [...weeks]
    .sort((a, b) => a.firstKickoff - b.firstKickoff)
    .find(w => !weekPredatesPool(w.firstKickoff, poolCreatedAt));
  return first ? { seasonType: first.seasonType, week: first.week } : null;
}

/** True when (seasonType, week) comes before the pool's first week. Null start: nothing is. */
export function isBeforePoolStart(seasonType: number, week: number, start: PoolStart | null): boolean {
  if (!start) return false;
  return seasonType < start.seasonType || (seasonType === start.seasonType && week < start.week);
}

const REGULAR_SEASON = 2;

/**
 * The Q1-Q4 periods a pool takes part in: those ending at or after its first
 * regular-season week. A pool created after the regular season's last week
 * began has none. With no regular-season schedule loaded yet, or no creation
 * date, nothing is filtered.
 */
export function periodsForPool<P extends { endWeek: number }>(
  periods: P[],
  poolCreatedAt: string | number | Date | null,
  regularSeasonGames: Array<{ season_type: number; week: number; kickoff_time: string | null }>,
): P[] {
  if (poolCreatedAt == null) return periods;
  const weeks = scheduledWeeks(regularSeasonGames).filter(w => w.seasonType === REGULAR_SEASON);
  if (weeks.length === 0) return periods;
  const start = poolStartWeek(poolCreatedAt, weeks);
  if (!start) return [];
  return periods.filter(p => p.endWeek >= start.week);
}
