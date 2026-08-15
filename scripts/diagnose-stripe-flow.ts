// One-off diagnostic — checks live DB state relevant to the Stripe purchase
// flow. Read-only, no writes. Run with: npx tsx scripts/diagnose-stripe-flow.ts
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Reuse the app's own client factory so this exercises the exact same
// credential-resolution path the checkout/webhook routes use in production.
import { getSupabaseServiceClient } from '../src/lib/supabase-service';

const supabase = getSupabaseServiceClient();

async function main() {
  console.log('--- commissioners table ---');
  const { data: comms, error: commsErr } = await supabase
    .from('commissioners')
    .select('id, email, plan, addon_pools, billing_exempt, stripe_customer_id, updated_at')
    .limit(500);
  if (commsErr) {
    console.log('ERROR querying commissioners:', commsErr.message);
  } else {
    console.log(`rows: ${comms.length}`);
    const withStripeCustomer = comms.filter(c => c.stripe_customer_id);
    const standard = comms.filter(c => c.plan === 'standard');
    const withAddon = comms.filter(c => (c.addon_pools ?? 0) > 0);
    console.log(`  with stripe_customer_id set: ${withStripeCustomer.length}`);
    console.log(`  plan=standard: ${standard.length}`);
    console.log(`  addon_pools>0: ${withAddon.length}`);
    if (withStripeCustomer.length > 0) {
      console.log('  sample (up to 5):', withStripeCustomer.slice(0, 5).map(c => ({
        email: c.email, plan: c.plan, addon_pools: c.addon_pools, stripe_customer_id: c.stripe_customer_id, updated_at: c.updated_at,
      })));
    }
  }

  console.log('\n--- payments table ---');
  const { data: payments, error: paymentsErr } = await supabase
    .from('payments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);
  if (paymentsErr) {
    console.log('ERROR querying payments (table likely missing):', paymentsErr.message);
  } else {
    console.log(`rows (most recent 20): ${payments.length}`);
    console.log(payments);
  }

  console.log('\n--- env sanity (booleans only, no secrets) ---');
  console.log({
    STRIPE_SECRET_KEY_set: !!process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET_set: !!process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PRICE_STANDARD_set: !!process.env.STRIPE_PRICE_STANDARD,
    STRIPE_PRICE_ADDON_POOL_set: !!process.env.STRIPE_PRICE_ADDON_POOL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || '(unset)',
    SITE_URL: process.env.SITE_URL || '(unset)',
  });
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
