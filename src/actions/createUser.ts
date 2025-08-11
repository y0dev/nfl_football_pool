import { supabase } from '@/lib/supabase';

export async function createUser(userData: {
  name: string;
  email: string;
  pool_id: string;
}) {
  try {
    const { data, error } = await supabase
      .from('participants')
      .insert({
        name: userData.name,
        email: userData.email,
        pool_id: userData.pool_id,
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
