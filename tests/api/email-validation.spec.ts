import { test, expect } from '@playwright/test';

// ─────────────────────────────────────────────────────────────
// Email validation on account/participant creation.
// Format is enforced in every environment; reserved domains
// (@test, @example, …) are additionally blocked in production
// only, so these tests stick to format failures that behave the
// same in dev and prod.
// ─────────────────────────────────────────────────────────────

const BAD_FORMATS = [
  'notanemail',        // no @ at all
  'user@test',         // bare reserved domain, no TLD
  'user@',             // missing domain
  '@nodomain.com',     // missing local part
  'user @spaces.com',  // whitespace
];

test.describe('POST /api/admin/create-commissioner email validation', () => {
  for (const email of BAD_FORMATS) {
    test(`rejects "${email}"`, async ({ request }) => {
      const res = await request.post('/api/admin/create-commissioner', {
        data: { email, password: 'ValidPass1!', fullName: 'Email Format Test' },
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toMatch(/email/i);
    });
  }
});

test.describe('POST /api/pools/join email validation', () => {
  test('rejects a malformed email before touching the pool', async ({ request }) => {
    const res = await request.post('/api/pools/join', {
      data: { poolId: '00000000-0000-0000-0000-000000000000', name: 'Format Test', email: 'user@test' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/email/i);
  });
});
