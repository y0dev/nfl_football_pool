import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { emailService } from '@/lib/email';
import { debugError } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const { participantIds, week, seasonType } = await request.json();

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

    const supabase = getSupabaseServiceClient();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const { data: participants, error: participantsError } = await supabase
      .from('participants')
      .select('id, name, email, pool_id, pools!inner(name)')
      .in('id', participantIds)
      .eq('is_active', true);

    if (participantsError || !participants || participants.length === 0) {
      debugError('[SH][API][PICKS] Failed to fetch participants:', participantsError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch participants' },
        { status: 500 }
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
      message: `Sent ${successful} reminder${successful !== 1 ? 's' : ''}`,
      results: { successful, failed, total: participants.length },
    });
  } catch (error) {
    debugError('[SH][API][PICKS] Error sending reminders:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
