import { getSupabaseServiceClient } from './supabase';
import { getOrCreateHuddleRecordForCommissioner } from './huddles';
import { debugError } from './utils';

export type TransferPoolResult =
  | {
      success: true;
      poolId: string;
      poolName: string;
      fromEmail: string;
      toEmail: string;
      huddleId: string;
      huddleName: string;
      mergedMembers: number;
      removedFromSourceRoster: number;
    }
  | { success: false; error: string };

/**
 * Moves a pool — and merges its participants into the destination
 * commissioner's Huddle roster — from its current commissioner to a
 * different one. Super-admin only: commissioners can already see every
 * account, so there's no ambiguity to resolve and no approval flow needed
 * (contrast with initiateHuddleTransfer in @/actions/huddleTransfers, which
 * lets a commissioner hand off an entire Huddle to another commissioner and
 * requires both parties to confirm by email).
 *
 * Reassigns pools.created_by AND pools.huddle_id together — moving only
 * created_by would leave the pool pointed at the old commissioner's Huddle,
 * which would silently break pool-capacity checks and the League page for
 * both commissioners.
 */
export async function transferPoolToCommissioner(
  poolId: string,
  newCommissionerEmail: string,
  callerEmail: string,
  removeFromSourceRoster = false
): Promise<TransferPoolResult> {
  try {
    const supabase = getSupabaseServiceClient();

    const { data: caller } = await supabase
      .from('admins')
      .select('id, is_super_admin, is_active')
      .eq('email', callerEmail)
      .eq('is_active', true)
      .maybeSingle();

    if (!caller?.is_super_admin) {
      return { success: false, error: 'Insufficient permissions.' };
    }

    const { data: newCommissioner } = await supabase
      .from('admins')
      .select('email, is_active, is_super_admin')
      .eq('email', newCommissionerEmail)
      .eq('is_active', true)
      .maybeSingle();

    if (!newCommissioner) {
      return { success: false, error: 'New commissioner not found or account is inactive.' };
    }
    if (newCommissioner.is_super_admin) {
      return { success: false, error: 'Cannot transfer a pool to a super admin account.' };
    }

    const { data: pool } = await supabase
      .from('pools')
      .select('id, name, created_by')
      .eq('id', poolId)
      .maybeSingle();

    if (!pool) {
      return { success: false, error: 'Pool not found.' };
    }
    if (pool.created_by === newCommissionerEmail) {
      return { success: false, error: 'That commissioner already owns this pool.' };
    }

    const previousOwner = pool.created_by;
    const newHuddle = await getOrCreateHuddleRecordForCommissioner(newCommissionerEmail);

    const { error: updateError } = await supabase
      .from('pools')
      .update({ created_by: newCommissionerEmail, huddle_id: newHuddle.id })
      .eq('id', poolId);

    if (updateError) {
      debugError('Failed to transfer pool ownership:', updateError);
      return { success: false, error: 'Failed to transfer pool.' };
    }

    // Merge this pool's participants into the destination Huddle's roster.
    // Participants with an email are deduped against an existing roster
    // entry for that email (same approach as
    // docs/migrations/backfill-huddle-members-from-participants.sql).
    // Participants with NO email can't be deduped on anything, so they
    // always get a fresh roster entry — huddle_members.email is nullable
    // specifically to support manually-added, no-email members, and
    // Postgres treats each NULL as distinct so multiple are allowed.
    const { data: participants } = await supabase
      .from('participants')
      .select('id, name, email, huddle_member_id')
      .eq('pool_id', poolId)
      .eq('is_active', true);

    let mergedMembers = 0;
    const sourceHuddleMemberIds = new Set<string>();
    for (const participant of participants ?? []) {
      if (participant.huddle_member_id) sourceHuddleMemberIds.add(participant.huddle_member_id);

      const email = participant.email?.trim().toLowerCase() || null;

      let memberId: string | undefined;
      if (email) {
        const { data: existingMember } = await supabase
          .from('huddle_members')
          .select('id')
          .eq('huddle_id', newHuddle.id)
          .eq('email', email)
          .maybeSingle();
        memberId = existingMember?.id as string | undefined;
      }

      if (!memberId) {
        const { data: created, error: memberError } = await supabase
          .from('huddle_members')
          .insert({ huddle_id: newHuddle.id, name: participant.name, email })
          .select('id')
          .single();
        if (memberError) {
          debugError('Failed to create huddle member during pool transfer:', memberError);
          continue;
        }
        memberId = created.id;
        mergedMembers++;
      }

      await supabase
        .from('participants')
        .update({ huddle_member_id: memberId })
        .eq('id', participant.id);
    }

    // Optionally clean up the source League's roster — but only remove a
    // roster entry if no OTHER active participant (in a different pool
    // still in that Huddle) still needs it. Never touches anyone who's
    // still actually in that Huddle.
    let removedFromSourceRoster = 0;
    if (removeFromSourceRoster) {
      for (const memberId of sourceHuddleMemberIds) {
        const { count } = await supabase
          .from('participants')
          .select('id', { count: 'exact', head: true })
          .eq('huddle_member_id', memberId)
          .eq('is_active', true);

        if ((count ?? 0) === 0) {
          const { error: deactivateError } = await supabase
            .from('huddle_members')
            .update({ is_active: false })
            .eq('id', memberId);
          if (!deactivateError) removedFromSourceRoster++;
        }
      }
    }

    await supabase.from('audit_logs').insert({
      action: 'transfer_pool',
      admin_id: caller.id,
      entity: 'pool',
      entity_id: poolId,
      details: {
        pool_id: poolId,
        pool_name: pool.name,
        previous_owner: previousOwner,
        new_owner: newCommissionerEmail,
        merged_members: mergedMembers,
        removed_from_source_roster: removedFromSourceRoster,
      },
    });

    return {
      success: true,
      poolId,
      poolName: pool.name,
      fromEmail: previousOwner,
      toEmail: newCommissionerEmail,
      huddleId: newHuddle.id,
      huddleName: newHuddle.name,
      mergedMembers,
      removedFromSourceRoster,
    };
  } catch (error) {
    debugError('Unexpected error transferring pool:', error);
    return { success: false, error: 'An unexpected error occurred.' };
  }
}
