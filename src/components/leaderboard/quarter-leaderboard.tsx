'use client';

import { useEffect, useMemo, useState } from 'react';
import { Target, TrendingUp, Users, RefreshCw, ChevronDown } from 'lucide-react';
import { getPeriodNameForWeek, debugError } from '@/lib/utils';

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

interface AvailablePeriod {
  name: string;
  startWeek: number;
  endWeek: number;
  weeks: number[];
  isCurrent: boolean;
  isComplete: boolean;
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
  const [availablePeriods, setAvailablePeriods] = useState<AvailablePeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);

  const defaultPeriodName = useMemo(
    () => getPeriodNameForWeek(currentWeek, seasonType),
    [currentWeek, seasonType]
  );

  // Playoffs number their own weeks and have no Q1-Q4 selector — the period
  // is always just "Playoffs" there.
  const periodName = seasonType === 3 ? 'Playoffs' : (selectedPeriod ?? defaultPeriodName);

  // Load which periods are selectable (started, per the pool's current week)
  // — this is what makes every quarter reachable instead of only whichever
  // one the shared page-level currentWeek happens to fall in.
  useEffect(() => {
    if (seasonType === 3) return;
    const loadPeriods = async () => {
      try {
        const res = await fetch(`/api/periods/available?poolId=${poolId}&season=${season}&currentWeek=${currentWeek}&currentSeasonType=${seasonType}`);
        if (!res.ok) {
          debugError('Failed to load available periods:', res.status, res.statusText);
          return;
        }
        const data = await res.json();
        setAvailablePeriods(data?.data?.periods || []);
      } catch (err) {
        // Non-fatal — the leaderboard itself still works with just the
        // default period, but log it so a genuine fetch failure (as
        // opposed to a pool that legitimately only has one period so far)
        // isn't invisible.
        debugError('Error loading available periods:', err);
      }
    };
    loadPeriods();
  }, [poolId, season, currentWeek, seasonType]);

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
        const label = seasonType === 3 ? 'Playoffs' : `Quarter ${periodName.replace('Q', '')}`;
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

  const selector = seasonType !== 3 && availablePeriods.length > 1 && (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <select
        value={periodName}
        onChange={(e) => setSelectedPeriod(e.target.value)}
        aria-label="Select quarter"
        style={{
          appearance: 'none', WebkitAppearance: 'none',
          background: card, border: `1px solid ${border}`, borderRadius: 6,
          padding: '0.4rem 1.8rem 0.4rem 0.75rem',
          color: text, ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.04em',
          cursor: 'pointer',
        }}
      >
        {availablePeriods.map(p => (
          <option key={p.name} value={p.name}>
            Quarter {p.name.replace('Q', '')}{p.isCurrent ? ' (current)' : ''}
          </option>
        ))}
      </select>
      <ChevronDown style={{ width: 14, height: 14, color: textDim, position: 'absolute', right: '0.6rem', pointerEvents: 'none' }} />
    </div>
  );

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {selector && <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{selector}</div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2.5rem 1rem', gap: '0.75rem' }}>
          <RefreshCw style={{ width: 22, height: 22, color: textDim, animation: 'spin 1s linear infinite' }} />
          <span style={{ ...b, fontSize: '0.875rem', color: textMid }}>Loading quarter standings…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {selector && <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{selector}</div>}
        <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
          <TrendingUp style={{ width: 32, height: 32, color: liveRed, margin: '0 auto 0.5rem' }} />
          <p style={{ ...b, fontSize: '0.875rem', color: liveRed, marginBottom: '0.25rem' }}>Unable to load quarter leaderboard</p>
          <p style={{ ...b, fontSize: '0.78rem', color: textDim }}>{error}</p>
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {selector && <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{selector}</div>}
        <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
          <Users style={{ width: 32, height: 32, color: textDim, margin: '0 auto 0.5rem' }} />
          <p style={{ ...b, fontSize: '0.875rem', color: textMid, marginBottom: '0.2rem' }}>No quarter data available yet</p>
          <p style={{ ...b, fontSize: '0.78rem', color: textDim }}>Complete weeks will appear here</p>
        </div>
      </div>
    );
  }

  // Nobody has actually scored yet — don't crown a leader.
  const hasScores = entries.some(e => (e.total_points || 0) > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

      {selector && <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{selector}</div>}

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
            background: hasScores && idx < 3 ? surface : card,
            border: `1px solid ${hasScores && idx < 3 ? greenHi + '50' : border}`,
            borderLeft: hasScores && idx < 3 ? `4px solid ${idx === 0 ? gold : idx === 1 ? textMid : amber}` : `1px solid ${border}`,
            borderRadius: 8,
            padding: '0.85rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ ...bc, fontWeight: 700, fontSize: '0.82rem', color: hasScores && idx < 3 ? text : textDim, width: '1.5rem', textAlign: 'right' }}>
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
