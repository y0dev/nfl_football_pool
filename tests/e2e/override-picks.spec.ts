import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

// ─────────────────────────────────────────────────────────────
// POST /api/admin/override-picks, overrideMode: 'week' — the bulk
// set/clear-a-participant's-picks-for-a-whole-week path that backs the new
// dedicated override-picks page (src/app/league/pool/[id]/override-picks/
// [participantId]/page.tsx), which replaced the old Add/Override Pick modal
// (its nested Select rendered behind the Dialog overlay). Covers: auth is
// resolved from the real sh-session cookie (not a client header), only the
// pool's owner (or a super admin) may call it, confidence points must be
// unique across the submitted set, an insert/update upserts by
// (participant_id, pool_id, game_id), and clearGameIds deletes picks back out.
// ─────────────────────────────────────────────────────────────

import { createPool } from '../../src/actions/createPool';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY!
);

function sessionCookieFor(id: string) {
  return { Cookie: `sh-session=${id}` };
}

test.describe('POST /api/admin/override-picks (overrideMode: week)', () => {
  test('bulk-sets a participant\'s week, rejects non-owners, enforces unique confidence points, and clears picks back out', async ({ request }) => {
    test.setTimeout(45000);

    const ownerEmail = `e2e-override-owner-${Date.now()}@sundayhuddle.test`;
    const otherEmail = `e2e-override-other-${Date.now()}@sundayhuddle.test`;
    let ownerId: string | undefined;
    let otherId: string | undefined;
    let poolId: string | undefined;
    let participantId: string | undefined;
    const gameIds: string[] = [];
    const season = 2020;
    const week = 7;

    try {
      // ── Seed: owning commissioner + a second, unrelated commissioner ──
      const { data: owner, error: ownerError } = await supabase
        .from('commissioners')
        .insert({
          email: ownerEmail,
          password_hash: '$2b$12$fakehashfortest00000000000000000000000000000000000000',
          full_name: 'E2E Override Owner',
          is_active: true,
        })
        .select('id')
        .single();
      if (ownerError || !owner) throw new Error(`Failed to seed owner commissioner: ${ownerError?.message}`);
      ownerId = owner.id;

      const { data: other, error: otherError } = await supabase
        .from('commissioners')
        .insert({
          email: otherEmail,
          password_hash: '$2b$12$fakehashfortest00000000000000000000000000000000000000',
          full_name: 'E2E Override Non-Owner',
          is_active: true,
        })
        .select('id')
        .single();
      if (otherError || !other) throw new Error(`Failed to seed other commissioner: ${otherError?.message}`);
      otherId = other.id;

      const created = await createPool({
        name: 'E2E Override Picks Pool',
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
        .insert([{ pool_id: poolId, name: 'Late Larry', is_active: true }])
        .select('id');
      if (participantsError || !participants) throw new Error(`Failed to seed participant: ${participantsError?.message}`);
      participantId = participants[0].id;

      const gameOneId = `e2e-override-${season}-w${week}-g1-${Date.now()}`;
      const gameTwoId = `e2e-override-${season}-w${week}-g2-${Date.now()}`;
      gameIds.push(gameOneId, gameTwoId);
      const { error: gamesError } = await supabase.from('games').insert([
        {
          id: gameOneId, season, season_type: 2, week,
          home_team: 'Kansas City Chiefs', away_team: 'Dallas Cowboys',
          home_team_id: 1, away_team_id: 2,
          kickoff_time: '2020-10-18T13:00:00Z', status: 'scheduled',
        },
        {
          id: gameTwoId, season, season_type: 2, week,
          home_team: 'Buffalo Bills', away_team: 'Miami Dolphins',
          home_team_id: 3, away_team_id: 4,
          kickoff_time: '2020-10-18T20:00:00Z', status: 'scheduled',
        },
      ]);
      if (gamesError) throw new Error(`Failed to seed games: ${gamesError.message}`);

      const basePayload = {
        poolId, participantId, week, seasonType: 2,
        overrideMode: 'week',
        overrideReason: 'E2E: participant missed the deadline',
      };

      // ── No session at all → 401 ──
      const unauthedRes = await request.post('/api/admin/override-picks', {
        data: { ...basePayload, weekPicks: [{ gameId: gameOneId, predictedWinner: 'Kansas City Chiefs', confidencePoints: 1 }] },
      });
      expect(unauthedRes.status()).toBe(401);

      // ── Real session, but not this pool's owner → 403 ──
      const wrongOwnerRes = await request.post('/api/admin/override-picks', {
        headers: sessionCookieFor(otherId!),
        data: { ...basePayload, weekPicks: [{ gameId: gameOneId, predictedWinner: 'Kansas City Chiefs', confidencePoints: 1 }] },
      });
      expect(wrongOwnerRes.status()).toBe(403);

      // ── Duplicate confidence points across the submitted set → 400 ──
      const dupeRes = await request.post('/api/admin/override-picks', {
        headers: sessionCookieFor(ownerId!),
        data: {
          ...basePayload,
          weekPicks: [
            { gameId: gameOneId, predictedWinner: 'Kansas City Chiefs', confidencePoints: 2 },
            { gameId: gameTwoId, predictedWinner: 'Buffalo Bills', confidencePoints: 2 },
          ],
        },
      });
      expect(dupeRes.status()).toBe(400);
      const dupeBody = await dupeRes.json();
      expect(dupeBody.error).toMatch(/unique/i);

      // ── Happy path: owner sets both games in one call ──
      const setRes = await request.post('/api/admin/override-picks', {
        headers: sessionCookieFor(ownerId!),
        data: {
          ...basePayload,
          reduceConfidence: true,
          weekPicks: [
            { gameId: gameOneId, predictedWinner: 'Kansas City Chiefs', confidencePoints: 1 },
            { gameId: gameTwoId, predictedWinner: 'Buffalo Bills', confidencePoints: 2 },
          ],
        },
      });
      expect(setRes.ok()).toBe(true);
      const setBody = await setRes.json();
      expect(setBody.success).toBe(true);

      const { data: afterSet } = await supabase
        .from('picks')
        .select('game_id, predicted_winner, confidence_points, submitted_by')
        .eq('pool_id', poolId)
        .eq('participant_id', participantId)
        .order('confidence_points', { ascending: true });
      expect(afterSet).toEqual([
        { game_id: gameOneId, predicted_winner: 'Kansas City Chiefs', confidence_points: 1, submitted_by: 'admin_override' },
        { game_id: gameTwoId, predicted_winner: 'Buffalo Bills', confidence_points: 2, submitted_by: 'admin_override' },
      ]);

      const { data: auditRows } = await supabase
        .from('audit_logs')
        .select('action, admin_id, entity_id')
        .eq('entity', 'pool')
        .eq('entity_id', poolId)
        .eq('action', 'override_week_picks');
      expect(auditRows?.length).toBeGreaterThan(0);
      expect(auditRows?.[0].admin_id).toBe(ownerId);

      // ── Re-submitting updates in place (upsert), doesn't duplicate rows ──
      const updateRes = await request.post('/api/admin/override-picks', {
        headers: sessionCookieFor(ownerId!),
        data: {
          ...basePayload,
          weekPicks: [
            { gameId: gameOneId, predictedWinner: 'Dallas Cowboys', confidencePoints: 1 },
            { gameId: gameTwoId, predictedWinner: 'Buffalo Bills', confidencePoints: 2 },
          ],
        },
      });
      expect(updateRes.ok()).toBe(true);

      const { data: afterUpdate } = await supabase
        .from('picks')
        .select('game_id, predicted_winner, confidence_points')
        .eq('pool_id', poolId)
        .eq('participant_id', participantId);
      expect(afterUpdate?.length).toBe(2);
      expect(afterUpdate?.find(p => p.game_id === gameOneId)?.predicted_winner).toBe('Dallas Cowboys');

      // ── clearGameIds deletes a pick back out ──
      const clearRes = await request.post('/api/admin/override-picks', {
        headers: sessionCookieFor(ownerId!),
        data: {
          ...basePayload,
          weekPicks: [],
          clearGameIds: [gameOneId],
        },
      });
      expect(clearRes.ok()).toBe(true);

      const { data: afterClear } = await supabase
        .from('picks')
        .select('game_id')
        .eq('pool_id', poolId)
        .eq('participant_id', participantId);
      expect(afterClear).toEqual([{ game_id: gameTwoId }]);
    } finally {
      if (poolId) await supabase.from('picks').delete().eq('pool_id', poolId);
      if (poolId) await supabase.from('audit_logs').delete().eq('entity', 'pool').eq('entity_id', poolId);
      if (gameIds.length) await supabase.from('games').delete().in('id', gameIds);
      if (poolId) await supabase.from('participants').delete().eq('pool_id', poolId);
      if (poolId) await supabase.from('pools').delete().eq('id', poolId);
      await supabase.from('huddles').delete().eq('commissioner_email', ownerEmail);
      if (ownerId) await supabase.from('commissioners').delete().eq('id', ownerId);
      if (otherId) await supabase.from('commissioners').delete().eq('id', otherId);
    }
  });
});
