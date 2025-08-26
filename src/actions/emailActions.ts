import { getSupabaseClient } from '@/lib/supabase';

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

    // Get participants who haven't submitted picks yet
    const { data: participants, error: participantsError } = await supabase
      .from('participants')
      .select(`
        id,
        name,
        email,
        picks!inner(id)
      `)
      .eq('pool_id', params.poolId)
      .eq('is_active', true)
      .is('picks.id', null);

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

    // Prepare email reminders
    const reminders: PickReminderData[] = participants.map(participant => ({
      participantName: participant.name,
      participantEmail: participant.email,
      poolName: pool.name,
      weekNumber: params.weekNumber,
      deadline,
      gamesCount,
      poolUrl,
      adminName: admin.full_name || 'Pool Administrator'
    }));

    // For now, just log the reminders since email service is not configured
    console.log(`📧 Would send ${reminders.length} pick reminders:`, reminders);

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
          reminders_count: reminders.length,
          message: 'Prepared pick reminders (email service not configured)'
        }
      });

    return {
      success: true,
      sent: 0,
      failed: reminders.length,
      total: reminders.length,
      message: `Email service not configured. ${reminders.length} reminders prepared but not sent.`
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
    
    const { data: participants, error } = await supabase
      .from('participants')
      .select(`
        id,
        name,
        email,
        picks!inner(id)
      `)
      .eq('pool_id', poolId)
      .eq('is_active', true)
      .is('picks.id', null);

    if (error) {
      console.error('Error fetching participants without picks:', error);
      return [];
    }

    return participants || [];
  } catch (error) {
    console.error('Error getting participants without picks:', error);
    return [];
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
      adminName: admin.full_name || 'Pool Administrator'
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
