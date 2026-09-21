import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

// ─────────────────────────────────────────────────────────────
// /api/picks/pick-counts — data source for the picks page's "How the Pool
// Picked" game-card bar. A game is only ever revealed once it has kicked
// off OR every active participant has submitted for the week — the
// property that matters is that a game meeting NEITHER condition must
// never appear in the response, no matter how many picks already exist
// for it, so a client bug can't render picks early. Aggregation
// correctness, and the "everyone's submitted" reveal path unlocking a
// still-scheduled game, are the other two things this covers.
//
// This is a plain Next.js Route Handler (unlike the Server Actions used by
// most other specs in this suite), so it's called directly over HTTP via
// Playwright's `request` fixture instead of imported and invoked in-process.
// ─────────────────────────────────────────────────────────────

import { createPool } from '../../src/actions/createPool';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY!
);

test.describe('GET /api/picks/pick-counts', () => {
  test('omits a still-scheduled game and aggregates a live game by predicted winner', async ({ request }) => {
    test.setTimeout(30000);
    const ownerEmail = `e2e-pick-counts-${Date.now()}@sundayhuddle.net`;
    let poolId: string | undefined;
    const gameIds: string[] = [];
    const season = 2020;
    const week = 3;

    try {
      const created = await createPool({
        name: 'E2E Pick Counts Pool',
        created_by: ownerEmail,
        season,
        season_scope: [2],
        is_private: false,
      });
      expect(created.success).toBe(true);
      if (!created.success) return;
      poolId = created.data.id as string;

      // A 4th active participant (Devon) deliberately gets no pick at all —
      // keeps "everyone's submitted" false so the scheduled game's own
      // reveal path (asserted below) stays isolated to just that condition,
      // rather than accidentally tripping the all-submitted path once every
      // *other* participant happens to have a pick somewhere in the week.
      const { data: participants, error: participantsError } = await supabase
        .from('participants')
        .insert([
          { pool_id: poolId, name: 'Priya', is_active: true },
          { pool_id: poolId, name: 'Marcus', is_active: true },
          { pool_id: poolId, name: 'Sam', is_active: true },
          { pool_id: poolId, name: 'Devon', is_active: true },
        ])
        .select('id');
      if (participantsError || !participants) throw new Error(`Failed to seed participants: ${participantsError?.message}`);

      const liveGameId = `e2e-pickcounts-${season}-w${week}-live-${Date.now()}`;
      const scheduledGameId = `e2e-pickcounts-${season}-w${week}-scheduled-${Date.now()}`;
      gameIds.push(liveGameId, scheduledGameId);

      const { error: gamesError } = await supabase.from('games').insert([
        {
          id: liveGameId, season, season_type: 2, week,
          home_team: 'Kansas City Chiefs', away_team: 'Dallas Cowboys',
          home_team_id: 1, away_team_id: 2,
          kickoff_time: '2020-09-20T13:00:00Z', status: 'live',
        },
        {
          id: scheduledGameId, season, season_type: 2, week,
          home_team: 'Buffalo Bills', away_team: 'Miami Dolphins',
          home_team_id: 3, away_team_id: 4,
          kickoff_time: '2020-09-20T20:00:00Z', status: 'scheduled',
        },
      ]);
      if (gamesError) throw new Error(`Failed to seed games: ${gamesError.message}`);

      // Two participants pick Kansas City on the live game, one picks Dallas;
      // one pick already exists on the still-scheduled game — that one must
      // never come back, no matter how the counts are aggregated.
      const { error: picksError } = await supabase.from('picks').insert([
        { pool_id: poolId, game_id: liveGameId, participant_id: participants[0].id, predicted_winner: 'Kansas City Chiefs', confidence_points: 5 },
        { pool_id: poolId, game_id: liveGameId, participant_id: participants[1].id, predicted_winner: 'Kansas City Chiefs', confidence_points: 3 },
        { pool_id: poolId, game_id: liveGameId, participant_id: participants[2].id, predicted_winner: 'Dallas Cowboys', confidence_points: 1 },
        { pool_id: poolId, game_id: scheduledGameId, participant_id: participants[0].id, predicted_winner: 'Buffalo Bills', confidence_points: 4 },
      ]);
      if (picksError) throw new Error(`Failed to seed picks: ${picksError.message}`);

      const res = await request.get(`/api/picks/pick-counts?poolId=${poolId}&week=${week}&seasonType=2&season=${season}`);
      expect(res.ok()).toBe(true);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.counts[liveGameId]).toEqual({ 'Kansas City Chiefs': 2, 'Dallas Cowboys': 1 });
      expect(data.counts[scheduledGameId]).toBeUndefined();

      // Per-participant detail for the revealed game, most confidence points
      // first; the still-hidden game must carry no detail either.
      expect(data.details[liveGameId]['Kansas City Chiefs']).toEqual([
        { name: 'Priya', points: 5 },
        { name: 'Marcus', points: 3 },
      ]);
      expect(data.details[liveGameId]['Dallas Cowboys']).toEqual([{ name: 'Sam', points: 1 }]);
      expect(data.details[scheduledGameId]).toBeUndefined();
    } finally {
      if (poolId) await supabase.from('picks').delete().eq('pool_id', poolId);
      if (gameIds.length) await supabase.from('games').delete().in('id', gameIds);
      if (poolId) await supabase.from('participants').delete().eq('pool_id', poolId);
      if (poolId) await supabase.from('pools').delete().eq('id', poolId);
      await supabase.from('huddles').delete().eq('commissioner_email', ownerEmail);
    }
  });

  test('returns an empty object when no game in the week has started yet', async ({ request }) => {
    test.setTimeout(30000);
    const ownerEmail = `e2e-pick-counts-none-${Date.now()}@sundayhuddle.net`;
    let poolId: string | undefined;
    const gameIds: string[] = [];
    const season = 2020;
    const week = 4;

    try {
      const created = await createPool({
        name: 'E2E Pick Counts No Games Started Pool',
        created_by: ownerEmail,
        season,
        season_scope: [2],
        is_private: false,
      });
      expect(created.success).toBe(true);
      if (!created.success) return;
      poolId = created.data.id as string;

      const scheduledGameId = `e2e-pickcounts-${season}-w${week}-scheduled-${Date.now()}`;
      gameIds.push(scheduledGameId);
      const { error: gamesError } = await supabase.from('games').insert({
        id: scheduledGameId, season, season_type: 2, week,
        home_team: 'Green Bay Packers', away_team: 'Chicago Bears',
        home_team_id: 5, away_team_id: 6,
        kickoff_time: '2020-09-27T13:00:00Z', status: 'scheduled',
      });
      if (gamesError) throw new Error(`Failed to seed games: ${gamesError.message}`);

      await supabase.from('picks').insert({
        pool_id: poolId, game_id: scheduledGameId, participant_id: null, predicted_winner: 'Green Bay Packers', confidence_points: 1,
      });

      const res = await request.get(`/api/picks/pick-counts?poolId=${poolId}&week=${week}&seasonType=2&season=${season}`);
      expect(res.ok()).toBe(true);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.counts).toEqual({});
      expect(data.details).toEqual({});
    } finally {
      if (poolId) await supabase.from('picks').delete().eq('pool_id', poolId);
      if (gameIds.length) await supabase.from('games').delete().in('id', gameIds);
      if (poolId) await supabase.from('pools').delete().eq('id', poolId);
      await supabase.from('huddles').delete().eq('commissioner_email', ownerEmail);
    }
  });

  test('reveals a still-scheduled game once every active participant has submitted for the week', async ({ request }) => {
    test.setTimeout(30000);
    const ownerEmail = `e2e-pick-counts-allsub-${Date.now()}@sundayhuddle.net`;
    let poolId: string | undefined;
    const gameIds: string[] = [];
    const season = 2020;
    const week = 5;

    try {
      const created = await createPool({
        name: 'E2E Pick Counts All Submitted Pool',
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
        .select('id');
      if (participantsError || !participants) throw new Error(`Failed to seed participants: ${participantsError?.message}`);

      const scheduledGameId = `e2e-pickcounts-${season}-w${week}-scheduled-${Date.now()}`;
      gameIds.push(scheduledGameId);
      const { error: gamesError } = await supabase.from('games').insert({
        id: scheduledGameId, season, season_type: 2, week,
        home_team: 'Green Bay Packers', away_team: 'Chicago Bears',
        home_team_id: 5, away_team_id: 6,
        kickoff_time: '2020-10-04T13:00:00Z', status: 'scheduled',
      });
      if (gamesError) throw new Error(`Failed to seed games: ${gamesError.message}`);

      // Both active participants have a pick in — game is still scheduled,
      // but nobody has an unmade pick left, so this is revealable.
      const { error: picksError } = await supabase.from('picks').insert([
        { pool_id: poolId, game_id: scheduledGameId, participant_id: participants[0].id, predicted_winner: 'Green Bay Packers', confidence_points: 1 },
        { pool_id: poolId, game_id: scheduledGameId, participant_id: participants[1].id, predicted_winner: 'Chicago Bears', confidence_points: 1 },
      ]);
      if (picksError) throw new Error(`Failed to seed picks: ${picksError.message}`);

      const res = await request.get(`/api/picks/pick-counts?poolId=${poolId}&week=${week}&seasonType=2&season=${season}`);
      expect(res.ok()).toBe(true);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.counts[scheduledGameId]).toEqual({ 'Green Bay Packers': 1, 'Chicago Bears': 1 });
    } finally {
      if (poolId) await supabase.from('picks').delete().eq('pool_id', poolId);
      if (gameIds.length) await supabase.from('games').delete().in('id', gameIds);
      if (poolId) await supabase.from('participants').delete().eq('pool_id', poolId);
      if (poolId) await supabase.from('pools').delete().eq('id', poolId);
      await supabase.from('huddles').delete().eq('commissioner_email', ownerEmail);
    }
  });

  test('keeps a still-scheduled game hidden while only some active participants have submitted', async ({ request }) => {
    test.setTimeout(30000);
    const ownerEmail = `e2e-pick-counts-partial-${Date.now()}@sundayhuddle.net`;
    let poolId: string | undefined;
    const gameIds: string[] = [];
    const season = 2020;
    const week = 6;

    try {
      const created = await createPool({
        name: 'E2E Pick Counts Partial Submitted Pool',
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
        .select('id');
      if (participantsError || !participants) throw new Error(`Failed to seed participants: ${participantsError?.message}`);

      const scheduledGameId = `e2e-pickcounts-${season}-w${week}-scheduled-${Date.now()}`;
      gameIds.push(scheduledGameId);
      const { error: gamesError } = await supabase.from('games').insert({
        id: scheduledGameId, season, season_type: 2, week,
        home_team: 'Green Bay Packers', away_team: 'Chicago Bears',
        home_team_id: 5, away_team_id: 6,
        kickoff_time: '2020-10-11T13:00:00Z', status: 'scheduled',
      });
      if (gamesError) throw new Error(`Failed to seed games: ${gamesError.message}`);

      // Only Alice has picked — Bob hasn't, so this must stay hidden.
      const { error: picksError } = await supabase.from('picks').insert({
        pool_id: poolId, game_id: scheduledGameId, participant_id: participants[0].id, predicted_winner: 'Green Bay Packers', confidence_points: 1,
      });
      if (picksError) throw new Error(`Failed to seed picks: ${picksError.message}`);

      const res = await request.get(`/api/picks/pick-counts?poolId=${poolId}&week=${week}&seasonType=2&season=${season}`);
      expect(res.ok()).toBe(true);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.counts).toEqual({});
    } finally {
      if (poolId) await supabase.from('picks').delete().eq('pool_id', poolId);
      if (gameIds.length) await supabase.from('games').delete().in('id', gameIds);
      if (poolId) await supabase.from('participants').delete().eq('pool_id', poolId);
      if (poolId) await supabase.from('pools').delete().eq('id', poolId);
      await supabase.from('huddles').delete().eq('commissioner_email', ownerEmail);
    }
  });
});
