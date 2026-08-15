import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { debugError } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const adminEmail = request.headers.get('x-admin-email');
    if (!adminEmail) {
      return NextResponse.json({ success: false, error: 'No admin email header' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const group = body.group === 'standard' ? 'standard' : 'free';

    const supabase = getSupabaseServiceClient();

    const { data: currentAdmin } = await supabase
      .from('admins')
      .select('is_super_admin')
      .eq('email', adminEmail)
      .single();

    if (!currentAdmin?.is_super_admin) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const { data: targets } = await supabase
      .from('commissioners')
      .select('email, full_name, plan, trial_ends_at')
      .eq('is_active', true)
      .eq('plan', group);

    if (!targets || targets.length === 0) {
      return NextResponse.json({ success: true, sent: 0 });
    }

    const { emailService } = await import('@/lib/email');
    let sent = 0;
    for (const target of targets) {
      try {
        await emailService.sendPromotionEmail(target.email, target.full_name || 'Commissioner');
        sent++;
      } catch (e) {
        debugError('Promo email failed for:', target.email, e);
      }
    }

    return NextResponse.json({ success: true, sent, total: targets.length });
  } catch (e) {
    debugError('Send promotion error:', e);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
