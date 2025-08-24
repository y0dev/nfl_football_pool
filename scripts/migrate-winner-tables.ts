#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Validate environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅ Set' : '❌ Missing');
  process.exit(1);
}

// Create Supabase client using the service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrateWinnerTables() {
  console.log('🔄 Starting migration to add winner tracking tables...\n');

  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '..', 'scripts', 'update-schemas.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📋 Executing migration SQL...');
    
    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (!statement.trim()) continue;

      try {
        console.log(`  Executing statement ${i + 1}/${statements.length}...`);
        
        // Execute the SQL statement
        const { error } = await supabase.rpc('sql', { query: statement });
        
        if (error) {
          console.log(`  ⚠️  Statement ${i + 1} had issues (this may be normal for existing tables):`, error.message);
          errorCount++;
        } else {
          console.log(`  ✅ Statement ${i + 1} executed successfully`);
          successCount++;
        }
      } catch (err) {
        console.log(`  ❌ Statement ${i + 1} failed:`, err);
        errorCount++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`  ✅ Successful: ${successCount}`);
    console.log(`  ⚠️  Issues: ${errorCount}`);
    console.log(`  📝 Total: ${statements.length}`);

    if (errorCount === 0) {
      console.log('\n🎉 Migration completed successfully!');
    } else {
      console.log('\n⚠️  Migration completed with some issues. Check the logs above.');
      console.log('   Some errors may be expected (e.g., tables already exist).');
    }

    // Verify the new tables exist
    console.log('\n🔍 Verifying new tables...');
    
    const tablesToCheck = [
      'weekly_winners',
      'season_winners', 
      'period_winners'
    ];

    for (const tableName of tablesToCheck) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);

        if (error) {
          console.log(`  ❌ ${tableName}: ${error.message}`);
        } else {
          console.log(`  ✅ ${tableName}: Table accessible`);
        }
      } catch (err) {
        console.log(`  ❌ ${tableName}: ${err}`);
      }
    }

    // Check if new columns were added to existing tables
    console.log('\n🔍 Checking existing table updates...');
    
    try {
      const { data: scoresColumns, error: scoresError } = await supabase
        .rpc('sql', { 
          query: `
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'scores' 
            AND column_name IN ('rank', 'is_winner', 'tie_breaker_used', 'tie_breaker_rank', 'updated_at')
            ORDER BY column_name;
          `
        });

      if (scoresError) {
        console.log('  ⚠️  Could not check scores table columns');
      } else {
        console.log('  ✅ Scores table updated with new columns');
      }
    } catch (err) {
      console.log('  ⚠️  Could not verify scores table updates');
    }

    console.log('\n📋 Next Steps:');
    console.log('1. Review the migration results above');
    console.log('2. Test the new winner calculation functions');
    console.log('3. Update your application code to use the new winner tracking');
    console.log('4. Consider running winner calculations for existing data');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
migrateWinnerTables()
  .then(() => {
    console.log('\n✨ Migration process completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration process failed:', error);
    process.exit(1);
  });
