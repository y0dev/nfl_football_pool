import { SeasonSettings } from './seasonSettings';

// Matches the season_type convention used throughout (1=preseason,
// 2=regular season, 3=postseason) and the local, phase-relative week
// numbering already used by the admin games browser and games/season_type
// queries (week resets to 1 at the start of each phase).
export const PHASE_LAST_WEEK: Record<number, number> = {
  1: 4,  // preseason
  2: 18, // regular season
  3: 4,  // postseason
};

export const PHASE_LABELS: Record<number, string> = {
  1: 'Preseason',
  2: 'Regular season',
  3: 'Postseason',
};

export interface SeasonScopeCheck {
  allowed: boolean;
  message?: string;
}

/**
 * Checks whether a pool's season_scope (an array of season_type values,
 * e.g. [1] preseason-only, [2] regular-only, [2,3] full season + playoffs)
 * can still be selected when creating/re-scoping a pool, given the
 * configured season_settings for that pool's season. A phase is no longer
 * selectable once its final week has started, or it's already fully in the
 * past — e.g. you can't create a preseason-only pool once preseason week 4
 * has begun.
 */
export function checkSeasonScopeCreatable(scope: number[], settings: SeasonSettings): SeasonScopeCheck {
  for (const phase of scope) {
    const lastWeek = PHASE_LAST_WEEK[phase];
    if (!lastWeek) continue; // unknown/unmapped phase value — nothing to check

    const phaseIsPast = phase < settings.currentSeasonType;
    const phaseInFinalWeek = phase === settings.currentSeasonType && settings.currentWeek >= lastWeek;

    if (phaseIsPast || phaseInFinalWeek) {
      const label = PHASE_LABELS[phase] ?? `Season type ${phase}`;
      const reason = phaseIsPast
        ? `${label.toLowerCase()} has already ended`
        : `its final week (week ${lastWeek}) has started`;
      return {
        allowed: false,
        message: `${label} pools can no longer be created — ${reason} for ${settings.season}.`,
      };
    }
  }
  return { allowed: true };
}
