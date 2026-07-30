import { getSupabaseServiceClient } from './supabase';
import { getNFLSeasonYear, debugError } from './utils';

export interface SeasonSettings {
  season: number;
  preseasonStartDate: string | null;
  regularSeasonStartDate: string | null;
  postseasonStartDate: string | null;
  currentWeek: number;
  currentSeasonType: number;
  seasonOver: boolean;
}

const DEFAULT_SETTINGS = (season: number): SeasonSettings => ({
  season,
  preseasonStartDate: null,
  regularSeasonStartDate: null,
  postseasonStartDate: null,
  currentWeek: 1,
  currentSeasonType: 0,
  seasonOver: false,
});

/**
 * The DB-backed source of truth for season phase boundaries — an admin
 * edits this instead of it living only in source. Falls back to sane
 * defaults (offseason, week 1) if no row exists yet for the season, so
 * nothing crashes before an admin has configured it.
 */
export async function getSeasonSettings(season: number = getNFLSeasonYear()): Promise<SeasonSettings> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from('season_settings')
    .select('*')
    .eq('season', season)
    .maybeSingle();

  if (error) {
    debugError('Failed to load season settings:', error);
    return DEFAULT_SETTINGS(season);
  }
  if (!data) return DEFAULT_SETTINGS(season);

  return {
    season: data.season,
    preseasonStartDate: data.preseason_start_date,
    regularSeasonStartDate: data.regular_season_start_date,
    postseasonStartDate: data.postseason_start_date,
    currentWeek: data.current_week,
    currentSeasonType: data.current_season_type,
    seasonOver: data.season_over,
  };
}

export type UpsertSeasonSettingsResult =
  | { success: true; settings: SeasonSettings }
  | { success: false; error: string };

/** Creates or updates the season_settings row for a season year. No
 * permission check here by design — see updateSeasonSettings in
 * @/actions/seasonSettings for the super-admin-gated entry point actually
 * exposed to the UI. */
export async function upsertSeasonSettings(
  season: number,
  updates: Partial<Omit<SeasonSettings, 'season'>>
): Promise<UpsertSeasonSettingsResult> {
  try {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from('season_settings')
      .upsert(
        {
          season,
          ...(updates.preseasonStartDate !== undefined ? { preseason_start_date: updates.preseasonStartDate } : {}),
          ...(updates.regularSeasonStartDate !== undefined ? { regular_season_start_date: updates.regularSeasonStartDate } : {}),
          ...(updates.postseasonStartDate !== undefined ? { postseason_start_date: updates.postseasonStartDate } : {}),
          ...(updates.currentWeek !== undefined ? { current_week: updates.currentWeek } : {}),
          ...(updates.currentSeasonType !== undefined ? { current_season_type: updates.currentSeasonType } : {}),
          ...(updates.seasonOver !== undefined ? { season_over: updates.seasonOver } : {}),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'season' }
      )
      .select('*')
      .single();

    if (error) {
      debugError('Failed to save season settings:', error);
      return { success: false, error: 'Failed to save season settings. Please try again.' };
    }

    return {
      success: true,
      settings: {
        season: data.season,
        preseasonStartDate: data.preseason_start_date,
        regularSeasonStartDate: data.regular_season_start_date,
        postseasonStartDate: data.postseason_start_date,
        currentWeek: data.current_week,
        currentSeasonType: data.current_season_type,
        seasonOver: data.season_over,
      },
    };
  } catch (error) {
    debugError('Unexpected error saving season settings:', error);
    return { success: false, error: 'An unexpected error occurred. Please try again.' };
  }
}
