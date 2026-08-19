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
// createPool/updatePool/setPoolPassword are Next.js Server Actions with no
// REST wrapper (unlike clone-pool, which has one) — same situation
// documented in payouts-calculation.spec.ts for src/lib/payouts.ts. None of
// the three import next/headers or cookies(), so — like that file — they're
// imported and called directly here rather than over HTTP.
// ─────────────────────────────────────────────────────────────

import { createPool } from '../../src/actions/createPool';
import { updatePool } from '../../src/actions/updatePool';
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
  test('succeeds once is_private is persisted first, matching the pool-settings.tsx fix', async () => {
    test.setTimeout(30000);
    const ownerEmail = `e2e-toggle-private-${Date.now()}@sundayhuddle.net`;
    let poolId: string | undefined;

    try {
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
      await updatePool(poolId, { is_private: true });

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
