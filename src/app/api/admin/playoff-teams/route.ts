import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';

// GET - Get all playoff teams for a season
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const season = searchParams.get('season');

    if (!season) {
      return NextResponse.json(
        { success: false, error: 'Season is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    const { data: teams, error } = await supabase
      .from('playoff_teams')
      .select('*')
      .eq('season', parseInt(season))
      .order('conference', { ascending: true })
      .order('seed', { ascending: true });

    if (error) {
      console.error('Error fetching playoff teams:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch playoff teams' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      teams: teams || []
    });

  } catch (error) {
    console.error('Error in playoff teams GET API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create or update playoff teams
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { season, teams } = body;

    if (!season || !teams || !Array.isArray(teams)) {
      return NextResponse.json(
        { success: false, error: 'Season and teams array are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // Validate teams
    for (const team of teams) {
      if (!team.team_name || !team.conference || !team.seed) {
        return NextResponse.json(
          { success: false, error: 'Each team must have team_name, conference, and seed' },
          { status: 400 }
        );
      }
      if (!['AFC', 'NFC'].includes(team.conference.toUpperCase())) {
        return NextResponse.json(
          { success: false, error: 'Conference must be AFC or NFC' },
          { status: 400 }
        );
      }
      if (team.seed < 1 || team.seed > 7) {
        return NextResponse.json(
          { success: false, error: 'Seed must be between 1 and 7' },
          { status: 400 }
        );
      }
    }

    // Get existing teams
    const { data: existingTeams } = await supabase
      .from('playoff_teams')
      .select('id, conference, seed')
      .eq('season', season);

    const existingMap = new Map();
    (existingTeams || []).forEach(team => {
      const key = `${team.conference}_${team.seed}`;
      existingMap.set(key, team.id);
    });

    const toInsert = [];
    const toUpdate = [];

    for (const team of teams) {
      const key = `${team.conference.toUpperCase()}_${team.seed}`;
      const teamData = {
        season: parseInt(season),
        team_name: team.team_name,
        team_abbreviation: team.team_abbreviation || null,
        conference: team.conference.toUpperCase(),
        seed: parseInt(team.seed)
      };

      if (existingMap.has(key)) {
        toUpdate.push({ id: existingMap.get(key), ...teamData });
      } else {
        toInsert.push(teamData);
      }
    }

    // Perform updates
    for (const team of toUpdate) {
      const { id, ...updateData } = team;
      const { error } = await supabase
        .from('playoff_teams')
        .update(updateData)
        .eq('id', id);
      
      if (error) {
        console.error('Error updating team:', error);
        return NextResponse.json(
          { success: false, error: `Failed to update team: ${team.team_name}` },
          { status: 500 }
        );
      }
    }

    // Perform inserts
    if (toInsert.length > 0) {
      const { error } = await supabase
        .from('playoff_teams')
        .insert(toInsert);

      if (error) {
        console.error('Error inserting teams:', error);
        return NextResponse.json(
          { success: false, error: 'Failed to insert teams' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully ${toUpdate.length > 0 ? `updated ${toUpdate.length} team(s) and ` : ''}inserted ${toInsert.length} team(s)`
    });

  } catch (error) {
    console.error('Error in playoff teams POST API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete playoff team
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Team ID is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    const { error } = await supabase
      .from('playoff_teams')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting playoff team:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to delete playoff team' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Playoff team deleted successfully'
    });

  } catch (error) {
    console.error('Error in playoff teams DELETE API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

