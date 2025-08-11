import { supabase } from '@/lib/supabase';

export async function loadUsers() {
  try {
    const { data: participants, error } = await supabase
      .from('participants')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return participants || [];
  } catch (error) {
    console.error('Error loading users:', error);
    throw error;
  }
}
