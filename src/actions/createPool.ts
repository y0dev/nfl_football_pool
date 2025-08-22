import { getSupabaseServiceClient } from '@/lib/supabase';
import { DEFAULT_POOL_SEASON } from '@/lib/utils';

export async function createPool(poolData: {
  name: string;
  created_by: string;
  season?: number;
}) {
  try {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from('pools')
      .insert({
        name: poolData.name,
        created_by: poolData.created_by,
        season: poolData.season || DEFAULT_POOL_SEASON,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating pool:', error);
    throw error;
  }
}
