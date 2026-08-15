import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import bcrypt from 'bcryptjs';
import { emailService } from '@/lib/email';
import { debugError, debugWarn } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    // Resets an arbitrary commissioner's password by id — the only thing
    // standing between this and a full account takeover is verifying the
    // caller is an active super admin.
    const adminEmail = request.headers.get('x-admin-email');
    if (!adminEmail) {
      return NextResponse.json({ success: false, error: 'No admin email header' }, { status: 401 });
    }

    const supabase = getSupabaseServiceClient();

    const { data: currentAdmin } = await supabase
      .from('admins')
      .select('is_super_admin, is_active')
      .eq('email', adminEmail)
      .eq('is_active', true)
      .single();

    if (!currentAdmin?.is_super_admin) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const { adminId, newPassword } = await request.json();

    if (!adminId || !newPassword) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ success: false, error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    // This route only ever resets commissioner passwords (super-admin
    // password resets go through /api/super-admin/reset-password).
    const { data: targetAdmin, error: targetAdminError } = await supabase
      .from('commissioners')
      .select('id, email, full_name')
      .eq('id', adminId)
      .single();

    if (targetAdminError || !targetAdmin) {
      return NextResponse.json({ success: false, error: 'Admin not found' }, { status: 404 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    const { error: updateError } = await supabase
      .from('commissioners')
      .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
      .eq('id', adminId);

    if (updateError) {
      debugError('Password update failed:', updateError);
      return NextResponse.json({ success: false, error: 'Failed to update password' }, { status: 500 });
    }

    // Notify the commissioner their password changed
    try {
      await emailService.sendPasswordResetNotification(
        targetAdmin.email,
        targetAdmin.full_name || 'Commissioner'
      );
    } catch (emailError) {
      debugWarn('Password reset notification email failed:', emailError);
    }

    return NextResponse.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    debugError('Password reset error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
