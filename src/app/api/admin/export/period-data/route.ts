import { NextRequest, NextResponse } from 'next/server';
import { exportPeriodData } from '@/lib/export-utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { poolId, periodName, season } = body;

    if (!poolId || !periodName) {
      return NextResponse.json(
        { success: false, error: 'Pool ID and period name are required' },
        { status: 400 }
      );
    }

    // Export the period data
    const csvContent = await exportPeriodData(
      poolId, 
      periodName, 
      season || new Date().getFullYear()
    );

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="pool-${poolId}-${periodName.replace(/\s+/g, '-').toLowerCase()}-season-${season || new Date().getFullYear()}-period-data.csv"`
      }
    });

  } catch (error) {
    console.error('Error exporting period data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to export period data' 
      },
      { status: 500 }
    );
  }
}
