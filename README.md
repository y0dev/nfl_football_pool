# NFL Confidence Pool

A modern web application for managing NFL confidence pools with real-time scoring, participant management, and automated game updates.

## Features

### Core Functionality
- **Pool Management**: Create and manage multiple confidence pools
- **Pick Management**: Drag-and-drop interface for assigning confidence points (1-16)
- **Real-time Scoring**: Automatic score calculation after games
- **Leaderboards**: Weekly and quarterly standings with rankings

### Admin Dashboard
- **User Management**: Add/remove participants with name and email
- **Screenshot Generation**: Create shareable images of weekly submissions
- **Text Export**: Copy all submissions to clipboard for group chat sharing
- **Color-coded Results**: Visual indicators for wins (✅), losses (❌), and pending games (⏳)
- **Mobile-First Design**: Responsive interface optimized for all devices

### Automated Systems
- **Supabase Cron Jobs**: Scheduled updates every 4 hours during game days
- **Game Result Updates**: Automatic NFL game status and score updates
- **Score Recalculation**: Real-time standings updates after game completion
- **Quarterly Winners**: Automatic detection and logging of Q1 champions

## Technical Stack

- **Frontend**: Next.js 14 with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui components
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Edge Functions**: Supabase Edge Functions for automated tasks
- **Screenshots**: html2canvas for image generation

## Setup

### Prerequisites
- Node.js 18+
- Supabase CLI
- Supabase project

### Installation
```bash
npm install
cp env.example .env.local
# Fill in your Supabase credentials
npm run dev
```

### Database Setup
```bash
npm run setup-database
```

### Deploy Edge Functions
```bash
chmod +x scripts/deploy-edge-function.sh
./scripts/deploy-edge-function.sh
```

## Environment Variables

```bash
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_PROJECT_ID=your_project_id
```

## Admin Features

### Adding Users
1. Navigate to Admin Dashboard > Participants tab
2. Click "Add User" button
3. Enter name and optional email
4. User is immediately added to the pool

### Generating Screenshots
1. Go to Admin Dashboard > Submissions tab
2. Select pool and week
3. Click "Screenshot" to download PNG
4. Click "Copy for Text" to copy to clipboard

### Automated Updates
The system automatically:
- Updates game results every 4 hours
- Recalculates pool scores
- Updates leaderboards
- Logs quarterly winners

## Mobile Optimization

- Responsive grid layouts
- Collapsible table columns on small screens
- Touch-friendly buttons and controls
- Optimized text sizes for mobile devices
- Horizontal scrolling for wide tables

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details
