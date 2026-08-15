import { DAYS_BEFORE_GAME } from '@/lib/utils';

/**
 * Pure decision logic for whether a week's picks are unlocked — factored out
 * so a caller that already has `games` and the upcoming-week result loaded
 * (e.g. the Picks page, which loads both before WeeklyPick ever mounts) can
 * compute this synchronously instead of paying for a second, redundant set
 * of DB round trips and an async race where the UI has to guess "locked"
 * until the real answer resolves.
 *
 * Kept in its own client-safe module (no DB calls) so it can be called
 * directly from client components — everything else week-related lives in
 * src/actions/loadCurrentWeek.ts, which is a 'use server' file.
 */
export function computeWeekUnlockStatus(
  games: Array<{ kickoff_time: string; status?: string | null }>,
  weekNumber: number,
  seasonType: number,
  upcomingWeek: { week: number; seasonType: number } | null,
  now: Date = new Date()
): boolean {
  if (!games || games.length === 0) {
    // If no games found for this week, don't allow picks
    return false;
  }

  const sortedGames = [...games].sort(
    (a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime()
  );

  // Check if any games have already started
  const hasStartedGames = sortedGames.some(game => {
    const kickoffTime = new Date(game.kickoff_time);
    return kickoffTime <= now || game.status !== 'scheduled';
  });

  if (hasStartedGames) {
    // If any games have started, don't allow picks for this week
    return false;
  }

  // Check if we're within 3 days of the first game
  const firstGameTime = new Date(sortedGames[0].kickoff_time);
  const timeUntilFirstGame = firstGameTime.getTime() - now.getTime();
  const daysToKickoffInMs = DAYS_BEFORE_GAME * 24 * 60 * 60 * 1000;

  if (timeUntilFirstGame > daysToKickoffInMs) {
    // More than 3 days before the first game, don't allow picks
    return false;
  }

  // Check if this is the upcoming week (closest future week)
  if (upcomingWeek && upcomingWeek.week === weekNumber && upcomingWeek.seasonType === seasonType) {
    // This is the upcoming week, allow picks
    return true;
  }

  // Allow picks for any week within 3 days of kickoff
  return timeUntilFirstGame <= daysToKickoffInMs && timeUntilFirstGame > 0;
}
