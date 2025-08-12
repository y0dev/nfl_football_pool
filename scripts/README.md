# NFL Confidence Pool - Scripts Guide

This guide explains how to set up and run all the scripts in the `scripts/` directory for the NFL Confidence Pool application.

## 🚀 Quick Start

1. **Copy environment template**:
   ```bash
   cp env.example .env.local
   ```

2. **Set up Supabase credentials** (see Environment Setup below)

3. **Run database setup**:
   ```bash
   npm run setup-db
   ```

4. **Fetch NFL data**:
   ```bash
   npm run fetch-nfl-data
   ```

## 🔧 Environment Setup

### Required Environment Variables

Create a `.env.local` file in the project root with the following variables:

```bash
# Supabase Configuration (REQUIRED)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# NFL API Configuration (OPTIONAL - ESPN API used by default)
API_SPORTS_KEY=your_api_sports_key_here
```

### How to Get Supabase Credentials

1. **Go to your Supabase project dashboard**
2. **Navigate to Settings > API**
3. **Copy the following values**:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role secret** → `SUPABASE_SERVICE_ROLE_KEY`

### Environment Variable Details

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Yes | Public anon key for client-side operations |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Yes | Service role key for admin operations (scripts) |
| `API_SPORTS_KEY` | ❌ No | Only needed if you want to use API-Sports instead of ESPN |

### Important Notes

- **ESPN API is used by default** - No API key required
- **API_SPORTS_KEY is optional** - Only needed for fallback to API-Sports
- **All Supabase keys are required** - For database operations and scripts
- **Never commit `.env.local`** - It's already in `.gitignore`

---

## 📋 Available Scripts

### 1. `setup-database.ts` - Database Setup
**Purpose**: Creates all necessary database tables and applies Row Level Security policies.

**How to run**:
```bash
npm run setup-db
```

**What it does**:
- Creates all database tables (admins, pools, participants, games, picks, scores, etc.)
- Applies Row Level Security (RLS) policies
- Provides SQL commands for manual execution if needed

**Prerequisites**:
- `.env.local` file with Supabase credentials
- Supabase project created

---

### 2. `seed.ts` - Initial Data Seeding
**Purpose**: Seeds the database with initial admin users, pools, and participants.

**How to run**:
```bash
npm run seed
```

**What it does**:
- Creates default admin users
- Creates sample pools
- Adds sample participants
- Sets up admin-pool relationships

**Prerequisites**:
- Database tables created (run `setup-db` first)
- `.env.local` file with Supabase credentials

---

### 3. `create-test-data.ts` - Test Data Generator
**Purpose**: Creates comprehensive test data for development and testing.

**How to run**:
```bash
npm run create-test-data
```

**What it creates**:
- **3 Admin Users**:
  - `admin@test.com` (Super Admin)
  - `superadmin@test.com` (Super Admin)
  - `pooladmin@test.com` (Regular Admin)
- **3 Pools**:
  - Test Pool 2025
  - Family Pool
  - Work Pool
- **15 Participants** across the pools
- **Admin-pool relationships**

**Features**:
- **Avatar Generation**: Uses DiceBear API for profile pictures
- **Realistic Data**: Family and work-themed participant names
- **Conflict Handling**: Uses upsert to avoid duplicates
- **Comprehensive Logging**: Detailed progress and summary

**Use Cases**:
- Development testing
- Feature testing
- Demo purposes
- UI/UX testing

**Prerequisites**:
- Database tables created (run `setup-db` first)
- `.env.local` file with Supabase credentials

---

### 4. `fetch-teams.ts` - NFL Teams Data
**Purpose**: Fetches NFL teams from API and adds them to the teams table.

**How to run**:
```bash
npm run fetch-teams
```

**What it does**:
- Fetches all NFL teams (32 teams)
- Includes team information (name, city, conference, division)
- Generates UUIDs for team IDs
- Falls back to mock data if API is unavailable

**Prerequisites**:
- Database tables created (run `setup-db` first)
- `.env.local` file with Supabase credentials
- Optional: `API_SPORTS_KEY` for live data (falls back to mock data if not provided)

---

### 5. `fetch-games.ts` - NFL Games Data
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

### 6. `fetch-nfl-data.ts` - Complete NFL Data Setup
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

## 📊 Script Dependencies

```
```