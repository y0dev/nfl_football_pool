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
    
    const { data: periodWinners, error } = await supabase
      .from('period_winners')
      .select(`
        *,
        pools!inner(name)
      `)
      .eq('pool_id', poolId)
      .eq('season', parseInt(season))
      .order('start_week', { ascending: true });

    if (error) {
      console.error('Error fetching period winners:', error);
      return NextResponse.json(
        { error: 'Failed to fetch period winners' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      periodWinners: periodWinners || []
    });

  } catch (error) {
    console.error('Error in period winners API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
