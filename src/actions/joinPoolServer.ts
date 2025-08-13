'use server';

import { getSupabaseServiceClient } from '@/lib/supabase';

export async function joinPoolServer(poolId: string, userEmail: string, userName?: string) {
  console.log('joinPoolServer: Starting join process', { poolId, userEmail, userName });
  
  // Debug environment variables
  console.log('joinPoolServer: Environment check:', {
    hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    serviceKeyLength: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
    serviceKeyPrefix: process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 10) || 'none'
  });
  
  try {
    const supabase = getSupabaseServiceClient();
    console.log('joinPoolServer: Using service client for RLS bypass');
    
    // Test the service role with a simple query first
    console.log('joinPoolServer: Testing service role with simple query');
    const { data: testData, error: testError } = await supabase
      .from('participants')
      .select('count')
      .limit(1);
    
    if (testError) {
      console.error('joinPoolServer: Service role test failed:', testError);
    } else {
      console.log('joinPoolServer: Service role test successful');
    }
    
    // Check if user is already in the pool
    console.log('joinPoolServer: Checking if user already exists in pool');
    const { data: existingParticipant, error: checkError } = await supabase
      .from('participants')
      .select('id')
      .eq('pool_id', poolId)
      .eq('email', userEmail.trim().toLowerCase())
      .eq('is_active', true)
      .maybeSingle();

    if (checkError) {
      console.error('joinPoolServer: Error checking existing participant:', checkError);
      throw checkError;
    }

    if (existingParticipant) {
      console.log('joinPoolServer: User already exists in pool');
      throw new Error('User is already a participant in this pool');
    }

    console.log('joinPoolServer: User not in pool, creating new participant');

    // Create new participant entry
    const participantData = {
      pool_id: poolId,
      name: userName || userEmail.split('@')[0], // Use email prefix as name if not provided
      email: userEmail.trim().toLowerCase(),
      is_active: true
    };
    
    console.log('joinPoolServer: Inserting participant data:', participantData);
    
    const { data, error } = await supabase
      .from('participants')
      .insert(participantData)
      .select()
      .single();

    if (error) {
      console.error('joinPoolServer: Error inserting participant:', error);
      throw error;
    }
    
    console.log('joinPoolServer: Successfully created participant:', data);
    return { success: true, data };
  } catch (error) {
    console.error('Error joining pool:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to join pool' 
    };
  }
}
