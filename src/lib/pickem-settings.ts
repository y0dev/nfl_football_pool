// Pure, client-safe Pick'em helpers — split out of src/lib/pickem.ts for the
// same reason src/lib/survivor-settings.ts is split out of
// src/lib/survivor.ts: client components (Pool Settings, the Picks page)
// must never import a file that pulls in getSupabaseServiceClient, since
// webpack can bundle the whole module graph into browser JS (a real,
// previously-fixed leak in this project). This file has zero server-only
// imports — pickem.ts imports these back in rather than redefining them, so
// the client's lock/tiebreaker-game display always matches what the server
// actually enforces.

import { normalizeGameStatus } from '@/types/game';

export type PickemTiebreakerType = 'total_combined_score';

export interface PickemTypeSettings {
  tiebreakerEnabled: boolean;
  /** Only one type exists today — kept as a field (not a hardcoded
   * constant) so Pool Settings can display/store it explicitly rather than
   * an implicit assumption, matching how Survivor's rules are all
   * explicitly represented rather than hidden. */
  tiebreakerType: PickemTiebreakerType;
}

export const DEFAULT_PICKEM_TYPE_SETTINGS: PickemTypeSettings = {
  tiebreakerEnabled: true,
  tiebreakerType: 'total_combined_score',
};

/** `pools.type_settings` is untyped JSONB with no shape enforced at the DB
 * level — this turns whatever's stored into a fully populated, safe-to-use
 * settings object, falling back per-field so a partially-configured or
 * pre-existing `{}` pool never produces undefined behavior. */
export function parsePickemTypeSettings(raw: unknown): PickemTypeSettings {
  const r = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};
  const tiebreakerEnabled: boolean = r.tiebreakerEnabled === false ? false : DEFAULT_PICKEM_TYPE_SETTINGS.tiebreakerEnabled;
  const tiebreakerType: PickemTiebreakerType = 'total_combined_score';
  return { tiebreakerEnabled, tiebreakerType };
}

const DAYS_BEFORE_GAME = 7; // Mirrors src/lib/utils.ts's DAYS_BEFORE_GAME — duplicated as a literal here (not imported) since utils.ts is a large server-touching grab-bag file; this constant itself is pure data, not logic, so keeping this file's zero-server-import guarantee airtight is worth the one-line duplication. Keep in sync if utils.ts's value ever changes.

export interface MinimalGame {
  id: string;
  home_team: string;
  away_team: string;
  kickoff_time: string;
  status?: string | null;
  home_score?: number | null;
  away_score?: number | null;
}

/** A single game locks independently of the rest of its week once its own
 * kickoff passes (or it's no longer 'scheduled') — this is what lets a
 * participant keep picking/changing Sunday's games after Thursday's game has
 * already started, unlike Confidence's whole-week-at-once submission model. */
export function isGameLocked(game: { kickoff_time: string; status?: string | null }, now: Date): boolean {
  return new Date(game.kickoff_time) <= now || (game.status != null && normalizeGameStatus(game.status) !== 'scheduled');
}

/** Whether the week's pick window has opened at all yet — the DAYS_BEFORE_GAME
 * rule from computeWeekUnlockStatus, but ONLY that half of it. Deliberately
 * NOT reusing computeWeekUnlockStatus's boolean directly here: that function
 * conflates "too early" with "a game in this week has already started" into
 * a single false, which is correct for Confidence/Survivor's whole-week-at-
 * once submission model but wrong for Pick'em's per-game one — a week whose
 * Thursday game already kicked off must still report "open" so Sunday's
 * games (checked independently via isGameLocked) remain pickable, per the
 * explicit requirement not to lock future games just because an earlier one
 * in the same week has started. */
export function isWeekTooEarly(weekGames: Array<{ kickoff_time: string }>, now: Date): boolean {
  if (weekGames.length === 0) return true;
  const firstKickoff = Math.min(...weekGames.map(g => new Date(g.kickoff_time).getTime()));
  const daysToFirstKickoffMs = DAYS_BEFORE_GAME * 24 * 60 * 60 * 1000;
  return (firstKickoff - now.getTime()) > daysToFirstKickoffMs;
}

/** Monday Night Football is the preferred tiebreaker game; if the week has
 * none (e.g. a Super Bowl week, which is a single game), fall back to the
 * week's own last-kickoff game — deterministic and schedule-driven, never a
 * hardcoded team/matchup. */
export function selectTiebreakerGame<T extends MinimalGame>(games: T[]): T | null {
  if (games.length === 0) return null;
  const monday = games.find(g => {
    const d = new Date(g.kickoff_time);
    return d.getDay() === 1 && d.getHours() >= 19 && d.getHours() <= 23;
  });
  if (monday) return monday;
  return [...games].sort((a, b) => new Date(b.kickoff_time).getTime() - new Date(a.kickoff_time).getTime())[0];
}
