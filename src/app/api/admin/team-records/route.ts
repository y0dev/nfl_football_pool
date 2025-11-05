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
          city,
          conference,
          division
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

    // Format the records for display
    const formattedRecords = records?.map((record: any) => ({
      id: record.id,
      team_id: record.team_id,
      season: record.season,
      wins: record.wins,
      losses: record.losses,
      ties: record.ties,
      points_for: record.points_for,
      points_against: record.points_against,
      win_percentage: record.wins + record.losses + record.ties > 0 
        ? ((record.wins + record.ties * 0.5) / (record.wins + record.losses + record.ties)).toFixed(3)
        : '0.000',
      point_differential: record.points_for - record.points_against,
      team: record.teams
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
