import { getSupabaseClient } from '@/lib/supabase';

/*
 * Loads the games for a given week and season type
 * @param weekNumber - The week number to load games for
 * @param seasonType - The season type to load games for
 * @returns An array of games
 */
export async function loadWeekGames(weekNumber: number = 1, seasonType?: number) {
  try {
    const supabase = getSupabaseClient();
    let query = supabase
      .from('games')
      .select('*')
      .eq('week', weekNumber);

    // If season type is specified, filter by it
    if (seasonType !== undefined) {
      query = query.eq('season_type', seasonType);
    }

    const { data, error } = await query.order('kickoff_time');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error loading week games:', error);
    return [];
  }
}


