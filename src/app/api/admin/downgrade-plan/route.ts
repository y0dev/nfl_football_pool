import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { getAdminPlan } from '@/lib/plan';
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
      .from('commissioners')
      .select('email, full_name')
      .eq('id', adminId)
      .single();

    if (fetchError || !admin) {
      return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    }

    // Checks the EFFECTIVE plan (getAdminPlan resolves an active trial to
    // 'standard'), not the raw plan column — that column stays 'free' for
    // the whole duration of a trial (see computePlanInfo in src/lib/plan.ts),
    // so a raw-column check here would wrongly tell a trial user they're
    // "already on Free" and block them from ending their trial early.
    const planInfo = await getAdminPlan(adminId);
    if (planInfo.plan === 'free' && !planInfo.isTrialActive) {
      return NextResponse.json({ success: false, error: 'Already on the Free plan' }, { status: 400 });
    }

    const { error } = await supabase
      .from('commissioners')
      .update({ plan: 'free', trial_ends_at: null, updated_at: new Date().toISOString() })
      .eq('id', adminId);

    if (error) {
      debugError('Downgrade plan error:', error.message);
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
