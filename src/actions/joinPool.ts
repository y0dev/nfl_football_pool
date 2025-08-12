import { getSupabaseClient } from '@/lib/supabase';

export async function joinPool(poolId: string, userEmail: string, userName?: string) {
  console.log('joinPool: Starting join process', { poolId, userEmail, userName });
  
  try {
    const supabase = getSupabaseClient();
    
    // Check if user is already in the pool
    console.log('joinPool: Checking if user already exists in pool');
    const { data: existingParticipant, error: checkError } = await supabase
      .from('participants')
      .select('id')
      .eq('pool_id', poolId)
      .eq('email', userEmail)
      .eq('is_active', true)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('joinPool: Error checking existing participant:', checkError);
      throw checkError;
    }

    if (existingParticipant) {
      console.log('joinPool: User already exists in pool');
      throw new Error('User is already a participant in this pool');
    }

    console.log('joinPool: User not in pool, creating new participant');

    // Create new participant entry
    const participantData = {
      pool_id: poolId,
      name: userName || userEmail.split('@')[0], // Use email prefix as name if not provided
      email: userEmail,
      is_active: true
    };
    
    console.log('joinPool: Inserting participant data:', participantData);
    
    const { data, error } = await supabase
      .from('participants')
      .insert(participantData)
      .select()
      .single();

    if (error) {
      console.error('joinPool: Error inserting participant:', error);
      throw error;
    }
    
    console.log('joinPool: Successfully created participant:', data);
    return data;
  } catch (error) {
    console.error('Error joining pool:', error);
    throw error;
  }
}
