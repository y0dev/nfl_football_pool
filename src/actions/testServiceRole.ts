'use server';

import { getSupabaseServiceClient } from '@/lib/supabase';

export async function testServiceRole() {
  try {
    const supabase = getSupabaseServiceClient();
    console.log('testServiceRole: Testing service role access');
    
    // Try to insert a test record to see if RLS is bypassed
    const { data, error } = await supabase
      .from('participants')
      .insert({
        pool_id: '00000000-0000-0000-0000-000000000000', // Test UUID
        name: 'Test Service Role',
        email: 'test@service.role',
        is_active: true
      })
      .select()
      .single();

    if (error) {
      console.error('testServiceRole: Error with service role:', error);
      return { success: false, error: error.message };
    }

    console.log('testServiceRole: Service role working, data:', data);
    
    // Clean up the test record
    await supabase
      .from('participants')
      .delete()
      .eq('id', data.id);

    return { success: true, message: 'Service role is working correctly' };
  } catch (error) {
    console.error('testServiceRole: Unexpected error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
