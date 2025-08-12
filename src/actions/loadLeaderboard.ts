import { getSupabaseClient } from '@/lib/supabase';

export async function loadLeaderboard(poolId: string, weekNumber: number = 1) {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('scores')
      .select(`
        *,
        participants (
          name,
          email
        )
      `)
      .eq('pool_id', poolId)
      .eq('week', weekNumber)
      .order('points', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error loading leaderboard:', error);
    return [];
  }
}
