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
      .from('tie_breakers')
      .select('*')
      .eq('pool_id', poolId);

    if (participantId) {
      query = query.eq('participant_id', participantId);
    }

    if (week) {
      query = query.eq('week', parseInt(week));
    }

    if (seasonType) {
      query = query.eq('season_type', parseInt(seasonType));
    }

    if (season) {
      query = query.eq('season', parseInt(season));
    }

    const { data: tieBreakers, error } = await query;

    if (error) {
      console.error('Error fetching tie-breakers:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch tie-breakers' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      tieBreakers: tieBreakers || [],
      meta: {
        poolId,
        participantId,
        week: week ? parseInt(week) : null,
        seasonType: seasonType ? parseInt(seasonType) : null,
        season: season ? parseInt(season) : null,
        total: tieBreakers?.length || 0
      }
    });

  } catch (error) {
    console.error('Error in tie-breakers GET API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
