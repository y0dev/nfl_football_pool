import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { adminId, plan, trialDays } = await request.json();

    if (!adminId || !plan) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    if (!['free', 'standard', 'pro'].includes(plan)) {
      return NextResponse.json({ success: false, error: 'Invalid plan value' }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();

    const updateData: Record<string, unknown> = {
      plan,
      updated_at: new Date().toISOString(),
    };

    if (trialDays && Number(trialDays) > 0) {
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + Number(trialDays));
      updateData.trial_ends_at = trialEndsAt.toISOString();
    }

    const { error } = await supabase
      .from('admins')
      .update(updateData)
      .eq('id', adminId)
      .eq('is_super_admin', false);

    if (error) {
      console.error('[SH][API][AUTH] Update plan error:', error.message);
      return NextResponse.json({ success: false, error: 'Failed to update plan' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
