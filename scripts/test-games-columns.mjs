import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testColumns() {
  try {
    console.log('🧪 Testing games table columns...');

    // Try to query updated_at
    console.log('📋 Testing updated_at column...');
    try {
      const { data: updatedData, error: updatedError } = await supabase
        .from('games')
        .select('id, updated_at')
        .limit(1);

      if (updatedError) {
        console.log('❌ updated_at column does not exist:', updatedError.message);
      } else {
        console.log('✅ updated_at column exists:', updatedData);
      }
    } catch (error) {
      console.log('❌ Error testing updated_at:', error.message);
    }

    // Try to query season_type
    console.log('📋 Testing season_type column...');
    try {
      const { data: seasonData, error: seasonError } = await supabase
        .from('games')
        .select('id, season_type')
        .limit(1);

      if (seasonError) {
        console.log('❌ season_type column does not exist:', seasonError.message);
      } else {
        console.log('✅ season_type column exists:', seasonData);
      }
    } catch (error) {
      console.log('❌ Error testing season_type:', error.message);
    }

    // Try to query basic columns
    console.log('📋 Testing basic columns...');
    try {
      const { data: basicData, error: basicError } = await supabase
        .from('games')
        .select('id, week, season, home_team, away_team')
        .limit(1);

      if (basicError) {
        console.log('❌ Basic columns error:', basicError.message);
      } else {
        console.log('✅ Basic columns work:', basicData);
      }
    } catch (error) {
      console.log('❌ Error testing basic columns:', error.message);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testColumns();
