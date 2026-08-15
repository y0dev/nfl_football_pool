'use server';

import { createHmac } from 'crypto';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import bcrypt from 'bcryptjs';
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

function buildToken(adminId: string): string {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = Buffer.from(`delete::${adminId}::${expiresAt}`).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export async function parseDeleteToken(token: string): Promise<{ adminId: string; valid: boolean; expired: boolean }> {
  const invalid = { adminId: '', valid: false, expired: false };
  try {
    const dot = token.lastIndexOf('.');
    if (dot === -1) return invalid;
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    if (sign(payload) !== sig) return invalid;

    const decoded = Buffer.from(payload, 'base64url').toString();
    const parts = decoded.split('::');
    if (parts.length !== 3 || parts[0] !== 'delete') return invalid;

    const adminId = parts[1];
    const expiresAt = parseInt(parts[2], 10);
    if (isNaN(expiresAt)) return invalid;
    if (Date.now() > expiresAt) return { adminId, valid: false, expired: true };

    return { adminId, valid: true, expired: false };
  } catch {
    return invalid;
  }
}

export async function requestDeletionConfirmation(adminId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseServiceClient();

  const { data: admin } = await supabase
    .from('commissioners')
    .select('id, email, full_name, is_active')
    .eq('id', adminId)
    .eq('is_active', true)
    .single();

  if (!admin) return { success: false, error: 'Account not found.' };

  const token = buildToken(admin.id);
  const confirmUrl = `${appBaseUrl()}/account/confirm-deletion?token=${encodeURIComponent(token)}`;

  try {
    const { emailService } = await import('@/lib/email');
    await emailService.sendDeletionConfirmationRequest(admin.email, admin.full_name || 'Commissioner', confirmUrl);
  } catch (err) {
    debugError('Deletion confirmation email failed:', err);
    return { success: false, error: 'Failed to send confirmation email. Please try again.' };
  }

  return { success: true };
}

export async function confirmAccountDeletion(token: string): Promise<{ success: boolean; error?: string; expired?: boolean }> {
  const { adminId, valid, expired } = await parseDeleteToken(token);

  if (expired) return { success: false, expired: true, error: 'This confirmation link has expired.' };
  if (!valid) return { success: false, error: 'This confirmation link is invalid.' };

  const supabase = getSupabaseServiceClient();

  const { data: admin } = await supabase
    .from('commissioners')
    .select('id, email, full_name, is_active')
    .eq('id', adminId)
    .eq('is_active', true)
    .single();

  if (!admin) return { success: false, error: 'Account not found.' };

  // Archive, don't hard-delete: a pool this commissioner owns has OTHER
  // people's data in it too — picks, scores, standings that belong to
  // participants who aren't the one deleting their account. Deactivating
  // (is_active: false) is the same soft-delete convention pools already use
  // elsewhere (see src/lib/plan.ts) — it frees the slot and drops the pool
  // from active listings without erasing anyone's history.
  const { error: poolsArchiveError } = await supabase
    .from('pools')
    .update({ is_active: false })
    .eq('created_by', admin.email);

  if (poolsArchiveError) {
    debugError('Archiving owned pools failed:', poolsArchiveError.code);
    return { success: false, error: 'Failed to delete account. Please try again.' };
  }

  const { error: huddlesArchiveError } = await supabase
    .from('huddles')
    .update({ is_active: false })
    .eq('commissioner_email', admin.email);

  if (huddlesArchiveError) {
    debugError('Archiving owned huddles failed:', huddlesArchiveError.code);
    return { success: false, error: 'Failed to delete account. Please try again.' };
  }

  // Deactivate rather than delete the commissioner row too — pools/picks/
  // scores/payments still reference this id (or created_by=email), and
  // is_active is already the gate every login/lookup path checks (see
  // findAccountByEmail/findAccountById in src/lib/accounts.ts), so this
  // alone is sufficient to fully remove sign-in and dashboard access.
  // password_hash is overwritten with an unusable value as defense in depth
  // even though the Auth user (deleted below) can no longer authenticate
  // either way.
  const { error: deactivateError } = await supabase
    .from('commissioners')
    .update({
      is_active: false,
      google_linked: false,
      password_hash: `deleted:${adminId}`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', adminId);

  if (deactivateError) {
    debugError('Account deactivation failed:', deactivateError.code);
    return { success: false, error: 'Failed to delete account. Please try again.' };
  }

  // Removes their ability to authenticate via Supabase (Google or any
  // future provider) — the app-level password above already blocks the
  // custom credential path, this closes the other one.
  try { await supabase.auth.admin.deleteUser(adminId); } catch { /* non-fatal */ }

  try {
    const { emailService } = await import('@/lib/email');
    await emailService.sendAccountDeletionConfirmation(admin.email, admin.full_name || 'Commissioner');
  } catch { /* non-fatal */ }

  return { success: true };
}

export async function getAdminByDeletionToken(token: string): Promise<{ email: string; full_name: string } | null> {
  const { adminId, valid } = await parseDeleteToken(token);
  if (!valid) return null;

  const supabase = getSupabaseServiceClient();
  const { data } = await supabase
    .from('commissioners')
    .select('email, full_name')
    .eq('id', adminId)
    .single();

  return data ?? null;
}
