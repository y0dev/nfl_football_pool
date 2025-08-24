import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const poolId = searchParams.get('poolId');
    const season = searchParams.get('season');

    if (!poolId || !season) {
      return NextResponse.json(
        { error: 'Pool ID and season are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();
    
    const { data: seasonWinner, error } = await supabase
      .from('season_winners')
      .select(`
        *,
        pools!inner(name)
      `)
      .eq('pool_id', poolId)
      .eq('season', parseInt(season))
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('Error fetching season winner:', error);
      return NextResponse.json(
        { error: 'Failed to fetch season winner' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      seasonWinner: seasonWinner || null
    });

  } catch (error) {
    console.error('Error in season winner API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
