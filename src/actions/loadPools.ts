import { getSupabaseServiceClient } from '@/lib/supabase';
import { debugLog, debugError } from '@/lib/utils';

export async function loadPools(adminEmail?: string, isSuperAdmin?: boolean) {
  try {
    const supabase = getSupabaseServiceClient();
    let query = supabase
      .from('pools')
      .select('*')
      .eq('is_active', true);

    // If not an admin, only show pools created by this commissioner
    if (!isSuperAdmin && adminEmail) {
      query = query.eq('created_by', adminEmail);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    debugError('Error loading pools:', error);
    return [];
  }
}

/** Pools for a specific League (Huddle), regardless of who's viewing —
 * used by the League manager UI so it works the same for a commissioner's
 * own League and for a super admin managing someone else's. Includes
 * inactive pools (with is_active on each row) so a deactivated pool still
 * shows up with its status rather than silently disappearing. */
export async function loadPoolsByHuddleId(huddleId: string) {
  try {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from('pools')
      .select('*')
      .eq('huddle_id', huddleId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    debugError('Error loading pools for huddle:', error);
    return [];
  }
}

export async function loadPool(poolId: string) {
  try {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from('pools')
      .select('*')
      .eq('id', poolId)
      .maybeSingle();
    debugLog(`Loaded pool ${poolId}:`, data, error);
    if (error) throw error;
    return data;
  } catch (error) {
    debugError('Error loading pool:', error);
    return null;
  }
}
