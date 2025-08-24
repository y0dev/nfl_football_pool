#!/usr/bin/env tsx

import { readFileSync } from 'fs';
import { join } from 'path';
import { getSupabaseServiceClient } from '../src/lib/supabase';

async function migrateWinnerTables() {
  try {
    console.log('Starting winner tables migration...');
    
    const supabase = getSupabaseServiceClient();
    
    // Read the SQL migration file
    const sqlPath = join(__dirname, 'update-winner-schemas.sql');
    const sqlContent = readFileSync(sqlPath, 'utf8');
    
    // Split the SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`Executing statement ${i + 1}/${statements.length}...`);
          const { error } = await supabase.rpc('exec_sql', { sql: statement });
          
          if (error) {
            console.error(`Error executing statement ${i + 1}:`, error);
            // Continue with other statements
          } else {
            console.log(`Statement ${i + 1} executed successfully`);
          }
        } catch (err) {
          console.error(`Error executing statement ${i + 1}:`, err);
          // Continue with other statements
        }
      }
    }
    
    console.log('Winner tables migration completed!');
    
    // Verify the tables were created
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['weekly_winners', 'season_winners', 'period_winners']);
    
    if (tablesError) {
      console.error('Error verifying tables:', tablesError);
    } else {
      console.log('Created tables:', tables?.map(t => t.table_name));
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  migrateWinnerTables();
}

export { migrateWinnerTables };
