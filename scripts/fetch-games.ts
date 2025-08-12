import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { nflAPI } from '../src/lib/nfl-api';
import fs from 'fs';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Validate environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apiKey = process.env.API_SPORTS_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅ Set' : '❌ Missing');
  console.error('');
  console.error('Please check your .env.local file and ensure these variables are set.');
  process.exit(1);
}

if (!apiKey) {
  console.error('⚠️  API_SPORTS_KEY not set. Using mock data for demonstration.');
}

// Create Supabase client using the service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface GameData {
  id: string;
  week: number;
  season: number;
  season_type: number;
  home_team: string;
  away_team: string;
  kickoff_time: string;
  home_score?: number;
  away_score?: number;
  winner?: string;
  status: string;
  home_team_id: string;
  away_team_id: string;
  is_playoff: boolean;
  is_active: boolean;
}

// Parse command line arguments
const args = process.argv.slice(2);
let startWeek = 1;
let endWeek = 18;
let includePlayoffs = true;
let seasonType = 'regular'; // 'preseason', 'regular', 'postseason', 'all'

// Parse arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  if (arg === '--help' || arg === '-h') {
    console.log('📋 NFL Games Fetcher - Help');
    console.log('');
    console.log('Usage: npm run fetch-games [options]');
    console.log('');
    console.log('Options:');
    console.log('  --start-week, -s <week>     Start fetching from specific week (1-22, default: 1)');
    console.log('  --end-week, -e <week>       End fetching at specific week (1-22, default: 18)');
    console.log('  --no-playoffs               Exclude playoff games (weeks 19-22)');
    console.log('  --preseason                 Fetch preseason games only (weeks 1-4)');
    console.log('  --regular                   Fetch regular season games only (weeks 5-18)');
    console.log('  --postseason                Fetch postseason games only (weeks 19-22)');
    console.log('  --help, -h                  Show this help message');
    console.log('');
    console.log('Season Types:');
    console.log('  • Preseason: Weeks 1-4 (seasontype=1)');
    console.log('  • Regular Season: Weeks 5-18 (seasontype=2)');
    console.log('  • Postseason: Weeks 19-22 (seasontype=3)');
    console.log('');
    console.log('Database Schema:');
    console.log('  • season_type column added to games table');
    console.log('  • 1=Preseason, 2=Regular Season, 3=Postseason');
    console.log('  • Automatically set based on week number');
    console.log('');
    console.log('Examples:');
    console.log('  npm run fetch-games                                    # Fetch all regular season games');
    console.log('  npm run fetch-games -- --start-week 5                  # Fetch from week 5 onwards');
    console.log('  npm run fetch-games -- --start-week 1 --end-week 4     # Fetch preseason only');
    console.log('  npm run fetch-games -- --start-week 19 --end-week 22   # Fetch playoffs only');
    console.log('  npm run fetch-games -- --preseason                     # Fetch preseason only');
    console.log('  npm run fetch-games -- --regular                       # Fetch regular season only');
    console.log('  npm run fetch-games -- --postseason                    # Fetch postseason only');
    console.log('  npm run fetch-games -- --start-week 1 --end-week 22    # Fetch entire season');
    process.exit(0);
  } else if (arg === '--start-week' || arg === '-s') {
    startWeek = parseInt(args[++i]);
  } else if (arg === '--end-week' || arg === '-e') {
    endWeek = parseInt(args[++i]);
  } else if (arg === '--no-playoffs') {
    includePlayoffs = false;
    endWeek = Math.min(endWeek, 18);
  } else if (arg === '--preseason') {
    seasonType = 'preseason';
    startWeek = 1;
    endWeek = 4;
  } else if (arg === '--regular') {
    seasonType = 'regular';
    startWeek = 1;
    endWeek = 18;
  } else if (arg === '--postseason') {
    seasonType = 'postseason';
    startWeek = 19;
    endWeek = 22;
  }
}

// Validate week ranges
if (startWeek < 1 || startWeek > 22 || endWeek < 1 || endWeek > 22) {
  console.error('❌ Week numbers must be between 1 and 22');
  process.exit(1);
}

if (startWeek > endWeek) {
  console.error('❌ Start week cannot be greater than end week');
  process.exit(1);
}

// Adjust end week if playoffs are excluded
if (!includePlayoffs && endWeek > 18) {
  endWeek = 18;
}

// Mock data for when API key is not available
const mockGames: GameData[] = [
  {
    id: 'mock_1',
    week: 1,
    season: 2024,
    season_type: 1, // Preseason
    home_team: 'Kansas City Chiefs',
    away_team: 'Baltimore Ravens',
    kickoff_time: '2024-09-05T20:20:00Z',
    status: 'scheduled',
    home_team_id: 'KC',
    away_team_id: 'BAL',
    is_playoff: false,
    is_active: true
  },
  {
    id: 'mock_2',
    week: 1,
    season: 2024,
    season_type: 1, // Preseason
    home_team: 'Buffalo Bills',
    away_team: 'New York Jets',
    kickoff_time: '2024-09-08T17:00:00Z',
    status: 'scheduled',
    home_team_id: 'BUF',
    away_team_id: 'NYJ',
    is_playoff: false,
    is_active: true
  },
  {
    id: 'mock_3',
    week: 1,
    season: 2024,
    season_type: 1, // Preseason
    home_team: 'Dallas Cowboys',
    away_team: 'Philadelphia Eagles',
    kickoff_time: '2024-09-08T20:20:00Z',
    status: 'scheduled',
    home_team_id: 'DAL',
    away_team_id: 'PHI',
    is_playoff: false,
    is_active: true
  },
  {
    id: 'mock_4',
    week: 2,
    season: 2024,
    season_type: 1, // Preseason
    home_team: 'Green Bay Packers',
    away_team: 'Chicago Bears',
    kickoff_time: '2024-09-15T17:00:00Z',
    status: 'scheduled',
    home_team_id: 'GB',
    away_team_id: 'CHI',
    is_playoff: false,
    is_active: true
  },
  {
    id: 'mock_5',
    week: 2,
    season: 2024,
    season_type: 1, // Preseason
    home_team: 'San Francisco 49ers',
    away_team: 'Los Angeles Rams',
    kickoff_time: '2024-09-15T20:20:00Z',
    status: 'scheduled',
    home_team_id: 'SF',
    away_team_id: 'LAR',
    is_playoff: false,
    is_active: true
  },
  {
    id: 'mock_playoff_1',
    week: 19,
    season: 2024,
    season_type: 3, // Postseason
    home_team: 'Kansas City Chiefs',
    away_team: 'Buffalo Bills',
    kickoff_time: '2025-01-11T20:15:00Z',
    status: 'scheduled',
    home_team_id: 'KC',
    away_team_id: 'BUF',
    is_playoff: true,
    is_active: true
  },
  {
    id: 'mock_playoff_2',
    week: 19,
    season: 2024,
    season_type: 3, // Postseason
    home_team: 'Baltimore Ravens',
    away_team: 'Cincinnati Bengals',
    kickoff_time: '2025-01-12T16:30:00Z',
    status: 'scheduled',
    home_team_id: 'BAL',
    away_team_id: 'CIN',
    is_playoff: true,
    is_active: true
  },
  {
    id: 'mock_playoff_3',
    week: 20,
    season: 2024,
    season_type: 3, // Postseason
    home_team: 'Kansas City Chiefs',
    away_team: 'Baltimore Ravens',
    kickoff_time: '2025-01-19T20:15:00Z',
    status: 'scheduled',
    home_team_id: 'KC',
    away_team_id: 'BAL',
    is_playoff: true,
    is_active: true
  },
  {
    id: 'mock_playoff_4',
    week: 21,
    season: 2024,
    season_type: 3, // Postseason
    home_team: 'Kansas City Chiefs',
    away_team: 'San Francisco 49ers',
    kickoff_time: '2025-02-02T18:30:00Z',
    status: 'scheduled',
    home_team_id: 'KC',
    away_team_id: 'SF',
    is_playoff: true,
    is_active: true
  }
];

async function main() {
  console.log('🏈 Starting NFL games fetch and insert...');
  
  // Get current season
  let currentSeason = 2024; // Default fallback
  try {
    currentSeason = await nflAPI.getCurrentSeason();
  } catch (error) {
    console.log('⚠️  Could not fetch current season from API, using 2024 as default');
  }
  console.log(`📅 Current season: ${currentSeason}`);

  let gamesToInsert: GameData[] = [];

  if (apiKey) {
    console.log('🔑 Using NFL API to fetch games...');
    
    // Determine season type based on week range
    let seasonTypeToFetch: number;
    if (startWeek >= 1 && startWeek <= 4) {
      seasonTypeToFetch = 1; // Preseason
      console.log('🏈 Fetching preseason games...');
    } else if (startWeek >= 5 && startWeek <= 18) {
      seasonTypeToFetch = 2; // Regular season
      console.log('🏈 Fetching regular season games...');
    } else if (startWeek >= 19 && startWeek <= 22) {
      seasonTypeToFetch = 3; // Postseason
      console.log('🏆 Fetching postseason games...');
    } else {
      console.log('⚠️  Mixed week range detected, fetching all season types...');
    }
    
    // Fetch games for the specified week range
    for (let week = startWeek; week <= endWeek; week++) {
      console.log(`📋 Fetching games for Week ${week}...`);
      
      try {
        // Determine season type for this specific week
        let weekSeasonType: number;
        if (week >= 1 && week <= 4) {
          weekSeasonType = 1; // Preseason
        } else if (week >= 5 && week <= 18) {
          weekSeasonType = 2; // Regular season
        } else if (week >= 19 && week <= 22) {
          weekSeasonType = 3; // Postseason
        } else {
          weekSeasonType = 2; // Default to regular season
        }
        
        const weekGames = await nflAPI.getWeekGames(currentSeason, weekSeasonType, week);
        console.log(`📊 Week ${week} Games:`, weekGames.length);
        
        if (weekGames.length > 0) {
          const formattedGames: GameData[] = weekGames.map(game => ({
            id: game.id,
            week: game.week,
            season: game.season,
            season_type: weekSeasonType,
            home_team: game.home_team,
            away_team: game.away_team,
            kickoff_time: game.date,
            home_score: game.home_score,
            away_score: game.away_score,
            winner: game.home_score && game.away_score 
              ? (game.home_score > game.away_score ? game.home_team : game.away_team)
              : undefined,
            status: game.status,
            home_team_id: game.home_team_id,
            away_team_id: game.away_team_id,
            is_playoff: week >= 19 && week <= 22,
            is_active: true
          }));
          
          gamesToInsert = [...gamesToInsert, ...formattedGames];
          console.log(`✅ Found ${weekGames.length} games for Week ${week}`);
        } else {
          console.log(`⚠️  No games found for Week ${week}`);
        }
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`❌ Error fetching Week ${week} games:`, error);
      }
    }
    
    // If no games were found from API, fall back to mock data
    if (gamesToInsert.length === 0) {
      console.log('🎭 No games found from API, falling back to mock data...');
      gamesToInsert = mockGames
        .filter(game => game.week >= startWeek && game.week <= endWeek)
        .map(game => ({
          ...game,
          season: currentSeason
        }));
    }
    
  } else {
    console.log('🎭 Using mock data (no API key provided)...');
    gamesToInsert = mockGames
      .filter(game => game.week >= startWeek && game.week <= endWeek)
      .map(game => ({
        ...game,
        season: currentSeason
      }));
  }

  if (gamesToInsert.length === 0) {
    console.log('⚠️  No games found to insert for the specified range.');
    return;
  }

    console.log(`📊 Total games to insert: ${gamesToInsert.length}`);
    // write gamesToInsert to a file
    fs.writeFileSync('gamesToInsert.json', JSON.stringify(gamesToInsert, null, 2));

  // Clear existing games for the season and week range
  console.log(`🗑️  Clearing existing games for season ${currentSeason}, weeks ${startWeek}-${endWeek}...`);
  const { error: deleteError } = await supabase
    .from('games')
    .delete()
    .eq('season', currentSeason)
    .gte('week', startWeek)
    .lte('week', endWeek);

  if (deleteError) {
    console.error('❌ Error clearing existing games:', deleteError);
  } else {
    console.log('✅ Cleared existing games in range');
  }

  // Insert games in batches
  const batchSize = 50;
  let insertedCount = 0;

  for (let i = 0; i < gamesToInsert.length; i += batchSize) {
    const batch = gamesToInsert.slice(i, i + batchSize);
    
    console.log(`📦 Inserting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(gamesToInsert.length / batchSize)}...`);
    
    const { data, error } = await supabase
      .from('games')
      .insert(batch)
      .select('id');

    if (error) {
      console.error('❌ Error inserting games batch:', error);
      console.error('Failed batch:', batch);
    } else {
      insertedCount += batch.length;
      console.log(`✅ Inserted ${batch.length} games (Total: ${insertedCount})`);
    }

    // Add small delay between batches
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('');
  console.log('🎉 Games fetch and insert complete!');
  console.log(`📈 Total games inserted: ${insertedCount}`);
  console.log(`📅 Season: ${currentSeason}`);
  console.log(`📋 Range: Weeks ${startWeek}-${endWeek}`);
  
  // Show summary by week
  const weekSummary = gamesToInsert.reduce((acc, game) => {
    acc[game.week] = (acc[game.week] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  console.log('');
  console.log('📋 Games by Week:');
  Object.entries(weekSummary)
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .forEach(([week, count]) => {
      const weekType = parseInt(week) > 18 ? '🏆 Playoff' : '📅 Regular';
      console.log(`   Week ${week}: ${count} games (${weekType})`);
    });
}

// Run the main function
main().catch(error => {
  console.error('❌ Fatal error during games fetch and insert:', error);
  process.exit(1);
});
