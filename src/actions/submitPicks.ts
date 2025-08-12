import { getSupabaseClient } from '@/lib/supabase';

export async function submitPicks(picks: Array<{
  participant_id: string;
  pool_id: string;
  game_id: string;
  predicted_winner: string;
  confidence_points: number;
}>) {
  try {
    const supabase = getSupabaseClient();
    
    // Validate picks
    if (picks.length === 0) {
      throw new Error('No picks provided');
    }

    // Check if participant has already submitted picks for this week
    const firstPick = picks[0];
    const { data: existingPicks, error: checkError } = await supabase
      .from('picks')
      .select('id')
      .eq('participant_id', firstPick.participant_id)
      .eq('pool_id', firstPick.pool_id);

    if (checkError) {
      console.error('Error checking existing picks:', checkError);
      throw checkError;
    }

    if (existingPicks && existingPicks.length > 0) {
      throw new Error('Picks already submitted for this week');
    }

    // Check if games are locked
    const gameIds = picks.map(pick => pick.game_id);
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, status, kickoff_time, week')
      .in('id', gameIds);

    if (gamesError) {
      console.error('Error checking games:', gamesError);
      throw gamesError;
    }

    const now = new Date();
    const lockedGames = games?.filter(game => {
      const kickoffTime = new Date(game.kickoff_time);
      return kickoffTime <= now || game.status !== 'scheduled';
    });

    if (lockedGames && lockedGames.length > 0) {
      throw new Error('Some games are locked and cannot be picked');
    }

    // Validate confidence points
    const confidencePoints = picks.map(pick => pick.confidence_points);
    const uniquePoints = new Set(confidencePoints);
    if (uniquePoints.size !== confidencePoints.length) {
      throw new Error('Confidence points must be unique');
    }

    const sortedPoints = confidencePoints.sort((a, b) => a - b);
    const expectedPoints = Array.from({ length: picks.length }, (_, i) => i + 1);
    if (JSON.stringify(sortedPoints) !== JSON.stringify(expectedPoints)) {
      throw new Error('Confidence points must be sequential from 1 to number of games');
    }

    // Insert picks
    const { data, error } = await supabase
      .from('picks')
      .insert(picks)
      .select();

    if (error) {
      console.error('Error submitting picks:', error);
      throw error;
    }

    // Log the submission
    const week = games?.[0]?.week || 'unknown';
    await supabase
      .from('audit_logs')
      .insert({
        action: 'submit_picks',
        user_id: firstPick.participant_id,
        pool_id: firstPick.pool_id,
        details: `Submitted ${picks.length} picks for week ${week}`
      });

    return data;
  } catch (error) {
    console.error('Error submitting picks:', error);
    throw error;
  }
}
