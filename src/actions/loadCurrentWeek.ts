import { getSupabaseClient } from '@/lib/supabase';
import { DAYS_BEFORE_GAME, getNFLSeasonYear, isOffseason,debugError } from '@/lib/utils';

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
export async function getUpcomingWeek(): Promise<{ week: number; seasonType: number }> {
  const now = new Date();

  if (isOffseason(now)) {
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
    return await getWeekForPicks();
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
