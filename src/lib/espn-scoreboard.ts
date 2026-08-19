// Pure, browser-safe ESPN scoreboard helpers — no Node-only imports (no
// `dotenv`, no `fs`), unlike src/lib/nfl-api.ts. This lets the SAME date-range
// math and event-mapping logic run both server-side (nfl-api.ts delegates
// here) and client-side, where the admin's browser fetches ESPN directly.
//
// Why the browser fetches ESPN directly at all: ESPN's site API sits behind
// Akamai, which returns a hard 403 for requests from Vercel's IP ranges
// (confirmed 2026-08-18 — identical block on both Node and Edge runtimes,
// and unaffected by browser-mimicking headers, so it's IP/network-level,
// not header-based). The endpoint itself sends
// `Access-Control-Allow-Origin: *`, so a direct browser fetch from the
// admin's own IP is both unblocked and CORS-permitted. The admin's browser
// fetches raw ESPN JSON and posts it to our backend, which maps it with the
// exact same logic a server-side fetch would have used.
import type { NFLGame } from './nfl-api';

export const ESPN_SCOREBOARD_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';

export interface ESPNScoreboardEvent {
  id: string;
  date: string;
  season: { year: number; type: number };
  week?: { number: number };
  competitions: Array<{
    status: { type: { state: string } };
    competitors: Array<{
      homeAway: string;
      team: { displayName: string; abbreviation: string };
      score: string;
    }>;
  }>;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function toYMD(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function addDaysUTC(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000);
}

function firstMondayInSeptemberUTC(year: number): Date {
  const d = new Date(Date.UTC(year, 8, 1));
  const dow = d.getUTCDay();
  const delta = (1 - dow + 7) % 7;
  d.setUTCDate(1 + delta);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function kickoffThursdayUTC(seasonYear: number): Date {
  const laborDayMon = firstMondayInSeptemberUTC(seasonYear);
  const thurs = addDaysUTC(laborDayMon, 3);
  thurs.setUTCHours(0, 0, 0, 0);
  return thurs;
}

function offsetMinutesFromIso(ts: string): number {
  const m = String(ts).match(/([+-])(\d{2}):?(\d{2})$/);
  if (!m) return 0;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
}

/** Single source of truth for classifying a timestamp into season/week —
 * nfl-api.ts's private classify() delegates here rather than keeping its
 * own copy. */
export function classify(dateIsoStr: string): { year: number; season_type: number; week: number } {
  const d = new Date(dateIsoStr);
  const yUTC = d.getUTCFullYear();
  const mUTC = d.getUTCMonth();

  const seasonYear = (mUTC >= 8) ? yUTC : (mUTC <= 1 ? yUTC - 1 : yUTC);
  const week1UTC = kickoffThursdayUTC(seasonYear);
  const postStartUTC = addDaysUTC(week1UTC, 18 * 7);
  const preseasonEnd = new Date(Date.UTC(seasonYear, 7, 25, 23, 59, 59));

  const offMin = offsetMinutesFromIso(dateIsoStr);
  const localNow = d.getTime() + offMin * 60000;
  const localWeek1 = week1UTC.getTime() + offMin * 60000;
  const localPostStart = postStartUTC.getTime() + offMin * 60000;
  const localPreEnd = preseasonEnd.getTime() + offMin * 60000;

  let season_type, week;
  if (localNow <= localPreEnd) {
    season_type = 1;
    const nowYMD = parseInt(`${yUTC}${String(mUTC + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`, 10);
    week = 1;
    for (let w = 1; w <= 4; w++) {
      const range = weekDateRange(seasonYear, 1, w);
      if (nowYMD >= parseInt(range.start, 10) && nowYMD <= parseInt(range.end, 10)) { week = w; break; }
      if (nowYMD > parseInt(range.end, 10)) week = w;
    }
  } else if (localNow < localPostStart) {
    season_type = 2;
    week = Math.floor((localNow - localWeek1) / WEEK_MS) + 1;
  } else {
    season_type = 3;
    week = Math.floor((localNow - localPostStart) / WEEK_MS) + 1;
  }
  if (week < 1) week = 1;
  return { year: seasonYear, season_type, week };
}

/** Same as nfl-api.ts's weekDateRange() — see that file for the full
 * rationale comment. Kept here as the single source of truth; nfl-api.ts
 * delegates to this. */
export function weekDateRange(year: number, seasonType: number, week: number): { start: string; end: string } {
  const sep1 = new Date(Date.UTC(year, 8, 1));
  const dow = sep1.getUTCDay();
  const toNextMonday = dow === 1 ? 0 : dow === 0 ? 1 : 8 - dow;
  const laborDay = new Date(Date.UTC(year, 8, 1 + toNextMonday));
  const kickoff = addDaysUTC(laborDay, 3);

  if (seasonType === 1) {
    const thu = addDaysUTC(kickoff, -(5 - week) * 7);
    return { start: toYMD(thu), end: toYMD(addDaysUTC(thu, 4)) };
  }
  if (seasonType === 2) {
    const thu = addDaysUTC(kickoff, (week - 1) * 7);
    return { start: toYMD(thu), end: toYMD(addDaysUTC(thu, 4)) };
  }
  const week18Sun = addDaysUTC(kickoff, 17 * 7 + 3);
  const startOffsets = [6, 13, 21, 35];
  const endOffsets = [8, 14, 21, 35];
  const s = week - 1;
  return {
    start: toYMD(addDaysUTC(week18Sun, startOffsets[s] ?? 35)),
    end: toYMD(addDaysUTC(week18Sun, endOffsets[s] ?? 35)),
  };
}

export interface WeekRangeResult {
  start: string;
  end: string;
  season: number;
  seasonType: number;
  week: number;
}

/** The full week (padded -2 days for the Tue/Wed gap, matching
 * getGamesForWeekContaining()'s fix) containing the given timestamp. */
export function getWeekRangeContaining(timestamp?: string): WeekRangeResult {
  const ts = timestamp || new Date().toISOString();
  const { year, season_type, week } = classify(ts);
  const { start, end } = weekDateRange(year, season_type, week);
  const paddedStartDate = addDaysUTC(new Date(`${start.slice(0, 4)}-${start.slice(4, 6)}-${start.slice(6, 8)}T00:00:00Z`), -2);
  return { start: toYMD(paddedStartDate), end, season: year, seasonType: season_type, week };
}

/** Just the single calendar day (YYYYMMDD) containing the given timestamp. */
export function getDayContaining(timestamp?: string): { date: string } {
  const ts = timestamp || new Date().toISOString();
  const d = new Date(ts);
  return { date: toYMD(d) };
}

export function buildScoreboardUrl(params: { dates: string; limit?: number }): string {
  const url = new URL(ESPN_SCOREBOARD_BASE_URL);
  url.searchParams.set('dates', params.dates);
  if (params.limit !== undefined) url.searchParams.set('limit', String(params.limit));
  return url.toString();
}

/** Same mapping nfl-api.ts's getWeekGames() applies to data.events — pulled
 * out so it can run against events fetched either server-side (unchanged
 * path) or client-side (the admin's browser, POSTed to the backend). */
export function mapEspnEventsToGames(events: ESPNScoreboardEvent[]): NFLGame[] {
  return events.map((game) => {
    const homeTeam = game.competitions[0]?.competitors.find(c => c.homeAway === 'home');
    const awayTeam = game.competitions[0]?.competitors.find(c => c.homeAway === 'away');
    if (!homeTeam || !awayTeam) return null;

    const state = game.competitions[0]?.status?.type?.state ?? 'pre';
    const status: NFLGame['status'] = state === 'post' ? 'finished' : state === 'in' ? 'live' : 'scheduled';

    return {
      id: game.id,
      date: game.date,
      time: game.date,
      home_team: homeTeam.team.displayName,
      away_team: awayTeam.team.displayName,
      home_score: homeTeam.score ? parseInt(homeTeam.score) : undefined,
      away_score: awayTeam.score ? parseInt(awayTeam.score) : undefined,
      status,
      week: game.week?.number ?? 0,
      season: game.season?.year ?? new Date().getFullYear(),
      season_type: game.season?.type ?? 2,
      home_team_id: homeTeam.team.abbreviation,
      away_team_id: awayTeam.team.abbreviation,
    } as NFLGame;
  }).filter(Boolean) as NFLGame[];
}
