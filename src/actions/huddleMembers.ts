'use server';

import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { validateEmail } from '@/lib/email-validation';
import { debugError, isDummyData, DUMMY_HUDDLE_MEMBERS } from '@/lib/utils';
import { addParticipantToPool } from '@/actions/adminActions';

export interface HuddleMember {
  id: string;
  name: string;
  email: string | null;
  poolIds: string[];
}

export async function loadHuddleMembers(huddleId: string): Promise<HuddleMember[]> {
  if (isDummyData()) return DUMMY_HUDDLE_MEMBERS;

  const supabase = getSupabaseServiceClient();

  const { data: members, error } = await supabase
    .from('huddle_members')
    .select('id, name, email')
    .eq('huddle_id', huddleId)
    .eq('is_active', true)
    .order('name');

  if (error) {
    debugError('Failed to load huddle members:', error);
    return [];
  }
  if (!members || members.length === 0) return [];

  const { data: assignments } = await supabase
    .from('participants')
    .select('huddle_member_id, pool_id')
    .in('huddle_member_id', members.map(m => m.id))
    .eq('is_active', true);

  const poolsByMember = new Map<string, string[]>();
  for (const row of assignments ?? []) {
    if (!row.huddle_member_id) continue;
    const list = poolsByMember.get(row.huddle_member_id) ?? [];
    list.push(row.pool_id);
    poolsByMember.set(row.huddle_member_id, list);
  }

  return members.map(m => ({
    id: m.id,
    name: m.name,
    email: m.email,
    poolIds: poolsByMember.get(m.id) ?? [],
  }));
}

export type AddHuddleMemberResult =
  | { success: true; member: HuddleMember }
  | { success: false; error: string };

export async function addHuddleMember(huddleId: string, name: string, email?: string): Promise<AddHuddleMemberResult> {
  try {
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      return { success: false, error: 'Name must be at least 2 characters.' };
    }

    // Email is optional — a commissioner can add someone with no email and
    // notify them manually. Only validate/dedup by email when one is given.
    let trimmedEmail: string | null = null;
    if (email?.trim()) {
      const emailCheck = validateEmail(email);
      if (!emailCheck.valid) {
        return { success: false, error: emailCheck.error ?? 'Invalid email address.' };
      }
      trimmedEmail = email.trim().toLowerCase();
    }

    const supabase = getSupabaseServiceClient();

    if (trimmedEmail) {
      const { data: existing } = await supabase
        .from('huddle_members')
        .select('id')
        .eq('huddle_id', huddleId)
        .eq('email', trimmedEmail)
        .maybeSingle();

      if (existing) {
        return { success: false, error: 'This person is already in your League.' };
      }
    }

    const { data, error } = await supabase
      .from('huddle_members')
      .insert({ huddle_id: huddleId, name: trimmedName, email: trimmedEmail })
      .select('id, name, email')
      .single();

    if (error) {
      debugError('Failed to add huddle member:', error);
      return { success: false, error: 'Failed to add member. Please try again.' };
    }

    return { success: true, member: { ...data, poolIds: [] } };
  } catch (error) {
    debugError('Unexpected error adding huddle member:', error);
    return { success: false, error: 'An unexpected error occurred. Please try again.' };
  }
}

export async function removeHuddleMember(huddleMemberId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabaseServiceClient();
    const { error } = await supabase
      .from('huddle_members')
      .update({ is_active: false })
      .eq('id', huddleMemberId);

    if (error) {
      debugError('Failed to remove huddle member:', error);
      return { success: false, error: 'Failed to remove member. Please try again.' };
    }
    return { success: true };
  } catch (error) {
    debugError('Unexpected error removing huddle member:', error);
    return { success: false, error: 'An unexpected error occurred. Please try again.' };
  }
}

export type AddHuddleMemberToPoolResult =
  | { success: true }
  | { success: false; error: string };

/** Adds an existing League roster member into a specific pool, reusing the
 * shared participant-add path (plan limits, welcome email, audit log) and
 * stamping huddle_member_id so the roster UI knows they're already in it. */
export async function addHuddleMemberToPool(huddleMemberId: string, poolId: string): Promise<AddHuddleMemberToPoolResult> {
  try {
    const supabase = getSupabaseServiceClient();
    const { data: member, error } = await supabase
      .from('huddle_members')
      .select('name, email')
      .eq('id', huddleMemberId)
      .single();

    if (error || !member) {
      return { success: false, error: 'League member not found.' };
    }

    await addParticipantToPool(poolId, member.name, member.email ?? undefined, huddleMemberId);
    return { success: true };
  } catch (error) {
    debugError('Failed to add huddle member to pool:', error);
    const message = error instanceof Error ? error.message : 'Failed to add member to pool.';
    return { success: false, error: message };
  }
}
