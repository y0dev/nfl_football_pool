import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { debugError } from '@/lib/utils';
import { normalizeGameStatus } from '@/types/game';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const season = parseInt(searchParams.get('season') || String(new Date().getFullYear()));

    const supabase = getSupabaseServiceClient();
    const { data: games, error } = await supabase
      .from('games')
      .select('status')
      .eq('season', season);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      stats: {
        totalGames: games?.length || 0,
        liveGames: games?.filter(g => normalizeGameStatus(g.status) === 'live').length || 0,
        completedGames: games?.filter(g => normalizeGameStatus(g.status) === 'finished').length || 0,
        scheduledGames: games?.filter(g => normalizeGameStatus(g.status) === 'scheduled').length || 0,
      },
    });
  } catch (error) {
    debugError('Games stats error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load game stats' }, { status: 500 });
  }
}
