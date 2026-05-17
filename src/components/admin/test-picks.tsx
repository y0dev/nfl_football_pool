'use client';

import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, ExternalLink, Share2, Users } from 'lucide-react';
import { getUpcomingWeek } from '@/actions/loadCurrentWeek';
import { debugLog } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const card    = 'oklch(20% 0.03 255)';
const surface = 'oklch(17% 0.028 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

interface TestPicksProps {
  poolId: string;
  poolName: string;
  weekNumber?: number;
  seasonType?: number;
  seasonScope?: number[];
}

const ALL_SEASON_TYPE_OPTIONS = [
  { value: 1, label: 'Preseason', weeks: [1, 2, 3, 4] },
  { value: 2, label: 'Regular Season', weeks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18] },
  { value: 3, label: 'Postseason', weeks: [1, 2, 3, 4] },
];

const cardStyle = { background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '1.25rem' };
const labelStyle = { ...bc, fontSize: '0.68rem', fontWeight: 700 as const, color: textDim, textTransform: 'uppercase' as const, letterSpacing: '0.08em', display: 'block', marginBottom: '0.35rem' };

export function TestPicks({ poolId, poolName, weekNumber, seasonType, seasonScope }: TestPicksProps) {
  const scope = seasonScope && seasonScope.length > 0 ? [...seasonScope].sort((a, b) => a - b) : [1, 2, 3];
  const seasonTypeOptions = ALL_SEASON_TYPE_OPTIONS.filter(o => scope.includes(o.value));
  const clampToScope = (st: number) => scope.includes(st) ? st : scope[0];

  const [currentWeek, setCurrentWeek] = useState(weekNumber || 1);
  const [selectedWeek, setSelectedWeek] = useState(weekNumber || 1);
  const [selectedSeasonType, setSelectedSeasonType] = useState(clampToScope(seasonType || 2));
  const [availableWeeks, setAvailableWeeks] = useState<number[]>([]);
  const [testUrl, setTestUrl] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    const loadWeek = async () => {
      try {
        const { week, seasonType: upcomingST } = await getUpcomingWeek();
        const clamped = clampToScope(upcomingST);
        setCurrentWeek(week);
        setSelectedWeek(week);
        const opt = seasonTypeOptions.find(o => o.value === clamped);
        setAvailableWeeks(opt?.weeks || seasonTypeOptions[0]?.weeks || []);
        setSelectedSeasonType(clamped);
      } catch {
        setCurrentWeek(1); setSelectedWeek(1);
        setAvailableWeeks(seasonTypeOptions[0]?.weeks || []);
      }
    };
    loadWeek();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const baseUrl = window.location.origin;
    setTestUrl(`${baseUrl}/pool/${poolId}/picks?week=${selectedWeek}&seasonType=${selectedSeasonType}`);
  }, [poolId, selectedWeek, selectedSeasonType]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(testUrl);
      const label = seasonTypeOptions.find(o => o.value === selectedSeasonType)?.label;
      toast({ title: 'Copied!', description: `${label} Week ${selectedWeek} test link copied` });
    } catch {
      toast({ title: 'Error', description: 'Failed to copy link', variant: 'destructive' });
    }
  };

  const selectedLabel = seasonTypeOptions.find(o => o.value === selectedSeasonType)?.label || '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div>
          <p style={{ ...bc, fontWeight: 800, fontSize: '0.95rem', color: text, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.15rem' }}>Test Weekly Picks</p>
          <p style={{ ...b, fontSize: '0.78rem', color: textDim }}>Test the participant experience for different weeks</p>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.25rem 0.65rem', background: surface, border: `1px solid ${border}`, borderRadius: 20 }}>
          <Users style={{ width: 11, height: 11, color: textMid }} />
          <span style={{ ...bc, fontSize: '0.68rem', fontWeight: 700, color: textMid, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{poolName}</span>
        </div>
      </div>

      {/* Week selection */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
          <Calendar style={{ width: 14, height: 14, color: textMid }} />
          <p style={{ ...bc, fontWeight: 800, fontSize: '0.85rem', color: text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Select Week to Test</p>
        </div>
        <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginBottom: '1rem' }}>Choose which week&apos;s picks you want to test</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
          <div>
            <label style={labelStyle}>Season Type</label>
            <Select value={selectedSeasonType.toString()} onValueChange={(v) => {
              const n = parseInt(v);
              setSelectedSeasonType(n);
              const opt = seasonTypeOptions.find(o => o.value === n);
              if (opt?.weeks.length) setSelectedWeek(opt.weeks[0]);
              setAvailableWeeks(opt?.weeks || seasonTypeOptions[0]?.weeks || []);
            }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {seasonTypeOptions.map(o => (
                  <SelectItem key={o.value} value={o.value.toString()}>
                    {o.label} <span style={{ color: textDim, fontSize: '0.75em' }}>({o.weeks.length} wks)</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label style={labelStyle}>Week</label>
            <Select value={selectedWeek.toString()} onValueChange={(v) => setSelectedWeek(parseInt(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {availableWeeks.map(w => (
                  <SelectItem key={w} value={w.toString()}>
                    Week {w}{w === currentWeek ? ' (Current)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* URL row */}
        <div style={{ marginBottom: '0.85rem' }}>
          <label style={labelStyle}>Test URL</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input type="text" value={testUrl} readOnly style={{ flex: 1, ...b, background: surface, border: `1px solid ${border}`, color: textMid, padding: '0.45rem 0.75rem', borderRadius: 6, fontSize: '0.8rem', boxSizing: 'border-box' }} />
            <button onClick={handleCopyLink} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.75rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 6, cursor: 'pointer', ...bc, fontWeight: 700, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              <Share2 style={{ width: 12, height: 12 }} />
              Copy
            </button>
          </div>
        </div>

        {/* Test button */}
        <button onClick={() => window.open(testUrl, '_blank')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', width: '100%', padding: '0.6rem', background: green, color: text, border: 'none', borderRadius: 6, cursor: 'pointer', ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
          <ExternalLink style={{ width: 13, height: 13 }} />
          Test {selectedLabel} Week {selectedWeek} Picks
        </button>
      </div>

      {/* Instructions */}
      <div style={cardStyle}>
        <p style={{ ...bc, fontWeight: 800, fontSize: '0.85rem', color: text, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>How to Test</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[
            { n: 1, title: 'Select a Week', desc: 'Choose which week you want to test from the dropdown above' },
            { n: 2, title: 'Click "Test Picks"', desc: 'This will open the participant page in a new tab' },
            { n: 3, title: 'Test the Experience', desc: 'Try making picks, checking the leaderboard, and testing all features' },
            { n: 4, title: 'Share the Link', desc: 'Copy the test URL to share with participants for that specific week' },
          ].map(({ n, title, desc }) => (
            <div key={n} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <span style={{ ...bc, fontWeight: 800, fontSize: '0.72rem', color: greenHi, width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: `color-mix(in oklch, ${greenHi} 12%, ${surface})`, border: `1px solid color-mix(in oklch, ${greenHi} 30%, ${border})` }}>{n}</span>
              <div>
                <p style={{ ...bc, fontWeight: 700, fontSize: '0.82rem', color: text }}>{title}</p>
                <p style={{ ...b, fontSize: '0.75rem', color: textDim, marginTop: '0.15rem' }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Current week callout */}
      {selectedWeek === currentWeek && (
        <div style={{ padding: '0.85rem 1rem', background: `color-mix(in oklch, ${greenHi} 8%, ${surface})`, border: `1px solid color-mix(in oklch, ${greenHi} 25%, ${border})`, borderRadius: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
            <Calendar style={{ width: 13, height: 13, color: greenHi }} />
            <span style={{ ...bc, fontWeight: 700, fontSize: '0.75rem', color: greenHi, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Testing Current Week</span>
          </div>
          <p style={{ ...b, fontSize: '0.78rem', color: textDim }}>
            You&apos;re testing Week {currentWeek}, the current active week. This is what participants see with the regular pool link.
          </p>
        </div>
      )}
    </div>
  );
}
