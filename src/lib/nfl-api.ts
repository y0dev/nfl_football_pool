const API_KEY = process.env.NEXT_PUBLIC_API_SPORTS_KEY
const BASE_URL = 'https://v3.football.api-sports.io'

interface NFLGame {
  fixture: {
    id: number
    date: string
    timestamp: number
    status: {
      short: string
      long: string
    }
  }
  teams: {
    home: {
      id: number
      name: string
      logo: string
    }
    away: {
      id: number
      name: string
      logo: string
    }
  }
  goals: {
    home: number | null
    away: number | null
  }
  league: {
    id: number
    name: string
    season: number
    round: string
  }
}

interface NFLTeam {
  team: {
    id: number
    name: string
    code: string
    country: string
    founded: number
    national: boolean
    logo: string
  }
  venue: {
    id: number
    name: string
    city: string
  }
}

export class NFLAPI {
  private static async makeRequest(endpoint: string, params?: Record<string, any>) {
    const url = new URL(`${BASE_URL}${endpoint}`)
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value.toString())
      })
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'x-rapidapi-host': 'v3.football.api-sports.io',
        'x-rapidapi-key': API_KEY || '',
      },
    })

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  // Get current NFL season
  static async getCurrentSeason(): Promise<number> {
    try {
      const data = await this.makeRequest('/leagues', { country: 'USA', name: 'NFL' })
      return data.response[0]?.seasons?.[0]?.year || new Date().getFullYear()
    } catch (error) {
      console.error('Error fetching current season:', error)
      return new Date().getFullYear()
    }
  }

  // Get NFL teams
  static async getTeams(): Promise<NFLTeam[]> {
    try {
      const data = await this.makeRequest('/teams', { league: '1', season: '2024' })
      return data.response || []
    } catch (error) {
      console.error('Error fetching teams:', error)
      return []
    }
  }

  // Get games for a specific week
  static async getGames(season: number, week: number): Promise<NFLGame[]> {
    try {
      const data = await this.makeRequest('/fixtures', {
        league: '1', // NFL league ID
        season: season.toString(),
        round: `Regular Season - ${week}`
      })
      return data.response || []
    } catch (error) {
      console.error('Error fetching games:', error)
      return []
    }
  }

  // Get all games for a season
  static async getAllGames(season: number): Promise<NFLGame[]> {
    try {
      const data = await this.makeRequest('/fixtures', {
        league: '1',
        season: season.toString()
      })
      return data.response || []
    } catch (error) {
      console.error('Error fetching all games:', error)
      return []
    }
  }

  // Get live games
  static async getLiveGames(): Promise<NFLGame[]> {
    try {
      const data = await this.makeRequest('/fixtures', {
        league: '1',
        live: 'all'
      })
      return data.response || []
    } catch (error) {
      console.error('Error fetching live games:', error)
      return []
    }
  }

  // Get specific game by ID
  static async getGame(fixtureId: number): Promise<NFLGame | null> {
    try {
      const data = await this.makeRequest('/fixtures', { id: fixtureId })
      return data.response?.[0] || null
    } catch (error) {
      console.error('Error fetching game:', error)
      return null
    }
  }

  // Convert API game format to our database format
  static convertGameToDatabaseFormat(apiGame: NFLGame) {
    return {
      id: apiGame.fixture.id.toString(),
      week: this.extractWeekFromRound(apiGame.league.round),
      season: apiGame.league.season,
      home_team: this.getTeamAbbreviation(apiGame.teams.home.name),
      away_team: this.getTeamAbbreviation(apiGame.teams.away.name),
      kickoff_time: new Date(apiGame.fixture.timestamp * 1000).toISOString(),
      winner: apiGame.goals.home !== null && apiGame.goals.away !== null 
        ? (apiGame.goals.home > apiGame.goals.away ? apiGame.teams.home.name : apiGame.teams.away.name)
        : null,
      home_score: apiGame.goals.home,
      away_score: apiGame.goals.away,
      game_status: this.convertStatus(apiGame.fixture.status.short)
    }
  }

  // Extract week number from round string
  private static extractWeekFromRound(round: string): number {
    const match = round.match(/Regular Season - (\d+)/)
    return match ? parseInt(match[1]) : 1
  }

  // Convert API status to our format
  private static convertStatus(apiStatus: string): string {
    const statusMap: Record<string, string> = {
      'NS': 'scheduled',
      '1H': 'live',
      'HT': 'halftime',
      '2H': 'live',
      'FT': 'finished',
      'AET': 'finished',
      'PEN': 'finished',
      'BT': 'scheduled',
      'SUSP': 'postponed',
      'INT': 'interrupted',
      'PST': 'postponed',
      'CANC': 'cancelled',
      'ABD': 'abandoned',
      'AWD': 'awarded',
      'WO': 'walkover'
    }
    return statusMap[apiStatus] || 'scheduled'
  }

  // Get team abbreviation from full name
  private static getTeamAbbreviation(fullName: string): string {
    const teamMap: Record<string, string> = {
      'Arizona Cardinals': 'ARI',
      'Atlanta Falcons': 'ATL',
      'Baltimore Ravens': 'BAL',
      'Buffalo Bills': 'BUF',
      'Carolina Panthers': 'CAR',
      'Chicago Bears': 'CHI',
      'Cincinnati Bengals': 'CIN',
      'Cleveland Browns': 'CLE',
      'Dallas Cowboys': 'DAL',
      'Denver Broncos': 'DEN',
      'Detroit Lions': 'DET',
      'Green Bay Packers': 'GB',
      'Houston Texans': 'HOU',
      'Indianapolis Colts': 'IND',
      'Jacksonville Jaguars': 'JAX',
      'Kansas City Chiefs': 'KC',
      'Los Angeles Chargers': 'LAC',
      'Los Angeles Rams': 'LAR',
      'Las Vegas Raiders': 'LV',
      'Miami Dolphins': 'MIA',
      'Minnesota Vikings': 'MIN',
      'New England Patriots': 'NE',
      'New Orleans Saints': 'NO',
      'New York Giants': 'NYG',
      'New York Jets': 'NYJ',
      'Philadelphia Eagles': 'PHI',
      'Pittsburgh Steelers': 'PIT',
      'Seattle Seahawks': 'SEA',
      'San Francisco 49ers': 'SF',
      'Tampa Bay Buccaneers': 'TB',
      'Tennessee Titans': 'TEN',
      'Washington Commanders': 'WAS'
    }
    return teamMap[fullName] || fullName
  }
} 