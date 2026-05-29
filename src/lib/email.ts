import nodemailer from 'nodemailer';
import { 
  createResponsiveEmailTemplate, 
  createInfoBox, 
  createTwoColumnGrid,
  createParticipantTable 
} from './email-templates-base';

interface EmailConfig {
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
    const subject = 'Welcome to Sunday Huddle — Your Commissioner Account Is Ready';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const loginUrl = `${baseUrl}/login`;

    const content = `
      <p style="margin: 0 0 20px; color: #f1f5f9; font-size: 16px; line-height: 1.6;">
        Hi ${adminName},
      </p>

      <p style="margin: 0 0 20px; color: #94a3b8; font-size: 15px; line-height: 1.6;">
        Your Sunday Huddle commissioner account has been created. You can sign in right away using a magic link — no password required.
      </p>

      ${createInfoBox(`
        <strong>Your Account:</strong><br>
        Email: ${adminEmail}<br>
        Name: ${adminName}<br>
        Created: ${new Date().toLocaleString()}
      `, 'info')}

      <p style="margin: 20px 0 8px; color: #f1f5f9; font-size: 15px; font-weight: 600;">How to sign in:</p>
      <ol style="margin: 0 0 20px; padding-left: 20px; color: #94a3b8; font-size: 15px; line-height: 1.8;">
        <li>Click "Sign In to Your Dashboard" below</li>
        <li>Enter your email address: <strong>${adminEmail}</strong></li>
        <li>Click <strong>Send Magic Link</strong></li>
        <li>Check your inbox and click the link — you'll be signed in instantly</li>
      </ol>

      <p style="margin: 0 0 20px; color: #94a3b8; font-size: 15px; line-height: 1.6;">
        As a commissioner you can create pools, invite participants, track weekly submissions, and manage standings.
      </p>
    `;

    const html = createResponsiveEmailTemplate({
      title: 'Welcome, Commissioner',
      content,
      buttonText: 'Sign In to Your Dashboard',
      buttonUrl: loginUrl,
      footerText: 'This is an automated notification from Sunday Huddle. If you did not expect this email, please ignore it.'
    });

    return this.sendEmail({
      to: adminEmail,
      subject,
      html
    });
  }

  // Template for password reset notification
  async sendPasswordResetNotification(adminEmail: string, adminName: string): Promise<boolean> {
    const subject = 'Your Sunday Huddle Password Has Been Reset';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const loginUrl = `${baseUrl}/login`;

    const content = `
      <p style="margin: 0 0 20px; color: #f1f5f9; font-size: 16px; line-height: 1.6;">
        Hi ${adminName},
      </p>

      <p style="margin: 0 0 20px; color: #94a3b8; font-size: 15px; line-height: 1.6;">
        Your Sunday Huddle commissioner account password was reset by a system administrator on ${new Date().toLocaleString()}.
      </p>

      ${createInfoBox(`
        If you did not request this change, contact your system administrator immediately and do not use the new credentials.
      `, 'warning')}

      <p style="margin: 20px 0; color: #94a3b8; font-size: 15px; line-height: 1.6;">
        You can sign in at any time using the magic link option. Just visit the sign-in page, enter your email, and we'll send you a secure one-time link — no password needed.
      </p>
    `;

    const html = createResponsiveEmailTemplate({
      title: 'Password Reset',
      content,
      buttonText: 'Sign In',
      buttonUrl: loginUrl,
      footerText: 'This is a security notification from Sunday Huddle.'
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
      <p style="margin: 0 0 20px; color: #f1f5f9; font-size: 16px; line-height: 1.6;">
        Hi ${participantName},
      </p>
      
      <p style="margin: 0 0 20px; color: #94a3b8; font-size: 15px; line-height: 1.6;">
        You've been invited to join <strong style="color: #f1f5f9;">${poolName}</strong> in our Sunday Huddle!
      </p>
      
      ${createInfoBox(`
        <strong>How it works:</strong><br>
        • Pick the winner for each NFL game<br>
        • Assign confidence points (1-16) to each pick<br>
        • Earn points for correct picks × confidence points<br>
        • Compete for the highest score each week!
      `, 'info')}
      
      <p style="margin: 20px 0; color: #94a3b8; font-size: 15px; line-height: 1.6;">
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
      <p style="margin: 0 0 20px; color: #f1f5f9; font-size: 16px; line-height: 1.6;">
        Hi ${participantName},
      </p>
      
      <p style="margin: 0 0 20px; color: #94a3b8; font-size: 15px; line-height: 1.6;">
        Don't forget to submit your picks for <strong style="color: #f1f5f9;">${poolName}</strong> - Week ${weekNumber}!
      </p>
      
      ${createInfoBox(`
        <strong>⏰ Deadline:</strong> ${deadline}<br><br>
        Make sure to submit your picks before the deadline to stay in the competition!
      `, 'warning')}
      
      <p style="margin: 20px 0; color: #94a3b8; font-size: 15px; line-height: 1.6;">
        Click the button below to make your picks now.
      </p>
    `;

    const html = createResponsiveEmailTemplate({
      title: `Week ${weekNumber} Picks Due`,
      content,
      buttonText: 'Make Your Picks Now',
      buttonUrl: poolLink,
      footerText: 'This is an automated reminder from your Sunday Huddle.'
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
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #091a0f; border-left: 3px solid #1e6e43; border-radius: 6px; padding: 16px;">
        <tr>
          <td>
            <p style="margin: 0 0 8px; color: #4ade80; font-size: 13px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;">Submitted</p>
            <p style="margin: 0 0 4px; color: #f1f5f9; font-size: 28px; font-weight: 700;">${submissionRate}%</p>
            <p style="margin: 0; color: #94a3b8; font-size: 13px;">${submittedCount} of ${totalParticipants}</p>
          </td>
        </tr>
      </table>
    `;

    const statsRight = `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #1c1608; border-left: 3px solid #d4a520; border-radius: 6px; padding: 16px;">
        <tr>
          <td>
            <p style="margin: 0 0 8px; color: #fcd34d; font-size: 13px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;">Pending</p>
            <p style="margin: 0 0 4px; color: #f1f5f9; font-size: 28px; font-weight: 700;">${100 - submissionRate}%</p>
            <p style="margin: 0; color: #94a3b8; font-size: 13px;">${pendingCount} need reminders</p>
          </td>
        </tr>
      </table>
    `;
    
    const content = `
      <p style="margin: 0 0 20px; color: #f1f5f9; font-size: 16px; line-height: 1.6;">
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
        <p style="margin: 20px 0 10px; color: #94a3b8; font-size: 15px; font-weight: 600;">
          📧 Participants Needing Reminders:
        </p>
        ${createParticipantTable(pendingParticipants)}
      ` : createInfoBox(`🎉 All ${totalParticipants} participants have submitted their picks for Week ${weekNumber}!`, 'success')}
      
      ${submittedCount > 0 && submittedCount <= 10 ? `
        <p style="margin: 20px 0 10px; color: #94a3b8; font-size: 15px; font-weight: 600;">
          ✅ Successfully Submitted:
        </p>
        ${createParticipantTable(submittedParticipants)}
      ` : submittedCount > 10 ? `
        ${createInfoBox(`✅ ${submittedCount} participants have successfully submitted their picks.`, 'success')}
      ` : ''}
      
      <p style="margin: 20px 0; color: #94a3b8; font-size: 15px; line-height: 1.6;">
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
      <p style="margin: 0 0 20px; color: #f1f5f9; font-size: 16px; line-height: 1.6;">
        Hi ${adminName},
      </p>
      
      <p style="margin: 0 0 20px; color: #94a3b8; font-size: 15px; line-height: 1.6;">
        Great news! Your pool <strong style="color: #f1f5f9;">"${poolName}"</strong> has been successfully created.
      </p>
      
      ${createInfoBox(`
        <strong>Pool Details:</strong><br>
        Name: ${poolName}<br>
        Created: ${new Date().toLocaleString()}<br><br>
        You can now start inviting participants and managing your pool!
      `, 'success')}
      
      <p style="margin: 20px 0; color: #94a3b8; font-size: 15px; line-height: 1.6;">
        Click the button below to view and manage your pool.
      </p>
    `;

    const html = createResponsiveEmailTemplate({
      title: 'Pool Created Successfully',
      content,
      buttonText: 'View Pool',
      buttonUrl: poolUrl,
      footerText: 'This is an automated notification from the Sunday Huddle system.'
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
      <p style="margin: 0 0 20px; color: #f1f5f9; font-size: 16px; line-height: 1.6;">
        Hi ${adminName},
      </p>
      
      ${createInfoBox(`
        <strong>⏰ URGENT REMINDER</strong><br><br>
        Games for Week ${weekNumber} start in <strong>${timeUntilGame}</strong>!<br>
        <strong>${participantsWithoutPicks.length}</strong> participant(s) in <strong>${poolName}</strong> haven't submitted their picks yet.
      `, 'error')}
      
      <p style="margin: 20px 0; color: #94a3b8; font-size: 15px; line-height: 1.6;">
        <strong>Participants who need to submit picks:</strong>
      </p>
      
      ${participantsList}
      
      <p style="margin: 20px 0; color: #94a3b8; font-size: 15px; line-height: 1.6;">
        Please reach out to these participants immediately to ensure they submit their picks before the deadline.
      </p>
    `;

    const html = createResponsiveEmailTemplate({
      title: 'Urgent Pick Reminder',
      content,
      buttonText: 'View Pool',
      buttonUrl: poolLink,
      footerText: `This is an automated urgent reminder for Week ${weekNumber} in ${poolName}.`,
      accentColor: '#dc2626'
    });

    return this.sendEmail({
      to: adminEmail,
      subject,
      html
    });
  }

  async sendDeletionConfirmationRequest(email: string, displayName: string, confirmUrl: string): Promise<boolean> {
    const subject = 'Confirm Your Sunday Huddle Account Deletion';
    const html = `
      <div style="max-width:520px;margin:0 auto;font-family:Arial,sans-serif;background:#0d1117;padding:40px 24px;border-radius:10px;border:1px solid #1e2a3a;border-top:3px solid #dc2626;">
        <div style="text-align:center;margin-bottom:32px;">
          <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.22em;color:#4ade80;text-transform:uppercase;font-weight:700;">Sunday Huddle</p>
          <h1 style="margin:0;font-size:24px;font-weight:900;color:#f1f5f9;letter-spacing:0.04em;text-transform:uppercase;line-height:1.1;">Confirm Deletion</h1>
        </div>
        <div style="height:1px;background:#1e2a3a;margin:0 0 28px;"></div>
        <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 20px;">
          Hi ${displayName}, we received a request to permanently delete your Sunday Huddle commissioner account.
        </p>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 24px;">
          <tr>
            <td style="background:#1a0a0a;border-left:3px solid #dc2626;padding:14px 18px;border-radius:0 6px 6px 0;">
              <p style="margin:0;color:#fca5a5;font-size:14px;line-height:1.65;">
                <strong style="color:#f1f5f9;">This action is permanent and cannot be undone.</strong><br>
                This link expires in 24 hours. If you did not request this, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
        <div style="text-align:center;margin:32px 0;">
          <a href="${confirmUrl}" style="display:inline-block;background-color:#991b1b;color:#f1f5f9;text-decoration:none;padding:14px 36px;border-radius:6px;font-weight:700;font-size:14px;letter-spacing:0.1em;text-transform:uppercase;">
            Yes, Delete My Account
          </a>
        </div>
        <p style="color:#64748b;font-size:12px;line-height:1.6;margin:0;text-align:center;">
          © ${new Date().getFullYear()} Sunday Huddle. All rights reserved.
        </p>
      </div>
    `;
    return this.sendEmail({ to: email, subject, html });
  }

  async sendAccountDeletionConfirmation(email: string, displayName: string): Promise<boolean> {
    const subject = 'Your Sunday Huddle Account Has Been Deleted';
    const html = `
      <div style="max-width:520px;margin:0 auto;font-family:Arial,sans-serif;background:#0d1117;padding:40px 24px;border-radius:10px;border:1px solid #1e2a3a;border-top:3px solid #1e6e43;">
        <div style="text-align:center;margin-bottom:32px;">
          <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.22em;color:#4ade80;text-transform:uppercase;font-weight:700;">Sunday Huddle</p>
          <h1 style="margin:0;font-size:24px;font-weight:900;color:#f1f5f9;letter-spacing:0.04em;text-transform:uppercase;line-height:1.1;">So Long, ${displayName}</h1>
        </div>
        <div style="height:1px;background:#1e2a3a;margin:0 0 28px;"></div>
        <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 20px;">
          Hey ${displayName}, your Sunday Huddle commissioner account has been successfully deleted. All your account data has been removed from our system.
        </p>
        <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 28px;">
          We're sorry to see you go. If you ever decide to come back, you're always welcome — just create a new account and you'll be up and running in minutes.
        </p>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 28px;">
          <tr>
            <td style="background:#091a0f;border-left:3px solid #1e6e43;padding:14px 18px;border-radius:0 6px 6px 0;">
              <p style="margin:0;color:#4ade80;font-size:14px;line-height:1.65;">
                Your pools, standings, and participant data remain intact — only your commissioner account has been removed.
              </p>
            </td>
          </tr>
        </table>
        <p style="color:#64748b;font-size:12px;line-height:1.6;margin:0;text-align:center;">
          If you did not request this deletion, please contact support immediately.<br>
          © ${new Date().getFullYear()} Sunday Huddle. All rights reserved.
        </p>
      </div>
    `;
    return this.sendEmail({ to: email, subject, html });
  }

  async sendPasswordResetLink(
    email: string,
    displayName: string,
    resetUrl: string
  ): Promise<boolean> {
    const subject = 'Reset Your Sunday Huddle Password';
    const html = `
      <div style="max-width:520px;margin:0 auto;font-family:Arial,sans-serif;background:#0d1117;padding:40px 24px;border-radius:10px;">
        <div style="text-align:center;margin-bottom:32px;">
          <p style="margin:0;font-size:11px;letter-spacing:0.22em;color:#4ade80;text-transform:uppercase;font-weight:700;">Sunday Huddle</p>
          <h1 style="margin:8px 0 0;font-size:26px;font-weight:900;color:#f1f5f9;letter-spacing:0.03em;text-transform:uppercase;">Reset Your Password</h1>
        </div>
        <p style="color:#94a3b8;font-size:15px;line-height:1.6;margin:0 0 24px;">
          Hi ${displayName}, click the button below to reset your password. This link expires in <strong style="color:#f1f5f9;">1 hour</strong>.
        </p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${resetUrl}" style="display:inline-block;padding:14px 32px;background:#2d6a4f;color:#f1f5f9;text-decoration:none;border-radius:6px;font-weight:700;font-size:14px;letter-spacing:0.1em;text-transform:uppercase;">
            Reset Password
          </a>
        </div>
        <p style="color:#64748b;font-size:13px;line-height:1.6;margin:24px 0 0;text-align:center;">
          If you did not request a password reset, you can safely ignore this email.<br>
          This link expires in 1 hour and can only be used once.
        </p>
      </div>
    `;
    return this.sendEmail({ to: email, subject, html });
  }

  async sendPasswordResetConfirmation(email: string, displayName: string): Promise<boolean> {
    const subject = 'Your Sunday Huddle Password Has Been Reset';
    const html = `
      <div style="max-width:520px;margin:0 auto;font-family:Arial,sans-serif;background:#0d1117;padding:40px 24px;border-radius:10px;border:1px solid #1e2a3a;border-top:3px solid #1e6e43;">
        <div style="text-align:center;margin-bottom:32px;">
          <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.22em;color:#4ade80;text-transform:uppercase;font-weight:700;">Sunday Huddle</p>
          <h1 style="margin:0;font-size:24px;font-weight:900;color:#f1f5f9;letter-spacing:0.04em;text-transform:uppercase;line-height:1.1;">Password Reset</h1>
        </div>
        <div style="height:1px;background:#1e2a3a;margin:0 0 28px;"></div>
        <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 20px;">
          Hi ${displayName}, your Sunday Huddle password has been successfully reset. You can now sign in with your new password.
        </p>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 24px;">
          <tr>
            <td style="background:#1c1608;border-left:3px solid #d4a520;padding:14px 18px;border-radius:0 6px 6px 0;">
              <p style="margin:0;color:#fcd34d;font-size:14px;line-height:1.65;">
                If you did not make this change, reset your password immediately and contact support.
              </p>
            </td>
          </tr>
        </table>
        <div style="text-align:center;margin:32px 0;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login" style="display:inline-block;background-color:#1e6e43;color:#f1f5f9;text-decoration:none;padding:14px 36px;border-radius:6px;font-weight:700;font-size:14px;letter-spacing:0.1em;text-transform:uppercase;">
            Sign In to Dashboard
          </a>
        </div>
        <p style="color:#64748b;font-size:12px;line-height:1.6;margin:0;text-align:center;">
          © ${new Date().getFullYear()} Sunday Huddle. All rights reserved.
        </p>
      </div>
    `;
    return this.sendEmail({ to: email, subject, html });
  }

  async sendMagicLink(
    email: string,
    displayName: string,
    magicUrl: string
  ): Promise<boolean> {
    const subject = 'Your Sunday Huddle Sign-In Link';
    const html = `
      <div style="max-width:520px;margin:0 auto;font-family:Arial,sans-serif;background:#0d1117;padding:40px 24px;border-radius:10px;">
        <div style="text-align:center;margin-bottom:32px;">
          <p style="margin:0;font-size:11px;letter-spacing:0.22em;color:#4ade80;text-transform:uppercase;font-weight:700;">Sunday Huddle</p>
          <h1 style="margin:8px 0 0;font-size:26px;font-weight:900;color:#f1f5f9;letter-spacing:0.03em;text-transform:uppercase;">Your Sign-In Link</h1>
        </div>
        <p style="color:#94a3b8;font-size:15px;line-height:1.6;margin:0 0 24px;">
          Hi ${displayName}, click the button below to sign in to your commissioner dashboard. This link expires in <strong style="color:#f1f5f9;">15 minutes</strong>.
        </p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${magicUrl}" style="display:inline-block;padding:14px 32px;background:#2d6a4f;color:#f1f5f9;text-decoration:none;border-radius:6px;font-weight:700;font-size:14px;letter-spacing:0.1em;text-transform:uppercase;">
            Sign In to Dashboard
          </a>
        </div>
        <p style="color:#64748b;font-size:13px;line-height:1.6;margin:24px 0 0;text-align:center;">
          If you did not request this link, you can safely ignore this email.<br>
          This link can only be used once.
        </p>
      </div>
    `;
    return this.sendEmail({ to: email, subject, html });
  }
}

// Export a singleton instance
export const emailService = new EmailService();
