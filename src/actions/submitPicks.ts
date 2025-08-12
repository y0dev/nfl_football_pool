import { getSupabaseClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

export async function submitPicks(picks: Array<{
  participant_id: string;
  pool_id: string;
  game_id: string;
  predicted_winner: string;
  confidence_points: number;
}>, sessionToken?: string) {
  try {
    // Server-side validation: check if picks are being submitted for the current week
    if (picks.length === 0) {
      throw new Error('No picks to submit');
    }

    // Get the first pick to check pool and week
    const firstPick = picks[0];
    
    // Verify the participant hasn't already submitted picks for this week
    const { data: existingPicks, error: checkError } = await getSupabaseClient()
      .from('picks')
      .select('id')
      .eq('participant_id', firstPick.participant_id)
      .eq('pool_id', firstPick.pool_id)
      .eq('games.week', new Date().getFullYear()) // Current season
      .limit(1);

    if (checkError) {
      console.error('Error checking existing picks:', checkError);
      throw new Error('Failed to validate submission');
    }

    if (existingPicks && existingPicks.length > 0) {
      throw new Error('Picks have already been submitted for this participant');
    }

    // Additional security: check if games are locked (past kickoff time)
    const { data: games, error: gamesError } = await getSupabaseClient()
      .from('games')
      .select('id, kickoff_time')
      .in('id', picks.map(p => p.game_id));

    if (gamesError) {
      console.error('Error checking games:', gamesError);
      throw new Error('Failed to validate games');
    }

    // Check if any games have already started
    const now = new Date();
    const lockedGames = games?.filter(game => new Date(game.kickoff_time) <= now);
    
    if (lockedGames && lockedGames.length > 0) {
      throw new Error(`Cannot submit picks for games that have already started`);
    }

    // Validate confidence points are unique and sequential
    const confidencePoints = picks.map(p => p.confidence_points).sort((a, b) => a - b);
    const expectedPoints = Array.from({ length: picks.length }, (_, i) => i + 1);
    
    if (JSON.stringify(confidencePoints) !== JSON.stringify(expectedPoints)) {
      throw new Error('Confidence points must be unique and sequential from 1 to number of games');
    }

    // Submit the picks
    const { data, error } = await getSupabaseClient()
      .from('picks')
      .insert(picks);

    if (error) throw error;
    
    // Log the submission for audit purposes
    await getSupabaseClient()
      .from('audit_logs')
      .insert({
        action: 'picks_submitted',
        admin_id: firstPick.participant_id, // Using participant_id as admin_id for audit
        entity: 'picks',
        entity_id: firstPick.participant_id,
        details: {
          pool_id: firstPick.pool_id,
          week: new Date().getFullYear(),
          pick_count: picks.length,
          session_token: sessionToken ? 'present' : 'none'
        }
      });

    return data;
  } catch (error) {
    console.error('Error submitting picks:', error);
    throw error;
  }
}
