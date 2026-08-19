import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { requireSuperAdmin } from '@/lib/accounts';
import { nflAPI } from '@/lib/nfl-api';
import { buildSyncPreview, type DbGameRow } from '@/lib/nfl-sync';
import { mapEspnEventsToGames, type ESPNScoreboardEvent } from '@/lib/espn-scoreboard';
import { debugError } from '@/lib/utils';

// Manual NFL Data Sync — step 1 of 2 (preview -> apply). Fetches from ESPN,
// diffs against the existing `games` rows for exactly the games returned
// (matched by external id, never home+away+date), and PERSISTS the
// proposal — it never writes to `games` itself. See
// src/app/api/admin/nfl-sync/apply/route.ts for the write step, and
// src/lib/nfl-sync.ts for the diff logic.
//
// `espnEvents`: raw ESPN scoreboard events, when the CLIENT already fetched
// them directly (see src/lib/espn-scoreboard.ts's header comment — ESPN's
// CDN hard-blocks Vercel's server IPs, but allows direct browser requests).
// When present, this skips the server's own ESPN fetch entirely and just
// maps + diffs what the browser already retrieved. Omitting it falls back
// to the server fetching ESPN itself — unchanged behavior for any
// environment where that isn't blocked (e.g. local dev).
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) return auth.response;

  const supabase = getSupabaseServiceClient();

  try {
    const body = await request.json().catch(() => ({}));
    const referenceDate: string = body.date || new Date().toISOString();
    // Defaults to a whole-week sync (the only mode this endpoint ever had)
    // so any caller that doesn't send the flag keeps today's behavior.
    const wholeWeek: boolean = body.wholeWeek !== false;
    const clientEspnEvents: ESPNScoreboardEvent[] | undefined = Array.isArray(body.espnEvents) ? body.espnEvents : undefined;

    const incomingGames = clientEspnEvents
      ? mapEspnEventsToGames(clientEspnEvents)
      : wholeWeek
        ? await nflAPI.getGamesForWeekContaining(referenceDate)
        : await nflAPI.getGamesForDayContaining(referenceDate);

    if (incomingGames.length === 0) {
      return NextResponse.json({
        success: true,
        runId: null,
        summary: { gamesChecked: 0, newCount: 0, updatedCount: 0, unchangedCount: 0 },
        changes: [],
        message: `No games found from the NFL data provider for this ${wholeWeek ? 'week' : 'day'}.`,
      });
    }

    const ids = incomingGames.map(g => g.id);
    const { data: existingRows, error: fetchError } = await supabase
      .from('games')
      .select('id, week, season, season_type, home_team, away_team, kickoff_time, home_score, away_score, winner, status, home_team_id, away_team_id')
      .in('id', ids);

    if (fetchError) throw new Error(fetchError.message);

    const { changes, summary } = buildSyncPreview(incomingGames, (existingRows ?? []) as DbGameRow[]);

    const first = incomingGames[0];
    const { data: run, error: runError } = await supabase
      .from('nfl_sync_runs')
      .insert({
        requested_by: auth.email,
        season: first.season,
        season_type: first.season_type,
        week: first.week,
        status: changes.length === 0 ? 'applied' : 'pending_review',
        games_checked: summary.gamesChecked,
        new_count: summary.newCount,
        updated_count: summary.updatedCount,
        unchanged_count: summary.unchangedCount,
        applied_count: 0,
        rejected_count: 0,
        reviewed_at: changes.length === 0 ? new Date().toISOString() : null,
        reviewed_by: changes.length === 0 ? auth.email : null,
      })
      .select('id')
      .single();

    if (runError || !run) throw new Error(runError?.message ?? 'Failed to create sync run');

    let insertedChanges: { id: string; external_game_id: string; change_type: string; field_diffs: unknown }[] = [];
    if (changes.length > 0) {
      const { data, error: changesError } = await supabase
        .from('nfl_sync_proposed_changes')
        .insert(changes.map(c => ({
          sync_run_id: run.id,
          external_game_id: c.externalGameId,
          change_type: c.changeType,
          field_diffs: c.fieldDiffs,
          proposed_payload: c.proposedPayload,
          base_snapshot: c.baseSnapshot,
        })))
        .select('id, external_game_id, change_type, field_diffs');

      if (changesError) throw new Error(changesError.message);
      insertedChanges = data ?? [];
    }

    // Merge DB-generated change ids back with the display data (team names,
    // summary lines) the client needs but the table doesn't store redundantly.
    const changesById = new Map(changes.map(c => [c.externalGameId, c]));
    const responseChanges = insertedChanges.map(row => {
      const source = changesById.get(row.external_game_id)!;
      return {
        id: row.id,
        externalGameId: row.external_game_id,
        changeType: row.change_type,
        fieldDiffs: row.field_diffs,
        summaryLines: source.summaryLines,
        homeTeam: source.proposedPayload.home_team,
        awayTeam: source.proposedPayload.away_team,
        week: source.proposedPayload.week,
        season: source.proposedPayload.season,
        seasonType: source.proposedPayload.season_type,
      };
    });

    return NextResponse.json({ success: true, runId: run.id, summary, changes: responseChanges });
  } catch (error) {
    debugError('NFL sync preview error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unable to retrieve NFL data. No database changes were made.',
    }, { status: 500 });
  }
}
