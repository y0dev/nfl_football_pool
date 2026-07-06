import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { emailService } from '@/lib/email';
import { debugError } from '@/lib/utils';
import { getAdminPlansByEmails, planAllowsReminders, REMINDERS_PLAN_MESSAGE } from '@/lib/plan';

export async function POST(request: NextRequest) {
  try {
    const { participantIds, week, seasonType } = await request.json();

    const supabase = getSupabaseServiceClient();

    // Caller must be an active admin (same x-admin-email pattern as the
    // other admin routes — client guards are UX, not security)
    const adminEmail = request.headers.get('x-admin-email');
    if (!adminEmail) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { data: caller } = await supabase
      .from('admins')
      .select('id, is_active')
      .eq('email', adminEmail)
      .eq('is_active', true)
      .maybeSingle();
    if (!caller) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No participants selected' },
        { status: 400 }
      );
    }

    if (!week || !seasonType) {
      return NextResponse.json(
        { success: false, error: 'Week and season type are required' },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const { data: allParticipants, error: participantsError } = await supabase
      .from('participants')
      .select('id, name, email, pool_id, pools!inner(name, created_by)')
      .in('id', participantIds)
      .eq('is_active', true);

    if (participantsError || !allParticipants || allParticipants.length === 0) {
      debugError('[SH][API][PICKS] Failed to fetch participants:', participantsError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch participants' },
        { status: 500 }
      );
    }

    // Email pick reminders are a Standard feature — drop participants whose
    // pool owner is on the free plan
    const owners = allParticipants.map(p => (p.pools as unknown as { created_by: string }).created_by);
    const plans = await getAdminPlansByEmails(owners);
    const participants = allParticipants.filter(p => {
      const owner = (p.pools as unknown as { created_by: string }).created_by;
      const planInfo = plans.get(owner);
      return planInfo ? planAllowsReminders(planInfo) : false;
    });
    const planSkipped = allParticipants.length - participants.length;

    if (participants.length === 0) {
      return NextResponse.json(
        { success: false, error: REMINDERS_PLAN_MESSAGE },
        { status: 403 }
      );
    }

    // Use first game kickoff as the deadline label
    const { data: games } = await supabase
      .from('games')
      .select('kickoff_time')
      .eq('week', week)
      .eq('season_type', seasonType)
      .order('kickoff_time')
      .limit(1);

    const firstKickoff = games?.[0]?.kickoff_time;
    const deadline = firstKickoff
      ? new Date(firstKickoff).toLocaleString('en-US', {
          weekday: 'short', month: 'short', day: 'numeric',
          hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
        })
      : `Week ${week} kickoff`;

    const results = await Promise.all(
      participants.map(async (participant) => {
        const poolName = (participant.pools as unknown as { name: string }).name;
        const poolLink = `${baseUrl}`;

        try {
          const sent = await emailService.sendPickReminder(
            participant.email,
            participant.name,
            poolName,
            week,
            poolLink,
            deadline
          );

          if (sent) {
            await supabase.from('reminder_logs').insert({
              participant_id: participant.id,
              pool_id: participant.pool_id,
              week,
              season_type: seasonType,
              email_sent: true,
              created_at: new Date().toISOString(),
            });
          }

          return { success: sent, participantId: participant.id };
        } catch (error) {
          debugError(`[SH][API][PICKS] Reminder failed for ${participant.email}:`, error);
          return { success: false, participantId: participant.id };
        }
      })
    );

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      message: planSkipped > 0
        ? `Sent ${successful} reminder${successful !== 1 ? 's' : ''} (${planSkipped} skipped — ${REMINDERS_PLAN_MESSAGE})`
        : `Sent ${successful} reminder${successful !== 1 ? 's' : ''}`,
      results: { successful, failed, planSkipped, total: allParticipants.length },
    });
  } catch (error) {
    debugError('[SH][API][PICKS] Error sending reminders:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
