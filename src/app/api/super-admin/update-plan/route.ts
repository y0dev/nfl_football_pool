import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { debugError } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const { adminId, plan, trialDays, billingExempt, addonPools } = await request.json();

    if (!adminId || !plan) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    if (!['free', 'standard'].includes(plan)) {
      return NextResponse.json({ success: false, error: 'Invalid plan value' }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();

    const { data: targetAdmin, error: fetchError } = await supabase
      .from('commissioners')
      .select('email, full_name')
      .eq('id', adminId)
      .single();

    if (fetchError || !targetAdmin) {
      return NextResponse.json({ success: false, error: 'Commissioner not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      plan,
      updated_at: new Date().toISOString(),
    };

    const trialDaysNum = Number(trialDays);
    if (trialDays && trialDaysNum > 0) {
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + trialDaysNum);
      updateData.trial_ends_at = trialEndsAt.toISOString();
    }

    // Comped marker: whether this commissioner has to pay for their plan.
    // Column arrives with the billing migration — retry without it if the
    // DB doesn't have it yet so plan changes never fail on the flag.
    if (typeof billingExempt === 'boolean') {
      updateData.billing_exempt = billingExempt;
    }

    // Manually grant additional pools — a comped (billing_exempt)
    // commissioner can also buy real add-on pools via /api/stripe/checkout
    // (only their base-plan purchase is blocked there), but this stays
    // available for cases the site admin wants to grant directly instead.
    if (addonPools !== undefined) {
      const addonPoolsNum = Number(addonPools);
      if (!Number.isInteger(addonPoolsNum) || addonPoolsNum < 0) {
        return NextResponse.json({ success: false, error: 'Additional pools must be a non-negative whole number' }, { status: 400 });
      }
      updateData.addon_pools = addonPoolsNum;
    }

    let warning: string | undefined;
    let { error } = await supabase
      .from('commissioners')
      .update(updateData)
      .eq('id', adminId);

    if (error && 'billing_exempt' in updateData &&
        (error.message.includes('billing_exempt') || error.message.includes('schema cache'))) {
      debugError('billing_exempt column missing — retrying plan update without it (run the billing migration)');
      const withoutFlag = { ...updateData };
      delete withoutFlag.billing_exempt;
      ({ error } = await supabase
        .from('commissioners')
        .update(withoutFlag)
        .eq('id', adminId));
      if (!error) {
        warning = 'Plan saved, but the billing (Pays/Comped) setting was not — the billing_exempt column is missing. Run the billing DB migration first.';
      }
    }

    if (error) {
      debugError('Update plan error:', error.message);
      return NextResponse.json({ success: false, error: 'Failed to update plan' }, { status: 500 });
    }

    // Send notification email (best-effort)
    try {
      const { emailService } = await import('@/lib/email');
      await emailService.sendPlanChangeNotification(
        targetAdmin.email,
        targetAdmin.full_name || 'Commissioner',
        plan,
        trialDaysNum > 0 ? trialDaysNum : undefined,
        billingExempt === true,
      );
    } catch (e) {
      debugError('Plan change notification email failed:', e);
    }

    return NextResponse.json({ success: true, ...(warning ? { warning } : {}) });
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
