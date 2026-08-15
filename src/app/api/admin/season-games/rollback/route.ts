import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { requireSuperAdmin } from '@/lib/accounts';

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const { season, seasonType = 2, week } = await request.json();

    if (!season) {
      return NextResponse.json({ success: false, error: 'season is required' }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();

    let gamesQuery = supabase.from('games')
      .select('id')
      .eq('season', Number(season))
      .eq('season_type', Number(seasonType));
    if (week !== undefined && week !== null) {
      gamesQuery = gamesQuery.eq('week', Number(week));
    }
    const { data: targetGames, error: lookupError } = await gamesQuery;
    if (lookupError) throw new Error(lookupError.message);

    const gameIds = (targetGames ?? []).map(g => g.id);
    if (gameIds.length === 0) {
      return NextResponse.json({ success: true, gamesDeleted: 0 });
    }

    // picks.game_id -> games.id is ON DELETE CASCADE — deleting a game with
    // real participant picks would silently destroy that pool history.
    // Rollback is meant for undoing a botched import before anyone has
    // picked, not for touching a season that's actually being played.
    const { count: pickCount, error: pickCheckError } = await supabase
      .from('picks')
      .select('id', { count: 'exact', head: true })
      .in('game_id', gameIds);
    if (pickCheckError) throw new Error(pickCheckError.message);

    if (pickCount && pickCount > 0) {
      return NextResponse.json({
        success: false,
        error: `Refusing to roll back: ${pickCount} pick(s) already exist for these games. Deleting them would destroy real participant history.`,
      }, { status: 409 });
    }

    const { error, count } = await supabase.from('games').delete().in('id', gameIds);
    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, gamesDeleted: count ?? gameIds.length });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Rollback failed',
    }, { status: 500 });
  }
}
