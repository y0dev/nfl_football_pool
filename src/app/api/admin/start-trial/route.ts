import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { getAdminPlan, trialEndDate } from '@/lib/plan';
import { TRIAL_DAYS, isTrialEnabled } from '@/lib/pricing';
import { debugError } from '@/lib/utils';

// Self-service reactivation for a Free commissioner who never took the
// 7-day Standard trial at sign-up (see src/app/register/page.tsx and
// src/app/auth/callback/route.ts, which are the normal grant path). One
// trial per account, ever: trial_ends_at is set exactly once and never
// cleared back to null except by this route never running twice — a
// commissioner who already has ANY trial_ends_at value (active or expired)
// is not eligible again, matching the one-time guarantee everywhere else.
export async function POST(request: NextRequest) {
  try {
    if (!isTrialEnabled()) {
      return NextResponse.json({ success: false, error: 'Trials are not available right now' }, { status: 503 });
    }

    const { adminId } = await request.json();
    if (!adminId) {
      return NextResponse.json({ success: false, error: 'Missing adminId' }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();

    const { data: admin, error: fetchError } = await supabase
      .from('commissioners')
      .select('plan, trial_ends_at, billing_exempt')
      .eq('id', adminId)
      .single();

    if (fetchError || !admin) {
      return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    }

    if (admin.billing_exempt) {
      return NextResponse.json({ success: false, error: 'This account is comped — no trial needed' }, { status: 400 });
    }

    if (admin.trial_ends_at) {
      return NextResponse.json({ success: false, error: 'This account has already used its trial' }, { status: 400 });
    }

    // Belt-and-suspenders: also reject if the effective plan is already
    // Standard (e.g. a real paid purchase, even though the raw plan column
    // and trial_ends_at both looked eligible above).
    const planInfo = await getAdminPlan(adminId);
    if (planInfo.plan !== 'free') {
      return NextResponse.json({ success: false, error: 'This account is already on Standard' }, { status: 400 });
    }

    const { error } = await supabase
      .from('commissioners')
      .update({ trial_ends_at: trialEndDate(TRIAL_DAYS), updated_at: new Date().toISOString() })
      .eq('id', adminId);

    if (error) {
      debugError('Start trial error:', error.message);
      return NextResponse.json({ success: false, error: 'Failed to start trial' }, { status: 500 });
    }

    return NextResponse.json({ success: true, trialDays: TRIAL_DAYS });
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
