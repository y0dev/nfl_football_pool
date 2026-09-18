import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { checkPoolAccessFromRequest } from '@/lib/pool-access';
import { normalizeGameStatus } from '@/types/game';
import { debugError } from '@/lib/utils';

/**
 * Pick'em's counterpart to /api/picks/pick-counts, sourced from
 * pickem_picks instead of Confidence's picks table. Same reveal rule: a
 * game is only ever returned once it has started, or once every active
 * participant has picks in for every game in the week — a game meeting
 * neither condition is dropped before its picks are even queried, so a
 * client bug can't reveal them early.
 *
 * Pick'em's own "submitted" bar is stricter than Confidence's — a
 * participant only counts as done once they have a pick for EVERY
 * eligible game (matching submitPickemPick's own isAlreadyComplete rule
 * in src/lib/pickem.ts), not just "at least one pick recorded."
 *
 * Counts are keyed by selected_team, the same team-identifying string
 * LockedPickemGameRow already resolves via getTeam() for "Your pick".
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const poolId = searchParams.get('poolId');
    const week = searchParams.get('week');
    const seasonType = searchParams.get('seasonType');
    const season = searchParams.get('season');

    if (!poolId || !week || !seasonType) {
      return NextResponse.json(
        { success: false, error: 'poolId, week, and seasonType are required' },
        { status: 400 }
      );
    }

    const access = await checkPoolAccessFromRequest(poolId, request);
    if (!access.allowed) {
      return NextResponse.json({ success: false, error: 'Pool access required' }, { status: 403 });
    }

    const weekNumber = parseInt(week);
    const seasonTypeNumber = parseInt(seasonType);
    if (isNaN(weekNumber) || isNaN(seasonTypeNumber)) {
      return NextResponse.json({ success: false, error: 'Invalid week or season type' }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();

    let gamesQuery = supabase
      .from('games')
      .select('id, status')
      .eq('week', weekNumber)
      .eq('season_type', seasonTypeNumber);
    if (season) gamesQuery = gamesQuery.eq('season', parseInt(season));
    const { data: games, error: gamesError } = await gamesQuery;

    if (gamesError) {
      debugError('Error loading games for pickem pick counts:', gamesError);
      return NextResponse.json({ success: false, error: 'Failed to load games' }, { status: 500 });
    }

    if (!games || games.length === 0) {
      return NextResponse.json({ success: true, counts: {} });
    }

    const allGameIds = games.map(g => g.id);
    const startedGameIds = games
      .filter(g => normalizeGameStatus(g.status) !== 'scheduled')
      .map(g => g.id);

    const [{ count: activeParticipantCount }, { data: weekPicks, error: weekPicksError }] = await Promise.all([
      supabase.from('participants').select('id', { count: 'exact', head: true }).eq('pool_id', poolId).eq('is_active', true),
      supabase.from('pickem_picks').select('participant_id, game_id').eq('pool_id', poolId).in('game_id', allGameIds),
    ]);

    if (weekPicksError) {
      debugError('Error checking submission completeness for pickem pick counts:', weekPicksError);
      return NextResponse.json({ success: false, error: 'Failed to load picks' }, { status: 500 });
    }

    const gameIdsByParticipant = new Map<string, Set<string>>();
    (weekPicks ?? []).forEach(p => {
      if (!gameIdsByParticipant.has(p.participant_id)) gameIdsByParticipant.set(p.participant_id, new Set());
      gameIdsByParticipant.get(p.participant_id)!.add(p.game_id);
    });
    const completedParticipantCount = [...gameIdsByParticipant.values()]
      .filter(gameIds => gameIds.size >= allGameIds.length).length;
    const allSubmitted = (activeParticipantCount ?? 0) > 0 && completedParticipantCount >= (activeParticipantCount ?? 0);

    const revealGameIds = allSubmitted ? allGameIds : startedGameIds;
    if (revealGameIds.length === 0) {
      return NextResponse.json({ success: true, counts: {} });
    }

    const { data: picks, error: picksError } = await supabase
      .from('pickem_picks')
      .select('game_id, selected_team')
      .eq('pool_id', poolId)
      .in('game_id', revealGameIds);

    if (picksError) {
      debugError('Error loading picks for pickem pick counts:', picksError);
      return NextResponse.json({ success: false, error: 'Failed to load picks' }, { status: 500 });
    }

    const counts: Record<string, Record<string, number>> = {};
    (picks ?? []).forEach(pick => {
      if (!pick.selected_team) return;
      const gameCounts = counts[pick.game_id] ?? (counts[pick.game_id] = {});
      gameCounts[pick.selected_team] = (gameCounts[pick.selected_team] ?? 0) + 1;
    });

    return NextResponse.json({ success: true, counts });
  } catch (error) {
    debugError('Error in pickem pick-counts API:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
