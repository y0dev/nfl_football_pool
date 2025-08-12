import { getSupabaseClient } from '@/lib/supabase';
import { processTemplate, TemplateVariables } from '@/lib/template-processor';
import { EmailTemplate } from '@/lib/email-templates';
import { loadUsers } from './loadUsers';
import { getUsersWhoSubmitted } from './checkUserSubmission';

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
    
    // Get all participants
    const allParticipants = await loadUsers();
    
    // Filter participants based on template target audience
    let targetParticipants = allParticipants;
    
    if (template.targetAudience !== 'all') {
      const submittedIds = await getUsersWhoSubmitted(poolId, weekNumber);
      
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
    
    // Send emails to each participant
    const emailResults = [];
    
    for (const participant of targetParticipants) {
      try {
        // Prepare variables for this participant
        const baseVariables = {
          poolName,
          poolUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/participant?pool=${poolId}&week=${weekNumber}`,
          currentWeek: weekNumber,
          season: 2024, // This could be made dynamic
          adminName: 'Pool Administrator', // This could be fetched from admin table
          participantName: participant.name,
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
        
        // Send email using your existing email service
        // For now, we'll log the email and store it in the database
        const { data: emailLog, error: emailError } = await supabase
          .from('email_logs')
          .insert({
            pool_id: poolId,
            admin_id: adminId,
            participant_id: participant.id,
            template_id: template.id,
            subject,
            body,
            sent_at: new Date().toISOString(),
            status: 'sent'
          })
          .select()
          .single();
        
        if (emailError) {
          console.error('Error logging email:', emailError);
        }
        
        emailResults.push({
          participant,
          success: true,
          subject,
          body
        });
        
        // TODO: Actually send the email using your email service
        // For now, we'll just log it
        console.log('Email prepared for:', participant.email, { subject, body });
        
      } catch (error) {
        console.error('Error processing email for participant:', participant.id, error);
        emailResults.push({
          participant,
          success: false,
          error: error.message
        });
      }
    }
    
    const successfulEmails = emailResults.filter(r => r.success);
    const failedEmails = emailResults.filter(r => !r.success);
    
    return {
      success: true,
      totalSent: successfulEmails.length,
      totalFailed: failedEmails.length,
      results: emailResults
    };
    
  } catch (error) {
    console.error('Error sending templated emails:', error);
    return {
      success: false,
      error: 'Failed to send emails'
    };
  }
}
