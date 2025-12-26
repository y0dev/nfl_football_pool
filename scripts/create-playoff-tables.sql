-- Create playoff_teams table
-- This table stores which teams made it to the playoffs for a given season
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

-- Create playoff_confidence_points table
-- This table stores user confidence points for playoff teams (submitted once at the beginning of playoffs)
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

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_playoff_teams_season ON playoff_teams(season);
CREATE INDEX IF NOT EXISTS idx_playoff_confidence_points_participant_pool_season ON playoff_confidence_points(participant_id, pool_id, season);
CREATE INDEX IF NOT EXISTS idx_playoff_confidence_points_pool_season ON playoff_confidence_points(pool_id, season);

-- Add comments for documentation
COMMENT ON TABLE playoff_teams IS 'Stores which teams made it to the playoffs for each season (same for all pools)';
COMMENT ON TABLE playoff_confidence_points IS 'Stores user confidence points for playoff teams, submitted once at the beginning of playoffs';

