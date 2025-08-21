'use server';

import { getSupabaseClient } from '@/lib/supabase';

// Get weekly submissions for a pool
export async function getWeeklySubmissions(poolId: string, week: number) {
  try {
    const { data, error } = await getSupabaseClient()
      .from('picks')
      .select(`
        participant_id,
        participants!inner(name),
        created_at,
        confidence_points,
        game_id
      `)
      .eq('pool_id', poolId)
      .eq('games.week', week)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching submissions:', error);
      return [];
    }

    // Group by participant and calculate totals
    const submissionsMap = new Map();
    
    data?.forEach((pick: any) => {
      const participantId = pick.participant_id;
      const participantName = pick.participants.name;
      
      if (!submissionsMap.has(participantId)) {
        submissionsMap.set(participantId, {
          participant_id: participantId,
          participant_name: participantName,
          submitted_at: pick.created_at,
          game_count: 0,
          total_confidence: 0
        });
      }
      
      const submission = submissionsMap.get(participantId);
      submission.game_count++;
      submission.total_confidence += pick.confidence_points;
    });

    return Array.from(submissionsMap.values());
  } catch (error) {
    console.error('Failed to get weekly submissions:', error);
    return [];
  }
}

// Calculate weekly scores for a pool
export async function calculateWeeklyScores(poolId: string, week: number) {
  try {
    // Get all picks for the week
    const { data: picks, error: picksError } = await getSupabaseClient()
      .from('picks')
      .select(`
        participant_id,
        participants!inner(name),
        predicted_winner,
        confidence_points,
        game_id,
        games!inner(winner, home_team, away_team)
      `)
      .eq('pool_id', poolId)
      .eq('games.week', week);

    if (picksError) {
      console.error('Error fetching picks:', picksError);
      return [];
    }

    // Calculate scores for each participant
    const scoresMap = new Map();
    
    picks?.forEach((pick: any) => {
      const participantId = pick.participant_id;
      const participantName = pick.participants.name;
      const game = pick.games;
      
      if (!scoresMap.has(participantId)) {
        scoresMap.set(participantId, {
          participant_id: participantId,
          participant_name: participantName,
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

    return scores;
  } catch (error) {
    console.error('Failed to calculate weekly scores:', error);
    return [];
  }
}

// Update scores in database
async function updateScoresInDatabase(poolId: string, week: number, scores: any[]) {
  try {
    // Delete existing scores for this week
    await getSupabaseClient()
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

    const { error } = await getSupabaseClient()
      .from('scores')
      .insert(scoresToInsert);

    if (error) {
      console.error('Error updating scores:', error);
    }
  } catch (error) {
    console.error('Failed to update scores in database:', error);
  }
}

// Get quarterly standings (first 4 weeks)
export async function getQuarterlyStandings(poolId: string) {
  try {
    const { data, error } = await getSupabaseClient()
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
      return [];
    }

    // Calculate totals for each participant
    const standingsMap = new Map();
    
    data?.forEach((score: any) => {
      const participantId = score.participant_id;
      const participantName = score.participants.name;
      
      if (!standingsMap.has(participantId)) {
        standingsMap.set(participantId, {
          participant_id: participantId,
          participant_name: participantName,
          total_points: 0,
          weeks_played: 0,
          average_points: 0
        });
      }
      
      const standing = standingsMap.get(participantId);
      standing.total_points += score.points;
      standing.weeks_played++;
    });

    // Calculate averages and sort
    const standings = Array.from(standingsMap.values())
      .map(standing => ({
        ...standing,
        average_points: standing.weeks_played > 0 
          ? standing.total_points / standing.weeks_played 
          : 0
      }))
      .sort((a, b) => b.total_points - a.total_points)
      .map((standing, index) => ({
        ...standing,
        rank: index + 1
      }));

    return standings;
  } catch (error) {
    console.error('Failed to get quarterly standings:', error);
    return [];
  }
}

// Export picks to Excel format
export async function exportToExcel(poolId: string, week: number) {
  try {
    // Get all picks for the week with game details
    const { data: picks, error } = await getSupabaseClient()
      .from('picks')
      .select(`
        participant_id,
        participants!inner(name),
        predicted_winner,
        confidence_points,
        game_id,
        games!inner(home_team, away_team, kickoff_time)
      `)
      .eq('pool_id', poolId)
      .eq('games.week', week)
      .order('participants.name', { ascending: true });

    if (error) {
      console.error('Error fetching picks for export:', error);
      return;
    }

    // Get all games for the week
    const { data: games } = await getSupabaseClient()
      .from('games')
      .select('*')
      .eq('week', week)
      .order('kickoff_time', { ascending: true });

    if (!games) {
      console.error('No games found for week', week);
      return;
    }

    // Create CSV data
    const csvData = createCSVData(picks, games);
    
    // Download the file
    downloadCSV(csvData, `pool-${poolId}-week-${week}-picks.csv`);
    
  } catch (error) {
    console.error('Failed to export Excel:', error);
  }
}

// Create CSV data from picks and games
function createCSVData(picks: any[], games: any[]) {
  // Group picks by participant
  const participantsMap = new Map();
  
  picks?.forEach((pick: any) => {
    const participantId = pick.participant_id;
    const participantName = pick.participants.name;
    
    if (!participantsMap.has(participantId)) {
      participantsMap.set(participantId, {
        name: participantName,
        picks: new Map()
      });
    }
    
    const participant = participantsMap.get(participantId);
    participant.picks.set(pick.game_id, {
      predicted_winner: pick.predicted_winner,
      confidence_points: pick.confidence_points
    });
  });

  // Create CSV headers
  const headers = ['Name'];
  games.forEach((game, index) => {
    headers.push(`Game ${index + 1} (${game.away_team} @ ${game.home_team})`);
    headers.push(`Confidence ${index + 1}`);
  });

  // Create CSV rows
  const rows = [headers];
  
  participantsMap.forEach((participant) => {
    const row = [participant.name];
    
    games.forEach((game) => {
      const pick = participant.picks.get(game.id);
      if (pick) {
        row.push(pick.predicted_winner);
        row.push(pick.confidence_points.toString());
      } else {
        row.push('Not Submitted');
        row.push('');
      }
    });
    
    rows.push(row);
  });

  return rows;
}

// Download CSV file
function downloadCSV(data: any[][], filename: string) {
  const csvContent = data.map(row => 
    row.map(cell => `"${cell}"`).join(',')
  ).join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

// Get all pools for admin
export async function getAdminPools() {
  try {
    const { data, error } = await getSupabaseClient()
      .from('pools')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching pools:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Failed to get admin pools:', error);
    return [];
  }
}

// Get pool participants
export async function getPoolParticipants(poolId: string) {
  try {
    const { adminService } = await import('@/lib/admin-service');
    return await adminService.getPoolParticipants(poolId);
  } catch (error) {
    console.error('Failed to get pool participants:', error);
    throw error;
  }
}

// Add participant to pool
export async function addParticipantToPool(poolId: string, name: string, email?: string) {
  try {
    // Get the service role client to bypass RLS policies
    const { getSupabaseServiceClient } = await import('@/lib/supabase');
    const supabase = getSupabaseServiceClient();

    // Check if participant already exists in this pool
    const { data: existingParticipant, error: checkError } = await supabase
      .from('participants')
      .select('id')
      .eq('pool_id', poolId)
      .eq('email', email)
      .single();

    if (existingParticipant) {
      throw new Error('Participant already exists in this pool');
    }

    // Add participant to pool
    const { data: participant, error: insertError } = await supabase
      .from('participants')
      .insert({
        pool_id: poolId,
        name: name.trim(),
        email: email?.trim() || null,
        is_active: true
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(insertError.message);
    }

    // Log the action
    try {
      const { error: logError } = await supabase
        .from('audit_logs')
        .insert({
          action: 'add_participant',
          admin_id: null, // Service role doesn't have a specific admin ID
          entity: 'participant',
          entity_id: participant.id,
          details: { 
            participant_id: participant.id,
            participant_name: name,
            participant_email: email,
            pool_id: poolId,
            action: 'participant_added'
          }
        });
      
      if (logError) {
        console.warn('Failed to log participant addition:', logError);
      }
    } catch (logError) {
      console.warn('Failed to log participant addition:', logError);
      // Don't throw error for logging failure
    }

    return participant;
  } catch (error) {
    console.error('Failed to add participant to pool:', error);
    throw error;
  }
}

// Remove participant from pool
export async function removeParticipantFromPool(participantId: string) {
  try {
    // Get the service role client to bypass RLS policies
    const { getSupabaseServiceClient } = await import('@/lib/supabase');
    const supabase = getSupabaseServiceClient();

    // First get the participant to get the pool_id for logging
    const { data: participant, error: fetchError } = await supabase
      .from('participants')
      .select('pool_id, name, email')
      .eq('id', participantId)
      .single();

    if (fetchError) {
      throw new Error(fetchError.message);
    }

    // Remove participant from pool
    const { error: deleteError } = await supabase
      .from('participants')
      .delete()
      .eq('id', participantId);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    // Log the action
    try {
      const { error: logError } = await supabase
        .from('audit_logs')
        .insert({
          action: 'remove_participant',
          admin_id: null, // Service role doesn't have a specific admin ID
          entity: 'participant',
          entity_id: participantId,
          details: { 
            participant_id: participantId,
            participant_name: participant.name,
            participant_email: participant.email,
            pool_id: participant.pool_id,
            action: 'participant_removed'
          }
        });
      
      if (logError) {
        console.warn('Failed to log participant removal:', logError);
      }
    } catch (logError) {
      console.warn('Failed to log participant removal:', logError);
      // Don't throw error for logging failure
    }

    return true;
  } catch (error) {
    console.error('Failed to remove participant from pool:', error);
    throw error;
  }
}

// Update participant name
export async function updateParticipantName(participantId: string, newName: string) {
  try {
    // Get the service role client to bypass RLS policies
    const { getSupabaseServiceClient } = await import('@/lib/supabase');
    const supabase = getSupabaseServiceClient();
    
    // First get the participant to get the pool_id for logging
    const { data: participant, error: fetchError } = await supabase
      .from('participants')
      .select('pool_id, name')
      .eq('id', participantId)
      .single();

    if (fetchError) {
      throw new Error(fetchError.message);
    }

    // Actually update the participant name in the database using service role
    const { error: updateError } = await supabase
      .from('participants')
      .update({ name: newName.trim() })
      .eq('id', participantId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    // Log the action
    try {
      const { error: logError } = await supabase
        .from('audit_logs')
        .insert({
          action: 'update_participant',
          admin_id: null, // Service role doesn't have a specific admin ID
          entity: 'participant',
          entity_id: participantId,
          details: { 
            participant_id: participantId, 
            old_name: participant.name,
            new_name: newName.trim(),
            action: 'name_updated',
            pool_id: participant.pool_id
          }
        });
      
      if (logError) {
        console.warn('Failed to log participant update:', logError);
      }
    } catch (logError) {
      console.warn('Failed to log participant update:', logError);
      // Don't throw error for logging failure
    }

    return true;
  } catch (error) {
    console.error('Failed to update participant name:', error);
    throw error;
  }
}

// Get all submissions for a week in a format suitable for screenshot
export async function getWeeklySubmissionsForScreenshot(poolId: string, week?: number, seasonType?: number) {
  try {
    // If no week provided, get the current week from games
    let weekToUse = week;
    let seasonTypeToUse = seasonType;
    
    if (!weekToUse || !seasonTypeToUse) {
      const { getCurrentWeekFromGames } = await import('./getCurrentWeekFromGames');
      const currentWeekData = await getCurrentWeekFromGames();
      weekToUse = weekToUse || currentWeekData.week;
      seasonTypeToUse = seasonTypeToUse || currentWeekData.seasonType;
    }
    
    // First get all games for the week and season type
    const { data: games, error: gamesError } = await getSupabaseClient()
      .from('games')
      .select('*')
      .eq('week', weekToUse)
      .eq('season_type', seasonTypeToUse)
      .order('kickoff_time', { ascending: true });

    if (gamesError) {
      console.error('Error fetching games for screenshot:', gamesError);
      return null;
    }

    if (!games || games.length === 0) {
      console.log('No games found for week:', weekToUse, 'season type:', seasonTypeToUse);
      return { games: [], participants: [] };
    }

    // Get game IDs for this week
    const gameIds = games.map(game => game.id);

    // Get all picks for the week
    const { data: picks, error: picksError } = await getSupabaseClient()
      .from('picks')
      .select(`
        participant_id,
        predicted_winner,
        confidence_points,
        game_id,
        games!inner(week, season_type)
      `)
      .eq('pool_id', poolId)
      .eq('games.week', weekToUse)
      .eq('games.season_type', seasonTypeToUse)
      .in('game_id', gameIds);
    
    if (picksError) {
      console.error('Error fetching picks for screenshot:', picksError);
      return null;
    }

    // Get all participants in the pool
    const { data: participants, error: participantsError } = await getSupabaseClient()
      .from('participants')
      .select('id, name')
      .eq('pool_id', poolId);

    if (participantsError) {
      console.error('Error fetching participants for screenshot:', participantsError);
      return null;
    }

    // Create a map of participant names
    const participantNames = new Map(participants?.map(p => [p.id, p.name]) || []);

    // Group picks by participant
    const participantsMap = new Map();
    
    picks?.forEach((pick: any) => {
      const participantId = pick.participant_id;
      const participantName = participantNames.get(participantId) || 'Unknown';
      
      if (!participantsMap.has(participantId)) {
        participantsMap.set(participantId, {
          name: participantName,
          picks: new Map()
        });
      }
      
      const participant = participantsMap.get(participantId);
      participant.picks.set(pick.game_id, {
        predicted_winner: pick.predicted_winner,
        confidence_points: pick.confidence_points
      });
    });

    const result = {
      games,
      participants: Array.from(participantsMap.values()),
      week: weekToUse,
      seasonType: seasonTypeToUse
    };

    return result;
  } catch (error) {
    console.error('Failed to get submissions for screenshot:', error);
    return null;
  }
}

// Get games for a week
export async function getWeekGames(week: number) {
  try {
    const { data, error } = await getSupabaseClient()
      .from('games')
      .select('*')
      .eq('week', week)
      .eq('is_active', true)
      .order('kickoff_time', { ascending: true });

    if (error) {
      console.error('Error fetching games:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Failed to get week games:', error);
    return [];
  }
} 