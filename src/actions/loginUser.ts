import { getSupabaseServiceClient } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { debugError } from '@/lib/utils';

const INVALID_CREDENTIALS = 'Invalid email or password.';

interface AdminData {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  is_super_admin: boolean;
  is_active: boolean;
}

export async function loginUser(email: string, password: string) {
  try {
    const supabase = getSupabaseServiceClient();

    const { data, error } = await supabase
      .from('admins')
      .select('*')
      .eq('email', email.trim().toLowerCase())
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      debugError('[SH][API][AUTH] Login query error:', error.code);
      return { success: false, error: 'Database connection error. Please try again.' };
    }

    if (!data) {
      return { success: false, error: INVALID_CREDENTIALS };
    }

    const adminData = data as AdminData;

    // Empty hash or OAuth-only accounts cannot use password login
    if (!adminData.password_hash || adminData.password_hash === 'google_oauth') {
      return { success: false, error: INVALID_CREDENTIALS };
    }

    const isValidPassword = await bcrypt.compare(password, adminData.password_hash);

    if (!isValidPassword) {
      return { success: false, error: INVALID_CREDENTIALS };
    }

    return {
      success: true,
      user: {
        id: adminData.id,
        email: adminData.email,
        full_name: adminData.full_name,
        is_super_admin: adminData.is_super_admin,
      },
    };
  } catch (error) {
    debugError('[SH][API][AUTH] Login error:', error instanceof Error ? error.message : 'unknown');
    return { success: false, error: 'An unexpected error occurred. Please try again.' };
  }
}
