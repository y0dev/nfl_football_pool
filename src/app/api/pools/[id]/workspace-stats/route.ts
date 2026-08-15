import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { checkPoolAccessFromRequest } from '@/lib/pool-access';
import { debugError } from '@/lib/utils';

// Server-only replacement for Pool Workspace's direct client-side
// participants/games/picks queries (src/components/pools/pool-workspace.tsx
// loadStats), which required shipping the Supabase service role key to the
// browser.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: poolId } = await params;
    const { searchParams } = new URL(request.url);
    const week = parseInt(searchParams.get('week') ?? '', 10);
    const seasonType = parseInt(searchParams.get('seasonType') ?? '', 10);
    if (isNaN(week) || isNaN(seasonType)) {
      return NextResponse.json({ success: false, error: 'week and seasonType are required' }, { status: 400 });
    }

    const access = await checkPoolAccessFromRequest(poolId, request);
    if (!access.allowed) {
      return NextResponse.json({ success: false, error: 'Pool access required' }, { status: 403 });
    }

    const supabase = getSupabaseServiceClient();
    const [{ data: allParticipants }, { data: weekGames }] = await Promise.all([
      supabase.from('participants').select('id, name').eq('pool_id', poolId).eq('is_active', true),
      supabase.from('games').select('id').eq('week', week).eq('season_type', seasonType),
    ]);

    const total = allParticipants?.length ?? 0;
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

    const completed = submittedIds.size;
    const pending = Math.max(0, total - completed);
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const missingParticipants = (allParticipants ?? []).filter(p => !submittedIds.has(p.id));

    return NextResponse.json({
      success: true,
      weekGamesCount: gameIds.length,
      stats: { participants: total, completed, pending, completionRate },
      missingParticipants,
    });
  } catch (error) {
    debugError('Workspace stats error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load pool workspace stats' }, { status: 500 });
  }
}
