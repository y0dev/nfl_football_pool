// import { supabase } from '@/lib/supabase';

export async function loadCurrentWeek() {
  try {
    // For now, return a hardcoded current week
    // In a real app, you'd query the database for the current NFL week
    return {
      id: 1,
      week_number: 1,
      season_year: 2024,
      game_count: 16,
      is_active: true
    };
  } catch (error) {
    console.error('Error loading current week:', error);
    throw error;
  }
}
