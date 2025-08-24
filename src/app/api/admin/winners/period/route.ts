import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { getOrCalculatePeriodWinners } from '@/lib/winner-calculator';

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

    // Define the periods for the season
    const periods = [
      { name: 'Q1', startWeek: 1, endWeek: 4 },
      { name: 'Q2', startWeek: 5, endWeek: 8 },
      { name: 'Q3', startWeek: 9, endWeek: 12 },
      { name: 'Q4', startWeek: 13, endWeek: 16 },
      { name: 'Playoffs', startWeek: 17, endWeek: 20 }
    ];

    const periodWinners = [];

    // Get or calculate winners for each period
    for (const period of periods) {
      const periodWinner = await getOrCalculatePeriodWinners(
        poolId, 
        parseInt(season), 
        period.name, 
        period.startWeek, 
        period.endWeek
      );
      
      if (periodWinner) {
        periodWinners.push(periodWinner);
      }
    }

    return NextResponse.json({
      success: true,
      periodWinners
    });

  } catch (error) {
    console.error('Error in period winners API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
