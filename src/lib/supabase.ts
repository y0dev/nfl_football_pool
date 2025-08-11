import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      admins: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          created_at: string
          is_super_admin: boolean
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          is_super_admin?: boolean
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          is_super_admin?: boolean
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
          created_at: string
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
          created_at?: string
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
          created_at?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          action: string
          admin_id: string
          entity: string
          entity_id: string
          details: any
          created_at: string
        }
        Insert: {
          id?: string
          action: string
          admin_id: string
          entity: string
          entity_id: string
          details?: any
          created_at?: string
        }
        Update: {
          id?: string
          action?: string
          admin_id?: string
          entity?: string
          entity_id?: string
          details?: any
          created_at?: string
        }
      }
    }
  }
}

// SQL Table Definitions
export const adminsTable = `
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_super_admin BOOLEAN DEFAULT false
);
`;

export const poolsTable = `
CREATE TABLE IF NOT EXISTS pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  logo_url TEXT,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  season INTEGER NOT NULL,
  tie_breaker_method VARCHAR(50),
  tie_breaker_question VARCHAR(255),
  tie_breaker_answer INTEGER
);
`;

export const adminPoolsTable = `
CREATE TABLE IF NOT EXISTS admin_pools (
  admin_id UUID REFERENCES admins(id) ON DELETE CASCADE,
  pool_id UUID REFERENCES pools(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_owner BOOLEAN DEFAULT false,
  PRIMARY KEY (admin_id, pool_id)
);
`;

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

export const gamesTable = `
CREATE TABLE IF NOT EXISTS games (
  id VARCHAR(255) PRIMARY KEY,
  week INTEGER NOT NULL,
  season INTEGER NOT NULL,
  home_team VARCHAR(255) NOT NULL,
  away_team VARCHAR(255) NOT NULL,
  kickoff_time TIMESTAMP WITH TIME ZONE NOT NULL,
  winner VARCHAR(255),
  home_score INTEGER,
  away_score INTEGER,
  game_status VARCHAR(50) DEFAULT 'scheduled',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`;

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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(participant_id, pool_id, week, season)
);
`;

export const tieBreakersTable = `
CREATE TABLE IF NOT EXISTS tie_breakers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
  pool_id UUID REFERENCES pools(id) ON DELETE CASCADE,
  week INTEGER NOT NULL,
  season INTEGER NOT NULL,
  answer DECIMAL(10,2) NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(participant_id, pool_id, week, season)
);
`;

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

// Teams table
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
export const updatedGamesTable = `
CREATE TABLE IF NOT EXISTS games (
  id VARCHAR(255) PRIMARY KEY,
  week INTEGER NOT NULL,
  season INTEGER NOT NULL,
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

export const rlsPolicies = `
-- Enable Row Level Security on all tables
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE tie_breakers ENABLE ROW LEVEL SECURITY;

-- Participants table policies
CREATE POLICY "Participants are viewable by all authenticated users" ON participants
  FOR SELECT USING (true);

CREATE POLICY "Only admins can insert participants" ON participants
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins 
      WHERE admins.id = auth.uid() 
      AND admins.is_active = true
    )
  );

CREATE POLICY "Only admins can update participants" ON participants
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM admins 
      WHERE admins.id = auth.uid() 
      AND admins.is_active = true
    )
  );

-- Picks table policies
CREATE POLICY "Users can only view their own picks" ON picks
  FOR SELECT USING (
    participant_id IN (
      SELECT id FROM participants 
      WHERE email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "Users can only insert picks for themselves" ON picks
  FOR INSERT WITH CHECK (
    participant_id IN (
      SELECT id FROM participants 
      WHERE email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "Users can only update their own picks" ON picks
  FOR UPDATE USING (
    participant_id IN (
      SELECT id FROM participants 
      WHERE email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "Admins can view all picks" ON picks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admins 
      WHERE admins.id = auth.uid() 
      AND admins.is_active = true
    )
  );

-- Scores table policies
CREATE POLICY "Users can only view their own scores" ON scores
  FOR SELECT USING (
    participant_id IN (
      SELECT id FROM participants 
      WHERE email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "Admins can view all scores" ON scores
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admins 
      WHERE admins.id = auth.uid() 
      AND admins.is_active = true
    )
  );

-- Tie-breakers table policies
CREATE POLICY "Users can only view their own tie-breakers" ON tie_breakers
  FOR SELECT USING (
    participant_id IN (
      SELECT id FROM participants 
      WHERE email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "Users can only insert tie-breakers for themselves" ON tie_breakers
  FOR INSERT WITH CHECK (
    participant_id IN (
      SELECT id FROM participants 
      WHERE email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "Admins can view all tie-breakers" ON tie_breakers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admins 
      WHERE admins.id = auth.uid() 
      AND admins.is_active = true
    )
  );
`; 