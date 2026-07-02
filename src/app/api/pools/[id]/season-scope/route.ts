import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { debugError } from '@/lib/utils';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: poolId } = await params;

    const supabase = getSupabaseServiceClient();

    const { data: pool, error } = await supabase
      .from('pools')
      .select('season_scope')
      .eq('id', poolId)
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Pool not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      season_scope: pool.season_scope ?? []
    });
  } catch (error) {
    debugError('Error in pool season-scope GET:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
