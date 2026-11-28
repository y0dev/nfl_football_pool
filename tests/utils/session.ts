import type { BrowserContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import { createSessionToken } from '@/lib/session';
loadEnv({ path: '.env.local' });

/**
 * Starts a browser context already signed in as an existing account, the way
 * a real sign-in leaves it: the signed httpOnly sh-session cookie the server
 * checks (src/lib/session.ts), plus the display-only user copy
 * src/lib/auth.tsx keeps in localStorage (never is_super_admin — that is
 * always re-checked against the database).
 *
 * Use it instead of typing a password: sign-in is rate-limited per account
 * (10 per 15 minutes) and several specs share the seeded demo accounts.
 */
export async function signInAs(context: BrowserContext, email: string, table: 'commissioners' | 'admins' = 'commissioners') {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY!);
  const { data: account, error } = await supabase.from(table).select('id, full_name').eq('email', email).single();
  if (error || !account) throw new Error(`Seeded account ${email} not found in ${table}: ${error?.message}`);

  await context.addCookies([{
    name: 'sh-session', value: createSessionToken(account.id),
    domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax',
  }]);
  const storedUser = JSON.stringify({ id: account.id, email, full_name: account.full_name, signedInAt: Date.now() });
  await context.addInitScript(user => localStorage.setItem('nfl-pool-user', user), storedUser);
  return { id: account.id as string, fullName: account.full_name as string | null };
}
