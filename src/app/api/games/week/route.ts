import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const week = searchParams.get('week');
    const seasonType = searchParams.get('seasonType');

    if (!week) {
      return NextResponse.json(
        { error: 'Week parameter is required' },
        { status: 400 }
      );
    }

    const weekNumber = parseInt(week);
    const seasonTypeNumber = seasonType ? parseInt(seasonType) : undefined;

    if (isNaN(weekNumber)) {
      return NextResponse.json(
        { error: 'Invalid week parameter' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    let query = supabase
      .from('games')
      .select('*')
      .eq('week', weekNumber);

    // If season type is specified, filter by it
    if (seasonTypeNumber !== undefined && !isNaN(seasonTypeNumber)) {
      query = query.eq('season_type', seasonTypeNumber);
    }

    const { data: games, error } = await query.order('kickoff_time');

    if (error) {
      console.error('Error loading week games:', error);
      return NextResponse.json(
        { error: 'Failed to load games' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      games: games || []
    });

  } catch (error) {
    console.error('Error in games week API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
