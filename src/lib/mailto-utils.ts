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

function createPoolInviteEmail(poolName: string, poolId: string, weekNumber: number, adminEmail?: string): MailtoOptions {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  const inviteLink = `${baseUrl}/invite?pool=${poolId}&week=${weekNumber}${adminEmail ? `&admin=${encodeURIComponent(adminEmail)}` : ''}`;

  return {
    subject: `You're invited to ${poolName} — Week ${weekNumber} NFL Pick'em`,
    body: `Hey! You've been invited to join ${poolName} on Sunday Huddle.

HOW IT WORKS
------------
Each week, pick the winner of every NFL game and assign confidence points (1 to the number of games). If your pick is right, you earn those points. Highest score wins the week.

JOIN HERE
---------
${inviteLink}

Just click the link, find your name on the roster, and start picking. No account needed — it takes under a minute.

Week ${weekNumber} games are already loaded. Get your picks in before the first kickoff!

See you in the pool,
Your Commissioner`
  };
}

function createReminderEmail(poolName: string, weekNumber: number): MailtoOptions {
  return {
    subject: `Reminder: Week ${weekNumber} picks due — ${poolName}`,
    body: `Hey!

Quick reminder: you haven't submitted your Week ${weekNumber} picks for ${poolName} yet.

Picks lock when the first game kicks off — make sure you're in before then or you'll miss the week entirely.

To submit, open the pool link your commissioner shared and select your winners + confidence points.

Good luck this week,
Your Commissioner`
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
  const pendingCount = totalParticipants - submittedCount;
  const submissionRate = totalParticipants > 0 ? Math.round((submittedCount / totalParticipants) * 100) : 0;

  return {
    subject: `${poolName} — Week ${weekNumber} submission summary (${submittedCount}/${totalParticipants} in)`,
    body: `Week ${weekNumber} Submission Summary
Pool: ${poolName}
Generated: ${new Date().toLocaleString()}

OVERVIEW
--------
Submitted:  ${submittedCount} / ${totalParticipants} (${submissionRate}%)
Pending:    ${pendingCount}

${pendingCount > 0 ? `STILL NEED TO SUBMIT (${pendingCount})
${'-'.repeat(30)}
${pendingParticipants.map(p => `  ${p.name}  <${p.email}>`).join('\n')}

` : 'All participants have submitted their picks!\n\n'}${submittedCount > 0 ? `SUBMITTED (${submittedCount})
${'-'.repeat(30)}
${submittedParticipants.map(p => `  ${p.name}  <${p.email}>`).join('\n')}` : ''}`
  };
}
