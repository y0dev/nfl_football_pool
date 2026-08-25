import { NextRequest, NextResponse } from 'next/server';
import { finalizeSurvivorSeason } from '@/lib/survivor';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { requireActiveAdmin } from '@/lib/accounts';
import { debugError } from '@/lib/utils';

// Survivor's equivalent of Confidence Pool's close-season winner
// determination — the ONLY place a Survivor pool's WINNER status gets
// assigned. See finalizeSurvivorSeason()'s own header comment
// (src/lib/survivor.ts) for why this is a deliberate, explicit action
// rather than something inferred automatically as soon as one participant
// is left standing.
//
// Caller must be either the pool's own commissioner or a super admin —
// deliberately NOT reusing requireSuperAdmin(), which would lock a regular
// commissioner out of finalizing their own pool.
export async function POST(request: NextRequest) {
  try {
    const auth = await requireActiveAdmin(request);
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => ({}));
    const { poolId } = body as { poolId?: string };
    if (!poolId) {
      return NextResponse.json({ success: false, error: 'poolId is required' }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();
    const { data: pool } = await supabase.from('pools').select('created_by').eq('id', poolId).maybeSingle();
    if (!pool) {
      return NextResponse.json({ success: false, error: 'Pool not found' }, { status: 404 });
    }
    const isOwner = pool.created_by === auth.email;
    if (!isOwner && !auth.isSuperAdmin) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const result = await finalizeSurvivorSeason(poolId);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, winnerParticipantIds: result.winnerParticipantIds, resolution: result.resolution });
  } catch (error) {
    debugError('Survivor finalize error:', error);
    return NextResponse.json({ success: false, error: 'Failed to finalize Survivor season.' }, { status: 500 });
  }
}
