import { supabase } from '@/lib/supabase';

export async function checkUserSubmission(participantId: string, poolId: string, week: number) {
  try {
    const { data: picks, error } = await supabase
      .from('picks')
      .select('id')
      .eq('participant_id', participantId)
      .eq('pool_id', poolId)
      .eq('games.week', week)
      .limit(1);

    if (error) {
      console.error('Error checking user submission:', error);
      return false;
    }

    return picks && picks.length > 0;
  } catch (error) {
    console.error('Error checking user submission:', error);
    return false;
  }
}

export async function getUsersWhoSubmitted(poolId: string, week: number) {
  try {
    const { data: picks, error } = await supabase
      .from('picks')
      .select('participant_id')
      .eq('pool_id', poolId)
      .eq('games.week', week);

    if (error) {
      console.error('Error getting users who submitted:', error);
      return [];
    }

    // Return unique participant IDs
    return [...new Set(picks?.map(pick => pick.participant_id) || [])];
  } catch (error) {
    console.error('Error getting users who submitted:', error);
    return [];
  }
}
