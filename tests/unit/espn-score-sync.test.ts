// ESPN scoreboard date fetching and missed-game catch-up: the shared helpers
// behind supabase/functions/update-game-scores and the admin NFL sync
// (src/lib/espn-scoreboard.ts).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_SCOREBOARD_DAYS,
  fetchScoreboardEvents,
  gameUpdateFromEvent,
  planGameUpdates,
  scoreboardDates,
} from '../../supabase/functions/_shared/espn-score-sync';
import { fetchEspnEventsAcrossDays } from '../../src/lib/espn-scoreboard';

const NOW = Date.parse('2026-11-10T15:00:00Z'); // a Tuesday

function event(id: string, state: 'pre' | 'in' | 'post', home: number | string | null, away: number | string | null) {
  return {
    id,
    competitions: [{
      status: { type: { state } },
      competitors: [
        { homeAway: 'home', score: home == null ? undefined : String(home) },
        { homeAway: 'away', score: away == null ? undefined : String(away) },
      ],
    }],
  };
}

function fakeFetch(byDate: Record<string, unknown[]>, failDates: string[] = []) {
  const urls: string[] = [];
  const fn = async (url: string) => {
    urls.push(url);
    const date = new URL(url).searchParams.get('dates')!;
    if (failDates.includes(date)) return { ok: false, status: 400, statusText: 'Bad Request', json: async () => ({}) };
    return { ok: true, status: 200, statusText: 'OK', json: async () => ({ events: byDate[date] ?? [] }) };
  };
  return { fn, urls };
}

test('scoreboard dates include today and the Eastern date of a late UTC kickoff', () => {
  // Sunday Night Football, 8:20pm ET Nov 8 = 01:20 UTC Nov 9.
  const dates = scoreboardDates([{ kickoff_time: '2026-11-09T01:20:00Z' }], NOW);
  assert.ok(dates.includes('20261108'), 'ESPN files it under Nov 8');
  assert.ok(dates.includes('20261109'));
  assert.ok(dates.includes('20261110'), 'today');
  assert.deepEqual(dates, [...dates].sort(), 'chronological');
});

test('a game missed on its day is still fetched on a later run', () => {
  // Kicked off a week ago and never got a final score.
  const dates = scoreboardDates([{ kickoff_time: '2026-11-02T18:00:00Z' }], NOW);
  assert.ok(dates.includes('20261102'));
});

test('future games and bad kickoff times add no dates', () => {
  assert.deepEqual(scoreboardDates([{ kickoff_time: '2026-11-15T18:00:00Z' }, { kickoff_time: null }, { kickoff_time: 'nope' }], NOW), ['20261110']);
});

test('dates are capped to the most recent days', () => {
  const stale = Array.from({ length: 30 }, (_, i) => ({ kickoff_time: new Date(NOW - (i + 1) * 3 * 86_400_000).toISOString() }));
  const dates = scoreboardDates(stale, NOW);
  assert.equal(dates.length, MAX_SCOREBOARD_DAYS);
  assert.equal(dates[dates.length - 1], '20261110', 'keeps the newest');
});

test('fetches one single-day request per date (never a date range) and merges events by id', async () => {
  const { fn, urls } = fakeFetch({
    '20261108': [event('401', 'post', 24, 21)],
    '20261109': [event('401', 'post', 24, 21), event('402', 'post', 10, 13)],
  });
  const events = await fetchScoreboardEvents(['20261108', '20261109'], fn);
  assert.deepEqual(events.map(e => e.id).sort(), ['401', '402']);
  assert.equal(urls.length, 2);
  for (const u of urls) assert.match(new URL(u).searchParams.get('dates')!, /^\d{8}$/);
});

test('any failed day fails the whole fetch', async () => {
  const { fn } = fakeFetch({ '20261108': [event('401', 'post', 1, 0)] }, ['20261109']);
  await assert.rejects(fetchScoreboardEvents(['20261108', '20261109'], fn), /20261109: 400/);
});

test('catch-up: events update only the open games they belong to', () => {
  const open = [
    { id: '401', home_team: 'Kansas City Chiefs', away_team: 'Denver Broncos' },
    { id: '402', home_team: 'Buffalo Bills', away_team: 'Miami Dolphins' },
  ];
  const updates = planGameUpdates(open, [event('401', 'post', 24, 21), event('999', 'post', 3, 0), event('402', 'in', 7, 0)]);
  assert.deepEqual(updates, [
    { id: '401', update: { status: 'finished', home_score: 24, away_score: 21, winner: 'Kansas City Chiefs' } },
    { id: '402', update: { status: 'live', home_score: 7, away_score: 0, winner: null } },
  ]);
});

test('event mapping: away win, tie, 0-score, and pre-game', () => {
  const g = { home_team: 'H', away_team: 'A' };
  assert.equal(gameUpdateFromEvent(event('1', 'post', 10, 17), g).winner, 'A');
  assert.deepEqual(gameUpdateFromEvent(event('1', 'post', 20, 20), g), { status: 'finished', home_score: 20, away_score: 20, winner: null });
  assert.deepEqual(gameUpdateFromEvent(event('1', 'post', 0, 3), g), { status: 'finished', home_score: 0, away_score: 3, winner: 'A' });
  assert.deepEqual(gameUpdateFromEvent(event('1', 'pre', null, null), g), { status: 'scheduled', home_score: null, away_score: null, winner: null });
});

test('admin sync range fetch expands to one request per day and merges by id', async () => {
  const requested: string[] = [];
  const events = await fetchEspnEventsAcrossDays('20261229', '20270102', async ymd => {
    requested.push(ymd);
    return [{ id: ymd === '20261231' ? 'dup' : `e${ymd}` }, { id: 'dup' }];
  }, 2);
  assert.deepEqual(requested.sort(), ['20261229', '20261230', '20261231', '20270101', '20270102'], 'crosses the year boundary');
  assert.equal(events.filter(e => e.id === 'dup').length, 1);
  assert.equal(events.length, 5);
});

test('admin sync range fetch fails the whole range if any day fails', async () => {
  await assert.rejects(fetchEspnEventsAcrossDays('20261101', '20261103', async ymd => {
    if (ymd === '20261102') throw new Error('ESPN responded 400 for 20261102');
    return [];
  }), /20261102/);
});
