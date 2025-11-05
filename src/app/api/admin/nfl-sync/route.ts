import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { debugError, debugLog } from '@/lib/utils';
import { nflAPI } from '@/lib/nfl-api';

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient();

    // Parse request body for custom sync options
    let requestBody;
    try {
      requestBody = await request.json();
    } catch {
      // If no body provided, use default logic
      requestBody = {};
    }
    
    // Use provided timestamp or current moment
    const timestamp = requestBody.timestamp || new Date().toISOString();
    const shouldUpdateGames = requestBody.updateGames !== false; // Default to true
    const shouldUpdateTeamRecords = requestBody.updateTeamRecords !== false; // Default to true
    
    let teamRecordsUpdated = 0;
    let teamRecordsUpdatedFlag = false;
    
    // Update team records from ESPN API (independent of games)
    if (shouldUpdateTeamRecords) {
      try {
        // Extract season from timestamp
        const timestampDate = new Date(timestamp);
        const season = timestampDate.getFullYear();
        
        const recordsCount = await updateTeamRecords(supabase, season);
        teamRecordsUpdated = recordsCount || 0;
        teamRecordsUpdatedFlag = true;
        debugLog(`✅ Team records updated successfully for season ${season}: ${teamRecordsUpdated} records`);
      } catch (error) {
        debugError(`❌ Failed to update team records:`, error);
        teamRecordsUpdatedFlag = false;
        // Don't fail the entire sync if team records update fails
      }
    }
    
    let games: Array<{
      id: string;
      week: number;
      season: number;
      season_type: number;
      home_team: string;
      away_team: string;
      time: string;
      home_score?: number;
      away_score?: number;
      status: string;
      home_team_id?: string;
      away_team_id?: string;
    }> = [];
    let successfulUpdates = 0;
    let failedGames = 0;
    const failedGameDetails: Array<{
      gameId: string;
      error: string;
    }> = [];
    
    // Update games if requested
    if (shouldUpdateGames) {
      debugLog(`🏈 NFL Sync - Using ESPN API with timestamp: ${timestamp}`);

      // Fetch games using ESPN API with date endpoint
      games = await nflAPI.getGamesWithDateEndpoint(timestamp);

      debugLog(`📡 Fetched ${games.length} games from ESPN API`);

      if (games.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No games found for the current date',
          gamesProcessed: 0,
          gamesUpdated: 0,
          gamesFailed: 0,
          week: 1,
          year: new Date().getFullYear(),
          seasonType: 2,
          endpoint: 'ESPN API with date endpoint',
          gamesUpdatedFlag: shouldUpdateGames,
          teamRecordsUpdatedFlag: teamRecordsUpdatedFlag,
          teamRecordsUpdated: teamRecordsUpdated
        });
      }

      // Process and update games in batches
      const batchSize = 20;

      for (let i = 0; i < games.length; i += batchSize) {
      const batch = games.slice(i, i + batchSize);
      const batchPayloads = [];

      for (const game of batch) {
        try {
          const payload = {
            id: game.id,
            week: game.week,
            season: game.season,
            season_type: game.season_type,
            home_team: game.home_team,
            away_team: game.away_team,
            kickoff_time: game.time,
            home_score: game.home_score !== undefined ? game.home_score : null,
            away_score: game.away_score !== undefined ? game.away_score : null,
            winner: game.status === 'finished' && game.home_score !== undefined && game.away_score !== undefined
              ? (game.home_score > game.away_score ? game.home_team : game.away_team)
              : null,
            status: determineStatus(game.status),
            home_team_id: game.home_team_id,
            away_team_id: game.away_team_id,
            is_active: true,
            updated_at: new Date().toISOString()
          };

          batchPayloads.push(payload);

        } catch (error) {
          debugError(`❌ Error processing game ${game.id}:`, error);
          failedGames++;
          failedGameDetails.push({
            gameId: game.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Execute batch upsert
      if (batchPayloads.length > 0) {
        try {
          const { error } = await supabase
            .from('games')
            .upsert(batchPayloads, {
              onConflict: 'id',
              ignoreDuplicates: false
            });

          if (error) {
            debugError(`❌ Batch upsert failed:`, error);
            failedGames += batchPayloads.length;
            failedGameDetails.push(...batchPayloads.map(payload => ({
              gameId: payload.id,
              error: `Batch upsert failed: ${error.message}`
            })));
          } else {
            successfulUpdates += batchPayloads.length;
            debugLog(`✅ Batch ${Math.floor(i / batchSize) + 1}: Updated ${batchPayloads.length} games`);
          }

        } catch (error) {
          debugError(`❌ Batch ${Math.floor(i / batchSize) + 1} exception:`, error);
          failedGames += batchPayloads.length;
          failedGameDetails.push(...batchPayloads.map(payload => ({
            gameId: payload.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          })));
        }

        // Add delay between batches to prevent rate limiting
        if (i + batchSize < games.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      }

      if (shouldUpdateGames) {
        debugLog(`📊 NFL Sync Summary: ${successfulUpdates} successful, ${failedGames} failed`);
      }
    }

    // Extract week, season, and season_type from the first game (they should all be the same)
    const firstGame = games.length > 0 ? games[0] : null;
    const week = firstGame?.week || 1;
    const year = firstGame?.season || new Date().getFullYear();
    const seasonType = firstGame?.season_type || 2;

    // Determine overall success
    const overallSuccess = (!shouldUpdateGames || successfulUpdates > 0 || games.length === 0) && 
                          (!shouldUpdateTeamRecords || teamRecordsUpdatedFlag);

    return NextResponse.json({
      success: overallSuccess,
      message: shouldUpdateGames && shouldUpdateTeamRecords 
        ? `NFL data sync completed: ${successfulUpdates} games, ${teamRecordsUpdated} team records`
        : shouldUpdateGames 
          ? `NFL games sync completed: ${successfulUpdates} games`
          : `Team records sync completed: ${teamRecordsUpdated} records`,
      gamesProcessed: games.length,
      gamesUpdated: successfulUpdates,
      gamesFailed: failedGames,
      failedGameDetails: failedGameDetails.length > 0 ? failedGameDetails : undefined,
      week,
      year,
      seasonType,
      endpoint: 'ESPN API with date endpoint',
      timestamp,
      gamesUpdatedFlag: shouldUpdateGames,
      teamRecordsUpdatedFlag: teamRecordsUpdatedFlag,
      teamRecordsUpdated: teamRecordsUpdated
    });

  } catch (error) {
    debugError('❌ NFL Sync error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Helper function to determine game status
function determineStatus(status: string): string {
  // ESPN API returns status values like 'scheduled', 'live', 'finished'
  // Map them to our database values
  const statusMappings: { [key: string]: string } = {
    'scheduled': 'scheduled',
    'live': 'live',
    'finished': 'final',
    'post': 'final',
    'in': 'live',
    'pre': 'scheduled',
    'postponed': 'postponed',
    'cancelled': 'cancelled',
    'suspended': 'suspended',
    'delayed': 'delayed'
  };

  return statusMappings[status] || 'scheduled';
}

// Function to update team records from ESPN API team endpoints
async function updateTeamRecords(supabase: ReturnType<typeof getSupabaseServiceClient>, season: number) {
  try {
    if (!season) {
      debugLog('⚠️ No season provided, skipping team records update');
      return;
    }

    debugLog(`📊 Fetching team records from ESPN API for season ${season}`);

    // Get all team IDs from ESPN API
    const teamIds = await nflAPI.getAllTeamIds();
    debugLog(`📋 Found ${teamIds.length} team IDs from ESPN API`);

    if (teamIds.length === 0) {
      debugLog('⚠️ No team IDs found, skipping team records update');
      return;
    }

    // Get all teams for this season to map ESPN team IDs to database UUIDs
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, name, abbreviation')
      .eq('season', season)
      .eq('is_active', true);

    if (teamsError) {
      debugError('❌ Error fetching teams:', teamsError);
      return;
    }

    // Create a map of ESPN team ID to database team UUID
    // Try to match by espn_id first, then by abbreviation
    const teamMap = new Map<string, string>();
    teams?.forEach((team: { name: string; abbreviation: string; id: string }) => {
      // Also map by abbreviation for fallback
      teamMap.set(team.abbreviation.toLowerCase(), team.id);
    });
    console.log('teamMap', teamMap);

    // Fetch team records from ESPN API
    const teamRecordsMap = new Map<string, {
      team_id: string;
      wins: number;
      losses: number;
      ties: number;
      home_wins?: number;
      home_losses?: number;
      home_ties?: number;
      road_wins?: number;
      road_losses?: number;
      road_ties?: number;
    }>();

    // Fetch records for each team (with rate limiting)
    for (let i = 0; i < teamIds.length; i++) {
      const espnTeamId = teamIds[i];
      
      try {
        const teamRecord = await nflAPI.getTeamRecord(espnTeamId);
        
        if (teamRecord) {
          // Try to find database team UUID
          const dbTeamId = teamMap.get(espnTeamId) || teamMap.get(teamRecord.abbreviation.toLowerCase());
          
          if (dbTeamId) {
            teamRecordsMap.set(dbTeamId, {
              team_id: dbTeamId,
              wins: teamRecord.wins || 0,
              losses: teamRecord.losses || 0,
              ties: teamRecord.ties || 0,
              home_wins: teamRecord.home_wins,
              home_losses: teamRecord.home_losses,
              home_ties: teamRecord.home_ties,
              road_wins: teamRecord.road_wins,
              road_losses: teamRecord.road_losses,
              road_ties: teamRecord.road_ties
            });
          } else {
            debugLog(`⚠️ Could not find database team for ESPN team ${espnTeamId} (${teamRecord.abbreviation})`);
          }
        }
        
        // Rate limiting: wait 100ms between requests
        if (i < teamIds.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        debugError(`❌ Error fetching record for team ${espnTeamId}:`, error);
        // Continue with other teams
      }
    }

    debugLog(`✅ Fetched ${teamRecordsMap.size} team records from ESPN API`);

    // Update team_records table
    const recordsToUpsert = Array.from(teamRecordsMap.values()).map((record) => ({
      team_id: record.team_id,
      season: season,
      wins: record.wins,
      losses: record.losses,
      ties: record.ties,
      home_wins: record.home_wins || 0,
      home_losses: record.home_losses || 0,
      home_ties: record.home_ties || 0,
      road_wins: record.road_wins || 0,
      road_losses: record.road_losses || 0,
      road_ties: record.road_ties || 0,
      division_wins: 0, // Division records not available from ESPN
      division_losses: 0,
      division_ties: 0,
      conference_wins: 0, // Not available from ESPN records
      conference_losses: 0,
      conference_ties: 0,
      updated_at: new Date().toISOString()
    }));

    if (recordsToUpsert.length > 0) {
      const { error: upsertError } = await supabase
        .from('team_records')
        .upsert(recordsToUpsert, {
          onConflict: 'team_id,season',
          ignoreDuplicates: false
        });

      if (upsertError) {
        debugError('❌ Error upserting team records:', upsertError);
        return 0;
      } else {
        debugLog(`✅ Updated ${recordsToUpsert.length} team records for season ${season}`);
        return recordsToUpsert.length;
      }
    }
    return 0;
  } catch (error) {
    debugError('❌ Error updating team records:', error);
    throw error;
  }
}
