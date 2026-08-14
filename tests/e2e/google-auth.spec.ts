import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

// ─────────────────────────────────────────────────────────────
// Google Auth / account-linking — real DB integration tests against
// /api/admin/account-type, /api/admin/unlink-google and
// /api/admin/set-password. These three routes are the entire surface
// Account Settings (src/app/admin/account/page.tsx) uses to detect and
// manage sign-in methods — they must read the actual google_linked /
// password_hash columns rather than any client-side state (see
// src/app/auth/callback/route.ts for where those columns get written).
//
// Seeds/cleans up throwaway commissioner rows directly via the service
// client, same pattern as tests/e2e/clone-pool.spec.ts.
// ─────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY!
);

async function seedCommissioner(overrides: Record<string, unknown>) {
  const email = `e2e-google-auth-${Date.now()}-${Math.random().toString(36).slice(2)}@sundayhuddle.test`;
  const { data, error } = await supabase
    .from('commissioners')
    .insert({
      email,
      full_name: 'E2E Google Auth Test',
      is_active: true,
      plan: 'free',
      ...overrides,
    })
    .select('id, email')
    .single();
  if (error || !data) throw new Error(`Failed to seed commissioner: ${error?.message}`);
  return data;
}

async function cleanup(id: string) {
  await supabase.from('commissioners').delete().eq('id', id);
}

// These routes require the caller's sh-session cookie to match the adminId
// being acted on (src/lib/accounts.ts callerOwnsAccount) — without it, any
// request carrying someone else's adminId could read or mutate their
// account. Tests below authenticate as the seeded account itself unless
// specifically testing that cross-account protection.
function sessionHeaders(id: string) {
  return { Cookie: `sh-session=${id}` };
}

test.describe('GET /api/admin/account-type — provider detection reads DB, not client state', () => {
  test('Google-only account reports googleLinked true, hasPassword false', async ({ request }) => {
    const admin = await seedCommissioner({ password_hash: 'google_oauth', google_linked: true });
    try {
      const res = await request.get(`/api/admin/account-type?adminId=${admin.id}`, { headers: sessionHeaders(admin.id) });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.googleLinked).toBe(true);
      expect(body.hasPassword).toBe(false);
    } finally {
      await cleanup(admin.id);
    }
  });

  test('password-only account reports hasPassword true, googleLinked false', async ({ request }) => {
    const admin = await seedCommissioner({ password_hash: '$2b$12$fakehashfortest00000000000000000000000000000000000000', google_linked: false });
    try {
      const res = await request.get(`/api/admin/account-type?adminId=${admin.id}`, { headers: sessionHeaders(admin.id) });
      const body = await res.json();
      expect(body.hasPassword).toBe(true);
      expect(body.googleLinked).toBe(false);
    } finally {
      await cleanup(admin.id);
    }
  });

  test('dual-method account (password + linked Google) reports both true', async ({ request }) => {
    const admin = await seedCommissioner({ password_hash: '$2b$12$fakehashfortest00000000000000000000000000000000000000', google_linked: true });
    try {
      const res = await request.get(`/api/admin/account-type?adminId=${admin.id}`, { headers: sessionHeaders(admin.id) });
      const body = await res.json();
      expect(body.hasPassword).toBe(true);
      expect(body.googleLinked).toBe(true);
    } finally {
      await cleanup(admin.id);
    }
  });

  test('pre-google_linked-column row (sentinel only) still reports googleLinked true — self-heal fallback', async ({ request }) => {
    // Rows created before the google_linked column existed only have the
    // password_hash sentinel — the account-type endpoint must not regress
    // to "Not connected" for those until the callback route's self-heal runs.
    const admin = await seedCommissioner({ password_hash: 'google_oauth', google_linked: false });
    try {
      const res = await request.get(`/api/admin/account-type?adminId=${admin.id}`, { headers: sessionHeaders(admin.id) });
      const body = await res.json();
      expect(body.googleLinked).toBe(true);
    } finally {
      await cleanup(admin.id);
    }
  });
});

test.describe('POST /api/admin/unlink-google — cannot leave an account with zero sign-in methods', () => {
  test('blocks disconnecting Google when it is the only sign-in method', async ({ request }) => {
    const admin = await seedCommissioner({ password_hash: 'google_oauth', google_linked: true });
    try {
      const res = await request.post('/api/admin/unlink-google', { data: { adminId: admin.id }, headers: sessionHeaders(admin.id) });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toMatch(/password first/i);

      // DB must be untouched
      const { data: row } = await supabase.from('commissioners').select('google_linked').eq('id', admin.id).single();
      expect(row?.google_linked).toBe(true);
    } finally {
      await cleanup(admin.id);
    }
  });

  test('allows disconnecting Google when a real password also exists', async ({ request }) => {
    const admin = await seedCommissioner({ password_hash: '$2b$12$fakehashfortest00000000000000000000000000000000000000', google_linked: true });
    try {
      const res = await request.post('/api/admin/unlink-google', { data: { adminId: admin.id }, headers: sessionHeaders(admin.id) });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);

      const { data: row } = await supabase.from('commissioners').select('google_linked').eq('id', admin.id).single();
      expect(row?.google_linked).toBe(false);
    } finally {
      await cleanup(admin.id);
    }
  });

  test('rejects disconnect when Google is not connected at all', async ({ request }) => {
    const admin = await seedCommissioner({ password_hash: '$2b$12$fakehashfortest00000000000000000000000000000000000000', google_linked: false });
    try {
      const res = await request.post('/api/admin/unlink-google', { data: { adminId: admin.id }, headers: sessionHeaders(admin.id) });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/not connected/i);
    } finally {
      await cleanup(admin.id);
    }
  });
});

test.describe('POST /api/admin/set-password — Google-only account creates its first password', () => {
  test('allows a Google-only account to set a password', async ({ request }) => {
    const admin = await seedCommissioner({ password_hash: 'google_oauth', google_linked: true });
    try {
      const res = await request.post('/api/admin/set-password', {
        data: { adminId: admin.id, newPassword: 'a-real-password-123' },
        headers: sessionHeaders(admin.id),
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);

      const { data: row } = await supabase.from('commissioners').select('password_hash').eq('id', admin.id).single();
      expect(row?.password_hash).not.toBe('google_oauth');
      expect(row?.password_hash.length).toBeGreaterThan(20);
    } finally {
      await cleanup(admin.id);
    }
  });

  test('rejects set-password when a real password already exists', async ({ request }) => {
    const admin = await seedCommissioner({ password_hash: '$2b$12$fakehashfortest00000000000000000000000000000000000000', google_linked: false });
    try {
      const res = await request.post('/api/admin/set-password', {
        data: { adminId: admin.id, newPassword: 'another-password-123' },
        headers: sessionHeaders(admin.id),
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/already has a password/i);
    } finally {
      await cleanup(admin.id);
    }
  });
});

test.describe('Self-service account routes reject requests for another account (IDOR)', () => {
  test('account-type refuses a caller whose session does not match the requested adminId', async ({ request }) => {
    const victim = await seedCommissioner({ password_hash: 'google_oauth', google_linked: true });
    const attacker = await seedCommissioner({ password_hash: '$2b$12$fakehashfortest00000000000000000000000000000000000000', google_linked: false });
    try {
      const res = await request.get(`/api/admin/account-type?adminId=${victim.id}`, { headers: sessionHeaders(attacker.id) });
      expect(res.status()).toBe(403);
    } finally {
      await cleanup(victim.id);
      await cleanup(attacker.id);
    }
  });

  test('account-type refuses a request with no session cookie at all', async ({ request }) => {
    const victim = await seedCommissioner({ password_hash: 'google_oauth', google_linked: true });
    try {
      const res = await request.get(`/api/admin/account-type?adminId=${victim.id}`);
      expect(res.status()).toBe(403);
    } finally {
      await cleanup(victim.id);
    }
  });

  test('unlink-google cannot be used to disconnect another account\'s Google', async ({ request }) => {
    const victim = await seedCommissioner({ password_hash: '$2b$12$fakehashfortest00000000000000000000000000000000000000', google_linked: true });
    const attacker = await seedCommissioner({ password_hash: '$2b$12$fakehashfortest00000000000000000000000000000000000000', google_linked: false });
    try {
      const res = await request.post('/api/admin/unlink-google', { data: { adminId: victim.id }, headers: sessionHeaders(attacker.id) });
      expect(res.status()).toBe(403);

      const { data: row } = await supabase.from('commissioners').select('google_linked').eq('id', victim.id).single();
      expect(row?.google_linked).toBe(true);
    } finally {
      await cleanup(victim.id);
      await cleanup(attacker.id);
    }
  });

  test('set-password cannot be used to take over another Google-only account', async ({ request }) => {
    const victim = await seedCommissioner({ password_hash: 'google_oauth', google_linked: true });
    const attacker = await seedCommissioner({ password_hash: '$2b$12$fakehashfortest00000000000000000000000000000000000000', google_linked: false });
    try {
      const res = await request.post('/api/admin/set-password', {
        data: { adminId: victim.id, newPassword: 'attacker-chosen-password-1' },
        headers: sessionHeaders(attacker.id),
      });
      expect(res.status()).toBe(403);

      const { data: row } = await supabase.from('commissioners').select('password_hash').eq('id', victim.id).single();
      expect(row?.password_hash).toBe('google_oauth');
    } finally {
      await cleanup(victim.id);
      await cleanup(attacker.id);
    }
  });
});
