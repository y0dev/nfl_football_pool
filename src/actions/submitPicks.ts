import { supabase } from '@/lib/supabase';

export async function submitPicks(picks: Array<{
  participant_id: string;
  pool_id: string;
  game_id: string;
  predicted_winner: string;
  confidence_points: number;
}>) {
  try {
    const { data, error } = await supabase
      .from('picks')
      .upsert(picks, { onConflict: 'participant_id,pool_id,game_id' });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error submitting picks:', error);
    throw error;
  }
}
