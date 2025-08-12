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

class NFLAPIService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.API_SPORTS_KEY || '';
    this.baseUrl = 'https://v3.football.api-sports.io';
    console.log("Base URL", this.baseUrl);
    console.log("API Key", this.apiKey);
  }

  private async makeRequest(endpoint: string, params: Record<string, string> = {}) {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    try {
      const response = await fetch(url.toString(), {
        headers: {
          'x-rapidapi-host': 'v3.football.api-sports.io',
          'x-rapidapi-key': this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('NFL API request failed:', error);
      throw error;
    }
  }

  // Get current NFL season
  async getCurrentSeason(): Promise<number> {
    try {
      const data = await this.makeRequest('/seasons', { league: '1', country: 'USA' });
      const currentYear = new Date().getFullYear();
      const seasons = data.response || [];
      
      // Find the most recent season
      const currentSeason = seasons
        .filter((season: any) => season.year <= currentYear)
        .sort((a: any, b: any) => b.year - a.year)[0];
      
      return currentSeason?.year || currentYear;
    } catch (error) {
      console.error('Failed to get current season:', error);
      return new Date().getFullYear();
    }
  }

  // Get all teams for the current season
  async getTeams(season: number): Promise<NFLTeam[]> {
    try {
      const data = await this.makeRequest('/teams', { 
        league: '1', 
        country: 'USA',
        season: season.toString()
      });
      
      return (data.response || []).map((team: any) => ({
        id: team.team.id.toString(),
        name: team.team.name,
        city: team.team.name.split(' ').slice(0, -1).join(' '),
        abbreviation: team.team.code || team.team.name.split(' ').pop() || '',
        conference: team.team.conference || 'Unknown',
        division: team.team.division || 'Unknown',
      }));
    } catch (error) {
      console.error('Failed to get teams:', error);
      return [];
    }
  }

  // Get games for a specific week
  async getWeekGames(season: number, week: number): Promise<NFLGame[]> {
    try {
      const data = await this.makeRequest('/fixtures', {
        league: '1',
        country: 'USA',
        season: season.toString(),
        round: `Regular Season - ${week.toString().padStart(2, '0')}`
      });

      return (data.response || []).map((game: any) => ({
        id: game.fixture.id.toString(),
        date: game.fixture.date,
        time: game.fixture.date,
        home_team: game.teams.home.name,
        away_team: game.teams.away.name,
        home_score: game.goals.home,
        away_score: game.goals.away,
        status: this.mapGameStatus(game.fixture.status.short),
        week: week,
        season: season,
        home_team_id: game.teams.home.id.toString(),
        away_team_id: game.teams.away.id.toString(),
      }));
    } catch (error) {
      console.error(`Failed to get games for week ${week}:`, error);
      return [];
    }
  }

  // Get all weeks for a season
  async getSeasonWeeks(season: number): Promise<NFLWeek[]> {
    try {
      const data = await this.makeRequest('/fixtures/rounds', {
        league: '1',
        country: 'USA',
        season: season.toString()
      });

      return (data.response || []).map((round: any, index: number) => ({
        id: round.toString(),
        week_number: index + 1,
        season_year: season,
        start_date: '', // Would need additional API call to get exact dates
        end_date: '',
        is_active: false, // Would need logic to determine if current week
        game_count: 0, // Would need to count games for this round
      }));
    } catch (error) {
      console.error('Failed to get season weeks:', error);
      return [];
    }
  }

  // Get current week
  async getCurrentWeek(season: number): Promise<NFLWeek | null> {
    try {
      const weeks = await this.getSeasonWeeks(season);
      const now = new Date();
      
      // For now, return a simple current week calculation
      // In a real implementation, you'd compare with actual game dates
      const currentWeek = {
        id: 'current',
        week_number: Math.min(Math.floor((now.getTime() - new Date(season, 8, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1, 18),
        season_year: season,
        start_date: '',
        end_date: '',
        is_active: true,
        game_count: 0,
      };

      return currentWeek;
    } catch (error) {
      console.error('Failed to get current week:', error);
      return null;
    }
  }

  // Get playoff games
  async getPlayoffGames(season: number): Promise<NFLGame[]> {
    try {
      const playoffRounds = [
        'Wild Card',
        'Divisional',
        'Conference Finals',
        'Super Bowl'
      ];

      let allPlayoffGames: NFLGame[] = [];

      for (const round of playoffRounds) {
        const data = await this.makeRequest('/fixtures', {
          league: '1',
          country: 'USA',
          season: season.toString(),
          round: round
        });

        const games = (data.response || []).map((game: any) => ({
          id: game.fixture.id.toString(),
          date: game.fixture.date,
          time: game.fixture.date,
          home_team: game.teams.home.name,
          away_team: game.teams.away.name,
          home_score: game.goals.home,
          away_score: game.goals.away,
          status: this.mapGameStatus(game.fixture.status.short),
          week: this.mapPlayoffRoundToWeek(round),
          season: season,
          home_team_id: game.teams.home.id.toString(),
          away_team_id: game.teams.away.id.toString(),
        }));

        allPlayoffGames = [...allPlayoffGames, ...games];
      }

      return allPlayoffGames;
    } catch (error) {
      console.error('Failed to get playoff games:', error);
      return [];
    }
  }

  // Helper method to map API status to our status
  private mapGameStatus(apiStatus: string): 'scheduled' | 'live' | 'finished' {
    switch (apiStatus) {
      case 'NS':
        return 'scheduled';
      case '1H':
      case '2H':
      case 'HT':
        return 'live';
      case 'FT':
      case 'AET':
      case 'PEN':
        return 'finished';
      default:
        return 'scheduled';
    }
  }

  // Helper method to map playoff rounds to week numbers
  private mapPlayoffRoundToWeek(round: string): number {
    switch (round) {
      case 'Wild Card':
        return 19;
      case 'Divisional':
        return 20;
      case 'Conference Finals':
        return 21;
      case 'Super Bowl':
        return 22;
      default:
        return 19;
    }
  }

  // Update game scores (for admin use)
  async updateGameScore(gameId: string, homeScore: number, awayScore: number): Promise<boolean> {
    // Note: This would require a different API endpoint or database update
    // For now, we'll just log the update
    console.log(`Updating game ${gameId}: ${awayScore} - ${homeScore}`);
    return true;
  }

  // Get standings
  async getStandings(season: number): Promise<any[]> {
    try {
      const data = await this.makeRequest('/standings', {
        league: '1',
        country: 'USA',
        season: season.toString()
      });

      return data.response || [];
    } catch (error) {
      console.error('Failed to get standings:', error);
      return [];
    }
  }
}

// Export singleton instance
export const nflAPI = new NFLAPIService(); 