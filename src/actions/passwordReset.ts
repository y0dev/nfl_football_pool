'use server';

import { createHmac } from 'crypto';
import { getSupabaseServiceClient } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function signingSecret(): string {
  const s = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error('Service key not set');
  return s;
}

function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

function sign(payload: string): string {
  return createHmac('sha256', signingSecret()).update(payload).digest('base64url');
}

function buildToken(email: string): string {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = Buffer.from(`reset::${email}::${expiresAt}`).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export async function parseResetToken(token: string): Promise<{ email: string; valid: boolean; expired: boolean }> {
  const invalid = { email: '', valid: false, expired: false };
  try {
    const dot = token.lastIndexOf('.');
    if (dot === -1) return invalid;
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    if (sign(payload) !== sig) return invalid;

    const decoded = Buffer.from(payload, 'base64url').toString();
    const parts = decoded.split('::');
    if (parts.length !== 3 || parts[0] !== 'reset') return invalid;

    const email = parts[1];
    const expiresAt = parseInt(parts[2], 10);
    if (isNaN(expiresAt)) return invalid;
    if (Date.now() > expiresAt) return { email, valid: false, expired: true };

    return { email, valid: true, expired: false };
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

  const supabase = getSupabaseServiceClient();
  const { data: admin } = await supabase
    .from('admins')
    .select('id, email, full_name, is_active')
    .eq('email', email.toLowerCase().trim())
    .single();

  // Always return success to avoid email enumeration
  if (!admin || !admin.is_active) return { success: true };

  const token = buildToken(admin.email);
  const resetUrl = `${appBaseUrl()}/login/reset-password?token=${encodeURIComponent(token)}`;

  try {
    const { emailService } = await import('@/lib/email');
    await emailService.sendPasswordResetLink(admin.email, admin.full_name || 'Commissioner', resetUrl);
  } catch (err) {
    console.error('Password reset email failed:', err);
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

  const { email, valid, expired } = await parseResetToken(token);

  if (expired) return { success: false, expired: true, error: 'This reset link has expired. Please request a new one.' };
  if (!valid) return { success: false, error: 'This reset link is invalid.' };

  const supabase = getSupabaseServiceClient();
  const { data: admin } = await supabase
    .from('admins')
    .select('id, is_active')
    .eq('email', email)
    .single();

  if (!admin || !admin.is_active) {
    return { success: false, error: 'Account not found.' };
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  const { error: updateError } = await supabase
    .from('admins')
    .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
    .eq('id', admin.id);

  if (updateError) {
    console.error('Password reset update failed:', updateError.code);
    return { success: false, error: 'Failed to update password. Please try again.' };
  }

  // Also update Supabase Auth password for accounts that use it
  try {
    await supabase.auth.admin.updateUserById(admin.id, { password: newPassword });
  } catch {
    // Non-fatal — older accounts may not have a Supabase Auth entry
  }

  // Send confirmation email (best-effort)
  try {
    const { data: adminRecord } = await supabase
      .from('admins')
      .select('email, full_name')
      .eq('id', admin.id)
      .single();
    if (adminRecord) {
      const { emailService } = await import('@/lib/email');
      await emailService.sendPasswordResetConfirmation(adminRecord.email, adminRecord.full_name || 'Commissioner');
    }
  } catch { /* non-fatal */ }

  return { success: true };
}
