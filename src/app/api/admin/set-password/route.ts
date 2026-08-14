import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { findAccountById, updateAccount, callerOwnsAccount } from '@/lib/accounts';
import { debugError } from '@/lib/utils';

// Lets a Google-only account (password_hash === 'google_oauth', no real
// password yet) create one, so it can sign in either way going forward.
// Distinct from /api/admin/change-password, which requires a current
// password and explicitly rejects Google-only accounts — there's no
// "current password" to confirm here since none exists yet.
export async function POST(request: NextRequest) {
  try {
    const { adminId, newPassword } = await request.json();

    if (!adminId || !newPassword) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ success: false, error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    if (!callerOwnsAccount(request, adminId)) {
      return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
    }

    const account = await findAccountById(adminId, { activeOnly: true });
    if (!account) {
      return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    }
    const { role, row: admin } = account;

    const hasRealPassword = !!admin.password_hash && admin.password_hash !== 'google_oauth';
    if (hasRealPassword) {
      return NextResponse.json({ success: false, error: 'This account already has a password — use Change Password instead' }, { status: 400 });
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    const { error } = await updateAccount(adminId, role, {
      password_hash: newHash,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      debugError('Set password error:', error.message);
      return NextResponse.json({ success: false, error: 'Failed to set password' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
