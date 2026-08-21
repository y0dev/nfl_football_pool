import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { emailService } from '@/lib/email';
import { computePickemSeasonSummary, computePickemWeekResult } from '@/lib/pickem';
import { debugError } from '@/lib/utils';

// Pick'em's equivalent of /api/admin/send-reminders and
// /api/survivor/send-reminders — separate route (not a branch inside either)
// so those existing reminder flows stay untouched. Only reminds participants
// who haven't completed every eligible game for the current week yet.
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
      supabase.from('pools').select('created_by, name').eq('id', poolId).maybeSingle(),
      supabase.from('admins').select('is_super_admin').eq('email', callerEmail).eq('is_active', true).maybeSingle(),
    ]);
    if (!pool) return NextResponse.json({ success: false, error: 'Pool not found' }, { status: 404 });
    if (pool.created_by !== callerEmail && caller?.is_super_admin !== true) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const summary = await computePickemSeasonSummary(poolId);
    if (!summary.currentWeek) {
      return NextResponse.json({ success: true, message: 'No upcoming week to remind for — the season is complete.', results: { successful: 0, failed: 0, total: 0 } });
    }

    const weekResult = await computePickemWeekResult(poolId, summary.currentWeek.week, summary.currentWeek.seasonType);

    const { data: participantRows, error: participantsError } = await supabase
      .from('participants')
      .select('id, name, email')
      .eq('pool_id', poolId)
      .eq('is_active', true);
    if (participantsError) return NextResponse.json({ success: false, error: participantsError.message }, { status: 500 });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const poolLink = `${baseUrl}/pool/${poolId}/picks`;

    const eligible = (participantRows ?? []).filter(p => {
      const pState = weekResult.participants.find(s => s.participantId === p.id);
      return !!pState && !pState.isComplete && !!p.email;
    });

    const results = await Promise.all(
      eligible.map(async p => {
        try {
          const pState = weekResult.participants.find(s => s.participantId === p.id)!;
          const remaining = weekResult.eligibleGames.length - pState.picks.filter(pick => pick.selectedTeam).length;
          const sent = await emailService.sendPickemPickReminder(p.email!, p.name, pool.name, weekResult.week, poolLink, remaining);
          return { success: sent };
        } catch (error) {
          debugError(`Pick'em reminder failed for ${p.email}:`, error);
          return { success: false };
        }
      })
    );

    const successful = results.filter(r => r.success).length;
    return NextResponse.json({
      success: true,
      message: `Sent ${successful} reminder${successful !== 1 ? 's' : ''}`,
      results: { successful, failed: results.length - successful, total: results.length },
    });
  } catch (error) {
    debugError("Error sending Pick'em reminders:", error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
