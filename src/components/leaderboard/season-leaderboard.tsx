'use client';

import { useState, useEffect } from 'react';
import { Trophy, TrendingUp, Users, RefreshCw } from 'lucide-react';
import { debugLog, debugError} from '@/lib/utils';

// Design tokens
const surface = 'oklch(17% 0.028 255)';
const card    = 'oklch(20% 0.03 255)';
const border  = 'oklch(26% 0.03 255)';
const greenHi = 'oklch(59% 0.15 155)';
const gold    = 'oklch(74% 0.16 72)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const amber   = 'oklch(72% 0.16 60)';
const purple  = 'oklch(65% 0.12 290)';
const liveRed = 'oklch(62% 0.22 25)';

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

interface SeasonLeaderboardEntry {
  participant_name: string;
  total_points: number;
  weeks_played: number;
  average_points: number;
  best_week: number;
  best_week_score: number;
}

interface SeasonLeaderboardProps {
  poolId: string;
  season: number;
  currentWeek?: number;
  currentSeasonType?: number;
}

export function SeasonLeaderboard({ poolId, season, currentWeek, currentSeasonType }: SeasonLeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<SeasonLeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSeasonLeaderboard = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`/api/leaderboard/season?poolId=${poolId}&season=${season}&currentWeek=${currentWeek || ''}&currentSeasonType=${currentSeasonType || ''}`);

        if (!response.ok) {
          throw new Error(`Failed to load season leaderboard: ${response.status}`);
        }

        const result = await response.json();
        debugLog('SEASON LEADERBOARD: Result:', result);
        if (result.success) {
          setLeaderboard(result.leaderboard || []);
        } else {
          throw new Error(result.error || 'Failed to load season leaderboard');
        }
      } catch (err) {
        debugError('Error loading season leaderboard:', err);
        setError(err instanceof Error ? err.message : 'Failed to load season leaderboard');
      } finally {
        setIsLoading(false);
      }
    };

    if (poolId && season) {
      loadSeasonLeaderboard();
    }
  }, [poolId, season, currentWeek, currentSeasonType]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2.5rem 1rem', gap: '0.75rem' }}>
        <RefreshCw style={{ width: 22, height: 22, color: textDim, animation: 'spin 1s linear infinite' }} />
        <span style={{ ...b, fontSize: '0.875rem', color: textMid }}>Loading season standings…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
        <TrendingUp style={{ width: 32, height: 32, color: liveRed, margin: '0 auto 0.5rem' }} />
        <p style={{ ...b, fontSize: '0.875rem', color: liveRed, marginBottom: '0.25rem' }}>Unable to load season leaderboard</p>
        <p style={{ ...b, fontSize: '0.78rem', color: textDim }}>{error}</p>
      </div>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
        <Users style={{ width: 32, height: 32, color: textDim, margin: '0 auto 0.5rem' }} />
        <p style={{ ...b, fontSize: '0.875rem', color: textMid, marginBottom: '0.2rem' }}>No season data available yet</p>
        <p style={{ ...b, fontSize: '0.78rem', color: textDim }}>Complete weeks will appear here</p>
      </div>
    );
  }

  const avgScore = Math.round(leaderboard.reduce((sum, entry) => sum + entry.average_points, 0) / leaderboard.length) || 0;
  const maxWeeksPlayed = Math.max(...leaderboard.map(e => e.weeks_played)) || 0;

  // Position accent colors
  const positionAccent = (idx: number) =>
    idx === 0 ? gold : idx === 1 ? textMid : idx === 2 ? amber : border;

  const positionLabel = (idx: number) =>
    idx === 0 ? '1st' : idx === 1 ? '2nd' : idx === 2 ? '3rd' : `#${idx + 1}`;

  const positionLabelColor = (idx: number) =>
    idx === 0 ? gold : idx === 1 ? textMid : idx === 2 ? amber : textDim;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
        {[
          { value: leaderboard.length,                label: 'Participants',  color: greenHi },
          { value: leaderboard[0]?.total_points || 0, label: 'Leader Score',  color: gold },
          { value: avgScore,                           label: 'Avg Score',    color: purple },
          { value: maxWeeksPlayed,                     label: 'Weeks Played', color: amber },
        ].map(({ value, label, color }) => (
          <div key={label} style={{ background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '0.75rem', textAlign: 'center' }}>
            <div style={{ ...bc, fontWeight: 900, fontSize: '1.4rem', color, lineHeight: 1 }}>{value}</div>
            <div style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.2rem' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Leaderboard rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {leaderboard.map((entry, index) => (
          <div
            key={entry.participant_name}
            style={{
              background: index < 3 ? surface : card,
              border: `1px solid ${index < 3 ? positionAccent(index) + '60' : border}`,
              borderLeft: `4px solid ${positionAccent(index)}`,
              borderRadius: 8,
              padding: '0.85rem 1rem',
            }}
          >
            {/* Top row: rank + name + total points */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: index < 3 ? '0.65rem' : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
                  {index === 0 && <Trophy style={{ width: 14, height: 14, color: gold }} />}
                  {index === 1 && <Trophy style={{ width: 14, height: 14, color: textMid }} />}
                  {index === 2 && <Trophy style={{ width: 14, height: 14, color: amber }} />}
                  <span style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', color: positionLabelColor(index) }}>
                    {positionLabel(index)}
                  </span>
                </div>
                <div style={{ ...b, fontSize: '0.9rem', fontWeight: 600, color: text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.participant_name}
                </div>
                <span style={{
                  ...bc, fontWeight: 700, fontSize: '0.6rem', letterSpacing: '0.07em',
                  padding: '0.1rem 0.4rem', borderRadius: 4, textTransform: 'uppercase',
                  background: 'oklch(26% 0.03 255)', color: textDim, border: `1px solid ${border}`,
                  flexShrink: 0,
                }}>
                  {entry.weeks_played} wk{entry.weeks_played !== 1 ? 's' : ''}
                </span>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ ...bc, fontWeight: 900, fontSize: '1.35rem', color: greenHi, lineHeight: 1 }}>{entry.total_points}</div>
                <div style={{ ...b, fontSize: '0.68rem', color: textDim }}>total pts</div>
              </div>
            </div>

            {/* Stats row for top 3 */}
            {index < 3 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                <div style={{ background: card, borderRadius: 6, padding: '0.4rem 0.5rem', textAlign: 'center' }}>
                  <div style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: textMid, lineHeight: 1 }}>{entry.average_points.toFixed(1)}</div>
                  <div style={{ ...b, fontSize: '0.65rem', color: textDim }}>avg/week</div>
                </div>
                <div style={{ background: card, borderRadius: 6, padding: '0.4rem 0.5rem', textAlign: 'center' }}>
                  <div style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: textMid, lineHeight: 1 }}>{entry.best_week_score}</div>
                  <div style={{ ...b, fontSize: '0.65rem', color: textDim }}>best wk score</div>
                </div>
                <div style={{ background: card, borderRadius: 6, padding: '0.4rem 0.5rem', textAlign: 'center' }}>
                  <div style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: textMid, lineHeight: 1 }}>Wk {entry.best_week || '-'}</div>
                  <div style={{ ...b, fontSize: '0.65rem', color: textDim }}>best week</div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ borderTop: `1px solid ${border}`, paddingTop: '0.75rem', textAlign: 'center' }}>
        <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginBottom: '0.2rem' }}>
          Season leaderboard shows accumulated scores from all completed weeks
        </p>
        <p style={{ ...b, fontSize: '0.72rem', color: textDim }}>
          Best week indicates the participant&apos;s highest-scoring individual week
        </p>
      </div>
    </div>
  );
}
