import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

// ─────────────────────────────────────────────────────────────
// Super-admin management routes (/api/admin/reset-password,
// /api/admin/reset-admin-password, /api/admin/delete-admin, and the
// /api/super-admin/* siblings) previously had NO server-side authorization
// at all — any caller, logged in or not, could list every account
// (including password hashes), reset any commissioner's OR super admin's
// password, or delete any commissioner. Chained together (list admins to
// get a super admin's id, then reset-admin-password with that id) this was
// a full unauthenticated platform takeover, not just an IDOR.
//
// A first fix layered an x-admin-email header check on top — but the header
// is set by the client from its own React state, so any request carrying a
// known admin's email (leaked, guessed, or just typed into devtools) was
// treated as that admin with zero credentials. That's what these tests
// actually asserted before this pass.
//
// The real fix: every route below now resolves the caller from the httpOnly
// sh-session cookie (set server-side at login), never from a client-supplied
// header. These tests assert both that the header alone grants nothing, and
// that a real session behaves correctly.
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
  const { data: superAdmin, error: superAdminError } = await supabase
    .from('admins')
    .select('id')
    .eq('email', SUPER_ADMIN_EMAIL)
    .single();
  if (superAdminError || !superAdmin) throw new Error(`Could not find seeded super admin: ${superAdminError?.message}`);
  superAdminId = superAdmin.id;

  const { data: commissioner, error: commissionerError } = await supabase
    .from('commissioners')
    .select('id')
    .eq('email', COMMISSIONER_EMAIL)
    .single();
  if (commissionerError || !commissioner) throw new Error(`Could not find seeded commissioner: ${commissionerError?.message}`);
  commissionerId = commissioner.id;
});

function sessionCookieFor(id: string) {
  return { Cookie: `sh-session=${id}` };
}

const UNAUTHENTICATED_CASES: { name: string; method: 'GET' | 'POST' | 'DELETE'; url: string; data?: object }[] = [
  { name: 'GET /api/super-admin/admins', method: 'GET', url: '/api/super-admin/admins' },
  { name: 'POST /api/admin/reset-password', method: 'POST', url: '/api/admin/reset-password', data: { adminId: '00000000-0000-0000-0000-000000000000', newPassword: 'irrelevant123' } },
  { name: 'POST /api/admin/reset-admin-password', method: 'POST', url: '/api/admin/reset-admin-password', data: { adminId: '00000000-0000-0000-0000-000000000000', newPassword: 'irrelevant123' } },
  { name: 'DELETE /api/admin/delete-admin', method: 'DELETE', url: '/api/admin/delete-admin', data: { adminId: '00000000-0000-0000-0000-000000000000' } },
  { name: 'POST /api/super-admin/toggle-status', method: 'POST', url: '/api/super-admin/toggle-status', data: { adminId: '00000000-0000-0000-0000-000000000000', isActive: true } },
  { name: 'DELETE /api/super-admin/delete-admin', method: 'DELETE', url: '/api/super-admin/delete-admin', data: { adminId: '00000000-0000-0000-0000-000000000000' } },
  { name: 'POST /api/super-admin/reset-password', method: 'POST', url: '/api/super-admin/reset-password', data: { adminId: '00000000-0000-0000-0000-000000000000', newPassword: 'irrelevant123' } },
];

async function callCase(request: import('@playwright/test').APIRequestContext, c: typeof UNAUTHENTICATED_CASES[number], headers?: Record<string, string>) {
  return c.method === 'GET'
    ? request.get(c.url, { headers })
    : c.method === 'POST'
    ? request.post(c.url, { data: c.data, headers })
    : request.delete(c.url, { data: c.data, headers });
}

test.describe('Super-admin management routes reject requests with no real session', () => {
  for (const c of UNAUTHENTICATED_CASES) {
    test(`${c.name} → 401 with nothing at all`, async ({ request }) => {
      const res = await callCase(request, c);
      expect(res.status()).toBe(401);
    });

    test(`${c.name} → 401 even with a spoofed x-admin-email header and no session cookie`, async ({ request }) => {
      // This is the exact vulnerability this suite exists to catch: the
      // header alone must never be sufficient, no matter whose email it
      // names, because it's fully attacker-controlled.
      const res = await callCase(request, c, { 'x-admin-email': SUPER_ADMIN_EMAIL });
      expect(res.status()).toBe(401);
    });

    test(`${c.name} → 403 for a real session that is not a super admin`, async ({ request }) => {
      const res = await callCase(request, c, sessionCookieFor(commissionerId));
      expect(res.status()).toBe(403);
    });
  }
});

test.describe('GET /api/super-admin/admins — authorized response shape', () => {
  test('a real super admin gets the list without password hashes', async ({ request }) => {
    const res = await request.get('/api/super-admin/admins', { headers: sessionCookieFor(superAdminId) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.admins)).toBe(true);
    expect(body.admins.length).toBeGreaterThan(0);
    for (const admin of body.admins) {
      expect(admin).not.toHaveProperty('password_hash');
    }
  });
});

test.describe('POST /api/admin/reset-password — still works end-to-end for a real super admin', () => {
  test('resets a throwaway commissioner\'s password', async ({ request }) => {
    const { data: throwaway, error } = await supabase
      .from('commissioners')
      .insert({
        email: `e2e-reset-pw-${Date.now()}@sundayhuddle.test`,
        password_hash: '$2b$12$fakehashfortest00000000000000000000000000000000000000',
        full_name: 'E2E Reset Password Target',
        is_active: true,
      })
      .select('id')
      .single();
    if (error || !throwaway) throw new Error(`seed failed: ${error?.message}`);

    try {
      const res = await request.post('/api/admin/reset-password', {
        headers: sessionCookieFor(superAdminId),
        data: { adminId: throwaway.id, newPassword: 'a-brand-new-password-1' },
      });
      expect(res.status()).toBe(200);

      const { data: row } = await supabase.from('commissioners').select('password_hash').eq('id', throwaway.id).single();
      expect(row?.password_hash).not.toBe('$2b$12$fakehashfortest00000000000000000000000000000000000000');
    } finally {
      await supabase.from('commissioners').delete().eq('id', throwaway.id);
    }
  });
});
