import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '❌');
  console.error('   NEXT_PUBLIC_SUPABASE_SERVICE_KEY:', supabaseServiceKey ? '✓' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('🚀 Starting games table migration...');

    // Try to add updated_at column
    console.log('➕ Adding updated_at column...');
    try {
      const { error: alterError } = await supabase.rpc('exec_sql', {
        sql: 'ALTER TABLE games ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()'
      });

      if (alterError) {
        if (alterError.message.includes('already exists')) {
          console.log('✅ updated_at column already exists');
        } else {
          console.error('❌ Error adding updated_at column:', alterError);
          return;
        }
      } else {
        console.log('✅ Added updated_at column');
      }
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('✅ updated_at column already exists');
      } else {
        console.error('❌ Error adding updated_at column:', error);
        return;
      }
    }

    // Try to add season_type column
    console.log('➕ Adding season_type column...');
    try {
      const { error: alterError } = await supabase.rpc('exec_sql', {
        sql: 'ALTER TABLE games ADD COLUMN season_type INTEGER DEFAULT 2'
      });

      if (alterError) {
        if (alterError.message.includes('already exists')) {
          console.log('✅ season_type column already exists');
        } else {
          console.error('❌ Error adding season_type column:', alterError);
          return;
        }
      } else {
        console.log('✅ Added season_type column');
      }
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('✅ season_type column already exists');
      } else {
        console.error('❌ Error adding season_type column:', error);
        return;
      }
    }

    // Update existing records to have season_type = 2
    console.log('🔄 Updating existing records...');
    try {
      const { error: updateError } = await supabase
        .from('games')
        .update({ season_type: 2 })
        .is('season_type', null);

      if (updateError) {
        console.error('❌ Error updating existing records:', updateError);
      } else {
        console.log('✅ Updated existing records');
      }
    } catch (error) {
      console.log('ℹ️  Could not update existing records:', error.message);
    }

    // Try to create indexes
    console.log('🔍 Creating indexes...');
    try {
      await supabase.rpc('exec_sql', {
        sql: 'CREATE INDEX IF NOT EXISTS idx_games_updated_at ON games(updated_at)'
      });
      console.log('✅ Created index on updated_at');
    } catch {
      console.log('ℹ️  Index on updated_at already exists or failed to create');
    }

    try {
      await supabase.rpc('exec_sql', {
        sql: 'CREATE INDEX IF NOT EXISTS idx_games_season_type ON games(season_type)'
      });
      console.log('✅ Created index on season_type');
    } catch {
      console.log('ℹ️  Index on season_type already exists or failed to create');
    }

    console.log('🎉 Migration completed successfully!');

    // Test the new columns by trying to query them
    console.log('🧪 Testing new columns...');
    try {
      const { data: testData, error: testError } = await supabase
        .from('games')
        .select('id, updated_at, season_type')
        .limit(1);

      if (testError) {
        console.error('❌ Error testing new columns:', testError);
      } else {
        console.log('✅ New columns are working:', testData);
      }
    } catch (error) {
      console.log('ℹ️  Could not test new columns:', error.message);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
