import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { requireSuperAdmin } from '@/lib/accounts';
import { debugError, debugLog } from '@/lib/utils';
import { nflAPI } from '@/lib/nfl-api';

// Team win/loss records only. Game schedule/score sync used to happen here
// too via an immediate upsert with no review step — that's now
// src/app/api/admin/nfl-sync/{preview,apply}/route.ts (fetch -> diff ->
// persist -> Super Admin approves -> write). Team records are lower-stakes
// (never affect picks/scoring) and stay an automatic/safe operation per the
// audit's Step 4 allowance, so they're left as a direct write here.
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const supabase = getSupabaseServiceClient();

    let requestBody;
    try {
      requestBody = await request.json();
    } catch {
      requestBody = {};
    }

    const timestamp = requestBody.timestamp || new Date().toISOString();
    const season = new Date(timestamp).getFullYear();

    const teamRecordsUpdated = await updateTeamRecords(supabase, season);
    debugLog(`✅ Team records updated successfully for season ${season}: ${teamRecordsUpdated} records`);

    return NextResponse.json({
      success: true,
      message: `Team records sync completed: ${teamRecordsUpdated} records`,
      teamRecordsUpdated,
      season,
    });
  } catch (error) {
    debugError('❌ Team records sync error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Function to update team records from ESPN API team endpoints
async function updateTeamRecords(supabase: ReturnType<typeof getSupabaseServiceClient>, season: number) {
  try {
    if (!season) {
      debugLog('⚠️ No season provided, skipping team records update');
      return 0;
    }

    debugLog(`📊 Fetching team records from ESPN API for season ${season}`);

    // Get all team IDs from ESPN API
    const teamIds = await nflAPI.getAllTeamIds();
    debugLog(`📋 Found ${teamIds.length} team IDs from ESPN API`);

    if (teamIds.length === 0) {
      debugLog('⚠️ No team IDs found, skipping team records update');
      return 0;
    }

    // Get all teams for this season to map ESPN team IDs to database UUIDs
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, name, abbreviation')
      .eq('season', season)
      .eq('is_active', true);

    if (teamsError) {
      debugError('❌ Error fetching teams:', teamsError);
      return 0;
    }

    // Create a map of ESPN team ID to database team UUID
    // Try to match by espn_id first, then by abbreviation
    const teamMap = new Map<string, string>();
    teams?.forEach((team: { name: string; abbreviation: string; id: string }) => {
      // Also map by abbreviation for fallback
      teamMap.set(team.abbreviation.toLowerCase(), team.id);
    });
    debugLog('teamMap', teamMap);

    // Fetch team records from ESPN API
    const teamRecordsMap = new Map<string, {
      team_id: string;
      wins: number;
      losses: number;
      ties: number;
      home_wins?: number;
      home_losses?: number;
      home_ties?: number;
      road_wins?: number;
      road_losses?: number;
      road_ties?: number;
    }>();

    // Fetch records for each team (with rate limiting)
    for (let i = 0; i < teamIds.length; i++) {
      const espnTeamId = teamIds[i];

      try {
        const teamRecord = await nflAPI.getTeamRecord(espnTeamId);

        if (teamRecord) {
          // Try to find database team UUID
          const dbTeamId = teamMap.get(espnTeamId) || teamMap.get(teamRecord.abbreviation.toLowerCase());

          if (dbTeamId) {
            teamRecordsMap.set(dbTeamId, {
              team_id: dbTeamId,
              wins: teamRecord.wins || 0,
              losses: teamRecord.losses || 0,
              ties: teamRecord.ties || 0,
              home_wins: teamRecord.home_wins,
              home_losses: teamRecord.home_losses,
              home_ties: teamRecord.home_ties,
              road_wins: teamRecord.road_wins,
              road_losses: teamRecord.road_losses,
              road_ties: teamRecord.road_ties
            });
          } else {
            debugLog(`⚠️ Could not find database team for ESPN team ${espnTeamId} (${teamRecord.abbreviation})`);
          }
        }

        // Rate limiting: wait 100ms between requests
        if (i < teamIds.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        debugError(`❌ Error fetching record for team ${espnTeamId}:`, error);
        // Continue with other teams
      }
    }

    debugLog(`✅ Fetched ${teamRecordsMap.size} team records from ESPN API`);

    // Update team_records table
    const recordsToUpsert = Array.from(teamRecordsMap.values()).map((record) => ({
      team_id: record.team_id,
      season: season,
      wins: record.wins,
      losses: record.losses,
      ties: record.ties,
      home_wins: record.home_wins || 0,
      home_losses: record.home_losses || 0,
      home_ties: record.home_ties || 0,
      road_wins: record.road_wins || 0,
      road_losses: record.road_losses || 0,
      road_ties: record.road_ties || 0,
      division_wins: 0, // Division records not available from ESPN
      division_losses: 0,
      division_ties: 0,
      conference_wins: 0, // Not available from ESPN records
      conference_losses: 0,
      conference_ties: 0,
      updated_at: new Date().toISOString()
    }));

    if (recordsToUpsert.length > 0) {
      const { error: upsertError } = await supabase
        .from('team_records')
        .upsert(recordsToUpsert, {
          onConflict: 'team_id,season',
          ignoreDuplicates: false
        });

      if (upsertError) {
        debugError('❌ Error upserting team records:', upsertError);
        return 0;
      } else {
        debugLog(`✅ Updated ${recordsToUpsert.length} team records for season ${season}`);
        return recordsToUpsert.length;
      }
    }
    return 0;
  } catch (error) {
    debugError('❌ Error updating team records:', error);
    throw error;
  }
}
