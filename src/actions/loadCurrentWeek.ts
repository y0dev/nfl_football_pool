import { getSupabaseClient, getSupabaseServiceClient } from '@/lib/supabase';
import { DAYS_BEFORE_GAME, getNFLSeasonYear, isOffseason,debugError } from '@/lib/utils';

/**
 * The latest week/season_type this pool actually has data for — scoped to
 * the pool's own picks rather than "today's real-world NFL week" the way
 * getCurrentWeekFromGames() is, and rather than the shared `games` table's
 * mere existence of rows for a season_type. Both matter: for a PAST season's
 * pool, getCurrentWeekFromGames() finds whatever's closest to right now
 * globally (e.g. next season's preseason). And `games` is shared across
 * every pool — a pool that never played playoffs would still see playoff
 * games in that global table for its season, so picking "the furthest-along
 * season_type with any games" (rather than the one this pool's participants
 * actually submitted picks for) would land it on an empty season_type.
 */
export async function getLatestWeekForSeason(
  season: number,
  poolId?: string,
  /** Restrict the search to one season_type — e.g. the Season standings
   * tab means the regular season specifically (season_winners is likewise
   * always regular-season-only), even if the pool has since moved into
   * playoffs and the Weekly/Period tabs should follow it there. */
  onlySeasonType?: number
): Promise<{ week: number; seasonType: number }> {
  try {
    const supabase = getSupabaseServiceClient();

    if (poolId) {
      // A pool can have thousands of picks (17 participants x ~15 games x 18
      // weeks) — well past Supabase's default 1000-row query cap, and
      // ordering by a joined table's column through an !inner filter proved
      // unreliable. Instead: fetch the season's (much smaller, ~600-row)
      // games list, group into week/season_type buckets highest-first, and
      // do a cheap existence check against picks for each bucket until one
      // actually has this pool's data.
      let gamesQuery = supabase.from('games').select('id, week, season_type').eq('season', season);
      if (onlySeasonType !== undefined) gamesQuery = gamesQuery.eq('season_type', onlySeasonType);
      const { data: seasonGames } = await gamesQuery;

      if (seasonGames && seasonGames.length > 0) {
        const buckets = new Map<string, { week: number; seasonType: number; gameIds: string[] }>();
        for (const g of seasonGames) {
          const key = `${g.season_type}-${g.week}`;
          if (!buckets.has(key)) buckets.set(key, { week: g.week, seasonType: g.season_type, gameIds: [] });
          buckets.get(key)!.gameIds.push(g.id);
        }
        const sortedBuckets = [...buckets.values()].sort((a, b) =>
          b.seasonType !== a.seasonType ? b.seasonType - a.seasonType : b.week - a.week
        );

        for (const bucket of sortedBuckets) {
          const { data: existingPick } = await supabase
            .from('picks')
            .select('id')
            .eq('pool_id', poolId)
            .in('game_id', bucket.gameIds)
            .limit(1)
            .maybeSingle();
          if (existingPick) return { week: bucket.week, seasonType: bucket.seasonType };
        }
      }
    }

    // No pool-scoped picks found (or no poolId given) — fall back to
    // whatever games exist for the season generally.
    let latestGameQuery = supabase.from('games').select('week, season_type').eq('season', season);
    if (onlySeasonType !== undefined) latestGameQuery = latestGameQuery.eq('season_type', onlySeasonType);
    const { data: latestGame, error } = await latestGameQuery
      .order('season_type', { ascending: false })
      .order('week', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !latestGame) {
      return { week: 1, seasonType: onlySeasonType ?? 2 };
    }

    return { week: latestGame.week, seasonType: latestGame.season_type };
  } catch (error) {
    debugError('Error getting latest week for season:', error);
    return { week: 1, seasonType: 2 };
  }
}

/**
 * Whether a week's pick-tracking is meaningful to show yet — distinct from
 * isWeekUnlockedForPicks, which conflates two different "false" reasons
 * (too early to pick vs. already locked because games started). A
 * commissioner's Missing Picks panel should stay hidden only for the
 * "too early" case; once any game in the week has started, tracking who
 * didn't submit is exactly when it matters most; hiding it there would
 * defeat the point.
 *
 * Takes `season` explicitly (unlike isWeekUnlockedForPicks, which doesn't)
 * — week numbers restart every year, so without it this would blend an old
 * season's already-started games with a future season's not-yet-started
 * ones at the same week/season_type and report the wrong thing for either.
 */
export async function hasWeekPickWindowOpened(weekNumber: number, seasonType: number = 2, season?: number): Promise<boolean> {
  try {
    const supabase = getSupabaseServiceClient();
    const now = new Date();

    let gamesQuery = supabase
      .from('games')
      .select('kickoff_time, status')
      .eq('week', weekNumber)
      .eq('season_type', seasonType);
    if (season !== undefined) gamesQuery = gamesQuery.eq('season', season);
    const { data: games, error } = await gamesQuery.order('kickoff_time');

    if (error || !games || games.length === 0) return false;

    const hasStartedGames = games.some(game => {
      const kickoffTime = new Date(game.kickoff_time);
      return kickoffTime <= now || game.status !== 'scheduled';
    });
    if (hasStartedGames) return true;

    const firstGameTime = new Date(games[0].kickoff_time);
    const timeUntilFirstGame = firstGameTime.getTime() - now.getTime();
    const daysToKickoffInMs = DAYS_BEFORE_GAME * 24 * 60 * 60 * 1000;

    return timeUntilFirstGame <= daysToKickoffInMs;
  } catch (error) {
    debugError('Error checking if week pick window has opened:', error);
    return true; // permissive fallback — matches isWeekUnlockedForPicks's own fallback
  }
}

// Function to determine if picks should be unlocked for a given week
export async function isWeekUnlockedForPicks(weekNumber: number, seasonType: number = 2): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    const now = new Date();
    
    // Get all games for this specific week and season type
    const { data: games, error } = await supabase
      .from('games')
      .select('kickoff_time, status')
      .eq('week', weekNumber)
      .eq('season_type', seasonType)
      .order('kickoff_time');

    if (error || !games || games.length === 0) {
      // If no games found for this week, don't allow picks
      return false;
    }

    // Check if any games have already started
    const hasStartedGames = games.some(game => {
      const kickoffTime = new Date(game.kickoff_time);
      return kickoffTime <= now || game.status !== 'scheduled';
    });

    if (hasStartedGames) {
      // If any games have started, don't allow picks for this week
      return false;
    }

    // Check if we're within 3 days of the first game
    const firstGameTime = new Date(games[0].kickoff_time);
    const timeUntilFirstGame = firstGameTime.getTime() - now.getTime();
    const daysToKickoffInMs = DAYS_BEFORE_GAME * 24 * 60 * 60 * 1000; // 3 days in milliseconds
    
    if (timeUntilFirstGame > daysToKickoffInMs) {
      // More than 3 days before the first game, don't allow picks
      return false;
    }

    // Check if this is the upcoming week (closest future week)
    const { getWeekForPicks } = await import('./getCurrentWeekFromGames');
    const upcomingWeek = await getWeekForPicks();
    
    if (upcomingWeek.week === weekNumber && upcomingWeek.seasonType === seasonType) {
      // This is the upcoming week, allow picks
      return true;
    }

    // Allow picks for any week within 3 days of kickoff
    return timeUntilFirstGame <= daysToKickoffInMs && timeUntilFirstGame > 0;
    
  } catch (error) {
    debugError('Error checking if week is unlocked for picks:', error);
    // Fallback to permissive behavior
    return true;
  }
}

// Function to get the upcoming week (the week that should be unlocked for picks)
export async function getUpcomingWeek(
  /** Scope to one season year — see getWeekForPicks' matching param. Leave
   * undefined for the original global "what's upcoming in the NFL right
   * now" behavior every existing caller relies on. */
  season?: number
): Promise<{ week: number; seasonType: number }> {
  const now = new Date();

  if (isOffseason(now) && season === undefined) {
    const supabase = getSupabaseClient();
    const { data: futureGames } = await supabase
      .from('games')
      .select('id')
      .gte('kickoff_time', now.toISOString())
      .limit(1);
    if (!futureGames || futureGames.length === 0) {
      return { week: 1, seasonType: 0 };
    }
    // Games pre-loaded for upcoming season — fall through to normal detection
  }

  try {
    const { getWeekForPicks } = await import('./getCurrentWeekFromGames');
    return await getWeekForPicks(season);
  } catch (error) {
    debugError('Error getting upcoming week:', error);
    // Fallback to current week
    const currentWeekData = await loadCurrentWeek();
    return {
      week: currentWeekData.week_number,
      seasonType: currentWeekData.season_type || 2
    };
  }
}

export async function loadCurrentWeek() {
  try {
    const { getCurrentWeekFromGames } = await import('./getCurrentWeekFromGames');
    const { week, seasonType } = await getCurrentWeekFromGames();

    if (seasonType === 0) {
      // Offseason, return default week 1 with 0 games
      return {
        id: week,
        week_number: week,
        season_year: new Date().getFullYear(),
        game_count: 0,
        is_active: false,
        season_type: seasonType
      };
    }
    
    // Get game count and season for this week
    const supabase = getSupabaseClient();
    const { data: games, error } = await supabase
      .from('games')
      .select('season')
      .eq('week', week)
      .eq('season_type', seasonType)
      .eq('season', getNFLSeasonYear()); 
    if (error) {
      debugError('Error getting game data:', error);
    }

    // Get the season from the first game, or fallback to current year
    let seasonYear = new Date().getFullYear();
    if (games && games.length > 0 && games[0].season) {
      seasonYear = games[0].season;
    }

    return {
      id: week,
      week_number: week,
      season_year: seasonYear, // Use actual season from games
      game_count: games?.length || 0,
      is_active: true,
      season_type: seasonType
    };
  } catch (error) {
    debugError('Error loading current week:', error);
    // Fallback to hardcoded values
    return {
      id: 1,
      week_number: 1,
      season_year: new Date().getFullYear(), // Use current year as fallback
      game_count: 16,
      is_active: true
    };
  }
}
