// Season-bound plans: a Standard purchase covers one NFL season and lapses
// to Free once getNFLSeasonYear() rolls over (Feb 14 after the Super Bowl).
import test from 'node:test';
import assert from 'node:assert/strict';
import { computePlanInfo, isPaidPlanCurrent } from '../../src/lib/plan';
import { getNFLSeasonYear } from '../../src/lib/utils';
import { seasonLabel } from '../../src/lib/pricing';

const NOV_2026 = new Date('2026-11-19T12:00:00Z');       // 2026 season, regular season
const JAN_2027 = new Date('2027-01-20T12:00:00Z');       // still 2026 season (playoffs)
const FEB_20_2027 = new Date('2027-02-20T12:00:00Z');    // 2027 season (offseason)

test('season year rolls over on Feb 14', () => {
  assert.equal(getNFLSeasonYear(NOV_2026), 2026);
  assert.equal(getNFLSeasonYear(JAN_2027), 2026);
  assert.equal(getNFLSeasonYear(new Date('2027-02-13T12:00:00Z')), 2026);
  assert.equal(getNFLSeasonYear(FEB_20_2027), 2027);
});

test('Standard bought for the current season is Standard', () => {
  const info = computePlanInfo({ plan: 'standard', plan_season: 2026, addon_pools: 2 }, NOV_2026);
  assert.equal(info.plan, 'standard');
  assert.equal(info.planSeason, 2026);
  assert.equal(info.planLapsed, false);
  assert.equal(info.addonPools, 2);
  assert.equal(info.poolLimit, 4);
});

test('a playoff purchase does not carry into the next season', () => {
  const row = { plan: 'standard', plan_season: 2026, addon_pools: 1 };
  assert.equal(computePlanInfo(row, JAN_2027).plan, 'standard');

  const after = computePlanInfo(row, FEB_20_2027);
  assert.equal(after.plan, 'free');
  assert.equal(after.planLapsed, true);
  assert.equal(after.planSeason, null);
  assert.equal(after.addonPools, 0, 'add-on pools lapse with the plan');
  assert.equal(after.currentSeason, 2027);
});

test('comped accounts never lapse', () => {
  const info = computePlanInfo({ plan: 'standard', plan_season: 2025, billing_exempt: true }, FEB_20_2027);
  assert.equal(info.plan, 'standard');
  assert.equal(info.planLapsed, false);
});

test('rows without plan_season are not season-bound', () => {
  assert.equal(computePlanInfo({ plan: 'standard' }, FEB_20_2027).plan, 'standard');
  assert.equal(isPaidPlanCurrent({ plan: 'standard', plan_season: null }, 2030), true);
});

test('an active trial grants Standard even after a lapsed plan', () => {
  const info = computePlanInfo(
    { plan: 'standard', plan_season: 2025, trial_ends_at: '2026-11-25T00:00:00Z' },
    NOV_2026,
  );
  assert.equal(info.plan, 'standard');
  assert.equal(info.isTrialActive, true);
  assert.equal(info.planLapsed, false);
});

test('free stays free', () => {
  assert.equal(isPaidPlanCurrent({ plan: 'free', plan_season: 2026 }, 2026), false);
  assert.equal(isPaidPlanCurrent(null, 2026), false);
  assert.equal(computePlanInfo({ plan: 'free' }, NOV_2026).planLapsed, false);
});

test('season label', () => {
  assert.equal(seasonLabel(2026), '2026–27');
  assert.equal(seasonLabel(2099), '2099–00');
});
