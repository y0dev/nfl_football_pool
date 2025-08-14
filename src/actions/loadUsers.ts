import { getSupabaseClient } from '@/lib/supabase';
import { getUsersWhoSubmitted } from './checkUserSubmission';

export async function loadUsers(poolId?: string, week?: number) {
  try {
    const supabase = getSupabaseClient();
    
    // If poolId and week are provided, exclude users who have already submitted picks
    if (poolId && week) {
      try {
        // Get participants who have already submitted picks for this week
        const submittedParticipantIds = await getUsersWhoSubmitted(poolId, week);
        
        // Query participants for this specific pool, excluding those who have submitted
        let query = supabase
          .from('participants')
          .select('*')
          .eq('pool_id', poolId)
          .eq('is_active', true);
        
        if (submittedParticipantIds.length > 0) {
          query = query.not('id', 'in', submittedParticipantIds);
        }
        
        const { data: participants, error } = await query.order('name');

        if (error) {
          console.error('Error querying participants (excluding submitted):', error);
          throw error;
        }
        return participants || [];
      } catch (error) {
        console.error('Error in loadUsers when filtering submitted users:', error);
        // Fall back to loading all users in the pool if there's an error
      }
    }

    // Default query for all active participants in the pool
    if (poolId) {
      const { data: participants, error } = await supabase
        .from('participants')
        .select('*')
        .eq('pool_id', poolId)
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Error querying participants for pool:', error);
        throw error;
      }
      
      return participants || [];
    }

    // If no poolId provided, return empty array (shouldn't happen in normal flow)
    return [];
  } catch (error) {
    console.error('Error loading users:', error);
    throw error;
  }
}
