import { getSupabaseClient } from '@/lib/supabase';
import { isOffseason, isGameDecided, debugLog, debugError} from '@/lib/utils';

interface WeekGame {
  week: number;
  season: number;
  kickoff_time: string;
  season_type: number;
  status?: string | null;
  winner?: string | null;
}

/**
 * Shared week-selection algorithm behind getCurrentWeekFromGames() and
 * getWeekForPicks() — they differ only in which games they query (all vs.
 * one season), not in how "the current/best week" is chosen from them.
 *
 * Previously duplicated in both functions with two independent bugs:
 * (1) "finished" was matched as a literal lowercased status string, which
 * never matches the far more common 'final'/'Final' rows actually written
 * by nfl-sync — fixed via the shared isGameDecided() (winner != null).
 * (2) the fallback branch used `bestWeek === 1` as a sentinel for "nothing
 * selected yet," conflating "not set" with "the real answer happens to be
 * week 1" — once bestWeek was set to any non-1 week, the sentinel silently
 * flipped the comparison from "accept anything" to "only accept weeks
 * starting after right now," permanently locking in whatever the loop had
 * last picked instead of continuing to evaluate later weeks. Fixed with an
 * explicit bestWeekSet boolean.
 */
function findBestWeek(games: WeekGame[], now: Date): { week: number; seasonType: number } {
  // Group games by season/week/season_type
  const weekGroups = games.reduce((acc, game) => {
    const key = `${game.season}-${game.week}-${game.season_type}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(game);
    return acc;
  }, {} as Record<string, WeekGame[]>);

  let bestWeek = 1;
  let bestSeasonType = 2;
  let bestWeekSet = false;
  let bestWeekHasUpcomingGames = false;

  for (const [key, weekGames] of Object.entries(weekGroups)) {
    const [, week, seasonType] = key.split('-').map(Number);

    const allGamesFinished = weekGames.every(isGameDecided);

    const hasUpcomingGames = weekGames.some(game => {
      const kickoffTime = new Date(game.kickoff_time);
      return kickoffTime > now && !isGameDecided(game);
    });

    const hasLiveGames = weekGames.some(game => game.status === 'live');
    const hasScheduledGames = weekGames.some(game => game.status === 'scheduled');

    if (hasUpcomingGames || hasLiveGames || hasScheduledGames) {
      const weekStart = new Date(weekGames[0].kickoff_time);

      if (hasUpcomingGames && (!bestWeekHasUpcomingGames || weekStart < now)) {
        bestWeek = week;
        bestSeasonType = seasonType;
        bestWeekHasUpcomingGames = true;
        bestWeekSet = true;
      }
    }

    // If no week with upcoming games found yet, find the most recent week
    // that's not all finished — prefer weeks starting in the future over
    // past ones once something has already been selected.
    if (!bestWeekHasUpcomingGames && !allGamesFinished) {
      const weekStart = new Date(weekGames[0].kickoff_time);
      const referencePoint = bestWeekSet ? now : new Date(0);
      if (weekStart > referencePoint) {
        bestWeek = week;
        bestSeasonType = seasonType;
        bestWeekSet = true;
      }
    }
  }

  // If we still don't have a good week, find the closest upcoming game
  // (or, failing that, the closest past game).
  if (!bestWeekSet) {
    let closestGame: WeekGame | null = null;
    let minTimeDiff = Infinity;

    for (const game of games) {
      const kickoffTime = new Date(game.kickoff_time);
      const timeDiff = Math.abs(kickoffTime.getTime() - now.getTime());

      if (kickoffTime > now && timeDiff < minTimeDiff) {
        minTimeDiff = timeDiff;
        closestGame = game;
      }
    }

    if (!closestGame) {
      for (const game of games) {
        const kickoffTime = new Date(game.kickoff_time);
        const timeDiff = Math.abs(kickoffTime.getTime() - now.getTime());

        if (timeDiff < minTimeDiff) {
          minTimeDiff = timeDiff;
          closestGame = game;
        }
      }
    }

    if (closestGame) {
      bestWeek = closestGame.week;
      bestSeasonType = closestGame.season_type;
    }
  }

  return { week: bestWeek, seasonType: bestSeasonType };
}

/**
 * Determines the current week based on game kickoff times
 * Avoids weeks where all games are finished
 * @returns The current week number and season type
 */
export async function getCurrentWeekFromGames() {
  try {
    const supabase = getSupabaseClient();
    const now = new Date();

    if (isOffseason(now)) {
      // Check whether the admin has already loaded upcoming-season games into the DB.
      // If they have, fall through to normal week detection so those games surface.
      const { data: futureGames } = await supabase
        .from('games')
        .select('id')
        .gte('kickoff_time', now.toISOString())
        .limit(1);
      if (!futureGames || futureGames.length === 0) {
        return { week: 1, seasonType: 0 }; // True offseason — no upcoming games in DB yet
      }
    }

    // Get all games ordered by kickoff time
    const { data: games, error } = await supabase
      .from('games')
      .select('week, season, kickoff_time, season_type, status, winner')
      .order('kickoff_time');

    if (error) {
      debugError('Error loading games for current week calculation:', error);
      return { week: 1, seasonType: 2 }; // Fallback to regular season week 1
    }

    if (!games || games.length === 0) {
      debugLog('No games found in database, using fallback values');
      return { week: 1, seasonType: 2 }; // Fallback to regular season week 1
    }

    return findBestWeek(games, now);
  } catch (error) {
    debugError('Error getting current week from games:', error);
    return { week: 1, seasonType: 2 }; // Fallback to regular season week 1
  }
}

/**
 * Gets the upcoming week based on the closest upcoming game kickoff time
 * This is the week that should be unlocked for making picks
 * @returns The upcoming week number and season type
 */
async function getUpcomingWeekFromGames() {
  try {
    const supabase = getSupabaseClient();
    const now = new Date();

    // Get all future games ordered by kickoff time
    const { data: games, error } = await supabase
      .from('games')
      .select('week, season, kickoff_time, season_type')
      .gte('kickoff_time', now.toISOString())
      .order('kickoff_time');

    if (error || !games || games.length === 0) {
      // Fallback to current week
      const currentWeekData = await getCurrentWeekFromGames();
      return currentWeekData;
    }

    // Find the game with the closest upcoming kickoff time
    let closestGame = games[0];
    let minTimeDiff = Infinity;

    for (const game of games) {
      const kickoffTime = new Date(game.kickoff_time);
      const timeDiff = kickoffTime.getTime() - now.getTime();

      // Only consider future games (positive time difference)
      if (timeDiff > 0 && timeDiff < minTimeDiff) {
        minTimeDiff = timeDiff;
        closestGame = game;
      }
    }

    // Return the week and season type of the closest upcoming game
    return {
      week: closestGame.week,
      seasonType: closestGame.season_type
    };
  } catch (error) {
    debugError('Error getting upcoming week from games:', error);
    // Fallback to current week
    const currentWeekData = await getCurrentWeekFromGames();
    return currentWeekData;
  }
}

/**
 * Gets the week that should be unlocked for picks based on the closest upcoming game
 * Avoids weeks where all games are finished
 * @returns The week number and season type for picks
 */
export async function getWeekForPicks(
  /** Scope the search to one season year — without it, this compares
   * every year's games at once and can return a different season's week
   * than the one actually relevant to the caller (e.g. next season's
   * preseason outranking a just-finished season, since "finished" always
   * loses to "has upcoming games" in the comparison below regardless of
   * which year each belongs to). Leave undefined for the original
   * whatever's-upcoming-in-the-NFL-right-now behavior every existing
   * caller relies on. */
  season?: number
) {
  try {
    const supabase = getSupabaseClient();
    const now = new Date();

    // Get all games ordered by kickoff time
    let gamesQuery = supabase
      .from('games')
      .select('week, season, kickoff_time, season_type, status, winner');
    if (season !== undefined) gamesQuery = gamesQuery.eq('season', season);
    const { data: games, error } = await gamesQuery.order('kickoff_time');

    if (error || !games || games.length === 0) {
      // Fallback to current week
      const currentWeekData = await getCurrentWeekFromGames();
      return currentWeekData;
    }

    return findBestWeek(games, now);
  } catch (error) {
    debugError('Error getting week for picks:', error);
    // Fallback to current week
    const currentWeekData = await getCurrentWeekFromGames();
    return currentWeekData;
  }
}
