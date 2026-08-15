import { getSupabaseServiceClient } from './supabase-service';

export interface HuddleRecord {
  id: string;
  name: string;
}

/**
 * Find-or-create THE (primary/oldest) Huddle for a commissioner — used by
 * every path that predates multi-Huddle support (pool creation/capacity
 * checks, the commissioner's default /league view) and still only needs a
 * single Huddle to operate against. A Standard-plan commissioner may have
 * more than one Huddle (see loadHuddlesForCommissioner /
 * createAdditionalHuddleForCommissioner below); this always resolves to
 * their first one rather than erroring.
 */
export async function getOrCreateHuddleRecordForCommissioner(email: string): Promise<HuddleRecord> {
  const supabase = getSupabaseServiceClient();

  const { data: existing } = await supabase
    .from('huddles')
    .select('id, name')
    .eq('commissioner_email', email)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await supabase
    .from('huddles')
    .insert({ name: `${email}'s Huddle`, commissioner_email: email })
    .select('id, name')
    .single();

  if (error) throw error;
  return data;
}

/** Every Huddle a commissioner owns, oldest first. */
export async function loadHuddlesForCommissioner(email: string): Promise<HuddleRecord[]> {
  const supabase = getSupabaseServiceClient();
  const { data } = await supabase
    .from('huddles')
    .select('id, name')
    .eq('commissioner_email', email)
    .order('created_at', { ascending: true });

  return data ?? [];
}

/**
 * Inserts a new Huddle row for a commissioner who already has at least one
 * (use getOrCreateHuddleRecordForCommissioner for the first one). No
 * capacity gating here by design — this is a pure data-access helper; the
 * plan-limit check lives in the server action layer (see
 * createAdditionalHuddleForCommissioner in @/actions/huddles) to avoid a
 * circular import with lib/plan.ts, which itself depends on this file.
 */
export async function insertHuddleForCommissioner(email: string, name: string): Promise<HuddleRecord> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from('huddles')
    .insert({ name: name.trim(), commissioner_email: email })
    .select('id, name')
    .single();

  if (error) throw error;
  return data;
}
