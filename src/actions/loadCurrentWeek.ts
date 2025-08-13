import { getSupabaseClient } from '@/lib/supabase';

export async function loadCurrentWeek() {
  try {
    const supabase = getSupabaseClient();
    const now = new Date();
    
    // Get all games ordered by kickoff time
    const { data: games, error } = await supabase
      .from('games')
      .select('week, season, kickoff_time, season_type')
      .order('kickoff_time');
    console.log('games', games);
    console.log('error', error);

    if (error) {
      console.error('Error loading games for current week calculation:', error);
      // Fallback to hardcoded values
      return {
        id: 1,
        week_number: 1,
        season_year: 2024,
        game_count: 16,
        is_active: true
      };
    }

    if (!games || games.length === 0) {
      console.log('No games found in database, using fallback values');
      return {
        id: 1,
        week_number: 1,
        season_year: 2024,
        game_count: 16,
        is_active: true
      };
    }

    // Find the current week based on game dates
    let currentWeek = 1;
    let currentSeason = 2024;
    let currentSeasonType = 2; // Default to regular season
    let gameCount = 0;

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
        currentSeason = season;
        currentSeasonType = weekGames[0].season_type;
        gameCount = weekGames.length;
        break;
      }
    }

    // If no current week found, find the next upcoming week
    if (currentWeek === 1) {
      for (const [key, weekGames] of Object.entries(weekGroups)) {
        const [season, week] = key.split('-').map(Number);
        const weekStart = new Date(weekGames[0].kickoff_time);
        
        if (now < weekStart) {
          currentWeek = week;
          currentSeason = season;
          currentSeasonType = weekGames[0].season_type;
          gameCount = weekGames.length;
          break;
        }
      }
    }

    // If still no week found, use the latest week
    if (currentWeek === 1) {
      const latestKey = Object.keys(weekGroups).sort().pop();
      if (latestKey) {
        const [season, week] = latestKey.split('-').map(Number);
        const weekGames = weekGroups[latestKey];
        currentWeek = week;
        currentSeason = season;
        currentSeasonType = weekGames[0].season_type;
        gameCount = weekGames.length;
      }
    }

    console.log('Current week calculation:', {
      currentWeek,
      currentSeason,
      currentSeasonType,
      gameCount,
      now: now.toISOString()
    });

    return {
      id: currentWeek,
      week_number: currentWeek,
      season_year: currentSeason,
      game_count: gameCount,
      is_active: true,
      season_type: currentSeasonType
    };
  } catch (error) {
    console.error('Error loading current week:', error);
    // Fallback to hardcoded values
    return {
      id: 1,
      week_number: 1,
      season_year: 2024,
      game_count: 16,
      is_active: true
    };
  }
}
