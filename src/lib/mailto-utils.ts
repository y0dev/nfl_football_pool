export interface MailtoOptions {
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  body?: string;
}

export function createMailtoUrl(options: MailtoOptions): string {
  const params = new URLSearchParams();
  
  if (options.to) params.append('to', options.to);
  if (options.cc) params.append('cc', options.cc);
  if (options.bcc) params.append('bcc', options.bcc);
  if (options.subject) params.append('subject', options.subject);
  if (options.body) params.append('body', options.body);
  
  return `mailto:?${params.toString()}`;
}

export async function openEmailClient(mailtoUrl: string): Promise<boolean> {
  try {
    // Method 1: Direct window.open
    const newWindow = window.open(mailtoUrl, '_blank');
    
    // Check if popup was blocked
    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
      throw new Error('Popup blocked or failed to open');
    }
    
    return true;
  } catch (openError) {
    console.error('Failed to open email client:', openError);
    
    try {
      // Method 2: Try with location.href
      window.location.href = mailtoUrl;
      return true;
    } catch (hrefError) {
      console.error('Failed with location.href:', hrefError);
      return false;
    }
  }
}

export async function copyMailtoToClipboard(mailtoUrl: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(mailtoUrl);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

export function createPoolInviteEmail(poolName: string, poolId: string, weekNumber: number, adminEmail?: string): MailtoOptions {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const inviteLink = `${baseUrl}/invite?pool=${poolId}&week=${weekNumber}${adminEmail ? `&admin=${encodeURIComponent(adminEmail)}` : ''}`;
  
  return {
    subject: `${poolName} - Week ${weekNumber} NFL Pool Invitation`,
    body: `You're invited to join our NFL Confidence Pool for Week ${weekNumber}!

Pool: ${poolName}
Current Week: ${weekNumber}

Click this link to join: ${inviteLink}

Once you join, you'll be able to make your picks for all the NFL games this week.

Looking forward to seeing your picks!
Pool Commissioner`
  };
}

export function createReminderEmail(poolName: string, weekNumber: number): MailtoOptions {
  return {
    subject: `${poolName} - Week ${weekNumber} Reminder`,
    body: `Hi there!

This is a friendly reminder that you haven't submitted your picks for Week ${weekNumber} of our NFL Confidence Pool.

Please log in and submit your picks before the games start.

Thanks!
Pool Commissioner`
  };
}

export function createSubmissionSummaryEmail(
  poolName: string, 
  weekNumber: number, 
  totalParticipants: number,
  submittedCount: number,
  submittedParticipants: Array<{name: string, email: string}>,
  pendingParticipants: Array<{name: string, email: string}>
): MailtoOptions {
  return {
    subject: `${poolName} - Week ${weekNumber} Submission Summary`,
    body: `Week ${weekNumber} Submission Summary

Pool: ${poolName}
Total Participants: ${totalParticipants}
Submitted: ${submittedCount}
Pending: ${totalParticipants - submittedCount}

Submitted Participants:
${submittedParticipants.map(p => `- ${p.name} (${p.email})`).join('\n')}

Pending Participants:
${pendingParticipants.map(p => `- ${p.name} (${p.email})`).join('\n')}

This summary was generated on ${new Date().toLocaleString()}.`
  };
}
