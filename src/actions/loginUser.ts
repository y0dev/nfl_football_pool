import { getSupabaseClient } from '@/lib/supabase';

export async function loginUser(email: string) {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('admins')
      .select('*')
      .eq('email', email)
      .single();

    if (error) {
      throw error;
    }

    return { success: true, user: data };
  } catch (error) {
    console.error('Error logging in user:', error);
    return { success: false, error: 'Invalid credentials' };
  }
}
