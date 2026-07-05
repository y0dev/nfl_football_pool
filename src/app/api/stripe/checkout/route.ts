import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { isPricingVisible, isStripeConfigured } from '@/lib/billing';
import { getStripe, getPriceId, BillingProduct } from '@/lib/stripe';
import { debugError } from '@/lib/utils';

// [SH][API][BILLING] Create a Stripe Checkout session for a plan purchase.
// Returns 503 until Stripe is configured and pricing is unhidden, so the
// route can ship ahead of billing going live.
export async function POST(request: NextRequest) {
  try {
    if (!isStripeConfigured() || !isPricingVisible()) {
      return NextResponse.json(
        { success: false, error: 'Billing is not available yet' },
        { status: 503 }
      );
    }

    const { adminId, product, quantity } = await request.json();

    if (!adminId || !product) {
      return NextResponse.json(
        { success: false, error: 'Missing adminId or product' },
        { status: 400 }
      );
    }

    if (product !== 'standard' && product !== 'addon_pool') {
      return NextResponse.json(
        { success: false, error: 'Unknown product' },
        { status: 400 }
      );
    }

    const qty = product === 'addon_pool' ? Math.min(Math.max(1, Number(quantity) || 1), 10) : 1;

    const priceId = getPriceId(product as BillingProduct);
    if (!priceId) {
      return NextResponse.json(
        { success: false, error: 'Product is not configured' },
        { status: 503 }
      );
    }

    const supabase = getSupabaseServiceClient();
    const { data: admin, error } = await supabase
      .from('admins')
      .select('*')
      .eq('id', adminId)
      .eq('is_active', true)
      .single();

    if (error || !admin) {
      return NextResponse.json(
        { success: false, error: 'Account not found' },
        { status: 404 }
      );
    }

    // Comped accounts never pay — their plan is managed by the site admin
    if (admin.billing_exempt === true) {
      return NextResponse.json(
        { success: false, error: 'This account does not require payment — your plan is managed by the site admin.' },
        { status: 400 }
      );
    }

    // Add-on pools sit on top of Standard — require it first
    if (product === 'addon_pool' && (admin.plan ?? 'free') !== 'standard') {
      return NextResponse.json(
        { success: false, error: 'Add-on pools require the Standard plan' },
        { status: 400 }
      );
    }

    const stripe = getStripe();

    // Reuse the Stripe customer across purchases (column added by the
    // billing migration — see docs/stripe-billing-setup.md)
    let customerId: string | undefined = admin.stripe_customer_id ?? undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: admin.email,
        name: admin.full_name ?? undefined,
        metadata: { adminId },
      });
      customerId = customer.id;
      await supabase
        .from('admins')
        .update({ stripe_customer_id: customerId })
        .eq('id', adminId);
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      line_items: [{ price: priceId, quantity: qty }],
      success_url: `${baseUrl}/upgrade?checkout=success`,
      cancel_url: `${baseUrl}/upgrade?checkout=cancelled`,
      metadata: { adminId, product, quantity: String(qty) },
    });

    return NextResponse.json({ success: true, url: session.url });
  } catch (error) {
    debugError('[SH][API][BILLING] Checkout session error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to start checkout' },
      { status: 500 }
    );
  }
}
