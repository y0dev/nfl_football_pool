import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

// ─────────────────────────────────────────────────────────────
// Development-only Super Admin password reset
// (src/app/api/admin/dev-reset-password/route.ts, the "Development Tools"
// card on src/app/admin/account/page.tsx).
//
// This suite runs against the dev server (npm run test uses NODE_ENV
// development), so it covers everything reachable in that environment:
// missing/wrong master key, non-super-admin callers, and the real
// happy path against a throwaway super admin row. The production-rejection
// requirement (the route must 403 even with a correct key once
// NODE_ENV=production) was verified manually via `next build && next start`
// on a separate port — see the audit report for that session — and isn't
// re-asserted here since spinning up a second production server per test
// run isn't something this suite's real-DB pattern is set up for.
// ─────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY!
);

const SUPER_ADMIN_EMAIL = 'superadmin@test.com';
const COMMISSIONER_EMAIL = 'pooladmin@test.com';

async function seedSuperAdmin() {
  const oldHash = await bcrypt.hash('old-dev-reset-password-1', 10);
  const { data, error } = await supabase
    .from('admins')
    .insert({
      email: `e2e-dev-reset-${Date.now()}@sundayhuddle.test`,
      password_hash: oldHash,
      full_name: 'E2E Dev Reset Target',
      is_super_admin: true,
      is_active: true,
    })
    .select('id, email')
    .single();
  if (error || !data) throw new Error(`seed failed: ${error?.message}`);
  return data;
}

async function cleanup(id: string) {
  await supabase.from('admins').delete().eq('id', id);
}

test.describe('POST /api/admin/dev-reset-password', () => {
  test('rejects with no x-admin-email header', async ({ request }) => {
    const res = await request.post('/api/admin/dev-reset-password', {
      data: { masterKey: 'whatever', newPassword: 'irrelevant123' },
    });
    expect(res.status()).toBe(401);
  });

  test('rejects a non-super-admin caller', async ({ request }) => {
    const res = await request.post('/api/admin/dev-reset-password', {
      headers: { 'x-admin-email': COMMISSIONER_EMAIL },
      data: { masterKey: 'whatever', newPassword: 'irrelevant123' },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/permissions/i);
  });

  test('rejects a wrong master key for a real super admin, with a generic error', async ({ request }) => {
    const res = await request.post('/api/admin/dev-reset-password', {
      headers: { 'x-admin-email': SUPER_ADMIN_EMAIL },
      data: { masterKey: 'definitely-not-the-real-key', newPassword: 'irrelevant123' },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  test('rejects a password shorter than 8 characters even with the right key', async ({ request }) => {
    const res = await request.post('/api/admin/dev-reset-password', {
      headers: { 'x-admin-email': SUPER_ADMIN_EMAIL },
      data: { masterKey: process.env.DEV_MASTER_KEY, newPassword: 'short' },
    });
    expect(res.status()).toBe(400);
  });

  test('resets the caller\'s own password with a valid key, and never a client-supplied target', async ({ request }) => {
    test.skip(!process.env.DEV_MASTER_KEY, 'DEV_MASTER_KEY not set in this environment');

    const admin = await seedSuperAdmin();
    try {
      const res = await request.post('/api/admin/dev-reset-password', {
        headers: { 'x-admin-email': admin.email },
        // adminId deliberately omitted from the payload — the route has no
        // such parameter; the target is derived only from x-admin-email.
        data: { masterKey: process.env.DEV_MASTER_KEY, newPassword: 'a-brand-new-dev-password-1' },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      // Master key must never be echoed back
      expect(JSON.stringify(body)).not.toContain(process.env.DEV_MASTER_KEY);

      const { data: row } = await supabase.from('admins').select('password_hash').eq('id', admin.id).single();
      const matchesNew = await bcrypt.compare('a-brand-new-dev-password-1', row!.password_hash);
      const matchesOld = await bcrypt.compare('old-dev-reset-password-1', row!.password_hash);
      expect(matchesNew).toBe(true);
      expect(matchesOld).toBe(false);

      // Audit trail — outcome recorded, key/password never present anywhere in it
      const { data: logs } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('action', 'dev_master_key_password_reset')
        .eq('admin_id', admin.id)
        .order('created_at', { ascending: false })
        .limit(1);
      expect(logs?.[0]?.details?.outcome).toBe('success');
      expect(JSON.stringify(logs)).not.toContain(process.env.DEV_MASTER_KEY);
      expect(JSON.stringify(logs)).not.toContain('a-brand-new-dev-password-1');
    } finally {
      await cleanup(admin.id);
    }
  });

  test('rate-limits repeated wrong-key attempts for the same caller', async ({ request }) => {
    const admin = await seedSuperAdmin();
    try {
      let lastStatus = 0;
      for (let i = 0; i < 6; i++) {
        const res = await request.post('/api/admin/dev-reset-password', {
          headers: { 'x-admin-email': admin.email },
          data: { masterKey: 'wrong-key-attempt', newPassword: 'irrelevant123' },
        });
        lastStatus = res.status();
      }
      expect(lastStatus).toBe(429);

      const { data: logs } = await supabase
        .from('audit_logs')
        .select('details')
        .eq('action', 'dev_master_key_password_reset')
        .eq('admin_id', admin.id);
      expect(logs?.some(l => l.details?.outcome === 'invalid_key')).toBe(true);
    } finally {
      await cleanup(admin.id);
    }
  });
});

test.describe('GET /api/admin/dev-key-status', () => {
  test('rejects with no x-admin-email header', async ({ request }) => {
    const res = await request.get('/api/admin/dev-key-status');
    expect(res.status()).toBe(401);
  });

  test('rejects a non-super-admin caller', async ({ request }) => {
    const res = await request.get('/api/admin/dev-key-status', {
      headers: { 'x-admin-email': COMMISSIONER_EMAIL },
    });
    expect(res.status()).toBe(403);
  });

  test('reports configured/age without ever exposing the key value', async ({ request }) => {
    const res = await request.get('/api/admin/dev-key-status', {
      headers: { 'x-admin-email': SUPER_ADMIN_EMAIL },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.configured).toBe('boolean');
    if (process.env.DEV_MASTER_KEY) {
      expect(JSON.stringify(body)).not.toContain(process.env.DEV_MASTER_KEY);
    }
  });
});
