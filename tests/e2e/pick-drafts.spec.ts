import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

// ─────────────────────────────────────────────────────────────
// Pick drafts (src/app/api/picks/draft/route.ts, src/lib/pick-storage.ts,
// src/app/league/pool/[id]/override-picks/[participantId]/page.tsx) — a
// safety net for a participant who starts picking but never hits Submit.
// The picks UI auto-saves their in-progress selections here after 2 minutes
// of inactivity; a commissioner can then review and submit on their behalf
// from the override-picks page instead of the participant simply scoring
// zero. Covers: upsert-by-week (not duplicate rows), surfacing on the
// admin data route, and both real submission and a commissioner override
// clearing the now-resolved draft back out.
// ─────────────────────────────────────────────────────────────

import { createPool } from '../../src/actions/createPool';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY!
);

function sessionCookieFor(id: string) {
  return { Cookie: `sh-session=${id}` };
}

test.describe('Pick drafts', () => {
  test('POST /api/picks/draft upserts one row per week and surfaces on the admin data route', async ({ request }) => {
    test.setTimeout(45000);
    const ownerEmail = `e2e-draft-visible-${Date.now()}@sundayhuddle.test`;
    let ownerId: string | undefined;
    let poolId: string | undefined;
    let participantId: string | undefined;
    const gameIds: string[] = [];
    const season = 2020;
    const week = 11;

    try {
      const { data: owner, error: ownerError } = await supabase
        .from('commissioners')
        .insert({
          email: ownerEmail,
          password_hash: '$2b$12$fakehashfortest00000000000000000000000000000000000000',
          full_name: 'E2E Draft Owner',
          is_active: true,
        })
        .select('id')
        .single();
      if (ownerError || !owner) throw new Error(`Failed to seed owner commissioner: ${ownerError?.message}`);
      ownerId = owner.id;

      const created = await createPool({
        name: 'E2E Pick Drafts Pool',
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
        .insert([{ pool_id: poolId, name: 'Forgetful Fran', is_active: true }])
        .select('id');
      if (participantsError || !participants) throw new Error(`Failed to seed participant: ${participantsError?.message}`);
      participantId = participants[0].id;

      const gameOneId = `e2e-draft-${season}-w${week}-g1-${Date.now()}`;
      const gameTwoId = `e2e-draft-${season}-w${week}-g2-${Date.now()}`;
      gameIds.push(gameOneId, gameTwoId);
      const { error: gamesError } = await supabase.from('games').insert([
        {
          id: gameOneId, season, season_type: 2, week,
          home_team: 'Kansas City Chiefs', away_team: 'Dallas Cowboys',
          home_team_id: 1, away_team_id: 2,
          kickoff_time: '2020-11-15T13:00:00Z', status: 'scheduled',
        },
        {
          id: gameTwoId, season, season_type: 2, week,
          home_team: 'Buffalo Bills', away_team: 'Miami Dolphins',
          home_team_id: 3, away_team_id: 4,
          kickoff_time: '2020-11-15T20:00:00Z', status: 'scheduled',
        },
      ]);
      if (gamesError) throw new Error(`Failed to seed games: ${gamesError.message}`);

      // Participant-side: no admin session, just the (public) pool access gate.
      const draftRes = await request.post('/api/picks/draft', {
        data: {
          participantId, poolId, week, season, seasonType: 2,
          picks: [
            { participant_id: participantId, pool_id: poolId, game_id: gameOneId, predicted_winner: 'Kansas City Chiefs', confidence_points: 2 },
          ],
          mondayNightScore: 45,
        },
      });
      expect(draftRes.ok()).toBe(true);

      const { data: afterFirstSave } = await supabase
        .from('pick_drafts')
        .select('picks, monday_night_score')
        .eq('participant_id', participantId)
        .eq('pool_id', poolId);
      expect(afterFirstSave?.length).toBe(1);
      expect(afterFirstSave?.[0].picks).toEqual([{ game_id: gameOneId, predicted_winner: 'Kansas City Chiefs', confidence_points: 2 }]);
      expect(afterFirstSave?.[0].monday_night_score).toBe(45);

      // Saving again for the same week updates the one row, not a duplicate.
      const secondDraftRes = await request.post('/api/picks/draft', {
        data: {
          participantId, poolId, week, season, seasonType: 2,
          picks: [
            { participant_id: participantId, pool_id: poolId, game_id: gameOneId, predicted_winner: 'Kansas City Chiefs', confidence_points: 2 },
            { participant_id: participantId, pool_id: poolId, game_id: gameTwoId, predicted_winner: 'Buffalo Bills', confidence_points: 1 },
          ],
        },
      });
      expect(secondDraftRes.ok()).toBe(true);

      const { data: afterSecondSave } = await supabase
        .from('pick_drafts')
        .select('picks')
        .eq('participant_id', participantId)
        .eq('pool_id', poolId);
      expect(afterSecondSave?.length).toBe(1);
      expect(afterSecondSave?.[0].picks).toHaveLength(2);

      // Commissioner-side: the draft shows up on the override-picks data route.
      const dataRes = await request.get(`/api/admin/override-picks/data?poolId=${poolId}&week=${week}&season=${season}&seasonType=2`, {
        headers: { ...sessionCookieFor(ownerId!), 'x-admin-email': ownerEmail },
      });
      expect(dataRes.ok()).toBe(true);
      const data = await dataRes.json();
      expect(data.success).toBe(true);
      const participantDraft = data.drafts.find((d: { participant_id: string }) => d.participant_id === participantId);
      expect(participantDraft).toBeTruthy();
      expect(participantDraft.picks).toHaveLength(2);
    } finally {
      if (poolId && participantId) await supabase.from('pick_drafts').delete().eq('pool_id', poolId).eq('participant_id', participantId);
      if (gameIds.length) await supabase.from('games').delete().in('id', gameIds);
      if (poolId) await supabase.from('participants').delete().eq('pool_id', poolId);
      if (poolId) await supabase.from('pools').delete().eq('id', poolId);
      await supabase.from('huddles').delete().eq('commissioner_email', ownerEmail);
      if (ownerId) await supabase.from('commissioners').delete().eq('id', ownerId);
    }
  });

  test('a real submission and a commissioner override both clear the now-resolved draft', async ({ request }) => {
    test.setTimeout(45000);
    const ownerEmail = `e2e-draft-clear-${Date.now()}@sundayhuddle.test`;
    let ownerId: string | undefined;
    let poolId: string | undefined;
    const gameIds: string[] = [];
    const season = 2020;

    try {
      const { data: owner, error: ownerError } = await supabase
        .from('commissioners')
        .insert({
          email: ownerEmail,
          password_hash: '$2b$12$fakehashfortest00000000000000000000000000000000000000',
          full_name: 'E2E Draft Clear Owner',
          is_active: true,
        })
        .select('id')
        .single();
      if (ownerError || !owner) throw new Error(`Failed to seed owner commissioner: ${ownerError?.message}`);
      ownerId = owner.id;

      const created = await createPool({
        name: 'E2E Pick Drafts Clear Pool',
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
          { pool_id: poolId, name: 'Real Submitter Rita', is_active: true },
          { pool_id: poolId, name: 'Missed-Deadline Mo', is_active: true },
        ])
        .select('id');
      if (participantsError || !participants) throw new Error(`Failed to seed participants: ${participantsError?.message}`);
      const [ritaId, moId] = participants.map(p => p.id);

      // Week A: real-submit path — kickoff soon enough to be unlocked, but
      // not yet started, so a real /api/picks/submit call succeeds.
      const weekA = 12;
      const soonGameId = `e2e-draft-clear-${season}-w${weekA}-${Date.now()}`;
      gameIds.push(soonGameId);
      const soonKickoff = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
      const { error: soonGameError } = await supabase.from('games').insert({
        id: soonGameId, season, season_type: 2, week: weekA,
        home_team: 'Kansas City Chiefs', away_team: 'Dallas Cowboys',
        home_team_id: 1, away_team_id: 2,
        kickoff_time: soonKickoff, status: 'scheduled',
      });
      if (soonGameError) throw new Error(`Failed to seed games: ${soonGameError.message}`);

      await supabase.from('pick_drafts').insert({
        participant_id: ritaId, pool_id: poolId, season, season_type: 2, week: weekA,
        picks: [{ game_id: soonGameId, predicted_winner: 'Kansas City Chiefs', confidence_points: 1 }],
      });

      const submitRes = await request.post('/api/picks/submit', {
        data: {
          picks: [{
            participant_id: ritaId, pool_id: poolId, game_id: soonGameId,
            predicted_winner: 'Kansas City Chiefs', confidence_points: 1,
          }],
        },
      });
      expect(submitRes.ok()).toBe(true);

      const { data: ritaDraftAfter } = await supabase
        .from('pick_drafts')
        .select('id')
        .eq('participant_id', ritaId)
        .eq('pool_id', poolId)
        .eq('week', weekA);
      expect(ritaDraftAfter).toEqual([]);

      // Week B: commissioner-override path.
      const weekB = 13;
      const overrideGameId = `e2e-draft-clear-${season}-w${weekB}-${Date.now()}`;
      gameIds.push(overrideGameId);
      const { error: overrideGameError } = await supabase.from('games').insert({
        id: overrideGameId, season, season_type: 2, week: weekB,
        home_team: 'Buffalo Bills', away_team: 'Miami Dolphins',
        home_team_id: 3, away_team_id: 4,
        kickoff_time: '2020-12-06T13:00:00Z', status: 'scheduled',
      });
      if (overrideGameError) throw new Error(`Failed to seed games: ${overrideGameError.message}`);

      await supabase.from('pick_drafts').insert({
        participant_id: moId, pool_id: poolId, season, season_type: 2, week: weekB,
        picks: [{ game_id: overrideGameId, predicted_winner: 'Buffalo Bills', confidence_points: 1 }],
      });

      const overrideRes = await request.post('/api/admin/override-picks', {
        headers: sessionCookieFor(ownerId!),
        data: {
          poolId, participantId: moId, week: weekB, seasonType: 2,
          overrideMode: 'week',
          overrideReason: 'E2E: commissioner submitting the missed-deadline draft',
          weekPicks: [{ gameId: overrideGameId, predictedWinner: 'Buffalo Bills', confidencePoints: 1 }],
        },
      });
      expect(overrideRes.ok()).toBe(true);

      const { data: moDraftAfter } = await supabase
        .from('pick_drafts')
        .select('id')
        .eq('participant_id', moId)
        .eq('pool_id', poolId)
        .eq('week', weekB);
      expect(moDraftAfter).toEqual([]);
    } finally {
      if (poolId) await supabase.from('pick_drafts').delete().eq('pool_id', poolId);
      if (poolId) await supabase.from('picks').delete().eq('pool_id', poolId);
      if (poolId) await supabase.from('audit_logs').delete().eq('entity', 'pool').eq('entity_id', poolId);
      if (gameIds.length) await supabase.from('games').delete().in('id', gameIds);
      if (poolId) await supabase.from('participants').delete().eq('pool_id', poolId);
      if (poolId) await supabase.from('pools').delete().eq('id', poolId);
      await supabase.from('huddles').delete().eq('commissioner_email', ownerEmail);
      if (ownerId) await supabase.from('commissioners').delete().eq('id', ownerId);
    }
  });
});
