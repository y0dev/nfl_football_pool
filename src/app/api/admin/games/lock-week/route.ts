import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';

// Requires this table in Supabase:
// CREATE TABLE locked_weeks (
//   season INT NOT NULL,
//   week INT NOT NULL,
//   season_type INT NOT NULL DEFAULT 2,
//   locked_at TIMESTAMPTZ DEFAULT NOW(),
//   PRIMARY KEY (season, week, season_type)
// );

export async function POST(request: NextRequest) {
  try {
    const { season, week, seasonType = 2, locked } = await request.json();

    if (!season || week === undefined || week === null) {
      return NextResponse.json({ success: false, error: 'season and week are required' }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();

    if (locked) {
      const { error } = await supabase.from('locked_weeks').upsert({
        season: Number(season),
        week: Number(week),
        season_type: Number(seasonType),
        locked_at: new Date().toISOString(),
      }, { onConflict: 'season,week,season_type' });

      if (error) {
        return NextResponse.json({
          success: false,
          error: 'Could not lock week. Ensure the locked_weeks table exists.',
          migration: `CREATE TABLE locked_weeks (
  season INT NOT NULL,
  week INT NOT NULL,
  season_type INT NOT NULL DEFAULT 2,
  locked_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (season, week, season_type)
);`,
        }, { status: 500 });
      }
    } else {
      const { error } = await supabase.from('locked_weeks')
        .delete()
        .eq('season', Number(season))
        .eq('week', Number(week))
        .eq('season_type', Number(seasonType));

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, locked, week: Number(week), season: Number(season) });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Lock operation failed',
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const season = parseInt(searchParams.get('season') || String(new Date().getFullYear()));
    const seasonType = parseInt(searchParams.get('seasonType') || '2');

    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from('locked_weeks')
      .select('week')
      .eq('season', season)
      .eq('season_type', seasonType);

    if (error) {
      return NextResponse.json({ success: true, lockedWeeks: [] });
    }

    return NextResponse.json({ success: true, lockedWeeks: data?.map(r => r.week) ?? [] });
  } catch {
    return NextResponse.json({ success: true, lockedWeeks: [] });
  }
}
