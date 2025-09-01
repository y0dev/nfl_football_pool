import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    // Verify the request is from a super admin
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'No authorization header' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = getSupabaseServiceClient();
    
    // Get user from token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    // Verify user is a super admin
    const { data: currentAdmin, error: currentAdminError } = await supabase
      .from('admins')
      .select('is_super_admin')
      .eq('email', user.email)
      .single();
    
    if (currentAdminError || !currentAdmin || !currentAdmin.is_super_admin) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    // Parse request body
    const { adminId, newPassword } = await request.json();
    
    if (!adminId || !newPassword) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ success: false, error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    // Get the admin record to verify it exists and is not a super admin
    const { data: targetAdmin, error: targetAdminError } = await supabase
      .from('admins')
      .select('*')
      .eq('id', adminId)
      .single();

    if (targetAdminError || !targetAdmin) {
      return NextResponse.json({ success: false, error: 'Admin not found' }, { status: 404 });
    }

    if (targetAdmin.is_super_admin) {
      return NextResponse.json({ success: false, error: 'Cannot reset super admin passwords' }, { status: 403 });
    }

    // Update the password in the admins table
    const { error: updateError } = await supabase
      .from('admins')
      .update({ 
        password: newPassword,
        updated_at: new Date().toISOString()
      })
      .eq('id', adminId);

    if (updateError) {
      console.error('Error updating password:', updateError);
      return NextResponse.json({ success: false, error: 'Failed to update password' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Password reset successfully' 
    });

  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
