import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { debugError, debugLog, debugWarn } from '@/lib/utils';

const RAPIDAPI_HOST = 'nfl-api-data.p.rapidapi.com';
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

export async function POST(request: NextRequest) {
  try {
    // Validate environment variables
    if (!RAPIDAPI_KEY) {
      return NextResponse.json(
        { success: false, error: 'RAPIDAPI_KEY environment variable is not set' },
        { status: 500 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // Get current NFL week and season info
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    
    // Simple logic to determine season type and week
    // This could be enhanced with more sophisticated logic
    let seasonType = 2; // Default to regular season
    let week = 1;
    
    // Determine season type based on month
    const month = currentDate.getMonth() + 1;
    if (month >= 8 && month <= 9) {
      seasonType = 1; // Preseason
      week = Math.max(1, Math.floor((month - 8) * 4) + Math.floor(currentDate.getDate() / 7));
    } else if (month >= 10 && month <= 12) {
      seasonType = 2; // Regular season
      week = Math.max(1, Math.min(18, Math.floor((month - 10) * 4) + Math.floor(currentDate.getDate() / 7)));
    } else if (month >= 1 && month <= 2) {
      seasonType = 3; // Postseason
      week = Math.max(1, Math.min(5, Math.floor((month - 1) * 4) + Math.floor(currentDate.getDate() / 7)));
    }

    const endpoint = `https://${RAPIDAPI_HOST}/nfl-scoreboard-week-type?year=${year}&type=${seasonType}&week=${week}`;

    debugLog(`🏈 NFL Sync - Fetching from: ${endpoint}`);

    // Fetch data from RapidAPI
    const response = await fetch(endpoint, {
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': RAPIDAPI_HOST,
      },
      timeout: 30000,
    });

    if (!response.ok) {
      throw new Error(`RapidAPI request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const games = data.events || [];

    debugLog(`📡 Fetched ${games.length} games from RapidAPI`);

    if (games.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No games found for the current week',
        gamesProcessed: 0,
        gamesUpdated: 0,
        gamesFailed: 0,
        seasonType,
        week,
        year
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
          // Extract game data
          const competitors = game.competitions[0].competitors;
          const home = competitors.find((c: any) => c.homeAway === 'home');
          const away = competitors.find((c: any) => c.homeAway === 'away');

          if (!home || !away) {
            debugWarn(`⚠️ Skipping game ${game.id}: Missing competitor data`);
            continue;
          }

          // Normalize team names
          const homeTeam = normalizeTeamName(home.team.displayName);
          const awayTeam = normalizeTeamName(away.team.displayName);

          // Get scores
          const homeScore = parseInt(home.score || '0');
          const awayScore = parseInt(away.score || '0');

          // Determine winner
          let winner = null;
          if (game.status.type.completed) {
            if (homeScore > awayScore) {
              winner = homeTeam;
            } else if (awayScore > homeScore) {
              winner = awayTeam;
            }
          }

          // Map season type
          const apiSeasonType = game.season.type;
          let mappedSeasonType = 2; // Default to regular season
          if (apiSeasonType === 1) mappedSeasonType = 1; // Preseason
          else if (apiSeasonType === 3) mappedSeasonType = 3; // Postseason

          const payload = {
            id: game.id,
            week: game.week.number,
            season: game.season.year,
            season_type: mappedSeasonType,
            home_team: homeTeam,
            away_team: awayTeam,
            kickoff_time: game.date,
            home_score: homeScore,
            away_score: awayScore,
            winner: winner,
            status: determineStatus(game.status.type.description),
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
      seasonType,
      week,
      year,
      endpoint
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

// Helper function to normalize team names
function normalizeTeamName(teamName: string): string {
  const teamMappings: { [key: string]: string } = {
    'Kansas City Chiefs': 'Kansas City',
    'Buffalo Bills': 'Buffalo',
    'Miami Dolphins': 'Miami',
    'New England Patriots': 'New England',
    'New York Jets': 'NY Jets',
    'Baltimore Ravens': 'Baltimore',
    'Cincinnati Bengals': 'Cincinnati',
    'Cleveland Browns': 'Cleveland',
    'Pittsburgh Steelers': 'Pittsburgh',
    'Houston Texans': 'Houston',
    'Indianapolis Colts': 'Indianapolis',
    'Jacksonville Jaguars': 'Jacksonville',
    'Tennessee Titans': 'Tennessee',
    'Denver Broncos': 'Denver',
    'Las Vegas Raiders': 'Las Vegas',
    'Los Angeles Chargers': 'LA Chargers',
    'Dallas Cowboys': 'Dallas',
    'New York Giants': 'NY Giants',
    'Philadelphia Eagles': 'Philadelphia',
    'Washington Commanders': 'Washington',
    'Chicago Bears': 'Chicago',
    'Detroit Lions': 'Detroit',
    'Green Bay Packers': 'Green Bay',
    'Minnesota Vikings': 'Minnesota',
    'Atlanta Falcons': 'Atlanta',
    'Carolina Panthers': 'Carolina',
    'New Orleans Saints': 'New Orleans',
    'Tampa Bay Buccaneers': 'Tampa Bay',
    'Arizona Cardinals': 'Arizona',
    'Los Angeles Rams': 'LA Rams',
    'San Francisco 49ers': 'San Francisco',
    'Seattle Seahawks': 'Seattle'
  };

  return teamMappings[teamName] || teamName;
}

// Helper function to determine game status
function determineStatus(statusDescription: string): string {
  const statusMappings: { [key: string]: string } = {
    'Scheduled': 'scheduled',
    'Live': 'live',
    'Final': 'final',
    'Postponed': 'postponed',
    'Cancelled': 'cancelled',
    'Suspended': 'suspended',
    'Delayed': 'delayed'
  };

  return statusMappings[statusDescription] || 'scheduled';
}
