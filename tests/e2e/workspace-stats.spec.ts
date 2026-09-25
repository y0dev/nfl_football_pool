import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

// ─────────────────────────────────────────────────────────────
// GET /api/pools/[id]/workspace-stats — gamesStarted flag. Drives the
// Overview tab's "Make Picks" override shortcut next to a still-missing
// participant (src/components/pools/pool-workspace.tsx): that shortcut
// should only appear once a game has actually kicked off, since before
// that the participant can still submit for themselves and the link would
// just be redundant. Covers both states from the same field the client reads.
// ─────────────────────────────────────────────────────────────

import { createPool } from '../../src/actions/createPool';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY!
);

test.describe('GET /api/pools/[id]/workspace-stats', () => {
  test('gamesStarted is false while every game in the week is still scheduled in the future', async ({ request }) => {
    test.setTimeout(30000);
    const ownerEmail = `e2e-workspace-stats-future-${Date.now()}@sundayhuddle.net`;
    let poolId: string | undefined;
    const gameIds: string[] = [];
    const season = 2020;
    const week = 9;

    try {
      const created = await createPool({
        name: 'E2E Workspace Stats Not-Started Pool',
        created_by: ownerEmail,
        season,
        season_scope: [2],
        is_private: false,
      });
      expect(created.success).toBe(true);
      if (!created.success) return;
      poolId = created.data.id as string;

      const futureGameId = `e2e-wstats-${season}-w${week}-future-${Date.now()}`;
      gameIds.push(futureGameId);
      const farFuture = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const { error: gamesError } = await supabase.from('games').insert({
        id: futureGameId, season, season_type: 2, week,
        home_team: 'Kansas City Chiefs', away_team: 'Dallas Cowboys',
        home_team_id: 1, away_team_id: 2,
        kickoff_time: farFuture, status: 'scheduled',
      });
      if (gamesError) throw new Error(`Failed to seed games: ${gamesError.message}`);

      const res = await request.get(`/api/pools/${poolId}/workspace-stats?week=${week}&seasonType=2`);
      expect(res.ok()).toBe(true);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.gamesStarted).toBe(false);
    } finally {
      if (gameIds.length) await supabase.from('games').delete().in('id', gameIds);
      if (poolId) await supabase.from('pools').delete().eq('id', poolId);
      await supabase.from('huddles').delete().eq('commissioner_email', ownerEmail);
    }
  });

  test('gamesStarted is true once at least one game in the week has kicked off', async ({ request }) => {
    test.setTimeout(30000);
    const ownerEmail = `e2e-workspace-stats-started-${Date.now()}@sundayhuddle.net`;
    let poolId: string | undefined;
    const gameIds: string[] = [];
    const season = 2020;
    const week = 10;

    try {
      const created = await createPool({
        name: 'E2E Workspace Stats Started Pool',
        created_by: ownerEmail,
        season,
        season_scope: [2],
        is_private: false,
      });
      expect(created.success).toBe(true);
      if (!created.success) return;
      poolId = created.data.id as string;

      const startedGameId = `e2e-wstats-${season}-w${week}-started-${Date.now()}`;
      const futureGameId = `e2e-wstats-${season}-w${week}-future-${Date.now()}`;
      gameIds.push(startedGameId, futureGameId);
      const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
      const { error: gamesError } = await supabase.from('games').insert([
        {
          id: startedGameId, season, season_type: 2, week,
          home_team: 'Buffalo Bills', away_team: 'Miami Dolphins',
          home_team_id: 3, away_team_id: 4,
          kickoff_time: past, status: 'live',
        },
        {
          id: futureGameId, season, season_type: 2, week,
          home_team: 'Green Bay Packers', away_team: 'Chicago Bears',
          home_team_id: 5, away_team_id: 6,
          kickoff_time: future, status: 'scheduled',
        },
      ]);
      if (gamesError) throw new Error(`Failed to seed games: ${gamesError.message}`);

      const res = await request.get(`/api/pools/${poolId}/workspace-stats?week=${week}&seasonType=2`);
      expect(res.ok()).toBe(true);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.gamesStarted).toBe(true);
    } finally {
      if (gameIds.length) await supabase.from('games').delete().in('id', gameIds);
      if (poolId) await supabase.from('pools').delete().eq('id', poolId);
      await supabase.from('huddles').delete().eq('commissioner_email', ownerEmail);
    }
  });
});
