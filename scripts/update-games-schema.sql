-- Add missing fields to games table
-- This script adds the updated_at and season_type fields that are needed for NFL sync

-- Add updated_at column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'updated_at') THEN
        ALTER TABLE games ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        RAISE NOTICE 'Added updated_at column to games table';
    ELSE
        RAISE NOTICE 'updated_at column already exists in games table';
    END IF;
END $$;

-- Add season_type column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'season_type') THEN
        ALTER TABLE games ADD COLUMN season_type INTEGER DEFAULT 2;
        RAISE NOTICE 'Added season_type column to games table';
    ELSE
        RAISE NOTICE 'season_type column already exists in games table';
    END IF;
END $$;

-- Update existing records to have season_type = 2 (regular season) if they don't have it
UPDATE games SET season_type = 2 WHERE season_type IS NULL;

-- Create index on updated_at for better performance
CREATE INDEX IF NOT EXISTS idx_games_updated_at ON games(updated_at);

-- Create index on season_type for better performance
CREATE INDEX IF NOT EXISTS idx_games_season_type ON games(season_type);

-- Show the current table structure
\d games;
