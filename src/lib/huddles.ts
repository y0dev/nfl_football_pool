import { getSupabaseServiceClient } from './supabase';

/**
 * Find-or-create the Huddle for a commissioner. Every commissioner has
 * exactly one Huddle today (docs/migrations/add-huddles-backfill.sql created
 * one per existing commissioner); this keeps that invariant for commissioners
 * created after that backfill ran.
 */
export async function getOrCreateHuddleForCommissioner(email: string): Promise<string> {
  const supabase = getSupabaseServiceClient();

  const { data: existing } = await supabase
    .from('huddles')
    .select('id')
    .eq('commissioner_email', email)
    .maybeSingle();

  if (existing) return existing.id;

  const { data, error } = await supabase
    .from('huddles')
    .insert({ name: `${email}'s Huddle`, commissioner_email: email })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}
