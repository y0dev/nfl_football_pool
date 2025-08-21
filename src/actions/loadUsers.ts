import { getSupabaseServiceClient } from '@/lib/supabase';
import { getUsersWhoSubmitted } from './checkUserSubmission';

export async function loadUsers(poolId?: string, week?: number, seasonType: number = 2) {
  try {
    const supabase = getSupabaseServiceClient();
    
    // If poolId and week are provided, exclude users who have already submitted picks
    if (poolId && week) {
      try {
        // Get participants who have already submitted picks for this week
        const submittedParticipantIds = await getUsersWhoSubmitted(poolId, week, seasonType);
        
        // Query all participants for this specific pool
        const { data: allParticipants, error } = await supabase
          .from('participants')
          .select('*')
          .eq('pool_id', poolId)
          .eq('is_active', true)
          .order('name');

        if (error) {
          console.error('Error querying participants (excluding submitted):', error);
          throw error;
        }

        // Filter out participants who have already submitted
        const submittedIdsSet = new Set(submittedParticipantIds);
        const availableParticipants = allParticipants?.filter(participant => !submittedIdsSet.has(participant.id)) || [];
        
        console.log('loadUsers - filtered participants:', {
          poolId,
          week,
          seasonType,
          totalParticipants: allParticipants?.length || 0,
          submittedCount: submittedParticipantIds.length,
          availableCount: availableParticipants.length
        });
        
        return availableParticipants;
      } catch (error) {
        console.error('Error in loadUsers when filtering submitted users:', error);
        // Fall back to loading all users in the pool if there's an error
        console.log('Falling back to loading all participants due to filtering error');
      }
    }

    // Default query for all active participants in the pool (fallback)
    if (poolId) {
      try {
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
      } catch (fallbackError) {
        console.error('Error in fallback participant loading:', fallbackError);
        return [];
      }
    }

    // If no poolId provided, return empty array (shouldn't happen in normal flow)
    return [];
  } catch (error) {
    console.error('Error loading users:', error);
    throw error;
  }
}
