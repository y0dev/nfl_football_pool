import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { computePickemWeekResult } from '@/lib/pickem';
import { computeSurvivorPoolState } from '@/lib/survivor';
import { debugError } from '@/lib/utils';

// Server-only replacement for Pool Workspace's direct client-side
// participants/games/picks queries (src/components/pools/pool-workspace.tsx
// loadStats), which required shipping the Supabase service role key to the
// browser.
//
// Deliberately no checkPoolAccessFromRequest gate here — that's the
// *participant* password-cookie check for a private pool's public Picks
// page, not something the commissioner/admin dashboard's own PoolWorkspace
// (already behind AdminGuard login) should ever be asked to satisfy. Same
// read-only trust model as its siblings — getActiveParticipantCount,
// getPoolPayoutConfig, loadPool — none of which re-check auth per call
// either; the calling page's own guard is the one gate.
//
// competition_type-aware: "completed this week" means something different
// per type (a row in `picks` for Confidence, `isComplete` across every
// eligible game for Pick'em, a `survivor_picks` row for the current week
// for Survivor) — computed via each type's own authoritative service
// (computePickemWeekResult / computeSurvivorPoolState) rather than
// re-deriving it here, per this codebase's single-source-of-truth rule for
// pick/score logic. Only the participant total is genuinely shared across
// all types, since it comes from the one `participants` table every pool
// type uses.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: poolId } = await params;
    const { searchParams } = new URL(request.url);
    const week = parseInt(searchParams.get('week') ?? '', 10);
    const seasonType = parseInt(searchParams.get('seasonType') ?? '', 10);
    if (isNaN(week) || isNaN(seasonType)) {
      return NextResponse.json({ success: false, error: 'week and seasonType are required' }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();
    const { data: pool, error: poolError } = await supabase
      .from('pools')
      .select('competition_type, season')
      .eq('id', poolId)
      .maybeSingle();
    if (poolError || !pool) {
      return NextResponse.json({ success: false, error: 'Pool not found' }, { status: 404 });
    }

    const { data: allParticipants } = await supabase
      .from('participants')
      .select('id, name')
      .eq('pool_id', poolId)
      .eq('is_active', true);
    const total = allParticipants?.length ?? 0;

    // Scoped to this pool's own season — without it, week/season_type
    // numbers colliding across seasons (week 9 of season_type 2 exists
    // every year) pull in an unrelated season's games, corrupting
    // weekGamesCount, gamesStarted, and (for Confidence pools) which
    // participants show as missing a pick.
    const { data: weekGames } = await supabase
      .from('games')
      .select('id, kickoff_time, status')
      .eq('week', week)
      .eq('season_type', seasonType)
      .eq('season', pool.season);
    const weekGamesCount = weekGames?.length ?? 0;
    // Drives the Overview tab's "Make Picks" override shortcut — once a
    // game has kicked off, a still-missing participant can no longer submit
    // for themselves at all (the whole week locks at first kickoff), so
    // that's exactly when a direct link to the commissioner override tool
    // becomes useful rather than redundant with just waiting.
    const now = new Date();
    const gamesStarted = (weekGames ?? []).some(g => new Date(g.kickoff_time) <= now || g.status !== 'scheduled');

    let completed = 0;
    let missingParticipants: Array<{ id: string; name: string }> = [];

    if (pool.competition_type === 'PICKEM') {
      const result = await computePickemWeekResult(poolId, week, seasonType);
      completed = result.participants.filter(p => p.isComplete).length;
      missingParticipants = result.participants.filter(p => !p.isComplete).map(p => ({ id: p.participantId, name: p.participantName }));
    } else if (pool.competition_type === 'SURVIVOR') {
      const state = await computeSurvivorPoolState(poolId);
      // Only ACTIVE participants can still submit a pick — an eliminated
      // participant isn't "missing" one, they're just out.
      const stillPlaying = state.participants.filter(p => p.status === 'ACTIVE');
      const hasPickThisWeek = (p: (typeof stillPlaying)[number]) => p.picks.some(pick => pick.week === week && pick.seasonType === seasonType);
      completed = stillPlaying.filter(hasPickThisWeek).length;
      missingParticipants = stillPlaying.filter(p => !hasPickThisWeek(p)).map(p => ({ id: p.participantId, name: p.participantName }));
    } else if (pool.competition_type === 'NFL_CONFIDENCE') {
      const gameIds = weekGames?.map(g => g.id) ?? [];
      let submittedIds = new Set<string>();
      if (gameIds.length > 0) {
        const { data: picks } = await supabase
          .from('picks')
          .select('participant_id')
          .eq('pool_id', poolId)
          .in('game_id', gameIds);
        submittedIds = new Set((picks ?? []).map(p => p.participant_id));
      }
      completed = submittedIds.size;
      missingParticipants = (allParticipants ?? []).filter(p => !submittedIds.has(p.id));
    } else {
      // Unsupported/not-yet-built competition type (e.g. NCAA_CONFIDENCE,
      // MARCH_MADNESS) — explicit, not a silent Confidence fallback. The
      // participant total is still accurate; per-week completion just isn't
      // computable yet.
      debugError('Workspace stats: no pick-completion logic for competition_type', pool.competition_type);
    }

    // missingParticipants.length, not total - completed: for Survivor,
    // `total` includes eliminated participants who aren't "missing" a pick
    // at all (they can't submit one), so that arithmetic would overcount.
    const pending = missingParticipants.length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return NextResponse.json({
      success: true,
      weekGamesCount,
      gamesStarted,
      stats: { participants: total, completed, pending, completionRate },
      missingParticipants,
    });
  } catch (error) {
    debugError('Workspace stats error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load pool workspace stats' }, { status: 500 });
  }
}
