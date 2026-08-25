import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { requireActiveAdmin } from '@/lib/accounts';
import { emailService } from '@/lib/email';
import { computePickemSeasonSummary, computePickemWeekResult } from '@/lib/pickem';
import { debugError } from '@/lib/utils';

// Sends the "you got N of M picks correct" / weekly-winner / tiebreaker-used
// result email to every participant, once the week is fully final. Mirrors
// /api/survivor/notify-week-results' shape and its "default to the most
// recently final week when none is given" convention.
export async function POST(request: NextRequest) {
  try {
    const auth = await requireActiveAdmin(request);
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => ({}));
    const { poolId, week: bodyWeek, seasonType: bodySeasonType } = body as { poolId?: string; week?: number; seasonType?: number };
    if (!poolId) {
      return NextResponse.json({ success: false, error: 'poolId is required' }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();
    const { data: pool } = await supabase.from('pools').select('created_by, name').eq('id', poolId).maybeSingle();
    if (!pool) return NextResponse.json({ success: false, error: 'Pool not found' }, { status: 404 });
    if (pool.created_by !== auth.email && !auth.isSuperAdmin) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    let week = bodyWeek;
    let seasonType = bodySeasonType;
    if (!week || !seasonType) {
      // Most recently FINAL week across the season, same "find the highest
      // (season_type, week) with resolved data" convention Survivor's route
      // uses — derived from the season summary's per-week isWeekFinal flags
      // rather than a second bespoke query.
      const summary = await computePickemSeasonSummary(poolId);
      let mostRecent: { week: number; seasonType: number } | null = null;
      for (const p of summary.participants) {
        for (const w of p.weeklyResults) {
          if (!w.isWeekFinal) continue;
          if (!mostRecent || w.seasonType > mostRecent.seasonType || (w.seasonType === mostRecent.seasonType && w.week > mostRecent.week)) {
            mostRecent = { week: w.week, seasonType: w.seasonType };
          }
        }
      }
      if (!mostRecent) {
        return NextResponse.json({ success: true, message: 'No final week to announce yet.', results: { successful: 0, failed: 0, total: 0 } });
      }
      week = mostRecent.week;
      seasonType = mostRecent.seasonType;
    }

    const weekResult = await computePickemWeekResult(poolId, week, seasonType);
    if (!weekResult.isWeekFinal) {
      return NextResponse.json({ success: true, message: `Week ${week} is not final yet.`, results: { successful: 0, failed: 0, total: 0 } });
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

    const maxCorrect = weekResult.participants.length > 0 ? Math.max(...weekResult.participants.map(p => p.correctCount)) : 0;
    const winnerIds = new Set(weekResult.winnerParticipantIds);

    const targets = weekResult.participants.filter(p => !!emailById.get(p.participantId));

    const results = await Promise.all(
      targets.map(async p => {
        const email = emailById.get(p.participantId)!;
        try {
          const wasTiedForFirst = p.correctCount === maxCorrect && maxCorrect > 0 && weekResult.participants.filter(x => x.correctCount === maxCorrect).length > 1;
          const isWinner = winnerIds.has(p.participantId);
          const sent = await emailService.sendPickemWeekResult(email, p.participantName, pool.name, week!, poolLink, {
            correctCount: p.correctCount,
            totalGames: weekResult.eligibleGames.length,
            isWinner,
            wasTiedForFirst,
            tiebreakerUsed: wasTiedForFirst && p.tiebreakerPrediction != null,
          });
          return { success: sent };
        } catch (error) {
          debugError(`Pick'em result email failed for ${email}:`, error);
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
    debugError("Error sending Pick'em week-result emails:", error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
