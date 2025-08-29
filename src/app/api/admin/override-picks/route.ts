import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      poolId,
      participantId,
      week,
      seasonType,
      overrideMode,
      overrideReason,
      pickUpdates,
      adminId
    } = body;

    // Validate required fields
    if (!poolId || !participantId || !week || !seasonType || !overrideMode || !overrideReason || !adminId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    if (overrideMode === 'picks') {
      // Update specific picks
      if (!pickUpdates || Object.keys(pickUpdates).length === 0) {
        return NextResponse.json(
          { success: false, error: 'No picks to update' },
          { status: 400 }
        );
      }

      const updates = Object.entries(pickUpdates).map(([pickId, update]: [string, any]) => ({
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
          console.error('Error updating pick:', updateError);
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

      // Get admin info to determine admin type
      const admin = await supabase
        .from('admins')
        .select('is_super_admin')
        .eq('id', adminId)
        .single();

      const auditDetails = {
        pool_name: pool?.data?.name || 'Unknown Pool',
        participant_name: participant?.data?.name || 'Unknown Participant',
        participant_email: participant?.data?.email || 'Unknown Email',
        week,
        season_type: seasonType,
        override_reason: overrideReason,
        override_type: 'specific_picks',
        overridden_by: admin?.data?.is_super_admin ? 'super_admin' : 'pool_admin',
        overridden_at: new Date().toISOString(),
        updated_picks: updates.map(update => ({
          pick_id: update.id,
          new_winner: update.winner,
          new_confidence: update.confidence
        }))
      };

      await supabase
        .from('audit_logs')
        .insert({
          action: 'override_pool_picks',
          admin_id: adminId,
          pool_id: poolId,
          details: JSON.stringify(auditDetails),
          created_at: new Date().toISOString()
        });

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
        console.error('Error selecting picks to delete:', selectError);
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
        console.error('Error deleting picks:', deleteError);
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

      // Get admin info to determine admin type
      const admin = await supabase
        .from('admins')
        .select('is_super_admin')
        .eq('id', adminId)
        .single();

      const auditDetails = {
        pool_name: pool?.data?.name || 'Unknown Pool',
        participant_name: participant?.data?.name || 'Unknown Participant',
        participant_email: participant?.data?.email || 'Unknown Email',
        week,
        season_type: seasonType,
        override_reason: overrideReason,
        override_type: 'erase_all_picks',
        overridden_by: admin?.data?.is_super_admin ? 'super_admin' : 'pool_admin',
        overridden_at: new Date().toISOString(),
        erased_picks_count: picksToDelete?.length || 0
      };

      await supabase
        .from('audit_logs')
        .insert({
          action: 'erase_all_picks',
          admin_id: adminId,
          pool_id: poolId,
          details: JSON.stringify(auditDetails),
          created_at: new Date().toISOString()
        });

      return NextResponse.json({
        success: true,
        message: `All ${picksToDelete?.length || 0} picks have been successfully erased.`,
        erased: true,
        erasedCount: picksToDelete?.length || 0
      });

    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid override mode' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Error in override-picks API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
