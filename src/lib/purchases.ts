'use server';

import Stripe from 'stripe';
import { getSupabaseServiceClient } from './supabase-service';
import { emailService } from './email';
import { debugError } from './utils';

// Applies a completed Stripe Checkout Session to the database: idempotent
// (safe to call more than once for the same session — checks `payments`
// first), so this can be called both from the webhook (the normal path) and
// from a reconciliation sweep (the fallback path when a webhook delivery
// never arrives — see reconcilePurchasesForAdmin below). Both call sites
// must apply a purchase identically, so this is the single implementation.
export type ApplyResult =
  | { applied: true }
  | { applied: false; reason: 'missing_metadata' | 'unrecognized_product' | 'duplicate_skipped' | 'unknown_admin' };

export async function applyCompletedCheckoutSession(session: Stripe.Checkout.Session): Promise<ApplyResult> {
  const adminId = session.metadata?.adminId;
  const product = session.metadata?.product;
  const quantity = Math.max(1, Number(session.metadata?.quantity) || 1);

  const logEvent = (result: string, extra: Record<string, unknown> = {}) => {
    console.log(JSON.stringify({
      scope: 'stripe_purchase_apply',
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
    return { applied: false, reason: 'missing_metadata' };
  }

  if (product !== 'standard' && product !== 'addon_pool') {
    logEvent('unrecognized_product');
    return { applied: false, reason: 'unrecognized_product' };
  }

  const supabase = getSupabaseServiceClient();

  // Idempotency: stripe_session_id is UNIQUE on payments, so it doubles as
  // the "already processed" marker.
  const { data: existingPayment, error: idempotencyCheckError } = await supabase
    .from('payments')
    .select('id')
    .eq('stripe_session_id', session.id)
    .maybeSingle();

  if (idempotencyCheckError) {
    console.error('Idempotency check query failed — duplicate-delivery protection is NOT active for this event:', idempotencyCheckError);
  } else if (existingPayment) {
    logEvent('duplicate_skipped');
    return { applied: false, reason: 'duplicate_skipped' };
  }

  const { data: admin, error: fetchError } = await supabase
    .from('commissioners')
    .select('*')
    .eq('id', adminId)
    .maybeSingle();
  if (fetchError) throw fetchError;

  if (!admin) {
    logEvent('unknown_admin');
    return { applied: false, reason: 'unknown_admin' };
  }

  if (product === 'standard') {
    const { error } = await supabase
      .from('commissioners')
      .update({ plan: 'standard', trial_ends_at: null, updated_at: new Date().toISOString() })
      .eq('id', adminId);
    if (error) throw error;
  } else {
    const current = Math.max(0, admin.addon_pools ?? 0);
    const { error } = await supabase
      .from('commissioners')
      .update({ addon_pools: current + quantity, updated_at: new Date().toISOString() })
      .eq('id', adminId);
    if (error) throw error;
  }

  let priceId: string | null = null;
  try {
    const { getStripe } = await import('./stripe');
    const lineItems = await getStripe().checkout.sessions.listLineItems(session.id, { limit: 1 });
    priceId = lineItems.data[0]?.price?.id ?? null;
  } catch (lineItemError) {
    console.error('Failed to fetch line items for logging (non-fatal):', lineItemError);
  }

  logEvent('db_updated', { price_id: priceId });

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
    console.error('Failed to record payment — idempotency marker missing, a retry could double-apply this event:', recordError);
  }

  return { applied: true };
}

export type RefundResult =
  | { applied: true }
  | { applied: false; reason: 'missing_payment_intent' | 'unknown_payment' | 'already_refunded' | 'unknown_admin' };

// Reverts the plan/addon-pool grant a purchase made, once Stripe reports the
// underlying charge refunded. Looks the purchase up by payment_intent (the
// only id a `charge.refunded` event carries that also lives on our own
// `payments` row) rather than session id. Idempotent the same way
// applyCompletedCheckoutSession is: payments.status flips to 'refunded' on
// success, so a replayed/duplicate charge.refunded event is a no-op.
export async function handleRefundedCharge(charge: Stripe.Charge): Promise<RefundResult> {
  const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;

  const logEvent = (result: string, extra: Record<string, unknown> = {}) => {
    console.log(JSON.stringify({ scope: 'stripe_refund_apply', charge_id: charge.id, payment_intent: paymentIntentId ?? null, result, ...extra }));
  };

  if (!paymentIntentId) {
    logEvent('missing_payment_intent');
    return { applied: false, reason: 'missing_payment_intent' };
  }

  const supabase = getSupabaseServiceClient();

  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select('*')
    .eq('stripe_payment_intent', paymentIntentId)
    .maybeSingle();
  if (paymentError) throw paymentError;

  if (!payment) {
    logEvent('unknown_payment');
    return { applied: false, reason: 'unknown_payment' };
  }
  if (payment.status === 'refunded') {
    logEvent('already_refunded');
    return { applied: false, reason: 'already_refunded' };
  }

  const { data: admin, error: adminError } = await supabase
    .from('commissioners')
    .select('*')
    .eq('id', payment.admin_id)
    .maybeSingle();
  if (adminError) throw adminError;

  if (!admin) {
    logEvent('unknown_admin');
    return { applied: false, reason: 'unknown_admin' };
  }

  if (payment.product === 'standard') {
    const { error } = await supabase
      .from('commissioners')
      .update({ plan: 'free', trial_ends_at: null, updated_at: new Date().toISOString() })
      .eq('id', payment.admin_id);
    if (error) throw error;
  } else if (payment.product === 'addon_pool') {
    const remaining = Math.max(0, (admin.addon_pools ?? 0) - payment.quantity);
    const { error } = await supabase
      .from('commissioners')
      .update({ addon_pools: remaining, updated_at: new Date().toISOString() })
      .eq('id', payment.admin_id);
    if (error) throw error;
  }

  const { error: statusError } = await supabase.from('payments').update({ status: 'refunded' }).eq('id', payment.id);
  if (statusError) {
    console.error('Failed to mark payment refunded — a duplicate charge.refunded event could double-revoke:', statusError);
  }

  logEvent('reverted', { product: payment.product, quantity: payment.quantity });

  if (admin.email && payment.product === 'standard') {
    try {
      await emailService.sendPlanChangeNotification(admin.email, admin.full_name ?? 'Commissioner', 'free');
    } catch (emailError) {
      console.error('Refund plan-change notification email failed (revert already applied):', emailError);
    }
  }

  return { applied: true };
}

// Fallback path for when a webhook delivery never arrives (wrong URL
// registered, endpoint down, network partition, etc.) — asks Stripe
// directly for this admin's recent paid Checkout Sessions and applies any
// that haven't been recorded yet. Safe to call repeatedly: applyCompletedCheckoutSession
// is idempotent per session id. Called from /upgrade's post-checkout poll
// once it's waited long enough that the webhook plausibly failed, and from
// the admin-facing manual "resync" action.
export async function reconcilePurchasesForAdmin(adminId: string): Promise<{ checked: number; applied: number }> {
  const supabase = getSupabaseServiceClient();

  const { data: admin, error } = await supabase
    .from('commissioners')
    .select('stripe_customer_id')
    .eq('id', adminId)
    .maybeSingle();

  if (error || !admin?.stripe_customer_id) {
    return { checked: 0, applied: 0 };
  }

  const { getStripe } = await import('./stripe');
  const stripe = getStripe();

  const sessions = await stripe.checkout.sessions.list({
    customer: admin.stripe_customer_id,
    limit: 10,
  });

  let applied = 0;
  let checked = 0;
  for (const session of sessions.data) {
    if (session.payment_status !== 'paid') continue;
    if (session.metadata?.adminId !== adminId) continue; // belongs to a different account's purchase attempt
    checked++;
    try {
      const result = await applyCompletedCheckoutSession(session);
      if (result.applied) applied++;
    } catch (e) {
      debugError(`Reconciliation failed to apply session ${session.id}:`, e);
    }
  }

  return { checked, applied };
}
