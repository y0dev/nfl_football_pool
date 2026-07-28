import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { debugError } from '@/lib/utils';

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
      .select('id, name, is_active, season, season_scope, created_by, created_at, competition_type, huddle_id, participants(count)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, pools: pools || [] });
  } catch (error) {
    debugError('[SH][API][DB] All pools error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load pools' }, { status: 500 });
  }
}
