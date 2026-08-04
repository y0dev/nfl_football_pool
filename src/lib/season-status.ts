import { getSupabaseServiceClient } from './supabase';

export interface OverrideEligibility {
  allowed: boolean;
  reason?: string;
}

// Deliberately NOT a status-string match — games.status has been written
// with inconsistent casing across historical sync runs ('final', 'Final',
// 'finished' have all been observed for the same terminal state). `winner`
// being set is normally the reliable signal regardless of status casing —
// but a small number of real games end in a tie (no winner) with a terminal
// status, so status is also checked as a fallback. Matching port of the
// same rule in supabase/functions/determine-weekly-winners/index.ts —
// that function runs in Deno and can't import this file, so this is an
// intentional duplication, same relationship that file already documents
// with winner-calculator.ts.
const TERMINAL_GAME_STATUSES = new Set(['final', 'finished', 'cancelled']);
export function isGameFinished(game: { status?: string | null; winner?: string | null }): boolean {
  if (game.winner != null) return true;
  const status = game.status?.toLowerCase();
  return status != null && TERMINAL_GAME_STATUSES.has(status);
}

/**
 * Server-side gate for commissioner pick overrides — called from every
 * override write path (never trust the client-side disabled state alone).
 * Blocks overrides once a pool is no longer active (covers both "pool
 * inactive" and "season ended," which map to the same pools.is_active flag
 * — there is no separate concept in the schema) or once every game in the
 * target week has finished. Deliberately does NOT block on kickoff-only
 * locking (isWeekUnlockedForPicks) — overrides are a commissioner
 * correction tool used precisely while a week is in progress; only full
 * completion or an inactive pool should block them.
 */
export async function getOverrideEligibility(
  poolId: string,
  week: number,
  seasonType: number,
): Promise<OverrideEligibility> {
  const supabase = getSupabaseServiceClient();

  const { data: pool } = await supabase
    .from('pools')
    .select('is_active, season')
    .eq('id', poolId)
    .maybeSingle();

  if (!pool) {
    return { allowed: false, reason: 'Pool not found.' };
  }

  if (pool.is_active === false) {
    return { allowed: false, reason: 'This pool is no longer active.' };
  }

  const { data: games } = await supabase
    .from('games')
    .select('status, winner')
    .eq('week', week)
    .eq('season_type', seasonType)
    .eq('season', pool.season);

  if (games && games.length > 0 && games.every(isGameFinished)) {
    return { allowed: false, reason: "This week's picks are locked because the week has been completed." };
  }

  return { allowed: true };
}
