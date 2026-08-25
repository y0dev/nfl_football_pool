import { getSupabaseServiceClient } from './supabase-service';
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';

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

// Shared caller-identity check for admin-privileged (not self-service)
// routes — data-management operations like NFL sync, season game
// import/rollback, commissioner management, dashboard data, etc.
//
// Resolves identity from the httpOnly sh-session cookie (set at login by
// loginUser/magicLink, and by /auth/callback for OAuth — see
// callerOwnsAccount's comment above for why this is the only server-side
// fact that can't be spoofed from the request). This replaces the previous
// x-admin-email-header-trust pattern that was copied inline into ~25 routes:
// the header is set by the client from its own React state / localStorage,
// so any request carrying someone else's real admin/commissioner email —
// leaked, guessed, or just typed into devtools — was treated as that person,
// no password required. The client may still send x-admin-email for logging
// or backward compatibility, but it is never trusted for authorization here.
//
// Use requireActiveAdmin for routes any active admin or commissioner may
// call (it also tells you which); use requireSuperAdmin for routes that
// must be restricted to super admins specifically.
export async function requireActiveAdmin(request: NextRequest): Promise<
  { ok: true; email: string; id: string; isSuperAdmin: boolean } | { ok: false; response: NextResponse }
> {
  const sessionId = request.cookies.get('sh-session')?.value;
  if (!sessionId) {
    return { ok: false, response: NextResponse.json({ success: false, error: 'Not signed in' }, { status: 401 }) };
  }

  const account = await findAccountById(sessionId, { activeOnly: true });
  if (!account) {
    return { ok: false, response: NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 }) };
  }

  return { ok: true, email: account.row.email, id: account.row.id, isSuperAdmin: account.role === 'super_admin' };
}

export async function requireSuperAdmin(request: NextRequest): Promise<
  { ok: true; email: string; id: string } | { ok: false; response: NextResponse }
> {
  const result = await requireActiveAdmin(request);
  if (!result.ok) return result;

  if (!result.isSuperAdmin) {
    return { ok: false, response: NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 }) };
  }

  return { ok: true, email: result.email, id: result.id };
}

// Server Action equivalent of requireActiveAdmin/requireSuperAdmin — 'use
// server' actions don't receive a NextRequest, but can read the incoming
// request's cookies via next/headers, which is where sh-session lives.
// Used by Server Actions that mutate a specific pool (updatePool,
// addParticipantToPool, etc.) which previously trusted a client-supplied
// poolId/participantId with no check that the caller actually administers
// that pool at all.
export async function requireActionCallerOwnsPool(poolId: string): Promise<
  { ok: true; email: string; id: string; isSuperAdmin: boolean } | { ok: false; error: string }
> {
  // cookies() throws if called with no active request at all (e.g. a script
  // invoking this function directly, outside Next's request lifecycle) —
  // real callers (a browser's Server Action RPC, or a Route Handler) always
  // have a request scope, so this only ever triggers for something that
  // was never a legitimate authenticated call in the first place. Fail
  // closed rather than let the exception propagate as a raw 500.
  let jar;
  try {
    jar = await cookies();
  } catch {
    return { ok: false, error: 'Not signed in.' };
  }
  const sessionId = jar.get('sh-session')?.value;
  if (!sessionId) return { ok: false, error: 'Not signed in.' };

  const caller = await findAccountById(sessionId, { activeOnly: true });
  if (!caller) return { ok: false, error: 'Not signed in.' };
  if (caller.role === 'super_admin') {
    return { ok: true, email: caller.row.email, id: caller.row.id, isSuperAdmin: true };
  }

  const supabase = getSupabaseServiceClient();
  const { data: pool } = await supabase.from('pools').select('created_by').eq('id', poolId).maybeSingle();
  if (!pool) return { ok: false, error: 'Pool not found.' };
  if (pool.created_by !== caller.row.email) return { ok: false, error: 'Insufficient permissions.' };

  return { ok: true, email: caller.row.email, id: caller.row.id, isSuperAdmin: false };
}
