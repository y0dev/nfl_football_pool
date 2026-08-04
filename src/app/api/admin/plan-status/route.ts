import { NextRequest, NextResponse } from 'next/server';
import { getAdminPlan, isTrialEligible } from '@/lib/plan';
import { isPricingVisible, isStripeConfigured } from '@/lib/billing';

export async function GET(request: NextRequest) {
  const adminId = request.nextUrl.searchParams.get('adminId');

  if (!adminId) {
    return NextResponse.json({ success: false, error: 'Missing adminId' }, { status: 400 });
  }

  try {
    const [planInfo, trialEligible] = await Promise.all([
      getAdminPlan(adminId),
      isTrialEligible(adminId),
    ]);
    return NextResponse.json({
      success: true,
      ...planInfo,
      trialEligible,
      billing: {
        pricingVisible: isPricingVisible(),
        stripeEnabled: isStripeConfigured() && isPricingVisible(),
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
