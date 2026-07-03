import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { debugError } from '@/lib/utils';

export async function GET(request: NextRequest) {
  const adminId = request.nextUrl.searchParams.get('adminId');

  if (!adminId) {
    return NextResponse.json({ success: false, error: 'Missing adminId' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServiceClient();

    const { data: admin, error } = await supabase
      .from('admins')
      .select('id, is_active, is_super_admin')
      .eq('id', adminId)
      .eq('is_active', true)
      .single();

    if (error || !admin) {
      return NextResponse.json({ success: true, isAdmin: false, isSuperAdmin: false });
    }

    return NextResponse.json({ success: true, isAdmin: true, isSuperAdmin: admin.is_super_admin === true });
  } catch (e) {
    debugError('[SH][API][AUTH] Verify admin status error:', e);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
