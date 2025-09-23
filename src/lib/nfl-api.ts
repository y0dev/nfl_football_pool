import dotenv from 'dotenv';
// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

interface NFLGame {
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

interface ESPNScoreboardResponse {
  leagues: Array<{
    id: string;
    name: string;
    abbreviation: string;
    season: {
      year: number;
      type: number;
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
  events: ESPNGame[];
}

class NFLAPIService {
  private baseUrl: string;
  private readonly WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  private readonly TARGET_TZ = 'America/Chicago';

  constructor() {
    this.baseUrl = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';
    console.log("ESPN API Base URL:", this.baseUrl);
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

  private classify(dateIsoStr: string): { year: number; season_type: number; week: number } {
    const d = new Date(dateIsoStr);
    const yUTC = d.getUTCFullYear();
    const mUTC = d.getUTCMonth();

    const seasonYear = (mUTC >= 8) ? yUTC : (mUTC <= 1 ? yUTC - 1 : yUTC);
    const week1UTC = this.kickoffThursdayUTC(seasonYear);
    const postStartUTC = this.addDaysUTC(week1UTC, 18 * 7);
    const preseasonEnd = new Date(Date.UTC(seasonYear, 7, 25, 23, 59, 59)); // Aug 25 UTC

    const offMin = this.offsetMinutesFromIso(dateIsoStr);
    const localNow = d.getTime() + offMin * 60000;
    const localWeek1 = week1UTC.getTime() + offMin * 60000;
    const localPostStart = postStartUTC.getTime() + offMin * 60000;
    const localPreEnd = preseasonEnd.getTime() + offMin * 60000;

    let season_type, week;
    if (localNow <= localPreEnd) {
      season_type = 1; // PRE
      week = Math.ceil((d.getUTCDate()) / 7);
    } else if (localNow < localPostStart) {
      season_type = 2; // REG
      week = Math.floor((localNow - localWeek1) / this.WEEK_MS) + 1;
    } else {
      season_type = 3; // POST
      week = Math.floor((localNow - localPostStart) / this.WEEK_MS) + 1;
    }
    if (week < 1) week = 1;
    return { year: seasonYear, season_type, week };
  }

  private async makeRequest(endpoint: string, params: Record<string, string> = {}) {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    try {
      console.log(`🌐 Making ESPN API request to: ${url.toString()}`);
      
      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate, br',
          'User-Agent': 'NFL-Confidence-Pool/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`ESPN API request failed: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      console.log(`📄 Response content-type: ${contentType}`);
      
      const data = await response.json();
      console.log(`✅ ESPN API response received, events count: ${data.events?.length || 0}`);
      
      return data;
    } catch (error) {
      console.error('ESPN API request failed:', error);
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
      console.error('Failed to get current season:', error);
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
      console.error('Failed to get teams:', error);
      return [];
    }
  }

  // Get games for a specific week
  async getWeekGames(season: number,seasontype: number, week: number): Promise<NFLGame[]> {
    try {
      console.log(`📋 Fetching games for season ${season}, week ${week}...`);
      
      // ESPN API uses year, week, and seasontype parameters
      // seasontype: 1=preseason, 2=regular season, 3=postseason
      const params: Record<string, string> = {
        year: season.toString(),
        week: week.toString(),
        seasontype: seasontype.toString() // Default to regular season
      };
      
      const data = await this.makeRequest('/scoreboard', params);
      const response = data as ESPNScoreboardResponse;
      
      if (!response.events || response.events.length === 0) {
        console.log(`⚠️  No events found for season ${season}, week ${week}, seasontype ${params.seasontype}`);
        return [];
      }
      
      console.log(`📊 Found ${response.events.length} events for season ${season}, week ${week}`);
      
      // Convert ESPN games to our format
      const games: NFLGame[] = response.events.map((game: ESPNGame) => {
        const homeTeam = game.competitions[0]?.competitors.find(c => c.homeAway === 'home');
        const awayTeam = game.competitions[0]?.competitors.find(c => c.homeAway === 'away');
        
        if (!homeTeam || !awayTeam) {
          console.warn(`⚠️  Missing team data for game ${game.id}`);
          return null;
        }
        
        const status = game.competitions[0]?.status?.type?.state || 'scheduled';
        const gameStatus = status === 'post' ? 'finished' : 
                          status === 'in' ? 'live' : 'scheduled';
        
        return {
          id: game.id,
          date: game.date,
          time: game.date, // ESPN provides ISO date string
          home_team: homeTeam.team.displayName,
          away_team: awayTeam.team.displayName,
          home_score: homeTeam.score ? parseInt(homeTeam.score) : undefined,
          away_score: awayTeam.score ? parseInt(awayTeam.score) : undefined,
          status: gameStatus,
          week: week,
          season: season,
          season_type: seasontype, // Add season_type here
          home_team_id: homeTeam.team.abbreviation,
          away_team_id: awayTeam.team.abbreviation
        };
      }).filter(Boolean) as NFLGame[];
      
      console.log(`✅ Successfully converted ${games.length} games`);
      return games;
      
    } catch (error) {
      console.error(`❌ Error fetching games for season ${season}, week ${week}:`, error);
      return [];
    }
  }

  // Get games using ESPN API with date-based endpoint
  async getGamesWithDateEndpoint(timestamp?: string): Promise<NFLGame[]> {
    try {
      // Use provided timestamp or current moment
      const ts = timestamp || new Date().toISOString();
      console.log(`📋 Fetching games with date endpoint for timestamp: ${ts}`);
      
      // Get season/week info
      const res = this.classify(ts);
      
      // Decide adjusted date based on the timestamp with target timezone semantics
      const baseDate = new Date(ts);
      const adjustedInfo = this.getAdjustedDateForFinalStatusFromDate(baseDate);
      
      // Build formatted date for ESPN URL (in TARGET_TZ calendar)
      const formattedAdjustedDate = this.formatYYYYMMDDForTZ(adjustedInfo.adjustedDate, this.TARGET_TZ);
      
      // Build final endpoint (ESPN with adjusted date)
      const endpoint = `/scoreboard?dates=${formattedAdjustedDate}`;
      
      console.log(`🌐 Using ESPN endpoint: ${endpoint}`);
      console.log(`📅 Adjusted date info:`, {
        status: adjustedInfo.status,
        originalDay: adjustedInfo.originalDay,
        originalHour: adjustedInfo.originalHour,
        formattedAdjustedDate,
        seasonInfo: res
      });
      
      const data = await this.makeRequest(endpoint);
      const response = data as ESPNScoreboardResponse;
      
      if (!response.events || response.events.length === 0) {
        console.log(`⚠️  No events found for date ${formattedAdjustedDate}`);
        return [];
      }
      
      console.log(`📊 Found ${response.events.length} events for date ${formattedAdjustedDate}`);
      
      // Convert ESPN games to our format
      const games: NFLGame[] = response.events.map((game: ESPNGame) => {
        const homeTeam = game.competitions[0]?.competitors.find(c => c.homeAway === 'home');
        const awayTeam = game.competitions[0]?.competitors.find(c => c.homeAway === 'away');
        
        if (!homeTeam || !awayTeam) {
          console.warn(`⚠️  Missing team data for game ${game.id}`);
          return null;
        }
        
        const status = game.competitions[0]?.status?.type?.state || 'scheduled';
        const gameStatus = status === 'post' ? 'finished' : 
                          status === 'in' ? 'live' : 'scheduled';
        
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
          away_team_id: awayTeam.team.abbreviation
        };
      }).filter(Boolean) as NFLGame[];
      
      console.log(`✅ Successfully converted ${games.length} games`);
      return games;
      
    } catch (error) {
      console.error(`❌ Error fetching games with date endpoint:`, error);
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
      console.error('Failed to get season weeks:', error);
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
      console.error('Failed to get current week:', error);
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
      console.error('Failed to get playoff games:', error);
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
    console.log(`Updating game ${gameId}: ${awayScore} - ${homeScore}`);
    return true;
  }

  // Get standings
  async getStandings(season: number): Promise<any[]> {
    try {
      const data = await this.makeRequest('/standings', { season: season.toString() });
      return data.standings || [];
    } catch (error) {
      console.error('Failed to get standings:', error);
      return [];
    }
  }
}

// Export singleton instance
export const nflAPI = new NFLAPIService(); 