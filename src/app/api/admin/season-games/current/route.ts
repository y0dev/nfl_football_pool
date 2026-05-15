import { NextRequest, NextResponse } from 'next/server';
import { nflAPI } from '@/lib/nfl-api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WeekWindow {
  week: number;
  label?: string;         // e.g. "Wild Card", "Divisional"
  wednesday: string | null; // Kickoff Wed (regular season starting in 2026) or null
  thursday: string | null;
  friday: string | null;
  saturday: string | null;
  sunday: string | null;
  monday: string | null;
  weekStart: string;      // ISO date of first game day
  weekEnd: string;        // ISO date of last game day
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

// First Monday of September = Labor Day
function getLaborDay(year: number): Date {
  const sep1 = new Date(Date.UTC(year, 8, 1));
  const dow = sep1.getUTCDay(); // 0=Sun, 1=Mon … 6=Sat
  const toNextMonday = dow === 1 ? 0 : dow === 0 ? 1 : 8 - dow;
  return new Date(Date.UTC(year, 8, 1 + toNextMonday));
}

// NFL Kickoff Thursday = Labor Day + 3 days
// e.g. 2024 → Sep 2 (Mon) + 3 = Sep 5 (Thu) ✓
//      2025 → Sep 1 (Mon) + 3 = Sep 4 (Thu) ✓
//      2026 → Sep 7 (Mon) + 3 = Sep 10 (Thu) ✓
function getKickoffThursday(year: number): Date {
  return addDays(getLaborDay(year), 3);
}

// NFL Kickoff Wednesday = Labor Day + 2 days
//      2026 → Sep 7 (Mon) + 2 = Sep 9 (Wed)
function getKickoffWednesday(year: number): Date {
  return addDays(getLaborDay(year), 2);
}

// ─── Schedule builders ────────────────────────────────────────────────────────

/**
 * Regular season: 18 weeks, Thu/Sun/Mon each week.
 * Saturday games appear in late-season weeks (≥ 14) when the schedule compresses.
 */
function buildRegularSeasonSchedule(year: number): WeekWindow[] {
  const kickoff = getKickoffWednesday(year);
  const firstThurs = getKickoffThursday(year);
  const schedule: WeekWindow[] = [];

  console.log(`Kickoff Wednesday for ${year}: ${isoDate(kickoff)}`);

  for (let week = 1; week <= 18; week++) {
    // Only week 1 will have a Wednesday game (the kickoff), but we calculate it for all weeks for consistency
    let wen;
    if (week === 1) {
      wen = kickoff; // Week 1 starts with the kickoff Wednesday
    } else {
      // Subsequent weeks start 7 days after the previous week's Wednesday
      wen = null; // Default to null for non-kickoff weeks
    }
    // Thu is always 7 days after the previous week's Thu, but for week 1 it is 3 days after the kickoff Wed
    const thu = addDays(wen ? wen : firstThurs, wen ? 1 : (week - 1) * 7); 
    const sat = addDays(thu, 2);
    const sun = addDays(thu, 3);
    const mon = addDays(thu, 4);
    const hasSaturday = week >= 14; // NFL typically adds Saturday games late season

    schedule.push({
      week,
      label: `Week ${week}`,
      wednesday: wen ? isoDate(wen) : null, // Kickoff Wed = day before first Thu
      thursday: isoDate(thu),
      friday: null,
      saturday: hasSaturday ? isoDate(sat) : null,
      sunday: isoDate(sun),
      monday: isoDate(mon),
      weekStart: isoDate(wen ? wen : thu), // Start with Wed if it's the kickoff week, otherwise Thu
      weekEnd: isoDate(addDays(wen ? wen : thu, wen ? 5 : 4)), // Tuesday (day after MNF)
    });
  }
  return schedule;
}

/**
 * Preseason: 4 weeks (Hall of Fame week is treated separately and not included here).
 * Game days are Thu / Sat / Sun — Friday games appear occasionally but are rare.
 * Preseason week 1 starts ~4 weeks before regular-season kickoff Thursday.
 */
function buildPreseasonSchedule(year: number): WeekWindow[] {
  const kickoff = getKickoffThursday(year);
  const schedule: WeekWindow[] = [];

  for (let week = 1; week <= 4; week++) {
    // Week 1 = 4 weeks before kickoff, week 4 = 1 week before kickoff

    // Week 1 is the week of the Hall of Fame Game (Thu) followed by a few days off, then a few more games the following week.
    if (week === 1) {
      const hofThu = addDays(kickoff, -(5 - week) * 7); // 4 weeks before kickoff

      schedule.push({
        week,
        label: 'Hall of Fame Week',
        wednesday: null,
        thursday: isoDate(hofThu),
        friday: null,
        saturday: null,
        sunday: null,
        monday: null,
        weekStart: isoDate(hofThu),
        weekEnd: isoDate(addDays(hofThu, 1)),
      });
      continue; // Skip to next iteration since we've already added the Hall of Fame week
    }

    const thu = addDays(kickoff, -(6 - week) * 7);
    const sat = addDays(thu, 2);
    const sun = addDays(thu, 3);

    schedule.push({
      week,
      label: `Preseason Week ${week - 1}`,
      wednesday: null,       // Preseason kickoff is typically Thu, not Wed
      thursday: isoDate(thu),
      friday: null,          // Rare; omitted for simplicity
      saturday: isoDate(sat),
      sunday: week === 3 ? isoDate(sun) : null, // Sunday games are uncommon in early preseason weeks, more common in week 3
      monday: null,          // Preseason MNF games are uncommon
      weekStart: isoDate(thu),
      weekEnd: isoDate(addDays(thu, week === 3 ? 3 : 2)), // Saturday or Sun
    });
  }
  return schedule;
}

/**
 * Postseason: 4 rounds.
 * Not schedulable until December of the season year — returns null before then.
 *
 * Round windows are anchored to the Sunday of Week 18:
 *   Wild Card weekend  → +6 / +7 / +8  (Sat, Sun, Mon)
 *   Divisional         → +13 / +14     (Sat, Sun)
 *   Championship       → +21           (Sun only)
 *   Super Bowl         → +35           (Sun, ~2 weeks after Championship)
 */
function buildPostseasonSchedule(year: number): WeekWindow[] | null {
  const decemberFirst = new Date(Date.UTC(year, 11, 1));
  if (new Date() < decemberFirst) return null;

  const kickoff = getKickoffThursday(year);
  // Week 18 Sunday = kickoff + 17 full weeks (119 days) + 3 days (Thu → Sun)
  const week18Sun = addDays(kickoff, 17 * 7 + 3);

  const wcSat  = addDays(week18Sun, 6);
  const wcSun  = addDays(week18Sun, 7);
  const wcMon  = addDays(week18Sun, 8);  // Some years have Monday wild-card games

  const divSat = addDays(wcSat, 7);
  const divSun = addDays(wcSun, 7);

  const champSun = addDays(divSun, 7);   // Conference Championships (always Sunday)

  const superBowlSun = addDays(champSun, 14); // Super Bowl ~2 weeks after Champ

  return [
    {
      week: 1,
      wednesday: null, // No Wednesday games in postseason
      label: 'Wild Card Weekend',
      thursday: null,
      friday: null,
      saturday: isoDate(wcSat),
      sunday: isoDate(wcSun),
      monday: isoDate(wcMon),
      weekStart: isoDate(wcSat),
      weekEnd: isoDate(wcMon),
    },
    {
      week: 2,
      label: 'Divisional Round',
      wednesday: null,
      thursday: null,
      friday: null,
      saturday: isoDate(divSat),
      sunday: isoDate(divSun),
      monday: null,
      weekStart: isoDate(divSat),
      weekEnd: isoDate(divSun),
    },
    {
      week: 3,
      label: 'Conference Championships',
      wednesday: null,
      thursday: null,
      friday: null,
      saturday: null,
      sunday: isoDate(champSun),
      monday: null,
      weekStart: isoDate(champSun),
      weekEnd: isoDate(champSun),
    },
    {
      week: 4,
      label: 'Super Bowl',
      wednesday: null,
      thursday: null,
      friday: null,
      saturday: null,
      sunday: isoDate(superBowlSun),
      monday: null,
      weekStart: isoDate(superBowlSun),
      weekEnd: isoDate(superBowlSun),
    },
  ];
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedSeasonType = searchParams.has('seasonType')
      ? parseInt(searchParams.get('seasonType')!)
      : null;

    // Fetch current scoreboard from ESPN (no params = active week)
    const data = await nflAPI.getScoreboard();
    
    // ── Season metadata ──────────────────────────────────────────────────────
    const leagueSeason = data.leagues?.[0]?.season;
    const season: number = leagueSeason?.year ?? new Date().getFullYear();

    const seasonStart = leagueSeason?.startDate ? new Date(leagueSeason.startDate) : null;
    const seasonEnd   = leagueSeason?.endDate   ? new Date(leagueSeason.endDate)   : null;
    const now         = new Date();

    // Determine season type: use query param if provided, otherwise infer from dates
    let seasonType: number;
    if (requestedSeasonType !== null && [1, 2, 3].includes(requestedSeasonType)) {
      seasonType = requestedSeasonType;
    } else if (seasonStart && now < seasonStart) {
      seasonType = 1; // Before season start = preseason
    } else if (seasonEnd && now > seasonEnd) {
      seasonType = 3; // After season end = postseason
    } else {
      seasonType = 2; // Active regular season
    }

    const week: number = data.week?.number ?? 1;

    // ── Parse current-week games from ESPN ──────────────────────────────────
    const events: any[] = data.events ?? [];
    let games = events.map((event: any) => {
      const comp = event.competitions?.[0];
      if (!comp) return null;

      const home = comp.competitors?.find((c: any) => c.homeAway === 'home');
      const away = comp.competitors?.find((c: any) => c.homeAway === 'away');
      if (!home || !away) return null;

      const state: string = comp.status?.type?.state ?? 'pre';
      const gameStatus = state === 'post' ? 'final' : state === 'in' ? 'live' : 'scheduled';
      const homeScore = home.score !== undefined && home.score !== '' ? Number(home.score) : null;
      const awayScore = away.score !== undefined && away.score !== '' ? Number(away.score) : null;

      // Determine game day (Thu/Fri/Sat/Sun/Mon) from event date
      const eventDate = new Date(event.date);
      const dayOfWeek = eventDate.getUTCDay(); // 0=Sun … 6=Sat
      const dayLabel = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][dayOfWeek];

      return {
        id: event.id,
        home_team: home.team.displayName,
        away_team: away.team.displayName,
        home_team_id: home.team.abbreviation,
        away_team_id: away.team.abbreviation,
        home_score: homeScore,
        away_score: awayScore,
        winner:
          gameStatus === 'final' && homeScore !== null && awayScore !== null
            ? homeScore > awayScore
              ? home.team.displayName
              : away.team.displayName
            : null,
        time: event.date,
        date: event.date,
        game_day: dayLabel,  // thu / sat / sun / mon
        week,
        season,
        season_type: seasonType,
        game_status: gameStatus,
      };
    }).filter(Boolean);

    // ── Build week schedule ──────────────────────────────────────────────────
    let weekSchedule: WeekWindow[] = [];
    let postseasonNotAvailable = false;
    let postseasonAvailableAfter: string | null = null;

    if (seasonType === 1) {
      weekSchedule = buildPreseasonSchedule(season);
      games = []
      const hallOfFameGame = weekSchedule.find(w => w.label === 'Hall of Fame Week');
      if (hallOfFameGame) {
        // Add a placeholder game for the Hall of Fame Game week since it won't appear in the ESPN scoreboard until it actually happens
        games.push({
          id: `${season}-HOF`,
          home_team: 'Hall of Fame Game',
          away_team: '',
          home_team_id: null,
          away_team_id: null,
          home_score: null,
          away_score: null,
          winner: null,
          time: hallOfFameGame.thursday ? `${hallOfFameGame.thursday}T20:00:00Z` : null, // Assume 4 PM ET kickoff if date is available
          date: hallOfFameGame.thursday ? `${hallOfFameGame.thursday}T20:00:00Z` : null,
          game_day: 'thu',
          week: hallOfFameGame.week,
          season,
          season_type: seasonType,
          game_status: 'scheduled',
        });
      }
    } else if (seasonType === 2) {
      weekSchedule = buildRegularSeasonSchedule(season);
    } else {
      const postSchedule = buildPostseasonSchedule(season);
      if (postSchedule === null) {
        postseasonNotAvailable = true;
        postseasonAvailableAfter = `December ${season}`;
        weekSchedule = [];
      } else {
        weekSchedule = postSchedule;
      }
    }

    return NextResponse.json({
      success: true,
      week,
      season,
      seasonType,
      seasonStart: seasonStart?.toISOString() ?? null,
      seasonEnd:   seasonEnd?.toISOString()   ?? null,
      games,
      gameCount: games.length,
      weekSchedule,
      totalWeeks: weekSchedule.length,
      postseasonNotAvailable,
      postseasonAvailableAfter,
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch from ESPN',
      week: 0,
      season: new Date().getFullYear(),
      seasonType: 2,
      games: [],
      gameCount: 0,
      weekSchedule: [],
      totalWeeks: 0,
      postseasonNotAvailable: false,
      postseasonAvailableAfter: null,
    }, { status: 500 });
  }
}
