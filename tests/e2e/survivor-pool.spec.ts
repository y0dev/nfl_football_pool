import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

// ─────────────────────────────────────────────────────────────
// Survivor Pool — permanent regression coverage. computeSurvivorPoolState/
// submitSurvivorPick/finalizeSurvivorSeason (src/lib/survivor.ts) are plain
// exported functions, not Next.js Server Actions — same situation as
// src/lib/payouts.ts (see payouts-calculation.spec.ts), so they're imported
// and called directly here rather than over HTTP. The commissioner-only
// email/finalize routes ARE real API routes and are tested via the
// `request` fixture against the real running server.
//
// Each test gets its own randomly-chosen fake "season" number so that
// computeSurvivorPoolState()'s season-wide games query (not pool-scoped)
// can never see another concurrently-running test's fixture games —
// this suite runs with fullyParallel: true.
// ─────────────────────────────────────────────────────────────

import { createPool } from '../../src/actions/createPool';
import { updatePool } from '../../src/actions/updatePool';
import {
  computeSurvivorPoolState,
  submitSurvivorPick,
  finalizeSurvivorSeason,
} from '../../src/lib/survivor';
import { DEFAULT_SURVIVOR_TYPE_SETTINGS } from '../../src/lib/survivor-settings';
import { getNFLSeasonYear } from '../../src/lib/utils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY!
);

function fakeSeason(): number {
  return 6000 + Math.floor(Math.random() * 900000);
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString();
}

function daysFromNow(n: number): string {
  return new Date(Date.now() + n * 86400000).toISOString();
}

interface Fixture {
  ownerEmail: string;
  poolId: string;
  season: number;
  participants: Record<string, string>;
  gameIds: string[];
}

/** Creates a Survivor pool with a backdated created_at (10 days before any
 * fixture game's kickoff) — required so the no-pick rule evaluates past
 * weeks correctly instead of treating them as "before the pool existed"
 * (see src/lib/survivor.ts's weekPredatesPool guard). */
async function setupSurvivorPool(opts: {
  participantNames: string[];
  typeSettings?: Record<string, unknown>;
  season?: number;
}): Promise<Fixture> {
  const season = opts.season ?? fakeSeason();
  const ownerEmail = `e2e-survivor-${season}-${Date.now()}@sundayhuddle.net`;

  const result = await createPool({
    name: `E2E Survivor ${season}`,
    created_by: ownerEmail,
    season,
    season_scope: [2],
    competition_type: 'SURVIVOR',
    type_settings: opts.typeSettings ?? {},
  });
  if (!result.success) throw new Error(`Failed to create Survivor pool: ${result.error}`);
  const poolId = result.data.id as string;

  await supabase.from('pools').update({ created_at: daysAgo(30) }).eq('id', poolId);

  const { data: parts } = await supabase
    .from('participants')
    .insert(opts.participantNames.map(name => ({ pool_id: poolId, name, email: `${name.toLowerCase().replace(/\s+/g, '')}@example.com`, is_active: true })))
    .select('id, name');

  const participants = Object.fromEntries((parts ?? []).map(p => [p.name, p.id]));
  return { ownerEmail, poolId, season, participants, gameIds: [] };
}

async function createGame(fixture: Fixture, opts: {
  week: number;
  homeTeam: string; awayTeam: string; homeTeamId: string; awayTeamId: string;
  kickoff: string; status: string; homeScore?: number | null; awayScore?: number | null; winner?: string | null;
}): Promise<string> {
  const gameId = `e2e-surv-${fixture.season}-w${opts.week}-${Math.floor(Math.random() * 1e9)}`;
  await supabase.from('games').insert({
    id: gameId, season: fixture.season, season_type: 2, week: opts.week,
    home_team: opts.homeTeam, away_team: opts.awayTeam, home_team_id: opts.homeTeamId, away_team_id: opts.awayTeamId,
    kickoff_time: opts.kickoff, status: opts.status,
    home_score: opts.homeScore ?? null, away_score: opts.awayScore ?? null, winner: opts.winner ?? null,
  });
  fixture.gameIds.push(gameId);
  return gameId;
}

async function cleanup(fixture: Fixture) {
  await supabase.from('pools').delete().eq('id', fixture.poolId); // cascades participants + survivor_picks
  await supabase.from('survivor_winners').delete().eq('pool_id', fixture.poolId);
  for (const id of fixture.gameIds) await supabase.from('games').delete().eq('id', id);
  await supabase.from('huddles').delete().eq('commissioner_email', fixture.ownerEmail);
}

test.describe('Survivor Pool — creation', () => {
  test('creates successfully with competition_type SURVIVOR and pool_type left untouched', async () => {
    const fixture = await setupSurvivorPool({ participantNames: ['Alice'] });
    try {
      const { data: row } = await supabase.from('pools').select('competition_type, pool_type, type_settings').eq('id', fixture.poolId).single();
      expect(row?.competition_type).toBe('SURVIVOR');
      expect(row?.pool_type).toBe('normal'); // unrelated column — see src/lib/survivor.ts's header comment
    } finally {
      await cleanup(fixture);
    }
  });

  test('rejects competition_type SURVIVOR if it were ever disabled again (isAvailableCompetitionType gate)', async () => {
    // Confidence pools are unaffected either way — this just documents the
    // gate createPool.ts already enforces for every competition_type.
    const result = await createPool({
      name: 'E2E Rejected Type', created_by: `e2e-rejected-${Date.now()}@sundayhuddle.net`,
      season: getNFLSeasonYear(), season_scope: [2], competition_type: 'MARCH_MADNESS',
    });
    expect(result.success).toBe(false);
  });
});

test.describe('Survivor Pool — settings', () => {
  test('type_settings persists through updatePool and parses back correctly', async () => {
    const fixture = await setupSurvivorPool({ participantNames: ['Alice'] });
    try {
      await updatePool(fixture.poolId, {
        type_settings: { noPickRule: 'keep_active', tieRule: 'keep_active', endOfSeasonRule: 'margin_tiebreaker' },
      });
      const { data: row } = await supabase.from('pools').select('type_settings').eq('id', fixture.poolId).single();
      expect(row?.type_settings).toEqual({ noPickRule: 'keep_active', tieRule: 'keep_active', endOfSeasonRule: 'margin_tiebreaker' });
    } finally {
      await cleanup(fixture);
    }
  });

  test('defaults to eliminate/eliminate/all_remaining_winners when unset', async () => {
    const fixture = await setupSurvivorPool({ participantNames: ['Alice'] });
    try {
      const state = await computeSurvivorPoolState(fixture.poolId);
      expect(state.settings).toEqual(DEFAULT_SURVIVOR_TYPE_SETTINGS);
    } finally {
      await cleanup(fixture);
    }
  });
});

test.describe('Survivor Pool — pick submission', () => {
  test('valid pick succeeds', async () => {
    const fixture = await setupSurvivorPool({ participantNames: ['Alice'] });
    try {
      const gameId = await createGame(fixture, { week: 1, homeTeam: 'Home A', awayTeam: 'Away A', homeTeamId: 'HA', awayTeamId: 'AA', kickoff: daysFromNow(3), status: 'scheduled' });
      const result = await submitSurvivorPick({ participantId: fixture.participants.Alice, poolId: fixture.poolId, gameId, selectedTeam: 'HA' });
      expect(result.success).toBe(true);
    } finally {
      await cleanup(fixture);
    }
  });

  test('cannot make more than one pick for the same week (second submission replaces, not duplicates)', async () => {
    const fixture = await setupSurvivorPool({ participantNames: ['Alice'] });
    try {
      const gameId = await createGame(fixture, { week: 1, homeTeam: 'Home A', awayTeam: 'Away A', homeTeamId: 'HA', awayTeamId: 'AA', kickoff: daysFromNow(3), status: 'scheduled' });
      await submitSurvivorPick({ participantId: fixture.participants.Alice, poolId: fixture.poolId, gameId, selectedTeam: 'HA' });
      await submitSurvivorPick({ participantId: fixture.participants.Alice, poolId: fixture.poolId, gameId, selectedTeam: 'AA' });
      const { data: picks } = await supabase.from('survivor_picks').select('selected_team').eq('participant_id', fixture.participants.Alice).eq('week', 1);
      expect(picks).toHaveLength(1);
      expect(picks![0].selected_team).toBe('AA');
    } finally {
      await cleanup(fixture);
    }
  });

  test('cannot reuse a previously selected team', async () => {
    const fixture = await setupSurvivorPool({ participantNames: ['Alice'] });
    try {
      const week1Game = await createGame(fixture, { week: 1, homeTeam: 'Home A', awayTeam: 'Away A', homeTeamId: 'HA', awayTeamId: 'AA', kickoff: daysAgo(5), status: 'finished', homeScore: 20, awayScore: 10, winner: 'Home A' });
      await supabase.from('survivor_picks').insert({ participant_id: fixture.participants.Alice, pool_id: fixture.poolId, game_id: week1Game, season: fixture.season, season_type: 2, week: 1, selected_team: 'HA' });

      const week2Game = await createGame(fixture, { week: 2, homeTeam: 'Home B', awayTeam: 'Away B', homeTeamId: 'HA', awayTeamId: 'BB', kickoff: daysFromNow(3), status: 'scheduled' });
      const result = await submitSurvivorPick({ participantId: fixture.participants.Alice, poolId: fixture.poolId, gameId: week2Game, selectedTeam: 'HA' });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toMatch(/already used/i);
    } finally {
      await cleanup(fixture);
    }
  });

  test('rejects a team that is not actually playing in the given game', async () => {
    const fixture = await setupSurvivorPool({ participantNames: ['Alice'] });
    try {
      const gameId = await createGame(fixture, { week: 1, homeTeam: 'Home A', awayTeam: 'Away A', homeTeamId: 'HA', awayTeamId: 'AA', kickoff: daysFromNow(3), status: 'scheduled' });
      const result = await submitSurvivorPick({ participantId: fixture.participants.Alice, poolId: fixture.poolId, gameId, selectedTeam: 'ZZ' });
      expect(result.success).toBe(false);
    } finally {
      await cleanup(fixture);
    }
  });

  test('rejects a submission for a locked week', async () => {
    const fixture = await setupSurvivorPool({ participantNames: ['Alice'] });
    try {
      const gameId = await createGame(fixture, { week: 1, homeTeam: 'Home A', awayTeam: 'Away A', homeTeamId: 'HA', awayTeamId: 'AA', kickoff: daysFromNow(20), status: 'scheduled' });
      const result = await submitSurvivorPick({ participantId: fixture.participants.Alice, poolId: fixture.poolId, gameId, selectedTeam: 'HA' });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toMatch(/locked/i);
    } finally {
      await cleanup(fixture);
    }
  });
});

test.describe('Survivor Pool — status computation', () => {
  test('winning pick keeps participant ACTIVE', async () => {
    const fixture = await setupSurvivorPool({ participantNames: ['Alice'] });
    try {
      const gameId = await createGame(fixture, { week: 1, homeTeam: 'Home A', awayTeam: 'Away A', homeTeamId: 'HA', awayTeamId: 'AA', kickoff: daysAgo(3), status: 'finished', homeScore: 20, awayScore: 10, winner: 'Home A' });
      await supabase.from('survivor_picks').insert({ participant_id: fixture.participants.Alice, pool_id: fixture.poolId, game_id: gameId, season: fixture.season, season_type: 2, week: 1, selected_team: 'HA' });
      const state = await computeSurvivorPoolState(fixture.poolId);
      const alice = state.participants.find(p => p.participantId === fixture.participants.Alice)!;
      expect(alice.status).toBe('ACTIVE');
    } finally {
      await cleanup(fixture);
    }
  });

  test('losing pick ELIMINATES participant with correct detail', async () => {
    const fixture = await setupSurvivorPool({ participantNames: ['Bob'] });
    try {
      const gameId = await createGame(fixture, { week: 1, homeTeam: 'Home A', awayTeam: 'Away A', homeTeamId: 'HA', awayTeamId: 'AA', kickoff: daysAgo(3), status: 'finished', homeScore: 20, awayScore: 10, winner: 'Home A' });
      await supabase.from('survivor_picks').insert({ participant_id: fixture.participants.Bob, pool_id: fixture.poolId, game_id: gameId, season: fixture.season, season_type: 2, week: 1, selected_team: 'AA' });
      const state = await computeSurvivorPoolState(fixture.poolId);
      const bob = state.participants.find(p => p.participantId === fixture.participants.Bob)!;
      expect(bob.status).toBe('ELIMINATED');
      expect(bob.eliminatedWeek).toBe(1);
      expect(bob.eliminatedTeam).toBe('AA');
      expect(bob.eliminatedReason).toBe('loss');
    } finally {
      await cleanup(fixture);
    }
  });

  test('tie eliminates when tieRule=eliminate', async () => {
    const fixture = await setupSurvivorPool({ participantNames: ['Alice'], typeSettings: { tieRule: 'eliminate' } });
    try {
      const gameId = await createGame(fixture, { week: 1, homeTeam: 'Home A', awayTeam: 'Away A', homeTeamId: 'HA', awayTeamId: 'AA', kickoff: daysAgo(3), status: 'finished', homeScore: 14, awayScore: 14, winner: null });
      await supabase.from('survivor_picks').insert({ participant_id: fixture.participants.Alice, pool_id: fixture.poolId, game_id: gameId, season: fixture.season, season_type: 2, week: 1, selected_team: 'HA' });
      const state = await computeSurvivorPoolState(fixture.poolId);
      const alice = state.participants.find(p => p.participantId === fixture.participants.Alice)!;
      expect(alice.status).toBe('ELIMINATED');
      expect(alice.eliminatedReason).toBe('tie');
    } finally {
      await cleanup(fixture);
    }
  });

  test('tie keeps participant active when tieRule=keep_active', async () => {
    const fixture = await setupSurvivorPool({ participantNames: ['Alice'], typeSettings: { tieRule: 'keep_active' } });
    try {
      const gameId = await createGame(fixture, { week: 1, homeTeam: 'Home A', awayTeam: 'Away A', homeTeamId: 'HA', awayTeamId: 'AA', kickoff: daysAgo(3), status: 'finished', homeScore: 14, awayScore: 14, winner: null });
      await supabase.from('survivor_picks').insert({ participant_id: fixture.participants.Alice, pool_id: fixture.poolId, game_id: gameId, season: fixture.season, season_type: 2, week: 1, selected_team: 'HA' });
      const state = await computeSurvivorPoolState(fixture.poolId);
      const alice = state.participants.find(p => p.participantId === fixture.participants.Alice)!;
      expect(alice.status).toBe('ACTIVE');
    } finally {
      await cleanup(fixture);
    }
  });

  test('no-pick eliminates when noPickRule=eliminate (week already started, after pool creation)', async () => {
    const fixture = await setupSurvivorPool({ participantNames: ['Carol'], typeSettings: { noPickRule: 'eliminate' } });
    try {
      await createGame(fixture, { week: 1, homeTeam: 'Home A', awayTeam: 'Away A', homeTeamId: 'HA', awayTeamId: 'AA', kickoff: daysAgo(3), status: 'finished', homeScore: 20, awayScore: 10, winner: 'Home A' });
      const state = await computeSurvivorPoolState(fixture.poolId);
      const carol = state.participants.find(p => p.participantId === fixture.participants.Carol)!;
      expect(carol.status).toBe('ELIMINATED');
      expect(carol.eliminatedReason).toBe('no_pick');
    } finally {
      await cleanup(fixture);
    }
  });

  test('no-pick keeps participant active when noPickRule=keep_active', async () => {
    const fixture = await setupSurvivorPool({ participantNames: ['Carol'], typeSettings: { noPickRule: 'keep_active' } });
    try {
      await createGame(fixture, { week: 1, homeTeam: 'Home A', awayTeam: 'Away A', homeTeamId: 'HA', awayTeamId: 'AA', kickoff: daysAgo(3), status: 'finished', homeScore: 20, awayScore: 10, winner: 'Home A' });
      const state = await computeSurvivorPoolState(fixture.poolId);
      const carol = state.participants.find(p => p.participantId === fixture.participants.Carol)!;
      expect(carol.status).toBe('ACTIVE');
    } finally {
      await cleanup(fixture);
    }
  });

  test('postponed/unfinished game is not evaluated early — participant stays ACTIVE with a pending pick', async () => {
    const fixture = await setupSurvivorPool({ participantNames: ['Dave'] });
    try {
      const gameId = await createGame(fixture, { week: 1, homeTeam: 'Home A', awayTeam: 'Away A', homeTeamId: 'HA', awayTeamId: 'AA', kickoff: daysAgo(1), status: 'postponed' });
      await supabase.from('survivor_picks').insert({ participant_id: fixture.participants.Dave, pool_id: fixture.poolId, game_id: gameId, season: fixture.season, season_type: 2, week: 1, selected_team: 'HA' });
      const state = await computeSurvivorPoolState(fixture.poolId);
      const dave = state.participants.find(p => p.participantId === fixture.participants.Dave)!;
      expect(dave.status).toBe('ACTIVE');
      expect(dave.picks[0]?.result).toBe('pending');
    } finally {
      await cleanup(fixture);
    }
  });
});

test.describe('Survivor Pool — elimination lockout', () => {
  test('eliminated participant cannot make another pick', async () => {
    const fixture = await setupSurvivorPool({ participantNames: ['Bob'] });
    try {
      const week1Game = await createGame(fixture, { week: 1, homeTeam: 'Home A', awayTeam: 'Away A', homeTeamId: 'HA', awayTeamId: 'AA', kickoff: daysAgo(3), status: 'finished', homeScore: 20, awayScore: 10, winner: 'Home A' });
      await supabase.from('survivor_picks').insert({ participant_id: fixture.participants.Bob, pool_id: fixture.poolId, game_id: week1Game, season: fixture.season, season_type: 2, week: 1, selected_team: 'AA' });

      const week2Game = await createGame(fixture, { week: 2, homeTeam: 'Home B', awayTeam: 'Away B', homeTeamId: 'HB', awayTeamId: 'BB', kickoff: daysFromNow(3), status: 'scheduled' });
      const result = await submitSurvivorPick({ participantId: fixture.participants.Bob, poolId: fixture.poolId, gameId: week2Game, selectedTeam: 'HB' });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toMatch(/eliminated/i);
    } finally {
      await cleanup(fixture);
    }
  });

  test('active participant can make another pick', async () => {
    const fixture = await setupSurvivorPool({ participantNames: ['Alice'] });
    try {
      const week1Game = await createGame(fixture, { week: 1, homeTeam: 'Home A', awayTeam: 'Away A', homeTeamId: 'HA', awayTeamId: 'AA', kickoff: daysAgo(3), status: 'finished', homeScore: 20, awayScore: 10, winner: 'Home A' });
      await supabase.from('survivor_picks').insert({ participant_id: fixture.participants.Alice, pool_id: fixture.poolId, game_id: week1Game, season: fixture.season, season_type: 2, week: 1, selected_team: 'HA' });

      const week2Game = await createGame(fixture, { week: 2, homeTeam: 'Home B', awayTeam: 'Away B', homeTeamId: 'HB', awayTeamId: 'BB', kickoff: daysFromNow(3), status: 'scheduled' });
      const result = await submitSurvivorPick({ participantId: fixture.participants.Alice, poolId: fixture.poolId, gameId: week2Game, selectedTeam: 'HB' });
      expect(result.success).toBe(true);
    } finally {
      await cleanup(fixture);
    }
  });
});

test.describe('Survivor Pool — multiple participants and multiple pools', () => {
  test('multiple participants are evaluated independently within one pool', async () => {
    const fixture = await setupSurvivorPool({ participantNames: ['Alice', 'Bob', 'Carol'] });
    try {
      const gameId = await createGame(fixture, { week: 1, homeTeam: 'Home A', awayTeam: 'Away A', homeTeamId: 'HA', awayTeamId: 'AA', kickoff: daysAgo(3), status: 'finished', homeScore: 20, awayScore: 10, winner: 'Home A' });
      await supabase.from('survivor_picks').insert([
        { participant_id: fixture.participants.Alice, pool_id: fixture.poolId, game_id: gameId, season: fixture.season, season_type: 2, week: 1, selected_team: 'HA' },
        { participant_id: fixture.participants.Bob, pool_id: fixture.poolId, game_id: gameId, season: fixture.season, season_type: 2, week: 1, selected_team: 'AA' },
        // Carol: no pick
      ]);
      const state = await computeSurvivorPoolState(fixture.poolId);
      expect(state.participants.find(p => p.participantId === fixture.participants.Alice)!.status).toBe('ACTIVE');
      expect(state.participants.find(p => p.participantId === fixture.participants.Bob)!.status).toBe('ELIMINATED');
      expect(state.participants.find(p => p.participantId === fixture.participants.Carol)!.status).toBe('ELIMINATED');
      expect(state.activeCount).toBe(1);
      expect(state.eliminatedCount).toBe(2);
    } finally {
      await cleanup(fixture);
    }
  });

  test('two Survivor pools operate completely independently', async () => {
    const fixtureA = await setupSurvivorPool({ participantNames: ['Alice'] });
    const fixtureB = await setupSurvivorPool({ participantNames: ['Alice'] }); // same participant name, different pool
    try {
      const gameA = await createGame(fixtureA, { week: 1, homeTeam: 'Home A', awayTeam: 'Away A', homeTeamId: 'HA', awayTeamId: 'AA', kickoff: daysAgo(3), status: 'finished', homeScore: 20, awayScore: 10, winner: 'Home A' });
      await supabase.from('survivor_picks').insert({ participant_id: fixtureA.participants.Alice, pool_id: fixtureA.poolId, game_id: gameA, season: fixtureA.season, season_type: 2, week: 1, selected_team: 'AA' }); // loses

      const gameB = await createGame(fixtureB, { week: 1, homeTeam: 'Home B', awayTeam: 'Away B', homeTeamId: 'HB', awayTeamId: 'BB', kickoff: daysAgo(3), status: 'finished', homeScore: 20, awayScore: 10, winner: 'Home B' });
      await supabase.from('survivor_picks').insert({ participant_id: fixtureB.participants.Alice, pool_id: fixtureB.poolId, game_id: gameB, season: fixtureB.season, season_type: 2, week: 1, selected_team: 'HB' }); // wins

      const stateA = await computeSurvivorPoolState(fixtureA.poolId);
      const stateB = await computeSurvivorPoolState(fixtureB.poolId);
      expect(stateA.participants[0].status).toBe('ELIMINATED');
      expect(stateB.participants[0].status).toBe('ACTIVE');
    } finally {
      await cleanup(fixtureA);
      await cleanup(fixtureB);
    }
  });
});

test.describe('Survivor Pool — winner determination', () => {
  test('last remaining active participant becomes the winner (resolution: last_active)', async () => {
    const fixture = await setupSurvivorPool({ participantNames: ['Alice', 'Bob'] });
    try {
      const gameId = await createGame(fixture, { week: 1, homeTeam: 'Home A', awayTeam: 'Away A', homeTeamId: 'HA', awayTeamId: 'AA', kickoff: daysAgo(3), status: 'finished', homeScore: 20, awayScore: 10, winner: 'Home A' });
      await supabase.from('survivor_picks').insert([
        { participant_id: fixture.participants.Alice, pool_id: fixture.poolId, game_id: gameId, season: fixture.season, season_type: 2, week: 1, selected_team: 'HA' },
        { participant_id: fixture.participants.Bob, pool_id: fixture.poolId, game_id: gameId, season: fixture.season, season_type: 2, week: 1, selected_team: 'AA' },
      ]);
      const result = await finalizeSurvivorSeason(fixture.poolId);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.resolution).toBe('last_active');
        expect(result.winnerParticipantIds).toEqual([fixture.participants.Alice]);
      }
      // WINNER status layers onto the live computation only after finalize — not before.
      const state = await computeSurvivorPoolState(fixture.poolId);
      expect(state.participants.find(p => p.participantId === fixture.participants.Alice)!.status).toBe('WINNER');
    } finally {
      await cleanup(fixture);
    }
  });

  test('does NOT mark a lone active participant WINNER before finalize is explicitly called', async () => {
    const fixture = await setupSurvivorPool({ participantNames: ['Alice', 'Bob'] });
    try {
      const gameId = await createGame(fixture, { week: 1, homeTeam: 'Home A', awayTeam: 'Away A', homeTeamId: 'HA', awayTeamId: 'AA', kickoff: daysAgo(3), status: 'finished', homeScore: 20, awayScore: 10, winner: 'Home A' });
      await supabase.from('survivor_picks').insert([
        { participant_id: fixture.participants.Alice, pool_id: fixture.poolId, game_id: gameId, season: fixture.season, season_type: 2, week: 1, selected_team: 'HA' },
        { participant_id: fixture.participants.Bob, pool_id: fixture.poolId, game_id: gameId, season: fixture.season, season_type: 2, week: 1, selected_team: 'AA' },
      ]);
      const state = await computeSurvivorPoolState(fixture.poolId); // no finalize call
      expect(state.participants.find(p => p.participantId === fixture.participants.Alice)!.status).toBe('ACTIVE');
      expect(state.winnerParticipantIds).toEqual([]);
    } finally {
      await cleanup(fixture);
    }
  });

  test('multiple survivors at season end: all_remaining_winners rule marks everyone still active as WINNER', async () => {
    const fixture = await setupSurvivorPool({ participantNames: ['Alice', 'Bob'], typeSettings: { endOfSeasonRule: 'all_remaining_winners' } });
    try {
      // Both win week 1 — nobody eliminated, both remain active into "end of season."
      const gameId = await createGame(fixture, { week: 1, homeTeam: 'Home A', awayTeam: 'Away A', homeTeamId: 'HA', awayTeamId: 'AA', kickoff: daysAgo(3), status: 'finished', homeScore: 20, awayScore: 10, winner: 'Home A' });
      await supabase.from('survivor_picks').insert([
        { participant_id: fixture.participants.Alice, pool_id: fixture.poolId, game_id: gameId, season: fixture.season, season_type: 2, week: 1, selected_team: 'HA' },
      ]);
      const gameId2 = await createGame(fixture, { week: 1, homeTeam: 'Home Z', awayTeam: 'Away Z', homeTeamId: 'HZ', awayTeamId: 'AZ', kickoff: daysAgo(3), status: 'finished', homeScore: 30, awayScore: 0, winner: 'Home Z' });
      await supabase.from('survivor_picks').insert([
        { participant_id: fixture.participants.Bob, pool_id: fixture.poolId, game_id: gameId2, season: fixture.season, season_type: 2, week: 1, selected_team: 'HZ' },
      ]);

      const result = await finalizeSurvivorSeason(fixture.poolId);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.resolution).toBe('all_remaining');
        expect(result.winnerParticipantIds.sort()).toEqual([fixture.participants.Alice, fixture.participants.Bob].sort());
      }
    } finally {
      await cleanup(fixture);
    }
  });

  test('multiple survivors at season end: margin_tiebreaker rule picks the highest cumulative margin', async () => {
    const fixture = await setupSurvivorPool({ participantNames: ['Alice', 'Bob'], typeSettings: { endOfSeasonRule: 'margin_tiebreaker' } });
    try {
      // Alice wins by 30, Bob wins by 5 — Alice should win the tiebreaker.
      const gameAlice = await createGame(fixture, { week: 1, homeTeam: 'Home A', awayTeam: 'Away A', homeTeamId: 'HA', awayTeamId: 'AA', kickoff: daysAgo(3), status: 'finished', homeScore: 30, awayScore: 0, winner: 'Home A' });
      await supabase.from('survivor_picks').insert({ participant_id: fixture.participants.Alice, pool_id: fixture.poolId, game_id: gameAlice, season: fixture.season, season_type: 2, week: 1, selected_team: 'HA' });

      const gameBob = await createGame(fixture, { week: 1, homeTeam: 'Home Z', awayTeam: 'Away Z', homeTeamId: 'HZ', awayTeamId: 'AZ', kickoff: daysAgo(3), status: 'finished', homeScore: 20, awayScore: 15, winner: 'Home Z' });
      await supabase.from('survivor_picks').insert({ participant_id: fixture.participants.Bob, pool_id: fixture.poolId, game_id: gameBob, season: fixture.season, season_type: 2, week: 1, selected_team: 'HZ' });

      const result = await finalizeSurvivorSeason(fixture.poolId);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.resolution).toBe('margin_tiebreaker');
        expect(result.winnerParticipantIds).toEqual([fixture.participants.Alice]);
      }
    } finally {
      await cleanup(fixture);
    }
  });

  test('finalize always recomputes and upserts rather than trusting a previously stored row', async () => {
    const fixture = await setupSurvivorPool({ participantNames: ['Alice'] });
    try {
      const first = await finalizeSurvivorSeason(fixture.poolId);
      expect(first.success).toBe(true);
      const second = await finalizeSurvivorSeason(fixture.poolId);
      expect(second.success).toBe(true);
      const { data: rows } = await supabase.from('survivor_winners').select('id').eq('pool_id', fixture.poolId);
      expect(rows).toHaveLength(1); // upsert, not a second row
    } finally {
      await cleanup(fixture);
    }
  });
});

test.describe('Survivor Pool — leaderboard / status API', () => {
  test('GET /api/survivor/state returns active/eliminated grouping with elimination detail', async ({ request }) => {
    const fixture = await setupSurvivorPool({ participantNames: ['Alice', 'Bob'] });
    try {
      const gameId = await createGame(fixture, { week: 1, homeTeam: 'Home A', awayTeam: 'Away A', homeTeamId: 'HA', awayTeamId: 'AA', kickoff: daysAgo(3), status: 'finished', homeScore: 20, awayScore: 10, winner: 'Home A' });
      await supabase.from('survivor_picks').insert([
        { participant_id: fixture.participants.Alice, pool_id: fixture.poolId, game_id: gameId, season: fixture.season, season_type: 2, week: 1, selected_team: 'HA' },
        { participant_id: fixture.participants.Bob, pool_id: fixture.poolId, game_id: gameId, season: fixture.season, season_type: 2, week: 1, selected_team: 'AA' },
      ]);

      const res = await request.get(`/api/survivor/state?poolId=${fixture.poolId}`);
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      const bob = body.state.participants.find((p: { participantId: string }) => p.participantId === fixture.participants.Bob);
      expect(bob.status).toBe('ELIMINATED');
      expect(bob.eliminatedWeek).toBe(1);
      expect(bob.eliminatedTeam).toBe('AA');
      expect(bob.eliminatedReason).toBe('loss');
    } finally {
      await cleanup(fixture);
    }
  });

  test('GET /api/survivor/state requires poolId', async ({ request }) => {
    const res = await request.get('/api/survivor/state');
    expect(res.status()).toBe(400);
  });
});

test.describe('Survivor alongside a Confidence Pool in the same Huddle', () => {
  test('a Confidence pool and a Survivor pool in the same Huddle do not affect each other', async () => {
    const commissionerEmail = `e2e-mixed-huddle-${Date.now()}@sundayhuddle.net`;
    let confidencePoolId: string | undefined;
    let survivorPoolId: string | undefined;
    try {
      const confidenceResult = await createPool({
        name: 'E2E Mixed Huddle Confidence', created_by: commissionerEmail,
        season: getNFLSeasonYear(), season_scope: [2], competition_type: 'NFL_CONFIDENCE',
      });
      expect(confidenceResult.success).toBe(true);
      if (confidenceResult.success) confidencePoolId = confidenceResult.data.id as string;

      const survivorResult = await createPool({
        name: 'E2E Mixed Huddle Survivor', created_by: commissionerEmail,
        season: getNFLSeasonYear(), season_scope: [2], competition_type: 'SURVIVOR',
      });
      expect(survivorResult.success).toBe(true);
      if (survivorResult.success) survivorPoolId = survivorResult.data.id as string;

      // Same commissioner, same Huddle (getOrCreateHuddleRecordForCommissioner
      // returns the commissioner's first/only Huddle for both calls) — confirm
      // both pools actually landed in it, and that fetching one pool's
      // competition_type is correct and independent of the other's.
      const { data: pools } = await supabase.from('pools').select('id, competition_type, huddle_id').in('id', [confidencePoolId!, survivorPoolId!]);
      const confidenceRow = pools!.find(p => p.id === confidencePoolId)!;
      const survivorRow = pools!.find(p => p.id === survivorPoolId)!;
      expect(confidenceRow.competition_type).toBe('NFL_CONFIDENCE');
      expect(survivorRow.competition_type).toBe('SURVIVOR');
      expect(confidenceRow.huddle_id).toBe(survivorRow.huddle_id); // same Huddle
    } finally {
      if (confidencePoolId) await supabase.from('pools').delete().eq('id', confidencePoolId);
      if (survivorPoolId) await supabase.from('pools').delete().eq('id', survivorPoolId);
      await supabase.from('huddles').delete().eq('commissioner_email', commissionerEmail);
    }
  });
});

test.describe('Existing Confidence Pool — unaffected by Survivor', () => {
  test('creating a Survivor pool does not alter an existing Confidence pool\'s data', async () => {
    const commissionerEmail = `e2e-confidence-untouched-${Date.now()}@sundayhuddle.net`;
    let confidencePoolId: string | undefined;
    let survivorPoolId: string | undefined;
    try {
      const confidenceResult = await createPool({
        name: 'E2E Untouched Confidence', created_by: commissionerEmail,
        season: getNFLSeasonYear(), season_scope: [2], competition_type: 'NFL_CONFIDENCE',
      });
      if (confidenceResult.success) confidencePoolId = confidenceResult.data.id as string;
      const { data: before } = await supabase.from('pools').select('*').eq('id', confidencePoolId!).single();

      const survivorResult = await createPool({
        name: 'E2E Untouched Survivor', created_by: commissionerEmail,
        season: getNFLSeasonYear(), season_scope: [2], competition_type: 'SURVIVOR',
      });
      if (survivorResult.success) survivorPoolId = survivorResult.data.id as string;

      const { data: after } = await supabase.from('pools').select('*').eq('id', confidencePoolId!).single();
      expect(after).toEqual(before);
    } finally {
      if (confidencePoolId) await supabase.from('pools').delete().eq('id', confidencePoolId);
      if (survivorPoolId) await supabase.from('pools').delete().eq('id', survivorPoolId);
      await supabase.from('huddles').delete().eq('commissioner_email', commissionerEmail);
    }
  });
});

test.describe('Survivor Pool — emails', () => {
  test('send-reminders only reaches active participants without a current-week pick', async ({ request }) => {
    const fixture = await setupSurvivorPool({ participantNames: ['Alice', 'Bob', 'Carol'] });
    try {
      const week1Game = await createGame(fixture, { week: 1, homeTeam: 'Home A', awayTeam: 'Away A', homeTeamId: 'HA', awayTeamId: 'AA', kickoff: daysAgo(3), status: 'finished', homeScore: 20, awayScore: 10, winner: 'Home A' });
      await supabase.from('survivor_picks').insert([
        { participant_id: fixture.participants.Alice, pool_id: fixture.poolId, game_id: week1Game, season: fixture.season, season_type: 2, week: 1, selected_team: 'HA' }, // wins, stays active
        { participant_id: fixture.participants.Bob, pool_id: fixture.poolId, game_id: week1Game, season: fixture.season, season_type: 2, week: 1, selected_team: 'AA' }, // loses, eliminated
        // Carol: no pick — no_pick eliminates her too (default rule)
      ]);
      await createGame(fixture, { week: 2, homeTeam: 'Home B', awayTeam: 'Away B', homeTeamId: 'HB', awayTeamId: 'BB', kickoff: daysFromNow(3), status: 'scheduled' });

      const res = await request.post('/api/survivor/send-reminders', {
        headers: { 'x-admin-email': fixture.ownerEmail },
        data: { poolId: fixture.poolId },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.results.total).toBe(1); // only Alice — still active and hasn't picked week 2
    } finally {
      await cleanup(fixture);
    }
  });

  test('notify-week-results distinguishes WIN/LOSS/TIE and never fires for a pending pick', async ({ request }) => {
    const fixture = await setupSurvivorPool({ participantNames: ['Alice', 'Bob', 'Carol'], typeSettings: { tieRule: 'keep_active' } });
    try {
      const gameWin = await createGame(fixture, { week: 1, homeTeam: 'Home A', awayTeam: 'Away A', homeTeamId: 'HA', awayTeamId: 'AA', kickoff: daysAgo(3), status: 'finished', homeScore: 20, awayScore: 10, winner: 'Home A' });
      const gameLoss = await createGame(fixture, { week: 1, homeTeam: 'Home B', awayTeam: 'Away B', homeTeamId: 'HB', awayTeamId: 'BB', kickoff: daysAgo(3), status: 'finished', homeScore: 5, awayScore: 25, winner: 'Away B' });
      const gamePending = await createGame(fixture, { week: 1, homeTeam: 'Home C', awayTeam: 'Away C', homeTeamId: 'HC', awayTeamId: 'CC', kickoff: daysAgo(1), status: 'in_progress' });

      await supabase.from('survivor_picks').insert([
        { participant_id: fixture.participants.Alice, pool_id: fixture.poolId, game_id: gameWin, season: fixture.season, season_type: 2, week: 1, selected_team: 'HA' },
        { participant_id: fixture.participants.Bob, pool_id: fixture.poolId, game_id: gameLoss, season: fixture.season, season_type: 2, week: 1, selected_team: 'HB' },
        { participant_id: fixture.participants.Carol, pool_id: fixture.poolId, game_id: gamePending, season: fixture.season, season_type: 2, week: 1, selected_team: 'HC' },
      ]);

      const res = await request.post('/api/survivor/notify-week-results', {
        headers: { 'x-admin-email': fixture.ownerEmail },
        data: { poolId: fixture.poolId, week: 1, seasonType: 2 },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.results.total).toBe(2); // Alice (win) + Bob (loss) — Carol's pending pick is excluded
    } finally {
      await cleanup(fixture);
    }
  });

  test('email routes reject a caller who is not the pool owner or a super admin', async ({ request }) => {
    const fixture = await setupSurvivorPool({ participantNames: ['Alice'] });
    try {
      const res = await request.post('/api/survivor/send-reminders', {
        headers: { 'x-admin-email': 'not-the-owner@example.com' },
        data: { poolId: fixture.poolId },
      });
      expect(res.status()).toBe(403);
    } finally {
      await cleanup(fixture);
    }
  });

  test('/api/survivor/finalize requires the pool owner or a super admin', async ({ request }) => {
    const fixture = await setupSurvivorPool({ participantNames: ['Alice'] });
    try {
      const rejected = await request.post('/api/survivor/finalize', {
        headers: { 'x-admin-email': 'not-the-owner@example.com' },
        data: { poolId: fixture.poolId },
      });
      expect(rejected.status()).toBe(403);

      const allowed = await request.post('/api/survivor/finalize', {
        headers: { 'x-admin-email': fixture.ownerEmail },
        data: { poolId: fixture.poolId },
      });
      expect(allowed.status()).toBe(200);
    } finally {
      await cleanup(fixture);
    }
  });

  test('/api/survivor/notify-week-results defaults to the most recently resolved week when none is given', async ({ request }) => {
    const fixture = await setupSurvivorPool({ participantNames: ['Alice'] });
    try {
      const gameId = await createGame(fixture, { week: 1, homeTeam: 'Home A', awayTeam: 'Away A', homeTeamId: 'HA', awayTeamId: 'AA', kickoff: daysAgo(3), status: 'finished', homeScore: 20, awayScore: 10, winner: 'Home A' });
      await supabase.from('survivor_picks').insert({ participant_id: fixture.participants.Alice, pool_id: fixture.poolId, game_id: gameId, season: fixture.season, season_type: 2, week: 1, selected_team: 'HA' });

      const res = await request.post('/api/survivor/notify-week-results', {
        headers: { 'x-admin-email': fixture.ownerEmail },
        data: { poolId: fixture.poolId }, // no week/seasonType
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.message).toContain('Week 1');
      expect(body.results.total).toBe(1);
    } finally {
      await cleanup(fixture);
    }
  });
});

test.describe('Survivor Pool — closed-season history page', () => {
  test('a deactivated Survivor pool shows Survivor standings on /history, not Confidence Leaderboard content', async ({ page }) => {
    const fixture = await setupSurvivorPool({ participantNames: ['Alice', 'Bob'] });
    try {
      const gameId = await createGame(fixture, { week: 1, homeTeam: 'Home A', awayTeam: 'Away A', homeTeamId: 'HA', awayTeamId: 'AA', kickoff: daysAgo(3), status: 'finished', homeScore: 20, awayScore: 10, winner: 'Home A' });
      await supabase.from('survivor_picks').insert([
        { participant_id: fixture.participants.Alice, pool_id: fixture.poolId, game_id: gameId, season: fixture.season, season_type: 2, week: 1, selected_team: 'HA' },
        { participant_id: fixture.participants.Bob, pool_id: fixture.poolId, game_id: gameId, season: fixture.season, season_type: 2, week: 1, selected_team: 'AA' },
      ]);
      await supabase.from('pools').update({ is_active: false }).eq('id', fixture.poolId);

      await page.goto(`/pool/${fixture.poolId}/history`);
      // SurvivorStandingsPanel fetches its own data client-side after mount
      // — wait for content that only appears once that fetch resolves
      // (not just the static "Survivor Standings" heading, which renders
      // immediately alongside the panel's loading spinner).
      await page.waitForSelector('text=/Active \\(/i', { timeout: 15000 });

      const bodyText = ((await page.textContent('body')) ?? '').toUpperCase();
      expect(bodyText).toContain('ACTIVE');
      expect(bodyText).toContain('ELIMINATED');
      expect(bodyText).not.toContain('CORRECT PICKS'); // Confidence-only terminology
      expect(bodyText).not.toContain('FINAL STANDINGS'); // the Confidence week-leaderboard heading
    } finally {
      await cleanup(fixture);
    }
  });
});

test.describe('Survivor Pool — locked game result display', () => {
  test('a finished game in the current week shows the score and survived/eliminated result instead of pick buttons', async ({ page }) => {
    const fixture = await setupSurvivorPool({ participantNames: ['Alice'] });
    try {
      // Two games in the same week: one already final (Thursday-night style),
      // one still upcoming — keeps the week "current" (not fully resolved)
      // while still exercising the finished game's result display. Real
      // team abbreviations (not the "HA"/"AA" placeholders other tests in
      // this file use) so getTeam() resolves a real city name to render.
      const finishedGame = await createGame(fixture, { week: 1, homeTeam: 'Philadelphia Eagles', awayTeam: 'Dallas Cowboys', homeTeamId: 'PHI', awayTeamId: 'DAL', kickoff: daysAgo(3), status: 'finished', homeScore: 20, awayScore: 10, winner: 'Philadelphia Eagles' });
      await createGame(fixture, { week: 1, homeTeam: 'Buffalo Bills', awayTeam: 'Miami Dolphins', homeTeamId: 'BUF', awayTeamId: 'MIA', kickoff: daysFromNow(3), status: 'scheduled' });
      await supabase.from('survivor_picks').insert({ participant_id: fixture.participants.Alice, pool_id: fixture.poolId, game_id: finishedGame, season: fixture.season, season_type: 2, week: 1, selected_team: 'PHI' });

      await page.goto(`/pool/${fixture.poolId}/picks`);
      // Alice is the only active participant and has already picked, so
      // standings auto-show and hide the picker as soon as data loads
      // (matching Confidence's showResultsTabs) — "Force show picks form" is
      // the dev-only escape hatch for reviewing the picker/locked-row
      // display in that state. Wait for the debug panel itself (always
      // present regardless of showResultsSection) rather than "Who's
      // picking?", which may already be hidden by the time data loads.
      await page.waitForSelector('#debug-panel-controls', { timeout: 15000 });
      await page.locator('label:has-text("Force show picks form (ignore")').locator('input[type="checkbox"]').check();
      await page.waitForSelector('text=/Who\'s picking/i', { timeout: 15000 });
      await page.selectOption('select', { label: 'Alice' });
      await page.waitForSelector('text=/Choose Your Team/i', { timeout: 15000 });

      await expect(page.locator('button:has-text("Philadelphia")')).toHaveCount(0);
      await expect(page.getByText('Final', { exact: true })).toBeVisible();
      await expect(page.locator('text=/^20$/')).toBeVisible();
      await expect(page.locator('text=/^10$/')).toBeVisible();
      await expect(page.locator('text=/Your pick:\\s*Philadelphia/i')).toBeVisible();
      await expect(page.getByText('Survived', { exact: true })).toBeVisible();
      // The still-upcoming game in the same week communicates it's locked
      // (kickoff already inside the week's lock window) without a score yet.
      // .last() — the hero's own week-state badge also reads "Locked" here
      // (a game in this week has already started), so two matches are
      // expected; this asserts on the per-game one specifically.
      await expect(page.getByText('Locked', { exact: true }).last()).toBeVisible();
    } finally {
      await cleanup(fixture);
    }
  });
});

test.describe('Survivor Pool — full picks flow (UI)', () => {
  test('select, pick, submit; already-submitted participant cannot pick again; standings auto-show and the picker disappears once everyone has picked', async ({ page }) => {
    const fixture = await setupSurvivorPool({ participantNames: ['Alice', 'Bob', 'Carol'] });
    try {
      await createGame(fixture, {
        week: 1, homeTeam: 'Kansas City Chiefs', awayTeam: 'Buffalo Bills', homeTeamId: 'KC', awayTeamId: 'BUF',
        kickoff: daysFromNow(3), status: 'scheduled',
      });

      await page.goto(`/pool/${fixture.poolId}/picks`);
      await page.waitForSelector('text=/Who\'s picking/i', { timeout: 15000 });

      // Alice picks and submits.
      await page.selectOption('select', { label: 'Alice' });
      await page.waitForSelector('button:has-text("Kansas City")', { timeout: 15000 });
      await page.locator('button:has-text("Kansas City")').click();
      await page.locator('button:has-text("Submit Pick")').click();
      await expect(page.getByText('Survivor Standings', { exact: true })).toHaveCount(0);

      // Bob picks and submits — Carol hasn't yet, so standings stay hidden
      // and the picker is still reachable.
      await page.selectOption('select', { label: 'Bob' });
      await page.waitForSelector('button:has-text("Buffalo")', { timeout: 15000 });
      await page.locator('button:has-text("Buffalo")').click();
      await page.locator('button:has-text("Submit Pick")').click();
      await expect(page.getByText('Survivor Standings', { exact: true })).toHaveCount(0);

      // Re-selecting Alice must show the locked/submitted view, not pick
      // buttons — a participant who already picked cannot pick again.
      await page.selectOption('select', { label: 'Alice' });
      await expect(page.locator('text=/Your pick is submitted for this week/i')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('button:has-text("Kansas City"), button:has-text("Buffalo")')).toHaveCount(0);
      await expect(page.locator('button:has-text("Submit Pick")')).toHaveCount(0);

      // Carol picks and submits — everyone active has now picked (even
      // though the game hasn't started). Switch away from Alice's locked
      // view first — the selector only reappears once no one is selected.
      await page.locator('button:has-text("Not you? Switch")').click();
      await page.waitForSelector('text=/Who\'s picking/i', { timeout: 15000 });
      await page.selectOption('select', { label: 'Carol' });
      await page.waitForSelector('button:has-text("Kansas City")', { timeout: 15000 });
      await page.locator('button:has-text("Kansas City")').click();
      await page.locator('button:has-text("Submit Pick")').click();

      // Standings auto-show, and the entire picker/picks-form section
      // (including "Who's picking?") disappears since there's nothing left
      // to pick for anyone — matches Confidence's showResultsTabs behavior.
      await expect(page.getByText('Survivor Standings', { exact: true })).toBeVisible({ timeout: 15000 });
      await expect(page.getByText("Who's picking?", { exact: false })).toHaveCount(0);
      await expect(page.locator('select')).toHaveCount(0);
    } finally {
      await cleanup(fixture);
    }
  });
});

test.describe('Survivor Pool — mobile leaderboard', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('leaderboard renders without horizontal overflow on a phone-width viewport', async ({ page }) => {
    const fixture = await setupSurvivorPool({ participantNames: ['Alice', 'Bob', 'Carol'] });
    try {
      const gameId = await createGame(fixture, { week: 1, homeTeam: 'Home A', awayTeam: 'Away A', homeTeamId: 'HA', awayTeamId: 'AA', kickoff: daysAgo(3), status: 'finished', homeScore: 20, awayScore: 10, winner: 'Home A' });
      await supabase.from('survivor_picks').insert([
        { participant_id: fixture.participants.Alice, pool_id: fixture.poolId, game_id: gameId, season: fixture.season, season_type: 2, week: 1, selected_team: 'HA' },
        { participant_id: fixture.participants.Bob, pool_id: fixture.poolId, game_id: gameId, season: fixture.season, season_type: 2, week: 1, selected_team: 'AA' },
      ]);

      await page.goto(`/pool/${fixture.poolId}/leaderboard`);
      await page.waitForSelector('text=/Survivor Standings/i', { timeout: 15000 });
      await page.waitForSelector('text=/Active/i', { timeout: 15000 });

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1); // +1 for sub-pixel rounding

      const bodyText = ((await page.textContent('body')) ?? '').toUpperCase();
      expect(bodyText).toContain('ELIMINATED');
    } finally {
      await cleanup(fixture);
    }
  });
});
