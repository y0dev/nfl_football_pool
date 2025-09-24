import { NextRequest, NextResponse } from 'next/server';
import { exportWeeklyPicks } from '@/lib/export-utils';
import { getSupabaseServiceClient } from '@/lib/supabase';

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
        'Content-Disposition': `attachment; filename="${formattedPoolName}-week-${week}-season-${season || new Date().getFullYear()}-picks.csv"`
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
