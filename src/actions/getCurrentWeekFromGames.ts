import { getSupabaseClient } from '@/lib/supabase';

/**
 * Determines the current week based on game kickoff times
 * Avoids weeks where all games are finished
 * @returns The current week number and season type
 */
export async function getCurrentWeekFromGames() {
  try {
    const supabase = getSupabaseClient();
    const now = new Date();
    
    // Get all games ordered by kickoff time
    const { data: games, error } = await supabase
      .from('games')
      .select('week, season, kickoff_time, season_type, status')
      .order('kickoff_time');

    if (error) {
      console.error('Error loading games for current week calculation:', error);
      return { week: 1, seasonType: 2 }; // Fallback to regular season week 1
    }

    if (!games || games.length === 0) {
      console.log('No games found in database, using fallback values');
      return { week: 1, seasonType: 2 }; // Fallback to regular season week 1
    }

    // Group games by week and season
    const weekGroups = games.reduce((acc, game) => {
      const key = `${game.season}-${game.week}-${game.season_type}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(game);
      return acc;
    }, {} as Record<string, typeof games>);

    // Find the next week that has upcoming games (not all finished)
    let bestWeek = 1;
    let bestSeasonType = 2;
    let bestWeekHasUpcomingGames = false;

    for (const [key, weekGames] of Object.entries(weekGroups)) {
      const [season, week, seasonType] = key.split('-').map(Number);
      
      // Check if all games in this week are finished
      const allGamesFinished = weekGames.every(game => game.status === 'final');
      
      // Check if this week has any upcoming games
      const hasUpcomingGames = weekGames.some(game => {
        const kickoffTime = new Date(game.kickoff_time);
        return kickoffTime > now && game.status !== 'final';
      });

      // Check if this week has any games in progress
      const hasLiveGames = weekGames.some(game => game.status === 'live');

      // Check if this week has any scheduled games
      const hasScheduledGames = weekGames.some(game => game.status === 'scheduled');

      // If this week has upcoming games or live games, it's a candidate
      if (hasUpcomingGames || hasLiveGames || hasScheduledGames) {
        const weekStart = new Date(weekGames[0].kickoff_time);
        
        // If this week has upcoming games and is closer to now than our current best
        if (hasUpcomingGames && (!bestWeekHasUpcomingGames || weekStart < new Date())) {
          bestWeek = week;
          bestSeasonType = seasonType;
          bestWeekHasUpcomingGames = true;
        }
      }
      
      // If no week with upcoming games found, find the most recent week that's not all finished
      if (!bestWeekHasUpcomingGames && !allGamesFinished) {
        const weekStart = new Date(weekGames[0].kickoff_time);
        if (weekStart > new Date(bestWeek === 1 ? 0 : Date.now())) {
          bestWeek = week;
          bestSeasonType = seasonType;
        }
      }
    }

    // If we still don't have a good week, find the closest upcoming game
    if (bestWeek === 1) {
      let closestGame = null;
      let minTimeDiff = Infinity;
      
      for (const game of games) {
        const kickoffTime = new Date(game.kickoff_time);
        const timeDiff = Math.abs(kickoffTime.getTime() - now.getTime());
        
        // Prefer future games over past games
        if (kickoffTime > now && timeDiff < minTimeDiff) {
          minTimeDiff = timeDiff;
          closestGame = game;
        }
      }
      
      // If no future games, find the closest past game
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
 * Avoids weeks where all games are finished
 * @returns The week number and season type for picks
 */
export async function getWeekForPicks() {
  try {
    const supabase = getSupabaseClient();
    const now = new Date();
    
    // Get all games ordered by kickoff time
    const { data: games, error } = await supabase
      .from('games')
      .select('week, season, kickoff_time, season_type, status')
      .order('kickoff_time');

    if (error || !games || games.length === 0) {
      // Fallback to current week
      const currentWeekData = await getCurrentWeekFromGames();
      return currentWeekData;
    }

    // Group games by week and season
    const weekGroups = games.reduce((acc, game) => {
      const key = `${game.season}-${game.week}-${game.season_type}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(game);
      return acc;
    }, {} as Record<string, typeof games>);

    // Find the next week that has upcoming games (not all finished)
    let bestWeek = 1;
    let bestSeasonType = 2;
    let bestWeekHasUpcomingGames = false;

    for (const [key, weekGames] of Object.entries(weekGroups)) {
      const [season, week, seasonType] = key.split('-').map(Number);
      
      // Check if all games in this week are finished
      const allGamesFinished = weekGames.every(game => game.status === 'final');
      
      // Check if this week has any upcoming games
      const hasUpcomingGames = weekGames.some(game => {
        const kickoffTime = new Date(game.kickoff_time);
        return kickoffTime > now && game.status !== 'final';
      });

      // Check if this week has any games in progress
      const hasLiveGames = weekGames.some(game => game.status === 'live');

      // Check if this week has any scheduled games
      const hasScheduledGames = weekGames.some(game => game.status === 'scheduled');

      // If this week has upcoming games or live games, it's a candidate
      if (hasUpcomingGames || hasLiveGames || hasScheduledGames) {
        const weekStart = new Date(weekGames[0].kickoff_time);
        
        // If this week has upcoming games and is closer to now than our current best
        if (hasUpcomingGames && (!bestWeekHasUpcomingGames || weekStart < new Date())) {
          bestWeek = week;
          bestSeasonType = seasonType;
          bestWeekHasUpcomingGames = true;
        }
      }
      
      // If no week with upcoming games found, find the most recent week that's not all finished
      if (!bestWeekHasUpcomingGames && !allGamesFinished) {
        const weekStart = new Date(weekGames[0].kickoff_time);
        if (weekStart > new Date(bestWeek === 1 ? 0 : Date.now())) {
          bestWeek = week;
          bestSeasonType = seasonType;
        }
      }
    }

    // If we still don't have a good week, find the closest upcoming game
    if (bestWeek === 1) {
      let closestGame = null;
      let minTimeDiff = Infinity;
      
      for (const game of games) {
        const kickoffTime = new Date(game.kickoff_time);
        const timeDiff = Math.abs(kickoffTime.getTime() - now.getTime());
        
        // Prefer future games over past games
        if (kickoffTime > now && timeDiff < minTimeDiff) {
          minTimeDiff = timeDiff;
          closestGame = game;
        }
      }
      
      // If no future games, find the closest past game
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
  } catch (error) {
    console.error('Error getting week for picks:', error);
    // Fallback to current week
    const currentWeekData = await getCurrentWeekFromGames();
    return currentWeekData;
  }
}
