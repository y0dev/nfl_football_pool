import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';

// GET - Get playoff teams for a pool and season
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ poolId: string }> }
) {
  try {
    const { poolId } = await params;
    const { searchParams } = new URL(request.url);
    const season = searchParams.get('season');

    if (!season) {
      return NextResponse.json(
        { success: false, error: 'Season is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // Get playoff teams for this season (playoff teams are the same for all pools)
    const { data: teams, error } = await supabase
      .from('playoff_teams')
      .select('*')
      .eq('season', parseInt(season))
      .order('seed', { ascending: true, nullsFirst: false });

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

