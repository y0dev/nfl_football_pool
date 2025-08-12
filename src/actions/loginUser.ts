import { getSupabaseClient } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export async function loginUser(email: string, password: string) {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('admins')
      .select('*')
      .eq('email', email)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return { success: false, error: 'Invalid credentials' };
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, data.password_hash);
    
    if (!isValidPassword) {
      return { success: false, error: 'Invalid credentials' };
    }

    return { 
      success: true, 
      user: {
        id: data.id,
        email: data.email,
        full_name: data.full_name,
        is_super_admin: data.is_super_admin
      }
    };
  } catch (error) {
    console.error('Error logging in user:', error);
    return { success: false, error: 'Login failed. Please try again.' };
  }
}
