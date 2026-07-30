import { getSupabaseServiceClient } from './supabase';
import { getOrCreateHuddleRecordForCommissioner } from './huddles';
import { INACTIVE_POOL_LIMITS } from './utils';

export type Plan = 'free' | 'standard';

export const LIMITS: Record<Plan, { pools: number; participants: number; huddles: number }> = {
  free:     { pools: 2,        participants: 15,       huddles: 1 },
  standard: { pools: 2,        participants: 30,       huddles: 3 },
};

// Preseason-only pools (season_scope exactly [1]) are free test pools on
// every plan: they never count against plan pool limits and never require
// payment, but are capped hard regardless of plan.
export const PRESEASON_LIMITS = { pools: 2, participants: 15 };

export function isPreseasonOnlyScope(scope: unknown): boolean {
  return Array.isArray(scope) && scope.length === 1 && Number(scope[0]) === 1;
}

// Season & playoff tracking is a Standard feature: pools whose scope includes
// the postseason (season_type 3) require a paid plan.
export function scopeIncludesPlayoffs(scope: unknown): boolean {
  return Array.isArray(scope) && scope.some(t => Number(t) === 3);
}

export const PLAYOFF_SCOPE_MESSAGE =
  'Season & playoff tracking requires the Standard plan. Free pools cover the regular season only.';

export interface PlanInfo {
  plan: Plan;
  isTrialActive: boolean;
  daysLeft: number;
  trialEndsAt: string | null;
  /** Extra pools purchased as add-ons (0 until the Stripe migration lands). */
  addonPools: number;
  /** Plan pool limit including purchased add-ons. Excludes preseason test pools. */
  poolLimit: number;
  /** Participants allowed per (non-preseason) pool. */
  participantLimit: number;
  /** Huddles (Leagues) this commissioner may create. */
  huddleLimit: number;
  /** Comped by the site admin — keeps their plan without ever paying. */
  billingExempt: boolean;
}

type AdminPlanRow = {
  plan?: string | null;
  trial_ends_at?: string | null;
  addon_pools?: number | null;
  billing_exempt?: boolean | null;
} | null;

function computePlanInfo(row: AdminPlanRow): PlanInfo {
  const now = new Date();
  const trialEndsAt = row?.trial_ends_at ?? null;
  const trialDate = trialEndsAt ? new Date(trialEndsAt) : null;
  const isTrialActive = trialDate ? trialDate > now : false;
  const daysLeft = isTrialActive && trialDate
    ? Math.ceil((trialDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // While trial is active, grant Standard-level access regardless of plan column
  const rawPlan = isTrialActive ? 'standard' : (row?.plan ?? 'free');
  // Defend against stale/unrecognized values in admins.plan — e.g. rows
  // still holding the retired 'pro' tier — rather than crashing on
  // LIMITS[plan] below. A legacy premium tier maps to today's highest
  // (standard); anything else falls back to free.
  const plan: Plan = rawPlan in LIMITS ? (rawPlan as Plan) : (rawPlan === 'pro' ? 'standard' : 'free');
  // Add-on pools only apply on paid plans (they're purchased on top of Standard)
  const addonPools = plan === 'free' ? 0 : Math.max(0, row?.addon_pools ?? 0);

  return {
    plan,
    isTrialActive,
    daysLeft,
    trialEndsAt,
    addonPools,
    poolLimit: LIMITS[plan].pools + addonPools,
    participantLimit: LIMITS[plan].participants,
    huddleLimit: LIMITS[plan].huddles,
    billingExempt: row?.billing_exempt ?? false,
  };
}

// select('*') so the optional addon_pools column (added by the Stripe
// migration) is picked up when present without erroring before it exists.
export async function getAdminPlan(adminId: string): Promise<PlanInfo> {
  const supabase = getSupabaseServiceClient();
  const { data } = await supabase
    .from('admins')
    .select('*')
    .eq('id', adminId)
    .single();

  return computePlanInfo(data as AdminPlanRow);
}

export async function getAdminPlanByEmail(email: string): Promise<PlanInfo> {
  const supabase = getSupabaseServiceClient();
  const { data } = await supabase
    .from('admins')
    .select('*')
    .eq('email', email)
    .single();

  return computePlanInfo(data as AdminPlanRow);
}

/**
 * Batch plan lookup keyed by email — for jobs that span many pools (e.g.
 * reminder sends) so each owner is resolved with one query total.
 * Unknown emails resolve to free-plan defaults.
 */
export async function getAdminPlansByEmails(emails: string[]): Promise<Map<string, PlanInfo>> {
  const result = new Map<string, PlanInfo>();
  const unique = [...new Set(emails.filter(Boolean))];
  if (unique.length === 0) return result;

  const supabase = getSupabaseServiceClient();
  const { data } = await supabase
    .from('admins')
    .select('*')
    .in('email', unique);

  for (const email of unique) {
    const row = (data ?? []).find(a => a.email === email) ?? null;
    result.set(email, computePlanInfo(row as AdminPlanRow));
  }
  return result;
}

// Email pick reminders are a Standard feature
export const REMINDERS_PLAN_MESSAGE = 'Email pick reminders require the Standard plan.';

export function planAllowsReminders(planInfo: PlanInfo): boolean {
  return planInfo.plan !== 'free';
}

// The commissioner multi-pool leaderboard tool (/leaderboard) is a Standard
// feature — same boundary as reminders. A trial counts as Standard (it
// already resolves to 'standard' in computePlanInfo); once the trial ends
// and the plan reverts to free, access reverts too.
export const LEADERBOARD_TOOL_PLAN_MESSAGE =
  'The full leaderboard tool requires the Standard plan. Upgrade to see live standings across your pools.';

export function planAllowsLeaderboardTool(planInfo: PlanInfo): boolean {
  return planInfo.plan !== 'free';
}

export function trialEndDate(daysFromNow = 14): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString();
}

export interface ParticipantCapacity {
  allowed: boolean;
  count: number;
  limit: number;
  isPreseasonPool: boolean;
  message?: string;
}

/**
 * Shared participant-limit check for every path that adds a participant to a
 * pool (commissioner add, self-serve join, pick import). Preseason-only test
 * pools cap at PRESEASON_LIMITS.participants on every plan; other pools use
 * the pool owner's plan limit.
 */
export async function checkParticipantCapacity(poolId: string): Promise<ParticipantCapacity> {
  const supabase = getSupabaseServiceClient();

  const { data: pool } = await supabase
    .from('pools')
    .select('created_by, season_scope')
    .eq('id', poolId)
    .single();

  const isPreseasonPool = isPreseasonOnlyScope(pool?.season_scope);

  let limit: number;
  let planName: string;
  if (isPreseasonPool) {
    limit = PRESEASON_LIMITS.participants;
    planName = 'preseason test pool';
  } else if (pool?.created_by) {
    const planInfo = await getAdminPlanByEmail(pool.created_by);
    limit = planInfo.participantLimit;
    planName = `${planInfo.plan} plan`;
  } else {
    // Pool has no resolvable owner — fall back to the most restrictive limit
    limit = LIMITS.free.participants;
    planName = 'free plan';
  }

  const { count } = await supabase
    .from('participants')
    .select('*', { count: 'exact', head: true })
    .eq('pool_id', poolId)
    .eq('is_active', true);

  const current = count ?? 0;
  const allowed = current < limit;

  return {
    allowed,
    count: current,
    limit,
    isPreseasonPool,
    message: allowed
      ? undefined
      : isPreseasonPool
        ? `Preseason test pools are limited to ${limit} participants.`
        : `This pool has reached its ${planName} limit of ${limit} participants.`,
  };
}

export interface PoolCapacity {
  allowed: boolean;
  count: number;
  limit: number;
  plan: Plan;
  isPreseasonPool: boolean;
  message?: string;
}

/**
 * Pool-count check for creating a pool (or re-scoping one). Scoped to the
 * commissioner's Huddle (spec: "1 included pool per Huddle" on Standard,
 * "1 pool" on Free) rather than every pool the commissioner has ever
 * created — today those are equivalent (one Huddle per commissioner), but
 * this keeps the check correct once a commissioner can run multiple
 * Huddles. Preseason-only pools are counted and capped separately from plan
 * pools, so free test pools never eat into (or dodge) the paid limit.
 *
 * Only counts ACTIVE pools — deactivating a pool frees up its slot.
 * Retaining an inactive pool instead of deleting it is a separate,
 * across-all-Huddles limit — see checkInactivePoolCapacity below.
 */
export async function checkPoolCapacity(
  createdByEmail: string,
  opts: { preseason: boolean; excludePoolId?: string; huddleId?: string }
): Promise<PoolCapacity> {
  const supabase = getSupabaseServiceClient();
  const planInfo = await getAdminPlanByEmail(createdByEmail);
  const huddleId = opts.huddleId ?? (await getOrCreateHuddleRecordForCommissioner(createdByEmail)).id;

  let query = supabase
    .from('pools')
    .select('id, season_scope')
    .eq('huddle_id', huddleId)
    .eq('is_active', true);
  if (opts.excludePoolId) query = query.neq('id', opts.excludePoolId);

  const { data: pools } = await query;
  const preseasonCount = (pools ?? []).filter(p => isPreseasonOnlyScope(p.season_scope)).length;
  const regularCount = (pools ?? []).length - preseasonCount;

  const limit = opts.preseason ? PRESEASON_LIMITS.pools : planInfo.poolLimit;
  const count = opts.preseason ? preseasonCount : regularCount;
  const allowed = count < limit;

  return {
    allowed,
    count,
    limit,
    plan: planInfo.plan,
    isPreseasonPool: opts.preseason,
    message: allowed
      ? undefined
      : opts.preseason
        ? `You can have up to ${PRESEASON_LIMITS.pools} preseason test pools.`
        : `Your ${planInfo.plan} plan allows ${limit} pool${limit === 1 ? '' : 's'}.`,
  };
}

export interface InactivePoolCapacity {
  allowed: boolean;
  count: number;
  limit: number;
  plan: Plan;
  message?: string;
}

/**
 * Checks whether a commissioner can retain another inactive (deactivated,
 * not deleted) pool. Counted across ALL of the commissioner's Huddles —
 * unlike the active pool limit in checkPoolCapacity, which is per-Huddle.
 * Free allows none (INACTIVE_POOL_LIMITS.free === 0): a Free commissioner
 * has to delete a pool instead of archiving it.
 */
export async function checkInactivePoolCapacity(
  createdByEmail: string,
  opts: { excludePoolId?: string } = {}
): Promise<InactivePoolCapacity> {
  const supabase = getSupabaseServiceClient();
  const planInfo = await getAdminPlanByEmail(createdByEmail);
  const limit = INACTIVE_POOL_LIMITS[planInfo.plan] ?? INACTIVE_POOL_LIMITS.free;

  let query = supabase
    .from('pools')
    .select('id', { count: 'exact', head: true })
    .eq('created_by', createdByEmail)
    .eq('is_active', false);
  if (opts.excludePoolId) query = query.neq('id', opts.excludePoolId);

  const { count } = await query;
  const current = count ?? 0;
  const allowed = current < limit;

  return {
    allowed,
    count: current,
    limit,
    plan: planInfo.plan,
    message: allowed
      ? undefined
      : limit === 0
        ? `Your ${planInfo.plan} plan doesn't allow keeping inactive pools — delete it instead, or upgrade to Standard.`
        : `Your ${planInfo.plan} plan allows up to ${limit} inactive pools across all your Huddles. Delete or reactivate one first.`,
  };
}

export interface HuddleCapacity {
  allowed: boolean;
  count: number;
  limit: number;
  plan: Plan;
  message?: string;
}

/**
 * Huddle-count check for creating an additional Huddle. Free is limited to
 * the one Huddle every commissioner already gets via
 * getOrCreateHuddleRecordForCommissioner; Standard allows up to
 * LIMITS.standard.huddles.
 */
export async function checkHuddleCapacity(commissionerEmail: string): Promise<HuddleCapacity> {
  const supabase = getSupabaseServiceClient();
  const planInfo = await getAdminPlanByEmail(commissionerEmail);

  const { count } = await supabase
    .from('huddles')
    .select('id', { count: 'exact', head: true })
    .eq('commissioner_email', commissionerEmail);

  const current = count ?? 0;
  const limit = planInfo.huddleLimit;
  const allowed = current < limit;

  return {
    allowed,
    count: current,
    limit,
    plan: planInfo.plan,
    message: allowed
      ? undefined
      : `Your ${planInfo.plan} plan allows ${limit} Huddle${limit === 1 ? '' : 's'}.`,
  };
}

export interface PoolTransferCapacity {
  allowed: boolean;
  poolLimitExceeded: boolean;
  poolCount: number;
  poolLimit: number;
  participantLimitExceeded: boolean;
  participantCount: number;
  participantLimit: number;
  destinationPlan: Plan;
  message?: string;
}

/**
 * Checks whether moving a pool into a destination Huddle would exceed the
 * destination commissioner's limits. Two independent checks:
 *   - pool count in the destination Huddle (via checkPoolCapacity, so it
 *     respects the preseason/regular split the same way pool creation does)
 *   - the pool's current active participant count against the destination's
 *     per-pool participant limit — the count itself doesn't change on a
 *     transfer, only the limit it's judged against does, since the pool may
 *     be moving to a different plan
 * Huddle-count isn't checked here: a pool transfer moves into an EXISTING
 * Huddle, it never creates a new one, so there's nothing to exceed there.
 */
export async function checkPoolTransferCapacity(
  poolId: string,
  destinationHuddleId: string,
  destinationCommissionerEmail: string
): Promise<PoolTransferCapacity> {
  const supabase = getSupabaseServiceClient();

  const { data: pool } = await supabase
    .from('pools')
    .select('season_scope')
    .eq('id', poolId)
    .single();

  const isPreseason = isPreseasonOnlyScope(pool?.season_scope);

  const poolCapacity = await checkPoolCapacity(destinationCommissionerEmail, {
    preseason: isPreseason,
    excludePoolId: poolId,
    huddleId: destinationHuddleId,
  });

  const destinationPlan = await getAdminPlanByEmail(destinationCommissionerEmail);
  const participantLimit = isPreseason ? PRESEASON_LIMITS.participants : destinationPlan.participantLimit;

  const { count } = await supabase
    .from('participants')
    .select('*', { count: 'exact', head: true })
    .eq('pool_id', poolId)
    .eq('is_active', true);

  const participantCount = count ?? 0;
  const participantLimitExceeded = participantCount > participantLimit;
  const poolLimitExceeded = !poolCapacity.allowed;
  const allowed = !poolLimitExceeded && !participantLimitExceeded;

  const messages: string[] = [];
  if (poolLimitExceeded) {
    messages.push(
      poolCapacity.message ?? `The destination Huddle is at its pool limit (${poolCapacity.count}/${poolCapacity.limit}).`
    );
  }
  if (participantLimitExceeded) {
    const over = participantCount - participantLimit;
    messages.push(
      `This pool has ${participantCount} participants, but the destination's ${destinationPlan.plan} plan allows ${participantLimit} per pool — remove ${over} participant${over === 1 ? '' : 's'} before transferring.`
    );
  }

  return {
    allowed,
    poolLimitExceeded,
    poolCount: poolCapacity.count,
    poolLimit: poolCapacity.limit,
    participantLimitExceeded,
    participantCount,
    participantLimit,
    destinationPlan: destinationPlan.plan,
    message: messages.length > 0 ? messages.join(' ') : undefined,
  };
}
