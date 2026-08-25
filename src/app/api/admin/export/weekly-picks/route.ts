import { NextRequest, NextResponse } from 'next/server';
import { exportWeeklyPicks } from '@/lib/export-utils';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { requireActiveAdmin } from '@/lib/accounts';
import { debugError } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireActiveAdmin(request);
    if (!auth.ok) return auth.response;

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
      .select('name, created_by')
      .eq('id', poolId)
      .single();

    if (poolError || !pool) {
      return NextResponse.json({ success: false, error: 'Pool not found' }, { status: 404 });
    }
    if (!auth.isSuperAdmin && pool.created_by !== auth.email) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const poolName = pool.name || `pool-${poolId}`;
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
    debugError('Error exporting weekly picks:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to export weekly picks' 
      },
      { status: 500 }
    );
  }
}
