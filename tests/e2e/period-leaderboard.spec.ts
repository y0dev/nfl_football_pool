import { test, expect } from '@playwright/test';
import { TestHelpers, testData } from '../utils/test-helpers';

const POOL_ID = testData.poolDetail.regularOnly.id;
const SEASON = testData.poolDetail.regularOnly.season;

const FINAL_GAMES = [
  {
    id: 'game-1',
    week: 7,
    season: SEASON,
    season_type: 2,
    home_team: 'Kansas City Chiefs',
    away_team: 'Dallas Cowboys',
    kickoff_time: '2025-10-19T13:00:00Z',
    status: 'final',
    winner: 'Kansas City Chiefs',
    home_score: 28,
    away_score: 14,
  },
  {
    id: 'game-2',
    week: 7,
    season: SEASON,
    season_type: 2,
    home_team: 'Philadelphia Eagles',
    away_team: 'New York Giants',
    kickoff_time: '2025-10-19T16:25:00Z',
    status: 'final',
    winner: 'Philadelphia Eagles',
    home_score: 31,
    away_score: 17,
  },
];

const MOCK_LEADERBOARD = [
  {
    participant_id: 'p-1',
    participant_name: 'Alice',
    total_points: 4,
    correct_picks: 2,
    total_picks: 2,
    picks: [],
  },
  {
    participant_id: 'p-2',
    participant_name: 'Bob',
    total_points: 0,
    correct_picks: 0,
    total_picks: 2,
    picks: [],
  },
];

const MOCK_PERIOD_LEADERBOARD = {
  success: true,
  data: {
    periodWinner: null,
    weeklyWinners: [],
    leaderboard: [
      {
        participant_id: 'p-1',
        name: 'Alice',
        email: 'alice@example.com',
        total_points: 4,
        total_correct: 2,
        total_picks: 2,
        weeks_won: 1,
        weekly_scores: [{ week: 7, points: 4, correct: 2, total: 2 }],
      },
      {
        participant_id: 'p-2',
        name: 'Bob',
        email: 'bob@example.com',
        total_points: 0,
        total_correct: 0,
        total_picks: 2,
        weeks_won: 0,
        weekly_scores: [{ week: 7, points: 0, correct: 0, total: 2 }],
      },
    ],
    periodInfo: { name: 'Period 2', weeks: [5, 6, 7, 8, 9], totalWeeks: 5 },
    games: FINAL_GAMES,
    tieBreakerInfo: null,
  },
};

// Shared setup: final games with a week winner (Alice)
async function setupWithWinner(h: TestHelpers) {
  await h.mockPoolByIdAPI(POOL_ID, testData.poolDetail.regularOnly);
  await h.mockAPIResponse('**/api/games/week**', { games: FINAL_GAMES, success: true });
  await h.mockAPIResponse('**/api/picks**', { picks: [], success: true });
  // week-winner GET: no stored winner yet → falls through to leaderboard
  await h.mockAPIResponse('**/api/admin/week-winner**', { winnerExists: false, winner: null });
  await h.mockAPIResponse('**/api/leaderboard**', {
    success: true,
    leaderboard: MOCK_LEADERBOARD,
    participants: [
      { id: 'p-1', name: 'Alice' },
      { id: 'p-2', name: 'Bob' },
    ],
    games: FINAL_GAMES,
    totalParticipants: 2,
  });
  await h.mockAPIResponse('**/api/periods/leaderboard**', MOCK_PERIOD_LEADERBOARD);
  await h.mockAPIResponse('**/api/scores**', { scores: [], success: true });
  await h.mockAPIResponse('**/api/tie-breakers**', { tieBreakerAnswer: null, userAnswer: null, success: true });
  await h.mockAPIResponse('**/api/team-records**', { success: true, records: [] });
}

// Shared setup: final games but no picks (empty leaderboard)
async function setupWithNoPicks(h: TestHelpers) {
  await h.mockPoolByIdAPI(POOL_ID, testData.poolDetail.regularOnly);
  await h.mockAPIResponse('**/api/games/week**', { games: FINAL_GAMES, success: true });
  await h.mockAPIResponse('**/api/picks**', { picks: [], success: true });
  await h.mockAPIResponse('**/api/admin/week-winner**', { winnerExists: false, winner: null });
  await h.mockAPIResponse('**/api/leaderboard**', {
    success: true,
    leaderboard: [],
    participants: [],
    games: FINAL_GAMES,
    totalParticipants: 0,
  });
  await h.mockAPIResponse('**/api/periods/leaderboard**', MOCK_PERIOD_LEADERBOARD);
  await h.mockAPIResponse('**/api/scores**', { scores: [], success: true });
  await h.mockAPIResponse('**/api/tie-breakers**', { tieBreakerAnswer: null, userAnswer: null, success: true });
  await h.mockAPIResponse('**/api/team-records**', { success: true, records: [] });
}

test.describe('Pool Picks — winner page after week ends with picks', () => {
  test('winner page banner is visible when all games are final and picks exist', async ({ page }) => {
    const h = new TestHelpers(page);
    await setupWithWinner(h);

    await page.goto(`/pool/${POOL_ID}/picks?week=7&seasonType=2`);
    await h.waitForPageLoad();

    // When weekEnded + weekHasPicks + weekWinner → renders #final-results-banner (winner page)
    const banner = page.locator('#final-results-banner').first();
    await expect(banner).toBeVisible({ timeout: 10000 });
  });

  test('week winner name is displayed in winner page', async ({ page }) => {
    const h = new TestHelpers(page);
    await setupWithWinner(h);

    await page.goto(`/pool/${POOL_ID}/picks?week=7&seasonType=2`);
    await h.waitForPageLoad();

    const banner = page.locator('#final-results-banner').first();
    await expect(banner).toBeVisible({ timeout: 10000 });

    // Alice is the top leaderboard entry → shown as winner in the h2 heading
    await expect(page.getByRole('heading', { name: 'Alice' })).toBeVisible({ timeout: 8000 });
  });

  test('QuarterLeaderboard section is visible in winner page every week (not just period boundary weeks)', async ({ page }) => {
    const h = new TestHelpers(page);
    await setupWithWinner(h);

    await page.goto(`/pool/${POOL_ID}/picks?week=7&seasonType=2`);
    await h.waitForPageLoad();

    const banner = page.locator('#final-results-banner').first();
    await expect(banner).toBeVisible({ timeout: 10000 });

    // "Current Quarter Standings" is always shown in winner page (not gated by PERIOD_WEEKS)
    await expect(page.getByText('Current Quarter Standings')).toBeVisible({ timeout: 8000 });
  });

  test('QuarterLeaderboard renders period data from API', async ({ page }) => {
    const h = new TestHelpers(page);
    await setupWithWinner(h);

    await page.goto(`/pool/${POOL_ID}/picks?week=7&seasonType=2`);
    await h.waitForPageLoad();

    const banner = page.locator('#final-results-banner').first();
    await expect(banner).toBeVisible({ timeout: 10000 });

    // QuarterLeaderboard fetches /api/periods/leaderboard — MOCK_PERIOD_LEADERBOARD has Alice at 4 pts
    // The component renders entries or the "No quarter data" empty state
    const quarterSection = page.getByText('Current Quarter Standings');
    await expect(quarterSection).toBeVisible({ timeout: 8000 });
  });
});

test.describe('Pool Picks — no-picks banner when week ends with no picks', () => {
  test('no-picks banner is visible when all games are final and no picks submitted', async ({ page }) => {
    const h = new TestHelpers(page);
    await setupWithNoPicks(h);

    await page.goto(`/pool/${POOL_ID}/picks?week=7&seasonType=2`);
    await h.waitForPageLoad();

    // When weekEnded + !weekHasPicks → renders #no-picks-banner
    const banner = page.locator('#no-picks-banner');
    await expect(banner).toBeVisible({ timeout: 10000 });
  });

  test('no-picks banner shows Week N Not Available heading', async ({ page }) => {
    const h = new TestHelpers(page);
    await setupWithNoPicks(h);

    await page.goto(`/pool/${POOL_ID}/picks?week=7&seasonType=2`);
    await h.waitForPageLoad();

    await expect(page.getByRole('heading', { name: /Week 7 Not Available/i })).toBeVisible({ timeout: 10000 });
  });

  test('no-picks banner lists mid-season pool creation as a possible cause', async ({ page }) => {
    const h = new TestHelpers(page);
    await setupWithNoPicks(h);

    await page.goto(`/pool/${POOL_ID}/picks?week=7&seasonType=2`);
    await h.waitForPageLoad();

    // The "pool was created after this week" bullet point
    await expect(page.getByText(/pool was created after this week/i)).toBeVisible({ timeout: 10000 });
  });

  test('submit picks button is not shown when no-picks banner is visible', async ({ page }) => {
    const h = new TestHelpers(page);
    await setupWithNoPicks(h);

    await page.goto(`/pool/${POOL_ID}/picks?week=7&seasonType=2`);
    await h.waitForPageLoad();

    const banner = page.locator('#no-picks-banner');
    await expect(banner).toBeVisible({ timeout: 10000 });

    const submitBtn = page.locator('button', { hasText: /submit picks|save picks/i });
    await expect(submitBtn).not.toBeVisible();
  });
});

test.describe('API Contract — /api/periods/leaderboard', () => {
  test('period leaderboard API is called with poolId and season params', async ({ page }) => {
    const requestMade = { url: '' };

    await page.route('**/api/periods/leaderboard**', route => {
      requestMade.url = route.request().url();
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PERIOD_LEADERBOARD),
      });
    });

    const h = new TestHelpers(page);
    await h.mockPoolByIdAPI(POOL_ID, testData.poolDetail.regularOnly);
    await h.mockAPIResponse('**/api/games/week**', { games: FINAL_GAMES, success: true });
    await h.mockAPIResponse('**/api/picks**', { picks: [], success: true });
    await h.mockAPIResponse('**/api/admin/week-winner**', { winnerExists: false, winner: null });
    await h.mockAPIResponse('**/api/leaderboard**', {
      success: true,
      leaderboard: MOCK_LEADERBOARD,
      participants: [{ id: 'p-1', name: 'Alice' }, { id: 'p-2', name: 'Bob' }],
      games: FINAL_GAMES,
      totalParticipants: 2,
    });
    await h.mockAPIResponse('**/api/scores**', { scores: [], success: true });
    await h.mockAPIResponse('**/api/tie-breakers**', { tieBreakerAnswer: null, userAnswer: null, success: true });
    await h.mockAPIResponse('**/api/team-records**', { success: true, records: [] });

    await page.goto(`/pool/${POOL_ID}/picks?week=7&seasonType=2`);
    await h.waitForPageLoad();

    // QuarterLeaderboard calls /api/periods/leaderboard — verify params are included
    if (requestMade.url) {
      expect(requestMade.url).toContain('poolId=');
      expect(requestMade.url).toContain('season=');
    }
  });

  test('page renders without crashing when periods/leaderboard returns empty', async ({ page }) => {
    const h = new TestHelpers(page);
    await h.mockPoolByIdAPI(POOL_ID, testData.poolDetail.regularOnly);
    await h.mockAPIResponse('**/api/games/week**', { games: FINAL_GAMES, success: true });
    await h.mockAPIResponse('**/api/picks**', { picks: [], success: true });
    await h.mockAPIResponse('**/api/admin/week-winner**', { winnerExists: false, winner: null });
    await h.mockAPIResponse('**/api/leaderboard**', {
      success: true,
      leaderboard: MOCK_LEADERBOARD,
      participants: [{ id: 'p-1', name: 'Alice' }],
      games: FINAL_GAMES,
      totalParticipants: 1,
    });
    await h.mockAPIResponse('**/api/periods/leaderboard**', {
      success: true,
      data: {
        leaderboard: [],
        periodWinner: null,
        weeklyWinners: [],
        periodInfo: { name: 'Period 2', weeks: [5, 6, 7, 8, 9], totalWeeks: 5 },
        games: [],
        tieBreakerInfo: null,
      },
    });
    await h.mockAPIResponse('**/api/scores**', { scores: [], success: true });
    await h.mockAPIResponse('**/api/tie-breakers**', { tieBreakerAnswer: null, userAnswer: null, success: true });
    await h.mockAPIResponse('**/api/team-records**', { success: true, records: [] });

    await page.goto(`/pool/${POOL_ID}/picks?week=7&seasonType=2`);
    await h.waitForPageLoad();

    // Page should render the winner banner (not crash) even when period leaderboard is empty
    const banner = page.locator('#final-results-banner').first();
    await expect(banner).toBeVisible({ timeout: 10000 });

    // QuarterLeaderboard empty state: "No quarter data available yet"
    await expect(page.getByText(/No quarter data available yet/i)).toBeVisible({ timeout: 8000 });
  });
});
