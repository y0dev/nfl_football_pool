import nodemailer from 'nodemailer';
import { 
  createResponsiveEmailTemplate, 
  createInfoBox, 
  createTwoColumnGrid,
  createParticipantTable 
} from './email-templates-base';

export interface EmailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

interface EmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private config: EmailConfig | null = null;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    
    const host = process.env.NEXT_PUBLIC_SMTP_HOST || process.env.SMTP_HOST;
    const port = process.env.NEXT_PUBLIC_SMTP_PORT || process.env.SMTP_PORT;
    const user = process.env.NEXT_PUBLIC_SMTP_USER || process.env.SMTP_USER;
    const pass = process.env.NEXT_PUBLIC_SMTP_PASS || process.env.SMTP_PASS;
    const from = process.env.NEXT_PUBLIC_SMTP_FROM || process.env.SMTP_FROM;

    if (!host || !port || !user || !pass || !from) {
      console.warn('Email configuration incomplete. Email notifications will be disabled.');
      return;
    }

    this.config = {
      host,
      port: parseInt(port),
      user,
      pass,
      from
    };

    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.port === 465, // true for 465, false for other ports
      auth: {
        user: this.config.user,
        pass: this.config.pass,
      },
    });
  }

  async sendEmail(emailData: EmailData): Promise<boolean> {
    if (!this.transporter || !this.config) {
      console.warn('Email service not configured. Skipping email send.');
      return false;
    }

    try {
      const mailOptions = {
        from: this.config.from,
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text || this.stripHtml(emailData.html),
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', info.messageId);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '');
  }

  // Template for commissioner account creation notification
  async sendAdminCreationNotification(adminEmail: string, adminName: string, createdBy?: string): Promise<boolean> {
    const subject = 'Welcome! Your Commissioner Account Has Been Created';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const dashboardUrl = `${baseUrl}/admin/dashboard`;
    
    const content = `
      <p style="margin: 0 0 20px; color: #1f2937; font-size: 16px; line-height: 1.6;">
        Hi ${adminName},
      </p>
      
      <p style="margin: 0 0 20px; color: #374151; font-size: 15px; line-height: 1.6;">
        Your commissioner account has been successfully created! You now have full access to manage pools and participants in the NFL Confidence Pool system.
      </p>
      
      ${createInfoBox(`
        <strong>Account Details:</strong><br>
        Email: ${adminEmail}<br>
        Name: ${adminName}<br>
        Created: ${new Date().toLocaleString()}
      `, 'info')}
      
      <p style="margin: 20px 0; color: #374151; font-size: 15px; line-height: 1.6;">
        You can now log in and start creating pools, managing participants, and sending invitations.
      </p>
    `;

    const html = createResponsiveEmailTemplate({
      title: 'Commissioner Account Created',
      content,
      buttonText: 'Go to Dashboard',
      buttonUrl: dashboardUrl,
      footerText: 'This is an automated notification from the NFL Confidence Pool system.'
    });

    return this.sendEmail({
      to: adminEmail,
      subject,
      html
    });
  }

  // Template for pool invitation
  async sendPoolInvitation(participantEmail: string, participantName: string, poolName: string, poolLink: string): Promise<boolean> {
    const subject = `You're Invited to Join ${poolName}! 🏈`;
    
    const content = `
      <p style="margin: 0 0 20px; color: #1f2937; font-size: 16px; line-height: 1.6;">
        Hi ${participantName},
      </p>
      
      <p style="margin: 0 0 20px; color: #374151; font-size: 15px; line-height: 1.6;">
        You've been invited to join <strong style="color: #1f2937;">${poolName}</strong> in our NFL Confidence Pool!
      </p>
      
      ${createInfoBox(`
        <strong>How it works:</strong><br>
        • Pick the winner for each NFL game<br>
        • Assign confidence points (1-16) to each pick<br>
        • Earn points for correct picks × confidence points<br>
        • Compete for the highest score each week!
      `, 'info')}
      
      <p style="margin: 20px 0; color: #374151; font-size: 15px; line-height: 1.6;">
        Click the button below to join the pool and start making your picks!
      </p>
    `;

    const html = createResponsiveEmailTemplate({
      title: `Join ${poolName}`,
      content,
      buttonText: 'Join Pool Now',
      buttonUrl: poolLink,
      footerText: 'If you have any questions, please contact your pool commissioner.'
    });

    return this.sendEmail({
      to: participantEmail,
      subject,
      html
    });
  }

  // Template for pick reminder
  async sendPickReminder(participantEmail: string, participantName: string, poolName: string, weekNumber: number, poolLink: string, deadline: string): Promise<boolean> {
    const subject = `⏰ Week ${weekNumber} Picks Due - ${poolName}`;
    
    const content = `
      <p style="margin: 0 0 20px; color: #1f2937; font-size: 16px; line-height: 1.6;">
        Hi ${participantName},
      </p>
      
      <p style="margin: 0 0 20px; color: #374151; font-size: 15px; line-height: 1.6;">
        Don't forget to submit your picks for <strong style="color: #1f2937;">${poolName}</strong> - Week ${weekNumber}!
      </p>
      
      ${createInfoBox(`
        <strong>⏰ Deadline:</strong> ${deadline}<br><br>
        Make sure to submit your picks before the deadline to stay in the competition!
      `, 'warning')}
      
      <p style="margin: 20px 0; color: #374151; font-size: 15px; line-height: 1.6;">
        Click the button below to make your picks now.
      </p>
    `;

    const html = createResponsiveEmailTemplate({
      title: `Week ${weekNumber} Picks Due`,
      content,
      buttonText: 'Make Your Picks Now',
      buttonUrl: poolLink,
      footerText: 'This is an automated reminder from your NFL Confidence Pool.'
    });

    return this.sendEmail({
      to: participantEmail,
      subject,
      html
    });
  }

  // Template for admin submission summary
  async sendAdminSubmissionSummary(
    adminEmail: string, 
    adminName: string, 
    poolName: string, 
    weekNumber: number, 
    seasonType: number,
    submittedParticipants: Array<{ name: string; email: string }>,
    pendingParticipants: Array<{ name: string; email: string }>,
    totalParticipants: number,
    submissionDeadline: string,
    poolId?: string
  ): Promise<boolean> {
    const seasonTypeNames = { 1: 'Preseason', 2: 'Regular Season', 3: 'Postseason' };
    const seasonName = seasonTypeNames[seasonType as keyof typeof seasonTypeNames] || 'Season';
    const submittedCount = submittedParticipants.length;
    const pendingCount = pendingParticipants.length;
    const submissionRate = totalParticipants > 0 ? Math.round((submittedCount / totalParticipants) * 100) : 0;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const poolUrl = poolId ? `${baseUrl}/pool/${poolId}` : `${baseUrl}/pool`;

    const subject = `📊 Week ${weekNumber} Submission Summary - ${poolName}`;
    
    const statsLeft = `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #dcfce7; border-left: 4px solid #22c55e; border-radius: 6px; padding: 16px;">
        <tr>
          <td>
            <p style="margin: 0 0 8px; color: #166534; font-size: 14px; font-weight: 600;">✅ Submitted</p>
            <p style="margin: 0 0 4px; color: #166534; font-size: 28px; font-weight: 700;">${submissionRate}%</p>
            <p style="margin: 0; color: #166534; font-size: 13px;">${submittedCount} of ${totalParticipants}</p>
          </td>
        </tr>
      </table>
    `;
    
    const statsRight = `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 6px; padding: 16px;">
        <tr>
          <td>
            <p style="margin: 0 0 8px; color: #92400e; font-size: 14px; font-weight: 600;">⏳ Pending</p>
            <p style="margin: 0 0 4px; color: #92400e; font-size: 28px; font-weight: 700;">${100 - submissionRate}%</p>
            <p style="margin: 0; color: #92400e; font-size: 13px;">${pendingCount} need reminders</p>
          </td>
        </tr>
      </table>
    `;
    
    const content = `
      <p style="margin: 0 0 20px; color: #1f2937; font-size: 16px; line-height: 1.6;">
        Hi ${adminName},
      </p>
      
      ${createInfoBox(`
        <strong>Pool:</strong> ${poolName}<br>
        <strong>Week:</strong> ${weekNumber} (${seasonName})<br>
        <strong>Deadline:</strong> ${submissionDeadline}<br>
        <strong>Generated:</strong> ${new Date().toLocaleString()}
      `, 'info')}
      
      ${createTwoColumnGrid(statsLeft, statsRight)}
      
      ${pendingCount > 0 ? `
        <p style="margin: 20px 0 10px; color: #374151; font-size: 15px; font-weight: 600;">
          📧 Participants Needing Reminders:
        </p>
        ${createParticipantTable(pendingParticipants)}
      ` : createInfoBox(`🎉 All ${totalParticipants} participants have submitted their picks for Week ${weekNumber}!`, 'success')}
      
      ${submittedCount > 0 && submittedCount <= 10 ? `
        <p style="margin: 20px 0 10px; color: #374151; font-size: 15px; font-weight: 600;">
          ✅ Successfully Submitted:
        </p>
        ${createParticipantTable(submittedParticipants)}
      ` : submittedCount > 10 ? `
        ${createInfoBox(`✅ ${submittedCount} participants have successfully submitted their picks.`, 'success')}
      ` : ''}
      
      <p style="margin: 20px 0; color: #374151; font-size: 15px; line-height: 1.6;">
        <strong>Quick Actions:</strong><br>
        • Send reminder emails to pending participants<br>
        • Review submitted picks before the deadline<br>
        • Monitor submission progress as the deadline approaches
      </p>
    `;

    const html = createResponsiveEmailTemplate({
      title: `Week ${weekNumber} Submission Summary`,
      content,
      buttonText: 'View Pool',
      buttonUrl: poolUrl,
      footerText: `Generated for ${adminName} (${adminEmail})`
    });

    return this.sendEmail({
      to: adminEmail,
      subject,
      html
    });
  }

  // Template for pool creation notification
  async sendPoolCreationNotification(adminEmail: string, adminName: string, poolName: string, poolId: string): Promise<boolean> {
    const subject = `🎉 Your Pool "${poolName}" Has Been Created!`;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const poolUrl = `${baseUrl}/pool/${poolId}`;
    
    const content = `
      <p style="margin: 0 0 20px; color: #1f2937; font-size: 16px; line-height: 1.6;">
        Hi ${adminName},
      </p>
      
      <p style="margin: 0 0 20px; color: #374151; font-size: 15px; line-height: 1.6;">
        Great news! Your pool <strong style="color: #1f2937;">"${poolName}"</strong> has been successfully created.
      </p>
      
      ${createInfoBox(`
        <strong>Pool Details:</strong><br>
        Name: ${poolName}<br>
        Created: ${new Date().toLocaleString()}<br><br>
        You can now start inviting participants and managing your pool!
      `, 'success')}
      
      <p style="margin: 20px 0; color: #374151; font-size: 15px; line-height: 1.6;">
        Click the button below to view and manage your pool.
      </p>
    `;

    const html = createResponsiveEmailTemplate({
      title: 'Pool Created Successfully',
      content,
      buttonText: 'View Pool',
      buttonUrl: poolUrl,
      footerText: 'This is an automated notification from the NFL Confidence Pool system.'
    });

    return this.sendEmail({
      to: adminEmail,
      subject,
      html
    });
  }

  // Template for urgent reminder to admin (participants without picks <5 hours before game)
  async sendUrgentReminderToAdmin(
    adminEmail: string,
    adminName: string,
    poolName: string,
    weekNumber: number,
    participantsWithoutPicks: Array<{ name: string; email?: string }>,
    timeUntilGame: string,
    poolLink: string
  ): Promise<boolean> {
    const subject = `🚨 URGENT: ${participantsWithoutPicks.length} Participant(s) Haven't Submitted Picks - ${poolName}`;
    
    const participantsList = createParticipantTable(participantsWithoutPicks);
    
    const content = `
      <p style="margin: 0 0 20px; color: #1f2937; font-size: 16px; line-height: 1.6;">
        Hi ${adminName},
      </p>
      
      ${createInfoBox(`
        <strong>⏰ URGENT REMINDER</strong><br><br>
        Games for Week ${weekNumber} start in <strong>${timeUntilGame}</strong>!<br>
        <strong>${participantsWithoutPicks.length}</strong> participant(s) in <strong>${poolName}</strong> haven't submitted their picks yet.
      `, 'error')}
      
      <p style="margin: 20px 0; color: #374151; font-size: 15px; line-height: 1.6;">
        <strong>Participants who need to submit picks:</strong>
      </p>
      
      ${participantsList}
      
      <p style="margin: 20px 0; color: #374151; font-size: 15px; line-height: 1.6;">
        Please reach out to these participants immediately to ensure they submit their picks before the deadline.
      </p>
    `;

    const html = createResponsiveEmailTemplate({
      title: 'Urgent Pick Reminder',
      content,
      buttonText: 'View Pool',
      buttonUrl: poolLink,
      footerText: `This is an automated urgent reminder for Week ${weekNumber} in ${poolName}.`,
      accentColor: '#ef4444'
    });

    return this.sendEmail({
      to: adminEmail,
      subject,
      html
    });
  }
}

// Export a singleton instance
export const emailService = new EmailService();
