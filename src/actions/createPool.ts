import { supabase } from '@/lib/supabase';

export async function createPool(poolData: {
  name: string;
  description?: string;
  created_by: string;
}) {
  try {
    const { data, error } = await supabase
      .from('pools')
      .insert({
        name: poolData.name,
        description: poolData.description,
        created_by: poolData.created_by,
        season: 2024,
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
