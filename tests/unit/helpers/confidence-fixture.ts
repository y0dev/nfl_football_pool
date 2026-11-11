// A complete 18-week regular season for one Confidence pool, built so the
// interesting rules all show up:
//
//   - Alice wins Q1, Q2 and Q3 by 1 point each (her 6-point weeks 1, 5, 10).
//   - Bob wins Q4 by 20 (weeks 15-18), so Bob has MORE TOTAL POINTS but
//     FEWER PERIODS. The champion rule (most periods) says Alice; the old
//     cron rule (most points) said Bob.
//   - Every other week Alice and Bob tie on 5 points: shared weekly wins.
//   - Week 2 they tie on 3 points with DIFFERENT correct-pick counts
//     (Alice 1, Bob 2).
//   - Cara scores 1 point a week and never wins.
//
// Each week has 3 games. Game i of week w: id `g-w-i`, home team `H{w}-{i}`
// wins. A pick is "correct" (home) or "wrong" (away), with its confidence.
import type { PGlite } from '@electric-sql/pglite';

export const SEASON = 2026;
export const WEEKS = 18;

type PickSpec = Array<[confidence: number, correct: boolean]>; // index = game 1..3

const DEFAULT_TOP: PickSpec = [[3, true], [2, true], [1, false]]; // 5 pts, 2 correct
const PERFECT: PickSpec = [[3, true], [2, true], [1, true]];      // 6 pts, 3 correct
const ONE_POINT: PickSpec = [[3, false], [2, false], [1, true]];  // 1 pt, 1 correct

function weekSpec(week: number): Record<'alice' | 'bob' | 'cara', PickSpec> {
  if (week === 1 || week === 5 || week === 10) return { alice: PERFECT, bob: DEFAULT_TOP, cara: ONE_POINT };
  if (week === 2) {
    return {
      alice: [[3, true], [2, false], [1, false]], // 3 pts, 1 correct
      bob: [[1, true], [2, true], [3, false]],    // 3 pts, 2 correct
      cara: ONE_POINT,
    };
  }
  if (week >= 15) return { alice: ONE_POINT, bob: PERFECT, cara: ONE_POINT };
  return { alice: DEFAULT_TOP, bob: DEFAULT_TOP, cara: ONE_POINT };
}

export const home = (week: number, game: number) => `H${week}-${game}`;
export const away = (week: number, game: number) => `A${week}-${game}`;
export const gameId = (week: number, game: number) => `g-${week}-${game}`;

export interface SeasonFixture {
  poolId: string;
  alice: string;
  bob: string;
  cara: string;
}

export async function seedSeason(db: PGlite, opts: { poolName?: string; finished?: boolean } = {}): Promise<SeasonFixture> {
  const finished = opts.finished ?? true;
  const { rows: [pool] } = await db.query<{ id: string }>(
    `INSERT INTO pools (name, season) VALUES ($1, $2) RETURNING id`, [opts.poolName ?? 'E2E Fixture Pool', SEASON]);
  const ids: Record<string, string> = {};
  for (const name of ['Alice', 'Bob', 'Cara']) {
    const { rows: [p] } = await db.query<{ id: string }>(
      `INSERT INTO participants (pool_id, name) VALUES ($1, $2) RETURNING id`, [pool.id, name]);
    ids[name.toLowerCase()] = p.id;
  }

  for (let week = 1; week <= WEEKS; week++) {
    for (let g = 1; g <= 3; g++) {
      await db.query(
        `INSERT INTO games (id, week, season, season_type, home_team, away_team, status, winner, kickoff_time)
         VALUES ($1, $2, $3, 2, $4, $5, $6, $7, $8)`,
        [gameId(week, g), week, SEASON, home(week, g), away(week, g),
          finished ? 'final' : 'scheduled', finished ? home(week, g) : null,
          new Date(Date.UTC(SEASON, 8, 10 + week * 7)).toISOString()]);
    }
    const spec = weekSpec(week);
    for (const who of ['alice', 'bob', 'cara'] as const) {
      for (const [i, [confidence, correct]] of spec[who].entries()) {
        const g = i + 1;
        await db.query(
          `INSERT INTO picks (participant_id, pool_id, game_id, predicted_winner, confidence_points) VALUES ($1, $2, $3, $4, $5)`,
          [ids[who], pool.id, gameId(week, g), correct ? home(week, g) : away(week, g), confidence]);
      }
    }
  }
  return { poolId: pool.id, alice: ids.alice, bob: ids.bob, cara: ids.cara };
}

/** Corrects week 10 game 3 to an away win. Alice (picked home) loses her
 * 1 point; Bob (picked away) gains it. Week 10 flips from Alice 6-5 to Bob
 * 6-5, which flips Q3 to Bob, which makes it 2 periods each, which hands the
 * season to Bob on weeks won (16 vs 13). */
export async function correctWeek10(db: PGlite) {
  await db.query(`UPDATE games SET winner = $1, updated_at = now() WHERE id = $2`, [away(10, 3), gameId(10, 3)]);
}
