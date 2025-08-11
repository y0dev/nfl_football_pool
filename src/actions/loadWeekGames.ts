import { supabase } from '@/lib/supabase';

export async function loadWeekGames(weekNumber: number = 1) {
  try {
    const { data: games, error } = await supabase
      .from('games')
      .select('*')
      .eq('week', weekNumber)
      .eq('season', 2024)
      .order('kickoff_time');

    if (error) throw error;
    return games || [];
  } catch (error) {
    console.error('Error loading week games:', error);
    throw error;
  }
}
