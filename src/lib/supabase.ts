import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Pin singletons to globalThis so Next.js module re-evaluation (HMR, Strict Mode)
// doesn't create additional GoTrueClient instances in the same browser/process context.
const g = globalThis as typeof globalThis & {
  __supabaseClient?: SupabaseClient;
  __supabaseServiceClient?: SupabaseClient;
};

export function getSupabaseClient() {
  if (g.__supabaseClient) return g.__supabaseClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error('Supabase URL is required. Please set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL in your environment variables.');
  }

  if (!supabaseAnonKey) {
    throw new Error('Supabase anon key is required. Please set NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY in your environment variables.');
  }

  g.__supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { flowType: 'pkce', detectSessionInUrl: false },
  });
  return g.__supabaseClient;
}

export function getSupabaseServiceClient() {
  if (g.__supabaseServiceClient) return g.__supabaseServiceClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('Supabase URL is required. Please set NEXT_PUBLIC_SUPABASE_SERVICE_KEY or SUPABASE_URL in your environment variables.');
  }

  if (!supabaseServiceKey) {
    throw new Error('Supabase service role key is required for server operations. Please set NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY in your environment variables.');
  }

  g.__supabaseServiceClient = createClient(supabaseUrl, supabaseServiceKey);
  return g.__supabaseServiceClient;
}

function getDefaultSupabaseClient() {
  if (typeof window !== 'undefined') return getSupabaseClient();
  return null;
}

type Database = {
  public: {
    Tables: {
      admins: {
        Row: {
          id: string
          email: string
          password_hash: string
          full_name: string | null
          avatar_url: string | null
          created_at: string
          is_super_admin: boolean
          is_active: boolean
        }
        Insert: {
          id?: string
          email: string
          password_hash: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          is_super_admin?: boolean
          is_active?: boolean
        }
        Update: {
          id?: string
          email?: string
          password_hash?: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          is_super_admin?: boolean
          is_active?: boolean
        }
      }
      pools: {
        Row: {
          id: string
          name: string
          logo_url: string | null
          created_by: string
          created_at: string
          is_active: boolean
          season: number
          tie_breaker_method: string
          tie_breaker_question: string | null
          tie_breaker_answer: number | null
          require_access_code: boolean
          season_scope: number[]
        }
        Insert: {
          id?: string
          name: string
          logo_url?: string | null
          created_by: string
          created_at?: string
          is_active?: boolean
          season?: number
          tie_breaker_method?: string
          tie_breaker_question?: string | null
          tie_breaker_answer?: number | null
          require_access_code?: boolean
          season_scope?: number[]
        }
        Update: {
          id?: string
          name?: string
          logo_url?: string | null
          created_by?: string
          created_at?: string
          is_active?: boolean
          season?: number
          tie_breaker_method?: string
          tie_breaker_question?: string | null
          tie_breaker_answer?: number | null
          require_access_code?: boolean
          season_scope?: number[]
        }
      }
      admin_pools: {
        Row: {
          admin_id: string
          pool_id: string
          joined_at: string
          is_owner: boolean
        }
        Insert: {
          admin_id: string
          pool_id: string
          joined_at?: string
          is_owner?: boolean
        }
        Update: {
          admin_id?: string
          pool_id?: string
          joined_at?: string
          is_owner?: boolean
        }
      }
      participants: {
        Row: {
          id: string
          pool_id: string
          name: string
          email: string | null
          created_at: string
          is_active: boolean
        }
        Insert: {
          id?: string
          pool_id: string
          name: string
          email?: string | null
          created_at?: string
          is_active?: boolean
        }
        Update: {
          id?: string
          pool_id?: string
          name?: string
          email?: string | null
          created_at?: string
          is_active?: boolean
        }
      }
      games: {
        Row: {
          id: string
          week: number
          season: number
          season_type: number
          home_team: string
          away_team: string
          kickoff_time: string
          winner: string | null
          home_score: number | null
          away_score: number | null
          game_status: string
          created_at: string
        }
        Insert: {
          id?: string
          week: number
          season: number
          season_type?: number
          home_team: string
          away_team: string
          kickoff_time: string
          winner?: string | null
          home_score?: number | null
          away_score?: number | null
          game_status?: string
          created_at?: string
        }
        Update: {
          id?: string
          week?: number
          season?: number
          season_type?: number
          home_team?: string
          away_team?: string
          kickoff_time?: string
          winner?: string | null
          home_score?: number | null
          away_score?: number | null
          game_status?: string
          created_at?: string
        }
      }
      picks: {
        Row: {
          id: string
          participant_id: string
          pool_id: string
          game_id: string
          predicted_winner: string
          confidence_points: number
          locked: boolean
          submitted_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          participant_id: string
          pool_id: string
          game_id: string
          predicted_winner: string
          confidence_points: number
          locked?: boolean
          submitted_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          participant_id?: string
          pool_id?: string
          game_id?: string
          predicted_winner?: string
          confidence_points?: number
          locked?: boolean
          submitted_by?: string | null
          created_at?: string
        }
      }
      scores: {
        Row: {
          id: string
          participant_id: string
          pool_id: string
          week: number
          season: number
          points: number
          correct_picks: number
          total_picks: number
          rank: number | null
          is_winner: boolean
          tie_breaker_used: boolean
          tie_breaker_rank: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          participant_id: string
          pool_id: string
          week: number
          season: number
          points: number
          correct_picks: number
          total_picks: number
          rank?: number | null
          is_winner?: boolean
          tie_breaker_used?: boolean
          tie_breaker_rank?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          participant_id?: string
          pool_id?: string
          week?: number
          season?: number
          points?: number
          correct_picks?: number
          total_picks?: number
          rank?: number | null
          is_winner?: boolean
          tie_breaker_used?: boolean
          tie_breaker_rank?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      tie_breakers: {
        Row: {
          id: string
          participant_id: string
          pool_id: string
          week: number
          season: number
          answer: number
          submitted_at: string
          is_winner: boolean
          tie_breaker_rank: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          participant_id: string
          pool_id: string
          week: number
          season: number
          answer: number
          submitted_at?: string
          is_winner?: boolean
          tie_breaker_rank?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          participant_id?: string
          pool_id?: string
          week?: number
          season?: number
          answer?: number
          submitted_at?: string
          is_winner?: boolean
          tie_breaker_rank?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      weekly_winners: {
        Row: {
          id: string
          pool_id: string
          week: number
          season: number
          winner_participant_id: string | null
          winner_name: string
          winner_points: number
          winner_correct_picks: number
          tie_breaker_used: boolean
          tie_breaker_question: string | null
          tie_breaker_answer: number | null
          winner_tie_breaker_answer: number | null
          tie_breaker_difference: number | null
          total_participants: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          pool_id: string
          week: number
          season: number
          winner_participant_id?: string | null
          winner_name: string
          winner_points: number
          winner_correct_picks: number
          tie_breaker_used?: boolean
          tie_breaker_question?: string | null
          tie_breaker_answer?: number | null
          winner_tie_breaker_answer?: number | null
          tie_breaker_difference?: number | null
          total_participants: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          pool_id?: string
          week?: number
          season?: number
          winner_participant_id?: string | null
          winner_name?: string
          winner_points?: number
          winner_correct_picks?: number
          tie_breaker_used?: boolean
          tie_breaker_question?: string | null
          tie_breaker_answer?: number | null
          winner_tie_breaker_answer?: number | null
          tie_breaker_difference?: number | null
          total_participants?: number
          created_at?: string
          updated_at?: string
        }
      }
      season_winners: {
        Row: {
          id: string
          pool_id: string
          season: number
          winner_participant_id: string | null
          winner_name: string
          total_points: number
          total_correct_picks: number
          weeks_won: number
          tie_breaker_used: boolean
          tie_breaker_question: string | null
          tie_breaker_answer: number | null
          winner_tie_breaker_answer: number | null
          tie_breaker_difference: number | null
          total_participants: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          pool_id: string
          season: number
          winner_participant_id?: string | null
          winner_name: string
          total_points: number
          total_correct_picks: number
          weeks_won?: number
          tie_breaker_used?: boolean
          tie_breaker_question?: string | null
          tie_breaker_answer?: number | null
          winner_tie_breaker_answer?: number | null
          tie_breaker_difference?: number | null
          total_participants: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          pool_id?: string
          season?: number
          winner_participant_id?: string | null
          winner_name?: string
          total_points?: number
          total_correct_picks?: number
          weeks_won?: number
          tie_breaker_used?: boolean
          tie_breaker_question?: string | null
          tie_breaker_answer?: number | null
          winner_tie_breaker_answer?: number | null
          tie_breaker_difference?: number | null
          total_participants?: number
          created_at?: string
          updated_at?: string
        }
      }
      period_winners: {
        Row: {
          id: string
          pool_id: string
          season: number
          period_name: string
          start_week: number
          end_week: number
          winner_participant_id: string | null
          winner_name: string
          period_points: number
          period_correct_picks: number
          weeks_won: number
          tie_breaker_used: boolean
          tie_breaker_question: string | null
          tie_breaker_answer: number | null
          winner_tie_breaker_answer: number | null
          tie_breaker_difference: number | null
          total_participants: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          pool_id: string
          season: number
          period_name: string
          start_week: number
          end_week: number
          winner_participant_id?: string | null
          winner_name: string
          period_points: number
          period_correct_picks: number
          weeks_won?: number
          tie_breaker_used?: boolean
          tie_breaker_question?: string | null
          tie_breaker_answer?: number | null
          winner_tie_breaker_answer?: number | null
          tie_breaker_difference?: number | null
          total_participants: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          pool_id?: string
          season?: number
          period_name?: string
          start_week?: number
          end_week?: number
          winner_participant_id?: string | null
          winner_name?: string
          period_points?: number
          period_correct_picks?: number
          weeks_won?: number
          tie_breaker_used?: boolean
          tie_breaker_question?: string | null
          tie_breaker_answer?: number | null
          winner_tie_breaker_answer?: number | null
          tie_breaker_difference?: number | null
          total_participants?: number
          created_at?: string
          updated_at?: string
        }
      }
      playoff_teams: {
        Row: {
          id: string
          season: number
          team_name: string
          team_abbreviation: string | null
          conference: string | null
          seed: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          season: number
          team_name: string
          team_abbreviation?: string | null
          conference?: string | null
          seed?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          season?: number
          team_name?: string
          team_abbreviation?: string | null
          conference?: string | null
          seed?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      playoff_confidence_points: {
        Row: {
          id: string
          participant_id: string
          pool_id: string
          season: number
          team_name: string
          confidence_points: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          participant_id: string
          pool_id: string
          season: number
          team_name: string
          confidence_points: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          participant_id?: string
          pool_id?: string
          season?: number
          team_name?: string
          confidence_points?: number
          created_at?: string
          updated_at?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          action: string
          admin_id: string
          entity: string
          entity_id: string
          details: Record<string, unknown>
          created_at: string
        }
        Insert: {
          id?: string
          action: string
          admin_id: string
          entity: string
          entity_id: string
          details?: Record<string, unknown>
          created_at?: string
        }
        Update: {
          id?: string
          action?: string
          admin_id?: string
          entity?: string
          entity_id?: string
          details?: Record<string, unknown>
          created_at?: string
        }
      }
    }
  }
}

// SQL Table Definitions
// fallow-ignore-next-line unused-export
export const adminsTable = `
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  avatar_url VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_super_admin BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true
);
`;

// fallow-ignore-next-line unused-export
export const poolsTable = `
CREATE TABLE IF NOT EXISTS pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  logo_url TEXT,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  season INTEGER NOT NULL,
  pool_type VARCHAR(20) DEFAULT 'normal',
  tie_breaker_method VARCHAR(50),
  tie_breaker_question VARCHAR(255),
  tie_breaker_answer INTEGER,
  require_access_code BOOLEAN DEFAULT true,
  season_scope INTEGER[] DEFAULT '{2}'
);
-- Migration: ALTER TABLE pools ADD COLUMN IF NOT EXISTS season_scope INTEGER[] DEFAULT '{2}';
`;

// fallow-ignore-next-line unused-export
export const adminPoolsTable = `
CREATE TABLE IF NOT EXISTS admin_pools (
  admin_id UUID REFERENCES admins(id) ON DELETE CASCADE,
  pool_id UUID REFERENCES pools(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_owner BOOLEAN DEFAULT false,
  PRIMARY KEY (admin_id, pool_id)
);
`;

// fallow-ignore-next-line unused-export
export const participantsTable = `
CREATE TABLE IF NOT EXISTS participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID REFERENCES pools(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);
`;

// fallow-ignore-next-line unused-export
export const gamesTable = `
CREATE TABLE IF NOT EXISTS games (
  id VARCHAR(255) PRIMARY KEY,
  week INTEGER NOT NULL,
  season INTEGER NOT NULL,
  season_type INTEGER DEFAULT 2,
  home_team VARCHAR(255) NOT NULL,
  away_team VARCHAR(255) NOT NULL,
  kickoff_time TIMESTAMP WITH TIME ZONE NOT NULL,
  winner VARCHAR(255),
  home_score INTEGER,
  away_score INTEGER,
  game_status VARCHAR(50) DEFAULT 'scheduled',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`;

// fallow-ignore-next-line unused-export
export const picksTable = `
CREATE TABLE IF NOT EXISTS picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
  pool_id UUID REFERENCES pools(id) ON DELETE CASCADE,
  game_id VARCHAR(255) REFERENCES games(id) ON DELETE CASCADE,
  predicted_winner VARCHAR(255) NOT NULL,
  confidence_points INTEGER NOT NULL,
  locked BOOLEAN DEFAULT false,
  submitted_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(participant_id, pool_id, game_id)
);
`;

// fallow-ignore-next-line unused-export
export const scoresTable = `
CREATE TABLE IF NOT EXISTS scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
  pool_id UUID REFERENCES pools(id) ON DELETE CASCADE,
  week INTEGER NOT NULL,
  season INTEGER NOT NULL,
  points INTEGER DEFAULT 0,
  correct_picks INTEGER DEFAULT 0,
  total_picks INTEGER DEFAULT 0,
  rank INTEGER NULL,
  is_winner BOOLEAN DEFAULT false,
  tie_breaker_used BOOLEAN DEFAULT false,
  tie_breaker_rank INTEGER NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(participant_id, pool_id, week, season)
);
`;

// fallow-ignore-next-line unused-export
export const tieBreakersTable = `
CREATE TABLE IF NOT EXISTS tie_breakers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
  pool_id UUID REFERENCES pools(id) ON DELETE CASCADE,
  week INTEGER NOT NULL,
  season INTEGER NOT NULL,
  answer DECIMAL(10,2) NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_winner BOOLEAN DEFAULT false,
  tie_breaker_rank INTEGER NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(participant_id, pool_id, week, season)
);
`;

// fallow-ignore-next-line unused-export
export const weeklyWinnersTable = `
CREATE TABLE IF NOT EXISTS weekly_winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID REFERENCES pools(id) ON DELETE CASCADE,
  week INTEGER NOT NULL,
  season INTEGER NOT NULL,
  winner_participant_id UUID REFERENCES participants(id) ON DELETE SET NULL,
  winner_name VARCHAR(255) NOT NULL,
  winner_points INTEGER NOT NULL,
  winner_correct_picks INTEGER NOT NULL,
  tie_breaker_used BOOLEAN DEFAULT false,
  tie_breaker_question VARCHAR(255) NULL,
  tie_breaker_answer DECIMAL(10,2) NULL,
  winner_tie_breaker_answer DECIMAL(10,2) NULL,
  tie_breaker_difference DECIMAL(10,2) NULL,
  total_participants INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(pool_id, week, season)
);
`;

// fallow-ignore-next-line unused-export
export const seasonWinnersTable = `
CREATE TABLE IF NOT EXISTS season_winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID REFERENCES pools(id) ON DELETE CASCADE,
  season INTEGER NOT NULL,
  winner_participant_id UUID REFERENCES participants(id) ON DELETE SET NULL,
  winner_name VARCHAR(255) NOT NULL,
  total_points INTEGER NOT NULL,
  total_correct_picks INTEGER NOT NULL,
  weeks_won INTEGER NOT NULL DEFAULT 0,
  tie_breaker_used BOOLEAN DEFAULT false,
  tie_breaker_question VARCHAR(255) NULL,
  tie_breaker_answer DECIMAL(10,2) NULL,
  winner_tie_breaker_answer DECIMAL(10,2) NULL,
  tie_breaker_difference DECIMAL(10,2) NULL,
  total_participants INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(pool_id, season)
);
`;

// fallow-ignore-next-line unused-export
export const periodWinnersTable = `
CREATE TABLE IF NOT EXISTS period_winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID REFERENCES pools(id) ON DELETE CASCADE,
  season INTEGER NOT NULL,
  period_name VARCHAR(50) NOT NULL,
  start_week INTEGER NOT NULL,
  end_week INTEGER NOT NULL,
  winner_participant_id UUID REFERENCES participants(id) ON DELETE SET NULL,
  winner_name VARCHAR(255) NOT NULL,
  period_points INTEGER NOT NULL,
  period_correct_picks INTEGER NOT NULL,
  weeks_won INTEGER NOT NULL DEFAULT 0,
  tie_breaker_used BOOLEAN DEFAULT false,
  tie_breaker_question VARCHAR(255) NULL,
  tie_breaker_answer DECIMAL(10,2) NULL,
  winner_tie_breaker_answer DECIMAL(10,2) NULL,
  tie_breaker_difference DECIMAL(10,2) NULL,
  total_participants INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(pool_id, season, period_name)
);
`;

const playoffTeamsTable = `
CREATE TABLE IF NOT EXISTS playoff_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season INTEGER NOT NULL,
  team_name VARCHAR(255) NOT NULL,
  team_abbreviation VARCHAR(10),
  conference VARCHAR(50),
  seed INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(season, team_name)
);
`;

const playoffConfidencePointsTable = `
CREATE TABLE IF NOT EXISTS playoff_confidence_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  pool_id UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  season INTEGER NOT NULL,
  team_name VARCHAR(255) NOT NULL,
  confidence_points INTEGER NOT NULL CHECK (confidence_points > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(participant_id, pool_id, season, team_name),
  UNIQUE(participant_id, pool_id, season, confidence_points)
);
`;

// fallow-ignore-next-line unused-export
export const auditLogsTable = `
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR(255) NOT NULL,
  admin_id UUID REFERENCES admins(id) ON DELETE SET NULL,
  entity VARCHAR(255) NOT NULL,
  entity_id VARCHAR(255),
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`;

// fallow-ignore-next-line unused-export
export const reminderLogsTable = `
CREATE TABLE IF NOT EXISTS reminder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
  pool_id UUID REFERENCES pools(id) ON DELETE CASCADE,
  week INTEGER NOT NULL,
  season_type INTEGER NOT NULL,
  sent_by UUID REFERENCES admins(id) ON DELETE SET NULL,
  email_sent BOOLEAN DEFAULT true,
  email_content JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`;

// Teams table
// fallow-ignore-next-line unused-export
export const teamsTable = `
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  city VARCHAR(255) NOT NULL,
  abbreviation VARCHAR(10) NOT NULL,
  conference VARCHAR(50),
  division VARCHAR(50),
  season INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(id, season)
);
`;

// Update games table to include team references and playoff flag
// fallow-ignore-next-line unused-export
export const updatedGamesTable = `
CREATE TABLE IF NOT EXISTS games (
  id VARCHAR(255) PRIMARY KEY,
  week INTEGER NOT NULL,
  season INTEGER NOT NULL,
  season_type INTEGER NOT NULL DEFAULT 2,
  home_team VARCHAR(255) NOT NULL,
  away_team VARCHAR(255) NOT NULL,
  kickoff_time TIMESTAMP WITH TIME ZONE NOT NULL,
  home_score INTEGER,
  away_score INTEGER,
  winner VARCHAR(255),
  status VARCHAR(50) DEFAULT 'scheduled',
  home_team_id VARCHAR(255),
  away_team_id VARCHAR(255),
  is_playoff BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`;

// fallow-ignore-next-line unused-export
export const rlsPolicies = `
-- Enable Row Level Security on all tables
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE tie_breakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_logs ENABLE ROW LEVEL SECURITY;

-- Admins table policies
CREATE POLICY "Admins can view their own profile" ON admins
  FOR SELECT USING (
    id = auth.uid() 
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Service role can manage admins" ON admins
  FOR ALL USING (auth.role() = 'service_role');

-- Participants table policies
CREATE POLICY "Participants are viewable by all authenticated users" ON participants
  FOR SELECT USING (true);

CREATE POLICY "Users can join pools" ON participants
  FOR INSERT WITH CHECK (
    -- Allow users to join pools (for the join pool functionality)
    true
    OR EXISTS (
      SELECT 1 FROM admins 
      WHERE admins.id = auth.uid() 
      AND admins.is_active = true
    )
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Only admins can update participants" ON participants
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM admins 
      WHERE admins.id = auth.uid() 
      AND admins.is_active = true
    )
    OR auth.role() = 'service_role'
  );

-- Picks table policies
CREATE POLICY "Users can only view their own picks" ON picks
  FOR SELECT USING (
    participant_id IN (
      SELECT id FROM participants 
      WHERE email = auth.jwt() ->> 'email'
    )
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Users can only insert picks for themselves" ON picks
  FOR INSERT WITH CHECK (
    participant_id IN (
      SELECT id FROM participants 
      WHERE email = auth.jwt() ->> 'email'
    )
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Users can only update their own picks" ON picks
  FOR UPDATE USING (
    participant_id IN (
      SELECT id FROM participants 
      WHERE email = auth.jwt() ->> 'email'
    )
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Admins can view all picks" ON picks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admins 
      WHERE admins.id = auth.uid() 
      AND admins.is_active = true
    )
    OR auth.role() = 'service_role'
  );

-- Scores table policies
CREATE POLICY "Users can only view their own scores" ON scores
  FOR SELECT USING (
    participant_id IN (
      SELECT id FROM participants 
      WHERE email = auth.jwt() ->> 'email'
    )
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Admins can view all scores" ON scores
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admins 
      WHERE admins.id = auth.uid() 
      AND admins.is_active = true
    )
    OR auth.role() = 'service_role'
  );

-- Tie-breakers table policies
CREATE POLICY "Users can only view their own tie-breakers" ON tie_breakers
  FOR SELECT USING (
    participant_id IN (
      SELECT id FROM participants 
      WHERE email = auth.jwt() ->> 'email'
    )
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Users can only insert tie-breakers for themselves" ON tie_breakers
  FOR INSERT WITH CHECK (
    participant_id IN (
      SELECT id FROM participants 
      WHERE email = auth.jwt() ->> 'email'
    )
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Admins can view all tie-breakers" ON tie_breakers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admins 
      WHERE admins.id = auth.uid() 
      AND admins.is_active = true
    )
    OR auth.role() = 'service_role'
  );

-- Weekly winners table policies
CREATE POLICY "Users can view weekly winners for pools they participate in" ON weekly_winners
  FOR SELECT USING (
    pool_id IN (
      SELECT pool_id FROM participants 
      WHERE email = auth.jwt() ->> 'email'
    )
    OR EXISTS (
      SELECT 1 FROM admins 
      WHERE admins.id = auth.uid() 
      AND admins.is_active = true
    )
    OR auth.role() = 'service_role'
  );

-- Season winners table policies
CREATE POLICY "Users can view season winners for pools they participate in" ON season_winners
  FOR SELECT USING (
    pool_id IN (
      SELECT pool_id FROM participants 
      WHERE email = auth.jwt() ->> 'email'
    )
    OR EXISTS (
      SELECT 1 FROM admins 
      WHERE admins.id = auth.uid() 
      AND admins.is_active = true
    )
    OR auth.role() = 'service_role'
  );

-- Period winners table policies
CREATE POLICY "Users can view period winners for pools they participate in" ON period_winners
  FOR SELECT USING (
    pool_id IN (
      SELECT pool_id FROM participants 
      WHERE email = auth.jwt() ->> 'email'
    )
    OR EXISTS (
      SELECT 1 FROM admins 
      WHERE admins.id = auth.uid() 
      AND admins.is_active = true
    )
    OR auth.role() = 'service_role'
  );
`; 
