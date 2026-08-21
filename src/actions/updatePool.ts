'use server';

import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { debugError, debugWarn, getNFLSeasonYear } from '@/lib/utils';
import { checkPoolCapacity, checkInactivePoolCapacity, isPreseasonOnlyScope, scopeIncludesPlayoffs, PLAYOFF_SCOPE_MESSAGE, getAdminPlanByEmail } from '@/lib/plan';
import { getSeasonSettings } from '@/lib/seasonSettings';
import { checkSeasonScopeCreatable } from '@/lib/seasonPhase';

export async function updatePool(poolId: string, updates: {
  name?: string;
  season?: number;
  is_active?: boolean;
  is_private?: boolean;
  join_password?: string | null;
  tie_breaker_method?: string;
  tie_breaker_question?: string;
  tie_breaker_answer?: number;
  season_scope?: number[];
  /** Per-competition-type config (e.g. Survivor's no-pick/tie/end-of-season
   * rules — see src/lib/survivor.ts's SurvivorTypeSettings). Never touches
   * competition_type itself, which is immutable after pool creation. */
  type_settings?: Record<string, unknown>;
}) {
  const supabase = getSupabaseServiceClient();

  const { data: current } = await supabase
    .from('pools')
    .select('created_by, season, season_scope, is_active')
    .eq('id', poolId)
    .single();

  // Pools from a season that has already ended are locked — their settings
  // describe how that season was actually run, so changing them after the
  // fact (e.g. season_scope, tie-breaker method) would corrupt historical
  // standings. Closing the season, transferring the pool, and deleting it
  // all go through separate paths and aren't affected by this.
  if (current && current.season < getNFLSeasonYear()) {
    throw new Error('This pool is from a previous season and its settings can no longer be changed.');
  }

  // Deactivating a pool (not deleting it) counts against a separate,
  // across-all-Huddles limit on how many inactive pools a commissioner may
  // retain — Free allows none, so this is effectively "delete instead of
  // archive" for Free. Only checked on the active->inactive transition, not
  // every update, and not the close-season flow (a mandatory end-of-season
  // action, not a discretionary archive).
  if (updates.is_active === false && current?.is_active !== false && current?.created_by) {
    const inactiveCapacity = await checkInactivePoolCapacity(current.created_by, { excludePoolId: poolId });
    if (!inactiveCapacity.allowed) {
      throw new Error(inactiveCapacity.message ?? 'Inactive pool limit reached.');
    }
  }

  // Re-scoping a pool moves it between the free preseason-test bucket and the
  // plan bucket — re-check the destination bucket's limit so scope changes
  // can't be used to dodge either cap.
  if (updates.season_scope) {
    const wasPreseason = isPreseasonOnlyScope(current?.season_scope);
    const willBePreseason = isPreseasonOnlyScope(updates.season_scope);

    if (current?.created_by && wasPreseason !== willBePreseason) {
      const capacity = await checkPoolCapacity(current.created_by, {
        preseason: willBePreseason,
        excludePoolId: poolId,
      });
      if (!capacity.allowed) {
        throw new Error(capacity.message ?? 'Pool limit reached for the selected season scope.');
      }
    }

    // Season & playoff tracking is Standard-only — block re-scoping a pool
    // into the postseason on the free plan
    if (
      current?.created_by &&
      scopeIncludesPlayoffs(updates.season_scope) &&
      !scopeIncludesPlayoffs(current?.season_scope)
    ) {
      const planInfo = await getAdminPlanByEmail(current.created_by);
      if (planInfo.plan === 'free') {
        throw new Error(PLAYOFF_SCOPE_MESSAGE);
      }
    }

    // Can't re-scope into a phase whose final week has already started (or
    // that's already fully in the past) — only check phases being newly
    // added, so removing a scope (e.g. dropping playoffs) is never blocked.
    if (current?.season) {
      const newlyAddedPhases = updates.season_scope.filter(p => !(current.season_scope ?? []).includes(p));
      if (newlyAddedPhases.length > 0) {
        const seasonSettings = await getSeasonSettings(current.season);
        const scopeCheck = checkSeasonScopeCreatable(newlyAddedPhases, seasonSettings);
        if (!scopeCheck.allowed) {
          throw new Error(scopeCheck.message ?? 'That season scope is no longer available.');
        }
      }
    }
  }

  const { data, error } = await supabase
    .from('pools')
    .update(updates)
    .eq('id', poolId)
    .select()
    .single();

  if (!error) return data;

  // If the error is about a missing column, retry without the columns that
  // don't exist yet (join_password / is_private require a DB migration).
  const msg = error.message ?? '';
  if (msg.includes('join_password') || msg.includes('is_private') || msg.includes('schema cache')) {
    debugWarn('Retrying updatePool without schema-missing columns:', msg);
    const safeUpdates = { ...updates };
    delete safeUpdates.join_password;
    delete safeUpdates.is_private;
    const { data: retryData, error: retryError } = await supabase
      .from('pools')
      .update(safeUpdates)
      .eq('id', poolId)
      .select()
      .single();

    if (retryError) {
      debugError('Error updating pool:', retryError);
      throw retryError;
    }
    return retryData;
  }

  debugError('Error updating pool:', error);
  throw error;
}
