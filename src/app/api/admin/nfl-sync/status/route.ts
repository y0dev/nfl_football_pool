import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { requireSuperAdmin } from '@/lib/accounts';

// Persisted sync history (Step 14) — replaces the old page's
// localStorage-only history, which was per-browser and lost on clearing
// storage. Shows the most recent run and the most recent successfully
// *applied* run separately, since a failed/pending run shouldn't read as
// "last sync" for someone checking data freshness.
export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) return auth.response;

  const supabase = getSupabaseServiceClient();

  const { data: lastRun } = await supabase
    .from('nfl_sync_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: lastAppliedRun } = await supabase
    .from('nfl_sync_runs')
    .select('*')
    .eq('status', 'applied')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: pendingRuns } = await supabase
    .from('nfl_sync_runs')
    .select('id, created_at, season, season_type, week, new_count, updated_count, unchanged_count')
    .eq('status', 'pending_review')
    .order('created_at', { ascending: false });

  return NextResponse.json({
    success: true,
    lastRun: lastRun ?? null,
    lastSuccessfulRun: lastAppliedRun ?? null,
    pendingRuns: pendingRuns ?? [],
  });
}
