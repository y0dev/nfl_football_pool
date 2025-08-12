# NFL Confidence Pool Scripts

This directory contains scripts for setting up and managing the NFL Confidence Pool application.

## 📋 Available Scripts

### 1. `setup-database.ts` - Database Setup
**Purpose**: Creates all necessary database tables and applies Row Level Security policies.

**How to run**:
```bash
npm run setup-db
```

**Prerequisites**:
- `.env.local` file with Supabase credentials
- Supabase project created

**What it does**:
- Creates all database tables (admins, pools, participants, teams, games, picks, scores, etc.)
- Applies Row Level Security policies
- Provides SQL commands for manual execution if needed

---

### 2. `seed.ts` - Database Seeding
**Purpose**: Populates the database with initial data (admins, pools, participants).

**How to run**:
```bash
npm run seed
```

**Prerequisites**:
- Database tables created (run `setup-db` first)
- `.env.local` file with Supabase credentials

**What it does**:
- Creates default admin user
- Creates sample pools
- Adds sample participants

---

### 3. `fetch-teams.ts` - NFL Teams Data
**Purpose**: Fetches NFL teams from API and adds them to the teams table.

**How to run**:
```bash
npm run fetch-teams
```

**Prerequisites**:
- Database tables created (run `setup-db` first)
- `.env.local` file with Supabase credentials
- Optional: `API_SPORTS_KEY` for live data (falls back to mock data if not provided)

**What it does**:
- Fetches all NFL teams for the current season
- Includes team metadata (conference, division, city, abbreviation)
- Clears existing teams for the season before inserting new ones
- Provides detailed summary of teams by conference and division

---

### 4. `fetch-games.ts` - NFL Games Data
**Purpose**: Fetches NFL games from ESPN API and adds them to the games table.

**How to run**:
```bash
# Basic usage
npm run fetch-games

# With command line options
npm run fetch-games -- --start-week 5
npm run fetch-games -- --start-week 10 --end-week 15
npm run fetch-games -- --no-playoffs

# Convenience scripts
npm run fetch-games-help      # Show help and examples
npm run fetch-games-preseason # Fetch preseason games only (weeks 1-4)
npm run fetch-games-regular-only # Fetch regular season only (weeks 5-18)
npm run fetch-games-postseason   # Fetch postseason games only (weeks 19-22)
npm run fetch-games-all       # Fetch all games (preseason + regular + postseason)
```

**Command Line Options**:
- `--start-week, -s <week>`: Start fetching from specific week (1-22, default: 1)
- `--end-week, -e <week>`: End fetching at specific week (1-22, default: 18)
- `--no-playoffs`: Exclude playoff games (weeks 19-22)
- `--preseason`: Fetch preseason games only (weeks 1-4)
- `--regular`: Fetch regular season games only (weeks 5-18)
- `--postseason`: Fetch postseason games only (weeks 19-22)
- `--help, -h`: Show help message with examples

**Features**:
- **ESPN API Integration**: Uses ESPN's official API for real-time NFL data
- **No API Key Required**: ESPN API is free and doesn't require authentication
- **Real-Time Data**: Access to live scores, game status, and team information
- **Season Type Support**: Automatically handles preseason (1-4), regular season (5-18), and postseason (19-22)
- **Season Type Column**: Database includes `season_type` column (1=preseason, 2=regular, 3=postseason)
- **Flexible Week Ranges**: Fetch specific weeks or ranges
- **Batch Processing**: Efficient database insertion with progress tracking
- **Error Handling**: Graceful fallback to mock data if API is unavailable

**Examples**:
```bash
# Fetch all regular season games
npm run fetch-games-regular-only

# Fetch preseason games only
npm run fetch-games-preseason

# Fetch specific week range
npm run fetch-games -- --start-week 10 --end-week 15

# Fetch all games for the entire season
npm run fetch-games-all
```

**Data Source**: [ESPN NFL Scoreboard API](https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard)

---

### 5. `fetch-nfl-data.ts` - Complete NFL Data Setup
**Purpose**: Runs both teams and games fetch scripts in sequence.

**How to run**:
```bash
npm run fetch-nfl-data
```

**What it does**:
- Runs `fetch-teams` first
- Then runs `fetch-games`
- Ensures proper data dependencies

---

## 🚀 Complete Setup Workflow

1. **Set up environment variables**:
   ```bash
   cp env.template .env.local
   # Edit .env.local with your Supabase credentials
   ```

2. **Create database tables**:
   ```bash
   npm run setup-db
   ```

3. **Seed with initial data**:
   ```bash
   npm run seed
   ```

4. **Fetch NFL data**:
   ```bash
   npm run fetch-nfl-data
   ```

5. **Start the application**:
   ```bash
   npm run dev
   ```

---

## 🔧 Environment Variables

**Required variables**:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

**Optional variables**:
```env
API_SPORTS_KEY=your_api_sports_key  # For live NFL data
```

**How to get these values**:
1. Go to your Supabase project dashboard
2. Navigate to Settings > API
3. Copy the following values:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role secret** → `SUPABASE_SERVICE_ROLE_KEY`

---

## 🛠️ Troubleshooting

### Common Issues

**"Missing required environment variables"**
- Ensure `.env.local` file exists in the project root
- Check that all required variables are set
- Verify variable names match exactly

**"Could not find the function public.exec_sql"**
- This is expected - the script will provide SQL commands to run manually
- Go to your Supabase dashboard > SQL Editor
- Copy and paste the provided SQL commands

**"API_SPORTS_KEY not set"**
- This is not an error - the script will use mock data
- For live data, get an API key from [API-Sports](https://www.api-sports.io/)

**"Error inserting data"**
- Check your Supabase service role key has admin permissions
- Verify database tables exist
- Check for duplicate data constraints

---

## 📊 Script Dependencies

```
setup-db → seed → fetch-teams → fetch-games
```

- `setup-db` must run first to create tables
- `seed` can run anytime after `setup-db`
- `fetch-teams` should run before `fetch-games` (for data consistency)
- `fetch-nfl-data` runs both fetch scripts in the correct order

---

## 📈 What Each Script Creates

| Script | Tables/Data | Purpose |
|--------|-------------|---------|
| `setup-db` | All database tables + RLS policies | Database structure |
| `seed` | Admins, pools, participants | Initial application data |
| `fetch-teams` | Teams table | NFL team information |
| `fetch-games` | Games table | NFL game schedule and results |

---

## ⚡ Quick Start Commands

```bash
# Complete setup (run in order)
npm run setup-db
npm run seed
npm run fetch-nfl-data

# Or use the convenience command
npm run fetch-nfl-data  # After setup-db and seed
```

---

## 🔄 Data Refresh

To refresh NFL data during the season:

```bash
# Refresh teams (rarely needed)
npm run fetch-teams

# Refresh games (weekly recommended)
npm run fetch-games

# Refresh both
npm run fetch-nfl-data
```

**Note**: These scripts clear existing data before inserting new data to ensure consistency.
