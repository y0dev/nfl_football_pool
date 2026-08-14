import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { findAccountByEmail, updateAccount } from '@/lib/accounts';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/rate-limit';
import { debugError } from '@/lib/utils';

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const STALE_KEY_DAYS = 30;

// Best-effort audit trail for this tool — never the key or password, just
// who attempted what and whether it worked. Reuses the existing audit_logs
// table (admin_id FK only points at `admins`, which is exactly who's ever
// allowed to call this route) rather than adding a new one.
async function logAttempt(adminId: string | null, outcome: string) {
  try {
    const supabase = getSupabaseServiceClient();
    await supabase.from('audit_logs').insert({
      action: 'dev_master_key_password_reset',
      admin_id: adminId,
      entity: 'admin',
      entity_id: adminId,
      details: { outcome },
    });
  } catch (e) {
    // Non-fatal — losing an audit entry shouldn't block or fail the request.
    debugError('Failed to write dev-reset-password audit log:', e);
  }
}

function keyStaleWarning(): string | undefined {
  const rotatedAt = process.env.DEV_MASTER_KEY_ROTATED_AT;
  if (!rotatedAt) return 'DEV_MASTER_KEY has no recorded rotation date — run `npm run generate-dev-key`.';
  const parsed = new Date(rotatedAt);
  if (isNaN(parsed.getTime())) return undefined;
  const ageDays = Math.floor((Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24));
  if (ageDays >= STALE_KEY_DAYS) {
    return `DEV_MASTER_KEY hasn't been rotated in ${ageDays} days — consider running \`npm run generate-dev-key\`.`;
  }
  return undefined;
}

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
// Also rate-limited (checkRateLimit — same in-memory limiter loginUser.ts
// uses, no database required) and audit-logged, both keyed off the caller's
// resolved account rather than anything client-supplied.
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ success: false, error: 'Not available' }, { status: 403 });
  }

  const expectedKey = process.env.DEV_MASTER_KEY;
  if (!expectedKey) {
    // Dev-facing config error, not a security leak — this route is
    // unreachable in production regardless of DEV_MASTER_KEY (checked above).
    return NextResponse.json(
      { success: false, error: 'DEV_MASTER_KEY is not set — run `npm run generate-dev-key` to create one.' },
      { status: 500 }
    );
  }

  try {
    const adminEmail = request.headers.get('x-admin-email');
    if (!adminEmail) {
      return NextResponse.json({ success: false, error: 'No admin email header' }, { status: 401 });
    }

    if (!checkRateLimit(`dev-reset-password:${adminEmail.toLowerCase()}`, RATE_LIMIT, RATE_WINDOW_MS)) {
      return NextResponse.json({ success: false, error: 'Too many attempts. Please wait 15 minutes and try again.' }, { status: 429 });
    }

    const account = await findAccountByEmail(adminEmail, { activeOnly: true });
    if (!account || account.role !== 'super_admin') {
      await logAttempt(account?.row.id ?? null, 'insufficient_permissions');
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
      await logAttempt(account.row.id, 'invalid_key');
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
      await logAttempt(account.row.id, 'db_error');
      return NextResponse.json({ success: false, error: 'Failed to reset password' }, { status: 500 });
    }

    await logAttempt(account.row.id, 'success');
    const warning = keyStaleWarning();
    return NextResponse.json({ success: true, ...(warning ? { warning } : {}) });
  } catch (error) {
    debugError('Dev password reset error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
