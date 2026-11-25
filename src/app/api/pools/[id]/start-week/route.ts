import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { debugError } from '@/lib/utils';
import { poolStartWeek, scheduledWeeks } from '@/lib/pool-start';

// The first week a pool takes part in (src/lib/pool-start.ts). Week pickers
// and prev/next navigation use it so a pool created midseason doesn't offer
// the weeks before it existed. `start` is null when the pool's season has no
// games loaded yet, so callers show every week rather than none.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: poolId } = await params;
    const supabase = getSupabaseServiceClient();

    const { data: pool, error } = await supabase
      .from('pools')
      .select('season, season_scope, created_at')
      .eq('id', poolId)
      .single();
    if (error || !pool) {
      return NextResponse.json({ success: false, error: 'Pool not found' }, { status: 404 });
    }

    const scope: number[] = Array.isArray(pool.season_scope) && pool.season_scope.length > 0 ? pool.season_scope : [2];
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('season_type, week, kickoff_time')
      .eq('season', pool.season)
      .in('season_type', scope);
    if (gamesError) {
      return NextResponse.json({ success: false, error: 'Failed to load the schedule' }, { status: 500 });
    }

    const weeks = scheduledWeeks(games ?? []);
    // Every week began before the pool existed: start at the last one so the
    // pool still has something to show.
    const start = weeks.length === 0 || !pool.created_at
      ? null
      : poolStartWeek(pool.created_at, weeks) ?? { seasonType: weeks[weeks.length - 1].seasonType, week: weeks[weeks.length - 1].week };

    return NextResponse.json({ success: true, start });
  } catch (error) {
    debugError('Error in pool start-week GET:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
