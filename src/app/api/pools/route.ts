import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { debugError } from '@/lib/utils';

// Supabase can't statically type a dynamic (non-literal) column-list string
// passed to .select() — selectCols below is reassigned between the primary
// and fallback queries, so its result rows fall back to an untyped error
// shape. This describes the actual columns both queries can return
// (join_password/is_private only present in the primary query's shape).
interface PoolSearchRow {
  id: string;
  name: string;
  season: number;
  is_active: boolean | null;
  join_password?: string | null;
  is_private?: boolean | null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim() || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const mode = searchParams.get('mode') || 'active'; // 'active' | 'history'
    const isHistoryMode = mode === 'history';

    const supabase = getSupabaseServiceClient();

    // Try with join_password + is_private first; fall back if columns don't exist
    let selectCols = 'id, name, season, join_password, is_active, is_private';
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
      query = query.or('is_active.eq.true,is_active.is.null');
    }

    // Exclude private pools from public search (NULL = not private = public)
    query = query.or('is_private.eq.false,is_private.is.null');

    if (q) {
      query = query.ilike('name', `%${q}%`);
    }

    const { data: pools, error } = await query;
    let poolsResult = pools;

    // If join_password/is_private columns don't exist, retry without them
    if (error) {
      debugError('Query error:', error.message || error);

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
        retryQuery = retryQuery.or('is_active.eq.true,is_active.is.null');
      }

      if (q) {
        retryQuery = retryQuery.ilike('name', `%${q}%`);
      }

      const retryResult = await retryQuery;
      if (retryResult.error) {
        debugError('Retry error:', retryResult.error.message);
        return NextResponse.json({ pools: [] }, { status: 500 });
      }
      poolsResult = retryResult.data;
    }

    const poolsWithCounts = await Promise.all(
      ((poolsResult ?? []) as unknown as PoolSearchRow[]).map(async (pool) => {
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
    debugError('Error:', error);
    return NextResponse.json({ pools: [] }, { status: 500 });
  }
}
