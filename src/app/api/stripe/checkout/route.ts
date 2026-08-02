import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { isPricingVisible, isStripeConfigured } from '@/lib/billing';
import { getStripe, getPriceId, BillingProduct } from '@/lib/stripe';

// Create a Stripe Checkout session for a plan purchase.
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
      .from('commissioners')
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
        .from('commissioners')
        .update({ stripe_customer_id: customerId })
        .eq('id', adminId);
    }

    // NEXT_PUBLIC_SITE_URL/SITE_URL should be set on every deployment (also
    // used for OG tags, sitemap, email links), but fall back to the actual
    // request origin rather than a hardcoded localhost — if that env var is
    // ever missing on a real deployment, Stripe would otherwise redirect
    // paying customers to localhost:3000 after checkout, where nothing loads.
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || request.nextUrl.origin;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      // Buyer pays sales tax on top of the price — Stripe Tax calculates it
      // from the billing address Checkout collects. Requires Stripe Tax to
      // be activated for the account (Dashboard → Settings → Tax) with at
      // least one registration, or every jurisdiction prices at $0 tax; see
      // the Tax section of docs/stripe-billing-setup.md.
      // customer_update.address is required here because we're passing an
      // existing Customer ID; without it Checkout can't collect/update the
      // address it needs to calculate tax.
      automatic_tax: { enabled: true },
      customer_update: { address: 'auto', name: 'auto' },
      line_items: [{ price: priceId, quantity: qty }],
      success_url: `${baseUrl}/upgrade?checkout=success`,
      cancel_url: `${baseUrl}/upgrade?checkout=cancelled`,
      metadata: { adminId, product, quantity: String(qty) },
    });

    return NextResponse.json({ success: true, url: session.url });
  } catch (error) {
    // Always logged (not gated to dev) — e.g. a live secret key paired with
    // a test-mode price id fails here with a Stripe "resource_missing"
    // error, which would otherwise vanish silently in production.
    console.error('Checkout session error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to start checkout' },
      { status: 500 }
    );
  }
}
