import { createClient } from '@supabase/supabase-js';
import { 
  adminsTable, 
  poolsTable, 
  adminPoolsTable, 
  participantsTable, 
  gamesTable, 
  picksTable, 
  scoresTable, 
  auditLogsTable,
  teamsTable,
  updatedGamesTable
} from '../src/lib/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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
      { name: 'audit_logs', sql: auditLogsTable },
    ];

    for (const table of tables) {
      console.log(`Creating ${table.name} table...`);
      const { error } = await supabase.rpc('exec_sql', { sql: table.sql });
      
      if (error) {
        console.error(`Error creating ${table.name} table:`, error);
      } else {
        console.log(`✅ ${table.name} table created successfully`);
      }
    }

    console.log('Database setup complete!');
  } catch (error) {
    console.error('Database setup failed:', error);
  }
}

setupDatabase(); 