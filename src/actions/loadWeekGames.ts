import { getSupabaseClient } from '@/lib/supabase';

export async function loadWeekGames(weekNumber: number = 1) {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('week', weekNumber)
      .order('kickoff_time');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error loading week games:', error);
    return [];
  }
}
