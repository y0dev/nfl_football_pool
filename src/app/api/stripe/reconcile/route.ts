import { NextRequest, NextResponse } from 'next/server';
import { isStripeConfigured } from '@/lib/billing';
import { reconcilePurchasesForAdmin } from '@/lib/purchases';

// Fallback for a purchase that completed in Stripe but never got applied —
// most commonly because the webhook delivery itself failed (wrong URL
// registered, endpoint down, transient network issue) rather than anything
// about the purchase itself. Called automatically by /upgrade's post-checkout
// poll once it's waited long enough that the webhook plausibly never arrived,
// so a purchase self-heals without the commissioner needing to contact support
// or anyone touching the database by hand.
export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ success: false, error: 'Billing is not available' }, { status: 503 });
  }

  const { adminId } = await request.json();
  if (!adminId) {
    return NextResponse.json({ success: false, error: 'Missing adminId' }, { status: 400 });
  }

  try {
    const result = await reconcilePurchasesForAdmin(adminId);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Reconcile purchases error:', error);
    return NextResponse.json({ success: false, error: 'Failed to reconcile purchases' }, { status: 500 });
  }
}
