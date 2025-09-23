import { NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';

export async function GET() {
  try {
    const supabase = getSupabaseServiceClient();
    
    // Get all pools
    const { data: allPools, error: allPoolsError } = await supabase
      .from('pools')
      .select('id, name, season, is_active, created_at')
      .order('created_at', { ascending: false });
    
    // Get active pools
    const { data: activePools, error: activePoolsError } = await supabase
      .from('pools')
      .select('id, name, season, is_active, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    return NextResponse.json({
      success: true,
      data: {
        allPools: allPools || [],
        activePools: activePools || [],
        allPoolsCount: allPools?.length || 0,
        activePoolsCount: activePools?.length || 0,
        allPoolsError,
        activePoolsError
      }
    });
  } catch (error) {
    console.error('Error in test-pools API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
