'use server';

import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { getOrCreateHuddleRecordForCommissioner, loadHuddlesForCommissioner, insertHuddleForCommissioner, HuddleRecord } from '@/lib/huddles';
import { checkHuddleCapacity } from '@/lib/plan';
import { debugError, isDummyData, DUMMY_HUDDLE } from '@/lib/utils';

export async function loadHuddleForCommissioner(email: string): Promise<HuddleRecord> {
  if (isDummyData()) return DUMMY_HUDDLE;
  return getOrCreateHuddleRecordForCommissioner(email);
}

export interface CommissionerHuddleSummary {
  id: string;
  name: string;
  poolCount: number;
}

/** Every Huddle a commissioner owns, oldest first, with each one's pool
 * count — backs the "My Huddles" list page. */
export async function loadAllHuddlesForCommissioner(email: string): Promise<CommissionerHuddleSummary[]> {
  if (isDummyData()) return [{ id: DUMMY_HUDDLE.id, name: DUMMY_HUDDLE.name, poolCount: 1 }];

  const huddles = await loadHuddlesForCommissioner(email);
  if (huddles.length === 0) return [];

  const supabase = getSupabaseServiceClient();
  const { data: pools } = await supabase
    .from('pools')
    .select('huddle_id')
    .in('huddle_id', huddles.map(h => h.id));

  const poolCountByHuddle = new Map<string, number>();
  for (const p of pools ?? []) {
    if (!p.huddle_id) continue;
    poolCountByHuddle.set(p.huddle_id, (poolCountByHuddle.get(p.huddle_id) ?? 0) + 1);
  }

  return huddles.map(h => ({ id: h.id, name: h.name, poolCount: poolCountByHuddle.get(h.id) ?? 0 }));
}

/** Look up a single Huddle by id, scoped to its owning commissioner — backs
 * /league/[huddleId]. Returns null if it doesn't exist or belongs to
 * someone else, so the page can 404 rather than leak another commissioner's
 * Huddle by id guessing. */
export async function loadOwnedHuddleForCommissioner(huddleId: string, email: string): Promise<HuddleRecord | null> {
  if (isDummyData()) return DUMMY_HUDDLE;

  const supabase = getSupabaseServiceClient();
  const { data } = await supabase
    .from('huddles')
    .select('id, name')
    .eq('id', huddleId)
    .eq('commissioner_email', email)
    .maybeSingle();

  return data ?? null;
}

export type CreateAdditionalHuddleResult =
  | { success: true; huddle: HuddleRecord }
  | { success: false; error: string };

/** Creates a new, additional Huddle for a commissioner, gated by their
 * plan's Huddle limit (Free: 1, Standard: up to 3). */
export async function createAdditionalHuddleForCommissioner(email: string, name: string): Promise<CreateAdditionalHuddleResult> {
  const trimmed = name.trim();
  if (trimmed.length < 3) {
    return { success: false, error: 'League name must be at least 3 characters.' };
  }

  const capacity = await checkHuddleCapacity(email);
  if (!capacity.allowed) {
    return { success: false, error: capacity.message ?? 'Huddle limit reached.' };
  }

  try {
    const huddle = await insertHuddleForCommissioner(email, trimmed);
    return { success: true, huddle };
  } catch (error) {
    debugError('Failed to create additional huddle:', error);
    return { success: false, error: 'Failed to create Huddle. Please try again.' };
  }
}

export type RenameHuddleResult =
  | { success: true }
  | { success: false; error: string };

export interface LeagueDirectoryEntry {
  id: string;
  name: string;
  commissionerEmail: string;
  poolCount: number;
  isActive: boolean;
}

async function verifySuperAdmin(callerEmail: string): Promise<boolean> {
  const supabase = getSupabaseServiceClient();
  const { data: caller } = await supabase
    .from('admins')
    .select('is_super_admin')
    .eq('email', callerEmail)
    .eq('is_active', true)
    .single();
  return caller?.is_super_admin === true;
}

/** Every League in the database (active and inactive), for super-admin
 * oversight. Gated server-side (not just by the caller's page-level guard)
 * since this is a Server Action and reachable directly. Returns an empty
 * list for non-super-admin callers. */
export async function loadAllHuddlesForSuperAdmin(callerEmail: string): Promise<LeagueDirectoryEntry[]> {
  if (!(await verifySuperAdmin(callerEmail))) return [];

  const supabase = getSupabaseServiceClient();
  const { data: huddles } = await supabase
    .from('huddles')
    .select('id, name, commissioner_email, is_active')
    .order('name');

  if (!huddles || huddles.length === 0) return [];

  const { data: pools } = await supabase
    .from('pools')
    .select('huddle_id')
    .not('huddle_id', 'is', null);

  const poolCountByHuddle = new Map<string, number>();
  for (const p of pools ?? []) {
    if (!p.huddle_id) continue;
    poolCountByHuddle.set(p.huddle_id, (poolCountByHuddle.get(p.huddle_id) ?? 0) + 1);
  }

  return huddles.map(h => ({
    id: h.id,
    name: h.name,
    commissionerEmail: h.commissioner_email,
    poolCount: poolCountByHuddle.get(h.id) ?? 0,
    isActive: h.is_active,
  }));
}

/** Look up a single League by id, super-admin only — backs the
 * /admin/league/[id] management page. Returns null if the caller isn't a
 * super admin or the League doesn't exist. */
export async function loadHuddleById(huddleId: string, callerEmail: string): Promise<LeagueDirectoryEntry | null> {
  if (!(await verifySuperAdmin(callerEmail))) return null;

  const supabase = getSupabaseServiceClient();
  const { data: huddle } = await supabase
    .from('huddles')
    .select('id, name, commissioner_email, is_active')
    .eq('id', huddleId)
    .maybeSingle();

  if (!huddle) return null;

  const { count } = await supabase
    .from('pools')
    .select('id', { count: 'exact', head: true })
    .eq('huddle_id', huddleId);

  return {
    id: huddle.id,
    name: huddle.name,
    commissionerEmail: huddle.commissioner_email,
    poolCount: count ?? 0,
    isActive: huddle.is_active,
  };
}

export type SetHuddleActiveResult =
  | { success: true }
  | { success: false; error: string };

/** Activate/deactivate a League, super-admin only. */
export async function setHuddleActive(huddleId: string, isActive: boolean, callerEmail: string): Promise<SetHuddleActiveResult> {
  try {
    if (!(await verifySuperAdmin(callerEmail))) {
      return { success: false, error: 'Insufficient permissions.' };
    }

    const supabase = getSupabaseServiceClient();
    const { error } = await supabase
      .from('huddles')
      .update({ is_active: isActive })
      .eq('id', huddleId);

    if (error) {
      debugError('Failed to update huddle active state:', error);
      return { success: false, error: 'Failed to update League status. Please try again.' };
    }

    return { success: true };
  } catch (error) {
    debugError('Unexpected error updating huddle active state:', error);
    return { success: false, error: 'An unexpected error occurred. Please try again.' };
  }
}

export type DeleteHuddleResult =
  | { success: true; poolsDeleted: number }
  | { success: false; error: string };

/**
 * Permanently deletes a Huddle — commissioner-owner only.
 *
 * By default refuses if the Huddle still has any pools: pools.huddle_id is
 * ON DELETE SET NULL (not CASCADE) specifically so deleting a Huddle never
 * silently deletes or orphans a pool's picks/scores history — the
 * commissioner has to transfer or delete each pool first.
 *
 * If cascadeDeletePools is true, every pool in the Huddle is deleted first
 * instead. Every pool-related table (participants, picks, scores,
 * tie_breakers, weekly/season/period winners, playoff confidence points,
 * reminder logs, transfer requests, admin_pools) is already
 * ON DELETE CASCADE on pools.id, so deleting the pool rows is sufficient —
 * no per-table cleanup needed here.
 *
 * huddle_members and huddle_transfer_requests always cascade-delete with
 * the Huddle itself, regardless of this flag.
 */
export async function deleteHuddle(huddleId: string, callerEmail: string, cascadeDeletePools = false): Promise<DeleteHuddleResult> {
  try {
    const supabase = getSupabaseServiceClient();

    const { data: huddle } = await supabase
      .from('huddles')
      .select('id, name, commissioner_email')
      .eq('id', huddleId)
      .maybeSingle();

    if (!huddle || huddle.commissioner_email.toLowerCase() !== callerEmail.trim().toLowerCase()) {
      return { success: false, error: 'Huddle not found for your account.' };
    }

    const { count: poolCount } = await supabase
      .from('pools')
      .select('id', { count: 'exact', head: true })
      .eq('huddle_id', huddleId);

    if ((poolCount ?? 0) > 0 && !cascadeDeletePools) {
      return {
        success: false,
        error: `"${huddle.name}" still has ${poolCount} pool${poolCount === 1 ? '' : 's'}. Transfer or delete ${poolCount === 1 ? 'it' : 'them'} first, or check "also delete its pools".`,
      };
    }

    if ((poolCount ?? 0) > 0 && cascadeDeletePools) {
      const { error: poolsDeleteError } = await supabase.from('pools').delete().eq('huddle_id', huddleId);
      if (poolsDeleteError) {
        debugError('Failed to cascade-delete huddle pools:', poolsDeleteError);
        return { success: false, error: 'Failed to delete this League\'s pools. Please try again.' };
      }
    }

    const { error } = await supabase.from('huddles').delete().eq('id', huddleId);

    if (error) {
      debugError('Failed to delete huddle:', error);
      return { success: false, error: 'Failed to delete League. Please try again.' };
    }

    return { success: true, poolsDeleted: cascadeDeletePools ? (poolCount ?? 0) : 0 };
  } catch (error) {
    debugError('Unexpected error deleting huddle:', error);
    return { success: false, error: 'An unexpected error occurred. Please try again.' };
  }
}

export async function renameHuddle(huddleId: string, name: string): Promise<RenameHuddleResult> {
  try {
    const trimmed = name.trim();
    if (trimmed.length < 3) {
      return { success: false, error: 'League name must be at least 3 characters.' };
    }

    const supabase = getSupabaseServiceClient();
    const { error } = await supabase
      .from('huddles')
      .update({ name: trimmed })
      .eq('id', huddleId);

    if (error) {
      debugError('Failed to rename huddle:', error);
      return { success: false, error: 'Failed to rename League. Please try again.' };
    }

    return { success: true };
  } catch (error) {
    debugError('Unexpected error renaming huddle:', error);
    return { success: false, error: 'An unexpected error occurred. Please try again.' };
  }
}
