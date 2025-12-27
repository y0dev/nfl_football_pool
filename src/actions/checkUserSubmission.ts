import { getSupabaseServiceClient } from '@/lib/supabase';

export async function checkUserSubmission(participantId: string, poolId: string, week: number, seasonType: number = 2) {
  try {
    const supabase = getSupabaseServiceClient();
    
    // First get the games for this week and season type
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id')
      .eq('week', week)
      .eq('season_type', seasonType);

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

export async function getUsersWhoSubmitted(poolId: string, week: number, seasonType: number = 2) {
  try {
    
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
    
    const supabase = getSupabaseServiceClient();
    
    // First get the games for this week and season type
    // For playoffs, only count games where teams have been determined (not empty team names)
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, away_team, home_team')
      .eq('week', week)
      .eq('season_type', seasonType);

    if (gamesError) {
      console.error('Error getting games for week:', gamesError);
      return [];
    }

    if (!games || games.length === 0) {
      console.log('No games found for week:', week, 'season type:', seasonType);
      return [];
    }

    // For playoffs, filter out games where teams haven't been determined
    let validGames = games;
    if (seasonType === 3) {
      validGames = games.filter(game => 
        game.away_team && game.away_team.trim() !== '' && 
        game.home_team && game.home_team.trim() !== ''
      );
    }

    if (validGames.length === 0) {
      console.log('No valid games found for week:', week, 'season type:', seasonType);
      return [];
    }

    const gameIds = validGames.map(game => game.id);

    // Then get users who submitted picks for these games
    // Only count users who have picks with predicted_winner for ALL valid games
    const { data: picks, error } = await supabase
      .from('picks')
      .select('participant_id, game_id, predicted_winner')
      .eq('pool_id', poolId)
      .in('game_id', gameIds)
      .not('predicted_winner', 'is', null);

    if (error) {
      console.error('Error getting users who submitted:', error);
      return [];
    }

    // Group picks by participant and check if they have picks for all valid games
    const participantPicksMap = new Map<string, Set<string>>();
    picks?.forEach(pick => {
      if (!participantPicksMap.has(pick.participant_id)) {
        participantPicksMap.set(pick.participant_id, new Set());
      }
      participantPicksMap.get(pick.participant_id)!.add(pick.game_id);
    });

    // Only return participants who have picks for ALL valid games
    const submittedParticipantIds = Array.from(participantPicksMap.entries())
      .filter(([_, gameIdsSet]) => gameIdsSet.size === gameIds.length)
      .map(([participantId]) => participantId);
    
    console.log('getUsersWhoSubmitted - result:', {
      poolId,
      week,
      seasonType,
      gameIds: gameIds.length,
      picksFound: picks?.length || 0,
      participantsWithAllPicks: submittedParticipantIds.length,
      participantIds: submittedParticipantIds
    });
    
    return submittedParticipantIds;
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

    const supabase = getSupabaseServiceClient();
    
    const { data: participant, error } = await supabase
      .from('participants')
      .select('id')
      .eq('pool_id', poolId)
      .eq('email', userEmail.trim().toLowerCase())
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('Error checking if user is in pool:', error);
      return false;
    }

    return !!participant;
  } catch (error) {
    console.error('Error checking if user is in pool:', error);
    return false;
  }
}
