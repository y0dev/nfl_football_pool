#!/usr/bin/env tsx
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY!;
const s = createClient(url, key);

async function main() {
  // Get actual weekly_winners schema by fetching one row
  const { data: wwSample, error: wwErr } = await s
    .from('weekly_winners')
    .select('*')
    .limit(3);

  console.log('weekly_winners error:', wwErr?.message);
  console.log('weekly_winners sample:', JSON.stringify(wwSample, null, 2));

  // Get actual scores table structure
  const { data: scoresSample, error: scoresErr } = await s
    .from('scores')
    .select('*')
    .limit(3);

  console.log('\nscores error:', scoresErr?.message);
  console.log('scores sample:', JSON.stringify(scoresSample, null, 2));

  // Get participants for these pools
  const pools = ['1b5672d6-5883-4a6b-8c91-758d9736a87e', '3ebf3aa8-6fda-41ba-8ab2-d93f5b7a7b5d'];
  for (const poolId of pools) {
    const { data: parts, count } = await s
      .from('participants')
      .select('id, name', { count: 'exact' })
      .eq('pool_id', poolId)
      .limit(5);
    console.log(`\nPool ${poolId.slice(0,8)} participants (${count} total):`, parts?.map(p => p.name).join(', '));
  }
}

main().catch(console.error);
