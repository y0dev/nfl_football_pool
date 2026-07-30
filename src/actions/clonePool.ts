'use server';

import { getSupabaseServiceClient } from '@/lib/supabase';
import { getAdminPlanByEmail } from '@/lib/plan';
import { createPool } from './createPool';
import { updatePool } from './updatePool';
import { debugError } from '@/lib/utils';
import { CompetitionType } from '@/lib/poolTypes';

export type ClonePoolResult =
  | { success: true; poolId: string; poolName: string; participantsCloned: number }
  | { success: false; error: string };

/**
 * Duplicates a pool's settings into a new pool in the same Huddle —
 * competition type, season scope, visibility, join password, tie-breaker
 * method — and copies its active participants directly (not through the
 * invite-email path in addParticipantToPool, since these people are
 * already established members, not new invitees). Does NOT copy
 * picks/scores/tie_breakers/winners; a clone starts fresh.
 *
 * Standard plan only (or an active trial, which already resolves to
 * 'standard' in computePlanInfo) — this is the ability that lets a
 * commissioner spin up a repeat/sibling pool without rebuilding it from
 * scratch, gated the same way other multi-pool conveniences are.
 */
export async function clonePool(poolId: string, callerEmail: string, newName?: string): Promise<ClonePoolResult> {
  try {
    const supabase = getSupabaseServiceClient();

    const { data: source } = await supabase
      .from('pools')
      .select('*')
      .eq('id', poolId)
      .maybeSingle();

    if (!source || source.created_by !== callerEmail) {
      return { success: false, error: 'Pool not found for your account.' };
    }

    const planInfo = await getAdminPlanByEmail(callerEmail);
    if (planInfo.plan !== 'standard') {
      return { success: false, error: 'Cloning pools requires the Standard plan.' };
    }

    const clonedName = (newName?.trim() || `${source.name} (Copy)`).slice(0, 255);

    const createResult = await createPool({
      name: clonedName,
      created_by: source.created_by,
      season: source.season,
      pool_type: source.pool_type === 'knockout' ? 'knockout' : 'normal',
      competition_type: source.competition_type as CompetitionType,
      season_scope: source.season_scope,
      is_private: source.is_private,
      join_password: source.join_password ?? undefined,
      huddle_id: source.huddle_id ?? undefined,
    });

    if (!createResult.success) {
      return { success: false, error: createResult.error };
    }

    const newPool = createResult.data as { id: string };

    if (source.tie_breaker_method) {
      try {
        await updatePool(newPool.id, { tie_breaker_method: source.tie_breaker_method });
      } catch (updateError) {
        debugError('Failed to copy tie-breaker method during clone:', updateError);
      }
    }

    const { data: participants } = await supabase
      .from('participants')
      .select('name, email, huddle_member_id')
      .eq('pool_id', poolId)
      .eq('is_active', true);

    let participantsCloned = 0;
    for (const participant of participants ?? []) {
      const { error: insertError } = await supabase
        .from('participants')
        .insert({
          pool_id: newPool.id,
          name: participant.name,
          email: participant.email,
          huddle_member_id: participant.huddle_member_id,
          is_active: true,
        });
      if (!insertError) {
        participantsCloned++;
      } else {
        debugError('Failed to clone participant:', insertError);
      }
    }

    return { success: true, poolId: newPool.id, poolName: clonedName, participantsCloned };
  } catch (error) {
    debugError('Unexpected error cloning pool:', error);
    return { success: false, error: 'An unexpected error occurred. Please try again.' };
  }
}
