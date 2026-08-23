import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { emailService } from '@/lib/email';
import { computeSurvivorPoolState } from '@/lib/survivor';
import { debugError } from '@/lib/utils';

// Sends the "you're still alive" / "you've been eliminated" email to every
// participant whose pick for the given week is now resolved (win/loss/tie
// — never for a still-pending pick, matching computeSurvivorPoolState()'s
// own rule of not evaluating a game with no final score yet). Commissioner
// -triggered, same manual pattern as /api/admin/send-reminders — no
// automatic cron, since Survivor has none by design (see src/lib/survivor.ts).
export async function POST(request: NextRequest) {
  try {
    const callerEmail = request.headers.get('x-admin-email');
    if (!callerEmail) {
      return NextResponse.json({ success: false, error: 'No admin email header' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { poolId, week: bodyWeek, seasonType: bodySeasonType } = body as { poolId?: string; week?: number; seasonType?: number };
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

    // week/seasonType are optional — the commissioner overview's "Notify
    // Week Results" button always wants "whatever most recently finished",
    // not a specific week, so default to the most recent (season_type,
    // week) with at least one resolved (non-pending) pick anywhere in the
    // pool, rather than requiring the caller to know it.
    let week = bodyWeek;
    let seasonType = bodySeasonType;
    if (!week || !seasonType) {
      let mostRecent: { week: number; seasonType: number } | null = null;
      for (const p of state.participants) {
        for (const pick of p.picks) {
          if (pick.result === 'pending') continue;
          if (!mostRecent || pick.seasonType > mostRecent.seasonType || (pick.seasonType === mostRecent.seasonType && pick.week > mostRecent.week)) {
            mostRecent = { week: pick.week, seasonType: pick.seasonType };
          }
        }
      }
      if (!mostRecent) {
        return NextResponse.json({ success: true, message: 'No resolved week to announce yet.', results: { successful: 0, failed: 0, total: 0 } });
      }
      week = mostRecent.week;
      seasonType = mostRecent.seasonType;
    }

    const { data: participantRows, error: participantsError } = await supabase
      .from('participants')
      .select('id, email')
      .eq('pool_id', poolId)
      .eq('is_active', true);
    if (participantsError) return NextResponse.json({ success: false, error: participantsError.message }, { status: 500 });

    const emailById = new Map((participantRows ?? []).map(p => [p.id, p.email]));
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const poolLink = `${baseUrl}/pool/${poolId}/leaderboard`;

    const targets = state.participants
      .map(p => ({ p, pick: p.picks.find(pick => pick.week === week && pick.seasonType === seasonType) }))
      .filter((t): t is { p: typeof state.participants[number]; pick: NonNullable<typeof t.pick> } => !!t.pick && t.pick.result !== 'pending')
      .filter(t => !!emailById.get(t.p.participantId));

    const results = await Promise.all(
      targets.map(async ({ p, pick }) => {
        const email = emailById.get(p.participantId)!;
        try {
          const sent = p.eliminatedWeek === week && p.eliminatedSeasonType === seasonType
            ? await emailService.sendSurvivorWeekResult(email, p.participantName, pool.name, week, poolLink, {
                alive: false,
                selectedTeam: p.eliminatedTeamName ?? pick.selectedTeamName,
                reason: p.eliminatedReason ?? (pick.result === 'tie' ? 'tie' : 'loss'),
              })
            : await emailService.sendSurvivorWeekResult(email, p.participantName, pool.name, week, poolLink, {
                alive: true,
                selectedTeam: pick.selectedTeamName,
              });
          return { success: sent };
        } catch (error) {
          debugError(`Survivor result email failed for ${email}:`, error);
          return { success: false };
        }
      })
    );

    const successful = results.filter(r => r.success).length;
    return NextResponse.json({
      success: true,
      message: `Sent ${successful} result email${successful !== 1 ? 's' : ''} for Week ${week}`,
      results: { successful, failed: results.length - successful, total: results.length },
    });
  } catch (error) {
    debugError('Error sending Survivor week-result emails:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
