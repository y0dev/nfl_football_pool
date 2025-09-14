import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get current week
    const currentWeek = getCurrentWeek()
    
    // Update game results from NFL API
    await updateGameResults(supabase, currentWeek)
    
    // Check if all games for the week are finished before calculating scores
    const allGamesFinished = await checkIfAllGamesFinished(supabase, currentWeek)
    
    if (allGamesFinished) {
      // Calculate scores for all pools only when all games are finished
      await calculateAllPoolScores(supabase, currentWeek)
      
      // Check for quarterly winners after week 4
      if (currentWeek === 4) {
        await checkQuarterlyWinners(supabase)
      }
      
      console.log(`Week ${currentWeek} completed - scores calculated for all pools`)
    } else {
      console.log(`Week ${currentWeek} not yet complete - skipping score calculation`)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: allGamesFinished 
          ? `Week ${currentWeek} completed - scores calculated` 
          : `Week ${currentWeek} not yet complete`,
        allGamesFinished,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error in update-games function:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})

// Update game results from NFL API
async function updateGameResults(supabase: any, week: number) {
  try {
    // Get games for the current week
    const { data: games, error } = await supabase
      .from('games')
      .select('*')
      .eq('week', week)
      .eq('is_active', true)

    if (error) {
      console.error('Error fetching games:', error)
      return
    }

    if (!games || games.length === 0) {
      console.log(`No games found for week ${week}`)
      return
    }

    // Update each game with results
    for (const game of games) {
      // In a real implementation, you would fetch from NFL API
      // For now, we'll simulate updating game status
      await updateGameStatus(supabase, game.id)
    }

    console.log(`Updated ${games.length} games for week ${week}`)
  } catch (error) {
    console.error('Failed to update game results:', error)
  }
}

// Update individual game status
async function updateGameStatus(supabase: any, gameId: string) {
  try {
    // Simulate checking if game is finished
    // In reality, you'd check NFL API for final scores
    const { error } = await supabase
      .from('games')
      .update({ 
        status: 'finished',
        updated_at: new Date().toISOString()
      })
      .eq('id', gameId)

    if (error) {
      console.error(`Error updating game ${gameId}:`, error)
    }
  } catch (error) {
    console.error(`Failed to update game ${gameId}:`, error)
  }
}

// Calculate scores for all pools
async function calculateAllPoolScores(supabase: any, week: number) {
  try {
    // Get all active pools
    const { data: pools, error: poolsError } = await supabase
      .from('pools')
      .select('id')
      .eq('is_active', true)

    if (poolsError) {
      console.error('Error fetching pools:', poolsError)
      return
    }

    // Calculate scores for each pool
    for (const pool of pools || []) {
      await calculateWeeklyScores(supabase, pool.id, week)
    }

    console.log(`Scores calculated for ${pools?.length || 0} pools for week ${week}`)
  } catch (error) {
    console.error('Failed to calculate pool scores:', error)
  }
}

// Calculate weekly scores for a specific pool
async function calculateWeeklyScores(supabase: any, poolId: string, week: number) {
  try {
    // Get all picks for the week
    const { data: picks, error: picksError } = await supabase
      .from('picks')
      .select(`
        participant_id,
        predicted_winner,
        confidence_points,
        game_id,
        games!inner(winner, home_team, away_team)
      `)
      .eq('pool_id', poolId)
      .eq('games.week', week)

    if (picksError) {
      console.error('Error fetching picks:', picksError)
      return
    }

    // Calculate scores for each participant
    const scoresMap = new Map()
    
    picks?.forEach((pick: any) => {
      const participantId = pick.participant_id
      const game = pick.games
      
      if (!scoresMap.has(participantId)) {
        scoresMap.set(participantId, {
          participant_id: participantId,
          points: 0,
          correct_picks: 0,
          total_picks: 0
        })
      }
      
      const score = scoresMap.get(participantId)
      score.total_picks++
      
      // Check if pick is correct
      if (game.winner && pick.predicted_winner === game.winner) {
        score.correct_picks++
        score.points += pick.confidence_points
      }
    })

    // Convert to array and sort by points
    const scores = Array.from(scoresMap.values())
      .sort((a, b) => b.points - a.points)
      .map((score, index) => ({
        ...score,
        rank: index + 1
      }))

    // Update scores in database
    await updateScoresInDatabase(supabase, poolId, week, scores)

    console.log(`Scores calculated for pool ${poolId}, week ${week}`)
  } catch (error) {
    console.error('Failed to calculate weekly scores:', error)
  }
}

// Update scores in database
async function updateScoresInDatabase(supabase: any, poolId: string, week: number, scores: any[]) {
  try {
    // Delete existing scores for this week
    await supabase
      .from('scores')
      .delete()
      .eq('pool_id', poolId)
      .eq('week', week)

    // Insert new scores
    const scoresToInsert = scores.map(score => ({
      participant_id: score.participant_id,
      pool_id: poolId,
      week: week,
      season: new Date().getFullYear(),
      points: score.points,
      correct_picks: score.correct_picks,
      total_picks: score.total_picks
    }))

    const { error } = await supabase
      .from('scores')
      .insert(scoresToInsert)

    if (error) {
      console.error('Error updating scores:', error)
    }
  } catch (error) {
    console.error('Failed to update scores in database:', error)
  }
}

// Check for quarterly winners
async function checkQuarterlyWinners(supabase: any) {
  try {
    // Get all pools
    const { data: pools, error: poolsError } = await supabase
      .from('pools')
      .select('id, name')
      .eq('is_active', true)

    if (poolsError) {
      console.error('Error fetching pools:', poolsError)
      return
    }

    // Check each pool for quarterly winners
    for (const pool of pools || []) {
      await determineQuarterlyWinner(supabase, pool.id, pool.name)
    }
  } catch (error) {
    console.error('Failed to check quarterly winners:', error)
  }
}

// Determine quarterly winner for a pool
async function determineQuarterlyWinner(supabase: any, poolId: string, poolName: string) {
  try {
    // Get scores for weeks 1-4
    const { data: scores, error } = await supabase
      .from('scores')
      .select(`
        participant_id,
        participants!inner(name),
        week,
        points
      `)
      .eq('pool_id', poolId)
      .in('week', [1, 2, 3, 4])
      .order('week', { ascending: true })

    if (error) {
      console.error('Error fetching quarterly scores:', error)
      return
    }

    // Calculate totals for each participant
    const standingsMap = new Map()
    
    scores?.forEach((score: any) => {
      const participantId = score.participant_id
      const participantName = score.participants.name
      
      if (!standingsMap.has(participantId)) {
        standingsMap.set(participantId, {
          participant_id: participantId,
          participant_name: participantName,
          total_points: 0,
          weeks_played: 0
        })
      }
      
      const standing = standingsMap.get(participantId)
      standing.total_points += score.points
      standing.weeks_played++
    })

    // Find the winner
    const standings = Array.from(standingsMap.values())
      .sort((a, b) => b.total_points - a.total_points)

    if (standings.length > 0) {
      const winner = standings[0]
      console.log(`Quarterly winner for ${poolName}: ${winner.participant_name} with ${winner.total_points} points`)
      
      // Log the quarterly winner
      await logQuarterlyWinner(supabase, poolId, winner)
    }
  } catch (error) {
    console.error('Failed to determine quarterly winner:', error)
  }
}

// Log quarterly winner to audit log
async function logQuarterlyWinner(supabase: any, poolId: string, winner: any) {
  try {
    const { error } = await supabase
      .from('audit_logs')
      .insert({
        action: 'quarterly_winner',
        admin_id: 'system',
        entity: 'pool',
        entity_id: poolId,
        details: {
          winner_name: winner.participant_name,
          winner_id: winner.participant_id,
          total_points: winner.total_points,
          weeks_played: winner.weeks_played,
          quarter: 'Q1'
        }
      })

    if (error) {
      console.error('Error logging quarterly winner:', error)
    }
  } catch (error) {
    console.error('Failed to log quarterly winner:', error)
  }
}

// Check if all games for a given week are finished
async function checkIfAllGamesFinished(supabase: any, week: number): Promise<boolean> {
  try {
    const { data: games, error } = await supabase
      .from('games')
      .select('*')
      .eq('week', week)
      .eq('is_active', true)

    if (error) {
      console.error('Error fetching games for completion check:', error)
      return false
    }

    if (!games || games.length === 0) {
      console.log(`No games found for week ${week} to check completion`)
      return true // No games means it's finished
    }

    // Check if all games are properly finished with both status and winner
    const allFinished = games.every(game => {
      const status = game.status?.toLowerCase();
      const hasWinner = game.winner && game.winner.trim() !== '';
      const isFinished = status === 'final' || status === 'post' || status === 'cancelled';
      return isFinished && hasWinner;
    });
    console.log(`All games for week ${week} finished: ${allFinished}`)
    return allFinished
  } catch (error) {
    console.error('Failed to check if all games are finished:', error)
    return false
  }
}

// Get current week using utility function
function getCurrentWeek(): number {
  // Note: This is a Supabase Edge Function, so we can't import from @/lib/utils
  // Keeping the calculation here for now, but it's duplicated from utils.ts
  const now = new Date()
  const seasonStart = new Date(now.getFullYear(), 8, 1) // September 1st
  const weekDiff = Math.floor((now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000))
  return Math.max(1, Math.min(18, weekDiff + 1))
}
