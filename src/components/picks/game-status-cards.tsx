import { AlertTriangle } from 'lucide-react';

// Shared #game-status-card / #games-started-card — originally Confidence-only
// (src/components/picks/pool-picks-content.tsx), extracted so Pick'em and
// Survivor use the exact same computation and presentation instead of a
// separate/simplified one. Confidence's own render call is a pure
// extraction — same stats shape, same JSX, same ids.

const card    = 'oklch(20% 0.03 255)';
const border  = 'oklch(26% 0.03 255)';
const greenHi = 'oklch(59% 0.15 155)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const amber   = 'oklch(72% 0.16 60)';
const liveRed = 'oklch(62% 0.22 25)';
const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

export interface GameStatusStats {
  total: number;
  upcoming: number;
  inProgress: number;
  finished: number;
}

/** Same computation Confidence's getGameStatusStats() always used — a game
 * counts as finished once it has a final status/winner, upcoming while its
 * kickoff hasn't passed yet, else in progress. Every competition type shares
 * one `games` table, so this needs nothing type-specific: each caller maps
 * its own game shape into this minimal one. */
export function computeGameStatusStats(
  games: Array<{ kickoff_time: string; status?: string | null; winner?: string | null }>,
  now: Date = new Date()
): GameStatusStats | null {
  if (games.length === 0) return null;
  const stats: GameStatusStats = { total: games.length, upcoming: 0, inProgress: 0, finished: 0 };
  games.forEach(game => {
    const timeDiff = new Date(game.kickoff_time).getTime() - now.getTime();
    if (timeDiff > 0) stats.upcoming++;
    else if (game.status === 'finished' || game.status === 'final' || game.winner) stats.finished++;
    else stats.inProgress++;
  });
  return stats;
}

export function GameStatusCard({ stats }: { stats: GameStatusStats }) {
  return (
    <div id="game-status-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
      {[
        { label: 'Total', value: stats.total, color: 'oklch(58% 0.15 250)' },
        { label: 'Upcoming', value: stats.upcoming, color: greenHi },
        { label: 'In Progress', value: stats.inProgress, color: amber },
        { label: 'Finished', value: stats.finished, color: textMid },
      ].map(({ label, value, color }) => (
        <div key={label} style={{ background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '0.85rem', textAlign: 'center' }}>
          <div style={{ ...bc, fontWeight: 900, fontSize: '1.5rem', color, lineHeight: 1 }}>{value}</div>
          <div style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.25rem' }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

export function GamesStartedCard({ label = 'Games Have Started!', sublabel = 'All picks are now locked' }: { label?: string; sublabel?: string }) {
  return (
    <div id="games-started-card" style={{ background: `oklch(62% 0.22 25 / 0.1)`, border: `1px solid oklch(62% 0.22 25 / 0.35)`, borderRadius: 8, padding: '1rem 1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
        <AlertTriangle style={{ width: 18, height: 18, color: liveRed, flexShrink: 0 }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ ...bc, fontWeight: 800, fontSize: '1.05rem', color: liveRed }}>{label}</div>
          <div style={{ ...b, fontSize: '0.78rem', color: textMid }}>{sublabel}</div>
        </div>
      </div>
    </div>
  );
}
