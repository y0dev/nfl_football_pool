import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';
import { emailService } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const { poolId, week, seasonType, adminEmail } = await request.json();
    
    if (!poolId || !week || !seasonType || !adminEmail) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // Get current user to check permissions
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const { data: admin } = await supabase
      .from('admins')
      .select('id, email, full_name, is_super_admin')
      .eq('id', session.user.id)
      .single();

    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Admin access required' },
        { status: 401 }
      );
    }

    // Get pool information
    const { data: pool, error: poolError } = await supabase
      .from('pools')
      .select('id, name, created_by')
      .eq('id', poolId)
      .single();

    if (poolError || !pool) {
      return NextResponse.json(
        { success: false, error: 'Pool not found' },
        { status: 404 }
      );
    }

    // Check permissions - only pool creator or super admin can send summaries
    if (!admin.is_super_admin && pool.created_by !== admin.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Can only send summaries for your own pools' },
        { status: 403 }
      );
    }

    // Get all participants for this pool
    const { data: participants, error: participantsError } = await supabase
      .from('participants')
      .select('id, name, email')
      .eq('pool_id', poolId)
      .eq('is_active', true);

    if (participantsError) {
      console.error('Error fetching participants:', participantsError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch participants' },
        { status: 500 }
      );
    }

    if (!participants || participants.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No participants found for this pool' },
        { status: 400 }
      );
    }

    // Get games for the week to determine deadline
    const { data: games } = await supabase
      .from('games')
      .select('kickoff_time')
      .eq('week', week)
      .eq('season_type', seasonType)
      .order('kickoff_time', { ascending: true })
      .limit(1);

    const submissionDeadline = games && games.length > 0 
      ? new Date(games[0].kickoff_time).toLocaleString()
      : 'No games scheduled';

    // Check which participants have submitted picks
    const participantIds = participants.map(p => p.id);
    const { data: picks } = await supabase
      .from('picks')
      .select('participant_id, games!inner(week, season_type)')
      .in('participant_id', participantIds)
      .eq('pool_id', poolId)
      .eq('games.week', week)
      .eq('games.season_type', seasonType);

    // Separate participants into submitted and pending
    const submittedParticipantIds = new Set(picks?.map(p => p.participant_id) || []);
    
    const submittedParticipants = participants.filter(p => submittedParticipantIds.has(p.id));
    const pendingParticipants = participants.filter(p => !submittedParticipantIds.has(p.id));

    // Send the email
    const emailSent = await emailService.sendAdminSubmissionSummary(
      adminEmail,
      admin.full_name || admin.email,
      pool.name,
      week,
      seasonType,
      submittedParticipants,
      pendingParticipants,
      participants.length,
      submissionDeadline
    );

    if (!emailSent) {
      return NextResponse.json(
        { success: false, error: 'Failed to send email' },
        { status: 500 }
      );
    }

    // Log the action
    await supabase
      .from('audit_logs')
      .insert({
        action: 'send_submission_summary',
        admin_id: admin.id,
        pool_id: poolId,
        details: JSON.stringify({
          pool_name: pool.name,
          week: week,
          season_type: seasonType,
          admin_email: adminEmail,
          total_participants: participants.length,
          submitted_count: submittedParticipants.length,
          pending_count: pendingParticipants.length,
          sent_at: new Date().toISOString()
        }),
        created_at: new Date().toISOString()
      });

    return NextResponse.json({
      success: true,
      message: 'Submission summary email sent successfully',
      data: {
        totalParticipants: participants.length,
        submittedCount: submittedParticipants.length,
        pendingCount: pendingParticipants.length,
        submissionRate: participants.length > 0 ? Math.round((submittedParticipants.length / participants.length) * 100) : 0
      }
    });

  } catch (error) {
    console.error('Error sending submission summary:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
