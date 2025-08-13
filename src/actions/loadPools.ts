import { getSupabaseClient } from '@/lib/supabase';

export async function loadPools() {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('pools')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error loading pools:', error);
    return [];
  }
}

export async function loadPool(poolId: string) {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('pools')
      .select('*')
      .eq('id', poolId)
      .eq('is_active', true)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error loading pool:', error);
    return null;
  }
}
