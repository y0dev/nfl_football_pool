import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { getOrCalculateSeasonWinners } from '@/lib/winner-calculator';

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

    // Get or calculate season winner
    const seasonWinner = await getOrCalculateSeasonWinners(poolId, parseInt(season));
    
    if (seasonWinner) {
      return NextResponse.json({
        success: true,
        seasonWinner
      });
    } else {
      return NextResponse.json({
        success: true,
        seasonWinner: null
      });
    }

  } catch (error) {
    console.error('Error in season winners API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
