import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { findAccountByEmail } from '@/lib/accounts';
import { debugError } from '@/lib/utils';

// Server-only replacement for pool-picks-content.tsx's direct client-side
// delete-picks-and-audit-log call, which required shipping the Supabase
// service role key to the browser AND only checked permission via
// client-held React state (trivially bypassable once that key was
// extracted). Ownership/super-admin is verified here from the DB.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: poolId } = await params;
    const adminEmail = request.headers.get('x-admin-email');
    if (!adminEmail) {
      return NextResponse.json({ success: false, error: 'No admin email header' }, { status: 401 });
    }

    const { participantId, gameIds } = await request.json();
    if (!participantId || !Array.isArray(gameIds) || gameIds.length === 0) {
      return NextResponse.json({ success: false, error: 'participantId and gameIds are required' }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();
    const { data: pool } = await supabase.from('pools').select('created_by').eq('id', poolId).maybeSingle();
    if (!pool) {
      return NextResponse.json({ success: false, error: 'Pool not found' }, { status: 404 });
    }

    const account = await findAccountByEmail(adminEmail, { activeOnly: true });
    const isSuperAdmin = account?.role === 'super_admin';
    const isOwner = pool.created_by === adminEmail;
    if (!isSuperAdmin && !isOwner) {
      return NextResponse.json({ success: false, error: 'Only this pool\'s commissioner or a super admin can unlock picks' }, { status: 403 });
    }

    const { error } = await supabase
      .from('picks')
      .delete()
      .eq('participant_id', participantId)
      .eq('pool_id', poolId)
      .in('game_id', gameIds);

    if (error) throw error;

    await supabase.from('audit_logs').insert({
      action: 'unlock_participant_picks',
      admin_id: null,
      entity: 'participant_picks',
      entity_id: participantId,
      details: {
        participant_id: participantId, pool_id: poolId, game_ids: gameIds,
        unlocked_by: isSuperAdmin ? 'admin' : 'pool_commissioner',
        unlocked_by_email: adminEmail,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    debugError('Unlock picks error:', error);
    return NextResponse.json({ success: false, error: 'Failed to unlock picks' }, { status: 500 });
  }
}
