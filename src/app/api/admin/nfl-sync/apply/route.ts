import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { requireSuperAdmin } from '@/lib/accounts';
import { isChangeStale, type DbGameRow } from '@/lib/nfl-sync';
import { debugError } from '@/lib/utils';

interface ProposedChangeRow {
  id: string;
  sync_run_id: string;
  external_game_id: string;
  change_type: 'new' | 'updated';
  proposed_payload: Record<string, unknown>;
  base_snapshot: Record<string, unknown> | null;
  decision: string;
}

// Manual NFL Data Sync — step 2 of 2 (preview -> apply). Verifies the
// caller is Super Admin, re-verifies each approved change's base_snapshot
// still matches the CURRENT `games` row before writing anything (stale
// approvals — see src/lib/nfl-sync.ts's isChangeStale — are skipped, not
// silently overwritten), applies only approved+non-stale changes, and
// audit-logs the outcome. Rejected/undecided changes are never written.
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) return auth.response;

  const supabase = getSupabaseServiceClient();

  try {
    const body = await request.json().catch(() => ({}));
    const { runId, decisions, approveAll, rejectAll } = body as {
      runId?: string;
      decisions?: Record<string, 'approved' | 'rejected'>;
      approveAll?: boolean;
      rejectAll?: boolean;
    };

    if (!runId) {
      return NextResponse.json({ success: false, error: 'runId is required' }, { status: 400 });
    }

    const { data: run, error: runFetchError } = await supabase
      .from('nfl_sync_runs')
      .select('*')
      .eq('id', runId)
      .single();

    if (runFetchError || !run) {
      return NextResponse.json({ success: false, error: 'Sync run not found' }, { status: 404 });
    }

    if (run.status !== 'pending_review') {
      return NextResponse.json({
        success: false,
        error: `This sync run was already ${run.status} — re-run a preview to review current data.`,
      }, { status: 409 });
    }

    const { data: proposedChanges, error: changesError } = await supabase
      .from('nfl_sync_proposed_changes')
      .select('*')
      .eq('sync_run_id', runId)
      .eq('decision', 'pending');

    if (changesError) throw new Error(changesError.message);

    const rows = (proposedChanges ?? []) as ProposedChangeRow[];

    const approvedIds = new Set(
      approveAll
        ? rows.map(r => r.id)
        : Object.entries(decisions ?? {}).filter(([, d]) => d === 'approved').map(([id]) => id)
    );
    if (rejectAll) approvedIds.clear();

    let appliedCount = 0;
    let rejectedCount = 0;
    let staleCount = 0;
    const staleChanges: string[] = [];

    for (const change of rows) {
      if (!approvedIds.has(change.id)) {
        await supabase.from('nfl_sync_proposed_changes').update({ decision: 'rejected', decided_at: new Date().toISOString() }).eq('id', change.id);
        rejectedCount++;
        continue;
      }

      const { data: currentRow } = await supabase
        .from('games')
        .select('id, week, season, season_type, home_team, away_team, kickoff_time, home_score, away_score, winner, status, home_team_id, away_team_id')
        .eq('id', change.external_game_id)
        .maybeSingle();

      if (isChangeStale(
        { changeType: change.change_type, baseSnapshot: change.base_snapshot },
        (currentRow as DbGameRow | null) ?? null
      )) {
        await supabase.from('nfl_sync_proposed_changes').update({ decision: 'stale', decided_at: new Date().toISOString() }).eq('id', change.id);
        staleCount++;
        staleChanges.push(change.external_game_id);
        continue;
      }

      const { error: upsertError } = await supabase
        .from('games')
        .upsert({ ...change.proposed_payload, updated_at: new Date().toISOString() }, { onConflict: 'id', ignoreDuplicates: false });

      if (upsertError) {
        debugError(`Failed to apply sync change for game ${change.external_game_id}:`, upsertError.message);
        await supabase.from('nfl_sync_proposed_changes').update({ decision: 'stale', decided_at: new Date().toISOString() }).eq('id', change.id);
        staleCount++;
        staleChanges.push(change.external_game_id);
        continue;
      }

      await supabase.from('nfl_sync_proposed_changes').update({ decision: 'applied', decided_at: new Date().toISOString() }).eq('id', change.id);
      appliedCount++;
    }

    const now = new Date().toISOString();
    await supabase
      .from('nfl_sync_runs')
      .update({
        status: 'applied',
        applied_count: run.applied_count + appliedCount,
        rejected_count: run.rejected_count + rejectedCount,
        stale_count: staleCount,
        reviewed_at: now,
        reviewed_by: auth.email,
      })
      .eq('id', runId);

    await supabase.from('audit_logs').insert({
      action: 'nfl_sync_apply',
      admin_id: auth.id,
      entity: 'nfl_sync_run',
      entity_id: runId,
      details: { requested_by: auth.email, appliedCount, rejectedCount, staleCount },
    });

    return NextResponse.json({
      success: true,
      appliedCount,
      rejectedCount,
      staleCount,
      staleChanges,
      message: staleCount > 0
        ? `${appliedCount} change(s) applied. ${staleCount} change(s) were stale (the database changed since this preview was generated) and were not applied — run a new preview to review them again.`
        : `${appliedCount} change(s) applied.`,
    });
  } catch (error) {
    debugError('NFL sync apply error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to apply sync changes',
    }, { status: 500 });
  }
}
