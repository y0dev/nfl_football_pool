import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { isDummyData } from '@/lib/utils';

// DELETE - Delete picks for a participant for a specific round
export async function DELETE(request: NextRequest) {
  if (isDummyData()) {
    return NextResponse.json({
      success: true,
      message: 'Picks deleted successfully'
    });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const poolId = searchParams.get('poolId');
    const participantId = searchParams.get('participantId');
    const round = searchParams.get('round');
    const season = searchParams.get('season');

    if (!poolId || !participantId || !round || !season) {
      return NextResponse.json(
        { success: false, error: 'Pool ID, participant ID, round, and season are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // Get game IDs for this round
    // Note: Games are shared across pools, so we don't filter by pool_id
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id')
      .eq('week', parseInt(round))
      .eq('season_type', 3)
      .eq('season', parseInt(season));

    if (gamesError) {
      console.error('Error fetching games:', gamesError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch games' },
        { status: 500 }
      );
    }

    if (!games || games.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No games found for this round'
      });
    }

    const gameIds = games.map(g => g.id);

    // Delete picks for these games
    const { error } = await supabase
      .from('picks')
      .delete()
      .eq('participant_id', participantId)
      .eq('pool_id', poolId)
      .in('game_id', gameIds);

    if (error) {
      console.error('Error deleting picks:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to delete picks' },
        { status: 500 }
      );
    }

    // Log the action
    await supabase
      .from('audit_logs')
      .insert({
        action: 'delete_playoff_picks',
        admin_id: null,
        entity: 'picks',
        entity_id: participantId,
        details: {
          pool_id: poolId,
          participant_id: participantId,
          round: parseInt(round),
          season: parseInt(season),
          game_ids: gameIds
        }
      });

    return NextResponse.json({
      success: true,
      message: 'Picks deleted successfully',
      deletedCount: gameIds.length
    });

  } catch (error) {
    console.error('Error in DELETE playoff picks API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

