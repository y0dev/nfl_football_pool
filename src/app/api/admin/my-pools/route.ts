import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { requireActiveAdmin } from '@/lib/accounts';
import { debugError } from '@/lib/utils';

// Server-only replacement for the top-level /leaderboard page's direct
// client-side pools query (all pools, including inactive ones, unlike
// /api/admin/all-pools's active-only + super-admin-only shape).
export async function GET(request: NextRequest) {
  try {
    const auth = await requireActiveAdmin(request);
    if (!auth.ok) return auth.response;

    const supabase = getSupabaseServiceClient();
    let query = supabase.from('pools').select('*').order('created_at', { ascending: false });
    if (!auth.isSuperAdmin) query = query.eq('created_by', auth.email);

    const { data: pools, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, pools: pools ?? [] });
  } catch (error) {
    debugError('My pools error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load pools' }, { status: 500 });
  }
}
