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
    console.log('getUsersWhoSubmitted called with:', { poolId, week });
    
    // Validate inputs
    if (!poolId || !week || week < 1) {
      console.log('Invalid inputs provided to getUsersWhoSubmitted');
      return [];
    }

    // Validate poolId is a valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(poolId)) {
      console.error('Invalid poolId format (not a UUID):', poolId);
      return [];
    }
    
    const supabase = getSupabaseClient();
    
    // First get the games for this week
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id')
      .eq('week', week);

    console.log('Games query result:', { games, gamesError });

    if (gamesError) {
      console.error('Error getting games for week:', gamesError);
      return [];
    }

    if (!games || games.length === 0) {
      console.log('No games found for week:', week);
      return [];
    }

    const gameIds = games.map(game => game.id);

    // Then get users who submitted picks for these games
    const { data: picks, error } = await supabase
      .from('picks')
      .select('participant_id')
      .eq('pool_id', poolId)
      .in('game_id', gameIds);

    console.log('Picks query result:', { picks, error });

    if (error) {
      console.error('Error getting users who submitted:', error);
      return [];
    }

    // Return unique participant IDs
    const uniqueParticipantIds = [...new Set(picks?.map(pick => pick.participant_id) || [])];
    console.log('Unique participant IDs:', uniqueParticipantIds);
    return uniqueParticipantIds;
  } catch (error) {
    console.error('Error getting users who submitted:', error);
    return [];
  }
}

export async function isUserInPool(userEmail: string, poolId: string) {
  try {
    // Validate inputs
    if (!userEmail || !poolId) {
      console.log('Invalid inputs provided to isUserInPool');
      return false;
    }

    // Validate poolId is a valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(poolId)) {
      console.error('Invalid poolId format (not a UUID):', poolId);
      return false;
    }

    const supabase = getSupabaseClient();
    
    const { data: participant, error } = await supabase
      .from('participants')
      .select('id')
      .eq('pool_id', poolId)
      .eq('email', userEmail)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking if user is in pool:', error);
      return false;
    }

    return !!participant;
  } catch (error) {
    console.error('Error checking if user is in pool:', error);
    return false;
  }
}
