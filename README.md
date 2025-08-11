# NFL Confidence Pool

A full-stack web application for managing NFL confidence pools with real-time updates, drag-and-drop pick management, and comprehensive standings tracking.

## Features

### Admin Features
- **Authentication**: Email/password + OAuth (Google, GitHub) for admin access only
- **Pool Management**: Create and manage multiple confidence pools
- **Participant Management**: Add, edit, and manage participants by name and email
- **NFL Data Sync**: Import teams, regular season, and playoff games from API-Sports.io
- **Schedule Management**: Sync current week games and playoff data
- **Submission Tracking**: Monitor who has submitted picks for each week
- **Excel Export**: Export participant picks and confidence points to CSV format
- **Score Calculation**: Automatic and manual score calculation with rankings
- **Quarterly Standings**: Track first 4 weeks and determine quarterly winners
- **Pick Management**: Drag-and-drop interface for assigning confidence points (1-16)
- **Real-time Updates**: Automatic game score updates and standings calculations
- **Lock System**: Picks automatically lock at game kickoff
- **Standings**: Weekly and overall leaderboards with detailed statistics
- **Game Override**: Manually adjust game results and scores
- **Force Lock**: Lock picks for all participants at any time
- **Audit Log**: Track all administrative changes
- **Branding**: Upload custom logos and pool branding
- **Mobile Responsive**: Optimized for mobile and desktop use

### Participant Features
- **Anonymous Pick Submission**: Participants select their name and submit picks without logging in
- **Direct Links**: Admins can share direct links for participants to submit picks
- **Email Integration**: Optional email addresses for participant communication
- **Pick Validation**: Ensures all games have picks and confidence points are unique

## Tech Stack

- **Frontend**: Next.js 15, TypeScript, TailwindCSS, shadcn/ui
- **Backend**: Supabase (Auth + PostgreSQL)
- **State Management**: React Query for data fetching
- **Drag & Drop**: @dnd-kit for confidence point assignment
- **Styling**: TailwindCSS with custom NFL-themed design system

## Pages and Routes

- **`/`** - Landing page with admin login
- **`/login`** - Dedicated login page (no navigation link)
- **`/admin/nfl-sync`** - NFL data synchronization management (admin only)
- **`/admin/dashboard`** - Admin dashboard for submission tracking and score management (admin only)

## Database Schema

```sql
-- Admins (handled by Supabase Auth)
admins (
  id, email, full_name, avatar_url, created_at, is_super_admin
)

-- Pools
pools (
  id, name, logo_url, created_by, created_at, is_active, season
)

-- Admin Pool Memberships
admin_pools (
  admin_id, pool_id, joined_at, is_owner
)

-- Participants (managed by admins)
participants (
  id, pool_id, name, email, created_at, is_active
)

-- Games
games (
  id, week, season, home_team, away_team, kickoff_time, 
  winner, home_score, away_score, game_status, created_at
)

-- Participant Picks
picks (
  id, participant_id, pool_id, game_id, predicted_winner, 
  confidence_points, locked, submitted_by, created_at
)

-- Weekly Scores
scores (
  id, participant_id, pool_id, week, season, points, 
  correct_picks, total_picks, created_at
)

-- Audit Log
audit_logs (
  id, action, admin_id, entity, entity_id, details, created_at
)
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/nfl-confidence-pool.git
cd nfl-confidence-pool
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Variables

Copy the example environment file and configure your variables:

```bash
cp env.example .env.local
```

Required environment variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
- `NEXT_PUBLIC_API_SPORTS_KEY` - Your API-Sports.io key for NFL data

### 4. Set Up Database

Run the database setup script to create all necessary tables:

```bash
npm run setup-db
```

### 5. Set Up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to Settings > API to get your project URL and anon key
3. Copy `env.example` to `.env.local` and fill in your Supabase credentials:

```bash
cp env.example .env.local
```

### 4. Database Setup

Run the following SQL in your Supabase SQL editor:

```sql
-- Enable RLS
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- Create tables
CREATE TABLE pools (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  season INTEGER DEFAULT 2024
);

CREATE TABLE admin_pools (
  admin_id UUID REFERENCES auth.users(id) NOT NULL,
  pool_id UUID REFERENCES pools(id) NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_owner BOOLEAN DEFAULT false,
  PRIMARY KEY (admin_id, pool_id)
);

CREATE TABLE participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pool_id UUID REFERENCES pools(id) NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE games (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  week INTEGER NOT NULL,
  season INTEGER NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  kickoff_time TIMESTAMP WITH TIME ZONE NOT NULL,
  winner TEXT,
  home_score INTEGER,
  away_score INTEGER,
  game_status TEXT DEFAULT 'scheduled',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE picks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_id UUID REFERENCES participants(id) NOT NULL,
  pool_id UUID REFERENCES pools(id) NOT NULL,
  game_id UUID REFERENCES games(id) NOT NULL,
  predicted_winner TEXT NOT NULL,
  confidence_points INTEGER NOT NULL,
  locked BOOLEAN DEFAULT false,
  submitted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(participant_id, pool_id, game_id)
);

CREATE TABLE scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_id UUID REFERENCES participants(id) NOT NULL,
  pool_id UUID REFERENCES pools(id) NOT NULL,
  week INTEGER NOT NULL,
  season INTEGER NOT NULL,
  points INTEGER NOT NULL,
  correct_picks INTEGER NOT NULL,
  total_picks INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(participant_id, pool_id, week, season)
);

CREATE TABLE audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  admin_id UUID REFERENCES auth.users(id) NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_games_week_season ON games(week, season);
CREATE INDEX idx_picks_participant_pool ON picks(participant_id, pool_id);
CREATE INDEX idx_scores_participant_pool_week ON scores(participant_id, pool_id, week, season);
CREATE INDEX idx_participants_pool ON participants(pool_id);

-- Create function for overall standings
CREATE OR REPLACE FUNCTION get_overall_standings(pool_id_param UUID, season_param INTEGER)
RETURNS TABLE (
  participant_id UUID,
  participant_name TEXT,
  total_points BIGINT,
  total_correct_picks BIGINT,
  total_picks BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.participant_id,
    p.name as participant_name,
    SUM(s.points) as total_points,
    SUM(s.correct_picks) as total_correct_picks,
    SUM(s.total_picks) as total_picks
  FROM scores s
  JOIN participants p ON s.participant_id = p.id
  WHERE s.pool_id = pool_id_param AND s.season = season_param
  GROUP BY s.participant_id, p.name
  ORDER BY total_points DESC;
END;
$$ LANGUAGE plpgsql;

-- Set up RLS policies
ALTER TABLE pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Pool policies
CREATE POLICY "Admins can view pools they manage" ON pools
  FOR SELECT USING (
    id IN (SELECT pool_id FROM admin_pools WHERE admin_id = auth.uid())
  );

CREATE POLICY "Admins can create pools" ON pools
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Admin pool policies
CREATE POLICY "Admins can view their pool memberships" ON admin_pools
  FOR SELECT USING (admin_id = auth.uid());

CREATE POLICY "Admins can join pools" ON admin_pools
  FOR INSERT WITH CHECK (admin_id = auth.uid());

-- Participant policies
CREATE POLICY "Admins can manage participants in their pools" ON participants
  FOR ALL USING (
    pool_id IN (SELECT pool_id FROM admin_pools WHERE admin_id = auth.uid())
  );

-- Game policies
CREATE POLICY "Anyone can view games" ON games
  FOR SELECT USING (true);

-- Pick policies
CREATE POLICY "Admins can view picks in their pools" ON picks
  FOR SELECT USING (
    pool_id IN (SELECT pool_id FROM admin_pools WHERE admin_id = auth.uid())
  );

CREATE POLICY "Anyone can create picks" ON picks
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can update picks in their pools" ON picks
  FOR UPDATE USING (
    pool_id IN (SELECT pool_id FROM admin_pools WHERE admin_id = auth.uid())
  );

-- Score policies
CREATE POLICY "Anyone can view scores" ON scores
  FOR SELECT USING (true);
```

### 5. Configure Authentication

1. In your Supabase dashboard, go to Authentication > Settings
2. Configure your site URL (e.g., `http://localhost:3000`)
3. Add OAuth providers (Google, GitHub) if desired
4. Set up email templates for confirmation emails

### 6. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### 7. Sync NFL Data

1. Get an API key from [API-Sports.io](https://api-sports.io/documentation/nfl/v1)
2. Add the key to your `.env.local` file as `NEXT_PUBLIC_API_SPORTS_KEY`
3. Visit `/admin/nfl-sync` (admin login required)
4. Sync teams and regular season games
5. Set up your confidence pools

### 8. Admin Dashboard Usage

The admin dashboard (`/admin/dashboard`) provides comprehensive pool management:

#### Weekly Management:
- **Track Submissions**: See who has submitted picks for each week
- **Calculate Scores**: Manually trigger score calculation for a specific pool/week
- **Export Data**: Download participant picks as CSV file
- **View Rankings**: See weekly standings with points and accuracy

#### Quarterly Tracking:
- **First 4 Weeks**: Automatic tracking of the first quarter of the season
- **Quarterly Winners**: System automatically determines winners after week 4
- **Standings**: View overall quarterly standings with total points and averages

#### Automatic Features:
- **Score Calculation**: Runs automatically when all games for a week are finished
- **Quarterly Winners**: Automatically determined after week 4 completion
- **Audit Logging**: All score calculations and winners are logged for transparency

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add your environment variables in Vercel dashboard
4. Deploy!

### Other Platforms

The app can be deployed to any platform that supports Next.js:
- Netlify
- Railway
- DigitalOcean App Platform
- AWS Amplify

## NFL Data Integration

The app is integrated with [API-Sports.io NFL API](https://api-sports.io/documentation/nfl/v1) for automatic game data updates. This provides:

- **Real-time game schedules** and kickoff times
- **Live score updates** during games
- **Game status tracking** (scheduled, live, halftime, finished)
- **Team information** and statistics
- **Automatic score calculation** and standings updates

### Setting up API-Sports.io

1. Sign up for a free account at [API-Sports.io](https://api-sports.io)
2. Get your API key from the dashboard
3. Add the API key to your environment variables:
   ```
   API_SPORTS_KEY=your_api_sports_key
   ```

### Automatic Updates

The app includes:

1. **Supabase Edge Function** (`supabase/functions/update-games/`) for fetching game data
2. **API Routes** for client-side game fetching
3. **Live game updates** every 30 seconds
4. **Automatic score calculation** when games finish

### Scheduled Updates

Set up cron jobs to run the Edge Function after game slots:
- Thursday night games (8:30 PM ET)
- Sunday early games (1:00 PM ET)
- Sunday late games (4:25 PM ET)
- Sunday night football (8:20 PM ET)
- Monday night football (8:15 PM ET)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, email support@nflconfidencepool.com or create an issue in this repository.

## Acknowledgments

- NFL team data and schedules
- Supabase for the excellent backend platform
- Next.js team for the amazing framework
- TailwindCSS for the utility-first CSS framework
