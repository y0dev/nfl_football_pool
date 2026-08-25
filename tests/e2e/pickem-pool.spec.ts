import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

// ─────────────────────────────────────────────────────────────
// Pick'em Pool — permanent regression coverage. computePickemWeekResult/
// computePickemSeasonSummary/submitPickemPick/submitPickemTiebreaker
// (src/lib/pickem.ts) are plain exported functions, not Next.js Server
// Actions, so they're imported and called directly here — same pattern as
// survivor-pool.spec.ts for src/lib/survivor.ts. Commissioner-only email/
// notify routes ARE real API routes and are tested via the `request`
// fixture against the real running server.
//
// Each test gets its own randomly-chosen fake "season" number so that
// computePickemSeasonSummary()'s season-wide games query (not pool-scoped)
// can never see another concurrently-running test's fixture games — this
// suite runs with fullyParallel: true.
// ─────────────────────────────────────────────────────────────

import { createPool } from '../../src/actions/createPool';
import {
  computePickemWeekResult,
  computePickemSeasonSummary,
  submitPickemPick,
  submitPickemTiebreaker,
} from '../../src/lib/pickem';
import { DEFAULT_PICKEM_TYPE_SETTINGS } from '../../src/lib/pickem-settings';

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
  ownerId: string;
  poolId: string;
  season: number;
  participants: Record<string, string>;
  gameIds: string[];
}

/** Creates a Pick'em pool with a backdated created_at, matching the
 * convention established for Survivor's fixtures (avoids any "pool created
 * after these weeks already happened" edge cases, even though Pick'em's
 * week-eligibility logic doesn't have Survivor's no-pick-before-creation
 * guard — kept for consistency and future-proofing). */
async function setupPickemPool(opts: {
  participantNames: string[];
  typeSettings?: Record<string, unknown>;
  season?: number;
  seasonScope?: number[];
  /** Season & playoff tracking (season_scope including postseason, 3) is a
   * Standard-plan feature gated in createPool.ts regardless of competition
   * type — set true to pre-register the generated owner as Standard so a
   * postseason-scoped fixture pool doesn't hit that unrelated, pre-existing
   * gate. */
  standardPlanOwner?: boolean;
}): Promise<Fixture> {
  const season = opts.season ?? fakeSeason();
  const ownerEmail = `e2e-pickem-${season}-${Date.now()}@sundayhuddle.net`;

  // A real commissioner row is required regardless of plan — routes now
  // authenticate the pool owner via a real account (session-derived),
  // matching production (nobody can create a pool without one).
  const { data: ownerRow, error: ownerError } = await supabase
    .from('commissioners')
    .insert({ email: ownerEmail, password_hash: 'google_oauth', full_name: 'E2E Pickem Owner', plan: opts.standardPlanOwner ? 'standard' : 'free', is_active: true })
    .select('id')
    .single();
  if (ownerError || !ownerRow) throw new Error(`Failed to seed Pick'em pool owner: ${ownerError?.message}`);
  const ownerId = ownerRow.id;

  const result = await createPool({
    name: `E2E Pickem ${season}`,
    created_by: ownerEmail,
    season,
    season_scope: opts.seasonScope ?? [2],
    competition_type: 'PICKEM',
    type_settings: opts.typeSettings ?? {},
  });
  if (!result.success) throw new Error(`Failed to create Pick'em pool: ${result.error}`);
  const poolId = result.data.id as string;

  await supabase.from('pools').update({ created_at: daysAgo(30) }).eq('id', poolId);

  const { data: parts } = await supabase
    .from('participants')
    .insert(opts.participantNames.map(name => ({ pool_id: poolId, name, email: `${name.toLowerCase().replace(/\s+/g, '')}@example.com`, is_active: true })))
    .select('id, name');

  const participants = Object.fromEntries((parts ?? []).map(p => [p.name, p.id]));
  return { ownerEmail, ownerId, poolId, season, participants, gameIds: [] };
}

async function createGame(fixture: Fixture, opts: {
  week: number; seasonType?: number;
  homeTeam: string; awayTeam: string; homeTeamId: string; awayTeamId: string;
  kickoff: string; status: string; homeScore?: number | null; awayScore?: number | null;
}): Promise<string> {
  const gameId = `e2e-pkm-${fixture.season}-w${opts.week}-${Math.floor(Math.random() * 1e9)}`;
  await supabase.from('games').insert({
    id: gameId, season: fixture.season, season_type: opts.seasonType ?? 2, week: opts.week,
    home_team: opts.homeTeam, away_team: opts.awayTeam, home_team_id: opts.homeTeamId, away_team_id: opts.awayTeamId,
    kickoff_time: opts.kickoff, status: opts.status,
    home_score: opts.homeScore ?? null, away_score: opts.awayScore ?? null,
  });
  fixture.gameIds.push(gameId);
  return gameId;
}

/** Inserts a pickem_picks row directly, bypassing submitPickemPick's
 * server-side lock check. Used for scoring/winner/season tests that fixture
 * an already-FINISHED game — a real submission would correctly be rejected
 * once a game's kickoff has passed (see submitPickemPick's isGameLocked
 * check), so scenarios that need "this participant picked this now-final
 * game" must seed the pick directly, the same way survivor-pool.spec.ts
 * does for its own already-decided-game scoring tests. Tests that exercise
 * submitPickemPick itself use scheduled/future games instead. */
async function insertPick(fixture: Fixture, participantId: string, gameId: string, selectedTeam: string) {
  const { data: game } = await supabase.from('games').select('season_type, week').eq('id', gameId).single();
  await supabase.from('pickem_picks').insert({
    participant_id: participantId, pool_id: fixture.poolId, game_id: gameId,
    season: fixture.season, season_type: game!.season_type, week: game!.week, selected_team: selectedTeam,
  });
}

async function insertTiebreaker(fixture: Fixture, participantId: string, week: number, seasonType: number, gameId: string, predictedTotal: number) {
  await supabase.from('pickem_tiebreakers').insert({
    participant_id: participantId, pool_id: fixture.poolId, game_id: gameId,
    season: fixture.season, season_type: seasonType, week, predicted_total: predictedTotal,
  });
}

async function cleanup(fixture: Fixture) {
  await supabase.from('pools').delete().eq('id', fixture.poolId); // cascades participants + pickem_picks/pickem_tiebreakers
  for (const id of fixture.gameIds) await supabase.from('games').delete().eq('id', id);
  await supabase.from('huddles').delete().eq('commissioner_email', fixture.ownerEmail);
  await supabase.from('commissioners').delete().eq('id', fixture.ownerId);
}

test.describe("Pick'em Pool — creation", () => {
  test('creates successfully with competition_type PICKEM and pool_type left untouched', async () => {
    const fixture = await setupPickemPool({ participantNames: ['Alice'] });
    try {
      const { data: row } = await supabase.from('pools').select('competition_type, pool_type, type_settings').eq('id', fixture.poolId).single();
      expect(row?.competition_type).toBe('PICKEM');
      expect(row?.pool_type).toBe('normal');
    } finally {
      await cleanup(fixture);
    }
  });

  test('defaults to tiebreaker enabled / total_combined_score when unset', async () => {
    const fixture = await setupPickemPool({ participantNames: ['Alice'] });
    try {
      const week = await createGame(fixture, { week: 1, homeTeam: 'Home A', awayTeam: 'Away A', homeTeamId: 'HA', awayTeamId: 'AA', kickoff: daysFromNow(3), status: 'scheduled' });
      const result = await computePickemWeekResult(fixture.poolId, 1, 2);
      expect(result.eligibleGames.map(g => g.id)).toContain(week);
      const summary = await computePickemSeasonSummary(fixture.poolId);
      expect(summary.settings).toEqual(DEFAULT_PICKEM_TYPE_SETTINGS);
    } finally {
      await cleanup(fixture);
    }
  });
});

test.describe("Pick'em Pool — pick submission", () => {
  test('valid pick succeeds', async () => {
    const fixture = await setupPickemPool({ participantNames: ['Alice'] });
    try {
      const gameId = await createGame(fixture, { week: 1, homeTeam: 'Home A', awayTeam: 'Away A', homeTeamId: 'HA', awayTeamId: 'AA', kickoff: daysFromNow(3), status: 'scheduled' });
      const result = await submitPickemPick({ participantId: fixture.participants.Alice, poolId: fixture.poolId, gameId, selectedTeam: 'HA' });
      expect(result.success).toBe(true);
    } finally {
      await cleanup(fixture);
    }
  });

  test('changing a pick before the game starts upserts rather than duplicating', async () => {
    const fixture = await setupPickemPool({ participantNames: ['Alice'] });
    try {
      const gameId = await createGame(fixture, { week: 1, homeTeam: 'Home A', awayTeam: 'Away A', homeTeamId: 'HA', awayTeamId: 'AA', kickoff: daysFromNow(3), status: 'scheduled' });
      await submitPickemPick({ participantId: fixture.participants.Alice, poolId: fixture.poolId, gameId, selectedTeam: 'HA' });
      await submitPickemPick({ participantId: fixture.participants.Alice, poolId: fixture.poolId, gameId, selectedTeam: 'AA' });
      const { data: picks } = await supabase.from('pickem_picks').select('selected_team').eq('participant_id', fixture.participants.Alice).eq('game_id', gameId);
      expect(picks).toHaveLength(1);
      expect(picks![0].selected_team).toBe('AA');
    } finally {
      await cleanup(fixture);
    }
  });

  test('rejects a team that is not actually playing in the given game', async () => {
    const fixture = await setupPickemPool({ participantNames: ['Alice'] });
    try {
      const gameId = await createGame(fixture, { week: 1, homeTeam: 'Home A', awayTeam: 'Away A', homeTeamId: 'HA', awayTeamId: 'AA', kickoff: daysFromNow(3), status: 'scheduled' });
      const result = await submitPickemPick({ participantId: fixture.participants.Alice, poolId: fixture.poolId, gameId, selectedTeam: 'ZZ' });
      expect(result.success).toBe(false);
    } finally {
      await cleanup(fixture);
    }
  });

  test('rejects a pick submitted too early (more than DAYS_BEFORE_GAME before the week opens)', async () => {
    const fixture = await setupPickemPool({ participantNames: ['Alice'] });
    try {
      const gameId = await createGame(fixture, { week: 1, homeTeam: 'Home A', awayTeam: 'Away A', homeTeamId: 'HA', awayTeamId: 'AA', kickoff: daysFromNow(20), status: 'scheduled' });
      const result = await submitPickemPick({ participantId: fixture.participants.Alice, poolId: fixture.poolId, gameId, selectedTeam: 'HA' });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toMatch(/not open/i);
    } finally {
      await cleanup(fixture);
    }
  });

  test('rejects a pick for a game that has already started', async () => {
    const fixture = await setupPickemPool({ participantNames: ['Alice'] });
    try {
      const gameId = await createGame(fixture, { week: 1, homeTeam: 'Home A', awayTeam: 'Away A', homeTeamId: 'HA', awayTeamId: 'AA', kickoff: daysAgo(1), status: 'in_progress' });
      const result = await submitPickemPick({ participantId: fixture.participants.Alice, poolId: fixture.poolId, gameId, selectedTeam: 'HA' });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toMatch(/already started/i);
    } finally {
      await cleanup(fixture);
    }
  });

  test('a started game does not lock a still-upcoming game in the same week (per-game, not whole-week, locking)', async () => {
    const fixture = await setupPickemPool({ participantNames: ['Alice'] });
    try {
      // Thursday game already started...
      await createGame(fixture, { week: 1, homeTeam: 'Thu Home', awayTeam: 'Thu Away', homeTeamId: 'TH', awayTeamId: 'TA', kickoff: daysAgo(1), status: 'in_progress' });
      // ...but Sunday's game hasn't, and should still be pickable.
      const sundayGame = await createGame(fixture, { week: 1, homeTeam: 'Sun Home', awayTeam: 'Sun Away', homeTeamId: 'SH', awayTeamId: 'SA', kickoff: daysFromNow(2), status: 'scheduled' });
      const result = await submitPickemPick({ participantId: fixture.participants.Alice, poolId: fixture.poolId, gameId: sundayGame, selectedTeam: 'SH' });
      expect(result.success).toBe(true);
    } finally {
      await cleanup(fixture);
    }
  });
});

test.describe("Pick'em Pool — completeness (\"Please make a pick for all games\")", () => {
  test('isComplete is false until every eligible game has a pick, dynamically sized to the actual schedule', async () => {
    const fixture = await setupPickemPool({ participantNames: ['Alice'] });
    try {
      const g1 = await createGame(fixture, { week: 1, homeTeam: 'Home A', awayTeam: 'Away A', homeTeamId: 'HA', awayTeamId: 'AA', kickoff: daysFromNow(3), status: 'scheduled' });
      await createGame(fixture, { week: 1, homeTeam: 'Home B', awayTeam: 'Away B', homeTeamId: 'HB', awayTeamId: 'BB', kickoff: daysFromNow(3), status: 'scheduled' });

      await submitPickemPick({ participantId: fixture.participants.Alice, poolId: fixture.poolId, gameId: g1, selectedTeam: 'HA' });
      const result = await computePickemWeekResult(fixture.poolId, 1, 2);
      expect(result.participants[0].isComplete).toBe(false);
      expect(result.eligibleGames).toHaveLength(2); // never a hardcoded count
    } finally {
      await cleanup(fixture);
    }
  });

  test('one-game week (e.g. preseason week 1) requires only one pick to be complete', async () => {
    const fixture = await setupPickemPool({ participantNames: ['Alice'], seasonScope: [1] });
    try {
      const g1 = await createGame(fixture, { week: 1, seasonType: 1, homeTeam: 'Home A', awayTeam: 'Away A', homeTeamId: 'HA', awayTeamId: 'AA', kickoff: daysFromNow(3), status: 'scheduled' });
      await submitPickemPick({ participantId: fixture.participants.Alice, poolId: fixture.poolId, gameId: g1, selectedTeam: 'HA' });
      const result = await computePickemWeekResult(fixture.poolId, 1, 1);
      expect(result.eligibleGames).toHaveLength(1);
      expect(result.participants[0].isComplete).toBe(true);
    } finally {
      await cleanup(fixture);
    }
  });
});

test.describe("Pick'em Pool — scoring", () => {
  test('correct pick = 1 point', async () => {
    const fixture = await setupPickemPool({ participantNames: ['Alice'] });
    try {
      const gameId = await createGame(fixture, { week: 1, homeTeam: 'Home A', awayTeam: 'Away A', homeTeamId: 'HA', awayTeamId: 'AA', kickoff: daysAgo(3), status: 'finished', homeScore: 20, awayScore: 10 });
      await insertPick(fixture, fixture.participants.Alice, gameId, 'HA');
      const result = await computePickemWeekResult(fixture.poolId, 1, 2);
      expect(result.participants[0].correctCount).toBe(1);
      expect(result.participants[0].picks[0].result).toBe('correct');
    } finally {
      await cleanup(fixture);
    }
  });

  test('incorrect pick = 0 points', async () => {
    const fixture = await setupPickemPool({ participantNames: ['Bob'] });
    try {
      const gameId = await createGame(fixture, { week: 1, homeTeam: 'Home A', awayTeam: 'Away A', homeTeamId: 'HA', awayTeamId: 'AA', kickoff: daysAgo(3), status: 'finished', homeScore: 20, awayScore: 10 });
      await insertPick(fixture, fixture.participants.Bob, gameId, 'AA');
      const result = await computePickemWeekResult(fixture.poolId, 1, 2);
      expect(result.participants[0].correctCount).toBe(0);
      expect(result.participants[0].picks[0].result).toBe('incorrect');
    } finally {
      await cleanup(fixture);
    }
  });

  test('pending game is not scored', async () => {
    const fixture = await setupPickemPool({ participantNames: ['Alice'] });
    try {
      const gameId = await createGame(fixture, { week: 1, homeTeam: 'Home A', awayTeam: 'Away A', homeTeamId: 'HA', awayTeamId: 'AA', kickoff: daysAgo(1), status: 'in_progress' });
      // Pick made before kickoff, game now in progress — insert directly
      // (submitPickemPick would correctly reject a NEW submission once the
      // game has started; this simulates one already on record).
      await insertPick(fixture, fixture.participants.Alice, gameId, 'HA');
      const result = await computePickemWeekResult(fixture.poolId, 1, 2);
      expect(result.participants[0].picks[0].result).toBe('pending');
      expect(result.participants[0].correctCount).toBe(0);
      expect(result.isWeekFinal).toBe(false);
    } finally {
      await cleanup(fixture);
    }
  });

  test('postponed game is not incorrectly scored as a loss', async () => {
    const fixture = await setupPickemPool({ participantNames: ['Alice'] });
    try {
      const gameId = await createGame(fixture, { week: 1, homeTeam: 'Home A', awayTeam: 'Away A', homeTeamId: 'HA', awayTeamId: 'AA', kickoff: daysAgo(1), status: 'postponed' });
      await insertPick(fixture, fixture.participants.Alice, gameId, 'HA');
      const result = await computePickemWeekResult(fixture.poolId, 1, 2);
      expect(result.participants[0].picks[0].result).toBe('pending');
      expect(result.isWeekFinal).toBe(false);
    } finally {
      await cleanup(fixture);
    }
  });

  test('weekly score is the count of correct picks across all games', async () => {
    const fixture = await setupPickemPool({ participantNames: ['John'] });
    try {
      const g1 = await createGame(fixture, { week: 1, homeTeam: 'H1', awayTeam: 'A1', homeTeamId: 'H1', awayTeamId: 'A1', kickoff: daysAgo(3), status: 'finished', homeScore: 20, awayScore: 10 });
      const g2 = await createGame(fixture, { week: 1, homeTeam: 'H2', awayTeam: 'A2', homeTeamId: 'H2', awayTeamId: 'A2', kickoff: daysAgo(3), status: 'finished', homeScore: 14, awayScore: 21 });
      await insertPick(fixture, fixture.participants.John, g1, 'H1'); // correct
      await insertPick(fixture, fixture.participants.John, g2, 'H2'); // incorrect
      const result = await computePickemWeekResult(fixture.poolId, 1, 2);
      expect(result.participants[0].correctCount).toBe(1);
    } finally {
      await cleanup(fixture);
    }
  });
});

test.describe("Pick'em Pool — weekly winner and tiebreaker", () => {
  test('the participant with the most correct picks wins the week', async () => {
    const fixture = await setupPickemPool({ participantNames: ['John', 'Sarah'] });
    try {
      const g1 = await createGame(fixture, { week: 1, homeTeam: 'H1', awayTeam: 'A1', homeTeamId: 'H1', awayTeamId: 'A1', kickoff: daysAgo(3), status: 'finished', homeScore: 20, awayScore: 10 });
      const g2 = await createGame(fixture, { week: 1, homeTeam: 'H2', awayTeam: 'A2', homeTeamId: 'H2', awayTeamId: 'A2', kickoff: daysAgo(3), status: 'finished', homeScore: 14, awayScore: 21 });
      await insertPick(fixture, fixture.participants.John, g1, 'H1');
      await insertPick(fixture, fixture.participants.John, g2, 'A2');
      await insertPick(fixture, fixture.participants.Sarah, g1, 'A1');
      await insertPick(fixture, fixture.participants.Sarah, g2, 'A2');

      const result = await computePickemWeekResult(fixture.poolId, 1, 2);
      expect(result.isWeekFinal).toBe(true);
      expect(result.winnerParticipantIds).toEqual([fixture.participants.John]);
    } finally {
      await cleanup(fixture);
    }
  });

  test('no winner is determined until the week is fully final', async () => {
    const fixture = await setupPickemPool({ participantNames: ['John'] });
    try {
      await createGame(fixture, { week: 1, homeTeam: 'H1', awayTeam: 'A1', homeTeamId: 'H1', awayTeamId: 'A1', kickoff: daysAgo(1), status: 'in_progress' });
      const result = await computePickemWeekResult(fixture.poolId, 1, 2);
      expect(result.isWeekFinal).toBe(false);
      expect(result.winnerParticipantIds).toEqual([]);
    } finally {
      await cleanup(fixture);
    }
  });

  test('tiebreaker resolves a tie by closest predicted combined score', async () => {
    const fixture = await setupPickemPool({ participantNames: ['John', 'Sarah', 'Mike'] });
    try {
      // Deliberately NOT daysAgo(3) — that value's day-of-week/hour depends
      // on whenever the test happens to run, and selectTiebreakerGame picks
      // by Monday-evening kickoff, so a non-deterministic kickoff could
      // accidentally collide with the real MNF game below and flake this
      // test. sundayAt pins it to a guaranteed-non-Monday-evening slot.
      const g1 = await createGame(fixture, { week: 1, homeTeam: 'H1', awayTeam: 'A1', homeTeamId: 'H1', awayTeamId: 'A1', kickoff: sundayAt(daysAgo(3), 13), status: 'finished', homeScore: 20, awayScore: 10 });
      // Monday night tiebreaker game — actual combined score 47.
      const mnf = await createGame(fixture, { week: 1, homeTeam: 'Cowboys', awayTeam: 'Giants', homeTeamId: 'DAL', awayTeamId: 'NYG', kickoff: mondayAt(daysFromNow(-2), 20), status: 'finished', homeScore: 27, awayScore: 20 });

      for (const name of ['John', 'Sarah', 'Mike']) {
        await insertPick(fixture, fixture.participants[name], g1, 'H1');
        await insertPick(fixture, fixture.participants[name], mnf, 'DAL');
      }
      // All 3 have 2/2 correct — tied. Tiebreaker predictions:
      await insertTiebreaker(fixture, fixture.participants.John, 1, 2, mnf, 47);
      await insertTiebreaker(fixture, fixture.participants.Sarah, 1, 2, mnf, 51);
      await insertTiebreaker(fixture, fixture.participants.Mike, 1, 2, mnf, 43);

      const result = await computePickemWeekResult(fixture.poolId, 1, 2);
      const john = result.participants.find(p => p.participantId === fixture.participants.John)!;
      const sarah = result.participants.find(p => p.participantId === fixture.participants.Sarah)!;
      expect(john.correctCount).toBe(2);
      expect(sarah.correctCount).toBe(2);
      expect(result.winnerParticipantIds).toEqual([fixture.participants.John]); // |47-47|=0 beats |51-47|=4 and |43-47|=4
    } finally {
      await cleanup(fixture);
    }
  });

  test('tiebreaker prediction never adds to the weekly score', async () => {
    const fixture = await setupPickemPool({ participantNames: ['Alice'] });
    try {
      const gameId = await createGame(fixture, { week: 1, homeTeam: 'Home A', awayTeam: 'Away A', homeTeamId: 'HA', awayTeamId: 'AA', kickoff: daysAgo(3), status: 'finished', homeScore: 20, awayScore: 10 });
      await insertPick(fixture, fixture.participants.Alice, gameId, 'HA');
      await insertTiebreaker(fixture, fixture.participants.Alice, 1, 2, gameId, 30);
      const result = await computePickemWeekResult(fixture.poolId, 1, 2);
      expect(result.participants[0].correctCount).toBe(1); // still just the 1 correct pick, not +1 for a tiebreaker
    } finally {
      await cleanup(fixture);
    }
  });

  test('tiebreaker is ignored when nobody is tied for first', async () => {
    const fixture = await setupPickemPool({ participantNames: ['John', 'Sarah'] });
    try {
      const g1 = await createGame(fixture, { week: 1, homeTeam: 'H1', awayTeam: 'A1', homeTeamId: 'H1', awayTeamId: 'A1', kickoff: daysAgo(3), status: 'finished', homeScore: 20, awayScore: 10 });
      await insertPick(fixture, fixture.participants.John, g1, 'H1'); // correct — sole leader
      await insertPick(fixture, fixture.participants.Sarah, g1, 'A1'); // incorrect
      // Sarah predicts a suspiciously perfect tiebreaker — must not matter, she has fewer correct picks.
      await insertTiebreaker(fixture, fixture.participants.Sarah, 1, 2, g1, 0);

      const result = await computePickemWeekResult(fixture.poolId, 1, 2);
      expect(result.winnerParticipantIds).toEqual([fixture.participants.John]);
    } finally {
      await cleanup(fixture);
    }
  });

  test('tiebreaker settings can be disabled, leaving a tie unresolved (co-winners, never an arbitrary pick)', async () => {
    const fixture = await setupPickemPool({ participantNames: ['John', 'Sarah'], typeSettings: { tiebreakerEnabled: false } });
    try {
      const g1 = await createGame(fixture, { week: 1, homeTeam: 'H1', awayTeam: 'A1', homeTeamId: 'H1', awayTeamId: 'A1', kickoff: daysAgo(3), status: 'finished', homeScore: 20, awayScore: 10 });
      await insertPick(fixture, fixture.participants.John, g1, 'H1');
      await insertPick(fixture, fixture.participants.Sarah, g1, 'H1');
      const result = await computePickemWeekResult(fixture.poolId, 1, 2);
      expect(result.winnerParticipantIds.sort()).toEqual([fixture.participants.John, fixture.participants.Sarah].sort());
    } finally {
      await cleanup(fixture);
    }
  });
});

test.describe("Pick'em Pool — season totals and winner", () => {
  test('season score is the sum of correct picks across every week', async () => {
    const fixture = await setupPickemPool({ participantNames: ['John'] });
    try {
      const w1 = await createGame(fixture, { week: 1, homeTeam: 'H1', awayTeam: 'A1', homeTeamId: 'H1', awayTeamId: 'A1', kickoff: daysAgo(10), status: 'finished', homeScore: 20, awayScore: 10 });
      const w2 = await createGame(fixture, { week: 2, homeTeam: 'H2', awayTeam: 'A2', homeTeamId: 'H2', awayTeamId: 'A2', kickoff: daysAgo(3), status: 'finished', homeScore: 20, awayScore: 10 });
      await insertPick(fixture, fixture.participants.John, w1, 'H1'); // correct
      await insertPick(fixture, fixture.participants.John, w2, 'A2'); // incorrect
      const summary = await computePickemSeasonSummary(fixture.poolId);
      expect(summary.participants[0].seasonCorrectCount).toBe(1);
      expect(summary.participants[0].weeklyResults).toHaveLength(2);
    } finally {
      await cleanup(fixture);
    }
  });

  test('season winner is only determined once every week in scope is final', async () => {
    const fixture = await setupPickemPool({ participantNames: ['John'] });
    try {
      await createGame(fixture, { week: 1, homeTeam: 'H1', awayTeam: 'A1', homeTeamId: 'H1', awayTeamId: 'A1', kickoff: daysAgo(3), status: 'finished', homeScore: 20, awayScore: 10 });
      await createGame(fixture, { week: 2, homeTeam: 'H2', awayTeam: 'A2', homeTeamId: 'H2', awayTeamId: 'A2', kickoff: daysAgo(1), status: 'in_progress' });
      const summary = await computePickemSeasonSummary(fixture.poolId);
      expect(summary.isSeasonComplete).toBe(false);
      expect(summary.seasonWinnerParticipantIds).toEqual([]);
    } finally {
      await cleanup(fixture);
    }
  });

  test('season winner is the highest season total once complete', async () => {
    const fixture = await setupPickemPool({ participantNames: ['John', 'Sarah'] });
    try {
      const w1 = await createGame(fixture, { week: 1, homeTeam: 'H1', awayTeam: 'A1', homeTeamId: 'H1', awayTeamId: 'A1', kickoff: daysAgo(3), status: 'finished', homeScore: 20, awayScore: 10 });
      await insertPick(fixture, fixture.participants.John, w1, 'H1');
      await insertPick(fixture, fixture.participants.Sarah, w1, 'A1');
      const summary = await computePickemSeasonSummary(fixture.poolId);
      expect(summary.isSeasonComplete).toBe(true);
      expect(summary.seasonWinnerParticipantIds).toEqual([fixture.participants.John]);
    } finally {
      await cleanup(fixture);
    }
  });
});

test.describe('Pick\'em Pool — season type isolation', () => {
  test('preseason games do not leak into a regular-season week', async () => {
    const fixture = await setupPickemPool({ participantNames: ['Alice'], seasonScope: [1, 2] });
    try {
      await createGame(fixture, { week: 1, seasonType: 1, homeTeam: 'Pre A', awayTeam: 'Pre B', homeTeamId: 'PA', awayTeamId: 'PB', kickoff: daysAgo(20), status: 'finished', homeScore: 10, awayScore: 0 });
      await createGame(fixture, { week: 1, seasonType: 2, homeTeam: 'Reg A', awayTeam: 'Reg B', homeTeamId: 'RA', awayTeamId: 'RB', kickoff: daysAgo(3), status: 'scheduled' });
      const regularWeek1 = await computePickemWeekResult(fixture.poolId, 1, 2);
      expect(regularWeek1.eligibleGames).toHaveLength(1);
      expect(regularWeek1.eligibleGames[0].homeTeam).toBe('Reg A');
    } finally {
      await cleanup(fixture);
    }
  });

  test('postseason games do not leak into a regular-season week', async () => {
    const fixture = await setupPickemPool({ participantNames: ['Alice'], seasonScope: [2, 3], standardPlanOwner: true });
    try {
      await createGame(fixture, { week: 1, seasonType: 3, homeTeam: 'Playoff A', awayTeam: 'Playoff B', homeTeamId: 'XA', awayTeamId: 'XB', kickoff: daysFromNow(30), status: 'scheduled' });
      await createGame(fixture, { week: 1, seasonType: 2, homeTeam: 'Reg A', awayTeam: 'Reg B', homeTeamId: 'RA', awayTeamId: 'RB', kickoff: daysAgo(3), status: 'scheduled' });
      const regularWeek1 = await computePickemWeekResult(fixture.poolId, 1, 2);
      expect(regularWeek1.eligibleGames).toHaveLength(1);
      expect(regularWeek1.eligibleGames[0].homeTeam).toBe('Reg A');
    } finally {
      await cleanup(fixture);
    }
  });

  test('season summary only walks weeks inside the pool\'s own season_scope', async () => {
    const fixture = await setupPickemPool({ participantNames: ['Alice'], seasonScope: [2] }); // regular season only
    try {
      await createGame(fixture, { week: 1, seasonType: 1, homeTeam: 'Pre A', awayTeam: 'Pre B', homeTeamId: 'PA', awayTeamId: 'PB', kickoff: daysAgo(20), status: 'finished', homeScore: 10, awayScore: 0 });
      await createGame(fixture, { week: 1, seasonType: 2, homeTeam: 'Reg A', awayTeam: 'Reg B', homeTeamId: 'RA', awayTeamId: 'RB', kickoff: daysAgo(3), status: 'finished', homeScore: 10, awayScore: 0 });
      const summary = await computePickemSeasonSummary(fixture.poolId);
      expect(summary.participants[0].weeklyResults).toHaveLength(1);
      expect(summary.participants[0].weeklyResults[0].seasonType).toBe(2);
    } finally {
      await cleanup(fixture);
    }
  });
});

test.describe("Pick'em Pool — Survivor logic never invoked", () => {
  test('a Pick\'em pool never writes to survivor_picks or survivor_winners', async () => {
    const fixture = await setupPickemPool({ participantNames: ['Alice'] });
    try {
      const gameId = await createGame(fixture, { week: 1, homeTeam: 'Home A', awayTeam: 'Away A', homeTeamId: 'HA', awayTeamId: 'AA', kickoff: daysFromNow(3), status: 'scheduled' });
      await submitPickemPick({ participantId: fixture.participants.Alice, poolId: fixture.poolId, gameId, selectedTeam: 'HA' });
      const { data: survivorPicks } = await supabase.from('survivor_picks').select('id').eq('pool_id', fixture.poolId);
      const { data: survivorWinners } = await supabase.from('survivor_winners').select('id').eq('pool_id', fixture.poolId);
      expect(survivorPicks).toHaveLength(0);
      expect(survivorWinners).toHaveLength(0);
    } finally {
      await cleanup(fixture);
    }
  });
});

test.describe("Pick'em Pool — multiple pools and mixed Huddles", () => {
  test('two Pick\'em pools operate completely independently', async () => {
    const fixtureA = await setupPickemPool({ participantNames: ['Alice'] });
    const fixtureB = await setupPickemPool({ participantNames: ['Alice'] });
    try {
      const gameA = await createGame(fixtureA, { week: 1, homeTeam: 'Home A', awayTeam: 'Away A', homeTeamId: 'HA', awayTeamId: 'AA', kickoff: daysAgo(3), status: 'finished', homeScore: 20, awayScore: 10 });
      await insertPick(fixtureA, fixtureA.participants.Alice, gameA, 'AA'); // wrong

      const gameB = await createGame(fixtureB, { week: 1, homeTeam: 'Home B', awayTeam: 'Away B', homeTeamId: 'HB', awayTeamId: 'BB', kickoff: daysAgo(3), status: 'finished', homeScore: 20, awayScore: 10 });
      await insertPick(fixtureB, fixtureB.participants.Alice, gameB, 'HB'); // correct

      const resultA = await computePickemWeekResult(fixtureA.poolId, 1, 2);
      const resultB = await computePickemWeekResult(fixtureB.poolId, 1, 2);
      expect(resultA.participants[0].correctCount).toBe(0);
      expect(resultB.participants[0].correctCount).toBe(1);
    } finally {
      await cleanup(fixtureA);
      await cleanup(fixtureB);
    }
  });

  test('Pick\'em, Confidence, and Survivor pools coexist in the same Huddle without affecting each other', async () => {
    const commissionerEmail = `e2e-mixed-huddle-pickem-${Date.now()}@sundayhuddle.net`;
    let confidencePoolId: string | undefined;
    let survivorPoolId: string | undefined;
    let pickemPoolId: string | undefined;
    try {
      // Every plan (free and standard) caps a Huddle at 2 pools; this test
      // needs 3 in one Huddle, so grant one add-on pool up front — same
      // mechanism a real commissioner would purchase, not a test-only bypass.
      await supabase.from('commissioners').insert({ email: commissionerEmail, password_hash: 'google_oauth', full_name: 'E2E Mixed Owner', plan: 'standard', addon_pools: 1, is_active: true });

      const mixedSeason = fakeSeason();
      const confidenceResult = await createPool({ name: 'E2E Mixed Confidence', created_by: commissionerEmail, season: mixedSeason, season_scope: [2], competition_type: 'NFL_CONFIDENCE' });
      const survivorResult = await createPool({ name: 'E2E Mixed Survivor', created_by: commissionerEmail, season: mixedSeason, season_scope: [2], competition_type: 'SURVIVOR' });
      const pickemResult = await createPool({ name: 'E2E Mixed Pickem', created_by: commissionerEmail, season: mixedSeason, season_scope: [2], competition_type: 'PICKEM' });
      // Capture whatever DID get created before any assertion can throw —
      // otherwise a failed assertion here skips straight to `finally` with
      // these still undefined, leaking every pool that succeeded.
      if (confidenceResult.success) confidencePoolId = confidenceResult.data.id as string;
      if (survivorResult.success) survivorPoolId = survivorResult.data.id as string;
      if (pickemResult.success) pickemPoolId = pickemResult.data.id as string;
      expect(confidenceResult.success).toBe(true);
      expect(survivorResult.success).toBe(true);
      expect(pickemResult.success).toBe(true);

      const { data: pools } = await supabase.from('pools').select('id, competition_type, huddle_id').in('id', [confidencePoolId!, survivorPoolId!, pickemPoolId!]);
      const byId = new Map(pools!.map(p => [p.id, p]));
      expect(byId.get(confidencePoolId!)!.competition_type).toBe('NFL_CONFIDENCE');
      expect(byId.get(survivorPoolId!)!.competition_type).toBe('SURVIVOR');
      expect(byId.get(pickemPoolId!)!.competition_type).toBe('PICKEM');
      // Same commissioner -> same (only) Huddle for all three.
      expect(byId.get(confidencePoolId!)!.huddle_id).toBe(byId.get(pickemPoolId!)!.huddle_id);
      expect(byId.get(survivorPoolId!)!.huddle_id).toBe(byId.get(pickemPoolId!)!.huddle_id);
    } finally {
      if (confidencePoolId) await supabase.from('pools').delete().eq('id', confidencePoolId);
      if (survivorPoolId) await supabase.from('pools').delete().eq('id', survivorPoolId);
      if (pickemPoolId) await supabase.from('pools').delete().eq('id', pickemPoolId);
      await supabase.from('huddles').delete().eq('commissioner_email', commissionerEmail);
      await supabase.from('commissioners').delete().eq('email', commissionerEmail);
    }
  });
});

test.describe("Pick'em Pool — leaderboard / week API", () => {
  test('GET /api/pickem/week returns weekly results with correct-count and completeness', async ({ request }) => {
    const fixture = await setupPickemPool({ participantNames: ['Alice'] });
    try {
      const gameId = await createGame(fixture, { week: 1, homeTeam: 'Home A', awayTeam: 'Away A', homeTeamId: 'HA', awayTeamId: 'AA', kickoff: daysAgo(3), status: 'finished', homeScore: 20, awayScore: 10 });
      await insertPick(fixture, fixture.participants.Alice, gameId, 'HA');

      const res = await request.get(`/api/pickem/week?poolId=${fixture.poolId}&week=1&seasonType=2`);
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.result.participants[0].correctCount).toBe(1);
      expect(body.result.participants[0].isComplete).toBe(true);
    } finally {
      await cleanup(fixture);
    }
  });

  test('GET /api/pickem/season returns season totals', async ({ request }) => {
    const fixture = await setupPickemPool({ participantNames: ['Alice'] });
    try {
      const gameId = await createGame(fixture, { week: 1, homeTeam: 'Home A', awayTeam: 'Away A', homeTeamId: 'HA', awayTeamId: 'AA', kickoff: daysAgo(3), status: 'finished', homeScore: 20, awayScore: 10 });
      await insertPick(fixture, fixture.participants.Alice, gameId, 'HA');

      const res = await request.get(`/api/pickem/season?poolId=${fixture.poolId}`);
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.summary.participants[0].seasonCorrectCount).toBe(1);
    } finally {
      await cleanup(fixture);
    }
  });
});

test.describe("Pick'em Pool — mobile Picks page", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('Picks page renders without horizontal overflow on a phone-width viewport', async ({ page }) => {
    const fixture = await setupPickemPool({ participantNames: ['Alice', 'Bob'] });
    try {
      await createGame(fixture, { week: 1, homeTeam: 'Cowboys', awayTeam: 'Eagles', homeTeamId: 'DAL', awayTeamId: 'PHI', kickoff: daysFromNow(3), status: 'scheduled' });
      await createGame(fixture, { week: 1, homeTeam: 'Bills', awayTeam: 'Dolphins', homeTeamId: 'BUF', awayTeamId: 'MIA', kickoff: daysFromNow(3), status: 'scheduled' });

      await page.goto(`/pool/${fixture.poolId}/picks?week=1&seasonType=2`);
      // The Weekly Picks section (including the tiebreaker and game buttons)
      // only renders once a participant is selected — select one, matching
      // how a real participant would use the page.
      await page.waitForSelector('text=/Who\'s picking/i', { timeout: 15000 });
      await page.selectOption('select', { label: 'Alice' });
      await page.waitForSelector('text=/Weekly Picks/i', { timeout: 15000 });

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

      // innerText (not textContent) — visible rendered text only, so this
      // doesn't pick up the layout's global SEO <script type="application/
      // ld+json"> blob, which legitimately mentions "confidence points" as
      // site-wide marketing copy unrelated to this specific page's content.
      const bodyText = (await page.evaluate(() => document.body.innerText)).toUpperCase();
      expect(bodyText).toContain('PICK THE WINNER OF EACH GAME');
      expect(bodyText).not.toContain('CONFIDENCE POINT');
    } finally {
      await cleanup(fixture);
    }
  });
});

test.describe("Pick'em Pool — locked game result display", () => {
  test('a finished game shows the score and pick result instead of pick buttons', async ({ page }) => {
    const fixture = await setupPickemPool({ participantNames: ['Alice'] });
    try {
      const finishedGame = await createGame(fixture, {
        week: 1, homeTeam: 'Philadelphia Eagles', awayTeam: 'Dallas Cowboys', homeTeamId: 'PHI', awayTeamId: 'DAL',
        kickoff: daysAgo(3), status: 'finished', homeScore: 20, awayScore: 27,
      });
      await insertPick(fixture, fixture.participants.Alice, finishedGame, 'DAL');

      await page.goto(`/pool/${fixture.poolId}/picks?week=1&seasonType=2`);
      // Alice is the only participant and has already completed her picks,
      // so standings auto-show and hide the picker as soon as data loads
      // (matching Confidence's showResultsTabs) — "Force show picks form" is
      // the dev-only escape hatch for reviewing the picker/locked-row
      // display in that state. Wait for the debug panel itself (always
      // present regardless of showResultsSection) rather than "Who's
      // picking?", which may already be hidden by the time data loads.
      await page.waitForSelector('#debug-panel-controls', { timeout: 15000 });
      await page.locator('label:has-text("Force show picks form (ignore")').locator('input[type="checkbox"]').check();
      await page.waitForSelector('text=/Who\'s picking/i', { timeout: 15000 });
      await page.selectOption('select', { label: 'Alice' });
      await page.waitForSelector('text=/Weekly Picks/i', { timeout: 15000 });

      // The result itself is shown — no clickable pick buttons for a
      // finished game, and no separate "Game Details" disclosure exists on
      // this page to re-reveal the same information.
      await expect(page.locator('button:has-text("Dallas Cowboys")')).toHaveCount(0);
      await expect(page.getByText('Final', { exact: true })).toBeVisible();
      await expect(page.locator('text=/^27$/')).toBeVisible();
      await expect(page.locator('text=/^20$/')).toBeVisible();
      await expect(page.locator('text=/Your pick:\\s*Dallas/i')).toBeVisible();
      await expect(page.getByText('Correct', { exact: true })).toBeVisible();
      await expect(page.locator('button:has-text("Game Details")')).toHaveCount(0);
    } finally {
      await cleanup(fixture);
    }
  });
});

test.describe("Pick'em Pool — full picks flow (UI)", () => {
  test('select, pick, submit; already-submitted participant cannot pick again; leaderboard auto-shows and the picker disappears once everyone has picked', async ({ page }) => {
    const fixture = await setupPickemPool({ participantNames: ['Alice', 'Bob', 'Carol'] });
    try {
      const gameId = await createGame(fixture, {
        week: 1, homeTeam: 'Kansas City Chiefs', awayTeam: 'Buffalo Bills', homeTeamId: 'KC', awayTeamId: 'BUF',
        kickoff: daysFromNow(3), status: 'scheduled',
      });

      await page.goto(`/pool/${fixture.poolId}/picks?week=1&seasonType=2`);
      await page.waitForSelector('text=/Who\'s picking/i', { timeout: 15000 });

      // Alice picks and submits.
      await page.selectOption('select', { label: 'Alice' });
      await page.waitForSelector('button:has-text("Kansas City")', { timeout: 15000 });
      await page.locator('button:has-text("Kansas City")').click();
      await page.locator('button:has-text("Submit Picks")').click();
      await expect(page.getByText("Pick'em Standings", { exact: true })).toHaveCount(0);

      // Bob picks and submits — Carol hasn't yet, so standings stay hidden
      // and the picker is still reachable.
      await page.selectOption('select', { label: 'Bob' });
      await page.waitForSelector('button:has-text("Buffalo")', { timeout: 15000 });
      await page.locator('button:has-text("Buffalo")').click();
      await page.locator('button:has-text("Submit Picks")').click();
      await expect(page.getByText("Pick'em Standings", { exact: true })).toHaveCount(0);

      // Re-selecting Alice must show the locked/submitted view, not pick
      // buttons — a participant who already submitted cannot pick again.
      await page.selectOption('select', { label: 'Alice' });
      await expect(page.getByText('Picks Submitted', { exact: true })).toBeVisible({ timeout: 15000 });
      await expect(page.locator('button:has-text("Kansas City"), button:has-text("Buffalo")')).toHaveCount(0);
      await expect(page.locator('button:has-text("Submit Picks")')).toHaveCount(0);

      // Carol picks and submits — everyone has now submitted, but the game
      // still hasn't started, so standings must NOT reveal yet (matching
      // Confidence's own showResultsTabs gate, which also requires games to
      // have actually started, not just "everyone picked" — see
      // showResultsSection in pickem-picks-content.tsx). Switch away from
      // Alice's locked view first — the selector only reappears once no one
      // is selected.
      await page.locator('button:has-text("Not you? Switch")').click();
      await page.waitForSelector('text=/Who\'s picking/i', { timeout: 15000 });
      await page.selectOption('select', { label: 'Carol' });
      await page.waitForSelector('button:has-text("Kansas City")', { timeout: 15000 });
      await page.locator('button:has-text("Kansas City")').click();
      await Promise.all([
        page.waitForResponse(res => res.url().includes('/api/pickem/submit') && res.request().method() === 'POST'),
        page.locator('button:has-text("Submit Picks")').click(),
      ]);
      await expect(page.getByText("Pick'em Standings", { exact: true })).toHaveCount(0);

      // Now simulate kickoff actually arriving — everyone already picked
      // while the game was open (the realistic case: picks come in over the
      // days before kickoff), and only once the game has since started
      // should standings reveal. Waiting for the submit response above
      // (rather than reloading immediately after the click) matters here:
      // page.reload() cancels any still-in-flight request, which would
      // silently drop Carol's submission.
      await supabase.from('games').update({ kickoff_time: daysAgo(1), status: 'in_progress' }).eq('id', gameId);
      await page.reload();

      // Standings auto-show now that games have started AND everyone's
      // picked — and, matching Confidence, the entire picker/picks-form
      // section (including "Who's picking?") disappears since there's
      // nothing left to pick for anyone.
      await expect(page.getByText("Pick'em Standings", { exact: true })).toBeVisible({ timeout: 15000 });
      await expect(page.getByText("Who's picking?", { exact: false })).toHaveCount(0);
      await expect(page.locator('select')).toHaveCount(0);
    } finally {
      await cleanup(fixture);
    }
  });
});

test.describe("Pick'em Pool — emails", () => {
  test('send-reminders only reaches participants with incomplete picks for the current week', async ({ request }) => {
    const fixture = await setupPickemPool({ participantNames: ['Alice', 'Bob'] });
    try {
      const g1 = await createGame(fixture, { week: 1, homeTeam: 'Home A', awayTeam: 'Away A', homeTeamId: 'HA', awayTeamId: 'AA', kickoff: daysFromNow(3), status: 'scheduled' });
      await createGame(fixture, { week: 1, homeTeam: 'Home B', awayTeam: 'Away B', homeTeamId: 'HB', awayTeamId: 'BB', kickoff: daysFromNow(3), status: 'scheduled' });
      // Alice picks both games (complete); Bob picks none.
      await submitPickemPick({ participantId: fixture.participants.Alice, poolId: fixture.poolId, gameId: g1, selectedTeam: 'HA' });
      const g2 = fixture.gameIds[1];
      await submitPickemPick({ participantId: fixture.participants.Alice, poolId: fixture.poolId, gameId: g2, selectedTeam: 'HB' });

      const res = await request.post('/api/pickem/send-reminders', {
        headers: { Cookie: `sh-session=${fixture.ownerId}` },
        data: { poolId: fixture.poolId },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.results.total).toBe(1); // only Bob, who hasn't completed his picks
    } finally {
      await cleanup(fixture);
    }
  });

  test('notify-week-results sends once the week is final and rejects an unauthorized caller', async ({ request }) => {
    const fixture = await setupPickemPool({ participantNames: ['Alice'] });
    // A second, real but unrelated commissioner — proves the route enforces
    // per-pool ownership, not just "any signed-in account."
    const notOwnerEmail = `e2e-not-the-owner-${Date.now()}@sundayhuddle.net`;
    const { data: notOwner } = await supabase
      .from('commissioners')
      .insert({ email: notOwnerEmail, password_hash: 'google_oauth', full_name: 'E2E Not The Owner', plan: 'free', is_active: true })
      .select('id')
      .single();
    try {
      const gameId = await createGame(fixture, { week: 1, homeTeam: 'Home A', awayTeam: 'Away A', homeTeamId: 'HA', awayTeamId: 'AA', kickoff: daysAgo(3), status: 'finished', homeScore: 20, awayScore: 10 });
      await submitPickemPick({ participantId: fixture.participants.Alice, poolId: fixture.poolId, gameId, selectedTeam: 'HA' });

      const rejected = await request.post('/api/pickem/notify-week-results', {
        headers: { Cookie: `sh-session=${notOwner!.id}` },
        data: { poolId: fixture.poolId },
      });
      expect(rejected.status()).toBe(403);

      const allowed = await request.post('/api/pickem/notify-week-results', {
        headers: { Cookie: `sh-session=${fixture.ownerId}` },
        data: { poolId: fixture.poolId },
      });
      expect(allowed.status()).toBe(200);
      const body = await allowed.json();
      expect(body.success).toBe(true);
      expect(body.results.total).toBe(1);
    } finally {
      await supabase.from('commissioners').delete().eq('email', notOwnerEmail);
      await cleanup(fixture);
    }
  });
});

/** Rewrites a date to the next Monday at the given local hour — used only
 * to build a deterministic Monday-night fixture game for the tiebreaker
 * test, matching selectTiebreakerGame's own Monday+evening detection. */
function mondayAt(baseIso: string, hour: number): string {
  const d = new Date(baseIso);
  const day = d.getDay();
  const daysUntilMonday = (1 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + daysUntilMonday);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

/** Rewrites a date to the next Sunday at the given local hour — used to pin
 * a "just some other game" fixture kickoff away from Monday's 19:00-23:00
 * window, so it can never accidentally collide with selectTiebreakerGame's
 * Monday-night detection the way an uncontrolled kickoff time could. */
function sundayAt(baseIso: string, hour: number): string {
  const d = new Date(baseIso);
  const day = d.getDay();
  const daysUntilSunday = (0 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + daysUntilSunday);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}
