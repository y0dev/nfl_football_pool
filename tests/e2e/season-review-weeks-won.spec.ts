import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

// ─────────────────────────────────────────────────────────────
// computeSeasonReview's weekly-winner/weeks_won calculation (src/lib/
// season-review.ts) — the centralized source the Season Review tab, the
// Quarter Leaderboard, and Close Season all read from. A week must be
// fully decided (every game finished) before anyone can be credited with
// winning it — whoever's ahead on the games that HAVE finished so far in a
// still-in-progress week is not a week winner yet, just a current leader.
// Regression coverage for the bug where an incomplete week's leader was
// counted the same as an actual week winner.
// ─────────────────────────────────────────────────────────────

import { createPool } from '../../src/actions/createPool';
import { computeSeasonReview, getTiedWinnerName } from '../../src/lib/season-review';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY!
);

test.describe('computeSeasonReview — weeks_won only credits a fully decided week', () => {
  test('a leader in an in-progress week is not credited; a finished week still is', async () => {
    test.setTimeout(30000);
    const ownerEmail = `e2e-weeks-won-${Date.now()}@sundayhuddle.net`;
    let poolId: string | undefined;
    const gameIds: string[] = [];
    const season = 2021;
    const incompleteWeek = 3;
    const completeWeek = 4;

    try {
      const created = await createPool({
        name: 'E2E Weeks Won Pool',
        created_by: ownerEmail,
        season,
        season_scope: [2],
        is_private: false,
      });
      expect(created.success).toBe(true);
      if (!created.success) return;
      poolId = created.data.id as string;

      const { data: participants, error: participantsError } = await supabase
        .from('participants')
        .insert([
          { pool_id: poolId, name: 'Alice', is_active: true },
          { pool_id: poolId, name: 'Bob', is_active: true },
        ])
        .select('id, name');
      if (participantsError || !participants) throw new Error(`Failed to seed participants: ${participantsError?.message}`);
      const alice = participants.find(p => p.name === 'Alice')!;
      const bob = participants.find(p => p.name === 'Bob')!;

      // Week 3 (incomplete): one game finished, one still scheduled. Alice
      // is ahead on the decided game alone — the exact shape of the bug —
      // but the week overall isn't over.
      const w3FinishedId = `e2e-weekswon-${season}-w${incompleteWeek}-finished-${Date.now()}`;
      const w3ScheduledId = `e2e-weekswon-${season}-w${incompleteWeek}-scheduled-${Date.now()}`;
      gameIds.push(w3FinishedId, w3ScheduledId);

      // Week 4 (complete): single finished game, Alice wins it outright too.
      const w4Id = `e2e-weekswon-${season}-w${completeWeek}-${Date.now()}`;
      gameIds.push(w4Id);

      const { error: gamesError } = await supabase.from('games').insert([
        {
          id: w3FinishedId, season, season_type: 2, week: incompleteWeek,
          home_team: 'Kansas City Chiefs', away_team: 'Dallas Cowboys',
          home_team_id: 1, away_team_id: 2,
          kickoff_time: '2021-09-20T13:00:00Z', status: 'final', winner: 'Kansas City Chiefs',
        },
        {
          id: w3ScheduledId, season, season_type: 2, week: incompleteWeek,
          home_team: 'Buffalo Bills', away_team: 'Miami Dolphins',
          home_team_id: 3, away_team_id: 4,
          kickoff_time: '2021-09-20T20:00:00Z', status: 'scheduled', winner: null,
        },
        {
          id: w4Id, season, season_type: 2, week: completeWeek,
          home_team: 'Green Bay Packers', away_team: 'Chicago Bears',
          home_team_id: 5, away_team_id: 6,
          kickoff_time: '2021-09-27T13:00:00Z', status: 'final', winner: 'Green Bay Packers',
        },
      ]);
      if (gamesError) throw new Error(`Failed to seed games: ${gamesError.message}`);

      const { error: picksError } = await supabase.from('picks').insert([
        // Week 3: Alice correctly picks the one decided game (high
        // confidence); Bob's only pick is on the still-scheduled game, so
        // he has 0 points so far. Alice is "leading" week 3, but it isn't
        // over — she must NOT be credited with winning it.
        { pool_id: poolId, game_id: w3FinishedId, participant_id: alice.id, predicted_winner: 'Kansas City Chiefs', confidence_points: 10 },
        { pool_id: poolId, game_id: w3ScheduledId, participant_id: bob.id, predicted_winner: 'Buffalo Bills', confidence_points: 5 },
        // Week 4: fully decided — Alice correctly picks the winner, Bob
        // doesn't. This week SHOULD be credited to Alice.
        { pool_id: poolId, game_id: w4Id, participant_id: alice.id, predicted_winner: 'Green Bay Packers', confidence_points: 8 },
        { pool_id: poolId, game_id: w4Id, participant_id: bob.id, predicted_winner: 'Chicago Bears', confidence_points: 8 },
      ]);
      if (picksError) throw new Error(`Failed to seed picks: ${picksError.message}`);

      const review = await computeSeasonReview(poolId, season);

      const weeklyWinnerWeeks = review.weeklyWinners.map(w => w.week);
      expect(weeklyWinnerWeeks).not.toContain(incompleteWeek);
      expect(weeklyWinnerWeeks).toContain(completeWeek);

      const week4Winner = review.weeklyWinners.find(w => w.week === completeWeek);
      expect(week4Winner?.winner_participant_id).toBe(alice.id);

      const aliceStats = review.participantStats.find(p => p.participant_id === alice.id);
      // Only week 4 counts — the week-3 lead (which the old code counted)
      // must not inflate this to 2.
      expect(aliceStats?.weeks_won).toBe(1);
    } finally {
      if (poolId) await supabase.from('picks').delete().eq('pool_id', poolId);
      if (gameIds.length) await supabase.from('games').delete().in('id', gameIds);
      if (poolId) await supabase.from('participants').delete().eq('pool_id', poolId);
      if (poolId) await supabase.from('pools').delete().eq('id', poolId);
      await supabase.from('huddles').delete().eq('commissioner_email', ownerEmail);
    }
  });

  test('a tied week credits every tied participant, including a quarter-ending week; the quarter still has one winner', async () => {
    test.setTimeout(30000);
    const ownerEmail = `e2e-weeks-won-tie-${Date.now()}@sundayhuddle.net`;
    let poolId: string | undefined;
    const season = 2021;
    const tiedWeek = 8;
    const tieBreakerWeek = 9; // ends Q2 — the tie-breaker decides the quarter, not this week
    const tiedGameId = `e2e-weekswon-tie-${season}-w${tiedWeek}-${Date.now()}`;
    const tieBreakerGameId = `e2e-weekswon-tie-${season}-w${tieBreakerWeek}-${Date.now()}`;

    try {
      const created = await createPool({
        name: 'E2E Weeks Won Tie Pool',
        created_by: ownerEmail,
        season,
        season_scope: [2],
        is_private: false,
      });
      expect(created.success).toBe(true);
      if (!created.success) return;
      poolId = created.data.id as string;

      const { data: participants, error: participantsError } = await supabase
        .from('participants')
        .insert([
          { pool_id: poolId, name: 'Karen', is_active: true },
          { pool_id: poolId, name: 'Jason', is_active: true },
          { pool_id: poolId, name: 'Brandon', is_active: true },
        ])
        .select('id, name');
      if (participantsError || !participants) throw new Error(`Failed to seed participants: ${participantsError?.message}`);
      const idOf = (name: string) => participants.find(p => p.name === name)!.id;

      const { error: gamesError } = await supabase.from('games').insert([
        {
          id: tiedGameId, season, season_type: 2, week: tiedWeek,
          home_team: 'Green Bay Packers', away_team: 'Chicago Bears',
          home_team_id: 5, away_team_id: 6,
          kickoff_time: '2021-10-31T13:00:00Z', status: 'final', winner: 'Green Bay Packers',
        },
        {
          id: tieBreakerGameId, season, season_type: 2, week: tieBreakerWeek,
          home_team: 'Buffalo Bills', away_team: 'Miami Dolphins',
          home_team_id: 3, away_team_id: 4,
          kickoff_time: '2021-11-07T13:00:00Z', status: 'final', winner: 'Buffalo Bills',
        },
      ]);
      if (gamesError) throw new Error(`Failed to seed games: ${gamesError.message}`);

      const { error: picksError } = await supabase.from('picks').insert([
        { pool_id: poolId, game_id: tiedGameId, participant_id: idOf('Karen'), predicted_winner: 'Green Bay Packers', confidence_points: 9 },
        { pool_id: poolId, game_id: tiedGameId, participant_id: idOf('Jason'), predicted_winner: 'Green Bay Packers', confidence_points: 9 },
        { pool_id: poolId, game_id: tiedGameId, participant_id: idOf('Brandon'), predicted_winner: 'Green Bay Packers', confidence_points: 4 },
        { pool_id: poolId, game_id: tieBreakerGameId, participant_id: idOf('Karen'), predicted_winner: 'Buffalo Bills', confidence_points: 5 },
        { pool_id: poolId, game_id: tieBreakerGameId, participant_id: idOf('Jason'), predicted_winner: 'Buffalo Bills', confidence_points: 5 },
      ]);
      if (picksError) throw new Error(`Failed to seed picks: ${picksError.message}`);

      const review = await computeSeasonReview(poolId, season);

      const tied = review.weeklyWinners.find(w => w.week === tiedWeek);
      expect(tied?.winner_name).toBe('Jason & Karen');
      expect([...(tied?.winner_participant_ids ?? [])].sort()).toEqual([idOf('Jason'), idOf('Karen')].sort());
      expect(getTiedWinnerName(review, tiedWeek)).toBe('Jason & Karen');

      expect(getTiedWinnerName(review, tieBreakerWeek)).toBe('Jason & Karen');

      // Karen and Jason finish Q2 level on points and weeks won — it still
      // resolves to exactly one quarter winner.
      const q2Winners = review.quarterlyWinners.filter(q => q.period_name === 'Q2');
      expect(q2Winners).toHaveLength(1);
      expect([idOf('Jason'), idOf('Karen')]).toContain(q2Winners[0].winner_participant_id);

      // Each week counts once overall, even though both have two winners.
      expect(review.weeklyWinners).toHaveLength(2);
      const statOf = (name: string) => review.participantStats.find(p => p.participant_id === idOf(name))!;
      expect(statOf('Brandon').weeks_won).toBe(0);
      expect(statOf('Karen').weeks_won).toBe(2);
      expect(statOf('Jason').weeks_won).toBe(2);
    } finally {
      if (poolId) await supabase.from('picks').delete().eq('pool_id', poolId);
      await supabase.from('games').delete().in('id', [tiedGameId, tieBreakerGameId]);
      if (poolId) await supabase.from('participants').delete().eq('pool_id', poolId);
      if (poolId) await supabase.from('pools').delete().eq('id', poolId);
      await supabase.from('huddles').delete().eq('commissioner_email', ownerEmail);
    }
  });
});
