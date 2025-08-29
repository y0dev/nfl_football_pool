import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const participantId = searchParams.get('participant_id');
    const poolId = searchParams.get('pool_id');
    const week = searchParams.get('week');
    const seasonType = searchParams.get('season_type');

    if (!participantId || !poolId || !week || !seasonType) {
      return NextResponse.json(
        { error: 'participant_id, pool_id, week, and season_type are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();
    
    // Get participant's picks for the specified week
    const { data: picksData, error } = await supabase
      .from('picks')
      .select(`
        id,
        game_id,
        predicted_winner,
        confidence_points,
        games!inner(
          home_team,
          away_team,
          week,
          season_type
        )
      `)
      .eq('participant_id', participantId)
      .eq('pool_id', poolId)
      .eq('games.week', parseInt(week))
      .eq('games.season_type', parseInt(seasonType))
      .order('confidence_points', { ascending: false });
    
    if (error) {
      console.error('Error loading participant picks:', error);
      return NextResponse.json(
        { error: 'Failed to load participant picks' },
        { status: 500 }
      );
    }

    if (!picksData || picksData.length === 0) {
      return NextResponse.json({
        picks: [],
        usedConfidenceNumbers: []
      });
    }

    // Get game details for the picks
    const gameIds = picksData.map(pick => pick.game_id);
    const { data: gamesData, error: gamesError } = await supabase
      .from('games')
      .select('id, home_team, away_team')
      .in('id', gameIds);

    if (gamesError) {
      console.error('Error loading games:', gamesError);
      return NextResponse.json(
        { error: 'Failed to load game details' },
        { status: 500 }
      );
    }

    // Create a map of game details
    const gamesMap = new Map(gamesData?.map(game => [game.id, game]) || []);
    
    // Combine picks with game details
    const picks = picksData
      .map(pick => {
        const game = gamesMap.get(pick.game_id);
        if (!game) return null;
        
        return {
          id: pick.id,
          game_id: pick.game_id,
          home_team: game.home_team,
          away_team: game.away_team,
          confidence: pick.confidence_points,
          winner: pick.predicted_winner
        };
      })
      .filter(pick => pick !== null);
    
    // Track used confidence numbers (exclude 0 values)
    const usedConfidenceNumbers = picks
      .map(pick => pick.confidence)
      .filter(conf => conf !== 0);
    
    return NextResponse.json({
      picks,
      usedConfidenceNumbers
    });
    
  } catch (error) {
    console.error('Error in participant-picks API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
