'use client';

import { useEffect, useMemo, useState } from 'react';
import { Target, TrendingUp, Users, RefreshCw } from 'lucide-react';

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
const liveRed = 'oklch(62% 0.22 25)';

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

interface QuarterEntry {
  participant_id: string;
  name: string;
  total_points: number;
  total_correct: number;
  weeks_won: number;
}

interface QuarterLeaderboardProps {
  poolId: string;
  season: number;
  currentWeek: number;
  seasonType?: number; // 1=Preseason, 2=Regular Season, 3=Postseason/Playoffs
}

export function QuarterLeaderboard({ poolId, season, currentWeek, seasonType = 2 }: QuarterLeaderboardProps) {
  const [entries, setEntries] = useState<QuarterEntry[]>([]);
  const [periodLabel, setPeriodLabel] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const periodName = useMemo(() => {
    if (seasonType === 3) return 'Playoffs';
    if (currentWeek <= 4) return 'Period 1';
    if (currentWeek <= 9) return 'Period 2';
    if (currentWeek <= 14) return 'Period 3';
    return 'Period 4';
  }, [currentWeek, seasonType]);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch(`/api/periods/leaderboard?poolId=${poolId}&season=${season}&periodName=${encodeURIComponent(periodName)}&seasonType=${seasonType}`);
        if (!res.ok) throw new Error(`Failed to load quarter leaderboard: ${res.status}`);
        const data = await res.json();
        const lb = (data?.data?.leaderboard || []) as any[];
        setEntries(lb.map(e => ({
          participant_id: e.participant_id,
          name: e.name,
          total_points: e.total_points,
          total_correct: e.total_correct,
          weeks_won: e.weeks_won,
        })));
        const weeks = data?.data?.periodInfo?.weeks || [];
        const label = seasonType === 3 ? 'Playoffs' : periodName.replace('Period', 'Quarter');
        if (seasonType === 3) {
          const roundNames: Record<number, string> = {
            1: 'Wild Card Round',
            2: 'Divisional Round',
            3: 'Conference Championships',
            4: 'Super Bowl',
          };
          if (weeks.length > 0) {
            const roundLabels = weeks.map((w: number) => roundNames[w] || `Round ${w}`).join(', ');
            setPeriodLabel(`Playoffs (${roundLabels})`);
          } else {
            setPeriodLabel('Playoffs');
          }
        } else {
          setPeriodLabel(weeks.length > 0 ? `${label} (Weeks ${weeks[0]}-${weeks[weeks.length - 1]})` : label);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load quarter leaderboard');
      } finally {
        setIsLoading(false);
      }
    };
    if (poolId && season) load();
  }, [poolId, season, periodName, seasonType]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2.5rem 1rem', gap: '0.75rem' }}>
        <RefreshCw style={{ width: 22, height: 22, color: textDim, animation: 'spin 1s linear infinite' }} />
        <span style={{ ...b, fontSize: '0.875rem', color: textMid }}>Loading quarter standings…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
        <TrendingUp style={{ width: 32, height: 32, color: liveRed, margin: '0 auto 0.5rem' }} />
        <p style={{ ...b, fontSize: '0.875rem', color: liveRed, marginBottom: '0.25rem' }}>Unable to load quarter leaderboard</p>
        <p style={{ ...b, fontSize: '0.78rem', color: textDim }}>{error}</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
        <Users style={{ width: 32, height: 32, color: textDim, margin: '0 auto 0.5rem' }} />
        <p style={{ ...b, fontSize: '0.875rem', color: textMid, marginBottom: '0.2rem' }}>No quarter data available yet</p>
        <p style={{ ...b, fontSize: '0.78rem', color: textDim }}>Complete weeks will appear here</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

      {/* Period header */}
      <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Target style={{ width: 15, height: 15, color: greenHi }} />
          <span style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.06em', color: text, textTransform: 'uppercase' }}>{periodLabel}</span>
        </div>
        <span style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.07em', padding: '0.15rem 0.5rem', borderRadius: 4, textTransform: 'uppercase', background: 'oklch(26% 0.03 255)', color: textMid, border: `1px solid ${border}` }}>
          {entries.length} participants
        </span>
      </div>

      {/* Entries */}
      {entries.map((e, idx) => (
        <div
          key={e.participant_id}
          style={{
            background: idx < 3 ? surface : card,
            border: `1px solid ${idx < 3 ? greenHi + '50' : border}`,
            borderLeft: idx < 3 ? `4px solid ${idx === 0 ? gold : idx === 1 ? textMid : amber}` : `1px solid ${border}`,
            borderRadius: 8,
            padding: '0.85rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ ...bc, fontWeight: 700, fontSize: '0.82rem', color: idx < 3 ? text : textDim, width: '1.5rem', textAlign: 'right' }}>
              {idx + 1}
            </div>
            <div style={{ ...b, fontSize: '0.9rem', fontWeight: 600, color: text }}>{e.name}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ ...bc, fontWeight: 900, fontSize: '1.1rem', color: greenHi, lineHeight: 1 }}>{e.total_points}</div>
              <div style={{ ...b, fontSize: '0.68rem', color: textDim }}>points</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: textMid, lineHeight: 1 }}>{e.total_correct}</div>
              <div style={{ ...b, fontSize: '0.68rem', color: textDim }}>correct</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: textMid, lineHeight: 1 }}>{e.weeks_won}</div>
              <div style={{ ...b, fontSize: '0.68rem', color: textDim }}>wks won</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
