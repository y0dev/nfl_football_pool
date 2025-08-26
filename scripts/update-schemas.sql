-- Update schemas for weekly winners and tie breaker tracking
-- This script updates the existing scores and tie_breakers tables

-- Drop existing tables if they exist (be careful in production!)
-- DROP TABLE IF EXISTS tie_breakers CASCADE;
-- DROP TABLE IF EXISTS scores CASCADE;

-- Update scores table to include winner tracking and tie breaker usage
CREATE TABLE IF NOT EXISTS scores (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  participant_id UUID NULL,
  pool_id UUID NULL,
  week INTEGER NOT NULL,
  season INTEGER NOT NULL,
  points INTEGER NULL DEFAULT 0,
  correct_picks INTEGER NULL DEFAULT 0,
  total_picks INTEGER NULL DEFAULT 0,
  rank INTEGER NULL, -- Position in weekly standings
  is_winner BOOLEAN DEFAULT false, -- Whether this participant won the week
  tie_breaker_used BOOLEAN DEFAULT false, -- Whether tie breaker was used to determine winner
  tie_breaker_rank INTEGER NULL, -- Position after tie breaker resolution
  created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NULL DEFAULT now(),
  CONSTRAINT scores_pkey PRIMARY KEY (id),
  CONSTRAINT scores_participant_id_pool_id_week_season_key UNIQUE (participant_id, pool_id, week, season),
  CONSTRAINT scores_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES participants (id) ON DELETE CASCADE,
  CONSTRAINT scores_pool_id_fkey FOREIGN KEY (pool_id) REFERENCES pools (id) ON DELETE CASCADE
);

-- Update tie_breakers table to include winner tracking
CREATE TABLE IF NOT EXISTS tie_breakers (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  participant_id UUID NULL,
  pool_id UUID NULL,
  week INTEGER NOT NULL,
  season INTEGER NOT NULL,
  answer NUMERIC(10, 2) NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE NULL DEFAULT now(),
  is_winner BOOLEAN DEFAULT false, -- Whether this tie breaker won
  tie_breaker_rank INTEGER NULL, -- Position in tie breaker standings
  created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NULL DEFAULT now(),
  CONSTRAINT tie_breakers_pkey PRIMARY KEY (id),
  CONSTRAINT tie_breakers_participant_id_pool_id_week_season_key UNIQUE (participant_id, pool_id, week, season),
  CONSTRAINT tie_breakers_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES participants (id) ON DELETE CASCADE,
  CONSTRAINT tie_breakers_pool_id_fkey FOREIGN KEY (pool_id) REFERENCES pools (id) ON DELETE CASCADE
);

-- Create new table for weekly winners
CREATE TABLE IF NOT EXISTS weekly_winners (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL,
  week INTEGER NOT NULL,
  season INTEGER NOT NULL,
  winner_participant_id UUID NULL,
  winner_name VARCHAR(255) NOT NULL,
  winner_points INTEGER NOT NULL,
  winner_correct_picks INTEGER NOT NULL,
  tie_breaker_used BOOLEAN DEFAULT false,
  tie_breaker_question VARCHAR(255) NULL,
  tie_breaker_answer NUMERIC(10, 2) NULL,
  winner_tie_breaker_answer NUMERIC(10, 2) NULL,
  tie_breaker_difference NUMERIC(10, 2) NULL, -- How close the winner's answer was
  total_participants INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NULL DEFAULT now(),
  CONSTRAINT weekly_winners_pkey PRIMARY KEY (id),
  CONSTRAINT weekly_winners_pool_id_week_season_key UNIQUE (pool_id, week, season),
  CONSTRAINT weekly_winners_pool_id_fkey FOREIGN KEY (pool_id) REFERENCES pools (id) ON DELETE CASCADE,
  CONSTRAINT weekly_winners_winner_participant_id_fkey FOREIGN KEY (winner_participant_id) REFERENCES participants (id) ON DELETE SET NULL
);

-- Create new table for season winners
CREATE TABLE IF NOT EXISTS season_winners (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL,
  season INTEGER NOT NULL,
  winner_participant_id UUID NULL,
  winner_name VARCHAR(255) NOT NULL,
  total_points INTEGER NOT NULL,
  total_correct_picks INTEGER NOT NULL,
  weeks_won INTEGER NOT NULL DEFAULT 0,
  tie_breaker_used BOOLEAN DEFAULT false,
  tie_breaker_question VARCHAR(255) NULL,
  tie_breaker_answer NUMERIC(10, 2) NULL,
  winner_tie_breaker_answer NUMERIC(10, 2) NULL,
  tie_breaker_difference NUMERIC(10, 2) NULL,
  total_participants INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NULL DEFAULT now(),
  CONSTRAINT season_winners_pkey PRIMARY KEY (id),
  CONSTRAINT season_winners_pool_id_season_key UNIQUE (pool_id, season),
  CONSTRAINT season_winners_pool_id_fkey FOREIGN KEY (pool_id) REFERENCES pools (id) ON DELETE CASCADE,
  CONSTRAINT season_winners_winner_participant_id_fkey FOREIGN KEY (winner_participant_id) REFERENCES participants (id) ON DELETE SET NULL
);

-- Create new table for quarter/period winners (e.g., first quarter of season)
CREATE TABLE IF NOT EXISTS period_winners (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL,
  season INTEGER NOT NULL,
  period_name VARCHAR(50) NOT NULL, -- e.g., 'Q1', 'Q2', 'Q3', 'Q4', 'Playoffs'
  start_week INTEGER NOT NULL,
  end_week INTEGER NOT NULL,
  winner_participant_id UUID NULL,
  winner_name VARCHAR(255) NOT NULL,
  period_points INTEGER NOT NULL,
  period_correct_picks INTEGER NOT NULL,
  weeks_won INTEGER NOT NULL DEFAULT 0,
  tie_breaker_used BOOLEAN DEFAULT false,
  tie_breaker_question VARCHAR(255) NULL,
  tie_breaker_answer NUMERIC(10, 2) NULL,
  winner_tie_breaker_answer NUMERIC(10, 2) NULL,
  tie_breaker_difference NUMERIC(10, 2) NULL,
  total_participants INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NULL DEFAULT now(),
  CONSTRAINT period_winners_pkey PRIMARY KEY (id),
  CONSTRAINT period_winners_pool_id_season_period_key UNIQUE (pool_id, season, period_name),
  CONSTRAINT period_winners_pool_id_fkey FOREIGN KEY (pool_id) REFERENCES pools (id) ON DELETE CASCADE,
  CONSTRAINT period_winners_winner_participant_id_fkey FOREIGN KEY (winner_participant_id) REFERENCES participants (id) ON DELETE SET NULL
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_scores_pool_week_season ON scores (pool_id, week, season);
CREATE INDEX IF NOT EXISTS idx_scores_participant_season ON scores (participant_id, season);
CREATE INDEX IF NOT EXISTS idx_tie_breakers_pool_week_season ON tie_breakers (pool_id, week, season);
CREATE INDEX IF NOT EXISTS idx_weekly_winners_pool_season ON weekly_winners (pool_id, season);
CREATE INDEX IF NOT EXISTS idx_season_winners_pool_season ON season_winners (pool_id, season);
CREATE INDEX IF NOT EXISTS idx_period_winners_pool_season ON period_winners (pool_id, season);

-- Add comments for documentation
COMMENT ON TABLE scores IS 'Participant scores for each week, including winner tracking and tie breaker usage';
COMMENT ON TABLE tie_breakers IS 'Tie breaker answers with winner tracking and ranking';
COMMENT ON TABLE weekly_winners IS 'Weekly winners for each pool with tie breaker details';
COMMENT ON TABLE season_winners IS 'Season winners for each pool with tie breaker details';
COMMENT ON TABLE period_winners IS 'Period winners (quarters, playoffs) for each pool with tie breaker details';

-- Update existing tables if they exist (migration approach)
DO $$
BEGIN
    -- Add new columns to scores table if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scores' AND column_name = 'rank') THEN
        ALTER TABLE scores ADD COLUMN rank INTEGER NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scores' AND column_name = 'is_winner') THEN
        ALTER TABLE scores ADD COLUMN is_winner BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scores' AND column_name = 'tie_breaker_used') THEN
        ALTER TABLE scores ADD COLUMN tie_breaker_used BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scores' AND column_name = 'tie_breaker_rank') THEN
        ALTER TABLE scores ADD COLUMN tie_breaker_rank INTEGER NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scores' AND column_name = 'updated_at') THEN
        ALTER TABLE scores ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE NULL DEFAULT now();
    END IF;
    
    -- Add new columns to tie_breakers table if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tie_breakers' AND column_name = 'is_winner') THEN
        ALTER TABLE tie_breakers ADD COLUMN is_winner BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tie_breakers' AND column_name = 'tie_breaker_rank') THEN
        ALTER TABLE tie_breakers ADD COLUMN tie_breaker_rank INTEGER NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tie_breakers' AND column_name = 'created_at') THEN
        ALTER TABLE tie_breakers ADD COLUMN created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT now();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tie_breakers' AND column_name = 'updated_at') THEN
        ALTER TABLE tie_breakers ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE NULL DEFAULT now();
    END IF;
END $$;
