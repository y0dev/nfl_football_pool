import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { emailService } from '@/lib/email';
import { debugError, debugWarn } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const { adminId, newPassword } = await request.json();

    if (!adminId || !newPassword) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ success: false, error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();

    const { data: targetAdmin, error: targetAdminError } = await supabase
      .from('admins')
      .select('id, email, full_name, is_super_admin')
      .eq('id', adminId)
      .single();

    if (targetAdminError || !targetAdmin) {
      return NextResponse.json({ success: false, error: 'Admin not found' }, { status: 404 });
    }

    if (targetAdmin.is_super_admin) {
      return NextResponse.json({ success: false, error: 'Cannot reset super admin passwords' }, { status: 403 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    const { error: updateError } = await supabase
      .from('admins')
      .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
      .eq('id', adminId);

    if (updateError) {
      debugError('[SH][API][AUTH] Password update failed:', updateError);
      return NextResponse.json({ success: false, error: 'Failed to update password' }, { status: 500 });
    }

    // Notify the commissioner their password changed
    try {
      await emailService.sendPasswordResetNotification(
        targetAdmin.email,
        targetAdmin.full_name || 'Commissioner'
      );
    } catch (emailError) {
      debugWarn('[SH][API][AUTH] Password reset notification email failed:', emailError);
    }

    return NextResponse.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    debugError('[SH][API][AUTH] Password reset error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
