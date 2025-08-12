import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { adminId, newPassword } = await request.json();

    // Validate input
    if (!adminId || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // Check if admin exists
    const { data: admin, error: checkError } = await supabase
      .from('admins')
      .select('id, email, full_name')
      .eq('id', adminId)
      .single();

    if (checkError || !admin) {
      return NextResponse.json(
        { success: false, error: 'Admin not found' },
        { status: 404 }
      );
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update admin password
    const { error: updateError } = await supabase
      .from('admins')
      .update({ password_hash: passwordHash })
      .eq('id', adminId);

    if (updateError) {
      console.error('Error updating admin password:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to reset password' },
        { status: 500 }
      );
    }

    // Log the password reset
    await supabase
      .from('audit_logs')
      .insert({
        action: 'reset_admin_password',
        admin_id: adminId,
        entity: 'admin',
        entity_id: adminId,
        details: `Password reset for ${admin.email}`
      });

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully',
      admin: {
        id: admin.id,
        email: admin.email,
        full_name: admin.full_name
      }
    });

  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
