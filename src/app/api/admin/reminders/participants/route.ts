import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const week = parseInt(searchParams.get('week') || '1');
    const seasonType = parseInt(searchParams.get('seasonType') || '2');
    const poolId = searchParams.get('poolId') || 'all';
    const adminEmail = searchParams.get('adminEmail') || '';
    const isSuperAdmin = searchParams.get('isSuperAdmin') === 'true';

    const supabase = getSupabaseServiceClient();

    // Determine which pools to query
    let poolIds: string[] = [];
    if (poolId !== 'all') {
      poolIds = [poolId];
    } else if (!isSuperAdmin && adminEmail) {
      const { data: pools } = await supabase
        .from('pools')
        .select('id')
        .eq('created_by', adminEmail)
        .eq('is_active', true);
      poolIds = pools?.map(p => p.id) || [];
    }

    // Fetch participants
    let participantsQuery = supabase
      .from('participants')
      .select('id, name, email, pool_id, is_active, created_at')
      .eq('is_active', true);

    if (poolIds.length > 0) {
      participantsQuery = participantsQuery.in('pool_id', poolIds);
    }

    const { data: participantsData, error: participantsError } = await participantsQuery;
    if (participantsError) throw participantsError;
    if (!participantsData || participantsData.length === 0) {
      return NextResponse.json({ success: true, participants: [] });
    }

    // Fetch games for the week
    const { data: games } = await supabase
      .from('games')
      .select('id')
      .eq('week', week)
      .eq('season_type', seasonType);

    const gameIds = games?.map(g => g.id) || [];

    // Fetch all picks for this week across all relevant participants
    let picksMap = new Map<string, number>();
    if (gameIds.length > 0) {
      const { data: picks } = await supabase
        .from('picks')
        .select('participant_id, game_id')
        .in('participant_id', participantsData.map(p => p.id))
        .in('game_id', gameIds);

      picks?.forEach(pick => {
        picksMap.set(pick.participant_id, (picksMap.get(pick.participant_id) || 0) + 1);
      });
    }

    // Fetch pool names
    const uniquePoolIds = [...new Set(participantsData.map(p => p.pool_id))];
    const { data: poolsData } = await supabase
      .from('pools')
      .select('id, name')
      .in('id', uniquePoolIds);

    const poolNameMap = new Map(poolsData?.map(p => [p.id, p.name]) || []);

    // Build result
    const participants = participantsData.map(p => ({
      id: p.id,
      name: p.name,
      email: p.email,
      pool_id: p.pool_id,
      pool_name: poolNameMap.get(p.pool_id) || 'Unknown Pool',
      is_active: p.is_active,
      created_at: p.created_at,
      has_submitted: gameIds.length > 0 && (picksMap.get(p.id) || 0) >= gameIds.length,
      last_reminder_sent: null,
    }));

    return NextResponse.json({ success: true, participants });
  } catch (error) {
    console.error('[SH][API][DB] Reminders participants error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load participants' }, { status: 500 });
  }
}
