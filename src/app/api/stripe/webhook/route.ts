import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { isStripeConfigured } from '@/lib/billing';
import { getStripe } from '@/lib/stripe';
import { debugError, debugLog } from '@/lib/utils';

// [SH][API][BILLING] Stripe webhook — the single place purchases take effect.
// Plan changes happen here (not on the success redirect) so they can't be
// forged by hitting a URL. Configure the endpoint in the Stripe dashboard as
// <site>/api/stripe/webhook with the checkout.session.completed event.
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
    debugError('[SH][API][BILLING] Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const adminId = session.metadata?.adminId;
      const product = session.metadata?.product;
      const quantity = Math.max(1, Number(session.metadata?.quantity) || 1);

      if (!adminId || !product) {
        debugError('[SH][API][BILLING] checkout.session.completed missing metadata', session.id);
        return NextResponse.json({ received: true });
      }

      const supabase = getSupabaseServiceClient();

      if (product === 'standard') {
        const { error } = await supabase
          .from('admins')
          .update({ plan: 'standard', trial_ends_at: null, updated_at: new Date().toISOString() })
          .eq('id', adminId);
        if (error) throw error;
        debugLog(`[SH][API][BILLING] Admin ${adminId} upgraded to standard (session ${session.id})`);
      } else if (product === 'addon_pool') {
        // Increment purchased add-on pools (column added by the billing migration)
        const { data: admin, error: fetchError } = await supabase
          .from('admins')
          .select('*')
          .eq('id', adminId)
          .single();
        if (fetchError) throw fetchError;

        const current = Math.max(0, admin?.addon_pools ?? 0);
        const { error } = await supabase
          .from('admins')
          .update({ addon_pools: current + quantity, updated_at: new Date().toISOString() })
          .eq('id', adminId);
        if (error) throw error;
        debugLog(`[SH][API][BILLING] Admin ${adminId} added ${quantity} add-on pool(s) (session ${session.id})`);
      }

      // Best-effort payment record — the payments table is part of the
      // billing migration; a failure here must not lose the plan update
      try {
        await supabase.from('payments').insert({
          admin_id: adminId,
          stripe_session_id: session.id,
          stripe_payment_intent: typeof session.payment_intent === 'string' ? session.payment_intent : null,
          product,
          quantity,
          amount_cents: session.amount_total ?? null,
          currency: session.currency ?? 'usd',
          status: 'completed',
        });
      } catch (recordError) {
        debugError('[SH][API][BILLING] Failed to record payment (plan update already applied):', recordError);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    debugError('[SH][API][BILLING] Webhook handler error:', error);
    // Non-2xx makes Stripe retry the event, which is what we want on DB failure
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
