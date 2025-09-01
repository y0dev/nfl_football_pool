import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

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
          return `/admin/pool/${poolId}`;
        }
        return "/admin/pool/[id]";
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

export function getNFLTeamName(abbreviation: string): string {
  const teamNames: Record<string, string> = {
    'ARI': 'Arizona Cardinals',
    'ATL': 'Atlanta Falcons',
    'BAL': 'Baltimore Ravens',
    'BUF': 'Buffalo Bills',
    'CAR': 'Carolina Panthers',
    'CHI': 'Chicago Bears',
    'CIN': 'Cincinnati Bengals',
    'CLE': 'Cleveland Browns',
    'DAL': 'Dallas Cowboys',
    'DEN': 'Denver Broncos',
    'DET': 'Detroit Lions',
    'GB': 'Green Bay Packers',
    'HOU': 'Houston Texans',
    'IND': 'Indianapolis Colts',
    'JAX': 'Jacksonville Jaguars',
    'KC': 'Kansas City Chiefs',
    'LAC': 'Los Angeles Chargers',
    'LAR': 'Los Angeles Rams',
    'LV': 'Las Vegas Raiders',
    'MIA': 'Miami Dolphins',
    'MIN': 'Minnesota Vikings',
    'NE': 'New England Patriots',
    'NO': 'New Orleans Saints',
    'NYG': 'New York Giants',
    'NYJ': 'New York Jets',
    'PHI': 'Philadelphia Eagles',
    'PIT': 'Pittsburgh Steelers',
    'SEA': 'Seattle Seahawks',
    'SF': 'San Francisco 49ers',
    'TB': 'Tampa Bay Buccaneers',
    'TEN': 'Tennessee Titans',
    'WAS': 'Washington Commanders'
  }
  return teamNames[abbreviation] || abbreviation
}

export function getTeamAbbreviation(fullName: string): string {
  const teamAbbreviations: Record<string, string> = {
    'New England Patriots': 'NE',
    'Buffalo Bills': 'BUF',
    'New York Jets': 'NYJ',
    'Miami Dolphins': 'MIA',
    'Baltimore Ravens': 'BAL',
    'Cincinnati Bengals': 'CIN',
    'Cleveland Browns': 'CLE',
    'Pittsburgh Steelers': 'PIT',
    'Houston Texans': 'HOU',
    'Indianapolis Colts': 'IND',
    'Jacksonville Jaguars': 'JAX',
    'Tennessee Titans': 'TEN',
    'Kansas City Chiefs': 'KC',
    'Las Vegas Raiders': 'LV',
    'Los Angeles Chargers': 'LAC',
    'Denver Broncos': 'DEN',
    'Dallas Cowboys': 'DAL',
    'Philadelphia Eagles': 'PHI',
    'New York Giants': 'NYG',
    'Washington Commanders': 'WAS',
    'Green Bay Packers': 'GB',
    'Minnesota Vikings': 'MIN',
    'Chicago Bears': 'CHI',
    'Detroit Lions': 'DET',
    'New Orleans Saints': 'NO',
    'Tampa Bay Buccaneers': 'TB',
    'Atlanta Falcons': 'ATL',
    'Carolina Panthers': 'CAR',
    'San Francisco 49ers': 'SF',
    'Seattle Seahawks': 'SEA',
    'Los Angeles Rams': 'LAR',
    'Arizona Cardinals': 'ARI'
  }
  return teamAbbreviations[fullName] || fullName.split(' ').map(word => word[0]).join('').toUpperCase();
}

/**
 * Get short team name for mobile display
 * Returns a shortened version of the team name suitable for smaller screens
 */
export function getShortTeamName(teamName: string): string {
  const teamNameMap: Record<string, string> = {
    'New England Patriots': 'NE Patriots',
    'New York Jets': 'NY Jets',
    'New York Giants': 'NY Giants',
    'Buffalo Bills': 'Buf Bills',
    'Miami Dolphins': 'Mia Dolphins',
    'Baltimore Ravens': 'Bal Ravens',
    'Cincinnati Bengals': 'Cin Bengals',
    'Cleveland Browns': 'Cle Browns',
    'Pittsburgh Steelers': 'Pit Steelers',
    'Houston Texans': 'Hou Texans',
    'Indianapolis Colts': 'Ind Colts',
    'Jacksonville Jaguars': 'Jax Jaguars',
    'Tennessee Titans': 'Ten Titans',
    'Denver Broncos': 'Den Broncos',
    'Kansas City Chiefs': 'Kan Chiefs',
    'Las Vegas Raiders': 'LV Raiders',
    'Los Angeles Chargers': 'LA Chargers',
    'Dallas Cowboys': 'Dal Cowboys',
    'Philadelphia Eagles': 'Phi Eagles',
    'Washington Commanders': 'Was Commanders',
    'Chicago Bears': 'Chi Bears',
    'Detroit Lions': 'Det Lions',
    'Green Bay Packers': 'GB Packers',
    'Minnesota Vikings': 'Min Vikings',
    'Atlanta Falcons': 'Atl Falcons',
    'Carolina Panthers': 'Car Panthers',
    'New Orleans Saints': 'NO Saints',
    'Tampa Bay Buccaneers': 'TB Buccaneers',
    'Arizona Cardinals': 'Ari Cardinals',
    'Los Angeles Rams': 'LA Rams',
    'San Francisco 49ers': 'SF 49ers',
    'Seattle Seahawks': 'Sea Seahawks'
  };
  return teamNameMap[teamName] || teamName;
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