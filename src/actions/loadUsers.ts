import { supabase } from '@/lib/supabase';
import { getUsersWhoSubmitted } from './checkUserSubmission';

export async function loadUsers(poolId?: string, week?: number) {
  try {
    // If poolId and week are provided, exclude users who have already submitted picks
    if (poolId && week) {
      // Get participants who have already submitted picks for this week
      const submittedParticipantIds = await getUsersWhoSubmitted(poolId, week);
      
      // Query participants excluding those who have submitted
      if (submittedParticipantIds.length > 0) {
        const { data: participants, error } = await supabase
          .from('participants')
          .select('*')
          .eq('is_active', true)
          .not('id', 'in', submittedParticipantIds)
          .order('name');

        if (error) throw error;
        return participants || [];
      }
    }

    // Default query for all active participants
    const { data: participants, error } = await supabase
      .from('participants')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return participants || [];
  } catch (error) {
    console.error('Error loading users:', error);
    throw error;
  }
}
