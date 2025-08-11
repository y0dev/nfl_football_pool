import { supabase } from '@/lib/supabase';

export async function joinPool(poolId: string, participantId: string) {
  try {
    const { data, error } = await supabase
      .from('participants')
      .update({ pool_id: poolId })
      .eq('id', participantId);

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error joining pool:', error);
    throw error;
  }
}
