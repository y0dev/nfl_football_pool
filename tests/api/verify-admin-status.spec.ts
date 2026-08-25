import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

// ─────────────────────────────────────────────────────────────
// /api/admin/verify-status — server-only admin status lookup.
//
// This route used to trust a client-supplied `adminId` query param with no
// verification at all — the client read its own id from localStorage
// (editable via devtools) and sent it here, so anyone could claim to be any
// other admin/commissioner's id and be told "yes, you're an admin" (and, for
// a super admin id, "yes, you're a super admin"). That response fed
// verifyAdminStatus() directly into React state, so this was a full client-
// side identity forgery, not just an info leak.
//
// The fix: identity is resolved from the httpOnly sh-session cookie only.
// The query param is now ignored entirely — these tests assert that
// explicitly, not just that the route still "works."
// ─────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY!
);

const SUPER_ADMIN_EMAIL = 'superadmin@test.com';
const COMMISSIONER_EMAIL = 'pooladmin@test.com';
let superAdminId: string;
let commissionerId: string;

test.beforeAll(async () => {
  const { data: superAdmin, error: superAdminError } = await supabase.from('admins').select('id').eq('email', SUPER_ADMIN_EMAIL).single();
  if (superAdminError || !superAdmin) throw new Error(`Could not find seeded super admin: ${superAdminError?.message}`);
  superAdminId = superAdmin.id;

  const { data: commissioner, error: commissionerError } = await supabase.from('commissioners').select('id').eq('email', COMMISSIONER_EMAIL).single();
  if (commissionerError || !commissioner) throw new Error(`Could not find seeded commissioner: ${commissionerError?.message}`);
  commissionerId = commissioner.id;
});

test.describe('GET /api/admin/verify-status', () => {
  test('returns isAdmin: false with no session and no query param', async ({ request }) => {
    const res = await request.get('/api/admin/verify-status');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true, isAdmin: false, isSuperAdmin: false });
  });

  test('a spoofed adminId query param, with no session cookie, grants nothing', async ({ request }) => {
    // The exact vulnerability this route used to have: claiming to be a
    // real super admin's id via the query param alone must not work.
    const res = await request.get(`/api/admin/verify-status?adminId=${superAdminId}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true, isAdmin: false, isSuperAdmin: false });
  });

  test('a session cookie for a nonexistent id returns isAdmin: false', async ({ request }) => {
    const res = await request.get('/api/admin/verify-status', {
      headers: { Cookie: 'sh-session=00000000-0000-0000-0000-000000000000' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true, isAdmin: false, isSuperAdmin: false });
  });

  test('a real super admin session reports isAdmin and isSuperAdmin true', async ({ request }) => {
    const res = await request.get('/api/admin/verify-status', {
      headers: { Cookie: `sh-session=${superAdminId}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true, isAdmin: true, isSuperAdmin: true });
  });

  test('a real commissioner session reports isAdmin true, isSuperAdmin false — even with a spoofed super-admin adminId param', async ({ request }) => {
    const res = await request.get(`/api/admin/verify-status?adminId=${superAdminId}`, {
      headers: { Cookie: `sh-session=${commissionerId}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true, isAdmin: true, isSuperAdmin: false });
  });
});
