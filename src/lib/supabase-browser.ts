import { createBrowserClient } from '@supabase/ssr';

// Browser client — stores PKCE code verifier in cookies (reliable on all mobile browsers)
export function getSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
