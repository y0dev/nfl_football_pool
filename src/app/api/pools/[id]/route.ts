import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { DUMMY_POOL, isDummyData } from '@/lib/utils';

// GET - Get public pool details with stats (no authentication required)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (isDummyData()) {
    return NextResponse.json({
      success: true,
      pool: DUMMY_POOL
    });
  }
  
  try {
    const { id: poolId } = await params;
    const { searchParams } = new URL(request.url);
    const week = searchParams.get('week');
    const seasonType = searchParams.get('seasonType');
    
    const supabase = getSupabaseServiceClient();

    // Get pool details
    const { data: pool, error: poolError } = await supabase
      .from('pools')
      .select('id, name, season, is_active, created_by, created_at, tie_breaker_method, tie_breaker_question, tie_breaker_answer')
      .eq('id', poolId)
      .eq('is_active', true)
      .single();

    if (poolError) {
      console.error('Error fetching pool:', poolError);
      return NextResponse.json(
        { success: false, error: 'Pool not found' },
        { status: 404 }
      );
    }

    // Get participant count
    const { data: participants, error: participantsError } = await supabase
      .from('participants')
      .select('id')
      .eq('pool_id', poolId)
      .eq('is_active', true);

    if (participantsError) {
      console.error('Error fetching participants:', participantsError);
    }

    // Get picks status if week and season type are provided
    let picksData = null;
    let submittedCount = 0;
    
    if (week && seasonType) {
      try {
        const { data: picks, error: picksError } = await supabase
          .from('picks')
          .select('participant_id, games!inner(week, season_type)')
          .eq('pool_id', poolId)
          .eq('games.week', parseInt(week))
          .eq('games.season_type', parseInt(seasonType));

        if (!picksError && picks) {
          const submittedIds = new Set(picks.map(p => p.participant_id));
          submittedCount = submittedIds.size;
          picksData = {
            hasPicks: picks.length > 0,
            submittedCount: submittedCount
          };
        }
      } catch (error) {
        console.error('Error fetching picks:', error);
      }
    }

    // Only return public pool information (exclude sensitive fields)
    const publicPool = {
      id: pool.id,
      name: pool.name,
      season: pool.season,
      is_active: pool.is_active,
      created_at: pool.created_at,
      tie_breaker_method: pool.tie_breaker_method,
      tie_breaker_question: pool.tie_breaker_question,
      tie_breaker_answer: pool.tie_breaker_answer,
      participant_count: participants?.length || 0,
      is_test_mode: !participants || participants.length === 0,
      picks_status: picksData
    };

    return NextResponse.json({
      success: true,
      pool: publicPool
    });

  } catch (error) {
    console.error('Error in pool GET API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
