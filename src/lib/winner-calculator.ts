import { getSupabaseServiceClient } from './supabase-service';
import {
  computeConfidenceResults,
  loadConfidenceResultsInput,
  toWeeklyWinnerRow,
} from '../../supabase/functions/_shared/confidence-results';

export interface WeeklyWinner {
  pool_id: string;
  week: number;
  season: number;
  season_type: number;
  winner_participant_id: string;
  /** Every co-winner on a shared week, e.g. "Jason & Karen". */
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

/**
 * The weekly winner for one pool and week, by the same rules as Season
 * Review and the determine-weekly-winners cron (they all go through
 * supabase/functions/_shared/confidence-results.ts). Null when the week isn't
 * complete or nobody scored. Throws on a database error rather than
 * reporting "no winner".
 */
export async function calculateWeeklyWinners(
  poolId: string,
  week: number,
  season: number,
  seasonType: number = 2
): Promise<WeeklyWinner | null> {
  const supabase = getSupabaseServiceClient();

  const { data: pool, error: poolError } = await supabase
    .from('pools')
    .select('id, pool_type, tie_breaker_question, tie_breaker_answer')
    .eq('id', poolId)
    .single();
  if (poolError) throw poolError;

  const syncPool = { ...pool, season };
  const results = computeConfidenceResults(await loadConfidenceResultsInput(supabase, syncPool));
  const weekResult = results.weeks.find(w => w.week === week && w.season_type === seasonType);
  const row = weekResult ? toWeeklyWinnerRow(poolId, season, syncPool, weekResult) : null;
  if (!row) return null;

  return {
    ...row,
    tie_breaker_question: row.tie_breaker_question ?? undefined,
    tie_breaker_answer: row.tie_breaker_answer ?? undefined,
    winner_tie_breaker_answer: row.winner_tie_breaker_answer ?? undefined,
    tie_breaker_difference: row.tie_breaker_difference ?? undefined,
  };
}
