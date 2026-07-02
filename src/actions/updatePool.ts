'use server';

import { getSupabaseServiceClient } from '@/lib/supabase';
import { debugError, debugWarn } from '@/lib/utils';

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
