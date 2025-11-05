import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const season = searchParams.get('season');

    if (!season) {
      return NextResponse.json(
        { error: 'Season is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();
    const seasonNum = parseInt(season);

    // Get team records with team information
    const { data: records, error } = await supabase
      .from('team_records')
      .select(`
        *,
        teams!inner(
          id,
          name,
          abbreviation,
          city
        )
      `)
      .eq('season', seasonNum)
      .order('wins', { ascending: false })
      .order('points_for', { ascending: false });

    if (error) {
      console.error('Error fetching team records:', error);
      return NextResponse.json(
        { error: 'Failed to fetch team records' },
        { status: 500 }
      );
    }

    // Format the records for matching with games
    // Match by team abbreviation (games store team abbreviations in home_team_id/away_team_id)
    const formattedRecords = records?.map((record: any) => ({
      team_id: record.team_id,
      team_abbreviation: record.teams?.abbreviation?.toLowerCase(),
      team_name: record.teams?.name?.toLowerCase(),
      wins: record.wins,
      losses: record.losses,
      ties: record.ties,
      home_wins: record.home_wins,
      home_losses: record.home_losses,
      home_ties: record.home_ties,
      road_wins: record.road_wins,
      road_losses: record.road_losses,
      road_ties: record.road_ties
    })) || [];

    return NextResponse.json({
      success: true,
      records: formattedRecords
    });

  } catch (error) {
    console.error('Error in team records API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
