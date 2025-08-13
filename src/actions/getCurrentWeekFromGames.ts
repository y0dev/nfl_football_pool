import { getSupabaseClient } from '@/lib/supabase';

/**
 * Determines the current week based on game kickoff times
 * @returns The current week number and season type
 */
export async function getCurrentWeekFromGames() {
  try {
    const supabase = getSupabaseClient();
    const now = new Date();
    
    // Get all games ordered by kickoff time
    const { data: games, error } = await supabase
      .from('games')
      .select('week, season, kickoff_time, season_type')
      .order('kickoff_time');

    if (error) {
      console.error('Error loading games for current week calculation:', error);
      return { week: 1, seasonType: 2 }; // Fallback to regular season week 1
    }

    if (!games || games.length === 0) {
      console.log('No games found in database, using fallback values');
      return { week: 1, seasonType: 2 }; // Fallback to regular season week 1
    }

    // Find the current week based on game dates
    let currentWeek = 1;
    let currentSeasonType = 2; // Default to regular season

    // Group games by week and season
    const weekGroups = games.reduce((acc, game) => {
      const key = `${game.season}-${game.week}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(game);
      return acc;
    }, {} as Record<string, typeof games>);

    // Find the week that contains the current date
    for (const [key, weekGames] of Object.entries(weekGroups)) {
      const [season, week] = key.split('-').map(Number);
      const weekStart = new Date(weekGames[0].kickoff_time);
      const weekEnd = new Date(weekGames[weekGames.length - 1].kickoff_time);
      
      // Add 7 days to weekEnd to cover the full week
      weekEnd.setDate(weekEnd.getDate() + 7);
      
      if (now >= weekStart && now <= weekEnd) {
        currentWeek = week;
        currentSeasonType = weekGames[0].season_type;
        break;
      }
    }

    // If no current week found, find the closest upcoming game
    if (currentWeek === 1) {
      let closestGame = null;
      let minTimeDiff = Infinity;
      
      for (const game of games) {
        const kickoffTime = new Date(game.kickoff_time);
        const timeDiff = Math.abs(kickoffTime.getTime() - now.getTime());
        
        // Find the game closest to current time (past or future)
        if (timeDiff < minTimeDiff) {
          minTimeDiff = timeDiff;
          closestGame = game;
        }
      }
      
      if (closestGame) {
        currentWeek = closestGame.week;
        currentSeasonType = closestGame.season_type;
      }
    }

    return { week: currentWeek, seasonType: currentSeasonType };
  } catch (error) {
    console.error('Error getting current week from games:', error);
    return { week: 1, seasonType: 2 }; // Fallback to regular season week 1
  }
}

/**
 * Gets the upcoming week based on the closest upcoming game kickoff time
 * This is the week that should be unlocked for making picks
 * @returns The upcoming week number and season type
 */
export async function getUpcomingWeekFromGames() {
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
    console.error('Error getting upcoming week from games:', error);
    // Fallback to current week
    const currentWeekData = await getCurrentWeekFromGames();
    return currentWeekData;
  }
}

/**
 * Gets the week that should be unlocked for picks based on the closest upcoming game
 * This function specifically determines which week participants should be able to make picks for
 * @returns The week number and season type for picks
 */
export async function getWeekForPicks() {
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
    // This is the week that should be unlocked for picks
    return {
      week: closestGame.week,
      seasonType: closestGame.season_type
    };
  } catch (error) {
    console.error('Error getting week for picks:', error);
    // Fallback to current week
    const currentWeekData = await getCurrentWeekFromGames();
    return currentWeekData;
  }
}
