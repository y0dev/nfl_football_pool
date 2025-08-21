import { getSupabaseClient } from './supabase';

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
 * This function handles multiple levels of ties by applying tie breakers in sequence
 */
export async function applyTieBreakers(
  poolId: string,
  week: number,
  season: number,
  tiedParticipants: Array<{ participant_id: string; participant_name: string; points: number; correct_picks?: number }>,
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

  // Apply primary tie breaker method
  let results = await applyPrimaryTieBreaker(poolId, week, season, tiedParticipants, settings);
  
  // If there are still ties after primary method, apply secondary tie breakers
  results = await applySecondaryTieBreakers(poolId, week, season, results, settings);
  
  return results;
}

/**
 * Apply the primary tie breaker method based on pool settings
 */
async function applyPrimaryTieBreaker(
  poolId: string,
  week: number,
  season: number,
  tiedParticipants: Array<{ participant_id: string; participant_name: string; points: number; correct_picks?: number }>,
  settings: TieBreakerSettings
): Promise<TieBreakerResult[]> {
  let results: TieBreakerResult[];
  
  switch (settings.method) {
    case 'total_points':
      results = await breakTieByTotalPoints(poolId, season, tiedParticipants);
      break;
    
    case 'correct_picks':
      results = await breakTieByCorrectPicks(poolId, season, tiedParticipants);
      break;
    
    case 'accuracy':
      results = await breakTieByAccuracy(poolId, season, tiedParticipants);
      break;
    
    case 'last_week':
      results = await breakTieByLastWeek(poolId, week, season, tiedParticipants);
      break;
    
    case 'custom':
      results = await breakTieByCustomQuestion(poolId, week, season, tiedParticipants, settings);
      break;
    
    default:
      // Default fallback: use total points
      results = await breakTieByTotalPoints(poolId, season, tiedParticipants);
  }
  
  // Special case: if the primary method is 'correct_picks' and there are still ties,
  // and we have correct_picks data available, check if they're actually the same
  if (settings.method === 'correct_picks' && tiedParticipants.length > 1) {
    const hasCorrectPicksData = tiedParticipants.every(p => p.correct_picks !== undefined);
    if (hasCorrectPicksData) {
      // Check if all participants have the same number of correct picks
      const uniqueCorrectPicks = new Set(tiedParticipants.map(p => p.correct_picks));
      if (uniqueCorrectPicks.size === 1) {
        // All participants have the same correct picks, apply confidence points tie breaker
        results = await breakTieByConfidencePoints(poolId, week, season, tiedParticipants);
      }
    }
  }
  
  return results;
}

/**
 * Apply secondary tie breakers to resolve remaining ties
 * This creates a cascade of tie breakers to ensure all ties are resolved
 */
async function applySecondaryTieBreakers(
  poolId: string,
  week: number,
  season: number,
  primaryResults: TieBreakerResult[],
  settings: TieBreakerSettings
): Promise<TieBreakerResult[]> {
  // Group participants by their primary tie breaker value
  const valueGroups = new Map<number, TieBreakerResult[]>();
  primaryResults.forEach(result => {
    if (!valueGroups.has(result.tie_breaker_value)) {
      valueGroups.set(result.tie_breaker_value, []);
    }
    valueGroups.get(result.tie_breaker_value)!.push(result);
  });

  const finalResults: TieBreakerResult[] = [];
  let currentRank = 1;

  // Process each group
  for (const [value, participants] of valueGroups) {
    if (participants.length === 1) {
      // No tie, just assign rank
      participants[0].tie_breaker_rank = currentRank;
      finalResults.push(participants[0]);
      currentRank++;
    } else {
      // Still tied, apply secondary tie breakers
      const secondaryResults = await applySecondaryTieBreakerCascade(
        poolId, week, season, participants, settings
      );
      
      // Assign ranks to secondary results
      secondaryResults.forEach((result, index) => {
        result.tie_breaker_rank = currentRank + index;
      });
      
      finalResults.push(...secondaryResults);
      currentRank += secondaryResults.length;
    }
  }

  return finalResults;
}

/**
 * Apply a cascade of secondary tie breakers until all ties are resolved
 */
async function applySecondaryTieBreakerCascade(
  poolId: string,
  week: number,
  season: number,
  tiedParticipants: TieBreakerResult[],
  settings: TieBreakerSettings
): Promise<TieBreakerResult[]> {
  // Define the cascade of tie breaker methods to try
  const tieBreakerCascade = [
    'total_points',
    'correct_picks', 
    'accuracy',
    'last_week',
    'custom',
    'confidence_points'
  ];

  // Remove the primary method from the cascade to avoid redundancy
  const secondaryMethods = tieBreakerCascade.filter(method => method !== settings.method);

  // Try each secondary method until ties are resolved
  for (const method of secondaryMethods) {
    try {
      let results: TieBreakerResult[];
      
      switch (method) {
        case 'total_points':
          results = await breakTieByTotalPoints(poolId, season, tiedParticipants);
          break;
        case 'correct_picks':
          results = await breakTieByCorrectPicks(poolId, season, tiedParticipants);
          break;
        case 'accuracy':
          results = await breakTieByAccuracy(poolId, season, tiedParticipants);
          break;
        case 'last_week':
          results = await breakTieByLastWeek(poolId, week, season, tiedParticipants);
          break;
        case 'custom':
          results = await breakTieByCustomQuestion(poolId, week, season, tiedParticipants, settings);
          break;
        case 'confidence_points':
          results = await breakTieByConfidencePoints(poolId, week, season, tiedParticipants);
          break;
        default:
          continue;
      }

      // Check if this method resolved the ties
      const valueGroups = new Map<number, TieBreakerResult[]>();
      results.forEach(result => {
        if (!valueGroups.has(result.tie_breaker_value)) {
          valueGroups.set(result.tie_breaker_value, []);
        }
        valueGroups.get(result.tie_breaker_value)!.push(result);
      });

      // If all groups have only one participant, ties are resolved
      const allTiesResolved = Array.from(valueGroups.values()).every(group => group.length === 1);
      
      if (allTiesResolved) {
        return results;
      }

      // If ties still exist, continue to the next method
      // But first, try to resolve remaining ties within each group
      const resolvedResults: TieBreakerResult[] = [];
      let rankOffset = 0;
      
      for (const [value, group] of valueGroups) {
        if (group.length === 1) {
          group[0].tie_breaker_rank = rankOffset + 1;
          resolvedResults.push(group[0]);
          rankOffset++;
        } else {
          // Recursively apply tie breakers to this group
          const subResults = await applySecondaryTieBreakerCascade(
            poolId, week, season, group, settings
          );
          
          // Assign ranks to sub-results
          subResults.forEach((result, index) => {
            result.tie_breaker_rank = rankOffset + index + 1;
          });
          
          resolvedResults.push(...subResults);
          rankOffset += subResults.length;
        }
      }
      
      return resolvedResults;
      
    } catch (error) {
      console.error(`Error applying secondary tie breaker method ${method}:`, error);
      continue;
    }
  }

  // If all methods fail, assign random ranks (shouldn't happen in practice)
  return tiedParticipants.map((p, index) => ({
    ...p,
    tie_breaker_rank: index + 1
  }));
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
    const { data: scores, error } = await getSupabaseClient()
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
    const { data: scores, error } = await getSupabaseClient()
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
    const { data: scores, error } = await getSupabaseClient()
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
    const { data: scores, error } = await getSupabaseClient()
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

    const { data: tieBreakers, error } = await getSupabaseClient()
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
 * Break ties by confidence points when participants have the same score and same correct picks
 * This is the final tie breaker that should resolve all remaining ties
 */
async function breakTieByConfidencePoints(
  poolId: string,
  week: number,
  season: number,
  participants: Array<{ participant_id: string; participant_name: string; points: number; correct_picks?: number }>
): Promise<TieBreakerResult[]> {
  try {
    // Get picks for this specific week to calculate confidence points
    const { data: picks, error } = await getSupabaseClient()
      .from('picks')
      .select('participant_id, confidence_points, predicted_winner, games!inner(winner, week, season_type)')
      .eq('pool_id', poolId)
      .eq('games.week', week)
      .eq('games.season_type', season)
      .in('participant_id', participants.map(p => p.participant_id));

    if (error) throw error;

    // Calculate total confidence points for correct picks for each participant
    const confidencePoints = new Map<string, number>();
    picks?.forEach(pick => {
      if (pick.predicted_winner === pick.games?.winner) {
        const current = confidencePoints.get(pick.participant_id) || 0;
        confidencePoints.set(pick.participant_id, current + pick.confidence_points);
      }
    });

    // Sort by confidence points (descending) and assign ranks
    const results: TieBreakerResult[] = participants
      .map(p => ({
        participant_id: p.participant_id,
        participant_name: p.participant_name,
        tie_breaker_value: confidencePoints.get(p.participant_id) || 0,
        tie_breaker_rank: 0
      }))
      .sort((a, b) => b.tie_breaker_value - a.tie_breaker_value);

    // Assign ranks
    results.forEach((result, index) => {
      result.tie_breaker_rank = index + 1;
    });

    return results;
  } catch (error) {
    console.error('Error breaking tie by confidence points:', error);
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
    // Use service role client to bypass RLS policies
    const { getSupabaseServiceClient } = await import('@/lib/supabase');
    const supabase = getSupabaseServiceClient();
    
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
    // Use service role client to bypass RLS policies
    const { getSupabaseServiceClient } = await import('@/lib/supabase');
    const supabase = getSupabaseServiceClient();
    
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
