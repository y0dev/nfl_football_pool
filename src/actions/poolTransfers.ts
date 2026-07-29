'use server';

import { getSupabaseServiceClient } from '@/lib/supabase';
import { checkPoolTransferCapacity } from '@/lib/plan';
import { getOrCreateHuddleRecordForCommissioner } from '@/lib/huddles';
import { emailService } from '@/lib/email';
import { debugError } from '@/lib/utils';

const TRANSFER_EXPIRY_DAYS = 7;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type InitiatePoolTransferResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Starts a pool transfer to another commissioner's League (their
 * primary/first Huddle — resolved the same way pool creation resolves a
 * commissioner's default Huddle). Neither pools.created_by/huddle_id nor
 * anything else changes until BOTH the current owner (fromEmail) and the
 * recipient (toEmail) confirm via their own emailed link — see
 * confirmPoolTransfer. Pre-checks the destination's pool and participant
 * limits up front so the sender gets immediate, specific feedback instead
 * of finding out after both parties have already confirmed.
 */
export async function initiatePoolTransfer(
  poolId: string,
  fromEmail: string,
  toEmail: string
): Promise<InitiatePoolTransferResult> {
  try {
    const supabase = getSupabaseServiceClient();
    const normalizedFrom = fromEmail.trim().toLowerCase();
    const normalizedTo = toEmail.trim().toLowerCase();

    if (!normalizedTo) {
      return { success: false, error: 'Enter the recipient commissioner’s email.' };
    }
    if (normalizedTo === normalizedFrom) {
      return { success: false, error: 'You already own this pool.' };
    }

    const { data: pool } = await supabase
      .from('pools')
      .select('id, name, created_by')
      .eq('id', poolId)
      .maybeSingle();

    if (!pool || pool.created_by.toLowerCase() !== normalizedFrom) {
      return { success: false, error: 'Pool not found for your account.' };
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
      return { success: false, error: 'Cannot transfer a pool to a super admin account.' };
    }

    const destinationHuddle = await getOrCreateHuddleRecordForCommissioner(recipient.email);
    const capacity = await checkPoolTransferCapacity(poolId, destinationHuddle.id, recipient.email);
    if (!capacity.allowed) {
      return { success: false, error: capacity.message ?? 'This transfer would exceed a limit on the destination account.' };
    }

    // Only one pending request per pool at a time — supersede any other.
    await supabase
      .from('pool_transfer_requests')
      .update({ status: 'cancelled' })
      .eq('pool_id', poolId)
      .eq('status', 'pending');

    const expiresAt = new Date(Date.now() + TRANSFER_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data: request, error } = await supabase
      .from('pool_transfer_requests')
      .insert({
        pool_id: poolId,
        from_email: normalizedFrom,
        to_email: recipient.email,
        expires_at: expiresAt,
      })
      .select('from_token, to_token')
      .single();

    if (error || !request) {
      debugError('Failed to create pool transfer request:', error);
      return { success: false, error: 'Failed to start the transfer. Please try again.' };
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const fromLink = `${baseUrl}/league/pool-transfer/${request.from_token}`;
    const toLink = `${baseUrl}/league/pool-transfer/${request.to_token}`;

    await Promise.all([
      emailService.sendPoolTransferConfirmation(normalizedFrom, pool.name, recipient.email, fromLink),
      emailService.sendPoolTransferApprovalRequest(recipient.email, recipient.full_name || recipient.email, pool.name, normalizedFrom, toLink),
    ]);

    return { success: true };
  } catch (error) {
    debugError('Unexpected error initiating pool transfer:', error);
    return { success: false, error: 'An unexpected error occurred. Please try again.' };
  }
}

export type ConfirmPoolTransferResult =
  | { success: true; status: 'waiting'; poolName: string; otherEmail: string }
  | { success: true; status: 'completed'; poolName: string }
  | { success: false; error: string };

/**
 * Confirms one side of a pending pool transfer via its emailed token.
 * callerEmail must match whichever party the token belongs to (second
 * factor beyond the token itself, same as confirmHuddleTransfer). Once both
 * sides have confirmed, re-checks the destination's capacity — the
 * situation may have changed since the request was sent — and either
 * completes the transfer (moves the pool, merges its participants into the
 * destination Huddle's roster) or marks it failed with the specific reason
 * and notifies both parties.
 */
export async function confirmPoolTransfer(token: string, callerEmail: string): Promise<ConfirmPoolTransferResult> {
  try {
    if (!UUID_RE.test(token)) {
      return { success: false, error: 'This transfer link is invalid.' };
    }

    const supabase = getSupabaseServiceClient();

    const { data: request } = await supabase
      .from('pool_transfer_requests')
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
      await supabase.from('pool_transfer_requests').update({ status: 'cancelled' }).eq('id', request.id);
      return { success: false, error: 'This transfer request has expired. Ask the commissioner to start a new one.' };
    }

    const isSender = request.from_token === token;
    const expectedEmail = isSender ? request.from_email : request.to_email;
    if (expectedEmail.toLowerCase() !== callerEmail.trim().toLowerCase()) {
      return { success: false, error: `You're signed in as ${callerEmail}, but this link is for ${expectedEmail}. Log in as that account to confirm.` };
    }

    const { data: pool } = await supabase
      .from('pools')
      .select('id, name')
      .eq('id', request.pool_id)
      .maybeSingle();

    if (!pool) {
      return { success: false, error: 'Pool not found.' };
    }

    const now = new Date().toISOString();

    await supabase
      .from('pool_transfer_requests')
      .update(isSender ? { from_confirmed_at: request.from_confirmed_at ?? now } : { to_confirmed_at: request.to_confirmed_at ?? now })
      .eq('id', request.id);

    const fromConfirmed = isSender || !!request.from_confirmed_at;
    const toConfirmed = !isSender || !!request.to_confirmed_at;

    if (!fromConfirmed || !toConfirmed) {
      return {
        success: true,
        status: 'waiting',
        poolName: pool.name,
        otherEmail: isSender ? request.to_email : request.from_email,
      };
    }

    // Both sides confirmed — re-check the destination's limits before
    // executing (either party's situation may have changed since the
    // request was sent).
    const destinationHuddle = await getOrCreateHuddleRecordForCommissioner(request.to_email);
    const capacity = await checkPoolTransferCapacity(pool.id, destinationHuddle.id, request.to_email);
    if (!capacity.allowed) {
      const reason = capacity.message ?? 'This transfer would exceed a limit on the destination account.';
      await supabase
        .from('pool_transfer_requests')
        .update({ status: 'failed', failure_reason: reason })
        .eq('id', request.id);
      await Promise.all([
        emailService.sendPoolTransferFailed(request.from_email, pool.name, request.to_email, reason),
        emailService.sendPoolTransferFailed(request.to_email, pool.name, request.from_email, reason),
      ]);
      return { success: false, error: reason };
    }

    const { error: poolUpdateError } = await supabase
      .from('pools')
      .update({ created_by: request.to_email, huddle_id: destinationHuddle.id })
      .eq('id', pool.id);

    if (poolUpdateError) {
      debugError('Failed to transfer pool ownership:', poolUpdateError);
      return { success: false, error: 'Failed to complete the transfer. Please try again.' };
    }

    // Merge this pool's participants into the destination Huddle's roster,
    // deduped by email — same approach as transferPoolToCommissioner in
    // @/lib/poolTransfer (the admin-only, no-approval equivalent) and
    // docs/migrations/backfill-huddle-members-from-participants.sql.
    const { data: participants } = await supabase
      .from('participants')
      .select('id, name, email')
      .eq('pool_id', pool.id)
      .eq('is_active', true)
      .not('email', 'is', null);

    for (const participant of participants ?? []) {
      const email = participant.email!.toLowerCase();
      const { data: existingMember } = await supabase
        .from('huddle_members')
        .select('id')
        .eq('huddle_id', destinationHuddle.id)
        .eq('email', email)
        .maybeSingle();

      let memberId = existingMember?.id as string | undefined;
      if (!memberId) {
        const { data: created, error: memberError } = await supabase
          .from('huddle_members')
          .insert({ huddle_id: destinationHuddle.id, name: participant.name, email })
          .select('id')
          .single();
        if (memberError) {
          debugError('Failed to create huddle member during pool transfer:', memberError);
          continue;
        }
        memberId = created.id;
      }

      await supabase
        .from('participants')
        .update({ huddle_member_id: memberId })
        .eq('id', participant.id);
    }

    await supabase
      .from('pool_transfer_requests')
      .update({ status: 'completed', completed_at: now })
      .eq('id', request.id);

    await Promise.all([
      emailService.sendPoolTransferCompleted(request.from_email, pool.name, request.to_email),
      emailService.sendPoolTransferCompleted(request.to_email, pool.name, request.from_email),
    ]);

    return { success: true, status: 'completed', poolName: pool.name };
  } catch (error) {
    debugError('Unexpected error confirming pool transfer:', error);
    return { success: false, error: 'An unexpected error occurred. Please try again.' };
  }
}
