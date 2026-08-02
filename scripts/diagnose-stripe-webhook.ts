// One-off diagnostic — queries the Stripe API directly (read-only) to check
// webhook endpoint registration and recent checkout/event history.
// Run with: npx tsx scripts/diagnose-stripe-webhook.ts
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import Stripe from 'stripe';

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error('STRIPE_SECRET_KEY not set');
  process.exit(1);
}
const stripe = new Stripe(key);
console.log('Stripe key mode:', key.startsWith('sk_live') ? 'LIVE' : key.startsWith('sk_test') ? 'TEST' : 'UNKNOWN');

async function main() {
  console.log('\n--- Registered webhook endpoints ---');
  const endpoints = await stripe.webhookEndpoints.list({ limit: 20 });
  if (endpoints.data.length === 0) {
    console.log('NONE REGISTERED');
  } else {
    for (const ep of endpoints.data) {
      console.log({ id: ep.id, url: ep.url, status: ep.status, enabled_events: ep.enabled_events });
    }
  }

  console.log('\n--- Recent checkout sessions (last 10) ---');
  const sessions = await stripe.checkout.sessions.list({ limit: 10 });
  for (const s of sessions.data) {
    console.log({
      id: s.id,
      status: s.status,
      payment_status: s.payment_status,
      customer: s.customer,
      amount_total: s.amount_total,
      metadata: s.metadata,
      created: new Date(s.created * 1000).toISOString(),
    });
  }

  console.log('\n--- Recent checkout.session.completed events (last 10) ---');
  const events = await stripe.events.list({ type: 'checkout.session.completed', limit: 10 });
  for (const e of events.data) {
    console.log({
      id: e.id,
      created: new Date(e.created * 1000).toISOString(),
      pending_webhooks: e.pending_webhooks,
      livemode: e.livemode,
    });
  }
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
