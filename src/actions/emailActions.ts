import { getSupabaseClient } from '@/lib/supabase';
import { emailService } from '@/lib/email';

export interface SendPickRemindersParams {
  poolId: string;
  weekNumber: number;
  adminId: string;
  deadline?: string;
  poolUrl?: string;
}

export interface EmailReminderResult {
  success: boolean;
  sent: number;
  failed: number;
  total: number;
  message: string;
}

export interface PickReminderData {
  participantName: string;
  participantEmail: string;
  poolName: string;
  weekNumber: number;
  deadline: string;
  gamesCount: number;
  poolUrl: string;
  adminName: string;
}

export async function sendPickReminders(params: SendPickRemindersParams): Promise<EmailReminderResult> {
  try {
    const supabase = getSupabaseClient();
    
    // Get pool information
    const { data: pool, error: poolError } = await supabase
      .from('pools')
      .select('name')
      .eq('id', params.poolId)
      .single();

    if (poolError || !pool) {
      return {
        success: false,
        sent: 0,
        failed: 0,
        total: 0,
        message: 'Pool not found'
      };
    }

    // Get admin information
    const { data: admin, error: adminError } = await supabase
      .from('admins')
      .select('full_name')
      .eq('id', params.adminId)
      .single();

    if (adminError || !admin) {
      return {
        success: false,
        sent: 0,
        failed: 0,
        total: 0,
        message: 'Admin not found'
      };
    }

    // Get all active participants in the pool
    const { data: allParticipants, error: allParticipantsError } = await supabase
      .from('participants')
      .select('id, name, email')
      .eq('pool_id', params.poolId)
      .eq('is_active', true);

    if (allParticipantsError) {
      return {
        success: false,
        sent: 0,
        failed: 0,
        total: 0,
        message: 'Failed to fetch participants'
      };
    }

    if (!allParticipants || allParticipants.length === 0) {
      return {
        success: true,
        sent: 0,
        failed: 0,
        total: 0,
        message: 'No participants found in this pool'
      };
    }

    // Get participants who have submitted picks for this week
    const { data: picksData, error: picksError } = await supabase
      .from('picks')
      .select('participant_id')
      .eq('pool_id', params.poolId)
      .eq('week', params.weekNumber);

    if (picksError) {
      console.error('Error fetching picks:', picksError);
    }

    const participantsWithPicks = new Set(picksData?.map(p => p.participant_id) || []);
    
    // Filter to get participants without picks
    const participants = allParticipants.filter(p => !participantsWithPicks.has(p.id));

    if (participantsError) {
      return {
        success: false,
        sent: 0,
        failed: 0,
        total: 0,
        message: 'Failed to fetch participants'
      };
    }

    if (!participants || participants.length === 0) {
      return {
        success: true,
        sent: 0,
        failed: 0,
        total: 0,
        message: 'All participants have already submitted their picks for this week'
      };
    }

    // Get games count for this week
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id')
      .eq('week', params.weekNumber);

    if (gamesError) {
      return {
        success: false,
        sent: 0,
        failed: 0,
        total: 0,
        message: 'Failed to fetch games for this week'
      };
    }

    const gamesCount = games?.length || 0;
    const deadline = params.deadline || 'Sunday at kickoff';
    
    // Generate proper participant link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const poolUrl = `${baseUrl}/pool/${params.poolId}/picks?week=${params.weekNumber}`;

    // Send email reminders
    let sentCount = 0;
    let failedCount = 0;

    for (const participant of participants) {
      if (!participant.email) {
        console.warn(`Skipping participant ${participant.name} - no email address`);
        failedCount++;
        continue;
      }

      try {
        const emailSent = await emailService.sendPickReminder(
          participant.email,
          participant.name,
          pool.name,
          params.weekNumber,
          poolUrl,
          deadline
        );

        if (emailSent) {
          sentCount++;
        } else {
          failedCount++;
        }
      } catch (error) {
        console.error(`Error sending reminder to ${participant.email}:`, error);
        failedCount++;
      }
    }

    // Log the email campaign
    await supabase
      .from('audit_logs')
      .insert({
        action: 'send_pick_reminders',
        admin_id: params.adminId,
        entity: 'email_campaign',
        entity_id: params.poolId,
        details: { 
          pool_id: params.poolId,
          week_number: params.weekNumber,
          reminders_count: participants.length,
          sent_count: sentCount,
          failed_count: failedCount
        }
      });

    return {
      success: sentCount > 0,
      sent: sentCount,
      failed: failedCount,
      total: participants.length,
      message: sentCount > 0 
        ? `Successfully sent ${sentCount} reminder(s). ${failedCount > 0 ? `${failedCount} failed.` : ''}`
        : `Failed to send reminders. ${failedCount > 0 ? 'Email service may not be configured.' : ''}`
    };

  } catch (error) {
    console.error('Error sending pick reminders:', error);
    return {
      success: false,
      sent: 0,
      failed: 0,
      total: 0,
      message: 'An unexpected error occurred while sending reminders'
    };
  }
}

export async function getParticipantsWithoutPicks(poolId: string, weekNumber: number) {
  try {
    const supabase = getSupabaseClient();
    
    // Get all active participants
    const { data: allParticipants, error: allError } = await supabase
      .from('participants')
      .select('id, name, email')
      .eq('pool_id', poolId)
      .eq('is_active', true);

    if (allError || !allParticipants) {
      console.error('Error fetching participants:', allError);
      return [];
    }

    // Get participants who have submitted picks
    const { data: picksData, error: picksError } = await supabase
      .from('picks')
      .select('participant_id')
      .eq('pool_id', poolId)
      .eq('week', weekNumber);

    if (picksError) {
      console.error('Error fetching picks:', picksError);
    }

    const participantsWithPicks = new Set(picksData?.map(p => p.participant_id) || []);
    
    // Return participants without picks
    return allParticipants.filter(p => !participantsWithPicks.has(p.id));
  } catch (error) {
    console.error('Error getting participants without picks:', error);
    return [];
  }
}

/**
 * Check for participants without picks when games start in less than 5 hours
 * and send urgent reminder to pool admin
 */
export async function checkAndSendUrgentReminders(): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const now = new Date();
    const fiveHoursFromNow = new Date(now.getTime() + 5 * 60 * 60 * 1000);

    // Get upcoming games starting within 5 hours
    const { data: upcomingGames, error: gamesError } = await supabase
      .from('games')
      .select('id, week, season_type, kickoff_time, home_team, away_team')
      .gte('kickoff_time', now.toISOString())
      .lte('kickoff_time', fiveHoursFromNow.toISOString())
      .order('kickoff_time', { ascending: true });

    if (gamesError || !upcomingGames || upcomingGames.length === 0) {
      return; // No games starting soon
    }

    // Group games by week
    const gamesByWeek = new Map<number, typeof upcomingGames>();
    for (const game of upcomingGames) {
      if (!gamesByWeek.has(game.week)) {
        gamesByWeek.set(game.week, []);
      }
      gamesByWeek.get(game.week)!.push(game);
    }

    // Get all active pools
    const { data: pools, error: poolsError } = await supabase
      .from('pools')
      .select('id, name, created_by')
      .eq('is_active', true);

    if (poolsError || !pools) {
      return;
    }

    // For each week with upcoming games, check each pool
    for (const [weekNumber, games] of gamesByWeek.entries()) {
      const earliestGame = games[0];
      const timeUntilGame = Math.floor((new Date(earliestGame.kickoff_time).getTime() - now.getTime()) / (60 * 1000));
      const hoursUntil = Math.floor(timeUntilGame / 60);
      const minutesUntil = timeUntilGame % 60;
      const timeString = hoursUntil > 0 
        ? `${hoursUntil} hour${hoursUntil > 1 ? 's' : ''} and ${minutesUntil} minute${minutesUntil !== 1 ? 's' : ''}`
        : `${minutesUntil} minute${minutesUntil !== 1 ? 's' : ''}`;

      for (const pool of pools) {
        // Get pool admin
        const { data: admin, error: adminError } = await supabase
          .from('admins')
          .select('id, email, full_name')
          .eq('email', pool.created_by)
          .eq('is_active', true)
          .maybeSingle();

        if (adminError || !admin || !admin.email) {
          continue;
        }

        // Get participants without picks
        const participantsWithoutPicks = await getParticipantsWithoutPicks(pool.id, weekNumber);

        if (participantsWithoutPicks.length > 0) {
          // Send urgent reminder to admin
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          const poolLink = `${baseUrl}/pool/${pool.id}/picks?week=${weekNumber}`;

          try {
            await emailService.sendUrgentReminderToAdmin(
              admin.email,
              admin.full_name || 'Pool Commissioner',
              pool.name,
              weekNumber,
              participantsWithoutPicks.map(p => ({ name: p.name, email: p.email || undefined })),
              timeString,
              poolLink
            );
            console.log(`Sent urgent reminder to admin for pool ${pool.name}, week ${weekNumber}`);
          } catch (error) {
            console.error(`Error sending urgent reminder for pool ${pool.name}:`, error);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error in checkAndSendUrgentReminders:', error);
  }
}

export async function sendAllSubmittedNotification(params: SendPickRemindersParams): Promise<EmailReminderResult> {
  try {
    const supabase = getSupabaseClient();
    
    // Get pool information
    const { data: pool, error: poolError } = await supabase
      .from('pools')
      .select('name')
      .eq('id', params.poolId)
      .single();

    if (poolError || !pool) {
      return {
        success: false,
        sent: 0,
        failed: 0,
        total: 0,
        message: 'Pool not found'
      };
    }

    // Get admin information
    const { data: admin, error: adminError } = await supabase
      .from('admins')
      .select('full_name, email')
      .eq('id', params.adminId)
      .single();

    if (adminError || !admin) {
      return {
        success: false,
        sent: 0,
        failed: 0,
        total: 0,
        message: 'Admin not found'
      };
    }

    // Get all participants in the pool
    const { data: participants, error: participantsError } = await supabase
      .from('participants')
      .select('id, name, email')
      .eq('pool_id', params.poolId)
      .eq('is_active', true);

    if (participantsError) {
      return {
        success: false,
        sent: 0,
        failed: 0,
        total: 0,
        message: 'Failed to fetch participants'
      };
    }

    if (!participants || participants.length === 0) {
      return {
        success: true,
        sent: 0,
        failed: 0,
        total: 0,
        message: 'No participants found in this pool'
      };
    }

    // Get games count for this week
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id')
      .eq('week', params.weekNumber);

    if (gamesError) {
      return {
        success: false,
        sent: 0,
        failed: 0,
        total: 0,
        message: 'Failed to fetch games for this week'
      };
    }

    const gamesCount = games?.length || 0;
    
    // Generate proper participant link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const poolUrl = `${baseUrl}/pool/${params.poolId}/picks?week=${params.weekNumber}`;

    // Prepare email notifications
    const notifications: PickReminderData[] = participants.map(participant => ({
      participantName: participant.name,
      participantEmail: participant.email,
      poolName: pool.name,
      weekNumber: params.weekNumber,
      deadline: 'All picks submitted!',
      gamesCount,
      poolUrl,
      adminName: admin.full_name || 'Pool Commissioner'
    }));

    // For now, just log the notifications since email service is not configured
    console.log(`📧 Would send ${notifications.length} all-submitted notifications:`, notifications);

    // Log the email campaign
    await supabase
      .from('audit_logs')
      .insert({
        action: 'send_all_submitted_notification',
        admin_id: params.adminId,
        entity: 'email_campaign',
        entity_id: params.poolId,
        details: { 
          pool_id: params.poolId,
          week_number: params.weekNumber,
          notifications_count: notifications.length,
          message: 'Prepared all-submitted notifications (email service not configured)'
        }
      });

    return {
      success: true,
      sent: 0,
      failed: notifications.length,
      total: notifications.length,
      message: `Email service not configured. ${notifications.length} notifications prepared but not sent.`
    };

  } catch (error) {
    console.error('Error sending all-submitted notifications:', error);
    return {
      success: false,
      sent: 0,
      failed: 0,
      total: 0,
      message: 'An unexpected error occurred while sending notifications'
    };
  }
}

export async function testEmailConfiguration() {
  return {
    success: false,
    message: 'Email service not configured. Please set up SMTP settings in your environment variables.'
  };
}
