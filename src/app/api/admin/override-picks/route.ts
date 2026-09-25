import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { requireActiveAdmin } from '@/lib/accounts';
import { getOverrideEligibility } from '@/lib/season-status';
import { debugError } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireActiveAdmin(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const {
      poolId,
      participantId,
      week,
      seasonType,
      overrideMode,
      overrideReason,
      pickUpdates,
      gameId,
      predictedWinner,
      confidencePoints,
      weekPicks,
      clearGameIds,
      reduceConfidence,
    } = body;
    // The caller's own verified id/role — never the client-supplied adminId
    // this route previously trusted for both authorization and the audit
    // trail (there was no authorization check here at all before this fix).
    const adminId = auth.id;

    // Validate required fields
    if (!poolId || !participantId || !week || !seasonType || !overrideMode || !overrideReason) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();
    const { data: pool } = await supabase.from('pools').select('created_by').eq('id', poolId).maybeSingle();
    if (!pool) {
      return NextResponse.json({ success: false, error: 'Pool not found' }, { status: 404 });
    }
    if (!auth.isSuperAdmin && pool.created_by !== auth.email) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const eligibility = await getOverrideEligibility(poolId, week, seasonType);
    if (!eligibility.allowed) {
      return NextResponse.json(
        { success: false, error: eligibility.reason },
        { status: 403 }
      );
    }

    if (overrideMode === 'insert') {
      if (!gameId || !predictedWinner || !confidencePoints) {
        return NextResponse.json(
          { success: false, error: 'Missing required fields' },
          { status: 400 }
        );
      }

      const { error: insertError } = await supabase
        .from('picks')
        .insert({
          participant_id: participantId,
          pool_id: poolId,
          game_id: gameId,
          predicted_winner: predictedWinner,
          confidence_points: confidencePoints,
          submitted_by: 'admin_override',
        });

      if (insertError) {
        debugError('Error inserting pick:', insertError);
        return NextResponse.json(
          { success: false, error: `Failed to submit pick: ${insertError.message}` },
          { status: 500 }
        );
      }

      const participant = await supabase
        .from('participants')
        .select('name, email')
        .eq('id', participantId)
        .single();

      const pool = await supabase
        .from('pools')
        .select('name')
        .eq('id', poolId)
        .single();

      const auditDetails = {
        pool_name: pool?.data?.name || 'Unknown Pool',
        participant_name: participant?.data?.name || 'Unknown Participant',
        participant_email: participant?.data?.email || 'Unknown Email',
        week,
        season_type: seasonType,
        override_reason: overrideReason,
        override_type: 'insert_pick',
        overridden_by: auth.isSuperAdmin ? 'super_admin' : 'pool_admin',
        overridden_at: new Date().toISOString(),
        game_id: gameId,
        predicted_winner: predictedWinner,
        confidence_points: confidencePoints,
      };

      const { error: auditError } = await supabase
        .from('audit_logs')
        .insert({
          action: 'insert_pick',
          admin_id: adminId,
          entity: 'pool',
          entity_id: poolId,
          details: auditDetails,
          created_at: new Date().toISOString()
        });
      if (auditError) debugError('Error writing audit log for insert_pick:', auditError);

      return NextResponse.json({
        success: true,
        message: 'Pick submitted successfully',
      });

    } else if (overrideMode === 'picks') {
      // Update specific picks
      if (!pickUpdates || Object.keys(pickUpdates).length === 0) {
        return NextResponse.json(
          { success: false, error: 'No picks to update' },
          { status: 400 }
        );
      }

      const updates = Object.entries(pickUpdates as Record<string, { winner?: string; confidence?: number }>).map(([pickId, update]) => ({
        id: pickId,
        winner: update.winner,
        confidence: update.confidence
      }));
      
      for (const update of updates) {
        const { error: updateError } = await supabase
          .from('picks')
          .update({
            predicted_winner: update.winner,
            confidence_points: update.confidence,
            updated_at: new Date().toISOString()
          })
          .eq('id', update.id);
        
        if (updateError) {
          debugError('Error updating pick:', updateError);
          return NextResponse.json(
            { success: false, error: `Failed to update pick: ${updateError.message}` },
            { status: 500 }
          );
        }
      }

      // Log the override action
      const participant = await supabase
        .from('participants')
        .select('name, email')
        .eq('id', participantId)
        .single();

      const pool = await supabase
        .from('pools')
        .select('name')
        .eq('id', poolId)
        .single();

      // Caller could be either a super-admin or a commissioner (pool owner)
      const auditDetails = {
        pool_name: pool?.data?.name || 'Unknown Pool',
        participant_name: participant?.data?.name || 'Unknown Participant',
        participant_email: participant?.data?.email || 'Unknown Email',
        week,
        season_type: seasonType,
        override_reason: overrideReason,
        override_type: 'specific_picks',
        overridden_by: auth.isSuperAdmin ? 'super_admin' : 'pool_admin',
        overridden_at: new Date().toISOString(),
        updated_picks: updates.map(update => ({
          pick_id: update.id,
          new_winner: update.winner,
          new_confidence: update.confidence
        }))
      };

      const { error: auditError } = await supabase
        .from('audit_logs')
        .insert({
          action: 'override_pool_picks',
          admin_id: adminId,
          entity: 'pool',
          entity_id: poolId,
          details: auditDetails,
          created_at: new Date().toISOString()
        });
      if (auditError) debugError('Error writing audit log for override_pool_picks:', auditError);

      return NextResponse.json({
        success: true,
        message: `${updates.length} pick${updates.length !== 1 ? 's' : ''} have been successfully updated.`,
        updatedCount: updates.length
      });

    } else if (overrideMode === 'erase_all') {
      // First get the picks to delete to know the count for audit logging
      const { data: picksToDelete, error: selectError } = await supabase
        .from('picks')
        .select('id, games!inner(week, season_type)')
        .eq('pool_id', poolId)
        .eq('participant_id', participantId)
        .eq('games.week', week)
        .eq('games.season_type', seasonType);

      if (selectError) {
        debugError('Error selecting picks to delete:', selectError);
        return NextResponse.json(
          { success: false, error: `Failed to select picks to delete: ${selectError.message}` },
          { status: 500 }
        );
      }

      // Delete the picks
      const { error: deleteError } = await supabase
        .from('picks')
        .delete()
        .in('id', picksToDelete.map(pick => pick.id));

      if (deleteError) {
        debugError('Error deleting picks:', deleteError);
        return NextResponse.json(
          { success: false, error: `Failed to delete picks: ${deleteError.message}` },
          { status: 500 }
        );
      }

      // Log the erase all action
      const participant = await supabase
        .from('participants')
        .select('name, email')
        .eq('id', participantId)
        .single();

      const pool = await supabase
        .from('pools')
        .select('name')
        .eq('id', poolId)
        .single();

      // Caller could be either a super-admin or a commissioner (pool owner)
      const auditDetails = {
        pool_name: pool?.data?.name || 'Unknown Pool',
        participant_name: participant?.data?.name || 'Unknown Participant',
        participant_email: participant?.data?.email || 'Unknown Email',
        week,
        season_type: seasonType,
        override_reason: overrideReason,
        override_type: 'erase_all_picks',
        overridden_by: auth.isSuperAdmin ? 'super_admin' : 'pool_admin',
        overridden_at: new Date().toISOString(),
        erased_picks_count: picksToDelete?.length || 0
      };

      const { error: auditError } = await supabase
        .from('audit_logs')
        .insert({
          action: 'erase_all_picks',
          admin_id: adminId,
          entity: 'pool',
          entity_id: poolId,
          details: auditDetails,
          created_at: new Date().toISOString()
        });
      if (auditError) debugError('Error writing audit log for erase_all_picks:', auditError);

      return NextResponse.json({
        success: true,
        message: `All ${picksToDelete?.length || 0} picks have been successfully erased.`,
        erased: true,
        erasedCount: picksToDelete?.length || 0
      });

    } else if (overrideMode === 'week') {
      // Bulk set/clear a participant's picks for an entire week in one call
      // — backs the dedicated override-picks page (replaces the old
      // Add/Override Pick modal, whose Select dropdown rendered behind the
      // Dialog overlay). weekPicks covers every game the admin filled in
      // (insert or update); clearGameIds covers games the admin explicitly
      // blanked back out (delete).
      if (!Array.isArray(weekPicks)) {
        return NextResponse.json(
          { success: false, error: 'picks array is required' },
          { status: 400 }
        );
      }

      for (const p of weekPicks) {
        if (!p || typeof p.gameId !== 'string' || typeof p.predictedWinner !== 'string' || typeof p.confidencePoints !== 'number') {
          return NextResponse.json(
            { success: false, error: 'Each pick needs a gameId, predictedWinner, and confidencePoints' },
            { status: 400 }
          );
        }
      }

      // 0 means "missed this game" (the client only sends it for a
      // started game the participant had no pick in for, once the
      // reduce-confidence option is on) — multiple picks may share it;
      // only the real 1..N ranked values must be unique.
      const points = weekPicks.map((p: { confidencePoints: number }) => p.confidencePoints).filter((p: number) => p !== 0);
      if (new Set(points).size !== points.length) {
        return NextResponse.json(
          { success: false, error: 'Confidence points must be unique' },
          { status: 400 }
        );
      }

      if (Array.isArray(clearGameIds) && clearGameIds.length > 0) {
        const { error: clearError } = await supabase
          .from('picks')
          .delete()
          .eq('pool_id', poolId)
          .eq('participant_id', participantId)
          .in('game_id', clearGameIds);

        if (clearError) {
          debugError('Error clearing picks:', clearError);
          return NextResponse.json(
            { success: false, error: `Failed to clear picks: ${clearError.message}` },
            { status: 500 }
          );
        }
      }

      if (weekPicks.length > 0) {
        const { error: upsertError } = await supabase
          .from('picks')
          .upsert(
            weekPicks.map((p: { gameId: string; predictedWinner: string; confidencePoints: number }) => ({
              participant_id: participantId,
              pool_id: poolId,
              game_id: p.gameId,
              predicted_winner: p.predictedWinner,
              confidence_points: p.confidencePoints,
              submitted_by: 'admin_override',
              updated_at: new Date().toISOString(),
            })),
            { onConflict: 'participant_id,pool_id,game_id' }
          );

        if (upsertError) {
          debugError('Error upserting week picks:', upsertError);
          return NextResponse.json(
            { success: false, error: `Failed to save picks: ${upsertError.message}` },
            { status: 500 }
          );
        }
      }

      const participant = await supabase
        .from('participants')
        .select('name, email')
        .eq('id', participantId)
        .single();

      const poolRow = await supabase
        .from('pools')
        .select('name')
        .eq('id', poolId)
        .single();

      const auditDetails = {
        pool_name: poolRow?.data?.name || 'Unknown Pool',
        participant_name: participant?.data?.name || 'Unknown Participant',
        participant_email: participant?.data?.email || 'Unknown Email',
        week,
        season_type: seasonType,
        override_reason: overrideReason,
        override_type: 'week_picks',
        overridden_by: auth.isSuperAdmin ? 'super_admin' : 'pool_admin',
        overridden_at: new Date().toISOString(),
        reduce_confidence: !!reduceConfidence,
        set_picks: weekPicks.map((p: { gameId: string; predictedWinner: string; confidencePoints: number }) => ({
          game_id: p.gameId,
          predicted_winner: p.predictedWinner,
          confidence_points: p.confidencePoints,
        })),
        cleared_game_ids: clearGameIds ?? [],
      };

      const { error: auditError } = await supabase
        .from('audit_logs')
        .insert({
          action: 'override_week_picks',
          admin_id: adminId,
          entity: 'pool',
          entity_id: poolId,
          details: auditDetails,
          created_at: new Date().toISOString()
        });
      if (auditError) debugError('Error writing audit log for override_week_picks:', auditError);

      return NextResponse.json({
        success: true,
        message: `Saved ${weekPicks.length} pick${weekPicks.length !== 1 ? 's' : ''}${clearGameIds?.length ? `, cleared ${clearGameIds.length}` : ''}.`,
      });

    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid override mode' },
        { status: 400 }
      );
    }

  } catch (error) {
    debugError('Error in override-picks API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
