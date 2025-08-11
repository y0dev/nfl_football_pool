import { supabase } from '@/lib/supabase';

export async function loadLeaderboard(poolId: string, weekNumber: number = 1) {
  try {
    const { data: scores, error } = await supabase
      .from('scores')
      .select(`
        *,
        participants (name)
      `)
      .eq('pool_id', poolId)
      .eq('week', weekNumber)
      .eq('season', 2024)
      .order('points', { ascending: false });

    if (error) throw error;
    return scores || [];
  } catch (error) {
    console.error('Error loading leaderboard:', error);
    throw error;
  }
}
