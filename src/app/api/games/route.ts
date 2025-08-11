import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create Supabase client dynamically to avoid build-time issues
function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(supabaseUrl, supabaseServiceKey)
}

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

class NFLAPI {
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

  static async getGames(season: number, week?: number): Promise<NFLGame[]> {
    try {
      const params: Record<string, any> = {
        league: '1', // NFL league ID
        season: season.toString()
      }
      
      if (week) {
        params.round = `Regular Season - ${week}`
      }

      const data = await this.makeRequest('/fixtures', params)
      return data.response || []
    } catch (error) {
      console.error('Error fetching games:', error)
      return []
    }
  }

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

  private static extractWeekFromRound(round: string): number {
    const match = round.match(/Regular Season - (\d+)/)
    return match ? parseInt(match[1]) : 1
  }

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

export async function POST(request: NextRequest) {
  try {
    const { season, week } = await request.json()
    const currentSeason = season || new Date().getFullYear()

    console.log(`Fetching games for season ${currentSeason}${week ? `, week ${week}` : ''}`)

    // Fetch games from API-Sports.io
    const apiGames = await NFLAPI.getGames(currentSeason, week)
    
    if (apiGames.length === 0) {
      return NextResponse.json({ message: 'No games found' })
    }

    // Convert and upsert games
    const gamesToUpsert = apiGames.map(game => NFLAPI.convertGameToDatabaseFormat(game))
    
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('games')
      .upsert(gamesToUpsert, { onConflict: 'id' })

    if (error) {
      throw error
    }

    return NextResponse.json({ 
      message: 'Games updated successfully',
      gamesUpdated: gamesToUpsert.length
    })

  } catch (error: any) {
    console.error('Error updating games:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
} 