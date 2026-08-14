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
// These tests assert the fix: every route below now requires an
// x-admin-email header that resolves to an ACTIVE super admin, verified
// server-side against the admins table — not trusted from the header alone.
// ─────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY!
);

const SUPER_ADMIN_EMAIL = 'superadmin@test.com';
const COMMISSIONER_EMAIL = 'pooladmin@test.com';

const UNAUTHENTICATED_CASES: { name: string; method: 'GET' | 'POST' | 'DELETE'; url: string; data?: object }[] = [
  { name: 'GET /api/super-admin/admins', method: 'GET', url: '/api/super-admin/admins' },
  { name: 'POST /api/admin/reset-password', method: 'POST', url: '/api/admin/reset-password', data: { adminId: '00000000-0000-0000-0000-000000000000', newPassword: 'irrelevant123' } },
  { name: 'POST /api/admin/reset-admin-password', method: 'POST', url: '/api/admin/reset-admin-password', data: { adminId: '00000000-0000-0000-0000-000000000000', newPassword: 'irrelevant123' } },
  { name: 'DELETE /api/admin/delete-admin', method: 'DELETE', url: '/api/admin/delete-admin', data: { adminId: '00000000-0000-0000-0000-000000000000' } },
  { name: 'POST /api/super-admin/toggle-status', method: 'POST', url: '/api/super-admin/toggle-status', data: { adminId: '00000000-0000-0000-0000-000000000000', isActive: true } },
  { name: 'DELETE /api/super-admin/delete-admin', method: 'DELETE', url: '/api/super-admin/delete-admin', data: { adminId: '00000000-0000-0000-0000-000000000000' } },
  { name: 'POST /api/super-admin/reset-password', method: 'POST', url: '/api/super-admin/reset-password', data: { adminId: '00000000-0000-0000-0000-000000000000', newPassword: 'irrelevant123' } },
];

test.describe('Super-admin management routes reject requests with no admin identity', () => {
  for (const c of UNAUTHENTICATED_CASES) {
    test(`${c.name} → 401 with no x-admin-email header`, async ({ request }) => {
      const res = c.method === 'GET'
        ? await request.get(c.url)
        : c.method === 'POST'
        ? await request.post(c.url, { data: c.data })
        : await request.delete(c.url, { data: c.data });
      expect(res.status()).toBe(401);
    });

    test(`${c.name} → 403 for a caller who is not a super admin`, async ({ request }) => {
      const headers = { 'x-admin-email': COMMISSIONER_EMAIL };
      const res = c.method === 'GET'
        ? await request.get(c.url, { headers })
        : c.method === 'POST'
        ? await request.post(c.url, { data: c.data, headers })
        : await request.delete(c.url, { data: c.data, headers });
      expect(res.status()).toBe(403);
    });
  }
});

test.describe('GET /api/super-admin/admins — authorized response shape', () => {
  test('a real super admin gets the list without password hashes', async ({ request }) => {
    const res = await request.get('/api/super-admin/admins', { headers: { 'x-admin-email': SUPER_ADMIN_EMAIL } });
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
        headers: { 'x-admin-email': SUPER_ADMIN_EMAIL },
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
