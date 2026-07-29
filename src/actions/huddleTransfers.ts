'use server';

import { getSupabaseServiceClient } from '@/lib/supabase';
import { checkHuddleCapacity } from '@/lib/plan';
import { emailService } from '@/lib/email';
import { debugError } from '@/lib/utils';

const TRANSFER_EXPIRY_DAYS = 7;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type InitiateHuddleTransferResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Starts a Huddle ownership transfer. Neither huddles.commissioner_email
 * nor any of the Huddle's pools' created_by changes until BOTH the current
 * commissioner (fromEmail) and the recipient (toEmail) confirm via their
 * own emailed link — see confirmHuddleTransfer. Starting a new request
 * supersedes (cancels) any other pending request for the same Huddle, so
 * only one is ever active.
 */
export async function initiateHuddleTransfer(
  huddleId: string,
  fromEmail: string,
  toEmail: string
): Promise<InitiateHuddleTransferResult> {
  try {
    const supabase = getSupabaseServiceClient();
    const normalizedFrom = fromEmail.trim().toLowerCase();
    const normalizedTo = toEmail.trim().toLowerCase();

    if (!normalizedTo) {
      return { success: false, error: 'Enter the recipient commissioner’s email.' };
    }
    if (normalizedTo === normalizedFrom) {
      return { success: false, error: 'You already own this Huddle.' };
    }

    const { data: huddle } = await supabase
      .from('huddles')
      .select('id, name, commissioner_email')
      .eq('id', huddleId)
      .maybeSingle();

    if (!huddle || huddle.commissioner_email.toLowerCase() !== normalizedFrom) {
      return { success: false, error: 'Huddle not found for your account.' };
    }

    const { data: recipient } = await supabase
      .from('admins')
      .select('email, full_name, is_active, is_super_admin')
      .eq('email', normalizedTo)
      .maybeSingle();

    if (!recipient || !recipient.is_active) {
      return { success: false, error: 'No active commissioner account found for that email.' };
    }
    if (recipient.is_super_admin) {
      return { success: false, error: 'Cannot transfer a Huddle to a super admin account.' };
    }

    // Only one pending request per Huddle at a time — supersede any other.
    await supabase
      .from('huddle_transfer_requests')
      .update({ status: 'cancelled' })
      .eq('huddle_id', huddleId)
      .eq('status', 'pending');

    const expiresAt = new Date(Date.now() + TRANSFER_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data: request, error } = await supabase
      .from('huddle_transfer_requests')
      .insert({
        huddle_id: huddleId,
        from_email: normalizedFrom,
        to_email: recipient.email,
        expires_at: expiresAt,
      })
      .select('from_token, to_token')
      .single();

    if (error || !request) {
      debugError('Failed to create huddle transfer request:', error);
      return { success: false, error: 'Failed to start the transfer. Please try again.' };
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const fromLink = `${baseUrl}/league/transfer/${request.from_token}`;
    const toLink = `${baseUrl}/league/transfer/${request.to_token}`;

    await Promise.all([
      emailService.sendHuddleTransferConfirmation(normalizedFrom, huddle.name, recipient.email, fromLink),
      emailService.sendHuddleTransferApprovalRequest(recipient.email, recipient.full_name || recipient.email, huddle.name, normalizedFrom, toLink),
    ]);

    return { success: true };
  } catch (error) {
    debugError('Unexpected error initiating huddle transfer:', error);
    return { success: false, error: 'An unexpected error occurred. Please try again.' };
  }
}

export type ConfirmHuddleTransferResult =
  | { success: true; status: 'waiting'; huddleName: string; otherEmail: string }
  | { success: true; status: 'completed'; huddleName: string }
  | { success: false; error: string };

/**
 * Confirms one side of a pending transfer via its emailed token. callerEmail
 * is the logged-in user's session email — it must match whichever party the
 * token belongs to (the /league route is already login-gated, so this is a
 * second factor on top of the token, not a replacement for it). Once both
 * sides have confirmed, executes the transfer: reassigns
 * huddles.commissioner_email and every one of its pools' created_by to the
 * recipient.
 */
export async function confirmHuddleTransfer(token: string, callerEmail: string): Promise<ConfirmHuddleTransferResult> {
  try {
    if (!UUID_RE.test(token)) {
      return { success: false, error: 'This transfer link is invalid.' };
    }

    const supabase = getSupabaseServiceClient();

    const { data: request } = await supabase
      .from('huddle_transfer_requests')
      .select('*')
      .or(`from_token.eq.${token},to_token.eq.${token}`)
      .maybeSingle();

    if (!request) {
      return { success: false, error: 'This transfer link is invalid.' };
    }
    if (request.status !== 'pending') {
      return { success: false, error: `This transfer request is no longer pending (${request.status}).` };
    }
    if (new Date(request.expires_at) < new Date()) {
      await supabase.from('huddle_transfer_requests').update({ status: 'cancelled' }).eq('id', request.id);
      return { success: false, error: 'This transfer request has expired. Ask the commissioner to start a new one.' };
    }

    const isSender = request.from_token === token;
    const expectedEmail = isSender ? request.from_email : request.to_email;
    if (expectedEmail.toLowerCase() !== callerEmail.trim().toLowerCase()) {
      return { success: false, error: `You're signed in as ${callerEmail}, but this link is for ${expectedEmail}. Log in as that account to confirm.` };
    }

    const { data: huddle } = await supabase
      .from('huddles')
      .select('id, name')
      .eq('id', request.huddle_id)
      .maybeSingle();

    if (!huddle) {
      return { success: false, error: 'Huddle not found.' };
    }

    const now = new Date().toISOString();

    await supabase
      .from('huddle_transfer_requests')
      .update(isSender ? { from_confirmed_at: request.from_confirmed_at ?? now } : { to_confirmed_at: request.to_confirmed_at ?? now })
      .eq('id', request.id);

    const fromConfirmed = isSender || !!request.from_confirmed_at;
    const toConfirmed = !isSender || !!request.to_confirmed_at;

    if (!fromConfirmed || !toConfirmed) {
      return {
        success: true,
        status: 'waiting',
        huddleName: huddle.name,
        otherEmail: isSender ? request.to_email : request.from_email,
      };
    }

    // Both sides confirmed — execute the transfer. Guard against the
    // recipient's plan no longer allowing another Huddle (their situation
    // may have changed since the request was sent).
    const capacity = await checkHuddleCapacity(request.to_email);
    if (!capacity.allowed) {
      await supabase
        .from('huddle_transfer_requests')
        .update({ status: 'failed', failure_reason: capacity.message ?? 'Huddle limit reached.' })
        .eq('id', request.id);
      return { success: false, error: capacity.message ?? 'The recipient’s plan doesn’t allow another Huddle right now.' };
    }

    const { error: huddleUpdateError } = await supabase
      .from('huddles')
      .update({ commissioner_email: request.to_email })
      .eq('id', huddle.id);

    if (huddleUpdateError) {
      debugError('Failed to reassign huddle commissioner:', huddleUpdateError);
      return { success: false, error: 'Failed to complete the transfer. Please try again.' };
    }

    await supabase
      .from('pools')
      .update({ created_by: request.to_email })
      .eq('huddle_id', huddle.id);

    await supabase
      .from('huddle_transfer_requests')
      .update({ status: 'completed', completed_at: now })
      .eq('id', request.id);

    await Promise.all([
      emailService.sendHuddleTransferCompleted(request.from_email, huddle.name, request.to_email),
      emailService.sendHuddleTransferCompleted(request.to_email, huddle.name, request.from_email),
    ]);

    return { success: true, status: 'completed', huddleName: huddle.name };
  } catch (error) {
    debugError('Unexpected error confirming huddle transfer:', error);
    return { success: false, error: 'An unexpected error occurred. Please try again.' };
  }
}
