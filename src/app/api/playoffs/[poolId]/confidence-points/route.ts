import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { debugLog } from '@/lib/utils';

interface ConfidencePointSubmission {
  participant_id: string;
  team_name: string;
  confidence_points: number;
}

// GET - Get playoff confidence points submissions status for a pool and season
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ poolId: string }> }
) {
  try {
    const { poolId } = await params;
    const { searchParams } = new URL(request.url);
    const season = searchParams.get('season');
    const participantId = searchParams.get('participantId');

    if (!season) {
      return NextResponse.json(
        { success: false, error: 'Season is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // Get pool season
    const { data: pool } = await supabase
      .from('pools')
      .select('season')
      .eq('id', poolId)
      .single();

    if (!pool) {
      return NextResponse.json(
        { success: false, error: 'Pool not found' },
        { status: 404 }
      );
    }

    const seasonNumber = parseInt(season);

    // Get all participants in the pool
    const { data: participants } = await supabase
      .from('participants')
      .select('id, name')
      .eq('pool_id', poolId)
      .eq('is_active', true);

    if (!participants || participants.length === 0) {
      return NextResponse.json({
        success: true,
        submissions: [],
        submissionCount: 0,
        totalParticipants: 0,
        allSubmitted: false
      });
    }

    // If participantId is provided, get their confidence points
    if (participantId) {
      const { data: confidencePoints, error } = await supabase
        .from('playoff_confidence_points')
        .select('*')
        .eq('participant_id', participantId)
        .eq('pool_id', poolId)
        .eq('season', seasonNumber)
        .order('confidence_points', { ascending: false });

      if (error) {
        console.error('Error fetching confidence points:', error);
        return NextResponse.json(
          { success: false, error: 'Failed to fetch confidence points' },
          { status: 500 }
        );
      }

      // Get playoff teams count to check if submission is complete
      const { data: teams } = await supabase
        .from('playoff_teams')
        .select('id')
        .eq('season', seasonNumber);

      const teamsCount = teams?.length || 0;
      const submissionCount = (confidencePoints?.length || 0);
      const hasSubmission = submissionCount > 0;
      const isCompleteSubmission = submissionCount === teamsCount && teamsCount > 0;

      return NextResponse.json({
        success: true,
        confidencePoints: confidencePoints || [],
        hasSubmission,
        isCompleteSubmission,
        submissionCount,
        totalTeams: teamsCount
      });
    } // End of if (participantId)

    // Get all submissions
    const { data: allSubmissions, error } = await supabase
      .from('playoff_confidence_points')
      .select('participant_id')
      .eq('pool_id', poolId)
      .eq('season', seasonNumber);

    if (error) {
      console.error('Error fetching submissions:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch submissions' },
        { status: 500 }
      );
    }

    debugLog('PLAYOFFS: allSubmissions', allSubmissions);

    // Get unique participant IDs who have submitted
    const submittedParticipantIds = new Set(
      (allSubmissions || []).map(s => s.participant_id)
    );

    debugLog('PLAYOFFS: submittedParticipantIds', submittedParticipantIds);

    // Get playoff teams count (playoff teams are the same for all pools)
    const { data: teams } = await supabase
      .from('playoff_teams')
      .select('id')
      .eq('season', seasonNumber);

    const teamsCount = teams?.length || 0;

    // Check if a participant has fully submitted (has confidence points for all teams)
    const submissionStatus = participants.map(participant => {
      const participantSubmissions = (allSubmissions || []).filter(
        s => s.participant_id === participant.id
      );
      const hasFullSubmission = participantSubmissions.length === teamsCount && teamsCount > 0;
      debugLog('PLAYOFFS: submissionStatus', participant.id, participant.name, hasFullSubmission, participantSubmissions.length, teamsCount);
      return {
        participant_id: participant.id,
        participant_name: participant.name,
        submitted: hasFullSubmission,
        submission_count: participantSubmissions.length,
        total_teams: teamsCount
      };
    });

    const submissionCount = submissionStatus.filter(s => s.submitted).length;
    const allSubmitted = submissionCount === participants.length && participants.length > 0;

    // If all submitted, include all confidence points
    let allConfidencePoints = null;
    if (allSubmitted) {
      const { data: allPoints } = await supabase
        .from('playoff_confidence_points')
        .select('*, participants(name)')
        .eq('pool_id', poolId)
        .eq('season', seasonNumber)
        .order('participant_id', { ascending: true })
        .order('confidence_points', { ascending: false });

      allConfidencePoints = allPoints || [];
    }

    return NextResponse.json({
      success: true,
      submissions: submissionStatus,
      submissionCount,
      totalParticipants: participants.length,
      allSubmitted,
      allConfidencePoints: allSubmitted ? allConfidencePoints : null
    });

  } catch (error) {
    console.error('Error in playoff confidence points GET API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Submit playoff confidence points
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ poolId: string }> }
) {
  try {
    const { poolId } = await params;
    const body: {
      participant_id: string;
      season: number;
      confidence_points: ConfidencePointSubmission[];
    } = await request.json();

    const { participant_id, season, confidence_points } = body;

    if (!participant_id || !season || !confidence_points || confidence_points.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Participant ID, season, and confidence points are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // Verify participant belongs to pool
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .select('id')
      .eq('id', participant_id)
      .eq('pool_id', poolId)
      .eq('is_active', true)
      .single();

    if (participantError || !participant) {
      return NextResponse.json(
        { success: false, error: 'Participant not found in pool' },
        { status: 404 }
      );
    }

    // Get playoff teams for validation (playoff teams are the same for all pools)
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

    // Check if already submitted
    const { data: existingSubmissions } = await supabase
      .from('playoff_confidence_points')
      .select('id')
      .eq('participant_id', participant_id)
      .eq('pool_id', poolId)
      .eq('season', season);

    const existingCount = existingSubmissions?.length || 0;
    const isCompleteSubmission = existingCount === teamsCount && teamsCount > 0;

    // If user has a complete submission (all teams), prevent updates
    if (isCompleteSubmission) {
      return NextResponse.json(
        { success: false, error: 'Confidence points already submitted for playoffs. Complete submissions cannot be changed.' },
        { status: 400 }
      );
    }

    // If user has partial submission, delete existing and insert new complete set
    if (existingCount > 0) {
      const { error: deleteError } = await supabase
        .from('playoff_confidence_points')
        .delete()
        .eq('participant_id', participant_id)
        .eq('pool_id', poolId)
        .eq('season', season);

      if (deleteError) {
        console.error('Error deleting existing partial submissions:', deleteError);
        return NextResponse.json(
          { success: false, error: 'Failed to update confidence points' },
          { status: 500 }
        );
      }
    }

    // Insert confidence points
    const insertData = confidence_points.map(cp => ({
      participant_id,
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
        { success: false, error: 'Failed to submit confidence points' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Playoff confidence points submitted successfully'
    });

  } catch (error) {
    console.error('Error in playoff confidence points POST API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

