import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { computePickemWeekResult } from '@/lib/pickem';
import { computeSurvivorPoolState } from '@/lib/survivor';
import { debugError } from '@/lib/utils';

// "Has this participant submitted?" means a different query per
// competition_type (Confidence's `picks` table / Pick'em's per-game
// completeness / Survivor's per-week pick) — computed via each type's own
// authoritative service, per this codebase's single-source-of-truth rule,
// never by assuming every pool is Confidence-shaped like this route
// originally did.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const week = parseInt(searchParams.get('week') || '1');
    const seasonType = parseInt(searchParams.get('seasonType') || '2');
    const poolId = searchParams.get('poolId') || 'all';
    const adminEmail = searchParams.get('adminEmail') || '';
    const isSuperAdmin = searchParams.get('isSuperAdmin') === 'true';

    const supabase = getSupabaseServiceClient();

    // Determine which pools to query
    let poolIds: string[] = [];
    if (poolId !== 'all') {
      poolIds = [poolId];
    } else if (!isSuperAdmin && adminEmail) {
      const { data: pools } = await supabase
        .from('pools')
        .select('id')
        .eq('created_by', adminEmail)
        .eq('is_active', true);
      poolIds = pools?.map(p => p.id) || [];
    }

    // Fetch participants
    let participantsQuery = supabase
      .from('participants')
      .select('id, name, email, pool_id, is_active, created_at')
      .eq('is_active', true);

    if (poolIds.length > 0) {
      participantsQuery = participantsQuery.in('pool_id', poolIds);
    }

    const { data: participantsData, error: participantsError } = await participantsQuery;
    if (participantsError) throw participantsError;
    if (!participantsData || participantsData.length === 0) {
      return NextResponse.json({ success: true, participants: [] });
    }

    // Fetch pool names + competition_type
    const uniquePoolIds = [...new Set(participantsData.map(p => p.pool_id))];
    const { data: poolsData } = await supabase
      .from('pools')
      .select('id, name, competition_type')
      .in('id', uniquePoolIds);

    const poolNameMap = new Map(poolsData?.map(p => [p.id, p.name]) || []);
    const poolTypeMap = new Map(poolsData?.map(p => [p.id, p.competition_type]) || []);

    const confidencePoolIds = uniquePoolIds.filter(id => poolTypeMap.get(id) === 'NFL_CONFIDENCE' || poolTypeMap.get(id) === 'NCAA_CONFIDENCE');
    const pickemPoolIds = uniquePoolIds.filter(id => poolTypeMap.get(id) === 'PICKEM');
    const survivorPoolIds = uniquePoolIds.filter(id => poolTypeMap.get(id) === 'SURVIVOR');

    const submittedIds = new Set<string>();

    // Confidence — one bulk query across every Confidence pool, same as before.
    if (confidencePoolIds.length > 0) {
      const { data: games } = await supabase
        .from('games')
        .select('id')
        .eq('week', week)
        .eq('season_type', seasonType);
      const gameIds = games?.map(g => g.id) || [];
      if (gameIds.length > 0) {
        const confidenceParticipantIds = participantsData.filter(p => confidencePoolIds.includes(p.pool_id)).map(p => p.id);
        const { data: picks } = await supabase
          .from('picks')
          .select('participant_id, game_id')
          .in('participant_id', confidenceParticipantIds)
          .in('game_id', gameIds);
        picks?.forEach(pick => submittedIds.add(pick.participant_id));
      }
    }

    // Pick'em — computePickemWeekResult per pool (its own authoritative
    // "isComplete" already accounts for every eligible game this week).
    for (const id of pickemPoolIds) {
      try {
        const result = await computePickemWeekResult(id, week, seasonType);
        result.participants.filter(p => p.isComplete).forEach(p => submittedIds.add(p.participantId));
      } catch (error) {
        debugError(`Reminders participants: Pick'em week result failed for pool ${id}:`, error);
      }
    }

    // Survivor — an eliminated/winner participant can't submit anything
    // further, so they're treated as "not needing a reminder" rather than
    // perpetually "not submitted."
    for (const id of survivorPoolIds) {
      try {
        const state = await computeSurvivorPoolState(id);
        state.participants.forEach(p => {
          const stillNeedsPick = p.status === 'ACTIVE' && !p.picks.some(pick => pick.week === week && pick.seasonType === seasonType);
          if (!stillNeedsPick) submittedIds.add(p.participantId);
        });
      } catch (error) {
        debugError(`Reminders participants: Survivor state failed for pool ${id}:`, error);
      }
    }

    // Build result
    const participants = participantsData.map(p => ({
      id: p.id,
      name: p.name,
      email: p.email,
      pool_id: p.pool_id,
      pool_name: poolNameMap.get(p.pool_id) || 'Unknown Pool',
      is_active: p.is_active,
      created_at: p.created_at,
      has_submitted: submittedIds.has(p.id),
      last_reminder_sent: null,
    }));

    return NextResponse.json({ success: true, participants });
  } catch (error) {
    debugError('Reminders participants error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load participants' }, { status: 500 });
  }
}
