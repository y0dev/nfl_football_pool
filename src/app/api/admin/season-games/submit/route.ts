import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { games } = await request.json();

    if (!Array.isArray(games) || games.length === 0) {
      return NextResponse.json({ success: false, error: 'No games provided' }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();
    const batchId = crypto.randomUUID();
    const now = new Date().toISOString();

    const payloads = games.map((game: {
      id: string; week: number; season: number; season_type: number;
      home_team: string; away_team: string; time?: string; date?: string;
      home_team_id?: string; away_team_id?: string;
    }) => ({
      id: game.id,
      week: game.week,
      season: game.season,
      season_type: game.season_type,
      home_team: game.home_team,
      away_team: game.away_team,
      kickoff_time: game.time || game.date,
      status: 'scheduled',
      home_team_id: game.home_team_id ?? null,
      away_team_id: game.away_team_id ?? null,
      is_active: true,
      updated_at: now,
    }));

    const BATCH = 50;
    let imported = 0;

    for (let i = 0; i < payloads.length; i += BATCH) {
      const slice = payloads.slice(i, i + BATCH);
      const { error } = await supabase.from('games').upsert(slice, { onConflict: 'id', ignoreDuplicates: false });
      if (error) throw new Error(error.message);
      imported += slice.length;
    }

    return NextResponse.json({ success: true, gamesImported: imported, batchId });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Submit failed',
    }, { status: 500 });
  }
}
