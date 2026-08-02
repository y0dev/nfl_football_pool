import { NextRequest, NextResponse } from 'next/server';
import { findAccountById } from '@/lib/accounts';
import { debugError } from '@/lib/utils';

export async function GET(request: NextRequest) {
  const adminId = request.nextUrl.searchParams.get('adminId');

  if (!adminId) {
    return NextResponse.json({ success: false, error: 'Missing adminId' }, { status: 400 });
  }

  try {
    // Highest-traffic id lookup in the app (hit on ~every authenticated page
    // load via AdminGuard) — could be either a super-admin or a commissioner.
    const account = await findAccountById(adminId, { activeOnly: true });

    if (!account) {
      return NextResponse.json({ success: true, isAdmin: false, isSuperAdmin: false });
    }

    return NextResponse.json({ success: true, isAdmin: true, isSuperAdmin: account.role === 'super_admin' });
  } catch (e) {
    debugError('Verify admin status error:', e);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
