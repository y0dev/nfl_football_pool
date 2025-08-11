import { supabase } from '@/lib/supabase';

export async function loginUser(email: string) {
  try {
    const { data: admin, error } = await supabase
      .from('admins')
      .select('*')
      .eq('email', email)
      .single();

    if (error) throw error;
    return admin;
  } catch (error) {
    console.error('Error logging in user:', error);
    throw error;
  }
}
