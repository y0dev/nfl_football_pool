import { getSupabaseServiceClient } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

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
    
    if (process.env.NODE_ENV === 'development') {
      console.log('LoginUser: Attempting login for email:', email);
      console.log('LoginUser: Email after trim and lowercase:', email.trim().toLowerCase());
      console.log('LoginUser: Using service client to bypass RLS');
    }
    
    // First, try to get the admin by email
    const { data, error } = await supabase
      .from('admins')
      .select('*')
      .eq('email', email.trim().toLowerCase())
      .eq('is_active', true)
      .maybeSingle();

    if (process.env.NODE_ENV === 'development') {
      console.log('LoginUser: Query result - data:', data);
      console.log('LoginUser: Query result - error:', error);
      console.log('LoginUser: Email used in query:', email.trim().toLowerCase());
    }
    
    if (error) {
      console.error('Supabase error:', error);
      return { success: false, error: 'Database connection error. Please try again.' };
    }

    if (!data) {
      if (process.env.NODE_ENV === 'development') {
        console.log('LoginUser: No admin found with email:', email.trim().toLowerCase());
        console.log('LoginUser: Checking if any admins exist in the table...');
      }
      
      // Let's check if there are any admins at all
      const { data: allAdmins, error: allAdminsError } = await supabase
        .from('admins')
        .select('email, is_active, created_at')
        .limit(5);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('LoginUser: All admins in table:', allAdmins);
        console.log('LoginUser: All admins error:', allAdminsError);
      }
      
      // Let's also check the table structure
      try {
        const { data: tableInfo, error: tableError } = await supabase
          .from('admins')
          .select('*')
          .limit(1);
        
        if (process.env.NODE_ENV === 'development') {
          console.log('LoginUser: Table structure check - data:', tableInfo);
          console.log('LoginUser: Table structure check - error:', tableError);
        }
      } catch (tableErr) {
        if (process.env.NODE_ENV === 'development') {
          console.log('LoginUser: Table structure check - exception:', tableErr);
        }
      }
      
      return { success: false, error: 'No account found with this email address. Please check your email or contact an administrator.' };
    }

    // Verify password
    const adminData = data as AdminData;
    const isValidPassword = await bcrypt.compare(password, adminData.password_hash);
    
    if (process.env.NODE_ENV === 'development') {
      console.log('LoginUser: Is valid password:', isValidPassword);
    }
    
    if (!isValidPassword) {
      return { success: false, error: 'Incorrect password. Please try again.' };
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('LoginUser: User:', adminData);
    }
    
    return { 
      success: true, 
      user: {
        id: adminData.id,
        email: adminData.email,
        full_name: adminData.full_name,
        is_super_admin: adminData.is_super_admin
      }
    };
  } catch (error) {
    console.error('Error logging in user:', error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: 'An unexpected error occurred. Please try again.' };
  }
}
