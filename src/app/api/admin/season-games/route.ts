import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const season = parseInt(searchParams.get('season') || String(new Date().getFullYear()));
    const seasonType = parseInt(searchParams.get('seasonType') || '2');

    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('season', season)
      .eq('season_type', seasonType)
      .order('week', { ascending: true })
      .order('kickoff_time', { ascending: true });

    if (error) throw new Error(error.message);

    const weekMap = new Map<number, typeof data>();
    data?.forEach((game) => {
      if (!weekMap.has(game.week)) weekMap.set(game.week, []);
      weekMap.get(game.week)!.push(game);
    });

    const weeks = Array.from(weekMap.entries())
      .map(([week, games]) => ({ week, games }))
      .sort((a, b) => a.week - b.week);

    return NextResponse.json({ success: true, weeks, totalGames: data?.length ?? 0 });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load games',
    }, { status: 500 });
  }
}
