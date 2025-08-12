import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Validate environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅ Set' : '❌ Missing');
  console.error('');
  console.error('Please check your .env.local file and ensure these variables are set.');
  console.error('');
  console.error('Required variables:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL=your_supabase_url');
  console.error('  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key');
  process.exit(1);
}

// Create Supabase client using the service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const NFL_TEAMS = [
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE',
  'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC',
  'LAC', 'LAR', 'LV', 'MIA', 'MIN', 'NE', 'NO', 'NYG',
  'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WAS'
]

const SAMPLE_GAMES = [
  {
    week: 1,
    season: 2024,
    home_team: 'KC',
    away_team: 'BAL',
    kickoff_time: '2024-09-05T20:20:00Z',
    game_status: 'scheduled'
  },
  {
    week: 1,
    season: 2024,
    home_team: 'BUF',
    away_team: 'NYJ',
    kickoff_time: '2024-09-08T17:00:00Z',
    game_status: 'scheduled'
  },
  {
    week: 1,
    season: 2024,
    home_team: 'DAL',
    away_team: 'CLE',
    kickoff_time: '2024-09-08T17:00:00Z',
    game_status: 'scheduled'
  },
  {
    week: 1,
    season: 2024,
    home_team: 'GB',
    away_team: 'MIN',
    kickoff_time: '2024-09-08T17:00:00Z',
    game_status: 'scheduled'
  },
  {
    week: 1,
    season: 2024,
    home_team: 'NE',
    away_team: 'MIA',
    kickoff_time: '2024-09-08T17:00:00Z',
    game_status: 'scheduled'
  },
  {
    week: 1,
    season: 2024,
    home_team: 'NO',
    away_team: 'CAR',
    kickoff_time: '2024-09-08T17:00:00Z',
    game_status: 'scheduled'
  },
  {
    week: 1,
    season: 2024,
    home_team: 'PHI',
    away_team: 'ATL',
    kickoff_time: '2024-09-08T17:00:00Z',
    game_status: 'scheduled'
  },
  {
    week: 1,
    season: 2024,
    home_team: 'PIT',
    away_team: 'CIN',
    kickoff_time: '2024-09-08T17:00:00Z',
    game_status: 'scheduled'
  },
  {
    week: 1,
    season: 2024,
    home_team: 'TB',
    away_team: 'TEN',
    kickoff_time: '2024-09-08T17:00:00Z',
    game_status: 'scheduled'
  },
  {
    week: 1,
    season: 2024,
    home_team: 'WAS',
    away_team: 'ARI',
    kickoff_time: '2024-09-08T17:00:00Z',
    game_status: 'scheduled'
  },
  {
    week: 1,
    season: 2024,
    home_team: 'CHI',
    away_team: 'DET',
    kickoff_time: '2024-09-08T20:25:00Z',
    game_status: 'scheduled'
  },
  {
    week: 1,
    season: 2024,
    home_team: 'DEN',
    away_team: 'LAC',
    kickoff_time: '2024-09-08T20:25:00Z',
    game_status: 'scheduled'
  },
  {
    week: 1,
    season: 2024,
    home_team: 'HOU',
    away_team: 'IND',
    kickoff_time: '2024-09-08T20:25:00Z',
    game_status: 'scheduled'
  },
  {
    week: 1,
    season: 2024,
    home_team: 'JAX',
    away_team: 'LV',
    kickoff_time: '2024-09-08T20:25:00Z',
    game_status: 'scheduled'
  },
  {
    week: 1,
    season: 2024,
    home_team: 'LAR',
    away_team: 'SEA',
    kickoff_time: '2024-09-08T20:25:00Z',
    game_status: 'scheduled'
  },
  {
    week: 1,
    season: 2024,
    home_team: 'SF',
    away_team: 'NYG',
    kickoff_time: '2024-09-08T20:25:00Z',
    game_status: 'scheduled'
  }
]

async function seed() {
  console.log('🌱 Starting database seed...')

  try {
    // Create sample users
    console.log('Creating sample users...')
    const { data: users, error: usersError } = await supabase.auth.admin.createUser({
      email: 'demo@example.com',
      password: 'demo123456',
      email_confirm: true
    })

    if (usersError) {
      console.error('Error creating user:', usersError)
      return
    }

    const userId = users.user.id

    // Create sample pool
    console.log('Creating sample pool...')
    const { data: pool, error: poolError } = await supabase
      .from('pools')
      .insert({
        name: 'Demo Confidence Pool',
        created_by: userId,
        is_active: true
      })
      .select()
      .single()

    if (poolError) {
      console.error('Error creating pool:', poolError)
      return
    }

    // Add user to pool as admin
    console.log('Adding user to pool...')
    const { error: adminPoolError } = await supabase
      .from('admin_pools')
      .insert({
        admin_id: userId,
        pool_id: pool.id,
        is_owner: true
      })

    if (adminPoolError) {
      console.error('Error adding user to pool:', adminPoolError)
      return
    }

    // Create sample games
    console.log('Creating sample games...')
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .insert(SAMPLE_GAMES)
      .select()

    if (gamesError) {
      console.error('Error creating games:', gamesError)
      return
    }

    // Create sample picks
    console.log('Creating sample picks...')
    const samplePicks = games.map((game, index) => ({
      user_id: userId,
      pool_id: pool.id,
      game_id: game.id,
      predicted_winner: index % 2 === 0 ? game.home_team : game.away_team,
      confidence_points: 16 - index,
      locked: false
    }))

    const { error: picksError } = await supabase
      .from('picks')
      .insert(samplePicks)

    if (picksError) {
      console.error('Error creating picks:', picksError)
      return
    }

    // Create sample scores
    console.log('Creating sample scores...')
    const { error: scoresError } = await supabase
      .from('scores')
      .insert({
        user_id: userId,
        pool_id: pool.id,
        week: 1,
        season: 2024,
        points: 85,
        correct_picks: 12,
        total_picks: 16
      })

    if (scoresError) {
      console.error('Error creating scores:', scoresError)
      return
    }

    console.log('✅ Database seeded successfully!')
    console.log('📧 Demo user email: demo@example.com')
    console.log('🔑 Demo user password: demo123456')
    console.log('🏈 Pool created: Demo Confidence Pool')

  } catch (error) {
    console.error('❌ Error seeding database:', error)
  }
}

seed() 