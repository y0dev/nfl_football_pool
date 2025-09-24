import { NextRequest, NextResponse } from 'next/server';
import { exportPeriodData } from '@/lib/export-utils';
import { getSupabaseServiceClient } from '@/lib/supabase';

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

    // Get pool name for filename
    const supabase = getSupabaseServiceClient();
    const { data: pool, error: poolError } = await supabase
      .from('pools')
      .select('name')
      .eq('id', poolId)
      .single();

    if (poolError) {
      console.error('Error fetching pool name:', poolError);
      // Fallback to pool ID if name fetch fails
    }

    const poolName = pool?.name || `pool-${poolId}`;
    const formattedPoolName = poolName.toLowerCase().replace(/\s+/g, '-');
    const formattedPeriodName = periodName.toLowerCase().replace(/\s+/g, '-');

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
        'Content-Disposition': `attachment; filename="${formattedPoolName}-${formattedPeriodName}-season-${season || new Date().getFullYear()}-period-data.csv"`
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
