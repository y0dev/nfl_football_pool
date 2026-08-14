'use client';

import { Game, normalizeGameStatus } from '@/types/game';

// Shared scheduled/live/final rendering rules for a list of games. Status is
// read through normalizeGameStatus (src/types/game.ts) rather than a strict
// string match — real rows in the DB use several historical spellings
// ('final', 'Final', 'finished', 'Scheduled', 'scheduled') from different
// write paths over time, and a strict match silently mis-displays a real
// portion of them as still-scheduled. Never assumes a null score means
// 0 - 0 (Step 9): the score is only rendered once both home_score and
// away_score are actually present.

const bg      = 'oklch(13% 0.025 255)';
const surface = 'oklch(17% 0.028 255)';
const card    = 'oklch(20% 0.03 255)';
const border  = 'oklch(26% 0.03 255)';
const greenHi = 'oklch(59% 0.15 155)';
const text    = 'oklch(95% 0.006 255)';
const textDim = 'oklch(50% 0.018 255)';
const liveRed = 'oklch(62% 0.22 25)';

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

function getStatusLabel(game: Game): string {
  const status = normalizeGameStatus(game.status);
  if (status === 'finished') return 'Final';
  if (status === 'live') return 'Live';
  const kickoff = new Date(game.kickoff_time);
  const now = new Date();
  if (kickoff > now) {
    return kickoff.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  }
  return 'Starting Soon';
}

function getScoreLabel(game: Game): string {
  if (game.home_score == null || game.away_score == null) return '';
  return `${game.away_score} - ${game.home_score}`;
}

interface WeekScoreboardProps {
  games: Game[];
  loading?: boolean;
  emptyMessage?: string;
}

export function WeekScoreboard({ games, loading, emptyMessage = 'No games scheduled for this week' }: WeekScoreboardProps) {
  // Filter out malformed entries (e.g. Hall of Fame Game stored without a real away team)
  const validGames = games.filter(g => (g.away_team_id || g.away_team) && (g.home_team_id || g.home_team));

  if (loading) {
    return (
      <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse" style={{ height: 44, background: card, borderRadius: 6 }} />
        ))}
      </div>
    );
  }

  if (validGames.length === 0) {
    return (
      <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 10, padding: '2rem', textAlign: 'center' }}>
        <p style={{ ...b, fontSize: '0.85rem', color: textDim }}>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden' }}>
      {validGames.map((game, idx) => {
        const scoreLabel = getScoreLabel(game);
        const status = normalizeGameStatus(game.status);
        return (
          <div
            key={game.id}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.65rem 0.9rem', background: bg,
              borderBottom: idx < validGames.length - 1 ? `1px solid ${border}` : 'none',
            }}
          >
            <div style={{ width: 92, flexShrink: 0 }}>
              {status === 'live' ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', ...bc, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.1em', color: liveRed, textTransform: 'uppercase' }}>
                  <span className="animate-pulse" style={{ width: 5, height: 5, borderRadius: '50%', background: liveRed, display: 'inline-block', flexShrink: 0 }} />
                  Live
                </span>
              ) : status === 'finished' ? (
                <span style={{ ...bc, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.1em', color: greenHi, textTransform: 'uppercase' }}>
                  Final
                </span>
              ) : (
                <span style={{ ...b, fontSize: '0.72rem', color: textDim }}>{getStatusLabel(game)}</span>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '0.35rem', overflow: 'hidden' }}>
              <span title={game.away_team} style={{ ...bc, fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.02em', color: text, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                {game.away_team_id || game.away_team}
              </span>
              <span style={{ ...b, fontSize: '0.72rem', color: textDim, flexShrink: 0 }}>@</span>
              <span title={game.home_team} style={{ ...bc, fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.02em', color: text, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                {game.home_team_id || game.home_team}
              </span>
            </div>

            <div style={{ flexShrink: 0, textAlign: 'right', minWidth: 56 }}>
              {scoreLabel && (
                <span style={{ ...bc, fontWeight: 800, fontSize: '0.85rem', color: text, fontVariantNumeric: 'tabular-nums' }}>
                  {scoreLabel}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
