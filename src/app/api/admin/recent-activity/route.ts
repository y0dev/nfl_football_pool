import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { requireActiveAdmin } from '@/lib/accounts';
import { debugError } from '@/lib/utils';

interface Activity {
  type: 'pool_created' | 'participant_joined' | 'picks_submitted';
  description: string;
  timestamp: string;
  pool_name?: string;
  pool_id?: string;
}

// Server-only replacement for the direct client-side "recent activity"
// queries on both the commissioner dashboard (src/app/dashboard/page.tsx)
// and the super-admin dashboard (src/app/admin/dashboard/page.tsx) — those
// two implementations were nearly identical (system-wide for a super admin,
// filtered to the caller's own pools for a commissioner), consolidated here
// with the same branch, but with role resolved server-side instead of
// trusted from the caller.
export async function GET(request: NextRequest) {
  try {
    const auth = await requireActiveAdmin(request);
    if (!auth.ok) return auth.response;
    const adminEmail = auth.email;
    const isSuperAdmin = auth.isSuperAdmin;

    const supabase = getSupabaseServiceClient();
    const activities: Activity[] = [];
    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    let poolsQuery = supabase.from('pools').select('id, name, created_at');
    if (!isSuperAdmin) poolsQuery = poolsQuery.eq('created_by', adminEmail);
    const { data: pools } = await poolsQuery.order('created_at', { ascending: false });

    const poolIds = pools?.map(p => p.id) ?? [];
    const poolNameMap = new Map(pools?.map(p => [p.id, p.name]) ?? []);

    const recentPools = (pools ?? []).filter(p => p.created_at >= last30Days);
    recentPools.slice(0, isSuperAdmin ? 5 : 3).forEach(pool => {
      activities.push({
        type: 'pool_created',
        description: isSuperAdmin ? `Pool "${pool.name}" was created` : `Created new pool "${pool.name}"`,
        timestamp: pool.created_at,
        pool_name: pool.name,
        pool_id: pool.id,
      });
    });

    if (!isSuperAdmin && poolIds.length === 0) {
      return NextResponse.json({ success: true, activities });
    }

    let participantsQuery = supabase
      .from('participants')
      .select('id, name, created_at, pool_id')
      .eq('is_active', true)
      .gte('created_at', last30Days)
      .order('created_at', { ascending: false })
      .limit(isSuperAdmin ? 10 : 5);
    if (!isSuperAdmin) participantsQuery = participantsQuery.in('pool_id', poolIds);
    const { data: participants } = await participantsQuery;

    participants?.forEach(participant => {
      activities.push({
        type: 'participant_joined',
        description: `${participant.name || 'New Participant'} joined "${poolNameMap.get(participant.pool_id) || 'Unknown Pool'}"`,
        timestamp: participant.created_at,
        pool_name: poolNameMap.get(participant.pool_id),
        pool_id: participant.pool_id,
      });
    });

    let picksQuery = supabase
      .from('picks')
      .select('created_at, participant_id, pool_id')
      .gte('created_at', last30Days)
      .order('created_at', { ascending: false })
      .limit(isSuperAdmin ? 20 : 10);
    if (!isSuperAdmin) picksQuery = picksQuery.in('pool_id', poolIds);
    const { data: picks } = await picksQuery;

    if (picks && picks.length > 0) {
      const poolSubmissions = new Map<string, Set<string>>();
      picks.forEach(pick => {
        if (!poolSubmissions.has(pick.pool_id)) poolSubmissions.set(pick.pool_id, new Set());
        poolSubmissions.get(pick.pool_id)?.add(pick.participant_id);
      });
      poolSubmissions.forEach((submitters, poolId) => {
        const count = submitters.size;
        if (count > 0) {
          activities.push({
            type: 'picks_submitted',
            description: `${count} participant${count !== 1 ? 's' : ''} submitted picks for "${poolNameMap.get(poolId) || 'Unknown Pool'}"`,
            timestamp: picks.find(p => p.pool_id === poolId)?.created_at || now.toISOString(),
            pool_name: poolNameMap.get(poolId),
            pool_id: poolId,
          });
        }
      });
    }

    const sorted = activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, isSuperAdmin ? 10 : 5);

    return NextResponse.json({ success: true, activities: sorted });
  } catch (error) {
    debugError('Recent activity error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load recent activity' }, { status: 500 });
  }
}
