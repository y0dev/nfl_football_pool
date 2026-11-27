import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

// ─────────────────────────────────────────────────────────────
// Playoff confidence points (src/app/pool/[id]/playoffs/page.tsx,
// src/app/api/playoffs/[poolId]/confidence-points/route.ts).
//
// Each participant ranks every playoff team once (1..N, no repeats) before
// the playoffs; a complete submission can't be changed. Participants have no
// accounts — whoever opens the page picks a name, like the picks page.
//
// Seeds a real pool with two participants and three playoff teams in a
// far-future fake season (playoff teams are shared by every pool in a
// season, so a fake one keeps real seasons untouched), and removes it all.
// ─────────────────────────────────────────────────────────────

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY!);

const TEAMS = [
  { team_name: 'E2E Hawks', team_abbreviation: 'EHK', conference: 'AFC', seed: 1 },
  { team_name: 'E2E Owls', team_abbreviation: 'EOW', conference: 'AFC', seed: 2 },
  { team_name: 'E2E Rams', team_abbreviation: 'ERM', conference: 'NFC', seed: 1 },
];

interface Fixture { poolId: string; poolName: string; season: number; alice: string; bob: string }

async function seed(): Promise<Fixture> {
  const season = 2900 + Math.floor(Math.random() * 99);
  const poolName = `E2E Playoff Points ${Date.now()}`;
  const { data: pool, error: poolError } = await supabase
    .from('pools')
    .insert({ name: poolName, created_by: `e2e-playoffs-${Date.now()}@sundayhuddle.test`, season, season_scope: [2, 3], competition_type: 'NFL_CONFIDENCE', is_active: true })
    .select('id')
    .single();
  if (poolError || !pool) throw new Error(`Failed to seed pool: ${poolError?.message}`);
  const { data: people, error: peopleError } = await supabase
    .from('participants')
    .insert([{ pool_id: pool.id, name: 'Alice', is_active: true }, { pool_id: pool.id, name: 'Bob', is_active: true }])
    .select('id, name');
  if (peopleError || !people) throw new Error(`Failed to seed participants: ${peopleError?.message}`);
  const { error: teamsError } = await supabase.from('playoff_teams').insert(TEAMS.map(t => ({ ...t, season })));
  if (teamsError) throw new Error(`Failed to seed playoff teams: ${teamsError.message}`);
  const id = (name: string) => people.find(p => p.name === name)!.id;
  return { poolId: pool.id, poolName, season, alice: id('Alice'), bob: id('Bob') };
}

async function cleanup(f: Fixture | undefined) {
  if (!f) return;
  await supabase.from('playoff_confidence_points').delete().eq('pool_id', f.poolId);
  await supabase.from('playoff_teams').delete().eq('season', f.season);
  await supabase.from('participants').delete().eq('pool_id', f.poolId);
  await supabase.from('pools').delete().eq('id', f.poolId);
}

const ranking = (participantId: string, points: number[]) =>
  TEAMS.map((t, i) => ({ participant_id: participantId, team_name: t.team_name, confidence_points: points[i] }));

test.describe('Playoff confidence points', () => {
  let f: Fixture | undefined;
  test.beforeEach(async () => { f = await seed(); });
  test.afterEach(async () => { await cleanup(f); f = undefined; });

  test('the page shows the pool, its participants and every playoff team', async ({ page }) => {
    await page.goto(`/pool/${f!.poolId}/playoffs`);
    await expect(page.getByRole('heading', { name: new RegExp(`${f!.poolName}.*Playoff Confidence Points`, 'i') })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Submit Playoff Confidence Points')).toBeVisible();
    await expect(page.locator('select#participant option')).toHaveText(['Select a participant…', 'Alice', 'Bob']);

    await page.locator('select#participant').selectOption({ label: 'Alice' });
    for (const team of TEAMS) await expect(page.getByText(team.team_name).first()).toBeVisible();
  });

  test('submitting without ranking every team is refused on the page', async ({ page }) => {
    await page.goto(`/pool/${f!.poolId}/playoffs`);
    await page.locator('select#participant').selectOption({ label: 'Alice' }, { timeout: 20000 });
    await page.getByRole('button', { name: 'Submit Confidence Points' }).click();
    await expect(page.getByText('Please assign confidence points to all teams').first()).toBeVisible();

    const { data: saved } = await supabase.from('playoff_confidence_points').select('team_name').eq('pool_id', f!.poolId);
    expect(saved).toEqual([]);
  });

  test('a complete ranking is saved, and a second submission is refused', async ({ request }) => {
    const submit = (points: number[]) => request.post(`/api/playoffs/${f!.poolId}/confidence-points`, {
      data: { participant_id: f!.alice, season: f!.season, confidence_points: ranking(f!.alice, points) },
    });

    const first = await submit([3, 1, 2]);
    expect(first.ok(), await first.text()).toBe(true);
    const { data: saved } = await supabase
      .from('playoff_confidence_points').select('team_name, confidence_points').eq('participant_id', f!.alice).order('team_name');
    expect(saved).toEqual([
      { team_name: 'E2E Hawks', confidence_points: 3 },
      { team_name: 'E2E Owls', confidence_points: 1 },
      { team_name: 'E2E Rams', confidence_points: 2 },
    ]);

    const again = await submit([1, 2, 3]);
    expect(again.status()).toBe(400);
    expect((await again.json()).error).toMatch(/already submitted/i);
  });

  test('a ranking that repeats a number or skips a team is refused', async ({ request }) => {
    const submit = (confidence_points: ReturnType<typeof ranking>) => request.post(`/api/playoffs/${f!.poolId}/confidence-points`, {
      data: { participant_id: f!.bob, season: f!.season, confidence_points },
    });

    const repeated = await submit(ranking(f!.bob, [1, 1, 2]));
    expect(repeated.status()).toBe(400);
    expect((await repeated.json()).error).toMatch(/unique/i);

    const missingTeam = await submit(ranking(f!.bob, [1, 2, 3]).slice(0, 2));
    expect(missingTeam.status()).toBe(400);
    expect((await missingTeam.json()).error).toMatch(/all playoff teams/i);

    const { data: saved } = await supabase.from('playoff_confidence_points').select('team_name').eq('participant_id', f!.bob);
    expect(saved).toEqual([]);
  });

  test('a participant from another pool cannot submit here', async ({ request }) => {
    const res = await request.post(`/api/playoffs/${f!.poolId}/confidence-points`, {
      data: { participant_id: '00000000-0000-0000-0000-000000000000', season: f!.season, confidence_points: ranking('00000000-0000-0000-0000-000000000000', [1, 2, 3]) },
    });
    expect(res.status()).toBe(404);
  });
});
