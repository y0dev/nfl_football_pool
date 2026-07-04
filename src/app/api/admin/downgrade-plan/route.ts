import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { debugError } from '@/lib/utils';

// Self-service downgrade to Free. Only ever sets 'free' — upgrading to a paid
// plan still goes through the manual request flow until real billing exists.
export async function POST(request: NextRequest) {
  try {
    const { adminId } = await request.json();

    if (!adminId) {
      return NextResponse.json({ success: false, error: 'Missing adminId' }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();

    const { data: admin, error: fetchError } = await supabase
      .from('admins')
      .select('email, full_name, plan')
      .eq('id', adminId)
      .eq('is_super_admin', false)
      .single();

    if (fetchError || !admin) {
      return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    }

    if ((admin.plan ?? 'free') === 'free') {
      return NextResponse.json({ success: false, error: 'Already on the Free plan' }, { status: 400 });
    }

    const { error } = await supabase
      .from('admins')
      .update({ plan: 'free', trial_ends_at: null, updated_at: new Date().toISOString() })
      .eq('id', adminId)
      .eq('is_super_admin', false);

    if (error) {
      debugError('[SH][API][AUTH] Downgrade plan error:', error.message);
      return NextResponse.json({ success: false, error: 'Failed to downgrade plan' }, { status: 500 });
    }

    try {
      const { emailService } = await import('@/lib/email');
      await emailService.sendPlanChangeNotification(admin.email, admin.full_name || 'Commissioner', 'free');
    } catch (e) {
      debugError('Plan change notification email failed:', e);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
