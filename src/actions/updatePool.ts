import { getSupabaseServiceClient } from '@/lib/supabase';

export async function updatePool(poolId: string, updates: {
  name?: string;
  season?: number;
  is_active?: boolean;
  tie_breaker_method?: string;
  tie_breaker_question?: string;
  tie_breaker_answer?: number;
}) {
  try {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from('pools')
      .update(updates)
      .eq('id', poolId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating pool:', error);
    throw error;
  }
}
