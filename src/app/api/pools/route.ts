import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim() || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const mode = searchParams.get('mode') || 'active'; // 'active' | 'history'

    const supabase = getSupabaseServiceClient();

    let query = supabase
      .from('pools')
      .select('id, name, season, join_password, is_active')
      .eq('is_active', mode === 'history' ? false : true)
      .order('season', { ascending: false })
      .order('name')
      .limit(limit);

    if (q) {
      query = query.ilike('name', `%${q}%`);
    }

    const { data: pools, error } = await query;

    if (error) {
      console.error('[SH][API][POOL] Error fetching pools:', error);
      return NextResponse.json({ pools: [] });
    }

    const poolsWithCounts = await Promise.all(
      (pools || []).map(async (pool) => {
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
          is_closed: !pool.is_active,
        };
      })
    );

    return NextResponse.json({ pools: poolsWithCounts });
  } catch (error) {
    console.error('[SH][API][POOL] Error:', error);
    return NextResponse.json({ pools: [] });
  }
}
