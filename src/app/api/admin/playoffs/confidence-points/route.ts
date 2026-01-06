import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { isDummyData } from '@/lib/utils';

interface ConfidencePointSubmission {
  team_name: string;
  confidence_points: number;
}

// PUT - Update confidence points for a participant (admin only, bypasses normal restrictions)
export async function PUT(request: NextRequest) {
  if (isDummyData()) {
    return NextResponse.json({
      success: true,
      message: 'Confidence points updated successfully'
    });
  }

  try {
    const body: {
      poolId: string;
      participantId: string;
      season: number;
      confidence_points: ConfidencePointSubmission[];
    } = await request.json();

    const { poolId, participantId, season, confidence_points } = body;

    if (!poolId || !participantId || !season || !confidence_points || confidence_points.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Pool ID, participant ID, season, and confidence points are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // Verify participant belongs to pool
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .select('id')
      .eq('id', participantId)
      .eq('pool_id', poolId)
      .eq('is_active', true)
      .single();

    if (participantError || !participant) {
      return NextResponse.json(
        { success: false, error: 'Participant not found in pool' },
        { status: 404 }
      );
    }

    // Get playoff teams for validation
    const { data: playoffTeams } = await supabase
      .from('playoff_teams')
      .select('team_name')
      .eq('season', season);

    if (!playoffTeams || playoffTeams.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No playoff teams found for this season' },
        { status: 400 }
      );
    }

    const teamNames = new Set(playoffTeams.map(t => t.team_name));
    const teamsCount = teamNames.size;

    // Validate that all teams are included and all confidence points are unique
    const submittedTeamNames = new Set(confidence_points.map(cp => cp.team_name));
    const confidencePoints = confidence_points.map(cp => cp.confidence_points);
    const uniquePoints = new Set(confidencePoints);

    if (submittedTeamNames.size !== teamNames.size) {
      return NextResponse.json(
        { success: false, error: 'Must submit confidence points for all playoff teams' },
        { status: 400 }
      );
    }

    if (uniquePoints.size !== confidence_points.length) {
      return NextResponse.json(
        { success: false, error: 'Confidence points must be unique' },
        { status: 400 }
      );
    }

    // Validate all teams are valid
    for (const cp of confidence_points) {
      if (!teamNames.has(cp.team_name)) {
        return NextResponse.json(
          { success: false, error: `Invalid team: ${cp.team_name}` },
          { status: 400 }
        );
      }
      if (cp.confidence_points <= 0) {
        return NextResponse.json(
          { success: false, error: 'Confidence points must be greater than 0' },
          { status: 400 }
        );
      }
    }

    // Delete existing confidence points (admin can override complete submissions)
    const { error: deleteError } = await supabase
      .from('playoff_confidence_points')
      .delete()
      .eq('participant_id', participantId)
      .eq('pool_id', poolId)
      .eq('season', season);

    if (deleteError) {
      console.error('Error deleting existing confidence points:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Failed to update confidence points' },
        { status: 500 }
      );
    }

    // Insert new confidence points
    const insertData = confidence_points.map(cp => ({
      participant_id: participantId,
      pool_id: poolId,
      season,
      team_name: cp.team_name,
      confidence_points: cp.confidence_points
    }));

    const { error: insertError } = await supabase
      .from('playoff_confidence_points')
      .insert(insertData);

    if (insertError) {
      console.error('Error inserting confidence points:', insertError);
      return NextResponse.json(
        { success: false, error: 'Failed to update confidence points' },
        { status: 500 }
      );
    }

    // Log the action
    await supabase
      .from('audit_logs')
      .insert({
        action: 'update_playoff_confidence_points',
        admin_id: null,
        entity: 'playoff_confidence_points',
        entity_id: participantId,
        details: {
          pool_id: poolId,
          participant_id: participantId,
          season
        }
      });

    return NextResponse.json({
      success: true,
      message: 'Confidence points updated successfully'
    });

  } catch (error) {
    console.error('Error in PUT playoff confidence points API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete confidence points for a participant
export async function DELETE(request: NextRequest) {
  if (isDummyData()) {
    return NextResponse.json({
      success: true,
      message: 'Confidence points deleted successfully'
    });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const poolId = searchParams.get('poolId');
    const participantId = searchParams.get('participantId');
    const season = searchParams.get('season');

    if (!poolId || !participantId || !season) {
      return NextResponse.json(
        { success: false, error: 'Pool ID, participant ID, and season are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // Check if any playoff games have started - if so, prevent deletion
    // Note: Games are shared across pools, so we don't filter by pool_id
    const { data: playoffGames, error: gamesError } = await supabase
      .from('games')
      .select('id, kickoff_time, status')
      .eq('season_type', 3) // Playoff games
      .eq('season', parseInt(season));

    if (gamesError) {
      console.error('Error fetching playoff games:', gamesError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch playoff games' },
        { status: 500 }
      );
    }

    // Check if any games have started - use game status as the source of truth
    const hasStartedGames = playoffGames?.some((game: any) => {
      const status = game.status?.toLowerCase();
      // Game has started if status is live, final, post, or cancelled
      if (status === 'live' || status === 'final' || status === 'post' || status === 'cancelled') {
        return true;
      }
      return false;
    });

    if (hasStartedGames) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete confidence points: playoff rounds have already started' },
        { status: 400 }
      );
    }

    const gameIds = playoffGames?.map(g => g.id) || [];
    let deletedPicksCount = 0;

    // Delete all playoff picks for this participant if there are games
    if (gameIds.length > 0) {
      const { error: picksError, count } = await supabase
        .from('picks')
        .delete({ count: 'exact' })
        .eq('participant_id', participantId)
        .eq('pool_id', poolId)
        .in('game_id', gameIds);

      if (picksError) {
        console.error('Error deleting playoff picks:', picksError);
        // Continue with confidence points deletion even if picks deletion fails
      } else {
        deletedPicksCount = count || 0;
      }
    }

    // Delete confidence points
    const { error } = await supabase
      .from('playoff_confidence_points')
      .delete()
      .eq('participant_id', participantId)
      .eq('pool_id', poolId)
      .eq('season', parseInt(season));

    if (error) {
      console.error('Error deleting confidence points:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to delete confidence points' },
        { status: 500 }
      );
    }

    // Log the action
    await supabase
      .from('audit_logs')
      .insert({
        action: 'delete_playoff_confidence_points',
        admin_id: null,
        entity: 'playoff_confidence_points',
        entity_id: participantId,
        details: {
          pool_id: poolId,
          participant_id: participantId,
          season: parseInt(season),
          deleted_picks_count: deletedPicksCount
        }
      });

    return NextResponse.json({
      success: true,
      message: `Confidence points and ${deletedPicksCount} round pick${deletedPicksCount !== 1 ? 's' : ''} deleted successfully`,
      deletedPicksCount
    });

  } catch (error) {
    console.error('Error in DELETE playoff confidence points API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

