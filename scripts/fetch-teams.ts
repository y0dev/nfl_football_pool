import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { nflAPI } from '../src/lib/nfl-api';
import { randomUUID } from 'crypto';

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

interface TeamData {
  id: string;
  name: string;
  city: string;
  abbreviation: string;
  conference: string;
  division: string;
  season: number;
  is_active: boolean;
}

// Mock data for when API key is not available
const mockTeams: Omit<TeamData, 'id'>[] = [
  {
    name: 'Chiefs',
    city: 'Kansas City',
    abbreviation: 'KC',
    conference: 'AFC',
    division: 'West',
    season: 2024,
    is_active: true
  },
  {
    name: 'Ravens',
    city: 'Baltimore',
    abbreviation: 'BAL',
    conference: 'AFC',
    division: 'North',
    season: 2024,
    is_active: true
  },
  {
    name: 'Bills',
    city: 'Buffalo',
    abbreviation: 'BUF',
    conference: 'AFC',
    division: 'East',
    season: 2024,
    is_active: true
  },
  {
    name: 'Jets',
    city: 'New York',
    abbreviation: 'NYJ',
    conference: 'AFC',
    division: 'East',
    season: 2024,
    is_active: true
  },
  {
    name: 'Cowboys',
    city: 'Dallas',
    abbreviation: 'DAL',
    conference: 'NFC',
    division: 'East',
    season: 2024,
    is_active: true
  },
  {
    name: 'Eagles',
    city: 'Philadelphia',
    abbreviation: 'PHI',
    conference: 'NFC',
    division: 'East',
    season: 2024,
    is_active: true
  },
  {
    name: 'Patriots',
    city: 'New England',
    abbreviation: 'NE',
    conference: 'AFC',
    division: 'East',
    season: 2024,
    is_active: true
  },
  {
    name: 'Dolphins',
    city: 'Miami',
    abbreviation: 'MIA',
    conference: 'AFC',
    division: 'East',
    season: 2024,
    is_active: true
  },
  {
    name: 'Bengals',
    city: 'Cincinnati',
    abbreviation: 'CIN',
    conference: 'AFC',
    division: 'North',
    season: 2024,
    is_active: true
  },
  {
    name: 'Browns',
    city: 'Cleveland',
    abbreviation: 'CLE',
    conference: 'AFC',
    division: 'North',
    season: 2024,
    is_active: true
  },
  {
    name: 'Steelers',
    city: 'Pittsburgh',
    abbreviation: 'PIT',
    conference: 'AFC',
    division: 'North',
    season: 2024,
    is_active: true
  },
  {
    name: 'Texans',
    city: 'Houston',
    abbreviation: 'HOU',
    conference: 'AFC',
    division: 'South',
    season: 2024,
    is_active: true
  },
  {
    name: 'Colts',
    city: 'Indianapolis',
    abbreviation: 'IND',
    conference: 'AFC',
    division: 'South',
    season: 2024,
    is_active: true
  },
  {
    name: 'Jaguars',
    city: 'Jacksonville',
    abbreviation: 'JAX',
    conference: 'AFC',
    division: 'South',
    season: 2024,
    is_active: true
  },
  {
    name: 'Titans',
    city: 'Tennessee',
    abbreviation: 'TEN',
    conference: 'AFC',
    division: 'South',
    season: 2024,
    is_active: true
  },
  {
    name: 'Broncos',
    city: 'Denver',
    abbreviation: 'DEN',
    conference: 'AFC',
    division: 'West',
    season: 2024,
    is_active: true
  },
  {
    name: 'Raiders',
    city: 'Las Vegas',
    abbreviation: 'LV',
    conference: 'AFC',
    division: 'West',
    season: 2024,
    is_active: true
  },
  {
    name: 'Chargers',
    city: 'Los Angeles',
    abbreviation: 'LAC',
    conference: 'AFC',
    division: 'West',
    season: 2024,
    is_active: true
  },
  {
    name: 'Giants',
    city: 'New York',
    abbreviation: 'NYG',
    conference: 'NFC',
    division: 'East',
    season: 2024,
    is_active: true
  },
  {
    name: 'Commanders',
    city: 'Washington',
    abbreviation: 'WAS',
    conference: 'NFC',
    division: 'East',
    season: 2024,
    is_active: true
  },
  {
    name: 'Packers',
    city: 'Green Bay',
    abbreviation: 'GB',
    conference: 'NFC',
    division: 'North',
    season: 2024,
    is_active: true
  },
  {
    name: 'Bears',
    city: 'Chicago',
    abbreviation: 'CHI',
    conference: 'NFC',
    division: 'North',
    season: 2024,
    is_active: true
  },
  {
    name: 'Lions',
    city: 'Detroit',
    abbreviation: 'DET',
    conference: 'NFC',
    division: 'North',
    season: 2024,
    is_active: true
  },
  {
    name: 'Vikings',
    city: 'Minnesota',
    abbreviation: 'MIN',
    conference: 'NFC',
    division: 'North',
    season: 2024,
    is_active: true
  },
  {
    name: 'Falcons',
    city: 'Atlanta',
    abbreviation: 'ATL',
    conference: 'NFC',
    division: 'South',
    season: 2024,
    is_active: true
  },
  {
    name: 'Panthers',
    city: 'Carolina',
    abbreviation: 'CAR',
    conference: 'NFC',
    division: 'South',
    season: 2024,
    is_active: true
  },
  {
    name: 'Saints',
    city: 'New Orleans',
    abbreviation: 'NO',
    conference: 'NFC',
    division: 'South',
    season: 2024,
    is_active: true
  },
  {
    name: 'Buccaneers',
    city: 'Tampa Bay',
    abbreviation: 'TB',
    conference: 'NFC',
    division: 'South',
    season: 2024,
    is_active: true
  },
  {
    name: 'Cardinals',
    city: 'Arizona',
    abbreviation: 'ARI',
    conference: 'NFC',
    division: 'West',
    season: 2024,
    is_active: true
  },
  {
    name: 'Rams',
    city: 'Los Angeles',
    abbreviation: 'LAR',
    conference: 'NFC',
    division: 'West',
    season: 2024,
    is_active: true
  },
  {
    name: '49ers',
    city: 'San Francisco',
    abbreviation: 'SF',
    conference: 'NFC',
    division: 'West',
    season: 2024,
    is_active: true
  },
  {
    name: 'Seahawks',
    city: 'Seattle',
    abbreviation: 'SEA',
    conference: 'NFC',
    division: 'West',
    season: 2024,
    is_active: true
  }
];

async function fetchAndInsertTeams() {
  console.log('🏈 Starting NFL teams fetch and insert...');
  
  try {
    // Get current season
    let currentSeason = 2024; // Default fallback
    try {
      currentSeason = await nflAPI.getCurrentSeason();
    } catch (error) {
      console.log('⚠️  Could not fetch current season from API, using 2024 as default');
    }
    console.log(`📅 Current season: ${currentSeason}`);

    let teamsToInsert: TeamData[] = [];

    if (apiKey) {
      console.log('🔑 Using NFL API to fetch teams...');
      
      try {
        const apiTeams = await nflAPI.getTeams(currentSeason);
        
        if (apiTeams.length > 0) {
          teamsToInsert = apiTeams.map(team => ({
            id: randomUUID(),
            name: team.name,
            city: team.city,
            abbreviation: team.abbreviation,
            conference: team.conference,
            division: team.division,
            season: currentSeason,
            is_active: true
          }));
          
          console.log(`✅ Found ${apiTeams.length} teams from API`);
        } else {
          throw new Error('No teams returned from API');
        }
        
      } catch (error) {
        console.error('❌ Error fetching teams from API:', error);
        console.log('🎭 Falling back to mock data...');
        teamsToInsert = mockTeams.map(team => ({
          id: randomUUID(),
          ...team,
          season: currentSeason
        }));
      }
      
    } else {
      console.log('🎭 Using mock data (no API key provided)...');
      teamsToInsert = mockTeams.map(team => ({
        id: randomUUID(),
        ...team,
        season: currentSeason
      }));
    }

    if (teamsToInsert.length === 0) {
      console.log('⚠️  No teams found to insert.');
      return;
    }

    console.log(`📊 Total teams to insert: ${teamsToInsert.length}`);

    // Clear existing teams for the season (optional - comment out if you want to keep existing)
    console.log('🗑️  Clearing existing teams for the season...');
    const { error: deleteError } = await supabase
      .from('teams')
      .delete()
      .eq('season', currentSeason);

    if (deleteError) {
      console.error('❌ Error clearing existing teams:', deleteError);
    } else {
      console.log('✅ Cleared existing teams');
    }

    // Insert teams in batches
    const batchSize = 20;
    let insertedCount = 0;

    for (let i = 0; i < teamsToInsert.length; i += batchSize) {
      const batch = teamsToInsert.slice(i, i + batchSize);
      
      console.log(`📦 Inserting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(teamsToInsert.length / batchSize)}...`);
      
      const { data, error } = await supabase
        .from('teams')
        .insert(batch)
        .select('id, name');

      if (error) {
        console.error('❌ Error inserting teams batch:', error);
        console.error('Failed batch:', batch);
      } else {
        insertedCount += batch.length;
        console.log(`✅ Inserted ${batch.length} teams (Total: ${insertedCount})`);
      }

      // Add small delay between batches
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('');
    console.log('🎉 Teams fetch and insert complete!');
    console.log(`📈 Total teams inserted: ${insertedCount}`);
    console.log(`📅 Season: ${currentSeason}`);
    
    // Show summary by conference
    const conferenceSummary = teamsToInsert.reduce((acc, team) => {
      acc[team.conference] = (acc[team.conference] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('');
    console.log('📋 Teams by Conference:');
    Object.entries(conferenceSummary)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([conference, count]) => {
        console.log(`   ${conference}: ${count} teams`);
      });

    // Show summary by division
    const divisionSummary = teamsToInsert.reduce((acc, team) => {
      const key = `${team.conference} ${team.division}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('');
    console.log('📋 Teams by Division:');
    Object.entries(divisionSummary)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([division, count]) => {
        console.log(`   ${division}: ${count} teams`);
      });

  } catch (error) {
    console.error('❌ Fatal error during teams fetch and insert:', error);
    process.exit(1);
  }
}

// Run the script
fetchAndInsertTeams();
