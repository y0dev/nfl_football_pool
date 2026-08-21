import dotenv from 'dotenv';
import { debugInfo, debugWarn, debugLog, debugError } from './utils';
import { classify as classifyShared, weekDateRange as weekDateRangeShared, mapEspnEventsToGames, type ESPNScoreboardEvent } from './espn-scoreboard';
// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

interface TeamRecord {
  wins: number;
  losses: number;
  ties: number;
  home_wins?: number;
  home_losses?: number;
  home_ties?: number;
  road_wins?: number;
  road_losses?: number;
  road_ties?: number;
}

export interface NFLGame {
  id: string;
  date: string;
  time: string;
  home_team: string;
  away_team: string;
  home_score?: number;
  away_score?: number;
  status: 'scheduled' | 'live' | 'finished';
  week: number;
  season: number;
  season_type: number;
  home_team_id: string;
  away_team_id: string;
  home_team_record?: TeamRecord;
  away_team_record?: TeamRecord;
}

// Minimal shapes for ESPN's team-record and team-list responses — only the
// fields getTeamRecord/getAllTeamIds actually read; the full ESPN payloads
// are far larger and otherwise unused here.
interface EspnRecordStat {
  name?: string;
  value?: number;
}

interface EspnRecordItem {
  type?: string;
  stats?: EspnRecordStat[];
}

interface EspnTeamRecordResponse {
  team?: {
    abbreviation?: string;
    record?: {
      items?: EspnRecordItem[];
    };
  };
}

interface EspnTeamRef {
  id?: string;
  team?: { id?: string };
}

interface EspnLeagueTeams {
  teams?: EspnTeamRef[];
}

interface EspnTeamsListResponse {
  sports?: Array<{ leagues?: EspnLeagueTeams[] }>;
  leagues?: EspnLeagueTeams[] | EspnLeagueTeams;
}

interface NFLTeam {
  id: string;
  name: string;
  city: string;
  abbreviation: string;
  conference: string;
  division: string;
}

interface NFLWeek {
  id: string;
  week_number: number;
  season_year: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  game_count: number;
}

interface ESPNGame {
  id: string;
  date: string;
  name: string;
  shortName: string;
  season: {
    year: number;
    type: number;
  };
  week?: {
    number: number;
  };
  competitions: Array<{
    id: string;
    date: string;
    status: {
      type: {
        id: string;
        name: string;
        state: string;
        completed: boolean;
        description: string;
        detail: string;
        shortDetail: string;
      };
      period: number;
      clock: number;
      displayClock: string;
    };
    competitors: Array<{
      id: string;
      homeAway: string;
      team: {
        id: string;
        name: string;
        abbreviation: string;
        displayName: string;
        color: string;
        alternateColor: string;
        logo: string;
      };
      score: string;
      linescores?: Array<{
        value: number;
      }>;
      statistics: Array<{
        name: string;
        value: number;
      }>;
      records: Array<{ 
        name: string; 
        abbreviation: string;
        type: string;
        summary: string;
      }>;
    }>;
    venue: {
      id: string;
      fullName: string;
      address: {
        city: string;
        state: string;
      };
      capacity: number;
      indoor: boolean;
    };
  }>;
}

interface ProviderInfo {
  id: string;
  name: string;
  displayName: string;
  priority: number;
}

interface SeasonInfo {
  type: number;
  year: number;
}

interface ESPNScoreboardResponse {
  leagues: Array<{
    id: string;
    name: string;
    abbreviation: string;
    season: {
      year: number;
      type: number;
      startDate?: string;
      endDate?: string;
    };
    calendar: Array<{
      label: string;
      value: string;
      startDate: string;
      endDate: string;
      entries: Array<{
        label: string;
        value: string;
        startDate: string;
        endDate: string;
      }>;
    }>;
  }>;
  week?: { number: number };
  seaseon?: SeasonInfo;
  events: ESPNGame[];
  provider?: ProviderInfo;
}

class NFLAPIService {
  private baseUrl: string;
  private readonly WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  private readonly TARGET_TZ = 'America/Chicago';

  constructor() {
    this.baseUrl = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';
    debugInfo("ESPN API Base URL:", this.baseUrl);
  }

  // Utility: Add n days in UTC
  private addDaysUTC(d: Date, n: number): Date {
    return new Date(d.getTime() + n * 86400000);
  }

  // Convert any Date to a Date object that represents the same wall-clock time in TARGET_TZ.
  private toZonedDate(date: Date, tz: string = this.TARGET_TZ): Date {
    const parts = date.toLocaleString('en-US', { timeZone: tz });
    return new Date(parts);
  }

  // Format a Date into YYYYMMDD using the timezone-aware conversion
  private formatYYYYMMDDForTZ(dateObj: Date, tz: string = this.TARGET_TZ): string {
    const zoned = this.toZonedDate(dateObj, tz);
    const yyyy = zoned.getFullYear();
    const mm = String(zoned.getMonth() + 1).padStart(2, '0');
    const dd = String(zoned.getDate()).padStart(2, '0');
    return `${yyyy}${mm}${dd}`;
  }

  /**
   * Decide whether to use previous day or current day.
   * Rules: if (day is Friday OR Monday OR Tuesday) AND (hour < 12) in TARGET_TZ -> use previous day.
   * Otherwise use the same day.
   */
  private getAdjustedDateForFinalStatusFromDate(dateObj: Date): {
    status: "Previous" | "Now";
    adjustedDate: Date;
    originalDay: number;
    originalHour: number;
  } {
    const zoned = this.toZonedDate(dateObj, this.TARGET_TZ);
    const day = zoned.getDay();   // 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat
    const hour = zoned.getHours(); // 0-23 (target TZ)

    // If Fri (5), Mon (1), or Tue (2) and before 12:00 (noon) in target TZ => use previous calendar day
    if ((day === 5 || day === 1 || day === 2) && hour < 12) {
      const prevZoned = new Date(zoned);
      prevZoned.setDate(zoned.getDate() - 1);
      const adjustedDate = new Date(prevZoned.toLocaleString('en-US', { timeZone: this.TARGET_TZ }));
      return { status: "Previous", adjustedDate, originalDay: day, originalHour: hour };
    }

    // Otherwise return the "now" calendar date (zoned)
    const adjustedDate = new Date(zoned.toLocaleString('en-US', { timeZone: this.TARGET_TZ }));
    return { status: "Now", adjustedDate, originalDay: day, originalHour: hour };
  }

  // Helper functions for season/week classification
  private firstMondayInSeptemberUTC(year: number): Date {
    const d = new Date(Date.UTC(year, 8, 1));
    const dow = d.getUTCDay();
    const delta = (1 - dow + 7) % 7;
    d.setUTCDate(1 + delta);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  private kickoffThursdayUTC(seasonYear: number): Date {
    const laborDayMon = this.firstMondayInSeptemberUTC(seasonYear);
    const thurs = this.addDaysUTC(laborDayMon, 3);
    thurs.setUTCHours(0, 0, 0, 0);
    return thurs;
  }

  private offsetMinutesFromIso(ts: string): number {
    const m = String(ts).match(/([+-])(\d{2}):?(\d{2})$/);
    if (!m) return 0;
    const sign = m[1] === '-' ? -1 : 1;
    return sign * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
  }

  // Delegates to src/lib/espn-scoreboard.ts's classify() — the single
  // source of truth, shared with the client-side browser-fetch path (see
  // that file's header comment for why the browser fetches ESPN directly
  // at all).
  private classify(dateIsoStr: string): { year: number; season_type: number; week: number } {
    return classifyShared(dateIsoStr);
  }

  private async makeRequest(endpoint: string, params: Record<string, string> = {}) {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    debugLog(`📊 Constructed URL: ${this.baseUrl}${endpoint} with params:`, params);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
    debugLog(`Making request to ESPN API: ${url.toString()}`);


    try {
      debugInfo(`Making ESPN API request to: ${url.toString()}`);
      
      // ESPN's site API is unofficial and appears to silently return
      // `events: []` (a valid 200, no error) for requests that don't look
      // like they came from a browser hitting espn.com — confirmed this
      // happens specifically for requests from Vercel's serverless IPs,
      // even though the identical request succeeds from a residential IP.
      // Mimicking a real browser's headers (Referer/Origin/Accept-Language
      // plus a real Chrome UA instead of a custom one) to see if that's
      // enough to avoid whatever fingerprinting causes it.
      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate, br',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.espn.com/nfl/scoreboard',
          'Origin': 'https://www.espn.com',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        },
      });

      if (!response.ok) {
        throw new Error(`ESPN API request failed: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      debugInfo(`Response content-type: ${contentType}`);
      
      const data = await response.json();
      debugInfo(`ESPN API response received, events count: ${data.events?.length || 0}`);
      
      return data;
    } catch (error) {
      debugError('ESPN API request failed:', error);
      throw error;
    }
  }

  // Get current NFL season
  async getCurrentSeason(): Promise<number> {
    try {
      const data = await this.makeRequest('/scoreboard');
      const response = data as ESPNScoreboardResponse;
      
      if (response.leagues && response.leagues.length > 0) {
        return response.leagues[0].season.year;
      }
      
      return new Date().getFullYear();
    } catch (error) {
      debugError('Failed to get current season:', error);
      return new Date().getFullYear();
    }
  }

  // Get all teams for the current season
  async getTeams(season: number): Promise<NFLTeam[]> {
    try {
      // ESPN doesn't have a direct teams endpoint, so we'll get teams from games
      const data = await this.makeRequest('/scoreboard', { season: season.toString() });
      const response = data as ESPNScoreboardResponse;
      
      const teamsMap = new Map<string, NFLTeam>();
      
      response.events?.forEach((game: ESPNGame) => {
        game.competitions?.forEach((competition) => {
          competition.competitors?.forEach((competitor) => {
            const teamId = competitor.team.id;
            if (!teamsMap.has(teamId)) {
              const teamName = competitor.team.displayName;
              const nameParts = teamName.split(' ');
              const city = nameParts.slice(0, -1).join(' ');
              const abbreviation = nameParts[nameParts.length - 1];
              
              teamsMap.set(teamId, {
                id: teamId,
                name: teamName,
                city: city,
                abbreviation: abbreviation,
                conference: 'Unknown', // ESPN doesn't provide this in scoreboard
                division: 'Unknown',   // ESPN doesn't provide this in scoreboard
              });
            }
          });
        });
      });
      
      return Array.from(teamsMap.values());
    } catch (error) {
      debugError('Failed to get teams:', error);
      return [];
    }
  }

  // Compute the date range (YYYYMMDD) for a given season / season-type / week.
  // Returns { start, end } where start is Thursday (or Saturday for postseason) and
  // end is the last game day of that week. Delegates to
  // src/lib/espn-scoreboard.ts — see classify()'s comment above.
  weekDateRange(year: number, seasonType: number, week: number): { start: string; end: string } {
    return weekDateRangeShared(year, seasonType, week);
  }

  // Get all games for a full NFL week using the date-range format (YYYYMMDD-YYYYMMDD).
  // Use weekDateRange() to build start/end from season metadata.
  //
  // ESPN's scoreboard endpoint silently caps results at 100 events when no
  // `limit` is given — invisible for a single ~5-day week (never more than
  // ~16 games), but a wide multi-week range (e.g. scanning a full season)
  // gets truncated with no error, which then looks like missing games that
  // were never actually missing. Pass an explicit limit for any range wider
  // than one week; default stays unset so this can't change behavior for
  // every existing single-week caller.
  async getWeekGames(weekStart: string, weekEnd: string, limit?: number): Promise<NFLGame[]> {
    try {
      debugInfo(`Fetching games for ${weekStart}-${weekEnd}...`);

      const params: Record<string, string> = { dates: `${weekStart}-${weekEnd}` };
      if (limit !== undefined) params.limit = String(limit);
      const data = await this.makeRequest('/scoreboard', params) as ESPNScoreboardResponse;

      if (!data.events || data.events.length === 0) {
        debugWarn(`No events found for weekStart ${weekStart}`);
        return [];
      }

      debugInfo(`Found ${data.events.length} events for weekStart ${weekStart}`);

      // Delegates to src/lib/espn-scoreboard.ts — see classify()'s comment
      // above for why this mapping needs to exist outside this Node-only file.
      const games = mapEspnEventsToGames(data.events as unknown as ESPNScoreboardEvent[]);

      debugInfo(`Successfully converted ${games.length} games`);
      return games;
    } catch (error) {
      debugError(`❌ Error fetching games for weekStart ${weekStart}:`, error);
      return [];
    }
  }

  // Get games for a single calendar date (YYYYMMDD).
  // Use this when you only want one day's games (e.g. just Thursday night, just Sunday).
  // For a full week across Thu-Mon, use getWeekGames() with weekDateRange() instead.
  async getGamesByDate(date: string): Promise<NFLGame[]> {
    return this.getWeekGames(date, date);
  }

  // Same idea as getGamesForWeekContaining(), but for a single calendar
  // day — takes an ISO timestamp (matching the admin sync UI's date
  // picker) and converts it to the YYYYMMDD getGamesByDate() expects.
  async getGamesForDayContaining(timestamp?: string): Promise<NFLGame[]> {
    const ts = timestamp || new Date().toISOString();
    const d = new Date(ts);
    const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
    return this.getGamesByDate(ymd);
  }

  // Get every game in the NFL week (Thu-Mon, or the postseason's equivalent
  // window) that contains the given timestamp — classifies the timestamp
  // into a season/season_type/week, then fetches that whole week's range.
  // Use this for "sync the current week" flows; getGamesByDate/
  // getGamesWithDateEndpoint only return the single selected calendar day,
  // which misses every other game day in the week.
  async getGamesForWeekContaining(timestamp?: string): Promise<NFLGame[]> {
    const ts = timestamp || new Date().toISOString();
    const { year, season_type, week } = this.classify(ts);
    const { start, end } = this.weekDateRange(year, season_type, week);
    // weekDateRange()'s own window is Thu-Mon (5 days), but consecutive
    // weeks are 7 days apart — leaving Tue/Wed structurally uncovered by
    // every week's fetch. Almost always empty, but the rare Tue/Wed game
    // (e.g. a Thanksgiving-eve Wednesday-night game) would otherwise never
    // appear in ANY week's preview, with no way to sync it at all. Pad the
    // fetch (not weekDateRange() itself, which other callers rely on for
    // the canonical Thu-Mon label) back 2 days to close that gap; harmless
    // for every other week since games are essentially never scheduled
    // Tue/Wed, and any real overlap with the previous week's own range
    // just gets grouped by that game's own reported week field downstream.
    const paddedStartDate = this.addDaysUTC(new Date(`${start.slice(0, 4)}-${start.slice(4, 6)}-${start.slice(6, 8)}T00:00:00Z`), -2);
    const paddedStart = `${paddedStartDate.getUTCFullYear()}${String(paddedStartDate.getUTCMonth() + 1).padStart(2, '0')}${String(paddedStartDate.getUTCDate()).padStart(2, '0')}`;
    debugInfo(`Fetching full week for timestamp ${ts}: season ${year}, type ${season_type}, week ${week} (${paddedStart}-${end}, padded from ${start})`);
    return this.getWeekGames(paddedStart, end);
  }

  // Helper function to parse W-L-T from summary string (e.g., "3-5-1" or "2-1-1")
  private parseRecordSummary(summary: string): { wins: number; losses: number; ties: number } {
    const parts = summary.split('-');
    const wins = parseInt(parts[0] || '0', 10) || 0;
    const losses = parseInt(parts[1] || '0', 10) || 0;
    const ties = parts[2] ? parseInt(parts[2] || '0', 10) || 0 : 0;
    return { wins, losses, ties };
  }

  // Helper function to extract team records from ESPN competitor records
  private extractTeamRecords(competitor: { records?: Array<{ type: string; summary: string }> }): TeamRecord {
    const record: TeamRecord = { wins: 0, losses: 0, ties: 0 };
    
    if (!competitor.records || !Array.isArray(competitor.records)) {
      return record;
    }

    competitor.records.forEach((rec) => {
      const parsed = this.parseRecordSummary(rec.summary);
      
      if (rec.type === 'total' || rec.type === 'overall') {
        record.wins = parsed.wins;
        record.losses = parsed.losses;
        record.ties = parsed.ties;
      } else if (rec.type === 'home') {
        record.home_wins = parsed.wins;
        record.home_losses = parsed.losses;
        record.home_ties = parsed.ties;
      } else if (rec.type === 'road' || rec.type === 'away') {
        record.road_wins = parsed.wins;
        record.road_losses = parsed.losses;
        record.road_ties = parsed.ties;
      }
    });

    return record;
  }

  // Get games using ESPN API with date-based endpoint
  async getGamesWithDateEndpoint(timestamp?: string): Promise<NFLGame[]> {
    try {
      // Use provided timestamp or current moment
      const ts = timestamp || new Date().toISOString();
      debugInfo(`Fetching games with date endpoint for timestamp: ${ts}`);
      
      // Get season/week info
      const res = this.classify(ts);
      
      // Extract the date portion directly from the ISO string to avoid timezone conversion issues
      // The user selects a specific calendar date, so we should use that date as-is
      const dateObj = new Date(ts);
      // Use UTC date components to match the selected calendar date
      const year = dateObj.getUTCFullYear();
      const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getUTCDate()).padStart(2, '0');
      const formattedDate = `${year}${month}${day}`;
      
      // Build final endpoint (ESPN with selected date)
      const endpoint = `/scoreboard?dates=${formattedDate}`;
      
      debugInfo(`Using ESPN endpoint: ${endpoint}`);
      debugInfo(`📅 Date info:`, {
        originalTimestamp: ts,
        formattedDate,
        seasonInfo: res
      });
      
      const data = await this.makeRequest(endpoint);
      const response = data as ESPNScoreboardResponse;
      
      if (!response.events || response.events.length === 0) {
        debugInfo(`⚠️  No events found for date ${formattedDate}`);
        return [];
      }
      
      debugInfo(`Found ${response.events.length} events for date ${formattedDate}`);
      
      // Convert ESPN games to our format
      const games: NFLGame[] = response.events.map((game: ESPNGame) => {
        const homeTeam = game.competitions[0]?.competitors.find(c => c.homeAway === 'home');
        const awayTeam = game.competitions[0]?.competitors.find(c => c.homeAway === 'away');
        
        if (!homeTeam || !awayTeam) {
          debugWarn(`⚠️  Missing team data for game ${game.id}`);
          return null;
        }
        
        const status = game.competitions[0]?.status?.type?.state || 'scheduled';
        const gameStatus = status === 'post' ? 'finished' : 
                          status === 'in' ? 'live' : 'scheduled';
        
        // Extract team records from ESPN API
        const homeTeamRecord = this.extractTeamRecords(homeTeam);
        const awayTeamRecord = this.extractTeamRecords(awayTeam);
        
        return {
          id: game.id,
          date: game.date,
          time: game.date, // ESPN provides ISO date string
          home_team: homeTeam.team.displayName,
          away_team: awayTeam.team.displayName,
          home_score: homeTeam.score ? parseInt(homeTeam.score) : undefined,
          away_score: awayTeam.score ? parseInt(awayTeam.score) : undefined,
          status: gameStatus,
          week: game.week?.number || res.week,
          season: game.season?.year || res.year,
          season_type: game.season?.type || res.season_type,
          home_team_id: homeTeam.team.abbreviation,
          away_team_id: awayTeam.team.abbreviation,
          home_team_record: homeTeamRecord,
          away_team_record: awayTeamRecord
        };
      }).filter(Boolean) as NFLGame[];
      
      debugInfo(`Successfully converted ${games.length} games`);
      return games;
      
    } catch (error) {
      debugError(`❌ Error fetching games with date endpoint:`, error);
      return [];
    }
  }

  // Get all weeks for a season
  async getSeasonWeeks(season: number): Promise<NFLWeek[]> {
    try {
      const data = await this.makeRequest('/scoreboard', { season: season.toString() });
      const response = data as ESPNScoreboardResponse;
      
      if (!response.leagues || response.leagues.length === 0) {
        return [];
      }
      
      const league = response.leagues[0];
      const regularSeason = league.calendar?.find(cal => cal.label === 'Regular Season');
      
      if (!regularSeason) {
        return [];
      }
      
      return regularSeason.entries?.map((entry, index) => ({
        id: entry.value,
        week_number: index + 1,
        season_year: season,
        start_date: entry.startDate,
        end_date: entry.endDate,
        is_active: false, // Would need logic to determine if current week
        game_count: 0, // Would need to count games for this week
      })) || [];
    } catch (error) {
      debugError('Failed to get season weeks:', error);
      return [];
    }
  }

  // Get current week
  async getCurrentWeek(season: number): Promise<NFLWeek | null> {
    try {
      const data = await this.makeRequest('/scoreboard', { season: season.toString() });
      const response = data as ESPNScoreboardResponse;
      
      if (!response.leagues || response.leagues.length === 0) {
        return null;
      }
      
      const league = response.leagues[0];
      const regularSeason = league.calendar?.find(cal => cal.label === 'Regular Season');
      
      if (!regularSeason) {
        return null;
      }
      
      const now = new Date();
      const currentWeekEntry = regularSeason.entries?.find(entry => {
        const startDate = new Date(entry.startDate);
        const endDate = new Date(entry.endDate);
        return now >= startDate && now <= endDate;
      });
      
      if (currentWeekEntry) {
        const weekNumber = regularSeason.entries?.indexOf(currentWeekEntry) + 1 || 1;
        return {
          id: currentWeekEntry.value,
          week_number: weekNumber,
          season_year: season,
          start_date: currentWeekEntry.startDate,
          end_date: currentWeekEntry.endDate,
          is_active: true,
          game_count: 0,
        };
      }
      
      return null;
    } catch (error) {
      debugError('Failed to get current week:', error);
      return null;
    }
  }

  // Get playoff games
  async getPlayoffGames(season: number): Promise<NFLGame[]> {
    try {
      const data = await this.makeRequest('/scoreboard', { 
        season: season.toString(),
        postseason: 'true'
      });
      const response = data as ESPNScoreboardResponse;
      
      return (response.events || []).map((game: ESPNGame) => {
        const competition = game.competitions?.[0];
        if (!competition) return null;
        
        const homeTeam = competition.competitors?.find(c => c.homeAway === 'home');
        const awayTeam = competition.competitors?.find(c => c.homeAway === 'away');
        
        if (!homeTeam || !awayTeam) return null;
        
        return {
          id: game.id,
          date: competition.date,
          time: competition.date,
          home_team: homeTeam.team.displayName,
          away_team: awayTeam.team.displayName,
          home_score: homeTeam.score ? parseInt(homeTeam.score) : undefined,
          away_score: awayTeam.score ? parseInt(awayTeam.score) : undefined,
          status: this.mapGameStatus(competition.status.type.state),
          week: this.mapPlayoffRoundToWeek(game.name),
          season: season,
          home_team_id: homeTeam.team.id,
          away_team_id: awayTeam.team.id,
        };
      }).filter(Boolean) as NFLGame[];
    } catch (error) {
      debugError('Failed to get playoff games:', error);
      return [];
    }
  }

  // Helper method to map ESPN status to our status
  private mapGameStatus(espnStatus: string): 'scheduled' | 'live' | 'finished' {
    switch (espnStatus) {
      case 'pre':
        return 'scheduled';
      case 'in':
        return 'live';
      case 'post':
        return 'finished';
      default:
        return 'scheduled';
    }
  }

  // Helper method to map playoff rounds to week numbers
  private mapPlayoffRoundToWeek(gameName: string): number {
    if (gameName.includes('Wild Card')) return 19;
    if (gameName.includes('Divisional')) return 20;
    if (gameName.includes('Conference')) return 21;
    if (gameName.includes('Super Bowl')) return 22;
    return 19; // Default to Wild Card
  }

  // Update game scores (for admin use)
  async updateGameScore(gameId: string, homeScore: number, awayScore: number): Promise<boolean> {
    // Note: ESPN API is read-only, so this would need to be handled in the database
    debugInfo(`Updating game ${gameId}: ${awayScore} - ${homeScore}`);
    return true;
  }

  // Get standings
  async getStandings(season: number): Promise<unknown[]> {
    try {
      const data = await this.makeRequest('/standings', { season: season.toString() });
      return data.standings || [];
    } catch (error) {
      debugError('Failed to get standings:', error);
      return [];
    }
  }

  async getTeamESPNTeamId(): Promise<unknown[]> {
    try {
      const data = await this.makeRequest('/teams');
      return data || [];
    } catch (error) {
      debugError('Failed to get team ESPN team ID:', error);
      return [];
    }
  }

  // Get team record from ESPN API
  async getTeamRecord(teamId: string): Promise<{
    teamId: string;
    abbreviation: string;
    wins: number;
    losses: number;
    ties: number;
    home_wins?: number;
    home_losses?: number;
    home_ties?: number;
    road_wins?: number;
    road_losses?: number;
    road_ties?: number;
  } | null> {
    try {
      const data = await this.makeRequest(`/teams/${teamId}`) as EspnTeamRecordResponse;
      const team = data?.team;
      // debugInfo('team record', team);
      if (!team || !team.record) {
        return null;
      }

      const record = team.record;
      const abbreviation = team.abbreviation || '';

      // Parse overall record
      const totalRecord = record.items?.find((item) => item.type === 'total');
      const homeRecord = record.items?.find((item) => item.type === 'home');
      const roadRecord = record.items?.find((item) => item.type === 'road');

      const wins = totalRecord?.stats?.find((stat) => stat.name === 'wins')?.value || 0;
      const losses = totalRecord?.stats?.find((stat) => stat.name === 'losses')?.value || 0;
      const ties = totalRecord?.stats?.find((stat) => stat.name === 'ties')?.value || 0;

      const home_wins = homeRecord?.stats?.find((stat) => stat.name === 'wins')?.value;
      const home_losses = homeRecord?.stats?.find((stat) => stat.name === 'losses')?.value;
      const home_ties = homeRecord?.stats?.find((stat) => stat.name === 'ties')?.value;

      const road_wins = roadRecord?.stats?.find((stat) => stat.name === 'wins')?.value;
      const road_losses = roadRecord?.stats?.find((stat) => stat.name === 'losses')?.value;
      const road_ties = roadRecord?.stats?.find((stat) => stat.name === 'ties')?.value;

      return {
        teamId,
        abbreviation,
        wins,
        losses,
        ties,
        home_wins,
        home_losses,
        home_ties,
        road_wins,
        road_losses,
        road_ties
      };
    } catch (error) {
      debugError(`Failed to get team record for team ${teamId}:`, error);
      return null;
    }
  }

  // Get raw ESPN scoreboard envelope (season metadata + current-week games)
  async getScoreboard(params?: Record<string, string>): Promise<ESPNScoreboardResponse> {
    return this.makeRequest('/scoreboard', params ?? {}) as Promise<ESPNScoreboardResponse>;
  }

  // Get all team IDs from standings
  async getAllTeamIds(): Promise<string[]> {
    try {
      const data = await this.getTeamESPNTeamId() as unknown as EspnTeamsListResponse;
      debugInfo('data', data);

      const teamIds: string[] = [];

      // Handle different possible structures
      if (data?.sports && Array.isArray(data.sports)) {
        data.sports.forEach((sport) => {
          if (sport.leagues && Array.isArray(sport.leagues)) {
            sport.leagues.forEach((league) => {
              if (league.teams && Array.isArray(league.teams)) {
                league.teams.forEach((team) => {
                  if (team.team?.id) {
                    teamIds.push(team.team.id);
                  } else if (team.id) {
                    teamIds.push(team.id);
                  }
                });
              }
            });
          }
        });
      } else if (data?.leagues && Array.isArray(data.leagues)) {
        data.leagues.forEach((league) => {
          if (league.teams && Array.isArray(league.teams)) {
            league.teams.forEach((team) => {
              if (team.team?.id) {
                teamIds.push(team.team.id);
              } else if (team.id) {
                teamIds.push(team.id);
              }
            });
          }
        });
      } else if (data?.leagues && !Array.isArray(data.leagues) && data.leagues.teams && Array.isArray(data.leagues.teams)) {
        data.leagues.teams.forEach((team) => {
          if (team.team?.id) {
            teamIds.push(team.team.id);
          } else if (team.id) {
            teamIds.push(team.id);
          }
        });
      }
      
      debugInfo('Extracted team IDs:', teamIds);
      return teamIds;
    } catch (error) {
      debugError('Failed to get team IDs from standings:', error);
      return [];
    }
  }
}

// Export singleton instance
export const nflAPI = new NFLAPIService(); 