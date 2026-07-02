import { getSupabaseClient } from '@/lib/supabase';
import { isOffseason, debugError} from '@/lib/utils';
import { Game } from '@/types/game';

/*
 * Loads the games for a given week and season type.
 * Returns an empty array when:
 *   - seasonType === 0 (the offseason signal from getCurrentWeekFromGames), or
 *   - it is currently offseason AND no games exist in the DB for the requested period.
 */
export async function loadWeekGames(weekNumber: number = 1, seasonType?: number, season?: number): Promise<Game[]> {
  // seasonType 0 is the explicit "offseason, no data" signal — never query
  if (seasonType === 0) return [];

  try {
    const supabase = getSupabaseClient();

    // During offseason, only proceed if there are actually games to show
    if (isOffseason()) {
      const { data: check } = await supabase
        .from('games')
        .select('id')
        .eq('week', weekNumber)
        .limit(1);
      if (!check || check.length === 0) return [];
    }

    let query = supabase.from('games').select('*').eq('week', weekNumber);

    if (seasonType !== undefined) {
      query = query.eq('season_type', seasonType);
    }

    if (season !== undefined) {
      query = query.eq('season', season);
    }

    const { data, error } = await query.order('kickoff_time');
    if (error) throw error;
    return (data as Game[]) || [];
  } catch (error) {
    debugError('Error loading week games:', error);
    return [];
  }
}
