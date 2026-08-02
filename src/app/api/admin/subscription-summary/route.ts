import { NextRequest, NextResponse } from 'next/server';
import { getSubscriptionSummary } from '@/lib/subscription';
import { isPricingVisible, isStripeConfigured } from '@/lib/billing';

// Everything the dashboard's Subscription Summary card, the Account page's
// Subscription section, and the Additional Pools widget need — one call so
// those surfaces can't show different numbers for the same account.
export async function GET(request: NextRequest) {
  const adminId = request.nextUrl.searchParams.get('adminId');

  if (!adminId) {
    return NextResponse.json({ success: false, error: 'Missing adminId' }, { status: 400 });
  }

  try {
    const summary = await getSubscriptionSummary(adminId);
    return NextResponse.json({
      success: true,
      ...summary,
      billing: {
        pricingVisible: isPricingVisible(),
        stripeEnabled: isStripeConfigured() && isPricingVisible(),
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
