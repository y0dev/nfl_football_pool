import { NextRequest, NextResponse } from 'next/server';
import { findAccountById, updateAccount } from '@/lib/accounts';
import { debugError } from '@/lib/utils';

// Disconnects Google as a sign-in method. Requires the account to have a
// real password set first — an account can never be left with zero sign-in
// methods (see src/app/auth/callback/route.ts, which is the only other
// place google_linked is ever written).
export async function POST(request: NextRequest) {
  try {
    const { adminId } = await request.json();
    if (!adminId) {
      return NextResponse.json({ success: false, error: 'Missing adminId' }, { status: 400 });
    }

    const account = await findAccountById(adminId, { activeOnly: true });
    if (!account) {
      return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    }
    const { role, row: admin } = account;

    if (admin.google_linked !== true) {
      return NextResponse.json({ success: false, error: 'Google is not connected to this account' }, { status: 400 });
    }

    const hasRealPassword = !!admin.password_hash && admin.password_hash !== 'google_oauth';
    if (!hasRealPassword) {
      return NextResponse.json({
        success: false,
        error: 'Create a password first — an account needs at least one sign-in method.',
      }, { status: 400 });
    }

    const { error } = await updateAccount(adminId, role, {
      google_linked: false,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      debugError('Unlink Google error:', error.message);
      return NextResponse.json({ success: false, error: 'Failed to disconnect Google' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
