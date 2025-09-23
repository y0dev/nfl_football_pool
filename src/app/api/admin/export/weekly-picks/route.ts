import { NextRequest, NextResponse } from 'next/server';
import { exportWeeklyPicks } from '@/lib/export-utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { poolId, week, season, seasonType } = body;

    if (!poolId || !week) {
      return NextResponse.json(
        { success: false, error: 'Pool ID and week are required' },
        { status: 400 }
      );
    }

    // Export the weekly picks data
    const csvContent = await exportWeeklyPicks(
      poolId, 
      week, 
      season || new Date().getFullYear(),
      seasonType || 2
    );

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="pool-${poolId}-week-${week}-season-${season || new Date().getFullYear()}-picks.csv"`
      }
    });

  } catch (error) {
    console.error('Error exporting weekly picks:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to export weekly picks' 
      },
      { status: 500 }
    );
  }
}
