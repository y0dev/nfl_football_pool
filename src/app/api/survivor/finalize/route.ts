import { NextRequest, NextResponse } from 'next/server';
import { finalizeSurvivorSeason } from '@/lib/survivor';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
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
    const callerEmail = request.headers.get('x-admin-email');
    if (!callerEmail) {
      return NextResponse.json({ success: false, error: 'No admin email header' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { poolId } = body as { poolId?: string };
    if (!poolId) {
      return NextResponse.json({ success: false, error: 'poolId is required' }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();
    const [{ data: pool }, { data: caller }] = await Promise.all([
      supabase.from('pools').select('created_by').eq('id', poolId).maybeSingle(),
      supabase.from('admins').select('is_super_admin').eq('email', callerEmail).eq('is_active', true).maybeSingle(),
    ]);
    if (!pool) {
      return NextResponse.json({ success: false, error: 'Pool not found' }, { status: 404 });
    }
    const isOwner = pool.created_by === callerEmail;
    const isSuperAdmin = caller?.is_super_admin === true;
    if (!isOwner && !isSuperAdmin) {
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
