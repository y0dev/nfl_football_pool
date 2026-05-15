import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { season, seasonType = 2, week } = await request.json();

    if (!season) {
      return NextResponse.json({ success: false, error: 'season is required' }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();

    let query = supabase.from('games')
      .delete()
      .eq('season', Number(season))
      .eq('season_type', Number(seasonType));

    if (week !== undefined && week !== null) {
      query = query.eq('week', Number(week));
    }

    const { error, count } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, gamesDeleted: count ?? 0 });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Rollback failed',
    }, { status: 500 });
  }
}
