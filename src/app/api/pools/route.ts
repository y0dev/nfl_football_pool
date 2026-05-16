import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim() || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const mode = searchParams.get('mode') || 'active'; // 'active' | 'history'
    const isHistoryMode = mode === 'history';

    const supabase = getSupabaseServiceClient();

    // Try with join_password first; fall back if the column doesn't exist
    let selectCols = 'id, name, season, join_password, is_active';
    let query = supabase
      .from('pools')
      .select(selectCols)
      .order('season', { ascending: false })
      .order('name')
      .limit(limit);

    // Handle is_active = NULL (legacy rows) by treating them as active
    if (isHistoryMode) {
      query = query.eq('is_active', false);
    } else {
      query = (query as any).or('is_active.eq.true,is_active.is.null');
    }

    if (q) {
      query = query.ilike('name', `%${q}%`);
    }

    let { data: pools, error } = await query;

    // If join_password column doesn't exist, retry without it
    if (error) {
      console.error('[SH][API][POOL] Query error:', error.message || error);

      selectCols = 'id, name, season, is_active';
      let retryQuery = supabase
        .from('pools')
        .select(selectCols)
        .order('season', { ascending: false })
        .order('name')
        .limit(limit);

      if (isHistoryMode) {
        retryQuery = retryQuery.eq('is_active', false);
      } else {
        retryQuery = (retryQuery as any).or('is_active.eq.true,is_active.is.null');
      }

      if (q) {
        retryQuery = retryQuery.ilike('name', `%${q}%`);
      }

      const retryResult = await retryQuery;
      if (retryResult.error) {
        console.error('[SH][API][POOL] Retry error:', retryResult.error.message);
        return NextResponse.json({ pools: [] }, { status: 500 });
      }
      pools = retryResult.data;
    }

    const poolsWithCounts = await Promise.all(
      (pools || []).map(async (pool: any) => {
        const { count } = await supabase
          .from('participants')
          .select('id', { count: 'exact', head: true })
          .eq('pool_id', pool.id)
          .eq('is_active', true);

        return {
          id: pool.id,
          name: pool.name,
          season: pool.season,
          participant_count: count || 0,
          requires_password: Boolean(pool.join_password),
          is_closed: pool.is_active === false,
        };
      })
    );

    return NextResponse.json({ pools: poolsWithCounts });
  } catch (error) {
    console.error('[SH][API][POOL] Error:', error);
    return NextResponse.json({ pools: [] }, { status: 500 });
  }
}
