import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { checkPoolAccessFromRequest } from '@/lib/pool-access';
import { normalizeGameStatus } from '@/types/game';
import { debugError } from '@/lib/utils';

/**
 * Per-game pick distribution ("N picked Team A, M picked Team B") for the
 * Confidence picks page's game cards. A game that hasn't kicked off yet is
 * dropped before its picks are even queried — the response can never carry
 * counts for a still-scheduled game, so a client bug can't reveal picks
 * before that game locks. This mirrors the access gate on /api/leaderboard.
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
      debugError('Error loading games for pick counts:', gamesError);
      return NextResponse.json({ success: false, error: 'Failed to load games' }, { status: 500 });
    }

    const startedGameIds = (games ?? [])
      .filter(g => normalizeGameStatus(g.status) !== 'scheduled')
      .map(g => g.id);

    if (startedGameIds.length === 0) {
      return NextResponse.json({ success: true, counts: {} });
    }

    const { data: picks, error: picksError } = await supabase
      .from('picks')
      .select('game_id, predicted_winner')
      .eq('pool_id', poolId)
      .in('game_id', startedGameIds);

    if (picksError) {
      debugError('Error loading picks for pick counts:', picksError);
      return NextResponse.json({ success: false, error: 'Failed to load picks' }, { status: 500 });
    }

    const counts: Record<string, Record<string, number>> = {};
    (picks ?? []).forEach(pick => {
      if (!pick.predicted_winner) return;
      const gameCounts = counts[pick.game_id] ?? (counts[pick.game_id] = {});
      gameCounts[pick.predicted_winner] = (gameCounts[pick.predicted_winner] ?? 0) + 1;
    });

    return NextResponse.json({ success: true, counts });
  } catch (error) {
    debugError('Error in pick-counts API:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
