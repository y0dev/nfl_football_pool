-- Update existing scores table to include winner tracking
ALTER TABLE scores 
ADD COLUMN IF NOT EXISTS rank INTEGER,
ADD COLUMN IF NOT EXISTS is_winner BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS tie_breaker_used BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS tie_breaker_rank INTEGER,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing tie_breakers table to include winner tracking
ALTER TABLE tie_breakers 
ADD COLUMN IF NOT EXISTS rank INTEGER,
ADD COLUMN IF NOT EXISTS is_winner BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS tie_breaker_used BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS tie_breaker_rank INTEGER,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create weekly_winners table
CREATE TABLE IF NOT EXISTS weekly_winners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
    week INTEGER NOT NULL,
    season INTEGER NOT NULL,
    winner_participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    winner_name VARCHAR(255) NOT NULL,
    winner_points INTEGER NOT NULL,
    winner_correct_picks INTEGER NOT NULL,
    tie_breaker_used BOOLEAN DEFAULT false,
    tie_breaker_question TEXT,
    tie_breaker_answer NUMERIC(10,2),
    winner_tie_breaker_answer NUMERIC(10,2),
    tie_breaker_difference NUMERIC(10,2),
    total_participants INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(pool_id, week, season)
);

-- Create season_winners table
CREATE TABLE IF NOT EXISTS season_winners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
    season INTEGER NOT NULL,
    winner_participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    winner_name VARCHAR(255) NOT NULL,
    total_points INTEGER NOT NULL,
    total_correct_picks INTEGER NOT NULL,
    weeks_won INTEGER NOT NULL DEFAULT 0,
    tie_breaker_used BOOLEAN DEFAULT false,
    tie_breaker_question TEXT,
    tie_breaker_answer NUMERIC(10,2),
    winner_tie_breaker_answer NUMERIC(10,2),
    tie_breaker_difference NUMERIC(10,2),
    total_participants INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(pool_id, season)
);

-- Create period_winners table (for quarters, playoffs, etc.)
CREATE TABLE IF NOT EXISTS period_winners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
    season INTEGER NOT NULL,
    period_name VARCHAR(50) NOT NULL, -- 'Q1', 'Q2', 'Q3', 'Q4', 'Playoffs'
    start_week INTEGER NOT NULL,
    end_week INTEGER NOT NULL,
    winner_participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    winner_name VARCHAR(255) NOT NULL,
    period_points INTEGER NOT NULL,
    period_correct_picks INTEGER NOT NULL,
    weeks_won INTEGER NOT NULL DEFAULT 0,
    tie_breaker_used BOOLEAN DEFAULT false,
    tie_breaker_question TEXT,
    tie_breaker_answer NUMERIC(10,2),
    winner_tie_breaker_answer NUMERIC(10,2),
    tie_breaker_difference NUMERIC(10,2),
    total_participants INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(pool_id, season, period_name)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_weekly_winners_pool_week_season ON weekly_winners(pool_id, week, season);
CREATE INDEX IF NOT EXISTS idx_season_winners_pool_season ON season_winners(pool_id, season);
CREATE INDEX IF NOT EXISTS idx_period_winners_pool_season_period ON period_winners(pool_id, season, period_name);
CREATE INDEX IF NOT EXISTS idx_scores_pool_week_season_rank ON scores(pool_id, week, season, rank);
CREATE INDEX IF NOT EXISTS idx_tie_breakers_pool_week_season_rank ON tie_breakers(pool_id, week, season, rank);

-- Add RLS policies for the new tables
ALTER TABLE weekly_winners ENABLE ROW LEVEL SECURITY;
ALTER TABLE season_winners ENABLE ROW LEVEL SECURITY;
ALTER TABLE period_winners ENABLE ROW LEVEL SECURITY;

-- RLS policy for weekly_winners - allow public read access since participants won't be logged in
CREATE POLICY "Weekly winners are publicly viewable" ON weekly_winners
    FOR SELECT USING (true);

-- RLS policy for season_winners - allow public read access
CREATE POLICY "Season winners are publicly viewable" ON season_winners
    FOR SELECT USING (true);

-- RLS policy for period_winners - allow public read access
CREATE POLICY "Period winners are publicly viewable" ON period_winners
    FOR SELECT USING (true);

-- Add tie_breaker_question and tie_breaker_answer columns to pools table if they don't exist
ALTER TABLE pools 
ADD COLUMN IF NOT EXISTS tie_breaker_question TEXT,
ADD COLUMN IF NOT EXISTS tie_breaker_answer NUMERIC(10,2);

-- Add status column to games table if it doesn't exist
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'scheduled';

-- Add comments for documentation
COMMENT ON TABLE weekly_winners IS 'Stores weekly winners for each pool, week, and season';
COMMENT ON TABLE season_winners IS 'Stores overall season winners for each pool and season';
COMMENT ON TABLE period_winners IS 'Stores period winners (quarters, playoffs) for each pool and season';
COMMENT ON COLUMN weekly_winners.tie_breaker_used IS 'Indicates if a tie-breaker was used to determine the winner';
COMMENT ON COLUMN weekly_winners.tie_breaker_difference IS 'The difference between the correct tie-breaker answer and the winner''s answer';
COMMENT ON COLUMN season_winners.weeks_won IS 'Number of individual weeks this participant won during the season';
COMMENT ON COLUMN period_winners.period_name IS 'Name of the period (Q1, Q2, Q3, Q4, Playoffs)';
COMMENT ON COLUMN period_winners.start_week IS 'Starting week number for this period';
COMMENT ON COLUMN period_winners.end_week IS 'Ending week number for this period';
