import { getSupabaseClient } from '@/lib/supabase';

export async function calculateScores(weekNumber: number = 1) {
  try {
    const supabase = getSupabaseClient();
    
    // Get all games for the week with results
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('*')
      .eq('week', weekNumber)
      .not('winner', 'is', null)
      .order('kickoff_time', { ascending: true });

    if (gamesError) {
      console.error('Error fetching games:', gamesError);
      return;
    }

    // Get all picks for the week
    const { data: picks, error: picksError } = await supabase
      .from('picks')
      .select(`
        *,
        games (*),
        participants (*)
      `)
      .eq('games.week', weekNumber);

    if (picksError) {
      console.error('Error fetching picks:', picksError);
      return;
    }

    // Calculate scores for each participant
    const scores = new Map();

    picks?.forEach(pick => {
      const participantId = pick.participant_id;
      const poolId = pick.pool_id;
      const key = `${participantId}-${poolId}`;

      if (!scores.has(key)) {
        scores.set(key, {
          participant_id: participantId,
          pool_id: poolId,
          week: weekNumber,
          points: 0,
          correct_picks: 0,
          total_picks: 0
        });
      }

      const score = scores.get(key);
      score.total_picks++;

      // Check if pick is correct
      const game = games?.find(g => g.id === pick.game_id);
      if (game && pick.predicted_winner === game.winner) {
        score.points += pick.confidence_points;
        score.correct_picks++;
      }
    });

    // Insert or update scores
    for (const score of scores.values()) {
      const { error } = await supabase
        .from('scores')
        .upsert({
          ...score,
          season: new Date().getFullYear() // Add season field
        }, { onConflict: 'participant_id,pool_id,week,season' });

      if (error) {
        console.error('Error updating score:', error);
      }
    }

    console.log(`Scores calculated for week ${weekNumber}`);
  } catch (error) {
    console.error('Error calculating scores:', error);
  }
}

// Check if all games for a week are finished and calculate scores
export async function checkAndCalculateWeeklyScores(poolId: string, week: number) {
  try {
    const supabase = getSupabaseClient();
    // Get all games for the week
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('*')
      .eq('week', week)
      .eq('is_active', true)
      .order('kickoff_time', { ascending: true });

    if (gamesError) {
      console.error('Error fetching games:', gamesError);
      return false;
    }

    if (!games || games.length === 0) {
      console.log(`No games found for week ${week}`);
      return false;
    }

    // Check if all games are finished with proper status and winner
    const allGamesFinished = games.every(game => {
      const status = game.status?.toLowerCase();
      const hasWinner = game.winner && game.winner.trim() !== '';
      const isFinished = status === 'final' || status === 'post' || status === 'cancelled';
      return isFinished && hasWinner;
    });

    if (!allGamesFinished) {
      console.log(`Not all games finished for week ${week}`);
      return false;
    }

    // Calculate scores for all pools
    const { data: pools, error: poolsError } = await supabase
      .from('pools')
      .select('id')
      .eq('is_active', true);

    if (poolsError) {
      console.error('Error fetching pools:', poolsError);
      return false;
    }

    // Calculate scores for each pool
    for (const pool of pools || []) {
      await calculateWeeklyScores(pool.id, week);
    }

    console.log(`Scores calculated for all pools for week ${week}`);
    
    // Check if this is a quarter week and calculate quarter winners
    const { PERIOD_WEEKS } = await import('@/lib/utils');
    if (PERIOD_WEEKS.includes(week as typeof PERIOD_WEEKS[number])) {
      console.log(`Week ${week} is a quarter week. Calculating quarter winners...`);
      
      // Get current season
      const currentSeason = games[0]?.season || new Date().getFullYear();
      
      // Calculate quarter winners for each pool
      for (const pool of pools || []) {
        try {
          const { calculateQuarterWinners } = await import('@/lib/winner-calculator');
          const quarterWinner = await calculateQuarterWinners(pool.id, week, currentSeason);
          
          if (quarterWinner) {
            console.log(`Quarter winner calculated for pool ${pool.id}:`, quarterWinner);
            
            // Save the quarter winner to the database
            const { error: saveError } = await supabase
              .from('period_winners')
              .upsert({
                pool_id: quarterWinner.pool_id,
                period_name: quarterWinner.period_name,
                winner_participant_id: quarterWinner.winner_participant_id,
                winner_name: quarterWinner.winner_name,
                winner_points: quarterWinner.winner_points,
                winner_correct_picks: quarterWinner.winner_correct_picks,
                winner_total_picks: quarterWinner.winner_total_picks,
                winner_weeks_won: quarterWinner.winner_weeks_won,
                total_participants: quarterWinner.total_participants,
                tie_breaker_used: quarterWinner.tie_breaker_used,
                tie_breaker_answer: quarterWinner.tie_breaker_answer,
                tie_breaker_difference: quarterWinner.tie_breaker_difference,
                created_at: new Date().toISOString()
              }, {
                onConflict: 'pool_id,period_name'
              });
              
            if (saveError) {
              console.error('Error saving quarter winner:', saveError);
            } else {
              console.log(`Quarter winner saved for pool ${pool.id}, period ${quarterWinner.period_name}`);
            }
          }
        } catch (error) {
          console.error(`Error calculating quarter winner for pool ${pool.id}:`, error);
        }
      }
    }
    
    return true;

  } catch (error) {
    console.error('Failed to check and calculate weekly scores:', error);
    return false;
  }
}

// Calculate scores for a specific pool and week
async function calculateWeeklyScores(poolId: string, week: number) {
  try {
    const supabase = getSupabaseClient();
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
      .eq('games.week', week);

    if (picksError) {
      console.error('Error fetching picks:', picksError);
      return;
    }

    // Calculate scores for each participant
    const scoresMap = new Map();
    
    picks?.forEach((pick: any) => {
      const participantId = pick.participant_id;
      const game = pick.games;
      
      if (!scoresMap.has(participantId)) {
        scoresMap.set(participantId, {
          participant_id: participantId,
          points: 0,
          correct_picks: 0,
          total_picks: 0
        });
      }
      
      const score = scoresMap.get(participantId);
      score.total_picks++;
      
      // Check if pick is correct
      if (game.winner && pick.predicted_winner === game.winner) {
        score.correct_picks++;
        score.points += pick.confidence_points;
      }
    });

    // Convert to array and sort by points
    const scores = Array.from(scoresMap.values())
      .sort((a, b) => b.points - a.points)
      .map((score, index) => ({
        ...score,
        rank: index + 1
      }));

    // Update scores in database
    await updateScoresInDatabase(poolId, week, scores);

    console.log(`Scores calculated for pool ${poolId}, week ${week}`);

  } catch (error) {
    console.error('Failed to calculate weekly scores:', error);
  }
}

// Update scores in database
async function updateScoresInDatabase(poolId: string, week: number, scores: any[]) {
  try {
    const supabase = getSupabaseClient();
    // Delete existing scores for this week
    await supabase
      .from('scores')
      .delete()
      .eq('pool_id', poolId)
      .eq('week', week);

    // Insert new scores
    const scoresToInsert = scores.map(score => ({
      participant_id: score.participant_id,
      pool_id: poolId,
      week: week,
      season: new Date().getFullYear(),
      points: score.points,
      correct_picks: score.correct_picks,
      total_picks: score.total_picks
    }));

    const { error } = await supabase
      .from('scores')
      .insert(scoresToInsert);

    if (error) {
      console.error('Error updating scores:', error);
    }
  } catch (error) {
    console.error('Failed to update scores in database:', error);
  }
}

// Check for quarterly winners (after week 4)
export async function checkQuarterlyWinners() {
  try {
    const supabase = getSupabaseClient();
    const currentWeek = await getCurrentWeek();
    
    if (currentWeek !== 4) {
      return; // Only check after week 4
    }

    // Get all pools
    const { data: pools, error: poolsError } = await supabase
      .from('pools')
      .select('id, name')
      .eq('is_active', true);

    if (poolsError) {
      console.error('Error fetching pools:', poolsError);
      return;
    }

    // Check each pool for quarterly winners
    for (const pool of pools || []) {
      await determineQuarterlyWinner(pool.id, pool.name);
    }

  } catch (error) {
    console.error('Failed to check quarterly winners:', error);
  }
}

// Determine quarterly winner for a pool
async function determineQuarterlyWinner(poolId: string, poolName: string) {
  try {
    const supabase = getSupabaseClient();
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
      .order('week', { ascending: true });

    if (error) {
      console.error('Error fetching quarterly scores:', error);
      return;
    }

    // Calculate totals for each participant
    const standingsMap = new Map();
    
    scores?.forEach((score: any) => {
      const participantId = score.participant_id;
      const participantName = score.participants.name;
      
      if (!standingsMap.has(participantId)) {
        standingsMap.set(participantId, {
          participant_id: participantId,
          participant_name: participantName,
          total_points: 0,
          weeks_played: 0
        });
      }
      
      const standing = standingsMap.get(participantId);
      standing.total_points += score.points;
      standing.weeks_played++;
    });

    // Find the winner
    const standings = Array.from(standingsMap.values())
      .sort((a, b) => b.total_points - a.total_points);

    if (standings.length > 0) {
      const winner = standings[0];
      console.log(`Quarterly winner for ${poolName}: ${winner.participant_name} with ${winner.total_points} points`);
      
      // Log the quarterly winner
      await logQuarterlyWinner(poolId, winner);
    }

  } catch (error) {
    console.error('Failed to determine quarterly winner:', error);
  }
}

// Log quarterly winner to audit log
async function logQuarterlyWinner(poolId: string, winner: any) {
  try {
    const supabase = getSupabaseClient();
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
      });

    if (error) {
      console.error('Error logging quarterly winner:', error);
    }
  } catch (error) {
    console.error('Failed to log quarterly winner:', error);
  }
}

// Get current week using utility function
async function getCurrentWeek(): Promise<number> {
  try {
    const { calculateWeekFromDate } = await import('@/lib/utils');
    return calculateWeekFromDate();
  } catch (error) {
    console.error('Error importing utility function, using fallback calculation:', error);
    // Fallback calculation
    const now = new Date();
    const seasonStart = new Date(now.getFullYear(), 8, 1); // September 1st
    const weekDiff = Math.floor((now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return Math.max(1, Math.min(18, weekDiff + 1));
  }
}

// Scheduled function to run after each game day
export async function runPostGameCalculations() {
  try {
    const supabase = getSupabaseClient();
    const currentWeek = await getCurrentWeek();
    
    // Get all pools
    const { data: pools, error: poolsError } = await supabase
      .from('pools')
      .select('id')
      .eq('is_active', true);

    if (poolsError) {
      console.error('Error fetching pools:', poolsError);
      return;
    }

    // Check and calculate scores for each pool
    for (const pool of pools || []) {
      await checkAndCalculateWeeklyScores(pool.id, currentWeek);
    }

    // Check for quarterly winners after week 4
    if (currentWeek === 4) {
      await checkQuarterlyWinners();
    }

  } catch (error) {
    console.error('Failed to run post-game calculations:', error);
  }
} 