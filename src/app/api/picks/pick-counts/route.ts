import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { checkPoolAccessFromRequest } from '@/lib/pool-access';
import { normalizeGameStatus } from '@/types/game';
import { debugError } from '@/lib/utils';

/**
 * Per-game pick distribution ("N picked Team A, M picked Team B") for the
 * Confidence picks page's game cards. A game is only ever revealed once
 * EITHER it has actually kicked off, OR every active participant in the
 * pool has already submitted their picks for the week — whichever comes
 * first. A game that's still scheduled AND not everyone is in yet is
 * dropped before its picks are even queried, so the response can never
 * carry counts for it; a client bug can't reveal picks early. This mirrors
 * the access gate on /api/leaderboard.
 *
 * Note: submitting doesn't lock a participant's picks — they can still
 * edit any pick for the week up until the first kickoff, same as always.
 * "Everyone's submitted" just means nobody has an *unmade* pick left to be
 * influenced by seeing this; it isn't a guarantee nobody edits afterward.
 *
 * `details` is the same reveal set broken down to the participant level —
 * game_id -> predicted_winner -> [{ name, points }], most confidence points
 * first — for the "See who picked what" expand under the distribution bar.
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

    if (!games || games.length === 0) {
      return NextResponse.json({ success: true, counts: {}, details: {} });
    }

    const startedGameIds = games
      .filter(g => normalizeGameStatus(g.status) !== 'scheduled')
      .map(g => g.id);

    // "Everyone's submitted" is the same definition /api/pools/[id] already
    // uses to show the participant/submitted counts elsewhere on this page:
    // active participants vs. distinct participant_ids with a pick recorded
    // anywhere in this pool/week/season_type.
    const allGameIds = games.map(g => g.id);
    const [{ count: activeParticipantCount }, { data: weekPicks, error: weekPicksError }] = await Promise.all([
      supabase.from('participants').select('id', { count: 'exact', head: true }).eq('pool_id', poolId).eq('is_active', true),
      supabase.from('picks').select('participant_id').eq('pool_id', poolId).in('game_id', allGameIds),
    ]);

    if (weekPicksError) {
      debugError('Error checking submission completeness for pick counts:', weekPicksError);
      return NextResponse.json({ success: false, error: 'Failed to load picks' }, { status: 500 });
    }

    const submittedCount = new Set((weekPicks ?? []).map(p => p.participant_id)).size;
    const allSubmitted = (activeParticipantCount ?? 0) > 0 && submittedCount >= (activeParticipantCount ?? 0);

    const revealGameIds = allSubmitted ? allGameIds : startedGameIds;
    if (revealGameIds.length === 0) {
      return NextResponse.json({ success: true, counts: {}, details: {} });
    }

    const [{ data: picks, error: picksError }, { data: participants, error: participantsError }] = await Promise.all([
      supabase
        .from('picks')
        .select('game_id, predicted_winner, confidence_points, participant_id')
        .eq('pool_id', poolId)
        .in('game_id', revealGameIds),
      supabase.from('participants').select('id, name').eq('pool_id', poolId),
    ]);

    if (picksError) {
      debugError('Error loading picks for pick counts:', picksError);
      return NextResponse.json({ success: false, error: 'Failed to load picks' }, { status: 500 });
    }
    if (participantsError) {
      debugError('Error loading participants for pick counts:', participantsError);
      return NextResponse.json({ success: false, error: 'Failed to load participants' }, { status: 500 });
    }

    const participantNames = new Map((participants ?? []).map(p => [p.id, p.name]));

    const counts: Record<string, Record<string, number>> = {};
    const details: Record<string, Record<string, { name: string; points?: number }[]>> = {};
    (picks ?? []).forEach(pick => {
      if (!pick.predicted_winner) return;
      const gameCounts = counts[pick.game_id] ?? (counts[pick.game_id] = {});
      gameCounts[pick.predicted_winner] = (gameCounts[pick.predicted_winner] ?? 0) + 1;

      const name = pick.participant_id ? participantNames.get(pick.participant_id) : undefined;
      if (!name) return;
      const gameDetails = details[pick.game_id] ?? (details[pick.game_id] = {});
      const teamDetails = gameDetails[pick.predicted_winner] ?? (gameDetails[pick.predicted_winner] = []);
      teamDetails.push({ name, points: pick.confidence_points ?? undefined });
    });
    Object.values(details).forEach(gameDetails => {
      Object.values(gameDetails).forEach(list => list.sort((a, b) => (b.points ?? 0) - (a.points ?? 0)));
    });

    return NextResponse.json({ success: true, counts, details });
  } catch (error) {
    debugError('Error in pick-counts API:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
