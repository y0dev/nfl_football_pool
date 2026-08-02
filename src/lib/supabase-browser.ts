import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

// Pin to globalThis like getSupabaseClient/getSupabaseServiceClient in
// supabase.ts — without this, every call (e.g. each "Continue with Google"
// click) spun up a brand-new GoTrueClient on top of whatever getSupabaseClient()
// already has, triggering "Multiple GoTrueClient instances" and risking
// undefined behavior between them under the same storage key.
const g = globalThis as typeof globalThis & { __supabaseBrowserClient?: SupabaseClient };

// Browser client — stores PKCE code verifier in cookies (reliable on all mobile browsers)
export function getSupabaseBrowserClient() {
  if (g.__supabaseBrowserClient) return g.__supabaseBrowserClient;

  g.__supabaseBrowserClient = createBrowserClient(
    process.env.SUPABASE_URL! || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return g.__supabaseBrowserClient;
}
