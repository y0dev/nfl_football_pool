import { NextRequest, NextResponse } from 'next/server';
import { findAccountById } from '@/lib/accounts';

export async function GET(request: NextRequest) {
  const adminId = request.nextUrl.searchParams.get('adminId');

  if (!adminId) {
    return NextResponse.json({ success: false, error: 'Missing adminId' }, { status: 400 });
  }

  try {
    const account = await findAccountById(adminId, { activeOnly: true });

    if (!account) {
      return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    }

    const { row } = account;
    const hasPassword = !!row.password_hash && row.password_hash !== 'google_oauth';
    // Fallback covers rows that predate the google_linked column — the
    // OAuth callback self-heals this the next time they sign in with
    // Google, but this endpoint shouldn't show "not connected" in the
    // meantime for an account that plainly is.
    const googleLinked = row.google_linked === true || row.password_hash === 'google_oauth';

    return NextResponse.json({
      success: true,
      isOAuth: row.password_hash === 'google_oauth', // kept for existing callers
      hasPassword,
      googleLinked,
      createdAt: row.created_at,
      notificationPreferences: row.notification_preferences ?? null,
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
