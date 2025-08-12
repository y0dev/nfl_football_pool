import { getSupabaseClient } from '@/lib/supabase';

export async function createUser(userData: {
  name: string;
  email: string;
  poolId: string;
}) {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('participants')
      .insert({
        name: userData.name,
        email: userData.email,
        pool_id: userData.poolId,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}
