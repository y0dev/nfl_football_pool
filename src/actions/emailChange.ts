'use server';

import { createHmac } from 'crypto';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { debugError } from '@/lib/utils';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

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

// newEmail travels inside the signed token itself (not looked up from a DB
// row at confirm time) so the confirmation always applies exactly the email
// address that was verified as reachable, even if requested again later.
function buildToken(adminId: string, newEmail: string): string {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = Buffer.from(`emailchange::${adminId}::${newEmail}::${expiresAt}`).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

interface ParsedToken {
  adminId: string;
  newEmail: string;
  valid: boolean;
  expired: boolean;
}

export async function parseEmailChangeToken(token: string): Promise<ParsedToken> {
  const invalid: ParsedToken = { adminId: '', newEmail: '', valid: false, expired: false };
  try {
    const dot = token.lastIndexOf('.');
    if (dot === -1) return invalid;
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    if (sign(payload) !== sig) return invalid;

    const decoded = Buffer.from(payload, 'base64url').toString();
    const parts = decoded.split('::');
    if (parts.length !== 4 || parts[0] !== 'emailchange') return invalid;

    const [, adminId, newEmail, expiresAtStr] = parts;
    const expiresAt = parseInt(expiresAtStr, 10);
    if (isNaN(expiresAt)) return invalid;
    if (Date.now() > expiresAt) return { adminId, newEmail, valid: false, expired: true };

    return { adminId, newEmail, valid: true, expired: false };
  } catch {
    return invalid;
  }
}

export async function requestEmailChange(adminId: string, newEmail: string): Promise<{ success: boolean; error?: string }> {
  const normalized = newEmail.trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) {
    return { success: false, error: 'Enter a valid email address.' };
  }

  const supabase = getSupabaseServiceClient();

  const { data: admin } = await supabase
    .from('commissioners')
    .select('id, email, full_name, is_active')
    .eq('id', adminId)
    .eq('is_active', true)
    .single();

  if (!admin) return { success: false, error: 'Account not found.' };

  if (admin.email.toLowerCase() === normalized) {
    return { success: false, error: 'That is already your current email address.' };
  }

  // Prevent duplicate accounts — same uniqueness rule as commissioners.email.
  const { data: taken } = await supabase
    .from('commissioners')
    .select('id')
    .eq('email', normalized)
    .maybeSingle();
  if (taken) {
    return { success: false, error: 'An account with that email already exists.' };
  }

  const token = buildToken(admin.id, normalized);
  const confirmUrl = `${appBaseUrl()}/account/confirm-email-change?token=${encodeURIComponent(token)}`;

  try {
    const { emailService } = await import('@/lib/email');
    // Sent to the NEW address — completing this proves they can actually
    // receive mail there, not just that they typed it into a form.
    await emailService.sendEmailChangeConfirmation(normalized, admin.full_name || 'Commissioner', confirmUrl);
  } catch (err) {
    debugError('Email change confirmation email failed:', err);
    return { success: false, error: 'Failed to send confirmation email. Please try again.' };
  }

  return { success: true };
}

export async function confirmEmailChange(token: string): Promise<{ success: boolean; error?: string; expired?: boolean; newEmail?: string }> {
  const { adminId, newEmail, valid, expired } = await parseEmailChangeToken(token);

  if (expired) return { success: false, expired: true, error: 'This confirmation link has expired.' };
  if (!valid) return { success: false, error: 'This confirmation link is invalid.' };

  const supabase = getSupabaseServiceClient();

  const { data: admin } = await supabase
    .from('commissioners')
    .select('id, email, full_name, stripe_customer_id, is_active')
    .eq('id', adminId)
    .eq('is_active', true)
    .single();

  if (!admin) return { success: false, error: 'Account not found.' };

  // Re-check uniqueness at confirm time too — someone else could have
  // claimed this email in the window since the request was sent.
  const { data: taken } = await supabase
    .from('commissioners')
    .select('id')
    .eq('email', newEmail)
    .neq('id', adminId)
    .maybeSingle();
  if (taken) {
    return { success: false, error: 'This email was claimed by another account in the meantime.' };
  }

  const oldEmail = admin.email;

  const { error: updateError } = await supabase
    .from('commissioners')
    .update({ email: newEmail, updated_at: new Date().toISOString() })
    .eq('id', adminId);

  if (updateError) {
    debugError('Email change update failed:', updateError.code);
    return { success: false, error: 'Failed to update email. Please try again.' };
  }

  // Best-effort: keep Supabase Auth and Stripe in sync — a failure here
  // doesn't undo the email change (it's the app's own commissioners row
  // that every login/lookup actually checks), but should be visible.
  try {
    await supabase.auth.admin.updateUserById(adminId, { email: newEmail });
  } catch (err) {
    debugError('Failed to update Supabase Auth email (non-fatal):', err);
  }

  if (admin.stripe_customer_id) {
    try {
      const { getStripe } = await import('@/lib/stripe');
      await getStripe().customers.update(admin.stripe_customer_id, { email: newEmail });
    } catch (err) {
      debugError('Failed to update Stripe customer email (non-fatal):', err);
    }
  }

  try {
    const { emailService } = await import('@/lib/email');
    // Notify the OLD address too — standard security practice so an actual
    // account takeover doesn't go unnoticed by the real owner.
    await emailService.sendEmailChangedNotification(oldEmail, admin.full_name || 'Commissioner', newEmail);
  } catch { /* non-fatal */ }

  return { success: true, newEmail };
}

export async function getEmailChangeDetails(token: string): Promise<{ newEmail: string } | null> {
  const { valid, newEmail } = await parseEmailChangeToken(token);
  if (!valid) return null;
  return { newEmail };
}
