import { getSupabaseServiceClient } from './supabase-service';
import { NextResponse, type NextRequest } from 'next/server';

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

// Self-service account routes (account-type, unlink-google, set-password,
// change-password, notification-preferences, ...) take `adminId` as a plain
// request parameter — that's fine for READING non-sensitive data scoped to
// a page the client already knows its own id for, but every one of those
// routes previously trusted it completely for WRITES too, with nothing
// checking that the caller is actually signed in as that id. Any request
// carrying someone else's adminId (leaked, guessed, or just typed into
// devtools) could flip their google_linked flag, set a password on their
// Google-only account, or read their auth state — a full account-takeover
// path, not just an info leak. The one server-side fact that can't be
// spoofed from the request body is the httpOnly sh-session cookie set at
// login (src/actions/sessionCookie.ts for password login,
// src/app/auth/callback/route.ts's buildSessionRedirect for OAuth) — so
// self-service routes must check the caller's session actually IS the
// account they're asking to modify, not just that the id resolves to some
// active account.
export function callerOwnsAccount(request: NextRequest, adminId: string): boolean {
  const sessionId = request.cookies.get('sh-session')?.value;
  return !!sessionId && sessionId === adminId;
}

// Shared caller-is-an-active-super-admin check for admin-privileged (not
// self-service) routes — data-management operations like NFL sync, season
// game import/rollback, commissioner management, etc. Trusts the
// x-admin-email header, matching the established pattern across every other
// super-admin route in this app (see e.g. src/app/api/super-admin/admins/route.ts) —
// not a new mechanism. Several routes in this exact family (nfl-sync,
// season-games submit/rollback) previously had no auth check at all.
export async function requireSuperAdmin(request: NextRequest): Promise<
  { ok: true; email: string; id: string } | { ok: false; response: NextResponse }
> {
  const adminEmail = request.headers.get('x-admin-email');
  if (!adminEmail) {
    return { ok: false, response: NextResponse.json({ success: false, error: 'No admin email header' }, { status: 401 }) };
  }

  const supabase = getSupabaseServiceClient();
  const { data: caller } = await supabase
    .from('admins')
    .select('id, is_super_admin')
    .eq('email', adminEmail)
    .eq('is_active', true)
    .maybeSingle();

  if (!caller?.is_super_admin) {
    return { ok: false, response: NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 }) };
  }

  return { ok: true, email: adminEmail, id: caller.id };
}
