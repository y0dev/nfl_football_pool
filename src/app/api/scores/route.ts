import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const poolId = searchParams.get('poolId');
    const participantId = searchParams.get('participantId');
    const week = searchParams.get('week');
    const seasonType = searchParams.get('seasonType');
    const season = searchParams.get('season');

    if (!poolId) {
      return NextResponse.json(
        { success: false, error: 'Pool ID is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // Build query
    let query = supabase
      .from('scores')
      .select('*')
      .eq('pool_id', poolId);

    if (participantId) {
      query = query.eq('participant_id', participantId);
    }

    if (week) {
      query = query.eq('week', parseInt(week));
    }

    // Note: scores table doesn't have season_type column
    // Scores are stored by week and season (year) only
    // For playoffs, weeks 1-4 represent playoff rounds

    if (season) {
      query = query.eq('season', parseInt(season));
    }

    // Order by week, then by points descending
    query = query.order('week', { ascending: true })
                 .order('points', { ascending: false });

    const { data: scores, error } = await query;

    if (error) {
      console.error('Error fetching scores:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      return NextResponse.json(
        { success: false, error: `Failed to fetch scores: ${error.message || 'Unknown error'}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      scores: scores || [],
      meta: {
        poolId,
        participantId,
        week: week ? parseInt(week) : null,
        season: season ? parseInt(season) : null,
        total: scores?.length || 0
      }
    });

  } catch (error) {
    console.error('Error in scores GET API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
