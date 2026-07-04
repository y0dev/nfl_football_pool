import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { debugError } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const { adminId, password } = await request.json();

    if (!adminId || !password) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();

    const { data: admin, error } = await supabase
      .from('admins')
      .select('id, email, full_name, password_hash, is_active, is_super_admin')
      .eq('id', adminId)
      .eq('is_active', true)
      .single();

    if (error || !admin) {
      return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    }

    if (admin.is_super_admin) {
      return NextResponse.json({ success: false, error: 'Super admin accounts cannot be self-deleted' }, { status: 403 });
    }

    // Re-verify credentials before destructive action
    let verified = false;
    if (admin.password_hash) {
      verified = await bcrypt.compare(password, admin.password_hash);
    }

    // Fallback: try Supabase Auth for accounts created via create-commissioner (empty hash)
    if (!verified) {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: admin.email,
        password,
      });
      verified = !authError;
    }

    if (!verified) {
      return NextResponse.json({ success: false, error: 'Password is incorrect' }, { status: 401 });
    }

    // Delete pools this admin owns (created_by). Cascades to that pool's own
    // participants/picks/scores/etc. Pools owned by other commissioners that
    // this admin merely participates in elsewhere are left untouched.
    const { error: deletePoolsError } = await supabase
      .from('pools')
      .delete()
      .eq('created_by', admin.email);

    if (deletePoolsError) {
      debugError('[SH][API][AUTH] Delete owned pools error:', deletePoolsError.code);
      return NextResponse.json({ success: false, error: 'Failed to delete account' }, { status: 500 });
    }

    // Delete admin record (FK constraints may exist)
    const { error: deleteAdminError } = await supabase
      .from('admins')
      .delete()
      .eq('id', adminId);

    if (deleteAdminError) {
      debugError('[SH][API][AUTH] Delete admin record error:', deleteAdminError.code);
      return NextResponse.json({ success: false, error: 'Failed to delete account' }, { status: 500 });
    }

    // Delete Supabase Auth user (best-effort — may not exist for older accounts)
    try {
      await supabase.auth.admin.deleteUser(adminId);
    } catch {
      // Non-fatal: auth user may not exist for bcrypt-only accounts
    }

    // Send farewell email (best-effort)
    try {
      const { emailService } = await import('@/lib/email');
      await emailService.sendAccountDeletionConfirmation(admin.email, admin.full_name || 'Commissioner');
    } catch {
      // Non-fatal
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    debugError('[SH][API][AUTH] Delete account error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
