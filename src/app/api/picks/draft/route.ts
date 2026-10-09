import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { Pick } from '@/types/game';
import { isDummyData, simulatePicksEnabled, debugLog, debugError } from '@/lib/utils';
import { checkPoolAccessFromRequest } from '@/lib/pool-access';
import { emailService } from '@/lib/email';

const UNIQUE_VIOLATION = '23505';

// Auto-saved by the picks UI (src/lib/pick-storage.ts) after 2 minutes of
// inactivity with unsubmitted changes — a safety net for a participant who
// starts picking but forgets to hit Submit. Never touches the authoritative
// `picks` table; a commissioner reviews and submits this on the
// participant's behalf from the override-picks page. Same pool-access gate
// as the real submit endpoint (src/app/api/picks/submit/route.ts), but no
// lock/validation checks — the whole point is to still capture a draft
// right up to (and past) the deadline.
export async function POST(request: NextRequest) {
  try {
    if (isDummyData() || simulatePicksEnabled()) {
      return NextResponse.json({ success: true, message: 'Draft not saved (simulated mode)' });
    }

    const body: {
      participantId?: string;
      poolId?: string;
      week?: number;
      season?: number;
      seasonType?: number;
      picks?: Pick[];
      mondayNightScore?: number | null;
    } = await request.json();
    const { participantId, poolId, week, season, seasonType, picks, mondayNightScore } = body;

    if (!participantId || !poolId || !week || !season || !seasonType || !Array.isArray(picks)) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }
    if (picks.length === 0) {
      return NextResponse.json({ success: false, error: 'No picks to draft' }, { status: 400 });
    }

    const access = await checkPoolAccessFromRequest(poolId, request);
    if (!access.allowed) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    const supabase = getSupabaseServiceClient();
    const draftPicks = picks
      .filter(p => p.predicted_winner)
      .map(p => ({ game_id: p.game_id, predicted_winner: p.predicted_winner, confidence_points: p.confidence_points ?? 0 }));

    // Plain insert first (not upsert) so a unique-constraint failure tells
    // us this is an update to a draft that already existed — that
    // distinction is what keeps the commissioner alert below firing exactly
    // once per draft, not on every 2-minute re-save while it's still open.
    const { error: insertError } = await supabase
      .from('pick_drafts')
      .insert({
        participant_id: participantId,
        pool_id: poolId,
        season,
        season_type: seasonType,
        week,
        picks: draftPicks,
        monday_night_score: mondayNightScore ?? null,
      });

    let isNewDraft = true;
    if (insertError) {
      if (insertError.code !== UNIQUE_VIOLATION) {
        debugError('Error saving pick draft:', insertError);
        return NextResponse.json({ success: false, error: 'Failed to save draft' }, { status: 500 });
      }
      isNewDraft = false;
      const { error: updateError } = await supabase
        .from('pick_drafts')
        .update({
          picks: draftPicks,
          monday_night_score: mondayNightScore ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('participant_id', participantId)
        .eq('pool_id', poolId)
        .eq('season', season)
        .eq('season_type', seasonType)
        .eq('week', week);
      if (updateError) {
        debugError('Error updating pick draft:', updateError);
        return NextResponse.json({ success: false, error: 'Failed to save draft' }, { status: 500 });
      }
    }

    if (isNewDraft) {
      // Fire-and-forget — a slow/failed email should never block the
      // participant's own auto-save from succeeding.
      notifyCommissionerOfDraft(supabase, { participantId, poolId, week, seasonType }).catch(err =>
        debugError('Error notifying commissioner of new pick draft:', err)
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    debugError('Error in picks/draft API:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

async function notifyCommissionerOfDraft(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  { participantId, poolId, week, seasonType }: { participantId: string; poolId: string; week: number; seasonType: number }
) {
  const [{ data: pool }, { data: participant }] = await Promise.all([
    supabase.from('pools').select('name, created_by').eq('id', poolId).maybeSingle(),
    supabase.from('participants').select('name').eq('id', participantId).maybeSingle(),
  ]);
  if (!pool || !participant) return;

  const { data: admin } = await supabase
    .from('commissioners')
    .select('email, full_name, notification_preferences')
    .eq('email', pool.created_by)
    .eq('is_active', true)
    .maybeSingle();
  if (!admin?.email) return;

  // Reuses the existing pick-reminders preference — a commissioner who's
  // already opted out of pick-related admin emails almost certainly wants
  // this one off too, and it's not worth a second toggle for such a
  // closely related notification.
  const notificationPreferences = admin.notification_preferences as { pick_reminders?: boolean } | null;
  if (notificationPreferences?.pick_reminders === false) return;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const overridePicksLink = `${baseUrl}/league/pool/${poolId}/override-picks/${participantId}?week=${week}&seasonType=${seasonType}`;

  const sent = await emailService.sendPickDraftAlert(
    admin.email,
    admin.full_name || 'Pool Commissioner',
    pool.name,
    week,
    participant.name,
    overridePicksLink
  );
  debugLog(sent ? 'Sent pick-draft alert to commissioner' : 'Pick-draft alert did not send', { poolId, participantId, week });
}
