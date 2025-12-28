import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { debugLog, DUMMY_PLAYOFF_GAMES, isDummyData } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const week = searchParams.get('week');
    const seasonType = searchParams.get('seasonType');
    

    debugLog('Games API called with:', { week, seasonType });

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

    debugLog('Parsed parameters:', { weekNumber, seasonTypeNumber });

    // Return dummy playoff games if in dummy data mode and season type is postseason (3)
    if (isDummyData() && seasonTypeNumber === 3) {
      const filteredGames = DUMMY_PLAYOFF_GAMES.filter(game => game.week === weekNumber);
      return NextResponse.json({
        success: true,
        games: filteredGames
      });
    }

    const supabase = getSupabaseServiceClient();
    debugLog('Supabase client created successfully');

    const season = searchParams.get('season');
    const seasonNumber = season ? parseInt(season) : undefined;

    const query = supabase
      .from('games')
      .select('*')
      .eq('week', weekNumber);
    
    if (seasonTypeNumber !== undefined && !isNaN(seasonTypeNumber)) {
      query.eq('season_type', seasonTypeNumber);
    }
    
    if (seasonNumber !== undefined && !isNaN(seasonNumber)) {
      query.eq('season', seasonNumber);
    }

    // Only filter by season_type if the column exists and value is provided
    // For now, we'll skip this filter to avoid the 500 error
    // TODO: Add season_type column to games table if needed
    /*
    if (seasonTypeNumber !== undefined && !isNaN(seasonTypeNumber)) {
      query = query.eq('season_type', seasonTypeNumber);
    }
    */

    debugLog('Executing query for week:', weekNumber);
    const { data: games, error } = await query.order('kickoff_time');

    if (error) {
      console.error('Error loading week games:', error);
      return NextResponse.json(
        { error: 'Failed to load games', details: error.message },
        { status: 500 }
      );
    }

    debugLog('Games loaded successfully:', games?.length || 0);
    return NextResponse.json({
      success: true,
      games: games || []
    });

  } catch (error) {
    console.error('Error in games week API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
