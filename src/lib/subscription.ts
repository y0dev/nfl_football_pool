import { getSupabaseServiceClient } from './supabase-service';
import { getAdminPlan, isPreseasonOnlyScope, PlanInfo } from './plan';

// Single source of truth for "what does this commissioner have" — read by
// the dashboard, Account page, and the Purchases page so plan/usage numbers
// can't drift between screens. Wraps getAdminPlan (entitlements) with usage
// counts and purchase metadata that PlanInfo doesn't carry.

export interface SubscriptionSummary extends PlanInfo {
  /** Huddles this commissioner has created, out of huddleLimit. */
  huddlesUsed: number;
  /** Active, non-preseason pools in their primary Huddle, out of poolLimit
   *  (pool limits are per-Huddle — see checkPoolCapacity in plan.ts). Null
   *  when the commissioner has no Huddle yet. */
  poolsUsed: number | null;
  /** Participants across every pool this commissioner owns. */
  participantsTotal: number;
  stripeCustomerId: string | null;
  /** created_at of their most recent completed 'standard' purchase, if the
   *  payments table exists and has one — null on a trial/comped/free account
   *  or if the table isn't there yet (see docs/stripe-billing-setup.md). */
  standardPurchasedAt: string | null;
}

export async function getSubscriptionSummary(adminId: string): Promise<SubscriptionSummary> {
  const supabase = getSupabaseServiceClient();
  const planInfo = await getAdminPlan(adminId);

  const { data: admin } = await supabase
    .from('commissioners')
    .select('email, stripe_customer_id')
    .eq('id', adminId)
    .maybeSingle();

  const email = admin?.email ?? null;

  let huddlesUsed = 0;
  let poolsUsed: number | null = null;
  let participantsTotal = 0;

  if (email) {
    const { data: huddles } = await supabase
      .from('huddles')
      .select('id')
      .eq('commissioner_email', email)
      .order('created_at', { ascending: true });
    huddlesUsed = huddles?.length ?? 0;

    // Pool limits are enforced per-Huddle (see checkPoolCapacity) — scope
    // the "used" count to the primary Huddle so it matches what Create Pool
    // will actually allow from the dashboard, which always targets it.
    const primaryHuddleId = huddles?.[0]?.id ?? null;

    const { data: pools } = await supabase
      .from('pools')
      .select('id, season_scope')
      .eq('created_by', email)
      .eq('is_active', true);

    if (primaryHuddleId) {
      const { data: primaryPools } = await supabase
        .from('pools')
        .select('season_scope')
        .eq('huddle_id', primaryHuddleId)
        .eq('is_active', true);
      poolsUsed = (primaryPools ?? []).filter(p => !isPreseasonOnlyScope(p.season_scope)).length;
    }

    if (pools && pools.length > 0) {
      const { count } = await supabase
        .from('participants')
        .select('*', { count: 'exact', head: true })
        .in('pool_id', pools.map(p => p.id))
        .eq('is_active', true);
      participantsTotal = count ?? 0;
    }
  }

  // Best-effort — the payments table is optional until the billing migration
  // runs (see docs/stripe-billing-setup.md); missing/erroring must not break
  // the rest of the summary.
  const fetchStandardPurchase = async (): Promise<string | null> => {
    const { data: purchase } = await supabase
      .from('payments')
      .select('created_at')
      .eq('admin_id', adminId)
      .eq('product', 'standard')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return purchase?.created_at ?? null;
  };

  let standardPurchasedAt: string | null = null;
  try {
    standardPurchasedAt = await fetchStandardPurchase();

    // Self-heal: a real Stripe customer with no recorded purchase means the
    // checkout webhook never landed (delivery failure, endpoint misconfig,
    // etc.) — reconcilePurchasesForAdmin asks Stripe directly and backfills
    // `payments`. Previously this only ran right after a fresh checkout
    // (see /upgrade's post-checkout poll), so an account that's been sitting
    // on 'standard' for a while with a missed webhook never got repaired —
    // this makes every dashboard/settings load self-heal it instead.
    if (!standardPurchasedAt && planInfo.plan === 'standard' && !planInfo.billingExempt && admin?.stripe_customer_id) {
      const { reconcilePurchasesForAdmin } = await import('./purchases');
      await reconcilePurchasesForAdmin(adminId);
      standardPurchasedAt = await fetchStandardPurchase();
    }
  } catch {
    standardPurchasedAt = null;
  }

  return {
    ...planInfo,
    huddlesUsed,
    poolsUsed,
    participantsTotal,
    stripeCustomerId: admin?.stripe_customer_id ?? null,
    standardPurchasedAt,
  };
}

export interface PurchaseRecord {
  id: string;
  product: 'standard' | 'addon_pool' | string;
  quantity: number;
  amountCents: number | null;
  currency: string;
  status: string;
  createdAt: string;
}

/**
 * Newest-first purchase history for a commissioner. Returns an empty array
 * (not an error) if the payments table doesn't exist yet or the query
 * otherwise fails — callers render that as an empty state, not a crash.
 */
export async function getPurchaseHistory(adminId: string): Promise<PurchaseRecord[]> {
  const supabase = getSupabaseServiceClient();
  try {
    const { data, error } = await supabase
      .from('payments')
      .select('id, product, quantity, amount_cents, currency, status, created_at')
      .eq('admin_id', adminId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data ?? []).map(row => ({
      id: row.id,
      product: row.product,
      quantity: row.quantity ?? 1,
      amountCents: row.amount_cents ?? null,
      currency: row.currency ?? 'usd',
      status: row.status,
      createdAt: row.created_at,
    }));
  } catch {
    return [];
  }
}
