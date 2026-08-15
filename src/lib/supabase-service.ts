import { createClient, SupabaseClient } from '@supabase/supabase-js'

// SERVER-ONLY. Do not import this file from any 'use client' component or
// any module that a client component imports from — the service role key
// gets inlined into the client JS bundle at build time otherwise. Client
// code must use getSupabaseClient()/getSupabaseBrowserClient() instead.
// (Not using the `server-only` package here: it throws when reached from
// Middleware's edge bundle, which this file legitimately is via
// pool-access.ts -> proxy.ts.)

const g = globalThis as typeof globalThis & {
  __supabaseServiceClient?: SupabaseClient;
};

export function getSupabaseServiceClient() {
  if (g.__supabaseServiceClient) return g.__supabaseServiceClient;

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  // NEXT_PUBLIC_ fallback kept for now (unconfirmed whether prod has the
  // non-public var set) — safe here specifically because this module is no
  // longer reachable from any client bundle, so the value is never inlined
  // into browser JS regardless of which env var supplies it.
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY;

  if (!supabaseUrl) {
    throw new Error('Supabase URL is required. Please set SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL in your environment variables.');
  }

  if (!supabaseServiceKey) {
    throw new Error('Supabase service role key is required for server operations. Please set SUPABASE_SERVICE_ROLE_KEY in your environment variables.');
  }

  g.__supabaseServiceClient = createClient(supabaseUrl, supabaseServiceKey);
  return g.__supabaseServiceClient;
}
