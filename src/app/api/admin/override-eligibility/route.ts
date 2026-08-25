import { NextRequest, NextResponse } from 'next/server';
import { getOverrideEligibility } from '@/lib/season-status';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { requireActiveAdmin } from '@/lib/accounts';
import { debugError } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireActiveAdmin(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const poolId = searchParams.get('poolId');
    const week = Number(searchParams.get('week'));
    const seasonType = Number(searchParams.get('seasonType'));

    if (!poolId || !week || !seasonType) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();
    const { data: pool } = await supabase.from('pools').select('created_by').eq('id', poolId).maybeSingle();
    if (!pool) {
      return NextResponse.json({ success: false, error: 'Pool not found' }, { status: 404 });
    }
    if (!auth.isSuperAdmin && pool.created_by !== auth.email) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const eligibility = await getOverrideEligibility(poolId, week, seasonType);
    return NextResponse.json({ success: true, ...eligibility });
  } catch (error) {
    debugError('Error in override-eligibility API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
