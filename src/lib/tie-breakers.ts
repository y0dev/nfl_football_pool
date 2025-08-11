import { supabase } from './supabase';

export interface TieBreakerResult {
  participant_id: string;
  participant_name: string;
  tie_breaker_value: number;
  tie_breaker_rank: number;
}

export interface TieBreakerSettings {
  method: string;
  question: string | null;
  answer: number | null;
}

/**
 * Apply tie-breakers to a list of participants with the same score
 */
export async function applyTieBreakers(
  poolId: string,
  week: number,
  season: number,
  tiedParticipants: Array<{ participant_id: string; participant_name: string; points: number }>,
  settings: TieBreakerSettings
): Promise<TieBreakerResult[]> {
  if (tiedParticipants.length <= 1) {
    return tiedParticipants.map((p, index) => ({
      participant_id: p.participant_id,
      participant_name: p.participant_name,
      tie_breaker_value: 0,
      tie_breaker_rank: index + 1
    }));
  }

  switch (settings.method) {
    case 'total_points':
      return await breakTieByTotalPoints(poolId, season, tiedParticipants);
    
    case 'correct_picks':
      return await breakTieByCorrectPicks(poolId, season, tiedParticipants);
    
    case 'accuracy':
      return await breakTieByAccuracy(poolId, season, tiedParticipants);
    
    case 'last_week':
      return await breakTieByLastWeek(poolId, week, season, tiedParticipants);
    
    case 'custom':
      return await breakTieByCustomQuestion(poolId, week, season, tiedParticipants, settings);
    
    default:
      // Default fallback: use total points
      return await breakTieByTotalPoints(poolId, season, tiedParticipants);
  }
}

/**
 * Break ties by total points across all weeks
 */
async function breakTieByTotalPoints(
  poolId: string,
  season: number,
  participants: Array<{ participant_id: string; participant_name: string }>
): Promise<TieBreakerResult[]> {
  try {
    const { data: scores, error } = await supabase
      .from('scores')
      .select('participant_id, points')
      .eq('pool_id', poolId)
      .eq('season', season)
      .in('participant_id', participants.map(p => p.participant_id));

    if (error) throw error;

    // Calculate total points for each participant
    const totalPoints = new Map<string, number>();
    scores?.forEach(score => {
      const current = totalPoints.get(score.participant_id) || 0;
      totalPoints.set(score.participant_id, current + score.points);
    });

    // Sort by total points (descending) and assign ranks
    const results: TieBreakerResult[] = participants
      .map(p => ({
        participant_id: p.participant_id,
        participant_name: p.participant_name,
        tie_breaker_value: totalPoints.get(p.participant_id) || 0,
        tie_breaker_rank: 0
      }))
      .sort((a, b) => b.tie_breaker_value - a.tie_breaker_value);

    // Assign ranks
    results.forEach((result, index) => {
      result.tie_breaker_rank = index + 1;
    });

    return results;
  } catch (error) {
    console.error('Error breaking tie by total points:', error);
    return participants.map((p, index) => ({
      participant_id: p.participant_id,
      participant_name: p.participant_name,
      tie_breaker_value: 0,
      tie_breaker_rank: index + 1
    }));
  }
}

/**
 * Break ties by total correct picks across all weeks
 */
async function breakTieByCorrectPicks(
  poolId: string,
  season: number,
  participants: Array<{ participant_id: string; participant_name: string }>
): Promise<TieBreakerResult[]> {
  try {
    const { data: scores, error } = await supabase
      .from('scores')
      .select('participant_id, correct_picks')
      .eq('pool_id', poolId)
      .eq('season', season)
      .in('participant_id', participants.map(p => p.participant_id));

    if (error) throw error;

    // Calculate total correct picks for each participant
    const totalCorrect = new Map<string, number>();
    scores?.forEach(score => {
      const current = totalCorrect.get(score.participant_id) || 0;
      totalCorrect.set(score.participant_id, current + score.correct_picks);
    });

    // Sort by total correct picks (descending) and assign ranks
    const results: TieBreakerResult[] = participants
      .map(p => ({
        participant_id: p.participant_id,
        participant_name: p.participant_name,
        tie_breaker_value: totalCorrect.get(p.participant_id) || 0,
        tie_breaker_rank: 0
      }))
      .sort((a, b) => b.tie_breaker_value - a.tie_breaker_value);

    // Assign ranks
    results.forEach((result, index) => {
      result.tie_breaker_rank = index + 1;
    });

    return results;
  } catch (error) {
    console.error('Error breaking tie by correct picks:', error);
    return participants.map((p, index) => ({
      participant_id: p.participant_id,
      participant_name: p.participant_name,
      tie_breaker_value: 0,
      tie_breaker_rank: index + 1
    }));
  }
}

/**
 * Break ties by pick accuracy percentage
 */
async function breakTieByAccuracy(
  poolId: string,
  season: number,
  participants: Array<{ participant_id: string; participant_name: string }>
): Promise<TieBreakerResult[]> {
  try {
    const { data: scores, error } = await supabase
      .from('scores')
      .select('participant_id, correct_picks, total_picks')
      .eq('pool_id', poolId)
      .eq('season', season)
      .in('participant_id', participants.map(p => p.participant_id));

    if (error) throw error;

    // Calculate accuracy for each participant
    const accuracy = new Map<string, number>();
    scores?.forEach(score => {
      if (score.total_picks > 0) {
        const current = accuracy.get(score.participant_id) || 0;
        const weekAccuracy = (score.correct_picks / score.total_picks) * 100;
        accuracy.set(score.participant_id, current + weekAccuracy);
      }
    });

    // Sort by accuracy (descending) and assign ranks
    const results: TieBreakerResult[] = participants
      .map(p => ({
        participant_id: p.participant_id,
        participant_name: p.participant_name,
        tie_breaker_value: accuracy.get(p.participant_id) || 0,
        tie_breaker_rank: 0
      }))
      .sort((a, b) => b.tie_breaker_value - a.tie_breaker_value);

    // Assign ranks
    results.forEach((result, index) => {
      result.tie_breaker_rank = index + 1;
    });

    return results;
  } catch (error) {
    console.error('Error breaking tie by accuracy:', error);
    return participants.map((p, index) => ({
      participant_id: p.participant_id,
      participant_name: p.participant_name,
      tie_breaker_value: 0,
      tie_breaker_rank: index + 1
    }));
  }
}

/**
 * Break ties by performance in the most recent week
 */
async function breakTieByLastWeek(
  poolId: string,
  week: number,
  season: number,
  participants: Array<{ participant_id: string; participant_name: string }>
): Promise<TieBreakerResult[]> {
  try {
    const { data: scores, error } = await supabase
      .from('scores')
      .select('participant_id, points')
      .eq('pool_id', poolId)
      .eq('week', week)
      .eq('season', season)
      .in('participant_id', participants.map(p => p.participant_id));

    if (error) throw error;

    // Sort by points in the current week (descending) and assign ranks
    const results: TieBreakerResult[] = participants
      .map(p => {
        const score = scores?.find(s => s.participant_id === p.participant_id);
        return {
          participant_id: p.participant_id,
          participant_name: p.participant_name,
          tie_breaker_value: score?.points || 0,
          tie_breaker_rank: 0
        };
      })
      .sort((a, b) => b.tie_breaker_value - a.tie_breaker_value);

    // Assign ranks
    results.forEach((result, index) => {
      result.tie_breaker_rank = index + 1;
    });

    return results;
  } catch (error) {
    console.error('Error breaking tie by last week:', error);
    return participants.map((p, index) => ({
      participant_id: p.participant_id,
      participant_name: p.participant_name,
      tie_breaker_value: 0,
      tie_breaker_rank: index + 1
    }));
  }
}

/**
 * Break ties by custom question answer
 */
async function breakTieByCustomQuestion(
  poolId: string,
  week: number,
  season: number,
  participants: Array<{ participant_id: string; participant_name: string }>,
  settings: TieBreakerSettings
): Promise<TieBreakerResult[]> {
  try {
    if (!settings.answer) {
      throw new Error('Custom tie-breaker answer not set');
    }

    const { data: tieBreakers, error } = await supabase
      .from('tie_breakers')
      .select('participant_id, answer')
      .eq('pool_id', poolId)
      .eq('week', week)
      .eq('season', season)
      .in('participant_id', participants.map(p => p.participant_id));

    if (error) throw error;

    // Calculate how close each answer is to the correct answer
    const results: TieBreakerResult[] = participants
      .map(p => {
        const tieBreaker = tieBreakers?.find(tb => tb.participant_id === p.participant_id);
        const difference = tieBreaker ? Math.abs(tieBreaker.answer - settings.answer!) : Infinity;
        
        return {
          participant_id: p.participant_id,
          participant_name: p.participant_name,
          tie_breaker_value: difference,
          tie_breaker_rank: 0
        };
      })
      .sort((a, b) => a.tie_breaker_value - b.tie_breaker_value); // Closest wins

    // Assign ranks
    results.forEach((result, index) => {
      result.tie_breaker_rank = index + 1;
    });

    return results;
  } catch (error) {
    console.error('Error breaking tie by custom question:', error);
    return participants.map((p, index) => ({
      participant_id: p.participant_id,
      participant_name: p.participant_name,
      tie_breaker_value: 0,
      tie_breaker_rank: index + 1
    }));
  }
}

/**
 * Get tie-breaker settings for a pool
 */
export async function getTieBreakerSettings(poolId: string): Promise<TieBreakerSettings | null> {
  try {
    const { data: pool, error } = await supabase
      .from('pools')
      .select('tie_breaker_method, tie_breaker_question, tie_breaker_answer')
      .eq('id', poolId)
      .single();

    if (error) throw error;

    return {
      method: pool.tie_breaker_method || 'total_points',
      question: pool.tie_breaker_question,
      answer: pool.tie_breaker_answer
    };
  } catch (error) {
    console.error('Error getting tie-breaker settings:', error);
    return null;
  }
}

/**
 * Save tie-breaker settings for a pool
 */
export async function saveTieBreakerSettings(
  poolId: string,
  settings: TieBreakerSettings
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('pools')
      .update({
        tie_breaker_method: settings.method,
        tie_breaker_question: settings.question,
        tie_breaker_answer: settings.answer
      })
      .eq('id', poolId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error saving tie-breaker settings:', error);
    return false;
  }
}
