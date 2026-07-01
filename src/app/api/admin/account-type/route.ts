import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const adminId = request.nextUrl.searchParams.get('adminId');

  if (!adminId) {
    return NextResponse.json({ success: false, error: 'Missing adminId' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServiceClient();

    const { data: admin, error } = await supabase
      .from('admins')
      .select('password_hash')
      .eq('id', adminId)
      .eq('is_active', true)
      .single();

    if (error || !admin) {
      return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, isOAuth: admin.password_hash === 'google_oauth' });
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
