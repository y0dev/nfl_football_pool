import nodemailer from 'nodemailer';
import {
  createResponsiveEmailTemplate,
  createInfoBox,
  createTwoColumnGrid,
  createParticipantTable
} from './email-templates-base';
import { debugLog, debugError, debugWarn } from '@/lib/utils';

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
    
    // No NEXT_PUBLIC_ fallback here on purpose — this module is imported by
    // several src/actions files, and a NEXT_PUBLIC_ var gets inlined into
    // any bundle that references it, public or not. Same class of bug as
    // the Supabase service-role-key leak fixed earlier this project.
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM;

    if (!host || !port || !user || !pass || !from) {
      debugWarn('Email configuration incomplete. Email notifications will be disabled.');
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
      debugWarn('Email service not configured. Skipping email send.');
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
      debugLog('Email sent successfully:', info.messageId);
      return true;
    } catch (error) {
      debugError('Error sending email:', error);
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
        Your Sunday Huddle commissioner account password was reset on ${new Date().toLocaleString()}.
      </p>

      ${createInfoBox(`
        If you did not request this change, contact Sunday Huddle support immediately and do not use the new credentials.
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
  async sendPoolInvitation(participantEmail: string, participantName: string, poolName: string, poolLink: string, huddleName?: string): Promise<boolean> {
    const subject = `You're Invited to Join ${poolName}! 🏈`;

    const content = `
      <p style="margin: 0 0 20px; color: #f1f5f9; font-size: 16px; line-height: 1.6;">
        Hi ${participantName},
      </p>

      <p style="margin: 0 0 20px; color: #94a3b8; font-size: 15px; line-height: 1.6;">
        You've been invited to join <strong style="color: #f1f5f9;">${poolName}</strong>${huddleName ? ` in <strong style="color: #f1f5f9;">${huddleName}</strong>` : ' in our Sunday Huddle'}!
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
  async sendPickReminder(participantEmail: string, participantName: string, poolName: string, weekNumber: number, poolLink: string, deadline: string, huddleName?: string): Promise<boolean> {
    const subject = `⏰ Week ${weekNumber} Picks Due - ${poolName}`;

    const content = `
      <p style="margin: 0 0 20px; color: #f1f5f9; font-size: 16px; line-height: 1.6;">
        Hi ${participantName},
      </p>

      <p style="margin: 0 0 20px; color: #94a3b8; font-size: 15px; line-height: 1.6;">
        Don't forget to submit your picks for <strong style="color: #f1f5f9;">${poolName}</strong>${huddleName ? ` (${huddleName})` : ''} - Week ${weekNumber}!
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

  // Survivor's equivalent of sendPickReminder — separate method (not a
  // branch inside that one) so Confidence's reminder wording/behavior
  // stays completely untouched. "confidence picks" -> "Survivor pick"
  // (singular — one team, not a set of ranked picks), and drops anything
  // period/points-related that doesn't apply.
  async sendSurvivorPickReminder(participantEmail: string, participantName: string, poolName: string, weekNumber: number, poolLink: string, deadline: string, huddleName?: string): Promise<boolean> {
    const subject = `⏰ Week ${weekNumber} Survivor Pick Due - ${poolName}`;

    const content = `
      <p style="margin: 0 0 20px; color: #f1f5f9; font-size: 16px; line-height: 1.6;">
        Hi ${participantName},
      </p>

      <p style="margin: 0 0 20px; color: #94a3b8; font-size: 15px; line-height: 1.6;">
        Don't forget to make your Survivor pick for <strong style="color: #f1f5f9;">${poolName}</strong>${huddleName ? ` (${huddleName})` : ''} - Week ${weekNumber}!
      </p>

      ${createInfoBox(`
        <strong>⏰ Deadline:</strong> ${deadline}<br><br>
        Pick one team you haven't used yet. A loss eliminates you — make sure to submit before the deadline.
      `, 'warning')}
    `;

    const html = createResponsiveEmailTemplate({
      title: `Week ${weekNumber} Survivor Pick Due`,
      content,
      buttonText: 'Make Your Pick Now',
      buttonUrl: poolLink,
      footerText: 'This is an automated reminder from your Sunday Huddle.'
    });

    return this.sendEmail({ to: participantEmail, subject, html });
  }

  // Sent after a Survivor week is scored — one participant at a time
  // (caller loops), never a bulk "weekly winner" announcement the way
  // Confidence Pool has none of either (see src/lib/survivor.ts's header
  // comment — Survivor deliberately doesn't send anything resembling
  // Confidence's period/weekly-winner emails, since neither concept
  // applies to it).
  async sendSurvivorWeekResult(
    participantEmail: string,
    participantName: string,
    poolName: string,
    weekNumber: number,
    poolLink: string,
    result: { alive: true; selectedTeam: string } | { alive: false; selectedTeam: string | null; reason: 'loss' | 'tie' | 'no_pick' }
  ): Promise<boolean> {
    const subject = result.alive
      ? `You're still alive! - ${poolName}`
      : `Eliminated from ${poolName}`;

    const content = result.alive
      ? `
        <p style="margin: 0 0 20px; color: #f1f5f9; font-size: 16px; line-height: 1.6;">
          Hi ${participantName},
        </p>
        ${createInfoBox(`<strong>You're still alive!</strong><br>Your ${result.selectedTeam} pick won in Week ${weekNumber}.`, 'success')}
        <p style="margin: 20px 0; color: #94a3b8; font-size: 15px; line-height: 1.6;">
          Make your next pick before it locks — remember, you can't use ${result.selectedTeam} again.
        </p>
      `
      : `
        <p style="margin: 0 0 20px; color: #f1f5f9; font-size: 16px; line-height: 1.6;">
          Hi ${participantName},
        </p>
        ${createInfoBox(
          result.reason === 'no_pick'
            ? `You&apos;re eliminated from the Survivor Pool.<br>You didn't submit a pick in Week ${weekNumber}.`
            : `You&apos;re eliminated from the Survivor Pool.<br>Your ${result.selectedTeam} pick ${result.reason === 'tie' ? 'tied' : 'lost'} in Week ${weekNumber}.`,
          'error'
        )}
        <p style="margin: 20px 0; color: #94a3b8; font-size: 15px; line-height: 1.6;">
          Thanks for playing this season — check the standings to see how the rest of the pool plays out.
        </p>
      `;

    const html = createResponsiveEmailTemplate({
      title: result.alive ? "You're Still Alive" : "You've Been Eliminated",
      content,
      buttonText: 'View Standings',
      buttonUrl: poolLink,
      footerText: 'This is an automated notification from Sunday Huddle.',
      accentColor: result.alive ? undefined : '#dc2626',
    });

    return this.sendEmail({ to: participantEmail, subject, html });
  }

  // Pick'em's equivalent of sendPickReminder — separate method (not a
  // branch inside that one) so Confidence's reminder wording/behavior stays
  // completely untouched. Names how many games are still unpicked, since
  // Pick'em's per-game submission means a participant can be partway done.
  async sendPickemPickReminder(participantEmail: string, participantName: string, poolName: string, weekNumber: number, poolLink: string, gamesRemaining: number, huddleName?: string): Promise<boolean> {
    const subject = `⏰ Week ${weekNumber} Pick'em Picks Due - ${poolName}`;

    const content = `
      <p style="margin: 0 0 20px; color: #f1f5f9; font-size: 16px; line-height: 1.6;">
        Hi ${participantName},
      </p>

      <p style="margin: 0 0 20px; color: #94a3b8; font-size: 15px; line-height: 1.6;">
        Your Week ${weekNumber} Pick'em picks for <strong style="color: #f1f5f9;">${poolName}</strong>${huddleName ? ` (${huddleName})` : ''} are due.
      </p>

      ${createInfoBox(`
        <strong>${gamesRemaining} game${gamesRemaining === 1 ? '' : 's'}</strong> still need${gamesRemaining === 1 ? 's' : ''} a pick.<br><br>
        Pick the winner of every game — each correct pick is worth one point. A game locks once it starts, so pick early.
      `, 'warning')}
    `;

    const html = createResponsiveEmailTemplate({
      title: `Week ${weekNumber} Pick'em Picks Due`,
      content,
      buttonText: 'Make Your Picks Now',
      buttonUrl: poolLink,
      footerText: 'This is an automated reminder from your Sunday Huddle.'
    });

    return this.sendEmail({ to: participantEmail, subject, html });
  }

  // Sent after a Pick'em week is fully final — one participant at a time
  // (caller loops). Distinguishes a clean win from a tie the tiebreaker
  // prediction was used to resolve, per the Pick'em spec's explicit email
  // wording examples.
  async sendPickemWeekResult(
    participantEmail: string,
    participantName: string,
    poolName: string,
    weekNumber: number,
    poolLink: string,
    result: { correctCount: number; totalGames: number; isWinner: boolean; wasTiedForFirst: boolean; tiebreakerUsed: boolean }
  ): Promise<boolean> {
    const subject = result.isWinner
      ? `You won Week ${weekNumber}! - ${poolName}`
      : `Week ${weekNumber} Results - ${poolName}`;

    const resultLine = `You got <strong>${result.correctCount} of ${result.totalGames}</strong> picks correct this week.`;
    const winnerLine = result.isWinner
      ? `<br><br><strong>You won Week ${weekNumber}!</strong>`
      : result.wasTiedForFirst
        ? `<br><br>You tied for the most correct picks.${result.tiebreakerUsed ? ' Your tiebreaker prediction was used.' : ''}`
        : '';

    const content = `
      <p style="margin: 0 0 20px; color: #f1f5f9; font-size: 16px; line-height: 1.6;">
        Hi ${participantName},
      </p>
      ${createInfoBox(`${resultLine}${winnerLine}`, result.isWinner ? 'success' : 'info')}
      <p style="margin: 20px 0; color: #94a3b8; font-size: 15px; line-height: 1.6;">
        Check the standings to see this week's full results and your season total.
      </p>
    `;

    const html = createResponsiveEmailTemplate({
      title: result.isWinner ? `You Won Week ${weekNumber}` : `Week ${weekNumber} Results`,
      content,
      buttonText: 'View Standings',
      buttonUrl: poolLink,
      footerText: 'This is an automated notification from Sunday Huddle.',
    });

    return this.sendEmail({ to: participantEmail, subject, html });
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
  async sendPoolCreationNotification(adminEmail: string, adminName: string, poolName: string, poolId: string, huddleName?: string): Promise<boolean> {
    const subject = `🎉 Your Pool "${poolName}" Has Been Created!`;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const poolUrl = `${baseUrl}/pool/${poolId}`;

    const content = `
      <p style="margin: 0 0 20px; color: #f1f5f9; font-size: 16px; line-height: 1.6;">
        Hi ${adminName},
      </p>

      <p style="margin: 0 0 20px; color: #94a3b8; font-size: 15px; line-height: 1.6;">
        Great news! Your pool <strong style="color: #f1f5f9;">"${poolName}"</strong>${huddleName ? ` in <strong style="color: #f1f5f9;">${huddleName}</strong>` : ''} has been successfully created.
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
          Hey ${displayName}, your Sunday Huddle commissioner account has been deleted. Your profile, sign-in access, and account settings have been permanently removed.
        </p>
        <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 28px;">
          We're sorry to see you go. If you ever decide to come back, you're always welcome — just create a new account and you'll be up and running in minutes.
        </p>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 28px;">
          <tr>
            <td style="background:#091a0f;border-left:3px solid #1e6e43;padding:14px 18px;border-radius:0 6px 6px 0;">
              <p style="margin:0;color:#4ade80;font-size:14px;line-height:1.65;">
                Pools you created have been archived rather than deleted, so the historical picks, scores, and standings your participants earned are preserved. They're no longer active or visible from your account.
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

  async sendEmailChangeConfirmation(newEmail: string, displayName: string, confirmUrl: string): Promise<boolean> {
    const subject = 'Confirm Your New Sunday Huddle Email';
    const html = `
      <div style="max-width:520px;margin:0 auto;font-family:Arial,sans-serif;background:#0d1117;padding:40px 24px;border-radius:10px;border:1px solid #1e2a3a;border-top:3px solid #1e6e43;">
        <div style="text-align:center;margin-bottom:32px;">
          <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.22em;color:#4ade80;text-transform:uppercase;font-weight:700;">Sunday Huddle</p>
          <h1 style="margin:0;font-size:24px;font-weight:900;color:#f1f5f9;letter-spacing:0.04em;text-transform:uppercase;line-height:1.1;">Confirm Your Email</h1>
        </div>
        <div style="height:1px;background:#1e2a3a;margin:0 0 28px;"></div>
        <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 20px;">
          Hi ${displayName}, we received a request to change your Sunday Huddle account email to this address. Confirm below to complete the change.
        </p>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 24px;">
          <tr>
            <td style="background:#1c1608;border-left:3px solid #d4a520;padding:14px 18px;border-radius:0 6px 6px 0;">
              <p style="margin:0;color:#fcd34d;font-size:14px;line-height:1.65;">
                This link expires in 24 hours. If you did not request this, you can safely ignore this email — your account email will not change.
              </p>
            </td>
          </tr>
        </table>
        <div style="text-align:center;margin:32px 0;">
          <a href="${confirmUrl}" style="display:inline-block;background-color:#1e6e43;color:#f1f5f9;text-decoration:none;padding:14px 36px;border-radius:6px;font-weight:700;font-size:14px;letter-spacing:0.1em;text-transform:uppercase;">
            Confirm New Email
          </a>
        </div>
        <p style="color:#64748b;font-size:12px;line-height:1.6;margin:0;text-align:center;">
          © ${new Date().getFullYear()} Sunday Huddle. All rights reserved.
        </p>
      </div>
    `;
    return this.sendEmail({ to: newEmail, subject, html });
  }

  async sendEmailChangedNotification(oldEmail: string, displayName: string, newEmail: string): Promise<boolean> {
    const subject = 'Your Sunday Huddle Email Has Changed';
    const html = `
      <div style="max-width:520px;margin:0 auto;font-family:Arial,sans-serif;background:#0d1117;padding:40px 24px;border-radius:10px;border:1px solid #1e2a3a;border-top:3px solid #d4a520;">
        <div style="text-align:center;margin-bottom:32px;">
          <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.22em;color:#4ade80;text-transform:uppercase;font-weight:700;">Sunday Huddle</p>
          <h1 style="margin:0;font-size:24px;font-weight:900;color:#f1f5f9;letter-spacing:0.04em;text-transform:uppercase;line-height:1.1;">Email Changed</h1>
        </div>
        <div style="height:1px;background:#1e2a3a;margin:0 0 28px;"></div>
        <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 20px;">
          Hi ${displayName}, your Sunday Huddle account email was just changed to <strong style="color:#f1f5f9;">${newEmail}</strong>. You'll sign in with that address from now on.
        </p>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 24px;">
          <tr>
            <td style="background:#1a0a0a;border-left:3px solid #dc2626;padding:14px 18px;border-radius:0 6px 6px 0;">
              <p style="margin:0;color:#fca5a5;font-size:14px;line-height:1.65;">
                If you did not make this change, contact support immediately — someone else may have access to your account.
              </p>
            </td>
          </tr>
        </table>
        <p style="color:#64748b;font-size:12px;line-height:1.6;margin:0;text-align:center;">
          © ${new Date().getFullYear()} Sunday Huddle. All rights reserved.
        </p>
      </div>
    `;
    return this.sendEmail({ to: oldEmail, subject, html });
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
  async sendStatusChangeNotification(email: string, displayName: string, isActive: boolean): Promise<boolean> {
    const action = isActive ? 'Activated' : 'Deactivated';
    const subject = `Your Sunday Huddle Account Has Been ${action}`;
    const accentColor = isActive ? '#1e6e43' : '#7f1d1d';
    const badgeColor  = isActive ? '#4ade80' : '#f87171';
    const html = `
      <div style="max-width:520px;margin:0 auto;font-family:Arial,sans-serif;background:#0d1117;padding:40px 24px;border-radius:10px;border:1px solid #1e2a3a;border-top:3px solid ${accentColor};">
        <div style="text-align:center;margin-bottom:32px;">
          <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.22em;color:#4ade80;text-transform:uppercase;font-weight:700;">Sunday Huddle</p>
          <h1 style="margin:0;font-size:22px;font-weight:900;color:#f1f5f9;letter-spacing:0.04em;text-transform:uppercase;line-height:1.1;">Account ${action}</h1>
        </div>
        <div style="height:1px;background:#1e2a3a;margin:0 0 28px;"></div>
        <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 20px;">
          Hi ${displayName}, your Sunday Huddle commissioner account has been <strong style="color:${badgeColor};">${action.toLowerCase()}</strong>.
        </p>
        ${isActive
          ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 24px;"><tr><td style="background:#091a0f;border-left:3px solid #1e6e43;padding:14px 18px;border-radius:0 6px 6px 0;"><p style="margin:0;color:#4ade80;font-size:14px;line-height:1.65;">You can now sign in to your dashboard and manage your pools.</p></td></tr></table>`
          : `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 24px;"><tr><td style="background:#1c0808;border-left:3px solid #7f1d1d;padding:14px 18px;border-radius:0 6px 6px 0;"><p style="margin:0;color:#f87171;font-size:14px;line-height:1.65;">Your account access has been suspended. Contact Sunday Huddle support if you believe this was an error.</p></td></tr></table>`
        }
        <p style="color:#64748b;font-size:12px;line-height:1.6;margin:0;text-align:center;">
          © ${new Date().getFullYear()} Sunday Huddle. All rights reserved.
        </p>
      </div>
    `;
    return this.sendEmail({ to: email, subject, html });
  }

  async sendPlanChangeNotification(email: string, displayName: string, newPlan: string, trialDays?: number, billingExempt?: boolean): Promise<boolean> {
    const planLabel = newPlan.charAt(0).toUpperCase() + newPlan.slice(1);
    const planColor = newPlan === 'pro' ? '#4ade80' : newPlan === 'standard' ? '#fcd34d' : '#94a3b8';
    const isComped = billingExempt === true && newPlan !== 'free';

    const subject = isComped
      ? `You're on Sunday Huddle ${planLabel} — On the House`
      : `Your Sunday Huddle Plan Has Been Updated`;

    const introText = isComped
      ? `Hi ${displayName}, great news — your Sunday Huddle account has been upgraded to <strong style="color:${planColor};">${planLabel}</strong>, and it's on us.`
      : `Hi ${displayName}, your Sunday Huddle subscription plan has been updated.`;

    const compedCallout = isComped
      ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 24px;">
          <tr>
            <td style="background:#1a1530;border-left:3px solid #a78bfa;padding:14px 18px;border-radius:0 6px 6px 0;">
              <p style="margin:0;color:#c4b5fd;font-size:14px;line-height:1.65;">
                <strong>No payment required.</strong> Your plan is comped — you'll keep full ${planLabel} access without ever being charged, for as long as your account is marked this way.
              </p>
            </td>
          </tr>
        </table>`
      : '';

    const html = `
      <div style="max-width:520px;margin:0 auto;font-family:Arial,sans-serif;background:#0d1117;padding:40px 24px;border-radius:10px;border:1px solid #1e2a3a;border-top:3px solid #1e6e43;">
        <div style="text-align:center;margin-bottom:32px;">
          <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.22em;color:#4ade80;text-transform:uppercase;font-weight:700;">Sunday Huddle</p>
          <h1 style="margin:0;font-size:22px;font-weight:900;color:#f1f5f9;letter-spacing:0.04em;text-transform:uppercase;line-height:1.1;">${isComped ? 'Plan Upgraded — Free' : 'Plan Updated'}</h1>
        </div>
        <div style="height:1px;background:#1e2a3a;margin:0 0 28px;"></div>
        <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 20px;">
          ${introText}
        </p>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 24px;">
          <tr>
            <td style="background:#0d1f17;border-left:3px solid #1e6e43;padding:16px 18px;border-radius:0 6px 6px 0;">
              <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.15em;color:#64748b;text-transform:uppercase;font-weight:700;">${isComped ? 'Plan' : 'New Plan'}</p>
              <p style="margin:0;font-size:22px;font-weight:900;color:${planColor};text-transform:uppercase;letter-spacing:0.06em;">${planLabel}</p>
              ${!isComped && trialDays && trialDays > 0
                ? `<p style="margin:6px 0 0;font-size:13px;color:#fcd34d;">+ ${trialDays}-day trial — Standard access while trial is active.</p>`
                : ''}
            </td>
          </tr>
        </table>
        ${compedCallout}
        <p style="color:#64748b;font-size:12px;line-height:1.6;margin:0;text-align:center;">
          Questions? Reply to this email.<br>
          © ${new Date().getFullYear()} Sunday Huddle. All rights reserved.
        </p>
      </div>
    `;
    return this.sendEmail({ to: email, subject, html });
  }

  async sendPromotionEmail(email: string, displayName: string): Promise<boolean> {
    const subject = 'Unlock More with Sunday Huddle — Upgrade Your Plan';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const loginUrl = `${baseUrl}/admin/login`;

    const planTable = `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:18px 0;border-collapse:collapse;">
        <thead>
          <tr style="background-color:#141c26;">
            <th style="padding:10px 14px;text-align:left;color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;border:1px solid #1e2a3a;">Feature</th>
            <th style="padding:10px 14px;text-align:center;color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;border:1px solid #1e2a3a;">Free</th>
            <th style="padding:10px 14px;text-align:center;color:#fcd34d;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;border:1px solid #1e2a3a;">Standard</th>
            <th style="padding:10px 14px;text-align:center;color:#4ade80;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;border:1px solid #1e2a3a;">Pro</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:10px 14px;color:#f1f5f9;font-size:14px;border:1px solid #1e2a3a;">Pools</td>
            <td style="padding:10px 14px;text-align:center;color:#94a3b8;font-size:14px;border:1px solid #1e2a3a;">1</td>
            <td style="padding:10px 14px;text-align:center;color:#fcd34d;font-size:14px;border:1px solid #1e2a3a;">1</td>
            <td style="padding:10px 14px;text-align:center;color:#4ade80;font-size:14px;font-weight:700;border:1px solid #1e2a3a;">3</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;color:#f1f5f9;font-size:14px;background-color:#0d1117;border:1px solid #1e2a3a;">Participants per Pool</td>
            <td style="padding:10px 14px;text-align:center;color:#94a3b8;font-size:14px;background-color:#0d1117;border:1px solid #1e2a3a;">15</td>
            <td style="padding:10px 14px;text-align:center;color:#fcd34d;font-size:14px;background-color:#0d1117;border:1px solid #1e2a3a;">30</td>
            <td style="padding:10px 14px;text-align:center;color:#4ade80;font-size:14px;font-weight:700;background-color:#0d1117;border:1px solid #1e2a3a;">75</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;color:#f1f5f9;font-size:14px;border:1px solid #1e2a3a;">Email Notifications</td>
            <td style="padding:10px 14px;text-align:center;color:#94a3b8;font-size:14px;border:1px solid #1e2a3a;">Basic</td>
            <td style="padding:10px 14px;text-align:center;color:#fcd34d;font-size:14px;border:1px solid #1e2a3a;">Full</td>
            <td style="padding:10px 14px;text-align:center;color:#4ade80;font-size:14px;font-weight:700;border:1px solid #1e2a3a;">Full</td>
          </tr>
        </tbody>
      </table>
    `;

    const content = `
      <p style="margin:0 0 20px;color:#f1f5f9;font-size:16px;line-height:1.6;">Hi ${displayName},</p>
      <p style="margin:0 0 20px;color:#94a3b8;font-size:15px;line-height:1.6;">
        You're currently on the <strong style="color:#f1f5f9;">Free Plan</strong>. Upgrade today to run bigger pools, host more participants, and unlock the full Sunday Huddle experience.
      </p>
      ${planTable}
      <p style="margin:16px 0 0;color:#94a3b8;font-size:14px;line-height:1.6;text-align:center;">
        Ready to level up? Contact Sunday Huddle support to upgrade.
      </p>
    `;

    const html = createResponsiveEmailTemplate({
      title: 'Unlock More',
      content,
      buttonText: 'Sign In to Dashboard',
      buttonUrl: loginUrl,
      footerText: 'You received this because you are a Sunday Huddle commissioner. Questions? Reply to this email.',
    });

    return this.sendEmail({ to: email, subject, html });
  }

  // Sent to the commissioner who initiated a Huddle transfer, asking them
  // to confirm their own request before it can take effect.
  async sendHuddleTransferConfirmation(fromEmail: string, huddleName: string, toEmail: string, confirmUrl: string): Promise<boolean> {
    const subject = `Confirm: Transfer "${huddleName}" to ${toEmail}`;

    const content = `
      <p style="margin: 0 0 20px; color: #f1f5f9; font-size: 16px; line-height: 1.6;">
        You requested to transfer your Huddle <strong style="color: #f1f5f9;">${huddleName}</strong> — and every pool in it — to <strong style="color: #f1f5f9;">${toEmail}</strong>.
      </p>
      ${createInfoBox(`
        <strong>Nothing happens until both of you confirm.</strong><br>
        Click below to confirm your side. ${toEmail} will get their own confirmation email — the transfer only completes once you've both confirmed.
      `, 'warning')}
      <p style="margin: 20px 0; color: #94a3b8; font-size: 15px; line-height: 1.6;">
        Didn't request this? Ignore this email — the transfer link expires in 7 days and nothing changes unless you confirm.
      </p>
    `;

    const html = createResponsiveEmailTemplate({
      title: 'Confirm Huddle Transfer',
      content,
      buttonText: 'Confirm Transfer',
      buttonUrl: confirmUrl,
      footerText: 'This is a security-sensitive action from Sunday Huddle.',
    });

    return this.sendEmail({ to: fromEmail, subject, html });
  }

  // Sent to the recipient of a Huddle transfer, asking them to accept it.
  async sendHuddleTransferApprovalRequest(toEmail: string, toName: string, huddleName: string, fromEmail: string, confirmUrl: string): Promise<boolean> {
    const subject = `${fromEmail} wants to transfer "${huddleName}" to you`;

    const content = `
      <p style="margin: 0 0 20px; color: #f1f5f9; font-size: 16px; line-height: 1.6;">
        Hi ${toName},
      </p>
      <p style="margin: 0 0 20px; color: #94a3b8; font-size: 15px; line-height: 1.6;">
        <strong style="color: #f1f5f9;">${fromEmail}</strong> wants to transfer their Huddle <strong style="color: #f1f5f9;">${huddleName}</strong> — and every pool in it — to your account.
      </p>
      ${createInfoBox(`
        <strong>Accepting this makes you the commissioner</strong> of ${huddleName}: its roster, its pools, and everything in them.
        The transfer only completes once you've both confirmed.
      `, 'info')}
      <p style="margin: 20px 0; color: #94a3b8; font-size: 15px; line-height: 1.6;">
        Weren't expecting this? Ignore this email — the link expires in 7 days and nothing changes unless you confirm.
      </p>
    `;

    const html = createResponsiveEmailTemplate({
      title: 'Accept Huddle Transfer',
      content,
      buttonText: 'Accept Transfer',
      buttonUrl: confirmUrl,
      footerText: 'This is a security-sensitive action from Sunday Huddle.',
    });

    return this.sendEmail({ to: toEmail, subject, html });
  }

  // Sent to both parties once a Huddle transfer has fully completed.
  async sendHuddleTransferCompleted(recipientEmail: string, huddleName: string, otherPartyEmail: string): Promise<boolean> {
    const subject = `Transfer complete: "${huddleName}"`;

    const content = `
      <p style="margin: 0 0 20px; color: #f1f5f9; font-size: 16px; line-height: 1.6;">
        The transfer of <strong style="color: #f1f5f9;">${huddleName}</strong> between you and <strong style="color: #f1f5f9;">${otherPartyEmail}</strong> is complete.
      </p>
      <p style="margin: 20px 0; color: #94a3b8; font-size: 15px; line-height: 1.6;">
        Sign in to your dashboard to see the current state of this Huddle.
      </p>
    `;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const html = createResponsiveEmailTemplate({
      title: 'Huddle Transfer Complete',
      content,
      buttonText: 'Go to Dashboard',
      buttonUrl: `${baseUrl}/dashboard`,
      footerText: 'This is an automated notification from Sunday Huddle.',
    });

    return this.sendEmail({ to: recipientEmail, subject, html });
  }

  // Sent to the commissioner who initiated a single-pool transfer, asking
  // them to confirm their own request before it can take effect.
  async sendPoolTransferConfirmation(fromEmail: string, poolName: string, toEmail: string, confirmUrl: string): Promise<boolean> {
    const subject = `Confirm: Transfer "${poolName}" to ${toEmail}`;

    const content = `
      <p style="margin: 0 0 20px; color: #f1f5f9; font-size: 16px; line-height: 1.6;">
        You requested to transfer your pool <strong style="color: #f1f5f9;">${poolName}</strong> — and its participants — to <strong style="color: #f1f5f9;">${toEmail}</strong>'s League.
      </p>
      ${createInfoBox(`
        <strong>Nothing happens until both of you confirm.</strong><br>
        Click below to confirm your side. ${toEmail} will get their own confirmation email — the transfer only completes once you've both confirmed.
      `, 'warning')}
      <p style="margin: 20px 0; color: #94a3b8; font-size: 15px; line-height: 1.6;">
        Didn't request this? Ignore this email — the transfer link expires in 7 days and nothing changes unless you confirm.
      </p>
    `;

    const html = createResponsiveEmailTemplate({
      title: 'Confirm Pool Transfer',
      content,
      buttonText: 'Confirm Transfer',
      buttonUrl: confirmUrl,
      footerText: 'This is a security-sensitive action from Sunday Huddle.',
    });

    return this.sendEmail({ to: fromEmail, subject, html });
  }

  // Sent to the recipient of a single-pool transfer, asking them to accept it.
  async sendPoolTransferApprovalRequest(toEmail: string, toName: string, poolName: string, fromEmail: string, confirmUrl: string): Promise<boolean> {
    const subject = `${fromEmail} wants to transfer "${poolName}" to your League`;

    const content = `
      <p style="margin: 0 0 20px; color: #f1f5f9; font-size: 16px; line-height: 1.6;">
        Hi ${toName},
      </p>
      <p style="margin: 0 0 20px; color: #94a3b8; font-size: 15px; line-height: 1.6;">
        <strong style="color: #f1f5f9;">${fromEmail}</strong> wants to transfer their pool <strong style="color: #f1f5f9;">${poolName}</strong> — and its participants — into your League.
      </p>
      ${createInfoBox(`
        <strong>Accepting this adds ${poolName}</strong> to your League, with its participants merged into your roster.
        The transfer only completes once you've both confirmed, and won't go through if it would put your account over its pool or participant limits.
      `, 'info')}
      <p style="margin: 20px 0; color: #94a3b8; font-size: 15px; line-height: 1.6;">
        Weren't expecting this? Ignore this email — the link expires in 7 days and nothing changes unless you confirm.
      </p>
    `;

    const html = createResponsiveEmailTemplate({
      title: 'Accept Pool Transfer',
      content,
      buttonText: 'Accept Transfer',
      buttonUrl: confirmUrl,
      footerText: 'This is a security-sensitive action from Sunday Huddle.',
    });

    return this.sendEmail({ to: toEmail, subject, html });
  }

  // Sent to every participant with an email address, plus the commissioner,
  // when a pool is deleted — everyone who had picks/standings riding on it
  // finds out it's gone rather than just seeing it vanish next time they
  // check. Same wording works for both audiences: a participant learns
  // their pool was removed, and the commissioner gets a confirmation record
  // of their own action.
  async sendPoolDeletedNotification(
    recipientEmail: string,
    recipientName: string,
    poolName: string,
    commissionerEmail: string,
    participantCount: number,
    season?: number
  ): Promise<boolean> {
    const subject = `Pool Deleted: "${poolName}"`;

    const content = `
      <p style="margin: 0 0 20px; color: #f1f5f9; font-size: 16px; line-height: 1.6;">
        Hi ${recipientName},
      </p>

      <p style="margin: 0 0 20px; color: #94a3b8; font-size: 15px; line-height: 1.6;">
        The pool <strong style="color: #f1f5f9;">"${poolName}"</strong>${season ? ` (${season} season)` : ''} has been deleted by its commissioner (<strong style="color: #f1f5f9;">${commissionerEmail}</strong>).
      </p>

      ${createInfoBox(`
        This pool${participantCount > 0 ? `, its ${participantCount} participant${participantCount === 1 ? '' : 's'},` : ''} and all associated picks, scores, and standings have been permanently removed. This cannot be undone.
      `, 'warning')}

      <p style="margin: 20px 0; color: #94a3b8; font-size: 15px; line-height: 1.6;">
        If you believe this was a mistake, reach out to your commissioner directly.
      </p>
    `;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const html = createResponsiveEmailTemplate({
      title: 'Pool Deleted',
      content,
      buttonText: 'Go to Dashboard',
      buttonUrl: `${baseUrl}/dashboard`,
      footerText: 'This is an automated notification from Sunday Huddle.',
      accentColor: '#dc2626',
    });

    return this.sendEmail({ to: recipientEmail, subject, html });
  }

  // Sent to both parties once a pool transfer has fully completed.
  async sendPoolTransferCompleted(recipientEmail: string, poolName: string, otherPartyEmail: string): Promise<boolean> {
    const subject = `Transfer complete: "${poolName}"`;

    const content = `
      <p style="margin: 0 0 20px; color: #f1f5f9; font-size: 16px; line-height: 1.6;">
        The transfer of <strong style="color: #f1f5f9;">${poolName}</strong> between you and <strong style="color: #f1f5f9;">${otherPartyEmail}</strong> is complete.
      </p>
      <p style="margin: 20px 0; color: #94a3b8; font-size: 15px; line-height: 1.6;">
        Sign in to your dashboard to see the current state of this pool.
      </p>
    `;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const html = createResponsiveEmailTemplate({
      title: 'Pool Transfer Complete',
      content,
      buttonText: 'Go to Dashboard',
      buttonUrl: `${baseUrl}/dashboard`,
      footerText: 'This is an automated notification from Sunday Huddle.',
    });

    return this.sendEmail({ to: recipientEmail, subject, html });
  }

  // Sent to both parties when a pool transfer was confirmed by both sides
  // but couldn't complete because it would have exceeded a limit on the
  // destination account (checked again at confirm time, since either
  // party's situation may have changed since the request was sent).
  async sendPoolTransferFailed(recipientEmail: string, poolName: string, otherPartyEmail: string, reason: string): Promise<boolean> {
    const subject = `Transfer couldn't complete: "${poolName}"`;

    const content = `
      <p style="margin: 0 0 20px; color: #f1f5f9; font-size: 16px; line-height: 1.6;">
        You and <strong style="color: #f1f5f9;">${otherPartyEmail}</strong> both confirmed the transfer of <strong style="color: #f1f5f9;">${poolName}</strong>, but it couldn't complete.
      </p>
      ${createInfoBox(reason, 'warning')}
      <p style="margin: 20px 0; color: #94a3b8; font-size: 15px; line-height: 1.6;">
        Once that's resolved, start a new transfer request — this one has been cancelled.
      </p>
    `;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const html = createResponsiveEmailTemplate({
      title: 'Pool Transfer Failed',
      content,
      buttonText: 'Go to Dashboard',
      buttonUrl: `${baseUrl}/dashboard`,
      footerText: 'This is an automated notification from Sunday Huddle.',
    });

    return this.sendEmail({ to: recipientEmail, subject, html });
  }

  // Sent from the Stripe webhook once checkout.session.completed fires — the
  // receipt for a Standard upgrade or add-on pool purchase.
  async sendUpgradeConfirmation(
    adminEmail: string,
    adminName: string,
    details: { product: 'standard' | 'addon_pool'; quantity: number; amountCents: number | null; currency: string }
  ): Promise<boolean> {
    const { product, quantity, amountCents, currency } = details;
    const isStandard = product === 'standard';
    const amount = amountCents != null
      ? (amountCents / 100).toLocaleString('en-US', { style: 'currency', currency: currency.toUpperCase() })
      : null;

    const subject = isStandard
      ? 'Payment Confirmed — You\'re on Sunday Huddle Standard'
      : `Payment Confirmed — ${quantity} Add-on Pool${quantity !== 1 ? 's' : ''} Added`;

    const content = `
      <p style="margin: 0 0 20px; color: #f1f5f9; font-size: 16px; line-height: 1.6;">
        Hi ${adminName},
      </p>
      <p style="margin: 0 0 20px; color: #94a3b8; font-size: 15px; line-height: 1.6;">
        ${isStandard
          ? 'Thanks for upgrading! Your account is now on the Standard plan.'
          : `Thanks for your purchase! ${quantity} add-on pool${quantity !== 1 ? 's have' : ' has'} been added to your Huddle.`}
      </p>
      ${createInfoBox(`
        <strong>Order Summary</strong><br>
        ${isStandard ? 'Standard plan (per season)' : `Add-on pool${quantity !== 1 ? 's' : ''} (per season): ${quantity}`}<br>
        ${amount ? `Amount charged: ${amount}<br>` : ''}
        Date: ${new Date().toLocaleString()}
      `, 'success')}
      <p style="margin: 20px 0 0; color: #94a3b8; font-size: 15px; line-height: 1.6;">
        ${isStandard
          ? 'You now have full season & playoff tracking, automatic pick reminders, and room for more pools in your Huddle.'
          : 'Head to your dashboard to set up your new pool.'}
      </p>
    `;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const html = createResponsiveEmailTemplate({
      title: isStandard ? 'Upgrade Confirmed' : 'Add-on Pools Added',
      content,
      buttonText: 'Go to Dashboard',
      buttonUrl: `${baseUrl}/dashboard`,
      footerText: 'This is a payment confirmation from Sunday Huddle. Questions? Reply to this email.',
    });

    return this.sendEmail({ to: adminEmail, subject, html });
  }
}

// Export a singleton instance
export const emailService = new EmailService();
