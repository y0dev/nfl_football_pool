import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

// ─────────────────────────────────────────────────────────────
// /api/pickem/pick-counts — Pick'em's counterpart to
// /api/picks/pick-counts (see tests/e2e/pick-counts.spec.ts for the
// Confidence version). Same reveal rule, sourced from pickem_picks
// instead: a game is only ever returned once it has started, or once
// every active participant has a pick in for EVERY game in the week —
// Pick'em's own, stricter definition of "submitted" (matches
// submitPickemPick's isAlreadyComplete rule in src/lib/pickem.ts), not
// just "picked at least one game."
// ─────────────────────────────────────────────────────────────

import { createPool } from '../../src/actions/createPool';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY!
);

async function setupPool(season: number) {
  const ownerEmail = `e2e-pickem-counts-${Date.now()}@sundayhuddle.net`;
  const created = await createPool({
    name: 'E2E Pickem Pick Counts Pool',
    created_by: ownerEmail,
    season,
    season_scope: [2],
    competition_type: 'PICKEM',
    is_private: false,
  });
  expect(created.success).toBe(true);
  if (!created.success) throw new Error(created.error);
  return { ownerEmail, poolId: created.data.id as string };
}

async function cleanup(poolId: string | undefined, gameIds: string[], ownerEmail: string) {
  if (poolId) await supabase.from('pickem_picks').delete().eq('pool_id', poolId);
  if (gameIds.length) await supabase.from('games').delete().in('id', gameIds);
  if (poolId) await supabase.from('participants').delete().eq('pool_id', poolId);
  if (poolId) await supabase.from('pools').delete().eq('id', poolId);
  await supabase.from('huddles').delete().eq('commissioner_email', ownerEmail);
}

test.describe('GET /api/pickem/pick-counts', () => {
  test('omits a still-scheduled game and aggregates a live game by selected_team', async ({ request }) => {
    test.setTimeout(30000);
    const season = 2020;
    const week = 3;
    const { ownerEmail, poolId } = await setupPool(season);
    const gameIds: string[] = [];

    try {
      // pickem_picks.participant_id is NOT NULL (unlike Confidence's picks
      // table), so this needs real participant rows rather than null.
      const { data: participants, error: participantsError } = await supabase
        .from('participants')
        .insert([
          { pool_id: poolId, name: 'Alice', is_active: true },
          { pool_id: poolId, name: 'Bob', is_active: true },
          { pool_id: poolId, name: 'Carol', is_active: true },
        ])
        .select('id');
      if (participantsError || !participants) throw new Error(`Failed to seed participants: ${participantsError?.message}`);

      const liveGameId = `e2e-pkmcounts-${season}-w${week}-live-${Date.now()}`;
      const scheduledGameId = `e2e-pkmcounts-${season}-w${week}-scheduled-${Date.now()}`;
      gameIds.push(liveGameId, scheduledGameId);

      const { error: gamesError } = await supabase.from('games').insert([
        {
          id: liveGameId, season, season_type: 2, week,
          home_team: 'Kansas City Chiefs', away_team: 'Dallas Cowboys',
          home_team_id: 'KC', away_team_id: 'DAL',
          kickoff_time: '2020-09-20T13:00:00Z', status: 'live',
        },
        {
          id: scheduledGameId, season, season_type: 2, week,
          home_team: 'Buffalo Bills', away_team: 'Miami Dolphins',
          home_team_id: 'BUF', away_team_id: 'MIA',
          kickoff_time: '2020-09-20T20:00:00Z', status: 'scheduled',
        },
      ]);
      if (gamesError) throw new Error(`Failed to seed games: ${gamesError.message}`);

      const { error: picksError } = await supabase.from('pickem_picks').insert([
        { pool_id: poolId, game_id: liveGameId, participant_id: participants[0].id, season, season_type: 2, week, selected_team: 'KC' },
        { pool_id: poolId, game_id: liveGameId, participant_id: participants[1].id, season, season_type: 2, week, selected_team: 'KC' },
        { pool_id: poolId, game_id: liveGameId, participant_id: participants[2].id, season, season_type: 2, week, selected_team: 'DAL' },
        { pool_id: poolId, game_id: scheduledGameId, participant_id: participants[0].id, season, season_type: 2, week, selected_team: 'BUF' },
      ]);
      if (picksError) throw new Error(`Failed to seed picks: ${picksError.message}`);

      const res = await request.get(`/api/pickem/pick-counts?poolId=${poolId}&week=${week}&seasonType=2&season=${season}`);
      expect(res.ok()).toBe(true);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.counts[liveGameId]).toEqual({ KC: 2, DAL: 1 });
      expect(data.counts[scheduledGameId]).toBeUndefined();
    } finally {
      await cleanup(poolId, gameIds, ownerEmail);
    }
  });

  test('reveals a still-scheduled game once every active participant has a complete week of picks', async ({ request }) => {
    test.setTimeout(30000);
    const season = 2020;
    const week = 5;
    const { ownerEmail, poolId } = await setupPool(season);
    const gameIds: string[] = [];

    try {
      const { data: participants, error: participantsError } = await supabase
        .from('participants')
        .insert([
          { pool_id: poolId, name: 'Alice', is_active: true },
          { pool_id: poolId, name: 'Bob', is_active: true },
        ])
        .select('id');
      if (participantsError || !participants) throw new Error(`Failed to seed participants: ${participantsError?.message}`);

      // Two eligible games this week — a participant only counts as "done"
      // once they've picked BOTH, per Pick'em's own completion rule.
      const gameAId = `e2e-pkmcounts-${season}-w${week}-a-${Date.now()}`;
      const gameBId = `e2e-pkmcounts-${season}-w${week}-b-${Date.now()}`;
      gameIds.push(gameAId, gameBId);
      const { error: gamesError } = await supabase.from('games').insert([
        { id: gameAId, season, season_type: 2, week, home_team: 'Green Bay Packers', away_team: 'Chicago Bears', home_team_id: 'GB', away_team_id: 'CHI', kickoff_time: '2020-10-04T13:00:00Z', status: 'scheduled' },
        { id: gameBId, season, season_type: 2, week, home_team: 'Denver Broncos', away_team: 'Las Vegas Raiders', home_team_id: 'DEN', away_team_id: 'LV', kickoff_time: '2020-10-04T16:00:00Z', status: 'scheduled' },
      ]);
      if (gamesError) throw new Error(`Failed to seed games: ${gamesError.message}`);

      const { error: picksError } = await supabase.from('pickem_picks').insert([
        { pool_id: poolId, game_id: gameAId, participant_id: participants[0].id, season, season_type: 2, week, selected_team: 'GB' },
        { pool_id: poolId, game_id: gameBId, participant_id: participants[0].id, season, season_type: 2, week, selected_team: 'DEN' },
        { pool_id: poolId, game_id: gameAId, participant_id: participants[1].id, season, season_type: 2, week, selected_team: 'CHI' },
        { pool_id: poolId, game_id: gameBId, participant_id: participants[1].id, season, season_type: 2, week, selected_team: 'DEN' },
      ]);
      if (picksError) throw new Error(`Failed to seed picks: ${picksError.message}`);

      const res = await request.get(`/api/pickem/pick-counts?poolId=${poolId}&week=${week}&seasonType=2&season=${season}`);
      expect(res.ok()).toBe(true);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.counts[gameAId]).toEqual({ GB: 1, CHI: 1 });
      expect(data.counts[gameBId]).toEqual({ DEN: 2 });
    } finally {
      await cleanup(poolId, gameIds, ownerEmail);
    }
  });

  test('keeps a still-scheduled game hidden when a participant has only a partial week of picks', async ({ request }) => {
    test.setTimeout(30000);
    const season = 2020;
    const week = 6;
    const { ownerEmail, poolId } = await setupPool(season);
    const gameIds: string[] = [];

    try {
      const { data: participants, error: participantsError } = await supabase
        .from('participants')
        .insert([
          { pool_id: poolId, name: 'Alice', is_active: true },
          { pool_id: poolId, name: 'Bob', is_active: true },
        ])
        .select('id');
      if (participantsError || !participants) throw new Error(`Failed to seed participants: ${participantsError?.message}`);

      const gameAId = `e2e-pkmcounts-${season}-w${week}-a-${Date.now()}`;
      const gameBId = `e2e-pkmcounts-${season}-w${week}-b-${Date.now()}`;
      gameIds.push(gameAId, gameBId);
      const { error: gamesError } = await supabase.from('games').insert([
        { id: gameAId, season, season_type: 2, week, home_team: 'Green Bay Packers', away_team: 'Chicago Bears', home_team_id: 'GB', away_team_id: 'CHI', kickoff_time: '2020-10-11T13:00:00Z', status: 'scheduled' },
        { id: gameBId, season, season_type: 2, week, home_team: 'Denver Broncos', away_team: 'Las Vegas Raiders', home_team_id: 'DEN', away_team_id: 'LV', kickoff_time: '2020-10-11T16:00:00Z', status: 'scheduled' },
      ]);
      if (gamesError) throw new Error(`Failed to seed games: ${gamesError.message}`);

      // Alice has picked both games; Bob has only picked one — the week
      // isn't complete, so neither game should be revealed yet.
      const { error: picksError } = await supabase.from('pickem_picks').insert([
        { pool_id: poolId, game_id: gameAId, participant_id: participants[0].id, season, season_type: 2, week, selected_team: 'GB' },
        { pool_id: poolId, game_id: gameBId, participant_id: participants[0].id, season, season_type: 2, week, selected_team: 'DEN' },
        { pool_id: poolId, game_id: gameAId, participant_id: participants[1].id, season, season_type: 2, week, selected_team: 'CHI' },
      ]);
      if (picksError) throw new Error(`Failed to seed picks: ${picksError.message}`);

      const res = await request.get(`/api/pickem/pick-counts?poolId=${poolId}&week=${week}&seasonType=2&season=${season}`);
      expect(res.ok()).toBe(true);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.counts).toEqual({});
    } finally {
      await cleanup(poolId, gameIds, ownerEmail);
    }
  });
});
