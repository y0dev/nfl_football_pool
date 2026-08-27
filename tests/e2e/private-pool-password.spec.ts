import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

// ─────────────────────────────────────────────────────────────
// Private pool passwords — regression coverage for a 2026-08-18 production
// outage: creating a private pool, or setting a password on the settings
// page, both threw "An unexpected error occurred" / "Only private pools
// have a password" in prod. Root cause: POOL_ACCESS_SECRET wasn't set in
// Vercel Production/Preview, so encryptPoolPassword() (src/lib/pool-access.ts)
// threw on every call. A second, independent bug: pool-settings.tsx's "Set
// Password" dialog called setPoolPassword() against the pool's *persisted*
// is_private, not the form's pending (unsaved) Visibility toggle, so
// toggling to Private and immediately setting a password in one pass failed
// even with the secret configured.
//
// createPool/setPoolPassword are Next.js Server Actions with no REST wrapper
// (unlike clone-pool, which has one) — same situation documented in
// payouts-calculation.spec.ts for src/lib/payouts.ts. Neither imports
// next/headers or cookies(), so — like that file — they're imported and
// called directly here rather than over HTTP. updatePool now does read a
// cookie (it checks pool ownership), so it's called through the real PATCH
// /api/pools/[id] wrapper below instead — see that route's own comment.
// ─────────────────────────────────────────────────────────────

import { createPool } from '../../src/actions/createPool';
import { setPoolPassword } from '../../src/actions/poolPassword';
import { encryptPoolPassword, decryptPoolPassword, validatePoolPassword } from '../../src/lib/pool-access';
import { getNFLSeasonYear } from '../../src/lib/utils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY!
);

test.describe('src/lib/pool-access.ts — encryption (guards the missing-POOL_ACCESS_SECRET regression)', () => {
  test('encrypt/decrypt round-trips a password', async () => {
    const encrypted = await encryptPoolPassword('roundtrip-test-pw');
    expect(encrypted).toContain('.');
    const decrypted = await decryptPoolPassword(encrypted);
    expect(decrypted).toBe('roundtrip-test-pw');
  });

  test('validatePoolPassword enforces minimum length and confirmation match', () => {
    expect(validatePoolPassword('', '')).toMatch(/enter a password/i);
    expect(validatePoolPassword('abc', 'abc')).toMatch(/at least/i);
    expect(validatePoolPassword('abcd', 'abce')).toMatch(/do not match/i);
    expect(validatePoolPassword('abcd', 'abcd')).toBeNull();
  });
});

test.describe('createPool — private pool with a password', () => {
  test('creates successfully and stores a working encrypted password', async () => {
    test.setTimeout(30000);
    const ownerEmail = `e2e-private-pool-${Date.now()}@sundayhuddle.net`;
    let poolId: string | undefined;

    try {
      const result = await createPool({
        name: 'E2E Private Pool',
        created_by: ownerEmail,
        season: 2020, // a past season, keeps this out of any real-season UI listings
        season_scope: [2],
        is_private: true,
        join_password: 'testpass123',
        join_password_confirm: 'testpass123',
      });

      expect(result.success).toBe(true);
      if (!result.success) return; // narrows the type for the assertions below
      poolId = result.data.id as string;

      const { data: row } = await supabase
        .from('pools')
        .select('is_private, private_password_encrypted')
        .eq('id', poolId)
        .single();
      expect(row?.is_private).toBe(true);
      expect(row?.private_password_encrypted).toBeTruthy();

      const decrypted = await decryptPoolPassword(row!.private_password_encrypted!);
      expect(decrypted).toBe('testpass123');
    } finally {
      if (poolId) await supabase.from('pools').delete().eq('id', poolId);
      await supabase.from('huddles').delete().eq('commissioner_email', ownerEmail);
    }
  });

  test('rejects a private pool with no password', async () => {
    const result = await createPool({
      name: 'E2E Private Pool No Password',
      created_by: `e2e-private-pool-reject-${Date.now()}@sundayhuddle.net`,
      season: 2020,
      season_scope: [2],
      is_private: true,
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/password/i);
  });
});

test.describe('setPoolPassword — toggling Private and setting a password without a prior save', () => {
  test('succeeds once is_private is persisted first, matching the pool-settings.tsx fix', async ({ request }) => {
    test.setTimeout(30000);
    const ownerEmail = `e2e-toggle-private-${Date.now()}@sundayhuddle.net`;
    let poolId: string | undefined;
    let ownerId: string | undefined;

    try {
      // A real commissioner row is required — updatePool now authenticates
      // the caller via a real account (session-derived), matching production.
      const { data: ownerRow, error: ownerError } = await supabase
        .from('commissioners')
        .insert({ email: ownerEmail, password_hash: 'google_oauth', full_name: 'E2E Toggle-Private Owner', plan: 'free', is_active: true })
        .select('id')
        .single();
      if (ownerError || !ownerRow) throw new Error(`Failed to seed pool owner: ${ownerError?.message}`);
      ownerId = ownerRow.id;

      // Start as a PUBLIC pool — reproduces the exact bug scenario: a
      // commissioner toggling Visibility to Private in the form and
      // immediately clicking "Set Password" before "Save Settings". Must be
      // a current-season pool — updatePool() locks any pool from a season
      // that's already ended, which the setPoolPassword fix goes through.
      const created = await createPool({
        name: 'E2E Toggle-Private Pool',
        created_by: ownerEmail,
        season: getNFLSeasonYear(),
        season_scope: [2],
        is_private: false,
      });
      expect(created.success).toBe(true);
      if (!created.success) return;
      poolId = created.data.id as string;

      // Calling setPoolPassword directly here (skipping the is_private
      // persist step) is exactly what used to fail with "Only private pools
      // have a password" — the fix makes handleSetPassword() call
      // updatePool({ is_private: true }) first, so replicate that here.
      // updatePool now checks pool ownership (sh-session-cookie-based), so
      // this goes through the real PATCH /api/pools/[id] wrapper rather than
      // calling the Server Action directly — see that route's own comment.
      const patchRes = await request.patch(`/api/pools/${poolId}`, {
        headers: { Cookie: `sh-session=${ownerId}` },
        data: { is_private: true },
      });
      expect(patchRes.ok()).toBeTruthy();

      const result = await setPoolPassword(poolId, ownerEmail, 'newpassword1', 'newpassword1');
      expect(result.success).toBe(true);

      const { data: row } = await supabase
        .from('pools')
        .select('is_private, private_password_encrypted')
        .eq('id', poolId)
        .single();
      expect(row?.is_private).toBe(true);
      expect(row?.private_password_encrypted).toBeTruthy();
    } finally {
      if (poolId) await supabase.from('pools').delete().eq('id', poolId);
      if (ownerId) await supabase.from('commissioners').delete().eq('id', ownerId);
      await supabase.from('huddles').delete().eq('commissioner_email', ownerEmail);
    }
  });

  test('still rejects when the pool is genuinely public (no is_private update at all)', async () => {
    test.setTimeout(30000);
    const ownerEmail = `e2e-still-public-${Date.now()}@sundayhuddle.net`;
    let poolId: string | undefined;

    try {
      const created = await createPool({
        name: 'E2E Still-Public Pool',
        created_by: ownerEmail,
        season: 2020,
        season_scope: [2],
        is_private: false,
      });
      expect(created.success).toBe(true);
      if (!created.success) return;
      poolId = created.data.id as string;

      const result = await setPoolPassword(poolId, ownerEmail, 'newpassword1', 'newpassword1');
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toMatch(/only private pools/i);
    } finally {
      if (poolId) await supabase.from('pools').delete().eq('id', poolId);
      await supabase.from('huddles').delete().eq('commissioner_email', ownerEmail);
    }
  });
});

// A private pool with no password configured at all can only exist as
// legacy/inconsistent data — createPool() itself rejects is_private:true
// with no password (see the test above) — so this is seeded by updating the
// row directly, the same way a pool could end up in this state outside the
// normal create/set-password flow.
test.describe('/pool/[id]/access — private pool with no password configured', () => {
  test('visitor can leave the page instead of being stuck with no password to enter', async ({ page }) => {
    test.setTimeout(30000);
    const ownerEmail = `e2e-needs-setup-${Date.now()}@sundayhuddle.net`;
    let poolId: string | undefined;

    try {
      const created = await createPool({
        name: 'E2E Needs-Setup Pool',
        created_by: ownerEmail,
        season: 2020,
        season_scope: [2],
        is_private: false,
      });
      expect(created.success).toBe(true);
      if (!created.success) return;
      poolId = created.data.id as string;

      // Bypass the app-level validation that would normally require a
      // password alongside is_private:true, reproducing the legacy/
      // inconsistent-data state PoolPasswordPrompt's needsSetup branch
      // exists to handle.
      await supabase.from('pools').update({ is_private: true, private_password_encrypted: null }).eq('id', poolId);

      await page.goto(`/pool/${poolId}/access`);
      await expect(page.getByRole('heading', { name: 'Password Required' })).toBeVisible();
      await expect(page.getByText(/ask your commissioner to set one/i)).toBeVisible();

      // There must be no password field to fill in here (nothing to submit),
      // so the exit link is the only way out of this page.
      await expect(page.locator('input[type="password"]')).toHaveCount(0);

      const exitLink = page.getByRole('link', { name: /back to sunday huddle/i });
      await expect(exitLink).toBeVisible();
      await expect(exitLink).toHaveAttribute('href', '/');

      await exitLink.click();
      await expect(page).toHaveURL(/\/$/);
    } finally {
      if (poolId) await supabase.from('pools').delete().eq('id', poolId);
      await supabase.from('huddles').delete().eq('commissioner_email', ownerEmail);
    }
  });

  test('password-prompt case also offers the same exit link', async ({ page }) => {
    test.setTimeout(30000);
    const ownerEmail = `e2e-exit-link-pw-${Date.now()}@sundayhuddle.net`;
    let poolId: string | undefined;

    try {
      const created = await createPool({
        name: 'E2E Exit-Link Password Pool',
        created_by: ownerEmail,
        season: 2020,
        season_scope: [2],
        is_private: true,
        join_password: 'testpass123',
        join_password_confirm: 'testpass123',
      });
      expect(created.success).toBe(true);
      if (!created.success) return;
      poolId = created.data.id as string;

      await page.goto(`/pool/${poolId}/access`);
      await expect(page.getByRole('heading', { name: 'Private Pool' })).toBeVisible();
      await expect(page.getByRole('link', { name: /back to sunday huddle/i })).toHaveAttribute('href', '/');
    } finally {
      if (poolId) await supabase.from('pools').delete().eq('id', poolId);
      await supabase.from('huddles').delete().eq('commissioner_email', ownerEmail);
    }
  });
});
