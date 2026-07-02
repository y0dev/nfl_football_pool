import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { debugError } from '@/lib/utils';

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
        liveGames: games?.filter(g => g.status === 'live').length || 0,
        completedGames: games?.filter(g => g.status === 'final').length || 0,
        scheduledGames: games?.filter(g => g.status === 'scheduled').length || 0,
      },
    });
  } catch (error) {
    debugError('[SH][API][DB] Games stats error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load game stats' }, { status: 500 });
  }
}
