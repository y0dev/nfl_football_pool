'use server';

import { createHmac } from 'crypto';
import { getSupabaseServiceClient } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { debugError } from '@/lib/utils';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

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
    .from('admins')
    .select('id, email, full_name, is_active, is_super_admin')
    .eq('id', adminId)
    .eq('is_active', true)
    .single();

  if (!admin) return { success: false, error: 'Account not found.' };
  if (admin.is_super_admin) return { success: false, error: 'Super admin accounts cannot be self-deleted.' };

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
    .from('admins')
    .select('id, email, full_name, is_active, is_super_admin')
    .eq('id', adminId)
    .eq('is_active', true)
    .single();

  if (!admin) return { success: false, error: 'Account not found.' };
  if (admin.is_super_admin) return { success: false, error: 'Super admin accounts cannot be self-deleted.' };

  const { error: deleteError } = await supabase.from('admins').delete().eq('id', adminId);
  if (deleteError) {
    debugError('Account deletion failed:', deleteError.code);
    return { success: false, error: 'Failed to delete account. Please try again.' };
  }

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
    .from('admins')
    .select('email, full_name')
    .eq('id', adminId)
    .single();

  return data ?? null;
}
