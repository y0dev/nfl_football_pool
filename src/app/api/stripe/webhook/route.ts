import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { isStripeConfigured } from '@/lib/billing';
import { getStripe } from '@/lib/stripe';
import { emailService } from '@/lib/email';

// Stripe webhook — the single place purchases take effect.
// Plan changes happen here (not on the success redirect) so they can't be
// forged by hitting a URL. Configure the endpoint in the Stripe dashboard as
// <site>/api/stripe/webhook.
//
// Events to subscribe to:
//   - checkout.session.completed (required — handled below, drives plan/addon updates)
//   - charge.refunded (optional — not yet handled; add a case here if refunds
//     should auto-downgrade a plan)
// Every other event (including all subscription/invoice events) is
// acknowledged and ignored below: purchases are one-time Checkout Sessions
// (mode: 'payment'), never Subscriptions, so Stripe never actually sends
// subscription.* or invoice.* events for this account's checkout flow — if
// that ever changes, add cases for them here.
export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Billing is not available' }, { status: 503 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  const stripe = getStripe();
  const rawBody = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    // Always logged (not gated to dev) — this is the only trail a failed
    // production webhook leaves; without it a bad signature/secret mismatch
    // fails silently and looks like "payment went through, nothing happened."
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object;
  const adminId = session.metadata?.adminId;
  const product = session.metadata?.product;
  const quantity = Math.max(1, Number(session.metadata?.quantity) || 1);

  // Structured, single-line JSON (not free-form strings) so a log
  // aggregator can filter by session_id/admin_id when troubleshooting a
  // specific purchase. Card/payment details are never included — only ids.
  const logEvent = (result: string, extra: Record<string, unknown> = {}) => {
    console.log(JSON.stringify({
      scope: 'stripe_webhook',
      event: event.type,
      session_id: session.id,
      customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null,
      admin_id: adminId ?? null,
      product: product ?? null,
      quantity,
      result,
      ...extra,
    }));
  };

  if (!adminId || !product) {
    logEvent('missing_metadata');
    return NextResponse.json({ received: true });
  }

  if (product !== 'standard' && product !== 'addon_pool') {
    logEvent('unrecognized_product');
    return NextResponse.json({ received: true });
  }

  try {
    const supabase = getSupabaseServiceClient();

    // Idempotency: Stripe can and does redeliver the same event (network
    // retries, a slow 2xx that times out on their end, etc.). stripe_session_id
    // is UNIQUE on payments, so it doubles as the "already processed" marker —
    // checked before touching anything else. Without this, a redelivered
    // addon_pool purchase would double-increment addon_pools (it's `current +
    // quantity`, not idempotent on its own) and a redelivered event of either
    // product would re-send the confirmation email.
    const { data: existingPayment, error: idempotencyCheckError } = await supabase
      .from('payments')
      .select('id')
      .eq('stripe_session_id', session.id)
      .maybeSingle();

    if (idempotencyCheckError) {
      // Non-fatal — the payments table is documented as optional/best-effort
      // elsewhere in this file (see docs/stripe-billing-setup.md's migration
      // step), so a missing table must not block a real purchase from being
      // applied. But silently treating a query error the same as "no
      // matching row" would make duplicate-delivery protection a no-op
      // without anyone noticing, so this has to be loud.
      console.error('Idempotency check query failed — duplicate-delivery protection is NOT active for this event:', idempotencyCheckError);
    } else if (existingPayment) {
      logEvent('duplicate_skipped');
      return NextResponse.json({ received: true });
    }

    const { data: admin, error: fetchError } = await supabase
      .from('admins')
      .select('*')
      .eq('id', adminId)
      .maybeSingle();
    if (fetchError) throw fetchError;

    if (!admin) {
      // Permanent condition (deleted/nonexistent admin) — retrying won't
      // make the row reappear, so acknowledge instead of letting Stripe
      // retry a doomed event for up to 3 days.
      logEvent('unknown_admin');
      return NextResponse.json({ received: true });
    }

    if (product === 'standard') {
      const { error } = await supabase
        .from('admins')
        .update({ plan: 'standard', trial_ends_at: null, updated_at: new Date().toISOString() })
        .eq('id', adminId);
      if (error) throw error;
    } else {
      // addon_pool — increment purchased add-on pools (column added by the
      // billing migration)
      const current = Math.max(0, admin.addon_pools ?? 0);
      const { error } = await supabase
        .from('admins')
        .update({ addon_pools: current + quantity, updated_at: new Date().toISOString() })
        .eq('id', adminId);
      if (error) throw error;
    }

    // Best-effort price id lookup — for the log line only, never blocks the
    // plan update if this extra Stripe API call hiccups.
    let priceId: string | null = null;
    try {
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
      priceId = lineItems.data[0]?.price?.id ?? null;
    } catch (lineItemError) {
      console.error('Failed to fetch line items for logging (non-fatal):', lineItemError);
    }

    logEvent('db_updated', { price_id: priceId });

    // Best-effort — a failed email must not fail the webhook, since Stripe
    // would then retry an already-applied plan change.
    if (admin.email) {
      try {
        await emailService.sendUpgradeConfirmation(admin.email, admin.full_name ?? 'there', {
          product,
          quantity,
          amountCents: session.amount_total ?? null,
          currency: session.currency ?? 'usd',
        });
      } catch (emailError) {
        console.error('Failed to send upgrade confirmation email (plan update already applied):', emailError);
      }
    }

    // Payments audit row — also the idempotency marker checked above, so a
    // failure here (beyond the pre-check) risks this same event double-
    // applying on a Stripe retry. Logged loudly rather than silently
    // swallowed, though it still must not fail the webhook — the plan
    // change already succeeded and shouldn't be undone by an audit-row miss.
    const { error: recordError } = await supabase.from('payments').insert({
      admin_id: adminId,
      stripe_session_id: session.id,
      stripe_payment_intent: typeof session.payment_intent === 'string' ? session.payment_intent : null,
      product,
      quantity,
      amount_cents: session.amount_total ?? null,
      currency: session.currency ?? 'usd',
      status: 'completed',
    });
    if (recordError) {
      console.error('Failed to record payment — idempotency marker missing, a Stripe retry could double-apply this event:', recordError);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    logEvent('error');
    // Non-2xx makes Stripe retry the event, which is what we want on DB failure
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
