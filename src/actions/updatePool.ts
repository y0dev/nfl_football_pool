'use server';

import { getSupabaseServiceClient } from '@/lib/supabase';
import { debugError, debugWarn } from '@/lib/utils';
import { checkPoolCapacity, isPreseasonOnlyScope, scopeIncludesPlayoffs, PLAYOFF_SCOPE_MESSAGE, getAdminPlanByEmail } from '@/lib/plan';

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
}) {
  const supabase = getSupabaseServiceClient();

  // Re-scoping a pool moves it between the free preseason-test bucket and the
  // plan bucket — re-check the destination bucket's limit so scope changes
  // can't be used to dodge either cap.
  if (updates.season_scope) {
    const { data: current } = await supabase
      .from('pools')
      .select('created_by, season_scope')
      .eq('id', poolId)
      .single();

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
  const msg = (error as any)?.message ?? '';
  if (msg.includes('join_password') || msg.includes('is_private') || msg.includes('schema cache')) {
    debugWarn('[SH][LOGIC][POOL] Retrying updatePool without schema-missing columns:', msg);
    const { join_password, is_private, ...safeUpdates } = updates;
    const { data: retryData, error: retryError } = await supabase
      .from('pools')
      .update(safeUpdates)
      .eq('id', poolId)
      .select()
      .single();

    if (retryError) {
      debugError('[SH][LOGIC][POOL] Error updating pool:', retryError);
      throw retryError;
    }
    return retryData;
  }

  debugError('[SH][LOGIC][POOL] Error updating pool:', error);
  throw error;
}
