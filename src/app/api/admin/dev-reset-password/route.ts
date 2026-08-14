import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { findAccountByEmail, updateAccount } from '@/lib/accounts';
import { debugError } from '@/lib/utils';

// Development-only convenience tool (see the "Development Tools" card on
// src/app/admin/account/page.tsx) — lets the signed-in Super Admin reset
// their OWN password using a server-side master key, e.g. when locked out
// mid-testing. Two independent, unrelated checks gate this and BOTH are
// required — hiding the button client-side is not enough on its own:
//   1. NODE_ENV must genuinely be 'development', checked here regardless of
//      what the client sends or hides.
//   2. The caller must present the correct DEV_MASTER_KEY (server-only env
//      var, compared in constant time — never logged, never echoed back,
//      never stored anywhere).
// The target account is never a client-supplied id — it's resolved from the
// x-admin-email header the same way every other admin route in this app
// resolves the caller, so this can only ever reset the caller's own account.
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ success: false, error: 'Not available' }, { status: 403 });
  }

  const expectedKey = process.env.DEV_MASTER_KEY;
  if (!expectedKey) {
    // Dev-facing config error, not a security leak — this route is
    // unreachable in production regardless of DEV_MASTER_KEY (checked above).
    return NextResponse.json(
      { success: false, error: 'DEV_MASTER_KEY is not set — add it to .env.local to use this tool.' },
      { status: 500 }
    );
  }

  try {
    const adminEmail = request.headers.get('x-admin-email');
    if (!adminEmail) {
      return NextResponse.json({ success: false, error: 'No admin email header' }, { status: 401 });
    }

    const account = await findAccountByEmail(adminEmail, { activeOnly: true });
    if (!account || account.role !== 'super_admin') {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const { masterKey, newPassword } = await request.json();

    if (!masterKey || !newPassword) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const providedBuf = Buffer.from(String(masterKey));
    const expectedBuf = Buffer.from(expectedKey);
    const keyMatches = providedBuf.length === expectedBuf.length && crypto.timingSafeEqual(providedBuf, expectedBuf);
    if (!keyMatches) {
      // Same generic message regardless of how the key is wrong — never
      // confirm a partially-correct key or distinguish "wrong" from "close".
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ success: false, error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const { error } = await updateAccount(account.row.id, account.role, {
      password_hash: passwordHash,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      debugError('Dev password reset failed:', error.message);
      return NextResponse.json({ success: false, error: 'Failed to reset password' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    debugError('Dev password reset error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
