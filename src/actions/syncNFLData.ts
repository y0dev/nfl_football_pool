import { supabase } from '@/lib/supabase';
import { nflAPI } from '@/lib/nfl-api';

// Sync teams from NFL API to our database
export async function syncTeams(season: number) {
  try {
    console.log(`Syncing teams for season ${season}...`);
    
    const teams = await nflAPI.getTeams(season);
    
    if (teams.length === 0) {
      console.log('No teams found from API');
      return { success: false, message: 'No teams found' };
    }

    // Insert teams into database
    const { data, error } = await supabase
      .from('teams')
      .upsert(
        teams.map(team => ({
          id: team.id,
          name: team.name,
          city: team.city,
          abbreviation: team.abbreviation,
          conference: team.conference,
          division: team.division,
          season: season,
          is_active: true
        })),
        { onConflict: 'id,season' }
      );

    if (error) {
      console.error('Error syncing teams:', error);
      return { success: false, message: error.message };
    }

    console.log(`Successfully synced ${teams.length} teams`);
    return { success: true, count: teams.length };
  } catch (error) {
    console.error('Failed to sync teams:', error);
    return { success: false, message: 'Failed to sync teams' };
  }
}

// Sync games for a specific week
export async function syncWeekGames(season: number, week: number) {
  try {
    console.log(`Syncing games for season ${season}, week ${week}...`);
    
    const games = await nflAPI.getWeekGames(season, week);
    
    if (games.length === 0) {
      console.log(`No games found for week ${week}`);
      return { success: false, message: 'No games found' };
    }

    // Insert games into database
    const { data, error } = await supabase
      .from('games')
      .upsert(
        games.map(game => ({
          id: game.id,
          week: game.week,
          season: game.season,
          home_team: game.home_team,
          away_team: game.away_team,
          kickoff_time: game.time,
          home_score: game.home_score || null,
          away_score: game.away_score || null,
          winner: game.status === 'finished' && game.home_score !== null && game.away_score !== null
            ? (game.home_score > game.away_score ? game.home_team : game.away_team)
            : null,
          status: game.status,
          home_team_id: game.home_team_id,
          away_team_id: game.away_team_id,
          is_active: true
        })),
        { onConflict: 'id' }
      );

    if (error) {
      console.error('Error syncing games:', error);
      return { success: false, message: error.message };
    }

    console.log(`Successfully synced ${games.length} games for week ${week}`);
    return { success: true, count: games.length };
  } catch (error) {
    console.error('Failed to sync games:', error);
    return { success: false, message: 'Failed to sync games' };
  }
}

// Sync all regular season games
export async function syncRegularSeason(season: number) {
  try {
    console.log(`Syncing regular season for ${season}...`);
    
    let totalGames = 0;
    const results = [];

    // Sync weeks 1-18 (regular season)
    for (let week = 1; week <= 18; week++) {
      const result = await syncWeekGames(season, week);
      results.push({ week, ...result });
      
      if (result.success) {
        totalGames += result.count || 0;
      }
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`Regular season sync complete. Total games: ${totalGames}`);
    return { success: true, totalGames, results };
  } catch (error) {
    console.error('Failed to sync regular season:', error);
    return { success: false, message: 'Failed to sync regular season' };
  }
}

// Sync playoff games
export async function syncPlayoffs(season: number) {
  try {
    console.log(`Syncing playoffs for ${season}...`);
    
    const playoffGames = await nflAPI.getPlayoffGames(season);
    
    if (playoffGames.length === 0) {
      console.log('No playoff games found');
      return { success: false, message: 'No playoff games found' };
    }

    // Insert playoff games into database
    const { data, error } = await supabase
      .from('games')
      .upsert(
        playoffGames.map(game => ({
          id: game.id,
          week: game.week,
          season: game.season,
          home_team: game.home_team,
          away_team: game.away_team,
          kickoff_time: game.time,
          home_score: game.home_score || null,
          away_score: game.away_score || null,
          winner: game.status === 'finished' && game.home_score !== null && game.away_score !== null
            ? (game.home_score > game.away_score ? game.home_team : game.away_team)
            : null,
          status: game.status,
          home_team_id: game.home_team_id,
          away_team_id: game.away_team_id,
          is_playoff: true,
          is_active: true
        })),
        { onConflict: 'id' }
      );

    if (error) {
      console.error('Error syncing playoff games:', error);
      return { success: false, message: error.message };
    }

    console.log(`Successfully synced ${playoffGames.length} playoff games`);
    return { success: true, count: playoffGames.length };
  } catch (error) {
    console.error('Failed to sync playoffs:', error);
    return { success: false, message: 'Failed to sync playoffs' };
  }
}

// Sync current week games
export async function syncCurrentWeek(season: number) {
  try {
    console.log(`Syncing current week for ${season}...`);
    
    const currentWeek = await nflAPI.getCurrentWeek(season);
    
    if (!currentWeek) {
      console.log('Could not determine current week');
      return { success: false, message: 'Could not determine current week' };
    }

    console.log(`Current week is ${currentWeek.week_number}`);
    return await syncWeekGames(season, currentWeek.week_number);
  } catch (error) {
    console.error('Failed to sync current week:', error);
    return { success: false, message: 'Failed to sync current week' };
  }
}

// Update game scores (for admin use)
export async function updateGameScore(gameId: string, homeScore: number, awayScore: number) {
  try {
    const winner = homeScore > awayScore ? 'home' : awayScore > homeScore ? 'away' : null;
    
    const { data, error } = await supabase
      .from('games')
      .update({
        home_score: homeScore,
        away_score: awayScore,
        winner: winner,
        status: 'finished',
        updated_at: new Date().toISOString()
      })
      .eq('id', gameId);

    if (error) {
      console.error('Error updating game score:', error);
      return { success: false, message: error.message };
    }

    console.log(`Updated game ${gameId} score: ${awayScore} - ${homeScore}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to update game score:', error);
    return { success: false, message: 'Failed to update game score' };
  }
}

// Get sync status
export async function getSyncStatus(season: number) {
  try {
    const { data: games, error } = await supabase
      .from('games')
      .select('week, status')
      .eq('season', season)
      .eq('is_active', true);

    if (error) {
      console.error('Error getting sync status:', error);
      return { success: false, message: error.message };
    }

    const weekCounts = games.reduce((acc: any, game) => {
      acc[game.week] = (acc[game.week] || 0) + 1;
      return acc;
    }, {});

    const finishedGames = games.filter(game => game.status === 'finished').length;
    const totalGames = games.length;

    return {
      success: true,
      totalGames,
      finishedGames,
      weekCounts,
      completionPercentage: totalGames > 0 ? (finishedGames / totalGames) * 100 : 0
    };
  } catch (error) {
    console.error('Failed to get sync status:', error);
    return { success: false, message: 'Failed to get sync status' };
  }
} 