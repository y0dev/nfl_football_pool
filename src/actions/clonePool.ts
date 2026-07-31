'use server';

import { getSupabaseServiceClient } from '@/lib/supabase';
import { getAdminPlanByEmail } from '@/lib/plan';
import { createPool } from './createPool';
import { updatePool } from './updatePool';
import { debugError, DEFAULT_POOL_SEASON } from '@/lib/utils';
import { CompetitionType } from '@/lib/poolTypes';

export type ClonePoolResult =
  | { success: true; poolId: string; poolName: string; participantsCloned: number }
  | { success: false; error: string };

/**
 * Duplicates a pool's settings into a new pool in the same Huddle —
 * competition type, season scope, visibility, join password, tie-breaker
 * method, type_settings — and copies its active participants directly (not
 * through the invite-email path in addParticipantToPool, since these people
 * are already established members, not new invitees). Does NOT copy
 * picks/scores/tie_breakers/winners; a clone starts fresh.
 *
 * The new pool is always tagged with the CURRENT season
 * (DEFAULT_POOL_SEASON), not the source pool's season — this is meant for
 * rolling a finished season's pool into next season's, not for spinning up
 * a same-season sibling pool.
 *
 * Standard plan only (or an active trial, which already resolves to
 * 'standard' in computePlanInfo) — this is the ability that lets a
 * commissioner spin up a repeat/sibling pool without rebuilding it from
 * scratch, gated the same way other multi-pool conveniences are.
 */
export async function clonePool(poolId: string, callerEmail: string, newName?: string): Promise<ClonePoolResult> {
  return performClone(poolId, callerEmail, newName, false);
}

/**
 * Super-admin variant: clones a pool on behalf of its owning commissioner
 * (a super admin can already see every account, same rationale as
 * transferPoolToCommissioner). Plan and capacity are evaluated against the
 * pool's actual owner, not the calling admin.
 */
export async function adminClonePool(poolId: string, callerEmail: string, newName?: string): Promise<ClonePoolResult> {
  return performClone(poolId, callerEmail, newName, true);
}

async function performClone(poolId: string, callerEmail: string, newName: string | undefined, asSuperAdmin: boolean): Promise<ClonePoolResult> {
  try {
    const supabase = getSupabaseServiceClient();

    // Permission check comes before the pool lookup (rather than after) so
    // an unauthorized super-admin-path caller always gets the same
    // "Insufficient permissions." regardless of whether poolId exists —
    // otherwise a 400 "Pool not found." vs 403 response would leak
    // pool-existence to a caller who was never allowed to ask.
    if (asSuperAdmin) {
      const { data: caller } = await supabase
        .from('admins')
        .select('is_super_admin, is_active')
        .eq('email', callerEmail)
        .eq('is_active', true)
        .maybeSingle();
      if (!caller?.is_super_admin) {
        return { success: false, error: 'Insufficient permissions.' };
      }
    }

    const { data: source } = await supabase
      .from('pools')
      .select('*')
      .eq('id', poolId)
      .maybeSingle();

    if (!source) {
      return { success: false, error: 'Pool not found.' };
    }

    if (!asSuperAdmin && source.created_by !== callerEmail) {
      return { success: false, error: 'Pool not found for your account.' };
    }

    const planInfo = await getAdminPlanByEmail(source.created_by);
    if (planInfo.plan !== 'standard') {
      return { success: false, error: 'Cloning pools requires the Standard plan.' };
    }

    const clonedName = (newName?.trim() || `${source.name} (${DEFAULT_POOL_SEASON})`).slice(0, 255);

    const createResult = await createPool({
      name: clonedName,
      created_by: source.created_by,
      season: DEFAULT_POOL_SEASON,
      pool_type: source.pool_type === 'knockout' ? 'knockout' : 'normal',
      competition_type: source.competition_type as CompetitionType,
      season_scope: source.season_scope,
      is_private: source.is_private,
      join_password: source.join_password ?? undefined,
      huddle_id: source.huddle_id ?? undefined,
      type_settings: source.type_settings ?? undefined,
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
