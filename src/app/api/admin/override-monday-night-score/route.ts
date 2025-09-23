import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { PERIOD_WEEKS, SUPER_BOWL_SEASON_TYPE } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const { 
      poolId, 
      participantId, 
      week, 
      season, 
      seasonType, 
      mondayNightScore 
    }: { 
      poolId: string;
      participantId: string;
      week: number;
      season: number;
      seasonType: number;
      mondayNightScore: number;
    } = await request.json();

    // Validate required fields
    if (!poolId || !participantId || !week || !season || mondayNightScore === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate that this is a period week or Super Bowl
    const isPeriodWeek = PERIOD_WEEKS.includes(week as typeof PERIOD_WEEKS[number]);
    const isSuperBowl = seasonType === SUPER_BOWL_SEASON_TYPE;
    
    if (!isPeriodWeek && !isSuperBowl) {
      return NextResponse.json(
        { success: false, error: 'Monday night scores can only be added for period weeks or Super Bowl' },
        { status: 400 }
      );
    }

    // Validate score is a positive number
    if (mondayNightScore < 0 || !Number.isInteger(mondayNightScore)) {
      return NextResponse.json(
        { success: false, error: 'Monday night score must be a positive integer' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // Check if participant exists and has picks for this week
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .select('id, name')
      .eq('id', participantId)
      .eq('pool_id', poolId)
      .single();

    if (participantError || !participant) {
      return NextResponse.json(
        { success: false, error: 'Participant not found' },
        { status: 404 }
      );
    }

    // Check if participant has picks for this week
    const { data: picks, error: picksError } = await supabase
      .from('picks')
      .select('id')
      .eq('participant_id', participantId)
      .eq('pool_id', poolId)
      .eq('week', week)
      .eq('season', season);

    if (picksError) {
      return NextResponse.json(
        { success: false, error: 'Failed to check existing picks' },
        { status: 500 }
      );
    }

    if (!picks || picks.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No picks found for this participant and week' },
        { status: 404 }
      );
    }

    // Upsert Monday night score to tie_breakers table
    const { error: tieBreakerError } = await supabase
      .from('tie_breakers')
      .upsert({
        participant_id: participantId,
        pool_id: poolId,
        week: week,
        season: season,
        season_type: seasonType,
        answer: mondayNightScore
      }, {
        onConflict: 'participant_id,pool_id,week,season,season_type'
      });

    if (tieBreakerError) {
      console.error('Error saving Monday night score:', tieBreakerError);
      return NextResponse.json(
        { success: false, error: 'Failed to save Monday night score' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Monday night score of ${mondayNightScore} points added for ${participant.name}`
    });

  } catch (error) {
    console.error('Error in override Monday night score:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
