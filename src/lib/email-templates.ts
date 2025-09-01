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

📅 **Deadline**: Sunday 1:00 PM ET
🎯 **Games**: 16 games this week
🏆 **Current Standings**: Check the leaderboard after making your picks

**Make Your Picks Now**: {poolUrl}

Don't forget to assign confidence points (1-16) to each game. Higher confidence = more points for correct picks!

Good luck!

Best regards,
{adminName}
{poolName} Commissioner`,
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

**Deadline**: Sunday 1:00 PM ET

**Quick Link**: {poolUrl}

Don't miss out on this week's games! Make your picks now to stay in the running.

If you have any issues, please contact us immediately.

Best regards,
{adminName}
{poolName} Commissioner`,
    description: 'Urgent reminder for participants who haven\'t submitted picks',
    targetAudience: 'not_submitted',
    category: 'reminder'
  },
  {
    id: 'week-results',
    name: 'Week Results Available',
    subject: 'Week {currentWeek} Results Are In! - {poolName}',
    body: `Hi {participantName}!

🏈 **Week {currentWeek} Results Are Available!** 🏈

The results for Week {currentWeek} in {poolName} have been posted!

**Check Your Results**: {poolUrl}

See how you performed this week and check the updated leaderboard. Don't forget to make your picks for next week!

Best regards,
{adminName}
{poolName} Commissioner`,
    description: 'Notify participants that week results are available',
    targetAudience: 'submitted',
    category: 'update'
  },
  {
    id: 'playoff-reminder',
    name: 'Playoff Reminder',
    subject: 'Playoffs Start This Week! - {poolName}',
    body: `Hi {participantName}!

🏆 **PLAYOFFS ARE HERE!** 🏆

The NFL playoffs begin this week, and {poolName} is ready for the postseason!

**Important Changes for Playoffs:**
• Fewer games each week
• Higher stakes for each pick
• Championship bracket format
• Super Bowl picks coming soon!

**Make Your Playoff Picks**: {poolUrl}

The playoffs are where legends are made! Make your picks carefully and good luck!

Best regards,
{adminName}
{poolName} Commissioner`,
    description: 'Remind participants about playoff format changes',
    targetAudience: 'all',
    category: 'reminder'
  },
  {
    id: 'super-bowl-reminder',
    name: 'Super Bowl Reminder',
    subject: 'Super Bowl Picks Due! - {poolName}',
    body: `Hi {participantName}!

🏈 **SUPER BOWL PICKS DUE!** 🏈

The biggest game of the year is here! Make your Super Bowl picks for {poolName}!

**Super Bowl Picks Include:**
• Winner of the game
• Total points scored
• MVP selection
• First touchdown scorer

**Make Your Super Bowl Picks**: {poolUrl}

This is your chance to win it all! Don't miss out on the championship picks.

Best regards,
{adminName}
{poolName} Commissioner`,
    description: 'Remind participants to make Super Bowl picks',
    targetAudience: 'all',
    category: 'reminder'
  },
  {
    id: 'season-wrap-up',
    name: 'Season Wrap-Up',
    subject: 'Season Wrap-Up - {poolName}',
    body: `Hi {participantName}!

🏆 **Season Wrap-Up** 🏆

The {season} NFL season has come to an end, and we want to thank you for participating in {poolName}!

**Final Results**: {poolUrl}

**Season Highlights:**
• Check out the final standings
• See who won the championship
• Review your season performance
• Plan for next season

Thank you for making this season great! We hope to see you back next year.

Best regards,
{adminName}
{poolName} Commissioner`,
    description: 'Send season wrap-up message to all participants',
    targetAudience: 'all',
    category: 'update'
  },
  {
    id: 'pool-update',
    name: 'Pool Update',
    subject: 'Important Update - {poolName}',
    body: `Hi {participantName}!

We have an important update regarding {poolName}:

Please check the pool for the latest updates and information.

**Pool Link**: {poolUrl}

If you have any questions, please don't hesitate to reach out.

Best regards,
{adminName}
{poolName} Commissioner`,
    description: 'Send general pool updates to all participants',
    targetAudience: 'all',
    category: 'update'
  },
  {
    id: 'rule-change',
    name: 'Rule Change Notification',
    subject: 'Important Rule Change - {poolName}',
    body: `Hi {participantName}!

📋 **IMPORTANT RULE CHANGE** 📋

We've made some changes to the rules for {poolName}:

Please review the updated rules and contact us if you have any questions.

**Updated Rules**: {poolUrl}

These changes will take effect immediately. Thank you for your understanding.

Best regards,
{adminName}
{poolName} Commissioner`,
    description: 'Notify participants about rule changes',
    targetAudience: 'all',
    category: 'update'
  },
  {
    id: 'technical-issue',
    name: 'Technical Issue Alert',
    subject: 'Technical Issue - {poolName}',
    body: `Hi {participantName}!

⚠️ **TECHNICAL ISSUE ALERT** ⚠️

We're experiencing some technical difficulties with {poolName}:

We're working to resolve this as quickly as possible. Please check back later or contact us if you need immediate assistance.

**Pool Status**: {poolUrl}

We apologize for any inconvenience and appreciate your patience.

Best regards,
{adminName}
{poolName} Commissioner`,
    description: 'Alert participants about technical issues',
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
{poolName} Commissioner`,
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
