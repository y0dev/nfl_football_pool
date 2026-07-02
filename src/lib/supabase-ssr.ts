import { createServerClient, type CookieOptions } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Route Handler client — reads PKCE cookie from request, captures cookies to set on response
export async function getSupabaseRouteClient(
  requestCookies: { getAll(): { name: string; value: string }[] },
  setCookies: (cookies: { name: string; value: string; options: CookieOptions }[]) => void
) {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() { return requestCookies.getAll(); },
      setAll(cookiesToSet) { setCookies(cookiesToSet); },
    },
  });
}
