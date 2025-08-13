export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  description: string;
  targetAudience: 'all' | 'submitted' | 'not_submitted';
  category: 'welcome' | 'reminder' | 'update' | 'custom';
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'welcome-new-participants',
    name: 'Welcome New Participants',
    subject: 'Welcome to {poolName} - NFL Confidence Pool!',
    body: `Hi {participantName}!

Welcome to {poolName}! We're excited to have you join our NFL Confidence Pool for the {season} season.

Here's what you need to know:
• Pool Link: {poolUrl}
• Current Week: Week {currentWeek}
• Make your picks by the deadline each week
• Assign confidence points (1-16) to each game
• Higher confidence = more points for correct picks

To get started, click the link above and make your picks for Week {currentWeek}.

Good luck and have fun!

Best regards,
{adminName}
{poolName} Administrator`,
    description: 'Welcome new participants to the pool with instructions',
    targetAudience: 'all',
    category: 'welcome'
  },
  {
    id: 'weekly-pick-reminder',
    name: 'Weekly Pick Reminder',
    subject: 'Reminder: Make Your Picks for Week {currentWeek} - {poolName}',
    body: `Hi {participantName}!

Just a friendly reminder that it's time to make your picks for Week {currentWeek} in {poolName}!

📅 **Deadline**: {deadline}
🎯 **Games**: {gameCount} games this week
🏆 **Current Standings**: Check the leaderboard after making your picks

**Make Your Picks Now**: {poolUrl}

Don't forget to assign confidence points (1-16) to each game. Higher confidence = more points for correct picks!

Good luck!

Best regards,
{adminName}
{poolName} Administrator`,
    description: 'Remind participants to make their weekly picks',
    targetAudience: 'not_submitted',
    category: 'reminder'
  },
  {
    id: 'deadline-approaching',
    name: 'Deadline Approaching',
    subject: 'URGENT: Pick Deadline Approaching - Week {currentWeek}',
    body: `Hi {participantName}!

⏰ **DEADLINE APPROACHING** ⏰

You haven't submitted your picks for Week {currentWeek} in {poolName} yet!

**Deadline**: {deadline} (in {timeRemaining})

**Quick Link**: {poolUrl}

Don't miss out on this week's games! Make your picks now to stay in the running.

If you have any issues, please contact us immediately.

Best regards,
{adminName}
{poolName} Administrator`,
    description: 'Urgent reminder for participants who haven\'t submitted picks',
    targetAudience: 'not_submitted',
    category: 'reminder'
  },
  {
    id: 'week-results',
    name: 'Week Results & Standings',
    subject: 'Week {currentWeek} Results - {poolName}',
    body: `Hi {participantName}!

Week {currentWeek} results are in for {poolName}!

🏆 **Your Performance**:
• Points Earned: {pointsEarned}
• Correct Picks: {correctPicks}/{totalPicks}
• Current Rank: {currentRank}

📊 **Top Performers This Week**:
{topPerformers}

🎯 **Overall Standings**:
{overallStandings}

**View Full Results**: {poolUrl}

Great job this week! Keep up the momentum for Week {nextWeek}.

Best regards,
{adminName}
{poolName} Administrator`,
    description: 'Share weekly results and standings with participants',
    targetAudience: 'all',
    category: 'update'
  },
  {
    id: 'pool-update',
    name: 'Pool Update',
    subject: 'Important Update - {poolName}',
    body: `Hi {participantName}!

We have an important update regarding {poolName}:

{updateMessage}

**Pool Link**: {poolUrl}

If you have any questions, please don't hesitate to reach out.

Best regards,
{adminName}
{poolName} Administrator`,
    description: 'Send general pool updates to all participants',
    targetAudience: 'all',
    category: 'update'
  },
  {
    id: 'playoff-reminder',
    name: 'Playoff Reminder',
    subject: 'Playoff Time! - {poolName}',
    body: `Hi {participantName}!

🏈 **PLAYOFFS ARE HERE!** 🏈

The NFL playoffs have begun, and {poolName} is still going strong!

**Current Standings**:
{currentStandings}

**Make Your Playoff Picks**: {poolUrl}

The stakes are higher now - make sure to submit your picks for the playoff games!

Good luck in the playoffs!

Best regards,
{adminName}
{poolName} Administrator`,
    description: 'Special reminder for playoff weeks',
    targetAudience: 'all',
    category: 'reminder'
  },
  {
    id: 'season-wrap-up',
    name: 'Season Wrap-Up',
    subject: 'Season Wrap-Up - {poolName}',
    body: `Hi {participantName}!

🏆 **SEASON COMPLETE!** 🏆

Congratulations! We've made it through the {season} NFL season in {poolName}!

**Final Results**:
{finalResults}

**Season Highlights**:
{seasonHighlights}

Thank you for participating this season! We hope you had fun and enjoyed the competition.

We'll be back next season - stay tuned for updates!

Best regards,
{adminName}
{poolName} Administrator`,
    description: 'End-of-season wrap-up message',
    targetAudience: 'all',
    category: 'update'
  },
  {
    id: 'custom-message',
    name: 'Custom Message',
    subject: '{customSubject}',
    body: `{customMessage}

**Pool Link**: {poolUrl}

Best regards,
{adminName}
{poolName} Administrator`,
    description: 'Send a custom message to participants',
    targetAudience: 'all',
    category: 'custom'
  }
];

export function getTemplatesByCategory(category?: string): EmailTemplate[] {
  if (!category) return EMAIL_TEMPLATES;
  return EMAIL_TEMPLATES.filter(template => template.category === category);
}

export function getTemplateById(id: string): EmailTemplate | undefined {
  return EMAIL_TEMPLATES.find(template => template.id === id);
}

export function getTemplatesByAudience(audience: 'all' | 'submitted' | 'not_submitted'): EmailTemplate[] {
  return EMAIL_TEMPLATES.filter(template => template.targetAudience === audience);
}
