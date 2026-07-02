import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { debugError } from '@/lib/utils';

export async function GET(_request: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient();
    const { data: pools, error } = await supabase
      .from('pools')
      .select('id, name, is_active, season, created_by, created_at, participants(count)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, pools: pools || [] });
  } catch (error) {
    debugError('[SH][API][DB] All pools error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load pools' }, { status: 500 });
  }
}
