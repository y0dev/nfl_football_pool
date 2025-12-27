import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';

// GET - Get playoff games for a season and round
export async function GET(request: NextRequest) {
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
      .select('id, week, away_team, home_team')
      .eq('season', season)
      .eq('season_type', 3);

    const existingMap = new Map();
    (existingGames || []).forEach(game => {
      const key = `${game.week}_${game.away_team}_${game.home_team}`;
      existingMap.set(key, game.id);
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

      // Include ID if provided (e.g., from ESPN)
      if (game.id) {
        gameData.id = game.id;
      }

      if (game.kickoff_time) {
        gameData.kickoff_time = game.kickoff_time;
      } else {
        // Generate a default kickoff time if not provided
        const roundNames = { 1: 'Wild Card', 2: 'Divisional', 3: 'Conference Championship', 4: 'Super Bowl' };
        const defaultDates: Record<number, string> = {
          1: `${season}-01-10T18:00:00Z`,
          2: `${season}-01-17T18:00:00Z`,
          3: `${season}-01-25T18:00:00Z`,
          4: `${season}-02-08T18:00:00Z`
        };
        gameData.kickoff_time = defaultDates[game.week] || new Date().toISOString();
      }

      // If game has an ID and matches existing, update it
      if (game.id) {
        const existingKey = `${game.week}_${game.away_team}_${game.home_team}`;
        if (existingMap.has(existingKey)) {
          toUpdate.push({ id: existingMap.get(existingKey)!, ...gameData, id: game.id });
        } else if (existingMap.has(key)) {
          toUpdate.push({ id: existingMap.get(key)!, ...gameData, id: game.id });
        } else {
          // New game with ID from ESPN
          toInsert.push(gameData);
        }
      } else if (existingMap.has(key)) {
        toUpdate.push({ id: existingMap.get(key)!, ...gameData });
      } else {
        toInsert.push(gameData);
      }
    }

    // Perform updates
    for (const game of toUpdate) {
      const { id: gameId, ...updateData } = game;
      // If the game data includes an ID from ESPN, update it
      const updatePayload = updateData;
      if (game.id && game.id !== gameId) {
        // Update ID if it's different (e.g., adding ESPN ID to existing game)
        updatePayload.id = game.id;
      }
      
      const { error } = await supabase
        .from('games')
        .update(updatePayload)
        .eq('id', gameId);
      
      if (error) {
        console.error('Error updating game:', error);
        return NextResponse.json(
          { success: false, error: `Failed to update game` },
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

