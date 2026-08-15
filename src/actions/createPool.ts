'use server';

import { getSupabaseServiceClient } from '@/lib/supabase';
import { DEFAULT_POOL_SEASON, debugError } from '@/lib/utils';
import { checkPoolCapacity, isPreseasonOnlyScope, scopeIncludesPlayoffs, PLAYOFF_SCOPE_MESSAGE, Plan } from '@/lib/plan';
import { getOrCreateHuddleRecordForCommissioner } from '@/lib/huddles';
import { CompetitionType, DEFAULT_COMPETITION_TYPE, isAvailableCompetitionType } from '@/lib/poolTypes';
import { getSeasonSettings } from '@/lib/seasonSettings';
import { checkSeasonScopeCreatable } from '@/lib/seasonPhase';
import { encryptPoolPassword, validatePoolPassword } from '@/lib/pool-access';

export type CreatePoolResult =
  | { success: true; data: Record<string, unknown> }
  | { success: false; error: string; limitReached?: true; plan?: Plan; limit?: number };

export async function createPool(poolData: {
  name: string;
  created_by: string;
  season?: number;
  pool_type?: 'normal' | 'knockout';
  competition_type?: CompetitionType;
  /** Public pools: optional legacy join-gate password (plaintext, unchanged
   * behavior). Private pools: the pool's mandatory access password —
   * required, encrypted into private_password_encrypted instead, never
   * written to this column. */
  join_password?: string;
  /** Required (and must match join_password) when is_private is true. */
  join_password_confirm?: string;
  season_scope?: number[];
  is_private?: boolean;
  /** Target Huddle for this pool. Omit to fall back to the commissioner's
   * first/primary Huddle (single-Huddle callers). Must belong to created_by. */
  huddle_id?: string;
  /** Per-competition-type config (e.g. survivor's "no repeat picks" rule). Defaults to '{}'. */
  type_settings?: Record<string, unknown>;
}): Promise<CreatePoolResult> {
  try {
    const competitionType = poolData.competition_type ?? DEFAULT_COMPETITION_TYPE;
    if (!isAvailableCompetitionType(competitionType)) {
      return { success: false, error: `${competitionType} pools are coming soon and can't be created yet.` };
    }

    // Private pools cannot be created without a password (Step 5) — verified
    // server-side regardless of what the client already checked.
    let encryptedPrivatePassword: string | undefined;
    if (poolData.is_private) {
      const validationError = validatePoolPassword(poolData.join_password ?? '', poolData.join_password_confirm);
      if (validationError) {
        return { success: false, error: validationError };
      }
      encryptedPrivatePassword = await encryptPoolPassword(poolData.join_password!);
    }

    const supabase = getSupabaseServiceClient();

    let huddle: { id: string; name: string };
    if (poolData.huddle_id) {
      const { data: owned } = await supabase
        .from('huddles')
        .select('id, name')
        .eq('id', poolData.huddle_id)
        .eq('commissioner_email', poolData.created_by)
        .maybeSingle();
      if (!owned) {
        return { success: false, error: 'That Huddle was not found for your account.' };
      }
      huddle = owned;
    } else {
      huddle = await getOrCreateHuddleRecordForCommissioner(poolData.created_by);
    }

    // Preseason-only pools are free test pools with their own separate cap;
    // they never count against (or consume) the plan's pool limit.
    const isPreseason = isPreseasonOnlyScope(poolData.season_scope ?? [2]);
    const capacity = await checkPoolCapacity(poolData.created_by, { preseason: isPreseason, huddleId: huddle.id });

    if (!capacity.allowed) {
      return {
        success: false,
        error: capacity.message ?? 'Pool limit reached.',
        limitReached: true,
        plan: capacity.plan,
        limit: capacity.limit,
      };
    }

    // Season & playoff tracking is Standard-only — free pools can't include
    // the postseason in their scope
    if (capacity.plan === 'free' && scopeIncludesPlayoffs(poolData.season_scope)) {
      return {
        success: false,
        error: PLAYOFF_SCOPE_MESSAGE,
        limitReached: true,
        plan: capacity.plan,
        limit: capacity.limit,
      };
    }

    // Can't create a pool scoped to a phase whose final week has already
    // started (or that's already fully in the past) — e.g. no new
    // preseason-only pools once preseason week 4 has begun.
    const targetSeason = poolData.season || DEFAULT_POOL_SEASON;
    const seasonSettings = await getSeasonSettings(targetSeason);
    const scopeCheck = checkSeasonScopeCreatable(poolData.season_scope ?? [2], seasonSettings);
    if (!scopeCheck.allowed) {
      return { success: false, error: scopeCheck.message ?? 'That season scope is no longer available.' };
    }

    const { data, error } = await supabase
      .from('pools')
      .insert({
        name: poolData.name,
        created_by: poolData.created_by,
        season: poolData.season || DEFAULT_POOL_SEASON,
        pool_type: poolData.pool_type || 'normal',
        competition_type: competitionType,
        huddle_id: huddle.id,
        is_active: true,
        is_private: poolData.is_private ?? false,
        season_scope: poolData.season_scope ?? [2],
        // Private pools: password goes to the encrypted column, never the
        // legacy plaintext join_password. Public pools: unchanged behavior.
        ...(encryptedPrivatePassword
          ? { private_password_encrypted: encryptedPrivatePassword }
          : poolData.join_password
          ? { join_password: poolData.join_password }
          : {}),
        ...(poolData.type_settings ? { type_settings: poolData.type_settings } : {}),
      })
      .select()
      .single();

    if (error) {
      debugError('Insert failed:', error);
      return { success: false, error: 'Failed to create pool. Please try again.' };
    }

    // Non-critical: send welcome email
    try {
      const { data: admin } = await supabase
        .from('commissioners')
        .select('full_name, email')
        .eq('email', poolData.created_by)
        .eq('is_active', true)
        .maybeSingle();

      if (admin?.email) {
        const { emailService } = await import('@/lib/email');
        await emailService.sendPoolCreationNotification(
          admin.email,
          admin.full_name || poolData.created_by,
          poolData.name,
          data.id,
          huddle.name
        );
      }
    } catch (emailError) {
      debugError('Error sending pool creation email:', emailError);
    }

    return { success: true, data };
  } catch (error) {
    debugError('Unexpected error:', error);
    return { success: false, error: 'An unexpected error occurred. Please try again.' };
  }
}
