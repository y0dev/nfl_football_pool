import { getSupabaseClient } from '@/lib/supabase';

export async function checkUserSubmission(participantId: string, poolId: string, week: number) {
  try {
    const supabase = getSupabaseClient();
    
    // First get the games for this week
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id')
      .eq('week', week);

    if (gamesError) {
      console.error('Error getting games for week:', gamesError);
      return false;
    }

    if (!games || games.length === 0) {
      return false;
    }

    const gameIds = games.map(game => game.id);

    // Then check if user has picks for these games
    const { data: picks, error } = await supabase
      .from('picks')
      .select('id')
      .eq('participant_id', participantId)
      .eq('pool_id', poolId)
      .in('game_id', gameIds)
      .limit(1);

    if (error) {
      console.error('Error checking user submission:', error);
      return false;
    }

    return picks && picks.length > 0;
  } catch (error) {
    console.error('Error checking user submission:', error);
    return false;
  }
}

export async function getUsersWhoSubmitted(poolId: string, week: number) {
  try {
    const supabase = getSupabaseClient();
    
    // First get the games for this week
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id')
      .eq('week', week);

    if (gamesError) {
      console.error('Error getting games for week:', gamesError);
      return [];
    }

    if (!games || games.length === 0) {
      return [];
    }

    const gameIds = games.map(game => game.id);

    // Then get users who submitted picks for these games
    const { data: picks, error } = await supabase
      .from('picks')
      .select('participant_id')
      .eq('pool_id', poolId)
      .in('game_id', gameIds);

    if (error) {
      console.error('Error getting users who submitted:', error);
      return [];
    }

    // Return unique participant IDs
    return [...new Set(picks?.map(pick => pick.participant_id) || [])];
  } catch (error) {
    console.error('Error getting users who submitted:', error);
    return [];
  }
}
