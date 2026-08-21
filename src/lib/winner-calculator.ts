import { getSupabaseServiceClient } from './supabase-service';
import { PERIOD_WEEKS, SUPER_BOWL_SEASON_TYPE, debugLog, debugError } from './utils';

/**
 * Supabase's JS client returns a to-one foreign-key join (participants!inner)
 * as a plain object in practice, not the one-element array its generated
 * types claim — code that indexed [0] into it was silently getting undefined
 * and falling back to "Unknown" for every winner name. Handles both shapes.
 */
function extractParticipantName(participants: unknown): string {
  const row = Array.isArray(participants) ? participants[0] : participants;
  return (row as ParticipantData | undefined)?.name || 'Unknown';
}
interface ParticipantData {
  name: string;
}

export interface WeeklyWinner {
  pool_id: string;
  week: number;
  season: number;
  season_type: number;
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
  winner_points: number;
  winner_total_picks: number;
  winner_correct_picks: number;
  winner_weeks_won: number;
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
  season: number,
  seasonType: number = 2
): Promise<WeeklyWinner | null> {
  try {
    const supabase = getSupabaseServiceClient();

    // Get all scores for the week — must scope to season_type since preseason,
    // regular season, and playoffs each number their weeks independently.
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
      .eq('season_type', seasonType)
      .order('points', { ascending: false });

    if (scoresError) throw scoresError;
    if (!scores || scores.length === 0) return null;

    // Get tie breaker settings and pool type for the pool
    const { data: pool, error: poolError } = await supabase
      .from('pools')
      .select('tie_breaker_question, tie_breaker_answer, pool_type')
      .eq('id', poolId)
      .single();

    if (poolError) throw poolError;

    // Find the highest score
    const maxPoints = scores[0].points;

    // If all participants have 0 points, there's no winner
    if (maxPoints === 0) {
      debugLog(`All participants have 0 points for week ${week}, season ${season}. No winner declared.`);
      return null;
    }

    const topScorers = scores.filter(score => score.points === maxPoints);

    if (topScorers.length === 1) {
      // Single winner, no tie breaker needed
      const winner = topScorers[0];
      return {
        pool_id: poolId,
        week,
        season,
        season_type: seasonType,
        winner_participant_id: winner.participant_id,
        winner_name: extractParticipantName(winner.participants),
        winner_points: winner.points,
        winner_correct_picks: winner.correct_picks,
        tie_breaker_used: false,
        tie_breaker_question: pool?.tie_breaker_question || undefined,
        total_participants: scores.length
      };
    } else {
      // Multiple winners, check if tie breakers should be used
      const isNormalPool = pool?.pool_type === 'normal' || pool?.pool_type === null || pool?.pool_type === undefined;
      const isPeriodWeek = PERIOD_WEEKS.includes(week as typeof PERIOD_WEEKS[number]);
      const isSuperBowl = seasonType === SUPER_BOWL_SEASON_TYPE;
      const shouldUseTieBreaker = !isNormalPool || isPeriodWeek || isSuperBowl;

      if (!shouldUseTieBreaker) {
        // For normal pools during regular weeks, all tied participants are winners
        // Return the first participant as the "winner" but note that it's a tie
        const winner = topScorers[0];
        return {
          pool_id: poolId,
          week,
          season,
          season_type: seasonType,
          winner_participant_id: winner.participant_id,
          winner_name: extractParticipantName(winner.participants),
          winner_points: winner.points,
          winner_correct_picks: winner.correct_picks,
          tie_breaker_used: false,
          tie_breaker_question: pool?.tie_breaker_question || undefined,
          total_participants: scores.length
        };
      } else {
        // Use tie breaker for knockout pools or normal pools during period weeks
        const tieBreakerResults = await resolveTieBreaker(
          poolId,
          week,
          season,
          seasonType,
          topScorers.map(s => ({
            participant_id: s.participant_id,
            participant_name: extractParticipantName(s.participants),
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
            season_type: seasonType,
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
    }

    return null;
  } catch (error) {
    debugError('Error calculating weekly winners:', error);
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
  seasonType: number,
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
    const supabase = getSupabaseServiceClient();

    // Get tie breaker answers for the tied participants
    const { data: tieBreakers, error: tieBreakerError } = await supabase
      .from('tie_breakers')
      .select('participant_id, answer')
      .eq('pool_id', poolId)
      .eq('week', week)
      .eq('season', season)
      .eq('season_type', seasonType)
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
    debugError('Error resolving tie breaker:', error);
    return tiedParticipants;
  }
}

