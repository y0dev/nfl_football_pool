import { NextRequest, NextResponse } from 'next/server';
import { isStripeConfigured } from '@/lib/billing';
import { getStripe } from '@/lib/stripe';
import { applyCompletedCheckoutSession, handleRefundedCharge } from '@/lib/purchases';

// Stripe webhook — the single place purchases take effect.
// Plan changes happen here (not on the success redirect) so they can't be
// forged by hitting a URL. Configure the endpoint in the Stripe dashboard as
// <site>/api/stripe/webhook.
//
// Events to subscribe to:
//   - checkout.session.completed (required — handled below, drives plan/addon updates)
//   - charge.refunded (required — handled below, reverts the plan/addon
//     grant a refunded purchase made)
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

  if (event.type === 'charge.refunded') {
    const charge = event.data.object;
    console.log(JSON.stringify({ scope: 'stripe_webhook', event: event.type, charge_id: charge.id, result: 'received' }));
    try {
      const result = await handleRefundedCharge(charge);
      console.log(JSON.stringify({ scope: 'stripe_webhook', charge_id: charge.id, result: result.applied ? 'reverted' : result.reason }));
      return NextResponse.json({ received: true });
    } catch (error) {
      console.error('Refund webhook handler error:', error);
      return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
    }
  }

  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object;

  console.log(JSON.stringify({
    scope: 'stripe_webhook',
    event: event.type,
    session_id: session.id,
    customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null,
    admin_id: session.metadata?.adminId ?? null,
    product: session.metadata?.product ?? null,
    result: 'received',
  }));

  try {
    // Shared with the reconciliation fallback (src/lib/purchases.ts) — a
    // purchase must be applied identically whether it arrives via this
    // webhook or gets picked up by the self-heal sweep after a missed
    // delivery.
    const result = await applyCompletedCheckoutSession(session);
    console.log(JSON.stringify({ scope: 'stripe_webhook', session_id: session.id, result: result.applied ? 'db_updated' : result.reason }));
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    // Non-2xx makes Stripe retry the event, which is what we want on DB failure
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
