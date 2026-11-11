// Pure rules in supabase/functions/_shared/confidence-results.ts — the one
// implementation shared by the cron (Deno) and computeSeasonReview (Node).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REGULAR_SEASON_PERIODS,
  computeConfidenceResults,
  formatCoWinnerCorrectPicks,
  isGameFinished,
  planResultWrites,
  type ConfidenceResultsInput,
  type ResultGame,
  type ResultPick,
} from '../../supabase/functions/_shared/confidence-results';
import { getRegularSeasonPeriods } from '../../src/lib/utils';

const P = { alice: { id: 'a', name: 'Alice' }, bob: { id: 'b', name: 'Bob' }, cara: { id: 'c', name: 'Cara' } };

function weekOf(week: number, results: Array<{ alice: number; bob: number }>, seasonType = 2) {
  // One game per entry; each participant's confidence = given points if they
  // picked the winner, otherwise they picked the loser for 1 point.
  const games: ResultGame[] = [];
  const picks: ResultPick[] = [];
  results.forEach((r, i) => {
    const id = `w${seasonType}-${week}-${i}`;
    games.push({ id, week, season_type: seasonType, winner: 'HOME', status: 'final' });
    picks.push({ participant_id: 'a', game_id: id, predicted_winner: r.alice > 0 ? 'HOME' : 'AWAY', confidence_points: Math.max(r.alice, 1) });
    picks.push({ participant_id: 'b', game_id: id, predicted_winner: r.bob > 0 ? 'HOME' : 'AWAY', confidence_points: Math.max(r.bob, 1) });
  });
  return { games, picks };
}

function input(parts: Array<{ games: ResultGame[]; picks: ResultPick[] }>, pool: ConfidenceResultsInput['pool'] = { pool_type: 'normal', tie_breaker_answer: null }, extra: Partial<ConfidenceResultsInput> = {}): ConfidenceResultsInput {
  return {
    participants: [P.bob, P.alice],
    games: parts.flatMap(p => p.games),
    picks: parts.flatMap(p => p.picks),
    tieBreakers: [],
    pool,
    ...extra,
  };
}

test('period boundaries match src/lib/utils.ts', () => {
  assert.deepEqual(REGULAR_SEASON_PERIODS, getRegularSeasonPeriods());
});

test('finished-game rule accepts every terminal status vocabulary and a set winner', () => {
  assert.equal(isGameFinished({ status: 'Final', winner: null }), true);
  assert.equal(isGameFinished({ status: 'post', winner: null }), true);
  assert.equal(isGameFinished({ status: 'cancelled', winner: null }), true);
  assert.equal(isGameFinished({ status: 'live', winner: 'X' }), true);
  assert.equal(isGameFinished({ status: 'live', winner: null }), false);
  assert.equal(isGameFinished({ status: null, winner: null }), false);
});

test('season champion is most periods won, even when another participant has more points', () => {
  // Alice edges Q1-Q3 by a point each; Bob wins Q4 by 40.
  const weeks = [];
  for (let w = 1; w <= 18; w++) {
    if (w === 1 || w === 5 || w === 10) weeks.push(weekOf(w, [{ alice: 2, bob: 1 }]));
    else if (w >= 15) weeks.push(weekOf(w, [{ alice: 0, bob: 10 }]));
    else weeks.push(weekOf(w, [{ alice: 0, bob: 0 }]));
  }
  const r = computeConfidenceResults(input(weeks));
  const alice = r.seasonTotals.find(t => t.participant_id === 'a')!;
  const bob = r.seasonTotals.find(t => t.participant_id === 'b')!;
  assert.ok(bob.total_points > alice.total_points, 'fixture: Bob has more points');
  assert.equal(alice.periods_won, 3);
  assert.equal(bob.periods_won, 1);
  assert.equal(r.champion?.participant_id, 'a');
  assert.equal(r.champion?.tie_breaker_used, false);
  assert.equal(r.regularSeasonComplete, true);
});

test('tied week in a normal pool is shared by every co-winner, ordered by name', () => {
  const r = computeConfidenceResults(input([weekOf(3, [{ alice: 2, bob: 2 }])]));
  const w = r.weeks[0];
  assert.deepEqual(w.winners.map(x => x.name), ['Alice', 'Bob']);
  assert.equal(w.tie_breaker_used, false);
});

test('co-winners with different correct-pick counts keep their own counts', () => {
  // Both on 3 points: Alice 1 correct (3), Bob 2 correct (1 + 2).
  const games: ResultGame[] = [1, 2, 3].map(i => ({ id: `g${i}`, week: 2, season_type: 2, winner: 'H', status: 'final' }));
  const picks: ResultPick[] = [
    { participant_id: 'a', game_id: 'g1', predicted_winner: 'H', confidence_points: 3 },
    { participant_id: 'a', game_id: 'g2', predicted_winner: 'X', confidence_points: 2 },
    { participant_id: 'a', game_id: 'g3', predicted_winner: 'X', confidence_points: 1 },
    { participant_id: 'b', game_id: 'g1', predicted_winner: 'H', confidence_points: 1 },
    { participant_id: 'b', game_id: 'g2', predicted_winner: 'H', confidence_points: 2 },
    { participant_id: 'b', game_id: 'g3', predicted_winner: 'X', confidence_points: 3 },
  ];
  const r = computeConfidenceResults(input([{ games, picks }]));
  const winners = r.weeks[0].winners;
  assert.deepEqual(winners.map(w => [w.name, w.points, w.correct_picks]), [['Alice', 3, 1], ['Bob', 3, 2]]);
  assert.equal(formatCoWinnerCorrectPicks(winners), '1 / 2');
  assert.equal(formatCoWinnerCorrectPicks([{ correct_picks: 2 }, { correct_picks: 2 }]), '2');
});

test('an incomplete week has scores but no winner', () => {
  const part = weekOf(4, [{ alice: 3, bob: 1 }, { alice: 1, bob: 2 }]);
  part.games[1] = { ...part.games[1], winner: null, status: 'live' };
  const r = computeConfidenceResults(input([part]));
  assert.equal(r.weeks[0].complete, false);
  assert.equal(r.weeks[0].winners.length, 0);
  assert.equal(r.weeks[0].scores.find(s => s.participant_id === 'a')?.points, 3);
});

test('non-normal pool ties are broken deterministically, not randomly', () => {
  const part = weekOf(6, [{ alice: 2, bob: 2 }]);
  const pool = { pool_type: 'knockout', tie_breaker_answer: null };
  const first = computeConfidenceResults(input([part], pool)).weeks[0];
  for (let i = 0; i < 20; i++) {
    assert.deepEqual(computeConfidenceResults(input([part], pool)).weeks[0].winners, first.winners);
  }
  assert.equal(first.winners.length, 1);
  assert.equal(first.tie_breaker_used, true);
});

test('playoff ties use the tie-breaker answer closest to the pool answer', () => {
  const part = weekOf(1, [{ alice: 2, bob: 2 }], 3);
  const r = computeConfidenceResults(input([part], { pool_type: 'normal', tie_breaker_answer: 45 }, {
    tieBreakers: [
      { participant_id: 'a', week: 1, season_type: 3, answer: 30 },
      { participant_id: 'b', week: 1, season_type: 3, answer: '44' },
    ],
  }));
  assert.deepEqual(r.weeks[0].winners.map(w => w.name), ['Bob']);
  assert.equal(r.weeks[0].tie_breaker_difference, 1);
});

test('nobody wins a week where every score is 0', () => {
  const r = computeConfidenceResults(input([weekOf(7, [{ alice: 0, bob: 0 }])]));
  assert.equal(r.weeks[0].winners.length, 0);
});

test('write plan is empty when stored rows already match, and corrects a stale winner', () => {
  const part = weekOf(3, [{ alice: 3, bob: 1 }]);
  const pool = { pool_type: 'normal', tie_breaker_answer: null };
  const results = computeConfidenceResults(input([part], pool));
  const fresh = planResultWrites('pool', 2026, pool, results, { scores: [], weeklyWinners: [], periodWinners: [], seasonWinner: null });
  assert.equal(fresh.scores.length, 1);
  assert.equal(fresh.weekly_upserts.length, 1);

  const stored = {
    scores: fresh.scores[0].rows.map(r => ({ ...r, week: 3, season_type: 2 })),
    weeklyWinners: fresh.weekly_upserts.map(w => ({ ...w })),
    periodWinners: [],
    seasonWinner: null,
  };
  const again = planResultWrites('pool', 2026, pool, results, stored);
  assert.equal(again.scores.length + again.weekly_upserts.length + again.weekly_deletes.length, 0);

  const stale = { ...stored, weeklyWinners: [{ ...stored.weeklyWinners[0], winner_participant_id: 'b', winner_name: 'Bob' }] };
  const fix = planResultWrites('pool', 2026, pool, results, stale);
  assert.equal(fix.weekly_upserts[0].winner_participant_id, 'a');
});
