import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { debugLog, DUMMY_PLAYOFF_GAMES, isDummyData } from '@/lib/utils';

// GET - Get playoff games for a season and round
export async function GET(request: NextRequest) {
  if (isDummyData()) {
    debugLog('Using dummy data for playoff games');
    const { searchParams } = new URL(request.url);
    const week = searchParams.get('week'); // Round (1-4)
    
    let games = DUMMY_PLAYOFF_GAMES;
    
    // Filter by week if provided
    if (week) {
      const weekNumber = parseInt(week);
      games = games.filter(game => game.week === weekNumber);
    }
    
    return NextResponse.json({
      success: true,
      games: games
    });
  }

  debugLog('Using real data for playoff games');
  // Admin routes should always use real data from database, not dummy data
  try {
    const { searchParams } = new URL(request.url);
    const season = searchParams.get('season');
    const week = searchParams.get('week'); // Round (1-4)

    if (!season) {
      return NextResponse.json(
        { success: false, error: 'Season is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    let query = supabase
      .from('games')
      .select('*')
      .eq('season', parseInt(season))
      .eq('season_type', 3); // Postseason

    if (week) {
      query = query.eq('week', parseInt(week));
    }

    const { data: games, error } = await query.order('kickoff_time');

    if (error) {
      console.error('Error fetching playoff games:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch playoff games' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      games: games || []
    });

  } catch (error) {
    console.error('Error in playoff games GET API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create or update playoff games
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { season, games } = body;

    if (!season || !games || !Array.isArray(games)) {
      return NextResponse.json(
        { success: false, error: 'Season and games array are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // Validate games
    for (const game of games) {
      if (!game.week || !game.away_team || !game.home_team) {
        return NextResponse.json(
          { success: false, error: 'Each game must have week, away_team, and home_team' },
          { status: 400 }
        );
      }
      if (game.week < 1 || game.week > 4) {
        return NextResponse.json(
          { success: false, error: 'Week must be between 1 and 4' },
          { status: 400 }
        );
      }
    }

    // Get existing games for this season and season_type
    const { data: existingGames } = await supabase
      .from('games')
      .select('id, week, away_team, home_team, kickoff_time')
      .eq('season', season)
      .eq('season_type', 3);

    // Create maps for lookup: by key (week_away_home) and by ID
    const existingMap = new Map(); // key -> id
    const existingIds = new Set<string>(); // Set of all existing IDs
    const existingGamesById = new Map(); // id -> game object (for checking TBD status)
    
    (existingGames || []).forEach(game => {
      const key = `${game.week}_${game.away_team}_${game.home_team}`;
      existingMap.set(key, game.id);
      existingIds.add(game.id);
      existingGamesById.set(game.id, game);
    });

    const toInsert = [];
    const toUpdate = [];

    for (const game of games) {
      const key = `${game.week}_${game.away_team}_${game.home_team}`;
      const gameData: any = {
        season: parseInt(season),
        week: parseInt(game.week),
        season_type: 3, // Postseason
        away_team: game.away_team,
        home_team: game.home_team,
        is_playoff: true,
        status: game.status || 'scheduled',
        winner: game.winner || null
      };

      // Include ID only if provided (e.g., from ESPN)
      // If no ID is provided, don't include it and let the database generate one
      if (game.id) {
        gameData.id = game.id;
      }
      debugLog(`PLAYOFFS: Game Data for ${game.week} ${game.away_team} ${game.home_team}:`, gameData);

      if (game.kickoff_time) {
        gameData.kickoff_time = game.kickoff_time;
      } else {
        // Generate a default kickoff time if not provided
        const defaultDates: Record<number, string> = {
          1: `${season}-01-10T18:00:00Z`,
          2: `${season}-01-17T18:00:00Z`,
          3: `${season}-01-25T18:00:00Z`,
          4: `${season}-02-08T18:00:00Z`
        };
        gameData.kickoff_time = defaultDates[game.week] || new Date().toISOString();
      }

      // Check if game ID already exists in database
      if (game.id && existingIds.has(game.id)) {
        // Game with this ID already exists - update it (especially kickoff_time and teams if TBD or mismatched)
        const existingGame = existingGamesById.get(game.id);
        const hasTbdTeams = existingGame && 
          (existingGame.away_team === 'TBD' || existingGame.home_team === 'TBD');
        const hasNewTeams = game.away_team && game.away_team !== 'TBD' && 
                           game.home_team && game.home_team !== 'TBD';
        
        // Check if teams don't match (ESPN is source of truth)
        const teamsMatch = existingGame && hasNewTeams &&
          ((existingGame.away_team === game.away_team && existingGame.home_team === game.home_team) ||
           (existingGame.away_team === game.home_team && existingGame.home_team === game.away_team));
        const teamsDontMatch = existingGame && hasNewTeams && !teamsMatch && !hasTbdTeams;
        
        // Prepare update data
        const updateData: any = {
          id: game.id,
          kickoff_time: new Date(gameData.kickoff_time).toISOString(),
          status: gameData.status,
          is_playoff: gameData.is_playoff,
          winner: gameData.winner
        };
        
        // Update teams if:
        // 1. Existing game has TBD teams and we have actual team names from ESPN, OR
        // 2. Teams don't match (ESPN is correct and should override DB)
        if ((hasTbdTeams && hasNewTeams) || teamsDontMatch) {
          updateData.away_team = gameData.away_team;
          updateData.home_team = gameData.home_team;
          if (teamsDontMatch) {
            debugLog(`Updating game ${game.id}: DB teams (${existingGame.away_team} @ ${existingGame.home_team}) don't match ESPN teams (${game.away_team} @ ${game.home_team}), using ESPN data`);
          }
        }
        
        toUpdate.push(updateData);
      } else if (game.id) {
        // New game with ID from ESPN - check if key exists
        const existingKey = `${game.week}_${game.away_team}_${game.home_team}`;
        if (existingMap.has(existingKey)) {
          // Same teams but different ID - update existing game with new ID and data
          toUpdate.push({ id: existingMap.get(existingKey)!, ...gameData, id: game.id });
        } else {
          // Completely new game with ID
          toInsert.push(gameData);
        }
      } else if (existingMap.has(key)) {
        // Existing game without ID in request - update it
        toUpdate.push({ id: existingMap.get(key)!, ...gameData });
      } else {
        // New game without ID - database will generate one
        const { id, ...gameDataWithoutId } = gameData;
        toInsert.push(gameDataWithoutId);
      }
    }

    // Perform updates
    for (const game of toUpdate) {
      const { id: gameId, ...updateData } = game;
      // For updates, we don't change the ID, just update other fields
      const updatePayload: any = {};
      
      // Only include fields that should be updated
      if (updateData.kickoff_time) updatePayload.kickoff_time = updateData.kickoff_time;
      // Always include teams if they're in updateData (they're explicitly set when we want to update them)
      if ('away_team' in updateData) updatePayload.away_team = updateData.away_team;
      if ('home_team' in updateData) updatePayload.home_team = updateData.home_team;
      if (updateData.status) updatePayload.status = updateData.status;
      if (updateData.winner !== undefined) updatePayload.winner = updateData.winner;
      if (updateData.is_playoff !== undefined) updatePayload.is_playoff = updateData.is_playoff;
      
      const { error } = await supabase
        .from('games')
        .update(updatePayload)
        .eq('id', gameId);
      
      if (error) {
        console.error('Error updating game:', error);
        return NextResponse.json(
          { success: false, error: `Failed to update game ${gameId}` },
          { status: 500 }
        );
      }
    }

    // Perform inserts
    if (toInsert.length > 0) {
      const { error } = await supabase
        .from('games')
        .insert(toInsert);

      if (error) {
        console.error('Error inserting games:', error);
        return NextResponse.json(
          { success: false, error: 'Failed to insert games' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully ${toUpdate.length > 0 ? `updated ${toUpdate.length} game(s) and ` : ''}inserted ${toInsert.length} game(s)`
    });

  } catch (error) {
    console.error('Error in playoff games POST API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete playoff game
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Game ID is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    const { error } = await supabase
      .from('games')
      .delete()
      .eq('id', id)
      .eq('season_type', 3); // Only delete playoff games

    if (error) {
      console.error('Error deleting playoff game:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to delete playoff game' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Playoff game deleted successfully'
    });

  } catch (error) {
    console.error('Error in playoff games DELETE API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

