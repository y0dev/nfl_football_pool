import { getSupabaseServiceClient } from './supabase';

// Shared resolver for the handful of places that must find an account by
// email or id without already knowing whether it belongs to a super-admin
// (admins table) or a commissioner (commissioners table) — login, session
// verification, magic link, password reset, and a few id-based self-service
// routes. See scripts/migrate-commissioners.ts: commissioner ids are
// preserved from their original admins.id, so an id that used to resolve
// against admins now resolves against commissioners instead — nobody gets
// logged out by the split.
//
// Tries admins first (a handful of rows, cheap even on a miss) then
// commissioners. Both are indexed primary-key/unique-email lookups, so the
// miss case costs one extra fast query, not a scan — no need to redesign
// the session cookie to carry a role tag just to avoid this.
//
// Most call sites in this app are NOT ambiguous — a route already knows via
// an existing guard (e.g. "reject if is_super_admin") that it only ever
// operates on one table, and should just query that table directly rather
// than going through this resolver.

export type AccountRole = 'super_admin' | 'commissioner';

export interface AccountRow {
  id: string;
  email: string;
  password_hash: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string | null;
  is_active: boolean;
  plan?: string | null;
  trial_ends_at?: string | null;
  billing_exempt?: boolean | null;
  addon_pools?: number | null;
  stripe_customer_id?: string | null;
  google_linked?: boolean | null;
  notification_preferences?: Record<string, boolean> | null;
}

export type ResolvedAccount =
  | { role: 'super_admin'; row: AccountRow }
  | { role: 'commissioner'; row: AccountRow };

export async function findAccountByEmail(email: string, opts: { activeOnly?: boolean } = {}): Promise<ResolvedAccount | null> {
  const supabase = getSupabaseServiceClient();

  let adminQuery = supabase.from('admins').select('*').eq('email', email);
  if (opts.activeOnly) adminQuery = adminQuery.eq('is_active', true);
  const { data: admin } = await adminQuery.maybeSingle();
  if (admin) return { role: 'super_admin', row: admin as AccountRow };

  let commissionerQuery = supabase.from('commissioners').select('*').eq('email', email);
  if (opts.activeOnly) commissionerQuery = commissionerQuery.eq('is_active', true);
  const { data: commissioner } = await commissionerQuery.maybeSingle();
  if (commissioner) return { role: 'commissioner', row: commissioner as AccountRow };

  return null;
}

export async function findAccountById(id: string, opts: { activeOnly?: boolean } = {}): Promise<ResolvedAccount | null> {
  const supabase = getSupabaseServiceClient();

  let adminQuery = supabase.from('admins').select('*').eq('id', id);
  if (opts.activeOnly) adminQuery = adminQuery.eq('is_active', true);
  const { data: admin } = await adminQuery.maybeSingle();
  if (admin) return { role: 'super_admin', row: admin as AccountRow };

  let commissionerQuery = supabase.from('commissioners').select('*').eq('id', id);
  if (opts.activeOnly) commissionerQuery = commissionerQuery.eq('is_active', true);
  const { data: commissioner } = await commissionerQuery.maybeSingle();
  if (commissioner) return { role: 'commissioner', row: commissioner as AccountRow };

  return null;
}

/** Updates the row in whichever table it actually lives in. */
export async function updateAccount(id: string, role: AccountRole, patch: Record<string, unknown>) {
  const supabase = getSupabaseServiceClient();
  const table = role === 'super_admin' ? 'admins' : 'commissioners';
  return supabase.from(table).update(patch).eq('id', id);
}
