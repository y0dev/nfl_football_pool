import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { debugError, debugLog, debugWarn } from '@/lib/utils';
import { nflAPI } from '@/lib/nfl-api';

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient();

    // Parse request body for custom sync options
    let requestBody;
    try {
      requestBody = await request.json();
    } catch (error) {
      // If no body provided, use default logic
      requestBody = {};
    }

    // Use provided timestamp or current moment
    const timestamp = requestBody.timestamp || new Date().toISOString();
    
    debugLog(`🏈 NFL Sync - Using ESPN API with timestamp: ${timestamp}`);

    // Fetch games using ESPN API with date endpoint
    const games = await nflAPI.getGamesWithDateEndpoint(timestamp);

    debugLog(`📡 Fetched ${games.length} games from ESPN API`);

    if (games.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No games found for the current date',
        gamesProcessed: 0,
        gamesUpdated: 0,
        gamesFailed: 0,
        endpoint: 'ESPN API with date endpoint'
      });
    }

    // Process and update games in batches
    const batchSize = 20;
    let successfulUpdates = 0;
    let failedGames = 0;
    const failedGameDetails: any[] = [];

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
            home_score: game.home_score || null,
            away_score: game.away_score || null,
            winner: game.status === 'finished' && game.home_score !== null && game.away_score !== null
              ? (game.home_score! > game.away_score! ? game.home_team : game.away_team)
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

    debugLog(`📊 NFL Sync Summary: ${successfulUpdates} successful, ${failedGames} failed`);

    return NextResponse.json({
      success: true,
      message: 'NFL data sync completed',
      gamesProcessed: games.length,
      gamesUpdated: successfulUpdates,
      gamesFailed: failedGames,
      failedGameDetails,
      endpoint: 'ESPN API with date endpoint',
      timestamp
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
