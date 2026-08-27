import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

// ─────────────────────────────────────────────────────────────
// Quarter Payouts — regression coverage for the schema change in
// supabase/migrations/20260827120000_add_quarter_payouts.sql: new
// quarter_* columns on payout_configs, and a new period_name column +
// widened unique constraint on payout_records (previously
// (pool_id, scope, season, week, participant_id); now also includes
// period_name so Q1/Q2/Q3/Q4 rows for the same pool/season don't collide —
// they all share week=0, same convention as 'overall' scope).
//
// setPoolPayoutConfig/getPoolPayoutConfig/savePayoutCalculation/
// getPayoutRecords/markPayoutPaid are Next.js Server Actions with no REST
// wrapper — same situation documented in private-pool-password.spec.ts, so
// they're imported and called directly here rather than over HTTP.
//
// The calculation formula itself (computeQuarterDollarAmount matching
// computeWeeklyDollarAmount) and calculatePayouts' tie handling are covered
// in payouts-calculation.spec.ts — this file is specifically about the new
// persistence path actually working against the real database.
// ─────────────────────────────────────────────────────────────

import { createPool } from '../../src/actions/createPool';
import {
  setPoolPayoutConfig, getPoolPayoutConfig, savePayoutCalculation, getPayoutRecords, markPayoutPaid,
  PayoutRecordInput,
} from '../../src/actions/poolPayouts';
import { DEFAULT_PAYOUT_CONFIG } from '../../src/lib/payouts';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY!
);

test.describe('setPoolPayoutConfig / getPoolPayoutConfig — quarter fields round-trip', () => {
  test('saves and reloads quarterEnabled/quarterAmountType/quarterAmount/quarterPositions', async () => {
    test.setTimeout(30000);
    const ownerEmail = `e2e-quarter-config-${Date.now()}@sundayhuddle.net`;
    let poolId: string | undefined;

    try {
      const created = await createPool({
        name: 'E2E Quarter Config Pool',
        created_by: ownerEmail,
        season: 2020,
        season_scope: [2],
        is_private: false,
      });
      expect(created.success).toBe(true);
      if (!created.success) return;
      poolId = created.data.id as string;

      const config = {
        ...DEFAULT_PAYOUT_CONFIG,
        enabled: true,
        entryFee: 25,
        quarterEnabled: true,
        quarterAmountType: 'percentage' as const,
        quarterAmount: 15,
        quarterPositions: [{ place: 1, percentage: 70 }, { place: 2, percentage: 30 }],
      };

      const saveResult = await setPoolPayoutConfig(poolId, ownerEmail, config);
      expect(saveResult.success).toBe(true);

      const reloaded = await getPoolPayoutConfig(poolId);
      expect(reloaded.quarterEnabled).toBe(true);
      expect(reloaded.quarterAmountType).toBe('percentage');
      expect(reloaded.quarterAmount).toBe(15);
      expect(reloaded.quarterPositions).toEqual([{ place: 1, percentage: 70 }, { place: 2, percentage: 30 }]);
      // Weekly/overall untouched by saving quarter fields — no cross-contamination.
      expect(reloaded.weeklyEnabled).toBe(false);
      expect(reloaded.overallEnabled).toBe(false);
    } finally {
      if (poolId) await supabase.from('payout_configs').delete().eq('pool_id', poolId);
      if (poolId) await supabase.from('pools').delete().eq('id', poolId);
      await supabase.from('huddles').delete().eq('commissioner_email', ownerEmail);
    }
  });

  test('rejects an invalid quarter amount when quarterEnabled is on', async () => {
    test.setTimeout(30000);
    const ownerEmail = `e2e-quarter-config-invalid-${Date.now()}@sundayhuddle.net`;
    let poolId: string | undefined;

    try {
      const created = await createPool({
        name: 'E2E Quarter Config Invalid Pool',
        created_by: ownerEmail,
        season: 2020,
        season_scope: [2],
        is_private: false,
      });
      expect(created.success).toBe(true);
      if (!created.success) return;
      poolId = created.data.id as string;

      const config = {
        ...DEFAULT_PAYOUT_CONFIG,
        enabled: true,
        quarterEnabled: true,
        quarterAmountType: 'fixed' as const,
        quarterAmount: -10, // invalid — negative
        quarterPositions: [{ place: 1, percentage: 100 }],
      };

      const result = await setPoolPayoutConfig(poolId, ownerEmail, config);
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toMatch(/quarter payouts/i);
    } finally {
      if (poolId) await supabase.from('pools').delete().eq('id', poolId);
      await supabase.from('huddles').delete().eq('commissioner_email', ownerEmail);
    }
  });
});

test.describe('savePayoutCalculation / getPayoutRecords — quarter scope', () => {
  test('two different quarters (Q1, Q2) persist independently and do not collide', async () => {
    test.setTimeout(30000);
    const ownerEmail = `e2e-quarter-records-${Date.now()}@sundayhuddle.net`;
    let poolId: string | undefined;
    const season = 2020;

    try {
      const created = await createPool({
        name: 'E2E Quarter Records Pool',
        created_by: ownerEmail,
        season,
        season_scope: [2],
        is_private: false,
      });
      expect(created.success).toBe(true);
      if (!created.success) return;
      poolId = created.data.id as string;

      const q1Inputs: PayoutRecordInput[] = [
        { scope: 'quarter', season, week: 0, seasonType: 2, periodName: 'Q1', place: 1, participantId: null, participantName: 'Alice', amount: 70 },
        { scope: 'quarter', season, week: 0, seasonType: 2, periodName: 'Q1', place: 2, participantId: null, participantName: 'Bob', amount: 30 },
      ];
      const q2Inputs: PayoutRecordInput[] = [
        { scope: 'quarter', season, week: 0, seasonType: 2, periodName: 'Q2', place: 1, participantId: null, participantName: 'Carol', amount: 60 },
        { scope: 'quarter', season, week: 0, seasonType: 2, periodName: 'Q2', place: 2, participantId: null, participantName: 'Dave', amount: 40 },
      ];

      const q1Save = await savePayoutCalculation(poolId, ownerEmail, q1Inputs);
      expect(q1Save.success).toBe(true);
      const q2Save = await savePayoutCalculation(poolId, ownerEmail, q2Inputs);
      expect(q2Save.success).toBe(true);

      // Q1's records are still there, untouched by saving Q2 — this is the
      // literal thing the spec calls out: earlier quarters must remain
      // visible once a later quarter is calculated.
      const q1Records = await getPayoutRecords(poolId, 'quarter', season, undefined, 'Q1');
      expect(q1Records).toHaveLength(2);
      expect(q1Records.map(r => r.participant_name).sort()).toEqual(['Alice', 'Bob']);

      const q2Records = await getPayoutRecords(poolId, 'quarter', season, undefined, 'Q2');
      expect(q2Records).toHaveLength(2);
      expect(q2Records.map(r => r.participant_name).sort()).toEqual(['Carol', 'Dave']);

      // Omitting periodName returns every quarter's records for this pool/season.
      const allQuarters = await getPayoutRecords(poolId, 'quarter', season);
      expect(allQuarters).toHaveLength(4);
    } finally {
      if (poolId) await supabase.from('payout_records').delete().eq('pool_id', poolId);
      if (poolId) await supabase.from('pools').delete().eq('id', poolId);
      await supabase.from('huddles').delete().eq('commissioner_email', ownerEmail);
    }
  });

  test('recalculating the same quarter updates amounts but preserves an existing paid mark', async () => {
    test.setTimeout(30000);
    const ownerEmail = `e2e-quarter-recalc-${Date.now()}@sundayhuddle.net`;
    let poolId: string | undefined;
    const season = 2020;

    try {
      const created = await createPool({
        name: 'E2E Quarter Recalc Pool',
        created_by: ownerEmail,
        season,
        season_scope: [2],
        is_private: false,
      });
      expect(created.success).toBe(true);
      if (!created.success) return;
      poolId = created.data.id as string;

      const { data: participant, error: participantError } = await supabase
        .from('participants')
        .insert({ pool_id: poolId, name: 'Eve', is_active: true })
        .select('id')
        .single();
      if (participantError || !participant) throw new Error(`Failed to seed participant: ${participantError?.message}`);

      const firstSave = await savePayoutCalculation(poolId, ownerEmail, [
        { scope: 'quarter', season, week: 0, seasonType: 2, periodName: 'Q3', place: 1, participantId: participant.id, participantName: 'Eve', amount: 50 },
      ]);
      expect(firstSave.success).toBe(true);
      if (!firstSave.success) return;
      const recordId = firstSave.data[0].id;

      const markResult = await markPayoutPaid(recordId, ownerEmail, true);
      expect(markResult.success).toBe(true);

      // Recalculation with a different amount (standings moved) — paid must survive.
      const secondSave = await savePayoutCalculation(poolId, ownerEmail, [
        { scope: 'quarter', season, week: 0, seasonType: 2, periodName: 'Q3', place: 1, participantId: participant.id, participantName: 'Eve', amount: 65 },
      ]);
      expect(secondSave.success).toBe(true);

      const records = await getPayoutRecords(poolId, 'quarter', season, undefined, 'Q3');
      expect(records).toHaveLength(1);
      expect(Number(records[0].amount)).toBe(65);
      expect(records[0].paid).toBe(true);
    } finally {
      if (poolId) await supabase.from('payout_records').delete().eq('pool_id', poolId);
      if (poolId) await supabase.from('participants').delete().eq('pool_id', poolId);
      if (poolId) await supabase.from('pools').delete().eq('id', poolId);
      await supabase.from('huddles').delete().eq('commissioner_email', ownerEmail);
    }
  });
});
