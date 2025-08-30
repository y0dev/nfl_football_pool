import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { participantIds, week, seasonType } = await request.json();
    
    if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No participants selected' },
        { status: 400 }
      );
    }

    if (!week || !seasonType) {
      return NextResponse.json(
        { success: false, error: 'Week and season type are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // Get participant details
    const { data: participants, error: participantsError } = await supabase
      .from('participants')
      .select(`
        id,
        name,
        email,
        pool_id,
        pools!inner(name, created_by)
      `)
      .in('id', participantIds)
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
        { success: false, error: 'No valid participants found' },
        { status: 400 }
      );
    }

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
      .select('is_super_admin')
      .eq('id', session.user.id)
      .single();

    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Admin access required' },
        { status: 401 }
      );
    }

    // For non-admins, verify they can only send reminders to their own pools
    if (!admin.is_super_admin) {
      const userPools = participants.filter(p => p.pools.created_by === session.user.email);
      if (userPools.length !== participants.length) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized - Can only send reminders to your own pools' },
          { status: 403 }
        );
      }
    }

    // Get games for the week to include in the reminder
    const { data: games } = await supabase
      .from('games')
      .select('home_team, away_team, kickoff_time')
      .eq('week', week)
      .eq('season_type', seasonType)
      .order('kickoff_time');

    // Send reminder emails and log them
    const reminderPromises = participants.map(async (participant) => {
      try {
        // Send email reminder (this would integrate with your email service)
        await sendReminderEmail(participant, games, week, seasonType);
        
        // Log the reminder
        await supabase
          .from('reminder_logs')
          .insert({
            participant_id: participant.id,
            pool_id: participant.pool_id,
            week: week,
            season_type: seasonType,
            sent_by: session.user.id,
            email_sent: true,
            created_at: new Date().toISOString()
          });

        return { success: true, participantId: participant.id };
      } catch (error) {
        console.error(`Error sending reminder to ${participant.email}:`, error);
        return { success: false, participantId: participant.id, error };
      }
    });

    const results = await Promise.all(reminderPromises);
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    // Log the bulk action
    await supabase
      .from('audit_logs')
      .insert({
        action: 'send_reminders',
        admin_id: session.user.id,
        entity: 'participants',
        entity_id: null, // Multiple participants
        details: {
          participant_ids: participantIds,
          week: week,
          season_type: seasonType,
          successful: successful,
          failed: failed,
          total: participants.length
        }
      });

    return NextResponse.json({
      success: true,
      message: `Successfully sent ${successful} reminder(s)`,
      results: {
        successful,
        failed,
        total: participants.length
      }
    });

  } catch (error) {
    console.error('Error sending reminders:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function sendReminderEmail(participant: any, games: any[], week: number, seasonType: number) {
  // This is a placeholder for email sending functionality
  // You would integrate with your preferred email service here (SendGrid, AWS SES, etc.)
  
  const seasonTypeNames = { 1: 'Preseason', 2: 'Regular Season', 3: 'Postseason' };
  const seasonName = seasonTypeNames[seasonType as keyof typeof seasonTypeNames] || 'Season';
  
  const emailContent = {
    to: participant.email,
    subject: `Reminder: Submit Your Picks for ${participant.pools.name} - Week ${week}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1f2937;">NFL Confidence Pool Reminder</h2>
        <p>Hi ${participant.name},</p>
        <p>This is a friendly reminder that you haven't submitted your picks for <strong>${participant.pools.name}</strong> - Week ${week} (${seasonName}).</p>
        
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Week ${week} Games:</h3>
          ${games.map(game => `
            <div style="margin: 10px 0; padding: 10px; background-color: white; border-radius: 4px;">
              <strong>${game.away_team} @ ${game.home_team}</strong><br>
              <small style="color: #6b7280;">${new Date(game.kickoff_time).toLocaleString()}</small>
            </div>
          `).join('')}
        </div>
        
        <p><strong>Please submit your picks before the first game kicks off!</strong></p>
        
                        <p>If you have any questions, please contact your pool commissioner.</p>
        
        <p>Best regards,<br>NFL Confidence Pool Team</p>
      </div>
    `
  };

  // For now, just log the email content (replace with actual email sending)
  console.log('Would send email:', emailContent);
  
  // Simulate email sending delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return { success: true };
}
