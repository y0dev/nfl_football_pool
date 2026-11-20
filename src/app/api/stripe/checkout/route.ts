import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { isPricingVisible, isStripeConfigured } from '@/lib/billing';
import { getStripe, getPriceId, BillingProduct } from '@/lib/stripe';
import { computePlanInfo, isPaidPlanCurrent } from '@/lib/plan';
import { ALL_SALES_FINAL, seasonLabel } from '@/lib/pricing';

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

    // Comped accounts never pay for the base plan itself — it's managed by
    // the site admin. Add-on pools are a genuine separate purchase, so a
    // comped Standard commissioner can still buy real extra pools here
    // instead of needing the site admin to manually bump addon_pools.
    if (admin.billing_exempt === true && product === 'standard') {
      return NextResponse.json(
        { success: false, error: 'This account does not require payment — your plan is managed by the site admin.' },
        { status: 400 }
      );
    }

    // Season-aware: a Standard plan bought for a season that has ended no
    // longer counts (see isPaidPlanCurrent in src/lib/plan.ts).
    const planInfo = computePlanInfo(admin);
    const season = planInfo.currentSeason;
    const hasPaidStandardThisSeason = isPaidPlanCurrent(admin, season) && (admin.plan ?? 'free') === 'standard';

    // All sales are final, so never let someone pay twice for the same
    // season (double-click, second tab, stale page).
    if (product === 'standard' && hasPaidStandardThisSeason) {
      return NextResponse.json(
        { success: false, error: `You already have Standard for the ${seasonLabel(season)} season.` },
        { status: 400 }
      );
    }

    // Add-on pools sit on top of a paid Standard plan for this season — a
    // trial doesn't count, since the add-ons would outlive it.
    if (product === 'addon_pool' && !hasPaidStandardThisSeason) {
      return NextResponse.json(
        { success: false, error: `Add-on pools require the Standard plan for the ${seasonLabel(season)} season` },
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
      // Pricing is per-season, one-time — not a subscription (mode: 'payment'
      // above already reflects that), but Stripe's hosted checkout page
      // otherwise only shows whatever the Product's name/description happen
      // to say, which depends on Stripe Dashboard config we can't verify
      // from code. This puts the same fact directly on the payment page
      // itself, right by the button where money actually changes hands.
      // Also states the no-refund policy right where money changes hands.
      custom_text: {
        submit: {
          message: (product === 'addon_pool'
            ? `One-time payment covering the ${seasonLabel(season)} NFL season (through the Super Bowl) for each additional pool — no auto-renewal or subscription.`
            : `One-time payment covering the ${seasonLabel(season)} NFL season (through the Super Bowl) — no auto-renewal or subscription.`)
            + ` ${ALL_SALES_FINAL}`,
        },
      },
      success_url: `${baseUrl}/upgrade?checkout=success`,
      cancel_url: `${baseUrl}/upgrade?checkout=cancelled`,
      metadata: { adminId, product, quantity: String(qty), season: String(season) },
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
