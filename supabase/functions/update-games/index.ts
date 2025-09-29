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
      
      // Check for quarterly winners for all quarter weeks (4, 9, 14, 18)
      const quarterWeeks = [4, 9, 14, 18]
      if (quarterWeeks.includes(currentWeek)) {
        await checkQuarterlyWinners(supabase, currentWeek)
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
async function checkQuarterlyWinners(supabase: any, quarterWeek: number) {
  try {
    console.log(`Checking quarterly winners for week ${quarterWeek}`)
    
    // Get all pools
    const { data: pools, error: poolsError } = await supabase
      .from('pools')
      .select('id, name')
      .eq('is_active', true)

    if (poolsError) {
      console.error('Error fetching pools:', poolsError)
      return
    }

    // Determine quarter weeks and period name
    let quarterWeeks: number[]
    let periodName: string
    
    switch (quarterWeek) {
      case 4:
        quarterWeeks = [1, 2, 3, 4]
        periodName = 'Q1'
        break
      case 9:
        quarterWeeks = [5, 6, 7, 8, 9]
        periodName = 'Q2'
        break
      case 14:
        quarterWeeks = [10, 11, 12, 13, 14]
        periodName = 'Q3'
        break
      case 18:
        quarterWeeks = [15, 16, 17, 18]
        periodName = 'Q4'
        break
      default:
        console.log(`Not a quarter week: ${quarterWeek}`)
        return
    }

    console.log(`Calculating ${periodName} winners for weeks:`, quarterWeeks)

    // Check each pool for quarterly winners
    for (const pool of pools || []) {
      await determineQuarterlyWinner(supabase, pool.id, pool.name, quarterWeeks, periodName, quarterWeek)
    }
  } catch (error) {
    console.error('Failed to check quarterly winners:', error)
  }
}

// Determine quarterly winner for a pool
async function determineQuarterlyWinner(supabase: any, poolId: string, poolName: string, quarterWeeks: number[], periodName: string, quarterWeek: number) {
  try {
    console.log(`Determining ${periodName} winner for pool ${poolName}`)
    
    // Get all participants in the pool
    const { data: participants, error: participantsError } = await supabase
      .from('participants')
      .select('id, name')
      .eq('pool_id', poolId)

    if (participantsError) {
      console.error('Error fetching participants:', participantsError)
      return
    }

    if (!participants || participants.length === 0) {
      console.log('No participants found for pool')
      return
    }

    // Get all picks for the quarter weeks
    const { data: picksData, error: picksError } = await supabase
      .from('picks')
      .select(`
        participant_id,
        predicted_winner,
        confidence_points,
        games!inner(id, week, winner, status, season_type)
      `)
      .eq('pool_id', poolId)
      .eq('games.season_type', 2)
      .in('games.week', quarterWeeks)

    if (picksError) {
      console.error('Error fetching picks:', picksError)
      return
    }

    // Get all games for the quarter weeks to check completion status
    const { data: gamesData, error: gamesError } = await supabase
      .from('games')
      .select('*')
      .eq('season_type', 2)
      .in('week', quarterWeeks)

    if (gamesError) {
      console.error('Error fetching games:', gamesError)
      return
    }

    // Check if all weeks in the quarter are completed
    const completedWeeks = quarterWeeks.filter(week => {
      const weekGames = gamesData?.filter(game => game.week === week) || []
      if (weekGames.length === 0) return false
      
      const allGamesFinished = weekGames.every(game => {
        const status = game.status?.toLowerCase() || ''
        return status === 'final' || status === 'post'
      })
      
      return allGamesFinished
    })

    // Only calculate if all weeks are completed
    if (completedWeeks.length !== quarterWeeks.length) {
      console.log(`Not all weeks completed for ${periodName}. Completed: ${completedWeeks.length}/${quarterWeeks.length}`)
      return
    }

    // Calculate quarter totals for each participant
    const participantTotals = new Map()

    participants.forEach(participant => {
      participantTotals.set(participant.id, {
        participant_id: participant.id,
        participant_name: participant.name,
        total_points: 0,
        total_correct: 0,
        total_picks: 0,
        weeks_won: 0
      })
    })

    // Process each week to calculate totals
    quarterWeeks.forEach(week => {
      const weekPicks = picksData?.filter(pick => {
        const game = Array.isArray(pick.games) ? pick.games[0] : pick.games
        return game?.week === week
      }) || []

      const weekTotals = new Map()

      // Calculate week totals for each participant
      participants.forEach(participant => {
        const participantPicks = weekPicks.filter(pick => pick.participant_id === participant.id)
        let weekPoints = 0
        let weekCorrect = 0
        let weekPicks = participantPicks.length

        participantPicks.forEach(pick => {
          const game = Array.isArray(pick.games) ? pick.games[0] : pick.games
          if (pick.predicted_winner === game?.winner) {
            weekPoints += pick.confidence_points
            weekCorrect++
          }
        })

        weekTotals.set(participant.id, { points: weekPoints, correct: weekCorrect, picks: weekPicks })
      })

      // Find week winner
      const weekWinners = Array.from(weekTotals.entries())
        .map(([participantId, totals]) => ({
          participant_id: participantId,
          participant_name: participants.find(p => p.id === participantId)?.name || '',
          ...totals
        }))
        .sort((a, b) => b.points - a.points)

      // Award week win to highest scorer
      if (weekWinners.length > 0) {
        const weekWinner = weekWinners[0]
        const participantTotal = participantTotals.get(weekWinner.participant_id)
        if (participantTotal) {
          participantTotal.weeks_won++
        }
      }

      // Add week totals to quarter totals
      participants.forEach(participant => {
        const weekTotal = weekTotals.get(participant.id)
        const quarterTotal = participantTotals.get(participant.id)
        if (weekTotal && quarterTotal) {
          quarterTotal.total_points += weekTotal.points
          quarterTotal.total_correct += weekTotal.correct
          quarterTotal.total_picks += weekTotal.picks
        }
      })
    })

    // Convert to array and sort by total points
    const quarterStandings = Array.from(participantTotals.values())
      .sort((a, b) => b.total_points - a.total_points)

    if (quarterStandings.length === 0) {
      console.log('No standings calculated')
      return
    }

    // Check for ties at the top
    const topScore = quarterStandings[0].total_points
    const tiedParticipants = quarterStandings.filter(p => p.total_points === topScore)

    let winner = quarterStandings[0]
    
    if (tiedParticipants.length > 1) {
      console.log(`Tie detected for ${periodName} winner. Applying tie-breakers...`)
      
      // Apply tie-breaker logic: weeks won first, then Monday night score
      const sortedByWeeksWon = tiedParticipants.sort((a, b) => b.weeks_won - a.weeks_won)
      const topWeeksWon = sortedByWeeksWon[0].weeks_won
      const stillTied = sortedByWeeksWon.filter(p => p.weeks_won === topWeeksWon)
      
      if (stillTied.length === 1) {
        winner = stillTied[0]
      } else {
        // Use Monday night score tie-breaker
        console.log(`Still tied after weeks won. Using Monday night score for week ${quarterWeek}`)
        
        const { data: tieBreakers, error: tieBreakerError } = await supabase
          .from('tie_breakers')
          .select('participant_id, answer')
          .eq('pool_id', poolId)
          .eq('week', quarterWeek)
          .in('participant_id', stillTied.map(p => p.participant_id))

        if (!tieBreakerError && tieBreakers) {
          const { data: pool, error: poolError } = await supabase
            .from('pools')
            .select('tie_breaker_answer')
            .eq('id', poolId)
            .single()

          if (!poolError && pool?.tie_breaker_answer) {
            const poolAnswer = pool.tie_breaker_answer
            
            // Calculate tie breaker differences
            const participantsWithTieBreakers = stillTied.map(participant => {
              const tieBreaker = tieBreakers.find(tb => tb.participant_id === participant.participant_id)
              const tieBreakerAnswer = tieBreaker?.answer
              const difference = tieBreakerAnswer ? Math.abs(tieBreakerAnswer - poolAnswer) : Infinity
              
              return {
                ...participant,
                tie_breaker_answer: tieBreakerAnswer,
                tie_breaker_difference: difference
              }
            })

            // Sort by tie breaker difference (closest wins)
            const sortedByTieBreaker = participantsWithTieBreakers.sort((a, b) => 
              (a.tie_breaker_difference || Infinity) - (b.tie_breaker_difference || Infinity)
            )

            winner = sortedByTieBreaker[0]
          }
        }
        
        // For Q4, could add Super Bowl tie-breaker here if needed
        if (quarterWeek === 18 && stillTied.length > 1) {
          console.log('Q4 tie - could implement Super Bowl tie-breaker here')
        }
      }
    }

    console.log(`${periodName} winner for ${poolName}: ${winner.participant_name} with ${winner.total_points} points`)
    
    // Save the quarter winner to the database
    const { error: saveError } = await supabase
      .from('period_winners')
      .upsert({
        pool_id: poolId,
        period_name: periodName,
        winner_participant_id: winner.participant_id,
        winner_name: winner.participant_name,
        winner_points: winner.total_points,
        winner_correct_picks: winner.total_correct,
        winner_total_picks: winner.total_picks,
        winner_weeks_won: winner.weeks_won,
        total_participants: participants.length,
        tie_breaker_used: tiedParticipants.length > 1,
        tie_breaker_answer: winner.tie_breaker_answer,
        tie_breaker_difference: winner.tie_breaker_difference,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'pool_id,period_name'
      })
      
    if (saveError) {
      console.error('Error saving quarter winner:', saveError)
    } else {
      console.log(`${periodName} winner saved for pool ${poolId}`)
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
