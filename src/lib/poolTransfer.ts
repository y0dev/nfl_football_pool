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
  callerEmail: string
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

    // Merge this pool's participants into the destination Huddle's roster,
    // deduped by email — same approach as
    // docs/migrations/backfill-huddle-members-from-participants.sql.
    // Participants with no email aren't linked to a roster entry (nothing to
    // dedupe on); they still move with the pool since it's now on the new
    // commissioner's Huddle.
    const { data: participants } = await supabase
      .from('participants')
      .select('id, name, email')
      .eq('pool_id', poolId)
      .eq('is_active', true)
      .not('email', 'is', null);

    let mergedMembers = 0;
    for (const participant of participants ?? []) {
      const email = participant.email!.toLowerCase();
      const { data: existingMember } = await supabase
        .from('huddle_members')
        .select('id')
        .eq('huddle_id', newHuddle.id)
        .eq('email', email)
        .maybeSingle();

      let memberId = existingMember?.id as string | undefined;
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
    };
  } catch (error) {
    debugError('Unexpected error transferring pool:', error);
    return { success: false, error: 'An unexpected error occurred.' };
  }
}
