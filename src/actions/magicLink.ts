'use server';

import { createHmac } from 'crypto';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { setSessionCookie } from '@/actions/sessionCookie';
import { checkRateLimit } from '@/lib/rate-limit';
import { debugError } from '@/lib/utils';

const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

// 3 magic link requests per email per hour
const MAGIC_LIMIT = 3;
const MAGIC_WINDOW_MS = 60 * 60 * 1000;

function signingSecret(): string {
  // NEVER use NEXT_PUBLIC_ vars here — they are exposed in the browser bundle
  const s = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
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
  const payload = Buffer.from(`${email}::${expiresAt}`).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function parseToken(token: string): { email: string; valid: boolean; expired: boolean } {
  const invalid = { email: '', valid: false, expired: false };
  try {
    const dot = token.lastIndexOf('.');
    if (dot === -1) return invalid;
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    if (sign(payload) !== sig) return invalid;

    const decoded = Buffer.from(payload, 'base64url').toString();
    const sep = decoded.indexOf('::');
    if (sep === -1) return invalid;

    const email = decoded.slice(0, sep);
    const expiresAt = parseInt(decoded.slice(sep + 2), 10);
    if (isNaN(expiresAt)) return invalid;
    if (Date.now() > expiresAt) return { email, valid: false, expired: true };

    return { email, valid: true, expired: false };
  } catch {
    return invalid;
  }
}

export async function requestMagicLink(
  email: string
): Promise<{ success: boolean; error?: string }> {
  if (!email || !email.includes('@')) {
    return { success: false, error: 'Please enter a valid email address.' };
  }

  const normalizedEmail = email.toLowerCase().trim();

  if (!checkRateLimit(`magic:${normalizedEmail}`, MAGIC_LIMIT, MAGIC_WINDOW_MS)) {
    // Return success to avoid leaking whether the email exists or whether limit was hit
    return { success: true };
  }

  const supabase = getSupabaseServiceClient();
  const { data: admin, error } = await supabase
    .from('admins')
    .select('id, email, full_name, is_active')
    .eq('email', normalizedEmail)
    .single();

  if (error || !admin || !admin.is_active) {
    // Return success anyway to avoid email enumeration
    return { success: true };
  }

  const token = buildToken(admin.email);
  const magicUrl = `${appBaseUrl()}/login/verify?token=${encodeURIComponent(token)}`;

  try {
    const { emailService } = await import('@/lib/email');
    await emailService.sendMagicLink(admin.email, admin.full_name || 'Commissioner', magicUrl);
  } catch (err) {
    debugError('Magic link email send failed:', err);
    return { success: false, error: 'Failed to send magic link. Please try again.' };
  }

  return { success: true };
}

export async function verifyMagicLink(token: string): Promise<{
  success: boolean;
  user?: { id: string; email: string; full_name: string; is_super_admin: boolean };
  error?: string;
  expired?: boolean;
}> {
  const { email, valid, expired } = parseToken(token);

  if (expired) return { success: false, expired: true, error: 'This magic link has expired. Please request a new one.' };
  if (!valid) return { success: false, error: 'This magic link is invalid or has already been used.' };

  const supabase = getSupabaseServiceClient();
  const { data: admin, error } = await supabase
    .from('admins')
    .select('id, email, full_name, is_super_admin, is_active')
    .eq('email', email)
    .single();

  if (error || !admin || !admin.is_active) {
    return { success: false, error: 'Account not found or inactive.' };
  }

  // Set server-side session cookie so middleware can protect routes
  await setSessionCookie(admin.id);

  return {
    success: true,
    user: {
      id: admin.id,
      email: admin.email,
      full_name: admin.full_name || '',
      is_super_admin: admin.is_super_admin || false,
    },
  };
}
