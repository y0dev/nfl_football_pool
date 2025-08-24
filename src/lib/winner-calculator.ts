import { getSupabaseClient } from './supabase';

export interface WinnerResult {
  participant_id: string;
  participant_name: string;
  points: number;
  correct_picks: number;
  total_picks: number;
  tie_breaker_answer?: number;
  tie_breaker_difference?: number;
  rank: number;
  is_winner: boolean;
  tie_breaker_used: boolean;
}

export interface WeeklyWinner {
  pool_id: string;
  week: number;
  season: number;
  winner_participant_id: string;
  winner_name: string;
  winner_points: number;
  winner_correct_picks: number;
  tie_breaker_used: boolean;
  tie_breaker_question?: string;
  tie_breaker_answer?: number;
  winner_tie_breaker_answer?: number;
  tie_breaker_difference?: number;
  total_participants: number;
}

export interface SeasonWinner {
  pool_id: string;
  season: number;
  winner_participant_id: string;
  winner_name: string;
  total_points: number;
  total_correct_picks: number;
  weeks_won: number;
  tie_breaker_used: boolean;
  tie_breaker_question?: string;
  tie_breaker_answer?: number;
  winner_tie_breaker_answer?: number;
  tie_breaker_difference?: number;
  total_participants: number;
}

export interface PeriodWinner {
  pool_id: string;
  season: number;
  period_name: string;
  start_week: number;
  end_week: number;
  winner_participant_id: string;
  winner_name: string;
  period_points: number;
  period_correct_picks: number;
  weeks_won: number;
  tie_breaker_used: boolean;
  tie_breaker_question?: string;
  tie_breaker_answer?: number;
  winner_tie_breaker_answer?: number;
  tie_breaker_difference?: number;
  total_participants: number;
}

/**
 * Calculate weekly winners for a specific pool and week
 */
export async function calculateWeeklyWinners(
  poolId: string,
  week: number,
  season: number
): Promise<WeeklyWinner | null> {
  try {
    const supabase = getSupabaseClient();
    
    // Get all scores for the week
    const { data: scores, error: scoresError } = await supabase
      .from('scores')
      .select(`
        participant_id,
        points,
        correct_picks,
        total_picks,
        participants!inner(name)
      `)
      .eq('pool_id', poolId)
      .eq('week', week)
      .eq('season', season)
      .order('points', { ascending: false });

    if (scoresError) throw scoresError;
    if (!scores || scores.length === 0) return null;

    // Get tie breaker settings for the pool
    const { data: pool, error: poolError } = await supabase
      .from('pools')
      .select('tie_breaker_question, tie_breaker_answer')
      .eq('id', poolId)
      .single();

    if (poolError) throw poolError;

    // Find the highest score
    const maxPoints = scores[0].points;
    const topScorers = scores.filter(score => score.points === maxPoints);

    if (topScorers.length === 1) {
      // Single winner, no tie breaker needed
      const winner = topScorers[0];
      return {
        pool_id: poolId,
        week,
        season,
        winner_participant_id: winner.participant_id,
        winner_name: winner.participants.name,
        winner_points: winner.points,
        winner_correct_picks: winner.correct_picks,
        tie_breaker_used: false,
        tie_breaker_question: pool?.tie_breaker_question || undefined,
        total_participants: scores.length
      };
    } else {
      // Multiple winners, need tie breaker
      const tieBreakerResults = await resolveTieBreaker(
        poolId,
        week,
        season,
        topScorers.map(s => ({
          participant_id: s.participant_id,
          participant_name: s.participants.name,
          points: s.points,
          correct_picks: s.correct_picks,
          total_picks: s.total_picks
        }))
      );

      if (tieBreakerResults.length > 0) {
        const winner = tieBreakerResults[0];
        return {
          pool_id: poolId,
          week,
          season,
          winner_participant_id: winner.participant_id,
          winner_name: winner.participant_name,
          winner_points: winner.points,
          winner_correct_picks: winner.correct_picks,
          tie_breaker_used: true,
          tie_breaker_question: pool?.tie_breaker_question || undefined,
          tie_breaker_answer: pool?.tie_breaker_answer || undefined,
          winner_tie_breaker_answer: winner.tie_breaker_answer,
          tie_breaker_difference: winner.tie_breaker_difference,
          total_participants: scores.length
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error calculating weekly winners:', error);
    return null;
  }
}

/**
 * Calculate season winners for a specific pool and season
 */
export async function calculateSeasonWinners(
  poolId: string,
  season: number
): Promise<SeasonWinner | null> {
  try {
    const supabase = getSupabaseClient();
    
    // Get all scores for the season
    const { data: scores, error: scoresError } = await supabase
      .from('scores')
      .select(`
        participant_id,
        points,
        correct_picks,
        total_picks,
        participants!inner(name)
      `)
      .eq('pool_id', poolId)
      .eq('season', season);

    if (scoresError) throw scoresError;
    if (!scores || scores.length === 0) return null;

    // Calculate total points and correct picks for each participant
    const participantTotals = new Map<string, {
      participant_id: string;
      participant_name: string;
      total_points: number;
      total_correct_picks: number;
      weeks_won: number;
    }>();

    scores.forEach(score => {
      const existing = participantTotals.get(score.participant_id);
      if (existing) {
        existing.total_points += score.points;
        existing.total_correct_picks += score.correct_picks;
        if (score.is_winner) {
          existing.weeks_won += 1;
        }
      } else {
        participantTotals.set(score.participant_id, {
          participant_id: score.participant_id,
          participant_name: score.participants.name,
          total_points: score.points,
          total_correct_picks: score.correct_picks,
          weeks_won: score.is_winner ? 1 : 0
        });
      }
    });

    const totals = Array.from(participantTotals.values())
      .sort((a, b) => b.total_points - a.total_points);

    if (totals.length === 0) return null;

    // Find the highest total score
    const maxPoints = totals[0].total_points;
    const topScorers = totals.filter(total => total.total_points === maxPoints);

    if (topScorers.length === 1) {
      // Single winner, no tie breaker needed
      const winner = topScorers[0];
      return {
        pool_id: poolId,
        season,
        winner_participant_id: winner.participant_id,
        winner_name: winner.participant_name,
        total_points: winner.total_points,
        total_correct_picks: winner.total_correct_picks,
        weeks_won: winner.weeks_won,
        tie_breaker_used: false,
        total_participants: totals.length
      };
    } else {
      // Multiple winners, need tie breaker
      const tieBreakerResults = await resolveSeasonTieBreaker(
        poolId,
        season,
        topScorers
      );

      if (tieBreakerResults.length > 0) {
        const winner = tieBreakerResults[0];
        return {
          pool_id: poolId,
          season,
          winner_participant_id: winner.participant_id,
          winner_name: winner.participant_name,
          total_points: winner.total_points,
          total_correct_picks: winner.total_correct_picks,
          weeks_won: winner.weeks_won,
          tie_breaker_used: true,
          winner_tie_breaker_answer: winner.tie_breaker_answer,
          tie_breaker_difference: winner.tie_breaker_difference,
          total_participants: totals.length
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error calculating season winners:', error);
    return null;
  }
}

/**
 * Calculate period winners (e.g., Q1, Q2, Q3, Q4, Playoffs)
 */
export async function calculatePeriodWinners(
  poolId: string,
  season: number,
  periodName: string,
  startWeek: number,
  endWeek: number
): Promise<PeriodWinner | null> {
  try {
    const supabase = getSupabaseClient();
    
    // Get all scores for the period
    const { data: scores, error: scoresError } = await supabase
      .from('scores')
      .select(`
        participant_id,
        points,
        correct_picks,
        total_picks,
        participants!inner(name)
      `)
      .eq('pool_id', poolId)
      .eq('season', season)
      .gte('week', startWeek)
      .lte('week', endWeek);

    if (scoresError) throw scoresError;
    if (!scores || scores.length === 0) return null;

    // Calculate period totals for each participant
    const participantTotals = new Map<string, {
      participant_id: string;
      participant_name: string;
      period_points: number;
      period_correct_picks: number;
      weeks_won: number;
    }>();

    scores.forEach(score => {
      const existing = participantTotals.get(score.participant_id);
      if (existing) {
        existing.period_points += score.points;
        existing.period_correct_picks += score.correct_picks;
        if (score.is_winner) {
          existing.weeks_won += 1;
        }
      } else {
        participantTotals.set(score.participant_id, {
          participant_id: score.participant_id,
          participant_name: score.participants.name,
          period_points: score.points,
          period_correct_picks: score.correct_picks,
          weeks_won: score.is_winner ? 1 : 0
        });
      }
    });

    const totals = Array.from(participantTotals.values())
      .sort((a, b) => b.period_points - a.period_points);

    if (totals.length === 0) return null;

    // Find the highest period score
    const maxPoints = totals[0].period_points;
    const topScorers = totals.filter(total => total.period_points === maxPoints);

    if (topScorers.length === 1) {
      // Single winner, no tie breaker needed
      const winner = topScorers[0];
      return {
        pool_id: poolId,
        season,
        period_name: periodName,
        start_week: startWeek,
        end_week: endWeek,
        winner_participant_id: winner.participant_id,
        winner_name: winner.participant_name,
        period_points: winner.period_points,
        period_correct_picks: winner.period_correct_picks,
        weeks_won: winner.weeks_won,
        tie_breaker_used: false,
        total_participants: totals.length
      };
    } else {
      // Multiple winners, need tie breaker
      const tieBreakerResults = await resolvePeriodTieBreaker(
        poolId,
        season,
        startWeek,
        endWeek,
        topScorers
      );

      if (tieBreakerResults.length > 0) {
        const winner = tieBreakerResults[0];
        return {
          pool_id: poolId,
          season,
          period_name: periodName,
          start_week: startWeek,
          end_week: endWeek,
          winner_participant_id: winner.participant_id,
          winner_name: winner.participant_name,
          period_points: winner.period_points,
          period_correct_picks: winner.period_correct_picks,
          weeks_won: winner.weeks_won,
          tie_breaker_used: true,
          winner_tie_breaker_answer: winner.tie_breaker_answer,
          tie_breaker_difference: winner.tie_breaker_difference,
          total_participants: totals.length
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error calculating period winners:', error);
    return null;
  }
}

/**
 * Resolve tie breakers for weekly winners
 */
async function resolveTieBreaker(
  poolId: string,
  week: number,
  season: number,
  tiedParticipants: Array<{
    participant_id: string;
    participant_name: string;
    points: number;
    correct_picks: number;
    total_picks: number;
  }>
): Promise<Array<{
  participant_id: string;
  participant_name: string;
  points: number;
  correct_picks: number;
  total_picks: number;
  tie_breaker_answer?: number;
  tie_breaker_difference?: number;
}>> {
  try {
    const supabase = getSupabaseClient();
    
    // Get tie breaker answers for the tied participants
    const { data: tieBreakers, error: tieBreakerError } = await supabase
      .from('tie_breakers')
      .select('participant_id, answer')
      .eq('pool_id', poolId)
      .eq('week', week)
      .eq('season', season)
      .in('participant_id', tiedParticipants.map(p => p.participant_id));

    if (tieBreakerError) throw tieBreakerError;

    // Get pool tie breaker answer
    const { data: pool, error: poolError } = await supabase
      .from('pools')
      .select('tie_breaker_answer')
      .eq('id', poolId)
      .single();

    if (poolError) throw poolError;

    const poolAnswer = pool?.tie_breaker_answer;
    if (!poolAnswer) {
      // No tie breaker answer, use random selection
      return tiedParticipants.sort(() => Math.random() - 0.5);
    }

    // Calculate tie breaker differences
    const participantsWithTieBreakers = tiedParticipants.map(participant => {
      const tieBreaker = tieBreakers?.find(tb => tb.participant_id === participant.participant_id);
      const tieBreakerAnswer = tieBreaker?.answer;
      const difference = tieBreakerAnswer ? Math.abs(tieBreakerAnswer - poolAnswer) : Infinity;
      
      return {
        ...participant,
        tie_breaker_answer: tieBreakerAnswer,
        tie_breaker_difference: difference
      };
    });

    // Sort by tie breaker difference (closest wins)
    return participantsWithTieBreakers.sort((a, b) => 
      (a.tie_breaker_difference || Infinity) - (b.tie_breaker_difference || Infinity)
    );
  } catch (error) {
    console.error('Error resolving tie breaker:', error);
    return tiedParticipants;
  }
}

/**
 * Resolve tie breakers for season winners
 */
async function resolveSeasonTieBreaker(
  poolId: string,
  season: number,
  tiedParticipants: Array<{
    participant_id: string;
    participant_name: string;
    total_points: number;
    total_correct_picks: number;
    weeks_won: number;
  }>
): Promise<Array<{
  participant_id: string;
  participant_name: string;
  total_points: number;
  total_correct_picks: number;
  weeks_won: number;
  tie_breaker_answer?: number;
  tie_breaker_difference?: number;
}>> {
  try {
    const supabase = getSupabaseClient();
    
    // Get pool tie breaker answer
    const { data: pool, error: poolError } = await supabase
      .from('pools')
      .select('tie_breaker_answer')
      .eq('id', poolId)
      .single();

    if (poolError) throw poolError;

    const poolAnswer = pool?.tie_breaker_answer;
    if (!poolAnswer) {
      // No tie breaker answer, use weeks won as secondary criteria
      return tiedParticipants.sort((a, b) => b.weeks_won - a.weeks_won);
    }

    // Get tie breaker answers for the tied participants (use the most recent week)
    const { data: tieBreakers, error: tieBreakerError } = await supabase
      .from('tie_breakers')
      .select('participant_id, answer, week')
      .eq('pool_id', poolId)
      .eq('season', season)
      .in('participant_id', tiedParticipants.map(p => p.participant_id))
      .order('week', { ascending: false });

    if (tieBreakerError) throw tieBreakerError;

    // Calculate tie breaker differences using the most recent answer for each participant
    const participantsWithTieBreakers = tiedParticipants.map(participant => {
      const tieBreaker = tieBreakers?.find(tb => tb.participant_id === participant.participant_id);
      const tieBreakerAnswer = tieBreaker?.answer;
      const difference = tieBreakerAnswer ? Math.abs(tieBreakerAnswer - poolAnswer) : Infinity;
      
      return {
        ...participant,
        tie_breaker_answer: tieBreakerAnswer,
        tie_breaker_difference: difference
      };
    });

    // Sort by tie breaker difference (closest wins)
    return participantsWithTieBreakers.sort((a, b) => 
      (a.tie_breaker_difference || Infinity) - (b.tie_breaker_difference || Infinity)
    );
  } catch (error) {
    console.error('Error resolving season tie breaker:', error);
    return tiedParticipants;
  }
}

/**
 * Resolve tie breakers for period winners
 */
async function resolvePeriodTieBreaker(
  poolId: string,
  season: number,
  startWeek: number,
  endWeek: number,
  tiedParticipants: Array<{
    participant_id: string;
    participant_name: string;
    period_points: number;
    period_correct_picks: number;
    weeks_won: number;
  }>
): Promise<Array<{
  participant_id: string;
  participant_name: string;
  period_points: number;
  period_correct_picks: number;
  weeks_won: number;
  tie_breaker_answer?: number;
  tie_breaker_difference?: number;
}>> {
  try {
    const supabase = getSupabaseClient();
    
    // Get pool tie breaker answer
    const { data: pool, error: poolError } = await supabase
      .from('pools')
      .select('tie_breaker_answer')
      .eq('id', poolId)
      .single();

    if (poolError) throw poolError;

    const poolAnswer = pool?.tie_breaker_answer;
    if (!poolAnswer) {
      // No tie breaker answer, use weeks won as secondary criteria
      return tiedParticipants.sort((a, b) => b.weeks_won - a.weeks_won);
    }

    // Get tie breaker answers for the tied participants (use the most recent week in the period)
    const { data: tieBreakers, error: tieBreakerError } = await supabase
      .from('tie_breakers')
      .select('participant_id, answer, week')
      .eq('pool_id', poolId)
      .eq('season', season)
      .gte('week', startWeek)
      .lte('week', endWeek)
      .in('participant_id', tiedParticipants.map(p => p.participant_id))
      .order('week', { ascending: false });

    if (tieBreakerError) throw tieBreakerError;

    // Calculate tie breaker differences using the most recent answer for each participant
    const participantsWithTieBreakers = tiedParticipants.map(participant => {
      const tieBreaker = tieBreakers?.find(tb => tb.participant_id === participant.participant_id);
      const tieBreakerAnswer = tieBreaker?.answer;
      const difference = tieBreakerAnswer ? Math.abs(tieBreakerAnswer - poolAnswer) : Infinity;
      
      return {
        ...participant,
        tie_breaker_answer: tieBreakerAnswer,
        tie_breaker_difference: difference
      };
    });

    // Sort by tie breaker difference (closest wins)
    return participantsWithTieBreakers.sort((a, b) => 
      (a.tie_breaker_difference || Infinity) - (b.tie_breaker_difference || Infinity)
    );
  } catch (error) {
    console.error('Error resolving period tie breaker:', error);
    return tiedParticipants;
  }
}
