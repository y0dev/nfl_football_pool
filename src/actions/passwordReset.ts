'use server';

import { createHmac } from 'crypto';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { findAccountByEmail, findAccountById, updateAccount } from '@/lib/accounts';
import { checkRateLimit } from '@/lib/rate-limit';
import bcrypt from 'bcryptjs';
import { debugError } from '@/lib/utils';

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

// 3 reset requests per email per hour
const RESET_LIMIT = 3;
const RESET_WINDOW_MS = 60 * 60 * 1000;

function signingSecret(): string {
  const s = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY;
  if (!s) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return s;
}

function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

function sign(payload: string): string {
  return createHmac('sha256', signingSecret()).update(payload).digest('base64url');
}

// Stateless token (no DB row to track), so single-use is enforced by
// binding it to the account's updated_at at issuance time rather than a
// separate "used tokens" table: resetPasswordWithToken always bumps
// updated_at when it succeeds, so a replayed token's embedded value no
// longer matches the account's current one and is rejected. The rare false
// positive (something else updates the account between request and use) is
// an acceptable tradeoff — it just means requesting a fresh link.
function buildToken(email: string, updatedAt: string | null): string {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = Buffer.from(`reset::${email}::${expiresAt}::${updatedAt ?? ''}`).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export async function parseResetToken(token: string): Promise<{ email: string; valid: boolean; expired: boolean; updatedAt: string | null }> {
  const invalid = { email: '', valid: false, expired: false, updatedAt: null };
  try {
    const dot = token.lastIndexOf('.');
    if (dot === -1) return invalid;
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    if (sign(payload) !== sig) return invalid;

    const decoded = Buffer.from(payload, 'base64url').toString();
    const parts = decoded.split('::');
    if (parts.length !== 4 || parts[0] !== 'reset') return invalid;

    const email = parts[1];
    const expiresAt = parseInt(parts[2], 10);
    const updatedAt = parts[3] || null;
    if (isNaN(expiresAt)) return invalid;
    if (Date.now() > expiresAt) return { email, valid: false, expired: true, updatedAt };

    return { email, valid: true, expired: false, updatedAt };
  } catch {
    return invalid;
  }
}

export async function requestPasswordReset(
  email: string
): Promise<{ success: boolean; error?: string }> {
  if (!email || !email.includes('@')) {
    return { success: false, error: 'Please enter a valid email address.' };
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Rate limit silently — return success to avoid enumeration
  if (!(await checkRateLimit(`reset:${normalizedEmail}`, RESET_LIMIT, RESET_WINDOW_MS))) {
    return { success: true };
  }

  const account = await findAccountByEmail(normalizedEmail);

  // Always return success to avoid email enumeration
  if (!account || !account.row.is_active) return { success: true };
  const admin = account.row;

  const token = buildToken(admin.email, admin.updated_at);
  const resetUrl = `${appBaseUrl()}/login/reset-password?token=${encodeURIComponent(token)}`;

  try {
    const { emailService } = await import('@/lib/email');
    const sent = await emailService.sendPasswordResetLink(admin.email, admin.full_name || 'Commissioner', resetUrl);
    // sendEmail() catches SMTP errors internally and resolves false rather
    // than throwing, so a delivery failure never reaches this catch block —
    // log it here instead. Still returns {success:true} to the client (not
    // {success:false}) to preserve the anti-enumeration guarantee above:
    // the response must look identical whether the account doesn't exist
    // or the account exists but the send failed.
    if (!sent) debugError('Password reset email failed to send (no exception thrown) for:', admin.email);
  } catch (err) {
    debugError('Password reset email failed:', err);
    return { success: false, error: 'Failed to send reset email. Please try again.' };
  }

  return { success: true };
}

export async function resetPasswordWithToken(
  token: string,
  newPassword: string
): Promise<{ success: boolean; error?: string; expired?: boolean }> {
  if (newPassword.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters.' };
  }

  const { email, valid, expired, updatedAt } = await parseResetToken(token);

  if (expired) return { success: false, expired: true, error: 'This reset link has expired. Please request a new one.' };
  if (!valid) return { success: false, error: 'This reset link is invalid.' };

  const account = await findAccountByEmail(email);

  if (!account || !account.row.is_active) {
    return { success: false, error: 'Account not found.' };
  }
  const { role, row: admin } = account;

  // Single-use enforcement: the token was issued for this specific
  // updated_at value. If the account has changed since (most commonly,
  // this exact token was already redeemed once), reject the replay.
  if ((admin.updated_at ?? '') !== (updatedAt ?? '')) {
    return { success: false, error: 'This reset link has already been used or is out of date. Please request a new one.' };
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  const { error: updateError } = await updateAccount(admin.id, role, {
    password_hash: passwordHash,
    updated_at: new Date().toISOString(),
  });

  if (updateError) {
    debugError('Password reset update failed:', updateError.code);
    return { success: false, error: 'Failed to update password. Please try again.' };
  }

  // Also update Supabase Auth password for accounts that use it
  try {
    const supabase = getSupabaseServiceClient();
    await supabase.auth.admin.updateUserById(admin.id, { password: newPassword });
  } catch {
    // Non-fatal — older accounts may not have a Supabase Auth entry
  }

  // Send confirmation email (best-effort)
  try {
    const refreshed = await findAccountById(admin.id);
    if (refreshed) {
      const { emailService } = await import('@/lib/email');
      await emailService.sendPasswordResetConfirmation(refreshed.row.email, refreshed.row.full_name || 'Commissioner');
    }
  } catch { /* non-fatal */ }

  return { success: true };
}
