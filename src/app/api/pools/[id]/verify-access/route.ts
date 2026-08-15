import { NextRequest, NextResponse } from 'next/server';
import { verifyPoolPasswordAttempt, poolAccessCookieName } from '@/lib/pool-access';
import { debugError } from '@/lib/utils';

// Server-side password verification for a private pool (Step 10 of the
// private-pool spec) — the ONLY place a supplied password is ever compared
// against the stored value. On success, sets a pool-specific, HttpOnly,
// signed cookie (see src/lib/pool-access.ts) so the visitor isn't
// re-prompted on every pool-related page. Never returns the password
// itself, encrypted or otherwise.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: poolId } = await params;
    const body = await request.json().catch(() => ({}));
    const password = typeof body?.password === 'string' ? body.password : '';

    const result = await verifyPoolPasswordAttempt(poolId, password);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 401 });
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set(poolAccessCookieName(poolId), result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: result.maxAgeSeconds,
    });
    return response;
  } catch (error) {
    debugError('Error verifying pool access:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
