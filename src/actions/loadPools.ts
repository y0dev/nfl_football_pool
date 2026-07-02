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
