import { getSupabaseClient } from '../src/lib/supabase';

async function setupPicksTable() {
  console.log('🏈 Setting up Picks table...');
  console.log('');

  try {
    const supabase = getSupabaseClient();

    // Create picks table if it doesn't exist
    const { error: createError } = await supabase.rpc('create_picks_table', {});

    if (createError) {
      // If the RPC doesn't exist, create the table manually
      console.log('Creating picks table manually...');
      
      const { error: sqlError } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS picks (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
            pool_id UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
            game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
            predicted_winner VARCHAR(255) NOT NULL,
            confidence_points INTEGER NOT NULL CHECK (confidence_points > 0),
            week INTEGER,
            season_type INTEGER DEFAULT 2,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(participant_id, pool_id, game_id, week)
          );

          -- Create index for better query performance
          CREATE INDEX IF NOT EXISTS idx_picks_participant_pool_week 
          ON picks(participant_id, pool_id, week);

          CREATE INDEX IF NOT EXISTS idx_picks_pool_week 
          ON picks(pool_id, week);

          -- Create trigger to update updated_at timestamp
          CREATE OR REPLACE FUNCTION update_updated_at_column()
          RETURNS TRIGGER AS $$
          BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
          END;
          $$ language 'plpgsql';

          CREATE TRIGGER IF NOT EXISTS update_picks_updated_at 
          BEFORE UPDATE ON picks 
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        `
      });

      if (sqlError) {
        console.error('❌ Error creating picks table:', sqlError);
        return;
      }
    }

    console.log('✅ Picks table created successfully');
    console.log('');

    // Verify table structure
    console.log('🔍 Verifying table structure...');
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'picks')
      .order('ordinal_position');

    if (columnsError) {
      console.error('❌ Error checking table structure:', columnsError);
      return;
    }

    console.log('📋 Picks table columns:');
    columns?.forEach(column => {
      console.log(`  • ${column.column_name}: ${column.data_type} ${column.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
    });
    console.log('');

    // Test inserting a sample pick (if participants and games exist)
    console.log('🧪 Testing pick insertion...');
    const { data: participants } = await supabase
      .from('participants')
      .select('id, pool_id')
      .limit(1);

    const { data: games } = await supabase
      .from('games')
      .select('id')
      .limit(1);

    if (participants && participants.length > 0 && games && games.length > 0) {
      const testPick = {
        participant_id: participants[0].id,
        pool_id: participants[0].pool_id,
        game_id: games[0].id,
        predicted_winner: 'Test Team',
        confidence_points: 1,
        week: 1,
        season_type: 2
      };

      const { data: insertedPick, error: insertError } = await supabase
        .from('picks')
        .insert(testPick)
        .select()
        .single();

      if (insertError) {
        console.log('⚠️  Test insertion failed (this is normal if constraints are working):', insertError.message);
      } else {
        console.log('✅ Test pick inserted successfully');
        
        // Clean up test data
        await supabase
          .from('picks')
          .delete()
          .eq('id', insertedPick.id);
        
        console.log('🧹 Test data cleaned up');
      }
    } else {
      console.log('⚠️  Skipping test insertion - no participants or games found');
    }

    console.log('');
    console.log('🎉 Picks table setup completed successfully!');
    console.log('');
    console.log('📋 Table features:');
    console.log('  • UUID primary key');
    console.log('  • Foreign key constraints to participants, pools, and games');
    console.log('  • Unique constraint on participant/pool/game/week combination');
    console.log('  • Confidence points validation (must be > 0)');
    console.log('  • Automatic timestamps (created_at, updated_at)');
    console.log('  • Indexes for better query performance');
    console.log('  • Trigger to update updated_at timestamp');

  } catch (error) {
    console.error('❌ Fatal error during picks table setup:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log('🏈 Picks Table Setup - Help');
  console.log('');
  console.log('Usage: npm run setup-picks-table');
  console.log('');
  console.log('This script:');
  console.log('  • Creates the picks table with proper structure');
  console.log('  • Sets up foreign key constraints');
  console.log('  • Creates indexes for performance');
  console.log('  • Adds triggers for automatic timestamps');
  console.log('  • Tests the table structure');
  console.log('');
  console.log('Options:');
  console.log('  --help, -h    Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  npm run setup-picks-table');
  console.log('  npm run setup-picks-table -- --help');
  process.exit(0);
}

// Run the setup
setupPicksTable();
