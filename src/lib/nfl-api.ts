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

  constructor() {
    this.baseUrl = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';
    console.log("ESPN API Base URL:", this.baseUrl);
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

  // Get live game updates
  async getLiveGames(season: number): Promise<NFLGame[]> {
    try {
      const data = await this.makeRequest('/scoreboard', { 
        season: season.toString(),
        live: 'true'
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
          week: 0, // Would need to determine from game data
          season: season,
          home_team_id: homeTeam.team.id,
          away_team_id: awayTeam.team.id,
        };
      }).filter(Boolean) as NFLGame[];
    } catch (error) {
      console.error('Failed to get live games:', error);
      return [];
    }
  }
}

// Export singleton instance
export const nflAPI = new NFLAPIService(); 