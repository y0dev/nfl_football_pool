import { supabase } from '@/lib/supabase';

export async function loadPools() {
  try {
    const { data: pools, error } = await supabase
      .from('pools')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return pools || [];
  } catch (error) {
    console.error('Error loading pools:', error);
    throw error;
  }
}
