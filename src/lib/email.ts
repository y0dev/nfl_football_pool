import nodemailer from 'nodemailer';

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

  // Template for admin account creation notification
  async sendAdminCreationNotification(adminEmail: string, adminName: string, createdBy?: string): Promise<boolean> {
    const subject = 'New Admin Account Created - NFL Confidence Pool';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1f2937; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">
          🏈 NFL Confidence Pool - Admin Account Created
        </h2>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #1f2937; margin-top: 0;">New Admin Account Details:</h3>
          <p><strong>Email:</strong> ${adminEmail}</p>
          <p><strong>Name:</strong> ${adminName}</p>
          <p><strong>Created:</strong> ${new Date().toLocaleString()}</p>
          ${createdBy ? `<p><strong>Created By:</strong> ${createdBy}</p>` : ''}
        </div>
        
        <div style="background-color: #dbeafe; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #1e40af;">
            <strong>Note:</strong> This admin account has been created and is now active. 
            The admin can log in to manage pools and participants.
          </p>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 14px;">
            This is an automated notification from the NFL Confidence Pool system.
          </p>
        </div>
      </div>
    `;

    return this.sendEmail({
      to: adminEmail,
      subject,
      html
    });
  }

  // Template for pool invitation
  async sendPoolInvitation(participantEmail: string, participantName: string, poolName: string, poolLink: string): Promise<boolean> {
    const subject = `You're Invited to Join ${poolName} - NFL Confidence Pool`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1f2937; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">
          🏈 You're Invited to Join ${poolName}
        </h2>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #1f2937; margin-top: 0;">Welcome to the NFL Confidence Pool!</h3>
          <p>Hi ${participantName},</p>
          <p>You've been invited to join <strong>${poolName}</strong> in our NFL Confidence Pool!</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${poolLink}" 
             style="background-color: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            Join Pool Now
          </a>
        </div>
        
        <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h4 style="color: #92400e; margin-top: 0;">How it works:</h4>
          <ul style="color: #92400e; margin: 0; padding-left: 20px;">
            <li>Pick the winner for each NFL game</li>
            <li>Assign confidence points (1-16) to each pick</li>
            <li>Earn points for correct picks × confidence points</li>
            <li>Compete for the highest score each week!</li>
          </ul>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 14px;">
            If you have any questions, please contact your pool administrator.
          </p>
        </div>
      </div>
    `;

    return this.sendEmail({
      to: participantEmail,
      subject,
      html
    });
  }

  // Template for pick reminder
  async sendPickReminder(participantEmail: string, participantName: string, poolName: string, weekNumber: number, poolLink: string, deadline: string): Promise<boolean> {
    const subject = `🏈 Week ${weekNumber} Picks Due - ${poolName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1f2937; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">
          🏈 Week ${weekNumber} Picks Due
        </h2>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #1f2937; margin-top: 0;">Time to Make Your Picks!</h3>
          <p>Hi ${participantName},</p>
          <p>Don't forget to submit your picks for <strong>${poolName}</strong> - Week ${weekNumber}!</p>
        </div>
        
        <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h4 style="color: #92400e; margin-top: 0;">⏰ Deadline:</h4>
          <p style="color: #92400e; margin: 0; font-weight: bold;">${deadline}</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${poolLink}" 
             style="background-color: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            Make Your Picks Now
          </a>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 14px;">
            This is an automated reminder from your NFL Confidence Pool.
          </p>
        </div>
      </div>
    `;

    return this.sendEmail({
      to: participantEmail,
      subject,
      html
    });
  }
}

// Export a singleton instance
export const emailService = new EmailService();
