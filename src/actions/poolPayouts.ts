'use server';

import { getSupabaseServiceClient } from '@/lib/supabase';
import { findAccountByEmail } from '@/lib/accounts';
import { debugError } from '@/lib/utils';
import {
  PayoutConfig, PayoutPosition, TiePolicy, WeeklyAmountType,
  validatePayoutPositions, validateEntryFee, validateWeeklyAmount,
  DEFAULT_PAYOUT_CONFIG, DEFAULT_WEEKLY_POSITIONS, DEFAULT_OVERALL_POSITIONS,
} from '@/lib/payouts';

export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

/** Commissioner who owns the pool, or a Super Admin managing it on their
 * behalf (mirrors how the Super Admin dashboard reaches every pool's
 * Settings tab through the same shared PoolWorkspace component). */
async function requireCanManagePool(poolId: string, requestedBy: string) {
  const supabase = getSupabaseServiceClient();
  const { data: pool } = await supabase
    .from('pools')
    .select('id, created_by, season')
    .eq('id', poolId)
    .maybeSingle();

  if (!pool) return { ok: false as const, error: 'Pool not found.' };
  if (pool.created_by === requestedBy) return { ok: true as const, pool };

  const account = await findAccountByEmail(requestedBy, { activeOnly: true });
  if (account?.role === 'super_admin') return { ok: true as const, pool };

  return { ok: false as const, error: 'You do not have permission to manage this pool.' };
}

function toConfig(row: {
  enabled: boolean;
  entry_fee: number | null;
  tie_policy: string;
  weekly_enabled: boolean;
  weekly_amount_type: string;
  weekly_amount: number | null;
  weekly_positions: PayoutPosition[];
  overall_enabled: boolean;
  overall_positions: PayoutPosition[];
} | null): PayoutConfig {
  if (!row) return DEFAULT_PAYOUT_CONFIG;
  return {
    enabled: row.enabled,
    entryFee: row.entry_fee,
    tiePolicy: row.tie_policy as TiePolicy,
    weeklyEnabled: row.weekly_enabled,
    weeklyAmountType: row.weekly_amount_type as WeeklyAmountType,
    weeklyAmount: row.weekly_amount,
    weeklyPositions: row.weekly_positions?.length ? row.weekly_positions : DEFAULT_WEEKLY_POSITIONS,
    overallEnabled: row.overall_enabled,
    overallPositions: row.overall_positions?.length ? row.overall_positions : DEFAULT_OVERALL_POSITIONS,
  };
}

/** Active participant count — used for the total-prize-pool calculation
 * (entry_fee * participants). Server-side only, so the payout UI never has
 * to reach for a client-side service-role query. */
export async function getActiveParticipantCount(poolId: string): Promise<number> {
  const supabase = getSupabaseServiceClient();
  const { count, error } = await supabase
    .from('participants')
    .select('id', { count: 'exact', head: true })
    .eq('pool_id', poolId)
    .eq('is_active', true);

  if (error) {
    debugError('Error counting participants:', error);
    return 0;
  }
  return count ?? 0;
}

/** Read-only — safe to call for any pool a viewer can already see (the
 * payout rules themselves aren't sensitive; only changing them is
 * commissioner-only, enforced in setPoolPayoutConfig). */
export async function getPoolPayoutConfig(poolId: string): Promise<PayoutConfig> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from('payout_configs')
    .select('*')
    .eq('pool_id', poolId)
    .maybeSingle();

  if (error) {
    debugError('Error loading payout config:', error);
    return DEFAULT_PAYOUT_CONFIG;
  }
  return toConfig(data);
}

export async function setPoolPayoutConfig(
  poolId: string,
  requestedBy: string,
  config: PayoutConfig
): Promise<ActionResult> {
  const owned = await requireCanManagePool(poolId, requestedBy);
  if (!owned.ok) return { success: false, error: owned.error };

  const entryFeeError = validateEntryFee(config.entryFee);
  if (entryFeeError) return { success: false, error: entryFeeError };

  if (config.weeklyEnabled) {
    const weeklyAmountError = validateWeeklyAmount(config.weeklyAmountType, config.weeklyAmount);
    if (weeklyAmountError) return { success: false, error: weeklyAmountError };
    const weeklyPositionsError = validatePayoutPositions(config.weeklyPositions);
    if (weeklyPositionsError) return { success: false, error: `Weekly payouts: ${weeklyPositionsError}` };
  }

  if (config.overallEnabled) {
    const overallPositionsError = validatePayoutPositions(config.overallPositions);
    if (overallPositionsError) return { success: false, error: `Overall payouts: ${overallPositionsError}` };
  }

  const supabase = getSupabaseServiceClient();
  const { error } = await supabase
    .from('payout_configs')
    .upsert({
      pool_id: poolId,
      enabled: config.enabled,
      entry_fee: config.entryFee,
      tie_policy: config.tiePolicy,
      weekly_enabled: config.weeklyEnabled,
      weekly_amount_type: config.weeklyAmountType,
      weekly_amount: config.weeklyAmount,
      weekly_positions: config.weeklyPositions,
      overall_enabled: config.overallEnabled,
      overall_positions: config.overallPositions,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'pool_id' });

  if (error) {
    debugError('Error saving payout config:', error);
    return { success: false, error: 'Failed to save payout settings. Please try again.' };
  }
  return { success: true, data: undefined };
}

export interface PayoutRecordInput {
  scope: 'weekly' | 'overall';
  season: number;
  /** Real week number for 'weekly' scope. Always 0 for 'overall' scope —
   * NOT null: the (pool, scope, season, week, place) unique constraint
   * can't dedupe on NULL (Postgres treats NULL <> NULL), so 'overall'
   * records use 0 as a concrete "not applicable" sentinel instead. */
  week: number;
  seasonType: number | null;
  place: number;
  participantId: string | null;
  participantName: string;
  amount: number;
}

/** Persists a freshly-calculated payout breakdown so "paid" status survives
 * a later recalculation. Upserts on the (pool, scope, season, week, place)
 * key — an existing "paid" mark is preserved unless explicitly toggled, but
 * amount/participant are refreshed to match the latest standings. */
export async function savePayoutCalculation(
  poolId: string,
  requestedBy: string,
  records: PayoutRecordInput[]
): Promise<ActionResult<{ id: string; paid: boolean }[]>> {
  const owned = await requireCanManagePool(poolId, requestedBy);
  if (!owned.ok) return { success: false, error: owned.error };

  const supabase = getSupabaseServiceClient();

  // Amount can change on recalculation (standings move); paid status must
  // not be silently reset, so upsert everything except `paid`/`paid_at`.
  const { data, error } = await supabase
    .from('payout_records')
    .upsert(
      records.map(r => ({
        pool_id: poolId,
        scope: r.scope,
        season: r.season,
        week: r.week,
        season_type: r.seasonType,
        place: r.place,
        participant_id: r.participantId,
        participant_name: r.participantName,
        amount: r.amount,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'pool_id,scope,season,week,participant_id', ignoreDuplicates: false }
    )
    .select('id, paid');

  if (error) {
    debugError('Error saving payout calculation:', error);
    return { success: false, error: 'Failed to save the payout calculation.' };
  }
  return { success: true, data: data ?? [] };
}

export async function getPayoutRecords(
  poolId: string,
  scope: 'weekly' | 'overall',
  season: number,
  week?: number
) {
  const supabase = getSupabaseServiceClient();
  let query = supabase
    .from('payout_records')
    .select('*')
    .eq('pool_id', poolId)
    .eq('scope', scope)
    .eq('season', season)
    .order('place', { ascending: true });

  if (scope === 'weekly' && week != null) query = query.eq('week', week);
  else if (scope === 'overall') query = query.eq('week', 0);

  const { data, error } = await query;
  if (error) {
    debugError('Error loading payout records:', error);
    return [];
  }
  return data ?? [];
}

/** "Mark Paid" is strictly a commissioner record — it never moves money. */
export async function markPayoutPaid(
  recordId: string,
  requestedBy: string,
  paid: boolean
): Promise<ActionResult> {
  const supabase = getSupabaseServiceClient();
  const { data: record } = await supabase
    .from('payout_records')
    .select('pool_id')
    .eq('id', recordId)
    .maybeSingle();

  if (!record) return { success: false, error: 'Payout record not found.' };

  const owned = await requireCanManagePool(record.pool_id, requestedBy);
  if (!owned.ok) return { success: false, error: owned.error };

  const { error } = await supabase
    .from('payout_records')
    .update({ paid, paid_at: paid ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq('id', recordId);

  if (error) {
    debugError('Error marking payout paid:', error);
    return { success: false, error: 'Failed to update payout status.' };
  }
  return { success: true, data: undefined };
}
