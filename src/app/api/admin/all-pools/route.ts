import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { debugError } from '@/lib/utils';
import { getAdminPlansByEmails, isPreseasonOnlyScope, PRESEASON_LIMITS } from '@/lib/plan';

export async function GET(request: NextRequest) {
  try {
    const adminEmail = request.headers.get('x-admin-email');
    if (!adminEmail) {
      return NextResponse.json({ success: false, error: 'No admin email header' }, { status: 401 });
    }

    const supabase = getSupabaseServiceClient();

    const { data: caller } = await supabase
      .from('admins')
      .select('is_super_admin')
      .eq('email', adminEmail)
      .eq('is_active', true)
      .single();

    if (!caller?.is_super_admin) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const { data: pools, error } = await supabase
      .from('pools')
      .select('id, name, is_active, season, season_scope, created_by, created_at, competition_type, huddle_id, huddles(name), participants(count)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const poolList = pools || [];

    // Clone eligibility (Standard plan + room for another active pool in
    // that pool's Huddle) — computed here from the already-fetched pool
    // list rather than one checkPoolCapacity() query per pool, since every
    // pool in every Huddle is already in memory.
    const owners = [...new Set(poolList.map(p => p.created_by).filter(Boolean))];
    const plansByEmail = await getAdminPlansByEmails(owners);

    const activeCountByGroup = new Map<string, { preseason: number; regular: number }>();
    for (const p of poolList) {
      if (!p.is_active) continue;
      const groupKey = p.huddle_id ?? `no-huddle:${p.created_by}`;
      const bucket = activeCountByGroup.get(groupKey) ?? { preseason: 0, regular: 0 };
      if (isPreseasonOnlyScope(p.season_scope)) bucket.preseason++;
      else bucket.regular++;
      activeCountByGroup.set(groupKey, bucket);
    }

    const poolsWithCloneInfo = poolList.map(p => {
      const planInfo = plansByEmail.get(p.created_by);
      const isPreseason = isPreseasonOnlyScope(p.season_scope);
      const groupKey = p.huddle_id ?? `no-huddle:${p.created_by}`;
      const counts = activeCountByGroup.get(groupKey) ?? { preseason: 0, regular: 0 };
      const count = isPreseason ? counts.preseason : counts.regular;
      const limit = isPreseason ? PRESEASON_LIMITS.pools : (planInfo?.poolLimit ?? 0);
      const planEligible = planInfo?.plan === 'standard';
      const capacityEligible = count < limit;
      return {
        ...p,
        cloneEligible: planEligible && capacityEligible,
        cloneIneligibleReason: !planEligible
          ? 'Owner is on the Free plan — cloning requires Standard.'
          : !capacityEligible
            ? `Owner's Huddle is at its active pool limit (${count}/${limit}).`
            : undefined,
      };
    });

    return NextResponse.json({ success: true, pools: poolsWithCloneInfo });
  } catch (error) {
    debugError('All pools error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load pools' }, { status: 500 });
  }
}
