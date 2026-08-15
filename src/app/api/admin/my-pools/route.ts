import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { findAccountByEmail } from '@/lib/accounts';
import { debugError } from '@/lib/utils';

// Server-only replacement for the top-level /leaderboard page's direct
// client-side pools query (all pools, including inactive ones, unlike
// /api/admin/all-pools's active-only + super-admin-only shape).
export async function GET(request: NextRequest) {
  try {
    const adminEmail = request.headers.get('x-admin-email');
    if (!adminEmail) {
      return NextResponse.json({ success: false, error: 'No admin email header' }, { status: 401 });
    }

    const account = await findAccountByEmail(adminEmail, { activeOnly: true });
    if (!account) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }
    const isSuperAdmin = account.role === 'super_admin';

    const supabase = getSupabaseServiceClient();
    let query = supabase.from('pools').select('*').order('created_at', { ascending: false });
    if (!isSuperAdmin) query = query.eq('created_by', adminEmail);

    const { data: pools, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, pools: pools ?? [] });
  } catch (error) {
    debugError('My pools error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load pools' }, { status: 500 });
  }
}
