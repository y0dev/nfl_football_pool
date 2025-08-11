import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
  private static API_KEY = Deno.env.get('API_SPORTS_KEY')
  private static BASE_URL = 'https://v3.football.api-sports.io'

  private static async makeRequest(endpoint: string, params?: Record<string, any>) {
    const url = new URL(`${this.BASE_URL}${endpoint}`)
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value.toString())
      })
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'x-rapidapi-host': 'v3.football.api-sports.io',
        'x-rapidapi-key': this.API_KEY || '',
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { season, week } = await req.json()
    const currentSeason = season || new Date().getFullYear()

    console.log(`Fetching games for season ${currentSeason}${week ? `, week ${week}` : ''}`)

    // Fetch games from API-Sports.io
    const apiGames = await NFLAPI.getGames(currentSeason, week)
    
    if (apiGames.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No games found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Convert and upsert games
    const gamesToUpsert = apiGames.map(game => NFLAPI.convertGameToDatabaseFormat(game))
    
    const { data, error } = await supabaseClient
      .from('games')
      .upsert(gamesToUpsert, { onConflict: 'id' })

    if (error) {
      throw error
    }

    // Update scores for finished games
    const finishedGames = apiGames.filter(game => 
      game.fixture.status.short === 'FT' || 
      game.fixture.status.short === 'AET' || 
      game.fixture.status.short === 'PEN'
    )

    for (const game of finishedGames) {
      const dbGame = NFLAPI.convertGameToDatabaseFormat(game)
      
      // Update game with final score
      await supabaseClient
        .from('games')
        .update({
          winner: dbGame.winner,
          home_score: dbGame.home_score,
          away_score: dbGame.away_score,
          game_status: dbGame.game_status
        })
        .eq('id', dbGame.id)

      // Recalculate scores for all users in this pool
      await recalculateScores(supabaseClient, dbGame.id)
    }

    return new Response(
      JSON.stringify({ 
        message: 'Games updated successfully',
        gamesUpdated: gamesToUpsert.length,
        finishedGames: finishedGames.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error updating games:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function recalculateScores(supabaseClient: any, gameId: string) {
  try {
    // Get the game details
    const { data: game } = await supabaseClient
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single()

    if (!game || !game.winner) return

    // Get all picks for this game
    const { data: picks } = await supabaseClient
      .from('picks')
      .select('*')
      .eq('game_id', gameId)

    if (!picks) return

    // Group picks by user and pool
    const picksByUserPool = picks.reduce((acc: any, pick: any) => {
      const key = `${pick.user_id}-${pick.pool_id}`
      if (!acc[key]) {
        acc[key] = {
          user_id: pick.user_id,
          pool_id: pick.pool_id,
          picks: []
        }
      }
      acc[key].picks.push(pick)
      return acc
    }, {})

    // Calculate scores for each user-pool combination
    for (const userPoolKey of Object.keys(picksByUserPool)) {
      const userPool = picksByUserPool[userPoolKey]
      let totalPoints = 0
      let correctPicks = 0
      let totalPicks = 0

      for (const pick of userPool.picks) {
        totalPicks++
        if (pick.predicted_winner === game.winner) {
          totalPoints += pick.confidence_points
          correctPicks++
        }
      }

      // Upsert score
      await supabaseClient
        .from('scores')
        .upsert({
          user_id: userPool.user_id,
          pool_id: userPool.pool_id,
          week: game.week,
          season: game.season,
          points: totalPoints,
          correct_picks: correctPicks,
          total_picks: totalPicks
        }, { onConflict: 'user_id,pool_id,week,season' })
    }
  } catch (error) {
    console.error('Error recalculating scores:', error)
  }
} 