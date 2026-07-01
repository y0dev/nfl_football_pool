import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const MANUAL_SQL = `
-- Run this in the Supabase SQL editor if the script fails
ALTER TABLE admins ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'standard', 'pro'));
ALTER TABLE admins ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE admins ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
`.trim();

async function migrate() {
  console.log('Adding plan columns to admins table...\n');

  const statements = [
    `ALTER TABLE admins ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'standard', 'pro'))`,
    `ALTER TABLE admins ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ`,
    `ALTER TABLE admins ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT`,
  ];

  let usedRpc = true;

  for (const sql of statements) {
    const { error } = await supabase.rpc('exec_sql', { sql });
    if (error) {
      console.error(`❌ exec_sql RPC failed: ${error.message}`);
      console.log('\nRun this SQL manually in the Supabase dashboard → SQL Editor:\n');
      console.log(MANUAL_SQL);
      usedRpc = false;
      break;
    }
    console.log(`✅ ${sql.replace(/\s+/g, ' ').slice(0, 70)}…`);
  }

  if (!usedRpc) {
    process.exit(1);
  }

  // Backfill existing admins: give them a 14-day trial starting today
  console.log('\nBackfilling trial_ends_at for existing admins…');
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 14);

  const { error: backfillError, count } = await supabase
    .from('admins')
    .update({ trial_ends_at: trialEndsAt.toISOString() })
    .is('trial_ends_at', null);

  if (backfillError) {
    console.warn('⚠️  Backfill warning:', backfillError.message);
  } else {
    console.log(`✅ Backfill complete (${count ?? 'unknown'} rows updated).`);
  }

  console.log('\n✅ Migration done. Run the app and verify /admin/account shows plan info.\n');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
