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

// Pool Configuration
export const DEFAULT_POOL_SEASON = 2025;
export const DEFAULT_POOL_IS_ACTIVE = true;
export const DEFAULT_TIE_BREAKER_METHOD = 'confidence_points';

// Game Configuration
export const MAX_WEEKS_PRESEASON = 4;
export const MAX_WEEKS_REGULAR_SEASON = 18;
export const MAX_WEEKS_POSTSEASON = 5;
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