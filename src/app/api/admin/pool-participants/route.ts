import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { requireActiveAdmin } from '@/lib/accounts';
import { debugError } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireActiveAdmin(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const poolId = searchParams.get('poolId');

    if (!poolId) {
      return NextResponse.json({ success: false, error: 'poolId is required' }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();

    const { data: pool } = await supabase.from('pools').select('created_by').eq('id', poolId).maybeSingle();
    if (!pool) {
      return NextResponse.json({ success: false, error: 'Pool not found' }, { status: 404 });
    }
    if (!auth.isSuperAdmin && pool.created_by !== auth.email) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('participants')
      .select('id, name, email')
      .eq('pool_id', poolId)
      .eq('is_active', true)
      .order('name');

    if (error) throw error;

    return NextResponse.json({ success: true, participants: data || [] });
  } catch (error) {
    debugError('Pool participants error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load participants' }, { status: 500 });
  }
}
