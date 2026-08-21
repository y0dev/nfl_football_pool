'use server';

import { getSupabaseClient } from '@/lib/supabase';
import { emailService } from '@/lib/email';
import { debugLog, debugError } from '@/lib/utils';

async function getParticipantsWithoutPicks(poolId: string, weekNumber: number) {
  try {
    const supabase = getSupabaseClient();
    
    // Get all active participants
    const { data: allParticipants, error: allError } = await supabase
      .from('participants')
      .select('id, name, email')
      .eq('pool_id', poolId)
      .eq('is_active', true);

    if (allError || !allParticipants) {
      debugError('Error fetching participants:', allError);
      return [];
    }

    // Get participants who have submitted picks
    const { data: picksData, error: picksError } = await supabase
      .from('picks')
      .select('participant_id')
      .eq('pool_id', poolId)
      .eq('week', weekNumber);

    if (picksError) {
      debugError('Error fetching picks:', picksError);
    }

    const participantsWithPicks = new Set(picksData?.map(p => p.participant_id) || []);
    
    // Return participants without picks
    return allParticipants.filter(p => !participantsWithPicks.has(p.id));
  } catch (error) {
    debugError('Error getting participants without picks:', error);
    return [];
  }
}

/**
 * Check for participants without picks when games start in less than 5 hours
 * and send urgent reminder to pool admin
 */
export async function checkAndSendUrgentReminders(): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const now = new Date();
    const fiveHoursFromNow = new Date(now.getTime() + 5 * 60 * 60 * 1000);

    // Get upcoming games starting within 5 hours
    const { data: upcomingGames, error: gamesError } = await supabase
      .from('games')
      .select('id, week, season_type, kickoff_time, home_team, away_team')
      .gte('kickoff_time', now.toISOString())
      .lte('kickoff_time', fiveHoursFromNow.toISOString())
      .order('kickoff_time', { ascending: true });

    if (gamesError || !upcomingGames || upcomingGames.length === 0) {
      return; // No games starting soon
    }

    // Group games by week
    const gamesByWeek = new Map<number, typeof upcomingGames>();
    for (const game of upcomingGames) {
      if (!gamesByWeek.has(game.week)) {
        gamesByWeek.set(game.week, []);
      }
      gamesByWeek.get(game.week)!.push(game);
    }

    // Get all active pools — Confidence only. getParticipantsWithoutPicks
    // below reads the Confidence-only `picks` table, which Survivor and
    // Pick'em pools never populate (they each have their own authoritative
    // reminder flow — /api/survivor/send-reminders and
    // /api/pickem/send-reminders — triggered by the commissioner, not this
    // hourly cron). Without this filter every active Survivor/Pick'em pool
    // would look permanently 100% "missing picks" and send its commissioner
    // a confusing, wrongly-worded urgent reminder every run.
    const { data: allPools, error: poolsError } = await supabase
      .from('pools')
      .select('id, name, created_by')
      .eq('is_active', true)
      .in('competition_type', ['NFL_CONFIDENCE', 'NCAA_CONFIDENCE']);

    if (poolsError || !allPools) {
      return;
    }

    // Email pick reminders are a Standard feature — skip pools whose owner
    // is on the free plan
    const { getAdminPlansByEmails, planAllowsReminders } = await import('@/lib/plan');
    const ownerPlans = await getAdminPlansByEmails(allPools.map(p => p.created_by));
    const pools = allPools.filter(p => {
      const planInfo = ownerPlans.get(p.created_by);
      return planInfo ? planAllowsReminders(planInfo) : false;
    });

    if (pools.length === 0) {
      return;
    }

    // For each week with upcoming games, check each pool
    for (const [weekNumber, games] of gamesByWeek.entries()) {
      const earliestGame = games[0];
      const timeUntilGame = Math.floor((new Date(earliestGame.kickoff_time).getTime() - now.getTime()) / (60 * 1000));
      const hoursUntil = Math.floor(timeUntilGame / 60);
      const minutesUntil = timeUntilGame % 60;
      const timeString = hoursUntil > 0 
        ? `${hoursUntil} hour${hoursUntil > 1 ? 's' : ''} and ${minutesUntil} minute${minutesUntil !== 1 ? 's' : ''}`
        : `${minutesUntil} minute${minutesUntil !== 1 ? 's' : ''}`;

      for (const pool of pools) {
        // Get pool admin
        const { data: admin, error: adminError } = await supabase
          .from('commissioners')
          .select('id, email, full_name, notification_preferences')
          .eq('email', pool.created_by)
          .eq('is_active', true)
          .maybeSingle();

        if (adminError || !admin || !admin.email) {
          continue;
        }

        // Respect the commissioner's notification preferences (Account
        // Settings → Notifications). Defaults to sending when the column is
        // missing/null so existing accounts aren't silently opted out.
        if (admin.notification_preferences?.pick_reminders === false) {
          continue;
        }

        // Get participants without picks
        const participantsWithoutPicks = await getParticipantsWithoutPicks(pool.id, weekNumber);

        if (participantsWithoutPicks.length > 0) {
          // Send urgent reminder to admin
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          const poolLink = `${baseUrl}/pool/${pool.id}/picks?week=${weekNumber}`;

          try {
            await emailService.sendUrgentReminderToAdmin(
              admin.email,
              admin.full_name || 'Pool Commissioner',
              pool.name,
              weekNumber,
              participantsWithoutPicks.map(p => ({ name: p.name, email: p.email || undefined })),
              timeString,
              poolLink
            );
            debugLog(`Sent urgent reminder to admin for pool ${pool.name}, week ${weekNumber}`);
          } catch (error) {
            debugError(`Error sending urgent reminder for pool ${pool.name}:`, error);
          }
        }
      }
    }
  } catch (error) {
    debugError('Error in checkAndSendUrgentReminders:', error);
  }
}

