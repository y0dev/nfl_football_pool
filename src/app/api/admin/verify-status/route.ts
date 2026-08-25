import { NextRequest, NextResponse } from 'next/server';
import { findAccountById } from '@/lib/accounts';
import { debugError } from '@/lib/utils';

export async function GET(request: NextRequest) {
  // Identity comes from the httpOnly sh-session cookie, never from a
  // client-supplied adminId — the client previously sent its own
  // localStorage-cached id here, which is editable via devtools and let
  // anyone claim to be any other admin/commissioner's id. sh-session is set
  // server-side at login (password, magic link, and OAuth) and can't be
  // forged from the browser.
  const sessionId = request.cookies.get('sh-session')?.value;

  if (!sessionId) {
    return NextResponse.json({ success: true, isAdmin: false, isSuperAdmin: false });
  }

  try {
    // Highest-traffic id lookup in the app (hit on ~every authenticated page
    // load via AdminGuard) — could be either a super-admin or a commissioner.
    const account = await findAccountById(sessionId, { activeOnly: true });

    if (!account) {
      return NextResponse.json({ success: true, isAdmin: false, isSuperAdmin: false });
    }

    return NextResponse.json({ success: true, isAdmin: true, isSuperAdmin: account.role === 'super_admin' });
  } catch (e) {
    debugError('Verify admin status error:', e);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
