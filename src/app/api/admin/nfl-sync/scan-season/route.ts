import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { requireSuperAdmin } from '@/lib/accounts';
import { nflAPI } from '@/lib/nfl-api';
import { SEASON_TYPE_OPTIONS, debugError } from '@/lib/utils';

// Scans an entire season against ESPN to find gaps — games ESPN has that
// never made it into `games` (e.g. added to the schedule after the last
// sync, or a sync that silently failed for one week) and, for symmetry,
// games we still have that ESPN no longer lists for that week
// (rescheduled/removed). Read-only: identifies gaps, writes nothing — a
// found week is meant to be fed into the existing preview/apply flow.
export const maxDuration = 60;

interface GapGameRef {
  id: string;
  homeTeam: string;
  awayTeam: string;
  kickoff?: string;
}

interface WeekGapReport {
  seasonType: number;
  week: number;
  espnCount: number;
  dbCount: number;
  missingGames: GapGameRef[];
  extraInDb: GapGameRef[];
  /** Any date within this week — feeds straight into the existing
   * single-week preview flow so a found gap can be reviewed immediately. */
  representativeDate: string;
}

const YMD_LEN = 8;

function toYMD(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function ymdToDate(ymd: string): Date {
  return new Date(parseInt(ymd.slice(0, 4)), parseInt(ymd.slice(4, 6)) - 1, parseInt(ymd.slice(6, YMD_LEN)));
}

/**
 * A single date range comfortably containing every game of a whole
 * season_type, padded well beyond weekDateRange()'s own week1..maxWeek
 * span. The padding isn't just safety margin — weekDateRange() has a known
 * off-by-one against ESPN's own week numbering for at least preseason
 * (requesting "week N" returns games ESPN itself labels "week N+1"), so a
 * tight bound risks clipping real games at either edge. This function only
 * uses week1.start/maxWeek.end as an outer bounding box, never for
 * per-week filtering, so that mislabeling doesn't matter here — only
 * ESPN's own per-game week/season_type (checked below) does.
 */
function seasonTypeWideRange(season: number, seasonType: number, maxWeek: number): { start: string; end: string } {
  const first = nflAPI.weekDateRange(season, seasonType, 1);
  const last = nflAPI.weekDateRange(season, seasonType, maxWeek);
  const padDays = 14;

  const start = ymdToDate(first.start);
  start.setDate(start.getDate() - padDays);
  const end = ymdToDate(last.end);
  end.setDate(end.getDate() + padDays);

  return { start: toYMD(start), end: toYMD(end) };
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const season = Number(body.season);
    const seasonTypes: number[] = Array.isArray(body.seasonTypes) && body.seasonTypes.length > 0
      ? body.seasonTypes
      : SEASON_TYPE_OPTIONS.map(o => o.value);

    if (!season || Number.isNaN(season)) {
      return NextResponse.json({ success: false, error: 'season is required' }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();
    const { data: existingGames, error: dbError } = await supabase
      .from('games')
      .select('id, week, season_type, home_team, away_team')
      .eq('season', season);
    if (dbError) throw new Error(dbError.message);

    const dbByWeek = new Map<string, { id: string; home_team: string; away_team: string }[]>();
    for (const g of existingGames ?? []) {
      const key = `${g.season_type}-${g.week}`;
      if (!dbByWeek.has(key)) dbByWeek.set(key, []);
      dbByWeek.get(key)!.push(g);
    }

    const gaps: WeekGapReport[] = [];
    let scannedWeeks = 0;
    let notYetScheduled = 0;

    for (const opt of SEASON_TYPE_OPTIONS) {
      if (!seasonTypes.includes(opt.value)) continue;

      const { start, end } = seasonTypeWideRange(season, opt.value, opt.weeks);
      // One wide query per season_type (up to ~272 games for an 18-week
      // regular season) rather than one call per week — fewer ESPN round
      // trips, and sidesteps weekDateRange()'s per-week off-by-one entirely
      // by trusting each returned game's own week/season_type. limit=400
      // comfortably covers every season_type; see getWeekGames() for why
      // it's needed at all.
      const espnGames = (await nflAPI.getWeekGames(start, end, 400))
        .filter(g => g.season === season && g.season_type === opt.value);

      const espnByWeek = new Map<number, typeof espnGames>();
      for (const g of espnGames) {
        if (!espnByWeek.has(g.week)) espnByWeek.set(g.week, []);
        espnByWeek.get(g.week)!.push(g);
      }

      for (let week = 1; week <= opt.weeks; week++) {
        scannedWeeks++;
        const weekEspnGames = espnByWeek.get(week) ?? [];
        const dbGames = dbByWeek.get(`${opt.value}-${week}`) ?? [];

        if (weekEspnGames.length === 0 && dbGames.length === 0) {
          notYetScheduled++;
          continue;
        }

        const dbIds = new Set(dbGames.map(g => g.id));
        const espnIds = new Set(weekEspnGames.map(g => g.id));

        const missingGames: GapGameRef[] = weekEspnGames
          .filter(g => !dbIds.has(g.id))
          .map(g => ({ id: g.id, homeTeam: g.home_team, awayTeam: g.away_team, kickoff: g.time }));
        const extraInDb: GapGameRef[] = dbGames
          .filter(g => !espnIds.has(g.id))
          .map(g => ({ id: g.id, homeTeam: g.home_team, awayTeam: g.away_team }));

        if (missingGames.length > 0 || extraInDb.length > 0) {
          const { start: weekStart } = nflAPI.weekDateRange(season, opt.value, week);
          gaps.push({
            seasonType: opt.value, week,
            espnCount: weekEspnGames.length, dbCount: dbGames.length,
            missingGames, extraInDb,
            representativeDate: `${weekStart.slice(0, 4)}-${weekStart.slice(4, 6)}-${weekStart.slice(6, YMD_LEN)}`,
          });
        }
      }
    }

    gaps.sort((a, b) => (a.seasonType - b.seasonType) || (a.week - b.week));

    return NextResponse.json({
      success: true,
      season,
      scannedWeeks,
      notYetScheduled,
      totalMissingGames: gaps.reduce((sum, g) => sum + g.missingGames.length, 0),
      totalExtraInDb: gaps.reduce((sum, g) => sum + g.extraInDb.length, 0),
      gaps,
    });
  } catch (error) {
    debugError('NFL sync scan-season error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unable to scan season for missing games.',
    }, { status: 500 });
  }
}
