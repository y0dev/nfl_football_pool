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
//
// Also covers the postseason extension: for a pool whose season scope
// includes the playoffs, getPayoutRecords() takes an optional seasonType
// filter, the Quarter calculator offers a "Playoffs" period (period_name
// 'Playoffs', season_type 3), and a weekly payout for Regular-season Week N
// and one for Postseason Week N must persist as two independent rows.
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

  test('a Playoffs-period payout persists alongside Q1, and the seasonType filter isolates each phase', async () => {
    test.setTimeout(30000);
    const ownerEmail = `e2e-quarter-playoffs-${Date.now()}@sundayhuddle.net`;
    let poolId: string | undefined;
    const season = 2020;

    try {
      // season_scope stays [2] here — createPool gates a playoffs scope on
      // plan/season-settings, and none of that is what this test exercises:
      // payout_records persistence never reads pools.season_scope, so a
      // season_type-3 'Playoffs' row round-trips regardless.
      const created = await createPool({
        name: 'E2E Quarter Playoffs Pool',
        created_by: ownerEmail,
        season,
        season_scope: [2],
        is_private: false,
      });
      expect(created.success).toBe(true);
      if (!created.success) return;
      poolId = created.data.id as string;

      // A regular-season quarter and the postseason "Playoffs" period — the
      // latter is what the Quarter calculator now offers when the pool's
      // scope includes the playoffs (period_name 'Playoffs', season_type 3).
      const q1Save = await savePayoutCalculation(poolId, ownerEmail, [
        { scope: 'quarter', season, week: 0, seasonType: 2, periodName: 'Q1', place: 1, participantId: null, participantName: 'Alice', amount: 100 },
      ]);
      expect(q1Save.success).toBe(true);
      const playoffSave = await savePayoutCalculation(poolId, ownerEmail, [
        { scope: 'quarter', season, week: 0, seasonType: 3, periodName: 'Playoffs', place: 1, participantId: null, participantName: 'Zoe', amount: 250 },
      ]);
      expect(playoffSave.success).toBe(true);

      // Playoffs is its own period_name — saving it leaves Q1 untouched.
      const playoffRecords = await getPayoutRecords(poolId, 'quarter', season, undefined, 'Playoffs');
      expect(playoffRecords).toHaveLength(1);
      expect(playoffRecords[0].participant_name).toBe('Zoe');
      expect(Number(playoffRecords[0].season_type)).toBe(3);

      const q1Records = await getPayoutRecords(poolId, 'quarter', season, undefined, 'Q1');
      expect(q1Records).toHaveLength(1);
      expect(q1Records[0].participant_name).toBe('Alice');

      // The new trailing seasonType arg narrows a fetch to one phase.
      const regularOnly = await getPayoutRecords(poolId, 'quarter', season, undefined, undefined, 2);
      expect(regularOnly.map(r => r.participant_name)).toEqual(['Alice']);
      const postseasonOnly = await getPayoutRecords(poolId, 'quarter', season, undefined, undefined, 3);
      expect(postseasonOnly.map(r => r.participant_name)).toEqual(['Zoe']);
    } finally {
      if (poolId) await supabase.from('payout_records').delete().eq('pool_id', poolId);
      if (poolId) await supabase.from('pools').delete().eq('id', poolId);
      await supabase.from('huddles').delete().eq('commissioner_email', ownerEmail);
    }
  });
});

test.describe('savePayoutCalculation / getPayoutRecords — weekly scope across season phases', () => {
  test('Regular-season Week 1 and Postseason Week 1 persist independently; seasonType filter keeps them apart', async () => {
    test.setTimeout(30000);
    const ownerEmail = `e2e-weekly-phases-${Date.now()}@sundayhuddle.net`;
    let poolId: string | undefined;
    const season = 2020;

    try {
      // season_scope [2] — see the note in the Playoffs quarter test above;
      // the weekly persistence path doesn't read it either.
      const created = await createPool({
        name: 'E2E Weekly Phases Pool',
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
        .insert({ pool_id: poolId, name: 'Frank', is_active: true })
        .select('id')
        .single();
      if (participantError || !participant) throw new Error(`Failed to seed participant: ${participantError?.message}`);

      // Regular-season Week 1, then marked paid.
      const regSave = await savePayoutCalculation(poolId, ownerEmail, [
        { scope: 'weekly', season, week: 1, seasonType: 2, place: 1, participantId: participant.id, participantName: 'Frank', amount: 40 },
      ]);
      expect(regSave.success).toBe(true);
      if (!regSave.success) return;
      const markResult = await markPayoutPaid(regSave.data[0].id, ownerEmail, true);
      expect(markResult.success).toBe(true);

      // Postseason Week 1 — same week number, must not overwrite or unpay the
      // regular-season row (they differ only by season_type).
      const postSave = await savePayoutCalculation(poolId, ownerEmail, [
        { scope: 'weekly', season, week: 1, seasonType: 3, place: 1, participantId: participant.id, participantName: 'Frank', amount: 90 },
      ]);
      expect(postSave.success).toBe(true);

      const regRecords = await getPayoutRecords(poolId, 'weekly', season, 1, undefined, 2);
      expect(regRecords).toHaveLength(1);
      expect(Number(regRecords[0].amount)).toBe(40);
      expect(regRecords[0].paid).toBe(true);

      const postRecords = await getPayoutRecords(poolId, 'weekly', season, 1, undefined, 3);
      expect(postRecords).toHaveLength(1);
      expect(Number(postRecords[0].amount)).toBe(90);
      expect(postRecords[0].paid).toBe(false);

      // Without the seasonType filter, both phases' Week 1 rows come back.
      const bothPhases = await getPayoutRecords(poolId, 'weekly', season, 1);
      expect(bothPhases).toHaveLength(2);
    } finally {
      if (poolId) await supabase.from('payout_records').delete().eq('pool_id', poolId);
      if (poolId) await supabase.from('participants').delete().eq('pool_id', poolId);
      if (poolId) await supabase.from('pools').delete().eq('id', poolId);
      await supabase.from('huddles').delete().eq('commissioner_email', ownerEmail);
    }
  });
});
