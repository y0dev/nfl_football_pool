import nodemailer from 'nodemailer';

export interface EmailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
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

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private config: EmailConfig | null = null;
  private initialized = false;

  constructor() {
    // Only initialize on client side
    if (typeof window !== 'undefined') {
      this.initializeTransporter();
    }
  }

  private initializeTransporter() {
    if (this.initialized) return;
    
    const host = process.env.NEXT_PUBLIC_SMTP_HOST || process.env.SMTP_HOST;
    const port = process.env.NEXT_PUBLIC_SMTP_PORT || process.env.SMTP_PORT;
    const user = process.env.NEXT_PUBLIC_SMTP_USER || process.env.SMTP_USER;
    const pass = process.env.NEXT_PUBLIC_SMTP_PASS || process.env.SMTP_PASS;
    const from = process.env.NEXT_PUBLIC_SMTP_FROM || process.env.SMTP_FROM;

    if (!host || !port || !user || !pass || !from) {
      console.warn('⚠️ Email configuration incomplete. Email functionality will be disabled.');
      this.initialized = true;
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
      secure: this.config.port === 465,
      auth: {
        user: this.config.user,
        pass: this.config.pass,
      },
    });

    console.log('✅ Email service initialized');
    this.initialized = true;
  }

  private createPickReminderTemplate(data: PickReminderData): EmailTemplate {
    const subject = `🏈 NFL Confidence Pool - Week ${data.weekNumber} Picks Due!`;
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NFL Confidence Pool - Week ${data.weekNumber} Picks</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
        }
        .container {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo {
            font-size: 32px;
            font-weight: bold;
            color: #1a73e8;
            margin-bottom: 10px;
        }
        .week-badge {
            background-color: #1a73e8;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: bold;
            display: inline-block;
            margin-bottom: 20px;
        }
        .content {
            margin-bottom: 30px;
        }
        .deadline {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 6px;
            padding: 15px;
            margin: 20px 0;
            text-align: center;
        }
        .deadline strong {
            color: #856404;
        }
        .cta-button {
            display: inline-block;
            background-color: #1a73e8;
            color: white;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-weight: bold;
            margin: 20px 0;
        }
        .cta-button:hover {
            background-color: #1557b0;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 14px;
            color: #666;
            text-align: center;
        }
        .games-info {
            background-color: #f8f9fa;
            border-radius: 6px;
            padding: 15px;
            margin: 20px 0;
        }
        .admin-info {
            font-style: italic;
            color: #666;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🏈 NFL Confidence Pool</div>
            <div class="week-badge">Week ${data.weekNumber}</div>
        </div>
        
        <div class="content">
            <h2>Hi ${data.participantName}!</h2>
            
            <p>It's time to make your picks for <strong>${data.poolName}</strong> - Week ${data.weekNumber}!</p>
            
            <div class="deadline">
                <strong>⏰ Deadline:</strong> ${data.deadline}
            </div>
            
            <div class="games-info">
                <strong>📊 This Week:</strong> ${data.gamesCount} games to pick
            </div>
            
            <p>Don't forget to assign your confidence points (1-${data.gamesCount}) to each game. The higher the confidence, the more points you'll earn if you're right!</p>
            
            <div style="text-align: center;">
                <a href="${data.poolUrl}" class="cta-button">Make Your Picks Now</a>
            </div>
            
            <div class="admin-info">
                Sent by ${data.adminName}
            </div>
        </div>
        
        <div class="footer">
            <p>This is an automated reminder from your NFL Confidence Pool.</p>
            <p>If you have any questions, please contact your pool administrator.</p>
        </div>
    </div>
</body>
</html>`;

    const text = `
🏈 NFL Confidence Pool - Week ${data.weekNumber} Picks Due!

Hi ${data.participantName}!

It's time to make your picks for ${data.poolName} - Week ${data.weekNumber}!

⏰ Deadline: ${data.deadline}
📊 This Week: ${data.gamesCount} games to pick

Don't forget to assign your confidence points (1-${data.gamesCount}) to each game. The higher the confidence, the more points you'll earn if you're right!

Make your picks here: ${data.poolUrl}

Sent by ${data.adminName}

---
This is an automated reminder from your NFL Confidence Pool.
If you have any questions, please contact your pool administrator.`;

    return { subject, html, text };
  }

  async sendPickReminder(data: PickReminderData): Promise<boolean> {
    if (typeof window === 'undefined') {
      console.error('❌ Email service cannot be used on server side');
      return false;
    }

    if (!this.initialized) {
      this.initializeTransporter();
    }

    if (!this.transporter || !this.config) {
      console.error('❌ Email service not configured');
      return false;
    }

    try {
      const template = this.createPickReminderTemplate(data);
      
      const mailOptions = {
        from: this.config.from,
        to: data.participantEmail,
        subject: template.subject,
        html: template.html,
        text: template.text,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Pick reminder sent to ${data.participantEmail}: ${info.messageId}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to send pick reminder to ${data.participantEmail}:`, error);
      return false;
    }
  }

  async sendBulkPickReminders(reminders: PickReminderData[]): Promise<{
    sent: number;
    failed: number;
    total: number;
  }> {
    if (typeof window === 'undefined') {
      console.error('❌ Email service cannot be used on server side');
      return { sent: 0, failed: reminders.length, total: reminders.length };
    }

    if (!this.initialized) {
      this.initializeTransporter();
    }

    if (!this.transporter || !this.config) {
      console.error('❌ Email service not configured');
      return { sent: 0, failed: reminders.length, total: reminders.length };
    }

    let sent = 0;
    let failed = 0;

    console.log(`📧 Sending ${reminders.length} pick reminders...`);

    for (const reminder of reminders) {
      const success = await this.sendPickReminder(reminder);
      if (success) {
        sent++;
      } else {
        failed++;
      }
      
      // Add a small delay between emails to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`📊 Email results: ${sent} sent, ${failed} failed`);
    return { sent, failed, total: reminders.length };
  }

  isConfigured(): boolean {
    if (typeof window === 'undefined') {
      return false; // Always return false on server side
    }

    if (!this.initialized) {
      this.initializeTransporter();
    }

    return this.transporter !== null && this.config !== null;
  }
}

// Export singleton instance
export const emailService = new EmailService();
