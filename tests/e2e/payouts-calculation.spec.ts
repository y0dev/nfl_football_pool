import { test, expect } from '@playwright/test';
import {
  calculatePayouts, computeTotalPool, computeOverallAllocation, computeWeeklyDollarAmount,
  validatePayoutPositions, validateEntryFee, defaultPositionSplit,
} from '../../src/lib/payouts';

// ─────────────────────────────────────────────────────────────
// Payout calculation library (src/lib/payouts.ts) — pure functions, no DB
// or network involved, so these run against every commit regardless of
// environment. Scenarios below mirror the payout feature spec's Step 28
// test matrix. Server-action write paths (setPoolPayoutConfig,
// savePayoutCalculation, markPayoutPaid in src/actions/poolPayouts.ts) are
// covered by manual verification against a real pool per that session's
// report rather than here — Next.js Server Actions aren't reachable via a
// plain HTTP POST the way the rest of this suite tests API routes.
// ─────────────────────────────────────────────────────────────

test.describe('Payout calculations', () => {
  test('Scenario 1: 15 participants x $20, 50/30/20 overall split', () => {
    const total = computeTotalPool(20, 15);
    expect(total).toBe(300);
    const standings = [
      { participantId: '1', participantName: 'A', score: 100 },
      { participantId: '2', participantName: 'B', score: 90 },
      { participantId: '3', participantName: 'C', score: 80 },
    ];
    const positions = [{ place: 1, percentage: 50 }, { place: 2, percentage: 30 }, { place: 3, percentage: 20 }];
    expect(validatePayoutPositions(positions)).toBeNull();
    const results = calculatePayouts(positions, total, standings, 'split');
    expect(results[0].amount).toBeCloseTo(150, 2);
    expect(results[1].amount).toBeCloseTo(90, 2);
    expect(results[2].amount).toBeCloseTo(60, 2);
  });

  test('Scenario 2: 10 participants x $50, 60/25/15 overall split', () => {
    const total = computeTotalPool(50, 10);
    expect(total).toBe(500);
    const standings = [
      { participantId: '1', participantName: 'A', score: 100 },
      { participantId: '2', participantName: 'B', score: 90 },
      { participantId: '3', participantName: 'C', score: 80 },
    ];
    const positions = [{ place: 1, percentage: 60 }, { place: 2, percentage: 25 }, { place: 3, percentage: 15 }];
    const results = calculatePayouts(positions, total, standings, 'split');
    expect(results[0].amount).toBeCloseTo(300, 2);
    expect(results[1].amount).toBeCloseTo(125, 2);
    expect(results[2].amount).toBeCloseTo(75, 2);
  });

  test('Scenario 3: weekly $50 pool, 70/30 split', () => {
    const weeklyAmount = computeWeeklyDollarAmount({ weeklyAmountType: 'fixed', weeklyAmount: 50 }, 0);
    expect(weeklyAmount).toBe(50);
    const standings = [
      { participantId: '1', participantName: 'A', score: 14 },
      { participantId: '2', participantName: 'B', score: 12 },
    ];
    const positions = [{ place: 1, percentage: 70 }, { place: 2, percentage: 30 }];
    const results = calculatePayouts(positions, weeklyAmount, standings, 'split');
    expect(results[0].amount).toBeCloseTo(35, 2);
    expect(results[1].amount).toBeCloseTo(15, 2);
  });

  test('Scenario 4: weekly and overall allocations are independent', () => {
    const total = computeTotalPool(20, 15); // 300
    const weekly = computeWeeklyDollarAmount({ weeklyAmountType: 'fixed', weeklyAmount: 10 }, total); // $10/week
    const overall = computeOverallAllocation(total, weekly, 10); // 300 - (10 * 10)
    expect(weekly).toBe(10);
    expect(overall).toBe(200);
  });

  test('Scenario 5: five overall winners must sum to exactly 100%', () => {
    const positions = [
      { place: 1, percentage: 30 }, { place: 2, percentage: 25 }, { place: 3, percentage: 20 },
      { place: 4, percentage: 15 }, { place: 5, percentage: 10 },
    ];
    expect(validatePayoutPositions(positions)).toBeNull();
  });

  test('Scenario 6: invalid percentages are rejected', () => {
    const positions = [{ place: 1, percentage: 50 }, { place: 2, percentage: 30 }, { place: 3, percentage: 10 }];
    expect(validatePayoutPositions(positions)).not.toBeNull();
  });

  test('Scenario 7: tied participants split their combined payout evenly', () => {
    const positions = [{ place: 1, percentage: 40 }, { place: 2, percentage: 30 }, { place: 3, percentage: 20 }, { place: 4, percentage: 10 }];
    const standings = [
      { participantId: '1', participantName: 'A', score: 100 },
      { participantId: '2', participantName: 'B', score: 100 }, // tied with A for 1st
      { participantId: '3', participantName: 'C', score: 80 },
      { participantId: '4', participantName: 'D', score: 70 },
    ];
    const results = calculatePayouts(positions, 1000, standings, 'split');
    // Combined 1st + 2nd percentage (40 + 30 = 70%) of $1000, split between the 2 tied participants
    expect(results[0].amount).toBeCloseTo(350, 2);
    expect(results[1].amount).toBeCloseTo(350, 2);
    expect(results[0].tied).toBe(true);
    expect(results[1].tied).toBe(true);
    // Every member of a tied group shares the same `place` by design — the
    // caller (payout-calculator.tsx) keys DB records by participant, not
    // place, specifically because of this.
    expect(results[0].place).toBe(1);
    expect(results[1].place).toBe(1);
    // C moves to 3rd, D to 4th
    expect(results[2].place).toBe(3);
    expect(results[2].amount).toBeCloseTo(200, 2);
    expect(results[3].place).toBe(4);
    expect(results[3].amount).toBeCloseTo(100, 2);
  });

  test('Scenario 7b: "commissioner decides" tie policy flags instead of guessing', () => {
    const positions = [{ place: 1, percentage: 100 }];
    const standings = [
      { participantId: '1', participantName: 'A', score: 50 },
      { participantId: '2', participantName: 'B', score: 50 },
    ];
    const results = calculatePayouts(positions, 100, standings, 'commissioner');
    expect(results).toHaveLength(2);
    expect(results[0].amount).toBe(0);
    expect(results[1].amount).toBe(0);
    expect(results[0].needsManualResolution).toBe(true);
    expect(results[1].needsManualResolution).toBe(true);
  });

  test('entry fee validation: $0/null is valid (no money involved), negative is not', () => {
    expect(validateEntryFee(null)).toBeNull();
    expect(validateEntryFee(0)).toBeNull();
    expect(validateEntryFee(-5)).not.toBeNull();
  });

  test('defaultPositionSplit always sums to exactly 100 and passes validation', () => {
    for (let n = 1; n <= 8; n++) {
      const split = defaultPositionSplit(n);
      const total = split.reduce((sum, p) => sum + p.percentage, 0);
      expect(total).toBe(100);
      expect(validatePayoutPositions(split)).toBeNull();
    }
  });
});
