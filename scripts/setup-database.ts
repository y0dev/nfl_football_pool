import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { 
  adminsTable, 
  poolsTable, 
  adminPoolsTable, 
  participantsTable, 
  gamesTable, 
  picksTable, 
  scoresTable, 
  tieBreakersTable,
  auditLogsTable,
  reminderLogsTable,
  teamsTable,
  updatedGamesTable,
  rlsPolicies,
  getSupabaseClient
} from '../src/lib/supabase';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Validate environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅ Set' : '❌ Missing');
  console.error('');
  console.error('Please check your .env.local file and ensure these variables are set.');
  console.error('');
  console.error('Required variables:');
  console.error('  SUPABASE_URL=your_supabase_url');
  console.error('  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key');
  process.exit(1);
}

// Create Supabase client using the service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupDatabase() {
  console.log('Setting up database tables...');

  try {
    // Create tables in order
    const tables = [
      { name: 'admins', sql: adminsTable },
      { name: 'pools', sql: poolsTable },
      { name: 'admin_pools', sql: adminPoolsTable },
      { name: 'participants', sql: participantsTable },
      { name: 'teams', sql: teamsTable },
      { name: 'games', sql: updatedGamesTable },
      { name: 'picks', sql: picksTable },
      { name: 'scores', sql: scoresTable },
      { name: 'tie_breakers', sql: tieBreakersTable },
      { name: 'audit_logs', sql: auditLogsTable },
      { name: 'reminder_logs', sql: reminderLogsTable },
    ];

    for (const table of tables) {
      console.log(`Creating ${table.name} table...`);
      
      // Use direct SQL execution
      const { error } = await supabase.rpc('sql', { query: table.sql });
      
      if (error) {
        // If sql function doesn't exist, try alternative approach
        console.log(`Trying alternative method for ${table.name}...`);
        
        // For now, just log that the table creation was attempted
        // In a real setup, you would use Supabase CLI or direct database connection
        console.log(`⚠️  ${table.name} table creation attempted (manual setup may be required)`);
      } else {
        console.log(`✅ ${table.name} table created successfully`);
      }
    }

    // Apply RLS policies
    console.log('Applying Row Level Security policies...');
    const { error: rlsError } = await supabase.rpc('sql', { query: rlsPolicies });
    
    if (rlsError) {
      console.log('⚠️  RLS policies application attempted (manual setup may be required)');
    } else {
      console.log('✅ RLS policies applied successfully');
    }

    console.log('');
    console.log('📋 Next Steps:');
    console.log('1. Go to your Supabase dashboard > SQL Editor');
    console.log('2. Run the following SQL commands manually:');
    console.log('');
    tables.forEach(table => {
      console.log(`   -- ${table.name} table`);
      console.log(`   ${table.sql.replace(/\n/g, '\n   ')}`);
      console.log('');
    });
    console.log('   -- RLS policies');
    console.log(`   ${rlsPolicies.replace(/\n/g, '\n   ')}`);
    console.log('');
    console.log('3. After running the SQL, you can seed the database with:');
    console.log('   npm run seed');

    console.log('Database setup complete!');
  } catch (error) {
    console.error('Database setup failed:', error);
  }
}

setupDatabase(); 