import { normalizeGameStatus } from '@/types/game';

export function isWeekComplete(games: Array<{ status?: string | null }>): boolean {
  return games.length > 0 && games.every(game => normalizeGameStatus(game.status) === 'finished');
}

export function periodChartData(
  entries: Array<{ participant_id: string; weekly_scores: Array<{ week: number; points: number }> }>,
  weeks: number[], selectedIds: string[],
): Array<{ week: string; [key: string]: string | number }> {
  return weeks.map(week => {
    const row: { week: string; [key: string]: string | number } = { week: `Week ${week}` };
    for (const entry of entries) {
      if (selectedIds.includes(entry.participant_id)) {
        row[entry.participant_id] = entry.weekly_scores.find(score => score.week === week)?.points ?? 0;
      }
    }
    return row;
  });
}
