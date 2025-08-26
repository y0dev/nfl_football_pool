import { getSupabaseClient } from '@/lib/supabase';
import { processTemplate, TemplateVariables } from '@/lib/template-processor';
import { EmailTemplate } from '@/lib/email-templates';
import { loadUsers } from './loadUsers';
import { getUsersWhoSubmitted } from './checkUserSubmission';
import { DEFAULT_SEASON } from '@/lib/utils';

interface SendTemplatedEmailsParams {
  poolId: string;
  poolName: string;
  weekNumber: number;
  adminId: string;
  template: EmailTemplate;
  customVariables?: Partial<TemplateVariables>;
}

export async function sendTemplatedEmails({
  poolId,
  poolName,
  weekNumber,
  adminId,
  template,
  customVariables = {}
}: SendTemplatedEmailsParams) {
  try {
    const supabase = getSupabaseClient();
    
    // Validate admin ID
    if (!adminId) {
      console.error('Admin ID is empty or undefined');
      return {
        success: false,
        error: 'Admin ID is required but not provided'
      };
    }
    
    // Get admin's email address
    const { data: adminData, error: adminError } = await supabase
      .from('admins')
      .select('email, full_name')
      .eq('id', adminId)
      .single();
    
    if (adminError) {
      console.error('Error fetching admin data:', adminError);
      console.error('Admin ID:', adminId);
      return {
        success: false,
        error: `Could not fetch admin data: ${adminError.message}`
      };
    }
    
    if (!adminData?.email) {
      console.error('Admin record found but no email:', adminData);
      console.error('Admin ID:', adminId);
      return {
        success: false,
        error: 'Admin record exists but has no email address'
      };
    }
    
    const adminEmail = adminData.email;
    const adminName = adminData.full_name || 'Pool Administrator'; // Use actual name or fallback
    
    // Get all participants
    const allParticipants = await loadUsers(poolId);
    
    // Filter participants based on template target audience
    let targetParticipants = allParticipants;
    
    if (template.targetAudience !== 'all') {
      // Get current week data to get season type
      const { getUpcomingWeek } = await import('./loadCurrentWeek');
      const { week, seasonType } = await getUpcomingWeek();
      const submittedIds = await getUsersWhoSubmitted(poolId, week, seasonType);
      
      if (template.targetAudience === 'submitted') {
        targetParticipants = allParticipants.filter(p => submittedIds.includes(p.id));
      } else {
        targetParticipants = allParticipants.filter(p => !submittedIds.includes(p.id));
      }
    }
    
    if (targetParticipants.length === 0) {
      return {
        success: false,
        error: 'No participants match the selected criteria'
      };
    }
    
    // Prepare the email template for the first participant (we'll use this as the base)
    const firstParticipant = targetParticipants[0];
    
    // Get current week data to get the actual season
    const { getUpcomingWeek } = await import('./loadCurrentWeek');
    const { seasonType } = await getUpcomingWeek();
    const actualSeason = seasonType;
    
    // Prepare variables for this participant
    const baseVariables = {
      poolName,
      poolUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/pool/${poolId}/picks?week=${weekNumber}&seasonType=${seasonType}`,
      currentWeek: weekNumber,
      season: actualSeason, // Use actual season instead of hardcoded 2025
      adminName: adminName, // Use the fetched admin name
      participantName: firstParticipant.name,
      deadline: 'Sunday 1:00 PM ET', // This could be made dynamic
      gameCount: 16, // This could be made dynamic
      timeRemaining: '2 hours', // This could be made dynamic
      pointsEarned: 0, // This would be calculated
      correctPicks: 0, // This would be calculated
      totalPicks: 16, // This would be calculated
      currentRank: 0, // This would be calculated
      topPerformers: 'To be determined', // This would be calculated
      overallStandings: 'To be determined', // This would be calculated
      nextWeek: weekNumber + 1,
      updateMessage: 'Please check the pool for updates.',
      currentStandings: 'To be determined', // This would be calculated
      finalResults: 'To be determined', // This would be calculated
      seasonHighlights: 'To be determined', // This would be calculated
      customSubject: 'Message from Pool Administrator',
      customMessage: 'This is a custom message from the pool administrator.'
    };
    
    // Merge with custom variables
    const variables = { ...baseVariables, ...customVariables };
    
    // Process template
    const subject = processTemplate(template.subject, variables);
    const body = processTemplate(template.body, variables);
    
    // Create mailto link with all participant emails in BCC
    const participantEmails = targetParticipants.map(p => p.email).join(',');
    
    // Use a simpler mailto format similar to the provided example
    const mailtoUrl = `mailto:?bcc=${encodeURIComponent(participantEmails)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    // Log the email preparation
    // const { data: emailLog, error: emailError } = await supabase
    //   .from('email_logs')
    //   .insert({
    //     pool_id: poolId,
    //     admin_id: adminId,
    //     participant_id: null, // Multiple participants
    //     template_id: template.id,
    //     subject,
    //     body,
    //     sent_at: new Date().toISOString(),
    //     status: 'prepared',
    //     recipient_count: targetParticipants.length
    //   })
    //   .select()
    //   .single();
    
    // if (emailError) {
    //   console.error('Error logging email:', emailError);
    // }
    
    // Return the mailto URL for the client to open
    return {
      success: true,
      mailtoUrl,
      subject,
      body,
      recipientCount: targetParticipants.length,
      participants: targetParticipants,
      message: `Email prepared for ${targetParticipants.length} participants. Click to open your email client.`
    };
    
  } catch (error) {
    console.error('Error preparing templated emails:', error);
    return {
      success: false,
      error: 'Failed to prepare emails'
    };
  }
}
