# Email Template System

The NFL Confidence Pool now includes a comprehensive email template system that allows pool administrators to send various types of emails to participants.

## Features

### 📧 **Email Templates**
- **Welcome Messages**: Welcome new participants to the pool
- **Weekly Reminders**: Remind participants to make their picks
- **Deadline Alerts**: Urgent reminders for approaching deadlines
- **Results & Updates**: Share weekly results and standings
- **Custom Messages**: Send personalized messages to participants

### 🎯 **Targeted Sending**
- **All Participants**: Send to everyone in the pool
- **Submitted Participants**: Send only to those who have submitted picks
- **Not Submitted Participants**: Send only to those who haven't submitted picks

### 📋 **Template Categories**
- **Welcome**: New participant onboarding
- **Reminders**: Pick reminders and deadlines
- **Updates**: Results and pool updates
- **Custom**: Personalized messages

## How to Use

### 1. Access Email Management
- Go to **Admin Dashboard** → **Emails** tab
- Or go to **Pool Details** → **Emails** tab

### 2. Select a Template
1. Choose a **Category** (optional filter)
2. Select an **Email Template** from the dropdown
3. View the template description

### 3. Customize (if needed)
- For **Custom Messages**: Enter subject and message
- Templates automatically include pool-specific information

### 4. Preview
- Switch to the **Preview** tab to see how the email will look
- Copy subject or message to clipboard if needed

### 5. Send
- Click **"Send Emails"** to send to all matching participants
- System automatically filters participants based on template target audience

## Available Templates

### Welcome Templates
- **Welcome New Participants**: Introduces the pool and provides instructions
- **Target**: All participants

### Reminder Templates
- **Weekly Pick Reminder**: Friendly reminder to make picks
- **Target**: Participants who haven't submitted
- **Deadline Approaching**: Urgent reminder for approaching deadlines
- **Target**: Participants who haven't submitted
- **Playoff Reminder**: Special reminder for playoff weeks
- **Target**: All participants

### Update Templates
- **Week Results & Standings**: Share weekly performance and rankings
- **Target**: All participants
- **Pool Update**: General pool announcements
- **Target**: All participants
- **Season Wrap-Up**: End-of-season summary
- **Target**: All participants

### Custom Templates
- **Custom Message**: Send personalized messages
- **Target**: All participants
- **Customizable**: Subject and message content

## Template Variables

Templates automatically include these variables:

### Basic Information
- `{participantName}`: Participant's name
- `{poolName}`: Pool name
- `{poolUrl}`: Direct link to the pool
- `{currentWeek}`: Current week number
- `{season}`: NFL season year
- `{adminName}`: Administrator name

### Time & Deadlines
- `{deadline}`: Pick deadline
- `{timeRemaining}`: Time until deadline
- `{nextWeek}`: Next week number

### Game Information
- `{gameCount}`: Number of games this week

### Performance Data
- `{pointsEarned}`: Points earned this week
- `{correctPicks}`: Number of correct picks
- `{totalPicks}`: Total number of picks
- `{currentRank}`: Current ranking

### Results & Standings
- `{topPerformers}`: Top performers this week
- `{overallStandings}`: Overall standings
- `{currentStandings}`: Current standings
- `{finalResults}`: Final season results
- `{seasonHighlights}`: Season highlights

### Custom Variables
- `{customSubject}`: Custom email subject
- `{customMessage}`: Custom email message
- `{updateMessage}`: Pool update message

## Best Practices

### 1. **Use Appropriate Templates**
- Welcome templates for new participants
- Reminder templates for those who haven't submitted
- Update templates for results and announcements

### 2. **Preview Before Sending**
- Always preview emails before sending
- Check that variables are properly populated

### 3. **Target the Right Audience**
- Use "Not Submitted" templates for reminders
- Use "All Participants" for general updates
- Use "Submitted" for results and follow-ups

### 4. **Customize When Needed**
- Use custom templates for specific announcements
- Personalize messages for your pool's needs

## Technical Details

### Email Logging
- All sent emails are logged in the database
- Includes template used, recipient, subject, and status
- Helps track communication history

### Error Handling
- Failed emails are logged with error details
- System continues sending to other participants if one fails
- Success/failure counts are reported

### Performance
- Emails are sent asynchronously
- Large participant lists are processed efficiently
- Progress is reported to the admin

## Future Enhancements

- **Email Scheduling**: Schedule emails for specific times
- **A/B Testing**: Test different email templates
- **Analytics**: Track email open rates and engagement
- **Advanced Targeting**: More granular participant filtering
- **Template Editor**: Visual template editor for admins
