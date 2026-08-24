import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { requireSuperAdmin } from '@/lib/accounts';
import { nflAPI } from '@/lib/nfl-api';
import { seasonTypeWideRange, mapEspnEventsToGames, type ESPNScoreboardEvent } from '@/lib/espn-scoreboard';
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
  /** The earliest real kickoff date among this gap's own missing/extra
   * games ('YYYY-MM-DD') — feeds straight into the existing preview flow
   * so a found gap can be reviewed immediately. Deliberately NOT derived
   * from weekDateRange(season, seasonType, week): that function has a
   * known per-week off-by-one against ESPN's own week numbering (see its
   * header comment in espn-scoreboard.ts), which previously produced a
   * representativeDate that didn't actually contain the gap's games —
   * e.g. reporting Sep 3 for a week whose only missing game kicks off
   * Aug 29. Every game bucketed into this gap already carries its own
   * real kickoff, so use that directly instead of re-deriving a range. */
  representativeDate: string;
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
    // Raw ESPN events the browser already fetched, keyed by season_type —
    // same escape hatch as /api/admin/nfl-sync/preview's espnEvents (see
    // that route's header comment): ESPN's CDN blocks Vercel's server IPs,
    // so scanning a whole season server-side can silently under-report
    // "missing" games it just failed to fetch, not games that are actually
    // missing. When a season_type's events are present here, this skips
    // this route's own ESPN fetch for it entirely and trusts what the
    // browser already retrieved instead.
    const clientEspnEventsByType: Record<string, ESPNScoreboardEvent[]> =
      body.espnEventsBySeasonType && typeof body.espnEventsBySeasonType === 'object' ? body.espnEventsBySeasonType : {};

    if (!season || Number.isNaN(season)) {
      return NextResponse.json({ success: false, error: 'season is required' }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();
    const { data: existingGames, error: dbError } = await supabase
      .from('games')
      .select('id, week, season_type, home_team, away_team, kickoff_time')
      .eq('season', season);
    if (dbError) throw new Error(dbError.message);

    const dbByWeek = new Map<string, { id: string; home_team: string; away_team: string; kickoff_time: string | null }[]>();
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

      const clientEvents = clientEspnEventsByType[String(opt.value)];
      // One wide query per season_type (up to ~272 games for an 18-week
      // regular season) rather than one call per week — fewer ESPN round
      // trips, and sidesteps weekDateRange()'s per-week off-by-one entirely
      // by trusting each returned game's own week/season_type. limit=400
      // comfortably covers every season_type; see getWeekGames() for why
      // it's needed at all.
      let espnGames: Awaited<ReturnType<typeof nflAPI.getWeekGames>>;
      if (Array.isArray(clientEvents)) {
        espnGames = mapEspnEventsToGames(clientEvents);
      } else {
        const { start, end } = seasonTypeWideRange(season, opt.value, opt.weeks);
        espnGames = await nflAPI.getWeekGames(start, end, 400);
      }
      espnGames = espnGames.filter(g => g.season === season && g.season_type === opt.value);

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
          .map(g => ({ id: g.id, homeTeam: g.home_team, awayTeam: g.away_team, kickoff: g.kickoff_time ?? undefined }));

        if (missingGames.length > 0 || extraInDb.length > 0) {
          // Earliest real kickoff among this gap's own games — see
          // WeekGapReport.representativeDate's comment for why this is
          // used instead of weekDateRange(season, seasonType, week).
          const kickoffs = [...missingGames, ...extraInDb]
            .map(g => g.kickoff)
            .filter((k): k is string => !!k)
            .map(k => new Date(k).getTime())
            .filter(t => !Number.isNaN(t));
          const earliest = kickoffs.length > 0 ? new Date(Math.min(...kickoffs)) : null;
          const representativeDate = earliest
            ? `${earliest.getUTCFullYear()}-${String(earliest.getUTCMonth() + 1).padStart(2, '0')}-${String(earliest.getUTCDate()).padStart(2, '0')}`
            : (() => { const { start } = nflAPI.weekDateRange(season, opt.value, week); return `${start.slice(0, 4)}-${start.slice(4, 6)}-${start.slice(6, 8)}`; })();
          gaps.push({
            seasonType: opt.value, week,
            espnCount: weekEspnGames.length, dbCount: dbGames.length,
            missingGames, extraInDb,
            representativeDate,
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
