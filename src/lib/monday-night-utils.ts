import { Game } from '@/types/game';

/**
 * Identifies if a game is a Monday night game based on kickoff time
 * Monday night games typically start around 8:15 PM ET on Mondays
 */
export function isMondayNightGame(game: Game): boolean {
  const kickoffTime = new Date(game.kickoff_time);
  const dayOfWeek = kickoffTime.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const hour = kickoffTime.getHours();
  
  // Monday night games are on Monday (day 1) and typically start around 8 PM ET
  // We'll consider games between 7 PM and 11 PM ET on Monday as Monday night games
  return dayOfWeek === 1 && hour >= 19 && hour <= 23;
}

/**
 * Gets the Monday night game(s) from a list of games
 * Returns the game with the latest kickoff time if there are multiple Monday night games
 */
export function getMondayNightGame(games: Game[]): Game | null {
  const mondayNightGames = games.filter(isMondayNightGame);
  
  if (mondayNightGames.length === 0) {
    return null;
  }
  
  // If there are multiple Monday night games, return the one with the latest kickoff time
  return mondayNightGames.reduce((latest, current) => {
    const latestTime = new Date(latest.kickoff_time);
    const currentTime = new Date(current.kickoff_time);
    return currentTime > latestTime ? current : latest;
  });
}

/**
 * Gets the final game of the week (latest kickoff time)
 * This is useful when there might be multiple Monday night games
 */
export function getFinalGameOfWeek(games: Game[]): Game | null {
  if (games.length === 0) {
    return null;
  }
  
  return games.reduce((latest, current) => {
    const latestTime = new Date(latest.kickoff_time);
    const currentTime = new Date(current.kickoff_time);
    return currentTime > latestTime ? current : latest;
  });
}

/**
 * Gets the Monday night game info for display
 * Returns null if no Monday night game is found
 */
export function getMondayNightGameInfo(games: Game[]): {
  game: Game;
  displayText: string;
} | null {
  const mondayNightGame = getMondayNightGame(games);
  
  if (!mondayNightGame) {
    return null;
  }
  
  const kickoffTime = new Date(mondayNightGame.kickoff_time);
  const displayText = `${mondayNightGame.away_team} @ ${mondayNightGame.home_team}`;
  
  return {
    game: mondayNightGame,
    displayText
  };
}
