import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { emailService } from '@/lib/email';
import { computeSurvivorPoolState } from '@/lib/survivor';
import { debugError } from '@/lib/utils';

// Survivor's equivalent of /api/admin/send-reminders — separate route
// (not a branch inside that one) so the existing Confidence reminders flow
// stays untouched. Only reminds participants who are still ACTIVE and
// haven't picked the target week yet — an eliminated participant getting a
// "make your pick" email would be confusing and wrong.
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

    const state = await computeSurvivorPoolState(poolId);
    if (!state.currentWeek) {
      return NextResponse.json({ success: true, message: 'No upcoming week to remind for — the season is complete.', results: { successful: 0, failed: 0, total: 0 } });
    }

    const { data: participantRows, error: participantsError } = await supabase
      .from('participants')
      .select('id, name, email')
      .eq('pool_id', poolId)
      .eq('is_active', true);
    if (participantsError) return NextResponse.json({ success: false, error: participantsError.message }, { status: 500 });

    const { data: weekGame } = await supabase
      .from('games')
      .select('kickoff_time')
      .eq('season', state.season)
      .eq('season_type', state.currentWeek.seasonType)
      .eq('week', state.currentWeek.week)
      .order('kickoff_time')
      .limit(1)
      .maybeSingle();
    const deadline = weekGame?.kickoff_time
      ? new Date(weekGame.kickoff_time).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
      : `Week ${state.currentWeek.week} kickoff`;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const poolLink = `${baseUrl}/pool/${poolId}/picks`;

    const eligible = (participantRows ?? []).filter(p => {
      const pState = state.participants.find(s => s.participantId === p.id);
      if (!pState || pState.status !== 'ACTIVE') return false;
      const hasCurrentWeekPick = pState.picks.some(pick => pick.week === state.currentWeek!.week && pick.seasonType === state.currentWeek!.seasonType);
      return !hasCurrentWeekPick && !!p.email;
    });

    const results = await Promise.all(
      eligible.map(async p => {
        try {
          const sent = await emailService.sendSurvivorPickReminder(p.email!, p.name, pool.name, state.currentWeek!.week, poolLink, deadline);
          return { success: sent };
        } catch (error) {
          debugError(`Survivor reminder failed for ${p.email}:`, error);
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
    debugError('Error sending Survivor reminders:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
