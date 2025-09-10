import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const week = searchParams.get('week');
    const seasonType = searchParams.get('season_type');
    const season = searchParams.get('season') || '2025';

    if (!week || !seasonType) {
      return NextResponse.json(
        { error: 'Week and season_type are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();
    
    // Get all games for the specified week
    const { data: games, error } = await supabase
      .from('games')
      .select('status, winner')
      .eq('week', parseInt(week))
      .eq('season_type', parseInt(seasonType))
      .eq('season', parseInt(season));
    
    if (error) {
      console.error('Error checking week status:', error);
      return NextResponse.json(
        { error: 'Failed to check week status' },
        { status: 500 }
      );
    }
    
    // Check if all games are properly finished with both status and winner
    const allGamesCompleted = games && games.length > 0 && games.every(game => {
      const status = game.status?.toLowerCase();
      const hasWinner = game.winner && game.winner.trim() !== '';
      const isFinished = status === 'final' || status === 'post' || status === 'cancelled';
      return isFinished && hasWinner;
    });
    
    const completedGames = games?.filter(game => {
      const status = game.status?.toLowerCase();
      const hasWinner = game.winner && game.winner.trim() !== '';
      const isFinished = status === 'final' || status === 'post' || status === 'cancelled';
      return isFinished && hasWinner;
    }).length || 0;

    return NextResponse.json({
      week: parseInt(week),
      season_type: parseInt(seasonType),
      season: parseInt(season),
      isCompleted: allGamesCompleted,
      totalGames: games?.length || 0,
      completedGames: completedGames
    });
    
  } catch (error) {
    console.error('Error in week-status API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
