import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Rank icon and color utilities for leaderboards
export const getRankIcon = (index: number) => {
  switch (index) {
    case 0:
      return 'trophy-gold';
    case 1:
      return 'medal-silver';
    case 2:
      return 'award-bronze';
    default:
      return `rank-${index + 1}`;
  }
};

export const getRankColor = (index: number) => {
  switch (index) {
    case 0:
      return 'bg-yellow-50 border-yellow-200';
    case 1:
      return 'bg-gray-50 border-gray-200';
    case 2:
      return 'bg-amber-50 border-amber-200';
    default:
      return 'bg-white border-gray-200';
  }
};

// Tie-breaker weeks where tie breakers are used for normal pools
// Includes quarter marks (4, 9, 14) and Super Bowl (season_type 3)
export const PERIOD_WEEKS = [4, 9, 14, 18] as const;

// Super Bowl is in season_type 3 (playoffs)
export const SUPER_BOWL_SEASON_TYPE = 3;

export function createPageUrl(page: string): string {
  debugLog('Creating page URL for:', page);
  // Normalize page names to lowercase and remove spaces
  const normalized = page.replace(/\s+/g, "").toLowerCase();
  switch (normalized) {
    case "dashboard":
      return "/dashboard";
    case "admindashboard":
      return "/admin/dashboard";
    case "adminpools":
      return "/pools";
    case "adminnflsync":
      return "/admin/nfl-sync";
    case "overridepicks":
      return "/override-picks";
    case "admincommissioners":
      return "/admin/commissioners";
    case "adminreminders":
      return "/admin/reminders";
    case "adminregister":
    case "register":
      return "/register";
    case "adminlogin":
      return "/admin/login";
    case "invite":
      return "/invite";
    case "login":
      return "/login";
    case "participant":
      return "/participant";
    case "superadmin":
      return "/super-admin";
    case "landing":
      return "/";
    default:
      // For dynamic routes like pool picks with specific pool ID
      if (normalized.startsWith("poolpicks?")) {
        const params = new URLSearchParams(page.split("?")[1]);
        const poolId = params.get("poolId");
        if (poolId) {
          return `/pool/${poolId}/picks?` + page.split("?")[1];
        }
        return "/pool/[id]/picks?" + page.split("?")[1];
      }
      if (normalized.startsWith("adminpool?")) {
        const params = new URLSearchParams(page.split("?")[1]);
        const poolId = params.get("poolId");
        if (poolId) {
          return `/pool/${poolId}`;
        }
        return "/pool/[id]";
      }
      if (normalized.startsWith("leaderboard?")) {
        return "/leaderboard?" + page.split("?")[1];
      }
      if (normalized.startsWith("overridepicks?")) {
        return "/override-picks?" + page.split("?")[1];
      }
      return "/" + normalized;
  }
}

/**
 * Application-wide constants
 * These values are used throughout the project and can be easily updated in one place
 */

// NFL Season Configuration
export const CURRENT_NFL_SEASON = 2025;
export const DEFAULT_SEASON = 2025;
export const DEFAULT_SEASON_TYPE = 2; // 1=Preseason, 2=Regular Season, 3=Postseason

/**
 * Calculate the NFL season year based on current date.
 * The NFL season year changes after the second week of February.
 * So if we're in January or early February (before Feb 14), we're still in the previous year's season.
 * 
 * @returns The NFL season year (e.g., if it's January 2025, returns 2024)
 */
export function getNFLSeasonYear(): number {
  const now = new Date();
  const currentYear = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  const day = now.getDate();
  
  // If we're before February 14th, we're still in the previous year's season
  if (month < 2 || (month === 2 && day < 14)) {
    return currentYear - 1;
  }
  
  return currentYear;
}

// Pool Configuration
export const DEFAULT_POOL_SEASON = getNFLSeasonYear();
export const DEFAULT_POOL_IS_ACTIVE = true;
export const DEFAULT_TIE_BREAKER_METHOD = 'confidence_points';

// Game Configuration
export const MAX_WEEKS_PRESEASON = 4;
export const MAX_WEEKS_REGULAR_SEASON = 18;
export const MAX_WEEKS_POSTSEASON = 4;
export const DEFAULT_WEEK = 1;

// Confidence Points Configuration
export const MIN_CONFIDENCE_POINTS = 1;
export const MAX_CONFIDENCE_POINTS = 16;
export const CONFIDENCE_POINTS_RANGE = Array.from(
  { length: MAX_CONFIDENCE_POINTS }, 
  (_, i) => MAX_CONFIDENCE_POINTS - i
);

// Performance Thresholds
export const PERFORMANCE_THRESHOLDS = {
  EXCELLENT: 80,
  GOOD: 60,
  AVERAGE: 40,
  POOR: 0
} as const;

// UI Configuration
export const SCREEN_BREAKPOINTS = {
  MOBILE: 768,
  TABLET: 1024,
  DESKTOP: 1280
} as const;

// Date/Time Configuration
export const DATE_FORMATS = {
  SHORT: 'MMM dd',
  MEDIUM: 'MMM dd, yyyy',
  LONG: 'EEEE, MMMM dd, yyyy',
  TIME: 'h:mm a',
  DATETIME: 'MMM dd, yyyy h:mm a'
} as const;

// Session Management Configuration
export const SESSION_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds

// Game Timing Configuration
export const DAYS_BEFORE_GAME = 7; // Number of days before game kickoff for various operations

// API Configuration
export const API_ENDPOINTS = {
  POOLS: '/api/pools',
  PICKS: '/api/picks',
  ADMIN: '/api/admin',
  LEADERBOARD: '/api/leaderboard',
  SUPER_ADMIN: '/api/super-admin'
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  SERVER_ERROR: 'An unexpected error occurred. Please try again later.'
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  POOL_CREATED: 'Pool created successfully!',
  POOL_UPDATED: 'Pool updated successfully!',
  PICKS_SUBMITTED: 'Picks submitted successfully!',
  USER_ADDED: 'User added to pool successfully!',
  USER_REMOVED: 'User removed from pool successfully!'
} as const;

export function formatDate(date: string | Date) {
  const d = new Date(date)
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  
  const day = days[d.getUTCDay()]
  const month = months[d.getUTCMonth()]
  const dateNum = d.getUTCDate()
  const hours = d.getUTCHours()
  const minutes = d.getUTCMinutes().toString().padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  
  return `${day}, ${month} ${dateNum} at ${displayHours}:${minutes} ${ampm}`
}

export function formatTime(date: string | Date) {
  const d = new Date(date)
  const hours = d.getUTCHours()
  const minutes = d.getUTCMinutes().toString().padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  
  return `${displayHours}:${minutes} ${ampm}`
}

/**
 * List of all NFL teams (as JSON objects)
 * This is used to display team names and abbreviations in the UI
 * and to validate team names and abbreviations in the database
 * and to validate team names and abbreviations in the database
 */
export const NFL_TEAMS = [
  { name: 'Arizona Cardinals', abbreviation: 'ARI', conference: 'NFC' , division: 'West' },
  { name: 'Los Angeles Rams', abbreviation: 'LAR', conference: 'NFC' , division: 'West'},
  { name: 'San Francisco 49ers', abbreviation: 'SF', conference: 'NFC' , division: 'West'},
  { name: 'Seattle Seahawks', abbreviation: 'SEA', conference: 'NFC' , division: 'West'},

  { name: 'Atlanta Falcons', abbreviation: 'ATL', conference: 'NFC' , division: 'South'},
  { name: 'Carolina Panthers', abbreviation: 'CAR', conference: 'NFC' , division: 'South'},
  { name: 'New Orleans Saints', abbreviation: 'NO', conference: 'NFC' , division: 'South'},
  { name: 'Tampa Bay Buccaneers', abbreviation: 'TB', conference: 'NFC' , division: 'South'},

  { name: 'Chicago Bears', abbreviation: 'CHI', conference: 'NFC' , division: 'North'},
  { name: 'Detroit Lions', abbreviation: 'DET', conference: 'NFC' , division: 'North'},
  { name: 'Green Bay Packers', abbreviation: 'GB', conference: 'NFC' , division: 'North'},
  { name: 'Minnesota Vikings', abbreviation: 'MIN', conference: 'NFC' , division: 'North'},

  { name: 'Dallas Cowboys', abbreviation: 'DAL', conference: 'NFC' , division: 'East'},
  { name: 'New York Giants', abbreviation: 'NYG', conference: 'NFC' , division: 'East'},
  { name: 'Philadelphia Eagles', abbreviation: 'PHI', conference: 'NFC' , division: 'East'},
  { name: 'Washington Commanders', abbreviation: 'WSH', conference: 'NFC' , division: 'East'},
  
  { name: 'Baltimore Ravens', abbreviation: 'BAL', conference: 'AFC' , division: 'North'},
  { name: 'Cincinnati Bengals', abbreviation: 'CIN', conference: 'AFC' , division: 'North'},
  { name: 'Cleveland Browns', abbreviation: 'CLE', conference: 'AFC' , division: 'North'},
  { name: 'Pittsburgh Steelers', abbreviation: 'PIT', conference: 'AFC' , division: 'North'},

  { name: 'Buffalo Bills', abbreviation: 'BUF', conference: 'AFC' , division: 'East' },
  { name: 'Miami Dolphins', abbreviation: 'MIA', conference: 'AFC' , division: 'East' },   
  { name: 'New England Patriots', abbreviation: 'NE', conference: 'AFC' , division: 'East' },
  { name: 'New York Jets', abbreviation: 'NYJ', conference: 'AFC' , division: 'East' },

  { name: 'Denver Broncos', abbreviation: 'DEN', conference: 'AFC' , division: 'West' },
  { name: 'Kansas City Chiefs', abbreviation: 'KC', conference: 'AFC' , division: 'West' },
  { name: 'Las Vegas Raiders', abbreviation: 'LV', conference: 'AFC' , division: 'West' },
  { name: 'Los Angeles Chargers', abbreviation: 'LAC', conference: 'AFC' , division: 'West' },

  { name: 'Houston Texans', abbreviation: 'HOU', conference: 'AFC' , division: 'South'},
  { name: 'Indianapolis Colts', abbreviation: 'IND', conference: 'AFC' , division: 'South'},
  { name: 'Jacksonville Jaguars', abbreviation: 'JAX', conference: 'AFC' , division: 'South'},
  { name: 'Tennessee Titans', abbreviation: 'TEN', conference: 'AFC' , division: 'South'},
] as const;

/**
 * Get NFL team name
 */
export function getNFLTeamName(abbreviation: string): string {
  const team = NFL_TEAMS.find(t => t.abbreviation === abbreviation);
  return team?.name || abbreviation;
}

/**
 * Get team abbreviation
 */
export function getTeamAbbreviation(fullName: string): string {
  const team = NFL_TEAMS.find(t => t.name === fullName);
  if (team) {
    return team.abbreviation;
  }
  // Fallback: generate abbreviation from name
  return fullName.split(' ').map(word => word[0]).join('').toUpperCase();
}

/**
 * Get team conference
 */
export function getTeamConference(abbreviation: string): string {
  const team = NFL_TEAMS.find(t => t.abbreviation === abbreviation);
  return team?.conference || '';
}

/**
 * Get team division
 */
export function getTeamDivision(abbreviation: string): string {
  const team = NFL_TEAMS.find(t => t.abbreviation === abbreviation);
  return team?.conference + ' ' + team?.division || '';
}

/**
 * Get short team name for mobile display
 * Returns a shortened version of the team name suitable for smaller screens
 */
export function getShortTeamName(teamName: string): string {
  const team = NFL_TEAMS.find(t => t.name === teamName);
  if (!team) {
    return teamName;
  }
  
  // Generate short name from abbreviation and last word
  const lastWord = teamName.split(' ').pop() || '';
  return `${team.abbreviation} ${lastWord}`;
}

/**
 * Helper function to get max weeks for a season type
 */
export function getMaxWeeksForSeason(seasonType: number): number {
  switch (seasonType) {
    case 1: return MAX_WEEKS_PRESEASON;
    case 2: return MAX_WEEKS_REGULAR_SEASON;
    case 3: return MAX_WEEKS_POSTSEASON;
    default: return MAX_WEEKS_REGULAR_SEASON;
  }
}

/**
 * Helper function to get season type name
 */
export function getSeasonTypeName(seasonType: number): string {
  switch (seasonType) {
    case 1: return 'Preseason';
    case 2: return 'Regular Season';
    case 3: return 'Postseason';
    default: return 'Unknown';
  }
}

/*
 * Get playoff round name
 */
export function getPlayoffRoundName(week: number): string {
  switch (week) {
    case 1: return 'Wild Card';
    case 2: return 'Divisional Round';
    case 3: return 'Conference Championship';
    case 4: return 'Super Bowl';
    default: return `Round ${week}`;
  }
}

/**
 * Get week/round title based on season type
 * @param week - The week number (1-4 for playoffs, 1-4 for preseason, 1-18 for regular season)
 * @param seasonType - The season type (1=Preseason, 2=Regular Season, 3=Postseason/Playoffs)
 * @returns A formatted string representing the week/round title
 */
export function getWeekTitle(week: number, seasonType: number): string {
  if (seasonType === 3) {
    // Playoff rounds
    const roundNames: Record<number, string> = {
      1: 'Wild Card Round',
      2: 'Divisional Round',
      3: 'Conference Championships',
      4: 'Super Bowl',
    };
    return roundNames[week] || `Playoff Round ${week}`;
  } else if (seasonType === 1) {
    // Preseason
    return `Preseason Week ${week}`;
  } else {
    // Regular Season
    return `Week ${week}`;
  }
}

/**
 * Calculate week number from date (simple date-based calculation)
 * This is a fallback when database functions are not available
 */
export function calculateWeekFromDate(date: Date = new Date()): number {
  const seasonStart = new Date(date.getFullYear(), 8, 1); // September 1st
  const weekDiff = Math.floor((date.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return Math.max(1, Math.min(18, weekDiff + 1));
}

/**
 * Get season type from date (simple date-based calculation)
 * This is a fallback when database functions are not available
 */
export function getWeekPeriod(week: number): string {
  if (week <= 4) return 'Q1';
  if (week <= 9) return 'Q2';
  if (week <= 13) return 'Q3';
  if (week <= 17) return 'Q4';
  return 'Playoffs';
}

export function getWeekPeriodColor(week: number): string {
  const period = getWeekPeriod(week);
  switch (period) {
    case 'Q1': return 'bg-blue-100 text-blue-800';
    case 'Q2': return 'bg-green-100 text-green-800';
    case 'Q3': return 'bg-yellow-100 text-yellow-800';
    case 'Q4': return 'bg-purple-100 text-purple-800';
    case 'Playoffs': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

export function getSeasonTypeFromDate(date: Date = new Date()): number {
  const month = date.getMonth() + 1; // 0-indexed
  if (month >= 8 && month <= 9) return 1; // Preseason
  if (month >= 9 && month <= 12) return 2; // Regular Season
  if (month >= 1 && month <= 2) return 3; // Postseason
  return 2; // Default to regular season
}

/**
 * Single entry point for getting current week data
 * Attempts database functions first, falls back to date calculations
 * 
 * Note: For Supabase Edge Functions, use the local calculation functions
 * since they can't import from @/lib/utils
 */
export async function getCurrentWeekData() {
  try {
    const { getCurrentWeekFromGames } = await import('@/actions/getCurrentWeekFromGames');
    return await getCurrentWeekFromGames();
  } catch (error) {
    console.error('Error getting current week data from database, using fallback:', error);
    const fallbackWeek = calculateWeekFromDate();
    const fallbackSeasonType = getSeasonTypeFromDate();
    return { week: fallbackWeek, seasonType: fallbackSeasonType };
  }
}

/**
 * Development-only logging utilities
 * These functions only log when NODE_ENV === 'development'
 */

export const debugLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(...args);
  }
};

export const debugError = (...args: unknown[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.error(...args);
  }
};

export const debugWarn = (...args: unknown[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.warn(...args);
  }
};

export const debugInfo = (...args: unknown[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.info(...args);
  }
};

/**
 * Conditional debug logging with a custom flag
 * Usage: debugIf(process.env.NEXT_PUBLIC_DEBUG === 'true', 'Debug message')
 */
export const debugIf = (condition: boolean, ...args: unknown[]) => {
  if (condition && process.env.NODE_ENV === 'development') {
    console.log(...args);
  }
}; 

export const isDummyData = () => {
  return process.env.DUMMY_DATA === 'true' || process.env.NEXT_PUBLIC_DUMMY_DATA === 'true';
};

// Create dummy data for development 
// Dummy pool
export const DUMMY_POOL = {
  id: 'dummy-pool-id-12345',
  name: 'NFL Fantasy Pool 2025',
  description: 'A fun NFL fantasy football pool for the 2025 season',
  season: DEFAULT_POOL_SEASON,
  is_active: true,
  created_by: 'dummy-admin-id',
  created_at: new Date().toISOString(),
  tie_breaker_method: 'total_points',
  tie_breaker_question: 'What will be the total points scored in the Super Bowl?',
  tie_breaker_answer: 45,
  require_access_code: false,
  access_code: null,
  logo_url: null,
  participant_count: 4, // Matches DUMMY_PARTICIPANTS length
};


// Dummy participants 
export const DUMMY_PARTICIPANTS = [
  { id: '1', name: 'Participant 1', email: 'participant1@example.com' },
  { id: '2', name: 'Participant 2', email: 'participant2@example.com' },
  { id: '3', name: 'Participant 3', email: 'participant3@example.com' },
  { id: '4', name: 'Participant 4', email: 'participant4@example.com' }
];

// Dummy Playoff Teams - 7 AFC teams and 7 NFC teams (14 total)
export const DUMMY_PLAYOFF_TEAMS = (() => {
  const afcTeams = NFL_TEAMS.filter(team => team.conference === 'AFC').slice(0, 7);
  const nfcTeams = NFL_TEAMS.filter(team => team.conference === 'NFC').slice(0, 7);
  
  const playoffTeams = [
    // AFC Teams (seeds 1-7)
    ...afcTeams.map((team, index) => ({
      team_name: team.name,
      team_abbreviation: team.abbreviation,
      conference: team.conference,
      seed: index + 1,
    })),
    // NFC Teams (seeds 1-7)
    ...nfcTeams.map((team, index) => ({
      team_name: team.name,
      team_abbreviation: team.abbreviation,
      conference: team.conference,
      seed: index + 1,
    })),
  ];
  
  return playoffTeams;
})();

// Dummy Playoff Games - Based on NFL playoff bracket structure
// Week 1 (Wild Card): 6 games - Seeds 1 get byes
// Week 2 (Divisional): 4 games - Seed 1 plays lowest remaining
// Week 3 (Conference Championship): 2 games - Highest vs lowest remaining
// Week 4 (Super Bowl): 1 game - AFC Champion vs NFC Champion
export const DUMMY_PLAYOFF_GAMES = (() => {
  const afcTeams = NFL_TEAMS.filter(team => team.conference === 'AFC').slice(0, 7);
  const nfcTeams = NFL_TEAMS.filter(team => team.conference === 'NFC').slice(0, 7);
  const season = DEFAULT_POOL_SEASON;
  const playoffYear = season + 1; // Playoffs occur in the year after the season
  
  // Helper to get team by seed (1-indexed) - works with any team array
  const getTeamBySeed = (teams: Array<{ name: string }>, seed: number) => teams[seed - 1];
  
  // Helper to create game object with all required fields
  const createGame = (week: number, awayTeam: string, homeTeam: string, index: number) => {
    const defaultDates: Record<number, string> = {
      1: `${playoffYear}-01-11T18:00:00Z`, // Wild Card Weekend
      2: `${playoffYear}-01-18T18:00:00Z`, // Divisional Round
      3: `${playoffYear}-01-25T18:00:00Z`, // Conference Championship
      4: `${playoffYear}-02-08T18:00:00Z`  // Super Bowl
    };
    
    return {
      id: `dummy-game-${season}-${week}-${index}`,
      season: season,
      season_type: 3, // Postseason
      week: week,
      away_team: awayTeam,
      home_team: homeTeam,
      kickoff_time: defaultDates[week] || new Date().toISOString(),
      status: 'scheduled',
      winner: null,
      is_playoff: true
    };
  };
  
  const playoffGames = [
    // Week 1: Wild Card Round (6 games)
    // AFC Wild Card: Seeds 1 get bye, so we have 2 vs 7, 3 vs 6, 4 vs 5
    createGame(1, getTeamBySeed(afcTeams, 7).name, getTeamBySeed(afcTeams, 2).name, 1),
    createGame(1, getTeamBySeed(afcTeams, 6).name, getTeamBySeed(afcTeams, 3).name, 2),
    createGame(1, getTeamBySeed(afcTeams, 5).name, getTeamBySeed(afcTeams, 4).name, 3),
    // NFC Wild Card: Seeds 1 get bye, so we have 2 vs 7, 3 vs 6, 4 vs 5
    createGame(1, getTeamBySeed(nfcTeams, 7).name, getTeamBySeed(nfcTeams, 2).name, 4),
    createGame(1, getTeamBySeed(nfcTeams, 6).name, getTeamBySeed(nfcTeams, 3).name, 5),
    createGame(1, getTeamBySeed(nfcTeams, 5).name, getTeamBySeed(nfcTeams, 4).name, 6),
    
    // Week 2: Divisional Round (4 games)
    // Seed 1 plays lowest remaining seed (for dummy data, assume seed 5 wins wild card)
    // AFC Divisional: 1 vs 5 (lowest remaining), 2 vs 3 (next highest matchups)
    createGame(2, getTeamBySeed(afcTeams, 5).name, getTeamBySeed(afcTeams, 1).name, 1),
    createGame(2, getTeamBySeed(afcTeams, 3).name, getTeamBySeed(afcTeams, 2).name, 2),
    // NFC Divisional: 1 vs 5, 2 vs 3
    createGame(2, getTeamBySeed(nfcTeams, 5).name, getTeamBySeed(nfcTeams, 1).name, 3),
    createGame(2, getTeamBySeed(nfcTeams, 3).name, getTeamBySeed(nfcTeams, 2).name, 4),
    
    // Week 3: Conference Championship (2 games)
    // Highest remaining seed vs lowest remaining seed
    // AFC Championship: Assume seed 1 and seed 2 advance
    createGame(3, getTeamBySeed(afcTeams, 2).name, getTeamBySeed(afcTeams, 1).name, 1),
    // NFC Championship: Assume seed 1 and seed 2 advance
    createGame(3, getTeamBySeed(nfcTeams, 2).name, getTeamBySeed(nfcTeams, 1).name, 2),
    
    // Week 4: Super Bowl (1 game)
    // AFC Champion vs NFC Champion
    // For dummy data, use seed 1 from each conference
    createGame(4, getTeamBySeed(afcTeams, 1).name, getTeamBySeed(nfcTeams, 1).name, 1),
  ];
  
  return playoffGames;
})();

// Dummy Playoff Confidence Points - 14 confidence points (7 AFC confidence points and 7 NFC confidence points)
export const DUMMY_PLAYOFF_CONFIDENCE_POINTS = (() => {
  const afcConfidencePoints = NFL_TEAMS.filter(team => team.conference === 'AFC').slice(0, 7);
  const nfcConfidencePoints = NFL_TEAMS.filter(team => team.conference === 'NFC').slice(0, 7);
  
  const playoffConfidencePoints = [
    // AFC Confidence Points (seeds 1-7)
    ...afcConfidencePoints.map((confidencePoint, index) => ({
      confidence_point_name: confidencePoint.name,
      confidence_point_abbreviation: confidencePoint.abbreviation,
      confidence_point_conference: confidencePoint.conference,
      confidence_point_seed: index + 1,
    })),
    // NFC Confidence Points (seeds 1-7)
    ...nfcConfidencePoints.map((confidencePoint, index) => ({
      confidence_point_name: confidencePoint.name,
      confidence_point_abbreviation: confidencePoint.abbreviation,
      confidence_point_conference: confidencePoint.conference,
      confidence_point_seed: index + 1,
    })),
  ];
  return playoffConfidencePoints;
})();

// Dummy Playoff Confidence Points Submissions
export const DUMMY_PLAYOFF_CONFIDENCE_POINTS_SUBMISSIONS = [
  { participant_id: '1', participant_name: 'Participant 1', submission_count: 14, total_teams: 14, submitted: true },
  { participant_id: '2', participant_name: 'Participant 2', submission_count: 13, total_teams: 14, submitted: false },
  { participant_id: '3', participant_name: 'Participant 3', submission_count: 14, total_teams: 14, submitted: true },
  { participant_id: '4', participant_name: 'Participant 4', submission_count: 14, total_teams: 14, submitted: true },
];

// Dummy Regular Season Games - Sample week with 16 games
export const DUMMY_GAMES = (() => {
  const season = DEFAULT_POOL_SEASON;
  const week = 1;
  const games: Array<{
    id: string;
    season: number;
    season_type: number;
    week: number;
    away_team: string;
    home_team: string;
    kickoff_time: string;
    status: string;
    winner: string | null;
    is_playoff: boolean;
  }> = [];
  
  // Create 16 games (typical NFL week)
  const allTeams = [...NFL_TEAMS];
  for (let i = 0; i < 16; i++) {
    const awayIndex = i * 2;
    const homeIndex = (i * 2) + 1;
    
    if (awayIndex < allTeams.length && homeIndex < allTeams.length) {
      const kickoffDate = new Date(season, 8, week * 7 + i % 3, 13 + (i % 4), 0); // Spread games across days
      games.push({
        id: `dummy-game-${season}-${week}-${i}`,
        season: season,
        season_type: 2, // Regular season
        week: week,
        away_team: allTeams[awayIndex].name,
        home_team: allTeams[homeIndex].name,
        kickoff_time: kickoffDate.toISOString(),
        status: i < 12 ? 'final' : 'scheduled', // First 12 games are final
        winner: i < 12 ? (i % 2 === 0 ? allTeams[homeIndex].name : allTeams[awayIndex].name) : null,
        is_playoff: false
      });
    }
  }
  
  return games;
})();

// Helper function to create dummy leaderboard based on games and participants
const createDummyLeaderboard = (
  participants: typeof DUMMY_PARTICIPANTS,
  games: Array<{ 
    id: string; 
    away_team: string; 
    home_team: string; 
    winner: string | null; 
    status: string;
    week?: number;
    season_type?: number;
  }>,
  isPlayoff: boolean = false
) => {
  // Get week and season type from first game if available, otherwise use defaults
  const defaultWeek = games.length > 0 && games[0].week ? games[0].week : 1;
  const defaultSeasonType = isPlayoff ? 3 : 2;
  
  return participants.map((participant, participantIndex) => {
    const gamePoints: { [gameId: string]: number } = {};
    const picks: any[] = [];
    let totalPoints = 0;
    let correctPicks = 0;
    let totalPicks = 0;

    // Create a shuffled array of unique confidence points for this participant
    // Each participant gets unique confidence points for each game
    const maxConfidencePoints = isPlayoff ? 14 : 16;
    const confidencePointsArray: number[] = [];
    
    // Generate array of confidence points (1 to maxConfidencePoints)
    for (let i = 1; i <= maxConfidencePoints; i++) {
      confidencePointsArray.push(i);
    }
    
    // Shuffle the array to randomize assignment per participant
    // Use participant index as a seed to make it deterministic but varied per participant
    for (let i = confidencePointsArray.length - 1; i > 0; i--) {
      // Use participant index to create different shuffle patterns
      const j = Math.floor(((participantIndex * 7 + i * 3) % (i + 1)) + 0);
      [confidencePointsArray[i], confidencePointsArray[j]] = [confidencePointsArray[j], confidencePointsArray[i]];
    }
    
    // If we have more games than confidence points, cycle through the array
    let confidencePointIndex = 0;

    games.forEach((game, gameIndex) => {
      const gameId = game.id;
      // Vary picks by participant to create realistic leaderboard
      // Participant index determines their "skill level" for simulation
      const pickCorrect = (participantIndex + gameIndex) % 3 !== 0; // Roughly 67% correct
      const predictedWinner = pickCorrect && game.winner 
        ? game.winner 
        : (game.winner === game.home_team ? game.away_team : game.home_team);
      
      // Get unique confidence point for this game
      const confidencePoints = confidencePointsArray[confidencePointIndex % confidencePointsArray.length];
      confidencePointIndex++;

      totalPicks++;
      
      let points = 0;
      if (game.status === 'final' || game.status === 'post') {
        if (game.winner && predictedWinner === game.winner) {
          points = confidencePoints;
          correctPicks++;
        }
      }

      gamePoints[gameId] = points;
      totalPoints += points;

      picks.push({
        id: `dummy-pick-${participant.id}-${gameId}`,
        participant_id: participant.id,
        participant_name: participant.name,
        game_id: gameId,
        home_team: game.home_team,
        away_team: game.away_team,
        predicted_winner: predictedWinner,
        confidence_points: confidencePoints,
        week: game.week || defaultWeek,
        season_type: game.season_type || defaultSeasonType,
        game_status: game.status,
        game_winner: game.winner,
        home_score: game.winner === game.home_team ? Math.floor(Math.random() * 20) + 20 : Math.floor(Math.random() * 15) + 15,
        away_score: game.winner === game.away_team ? Math.floor(Math.random() * 20) + 20 : Math.floor(Math.random() * 15) + 15
      });
    });

    return {
      participant_id: participant.id,
      participant_name: participant.name,
      total_points: totalPoints,
      correct_picks: correctPicks,
      total_picks: totalPicks,
      game_points: gamePoints,
      picks: picks
    };
  }).sort((a, b) => b.total_points - a.total_points); // Sort by total points descending
};

// Dummy Leaderboard for Regular Season
export const DUMMY_LEADERBOARD_REGULAR = createDummyLeaderboard(DUMMY_PARTICIPANTS, DUMMY_GAMES, false);

// Dummy Leaderboard for Playoffs (defaults to week 1 - Wild Card)
export const getDummyLeaderboardPlayoffs = (week: number = 1) => {
  // Filter playoff games for the specified week
  const weekGames = DUMMY_PLAYOFF_GAMES.filter(g => g.week === week);
  
  // For rounds with few games (1-2), make all games final
  // For rounds with more games (3+), make at least 80% final
  const minFinalGames = Math.max(1, Math.ceil(weekGames.length * 0.8));
  
  // Add winners to games for simulation (simulate some games as final)
  const gamesWithWinners = weekGames.map((game, index) => ({
    ...game,
    status: index < minFinalGames ? 'final' : 'scheduled',
    winner: index < minFinalGames 
      ? (index % 2 === 0 ? game.home_team : game.away_team)
      : null
  }));
  debugLog('Games with winners:', gamesWithWinners);
  debugLog(`Week ${week}: ${minFinalGames} out of ${weekGames.length} games marked as final`);
  return createDummyLeaderboard(DUMMY_PARTICIPANTS, gamesWithWinners, true);
};

// Default dummy leaderboard for playoffs (week 1)
// export const DUMMY_LEADERBOARD_PLAYOFFS = getDummyLeaderboardPlayoffs(1);