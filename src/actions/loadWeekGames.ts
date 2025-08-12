import { getSupabaseClient } from '@/lib/supabase';

// Helper function to determine season type based on week number
export function getSeasonTypeFromWeek(weekNumber: number): number {
  if (weekNumber >= 1 && weekNumber <= 4) {
    return 1; // Preseason
  } else if (weekNumber >= 5 && weekNumber <= 18) {
    return 2; // Regular Season
  } else if (weekNumber >= 19 && weekNumber <= 22) {
    return 3; // Postseason
  }
  return 2; // Default to regular season
}

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
