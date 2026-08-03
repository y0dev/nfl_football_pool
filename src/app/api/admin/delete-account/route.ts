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

    // Self-delete is commissioner-only (super-admins are managed separately,
    // never through this self-service route) — commissioners is the only
    // table that could ever contain adminId now.
    const { data: admin, error } = await supabase
      .from('commissioners')
      .select('id, email, full_name, password_hash, is_active')
      .eq('id', adminId)
      .eq('is_active', true)
      .single();

    if (error || !admin) {
      return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
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

    // Archive, don't hard-delete — same reasoning and pattern as
    // src/actions/accountDeletion.ts's email-confirmation flow (the one
    // actually wired to the Danger Zone UI): a pool this admin owns has
    // other participants' picks/scores/standings in it too, which shouldn't
    // vanish because the owner deleted their own account.
    const { error: archivePoolsError } = await supabase
      .from('pools')
      .update({ is_active: false })
      .eq('created_by', admin.email);

    if (archivePoolsError) {
      debugError('Archive owned pools error:', archivePoolsError.code);
      return NextResponse.json({ success: false, error: 'Failed to delete account' }, { status: 500 });
    }

    const { error: archiveHuddlesError } = await supabase
      .from('huddles')
      .update({ is_active: false })
      .eq('commissioner_email', admin.email);

    if (archiveHuddlesError) {
      debugError('Archive owned huddles error:', archiveHuddlesError.code);
      return NextResponse.json({ success: false, error: 'Failed to delete account' }, { status: 500 });
    }

    // Deactivate rather than delete the commissioner row — is_active is
    // already the gate every login/lookup path checks, so this alone fully
    // removes sign-in and dashboard access while preserving referential data.
    const { error: deactivateError } = await supabase
      .from('commissioners')
      .update({
        is_active: false,
        google_linked: false,
        password_hash: `deleted:${adminId}`,
      })
      .eq('id', adminId);

    if (deactivateError) {
      debugError('Deactivate admin record error:', deactivateError.code);
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
    debugError('Delete account error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
