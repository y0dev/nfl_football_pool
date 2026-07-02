'use client';

import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, FileSpreadsheet, Calendar, Trophy, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PERIOD_WEEKS, debugError} from '@/lib/utils';
import { useAuth } from '@/lib/auth';

// Design tokens
const bg      = 'oklch(13% 0.025 255)';
const surface = 'oklch(17% 0.028 255)';
const card    = 'oklch(20% 0.03 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const gold    = 'oklch(74% 0.16 72)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const purple  = 'oklch(65% 0.12 290)';
const amber   = 'oklch(72% 0.16 60)';

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

interface ExportDataProps {
  poolId: string;
  poolName: string;
  currentWeek?: number;
  currentSeason?: number;
}

const labelStyle = {
  ...bc, fontSize: '0.68rem', fontWeight: 700 as const,
  letterSpacing: '0.08em', color: textDim,
  textTransform: 'uppercase' as const,
  display: 'block', marginBottom: '0.4rem',
};

const seasonInputStyle = {
  ...b,
  background: card,
  border: `1px solid oklch(30% 0.03 255)`,
  color: text,
  fontSize: '0.88rem',
  width: '100%',
  height: '2.5rem',
  padding: '0 0.75rem',
  borderRadius: 6,
  boxSizing: 'border-box' as const,
  appearance: 'auto' as const,
};

export function ExportData({ poolId, poolName, currentWeek = 1, currentSeason = new Date().getFullYear() }: ExportDataProps) {
  const [isExportingWeekly, setIsExportingWeekly] = useState(false);
  const [isExportingPeriod, setIsExportingPeriod] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(currentWeek.toString());
  const [selectedSeason, setSelectedSeason] = useState(currentSeason.toString());
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [selectedSeasonType, setSelectedSeasonType] = useState('2');
  const [pools, setPools] = useState<any[]>([]);
  const [selectedPoolId, setSelectedPoolId] = useState(poolId);
  const [isLoadingPools, setIsLoadingPools] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const isSystemWide = poolId === 'system-wide';

  useEffect(() => {
    if (isSystemWide && user?.email) loadPools();
  }, [isSystemWide, user?.email]);

  const loadPools = async () => {
    setIsLoadingPools(true);
    try {
      const res = await fetch('/api/admin/all-pools');
      if (!res.ok) throw new Error('Failed to load pools');
      const data = await res.json();
      const poolsData = data.pools || [];
      setPools(poolsData);
      if (poolsData.length > 0) setSelectedPoolId(poolsData[0].id);
    } catch (error) {
      debugError('Error loading pools:', error);
      toast({ title: 'Error', description: 'Failed to load pools', variant: 'destructive' });
    } finally {
      setIsLoadingPools(false);
    }
  };

  const handleExportWeeklyPicks = async () => {
    if (!selectedPoolId || selectedPoolId === 'system-wide') {
      toast({ title: 'Selection Required', description: 'Please select a pool to export data from.', variant: 'destructive' });
      return;
    }
    const week = parseInt(selectedWeek);
    const season = parseInt(selectedSeason);
    const seasonType = parseInt(selectedSeasonType);
    if (isNaN(week) || isNaN(season) || isNaN(seasonType)) {
      toast({ title: 'Invalid Input', description: 'Please enter valid week, season, and season type values.', variant: 'destructive' });
      return;
    }
    setIsExportingWeekly(true);
    try {
      const response = await fetch('/api/admin/export/weekly-picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poolId: selectedPoolId, week, season, seasonType }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Export failed');
      }
      const csvContent = await response.text();
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.setAttribute('href', URL.createObjectURL(blob));
      link.setAttribute('download', `pool-${selectedPoolId}-week-${selectedWeek}-season-${selectedSeason}-picks.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: 'Export Successful', description: `Weekly picks for Week ${selectedWeek} have been exported successfully.` });
    } catch (error) {
      debugError('Error exporting weekly picks:', error);
      toast({ title: 'Export Failed', description: error instanceof Error ? error.message : 'Failed to export weekly picks', variant: 'destructive' });
    } finally {
      setIsExportingWeekly(false);
    }
  };

  const handleExportPeriodData = async () => {
    if (!selectedPoolId || selectedPoolId === 'system-wide') {
      toast({ title: 'Selection Required', description: 'Please select a pool to export data from.', variant: 'destructive' });
      return;
    }
    if (!selectedPeriod) {
      toast({ title: 'Selection Required', description: 'Please select a period to export.', variant: 'destructive' });
      return;
    }
    const season = parseInt(selectedSeason);
    if (isNaN(season)) {
      toast({ title: 'Invalid Input', description: 'Please enter a valid season value.', variant: 'destructive' });
      return;
    }
    setIsExportingPeriod(true);
    try {
      const response = await fetch('/api/admin/export/period-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poolId: selectedPoolId, periodName: selectedPeriod, season }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Export failed');
      }
      const csvContent = await response.text();
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.setAttribute('href', URL.createObjectURL(blob));
      link.setAttribute('download', `pool-${selectedPoolId}-${selectedPeriod.replace(/\s+/g, '-').toLowerCase()}-season-${selectedSeason}-period-data.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: 'Export Successful', description: `Period data for ${selectedPeriod} has been exported successfully.` });
    } catch (error) {
      debugError('Error exporting period data:', error);
      toast({ title: 'Export Failed', description: error instanceof Error ? error.message : 'Failed to export period data', variant: 'destructive' });
    } finally {
      setIsExportingPeriod(false);
    }
  };

  const isPeriodWeek = PERIOD_WEEKS.includes(parseInt(selectedWeek) as typeof PERIOD_WEEKS[number]);

  const cardStyle = {
    background: card,
    border: `1px solid ${border}`,
    borderRadius: 8,
    overflow: 'hidden' as const,
  };

  const cardHeaderStyle = {
    display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
    padding: '1rem 1.25rem',
    background: surface,
    borderBottom: `1px solid ${border}`,
  };

  const cardBodyStyle = {
    padding: '1.25rem',
    display: 'flex', flexDirection: 'column' as const, gap: '1rem',
  };

  const actionBtnStyle = (disabled: boolean, accent = green) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem',
    width: '100%', padding: '0.6rem 1rem',
    background: disabled ? 'oklch(22% 0.03 255)' : accent,
    color: disabled ? textDim : text,
    border: 'none', borderRadius: 6,
    ...bc, fontWeight: 700, fontSize: '0.82rem',
    letterSpacing: '0.08em', textTransform: 'uppercase' as const,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'background 0.15s',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── Weekly Picks Export ── */}
      <div style={{ ...cardStyle, borderLeft: `3px solid ${greenHi}` }}>
        <div style={cardHeaderStyle}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'oklch(46% 0.14 155 / 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <FileSpreadsheet style={{ width: 16, height: 16, color: greenHi }} />
          </div>
          <div>
            <h3 style={{ ...bc, fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase' }}>
              Export Weekly Picks
            </h3>
            <p style={{ ...b, fontSize: '0.75rem', color: textDim, marginTop: '0.2rem' }}>
              Export all picks for a specific week in CSV format. Includes game results, confidence points, and Monday night scores.
            </p>
          </div>
        </div>

        <div style={cardBodyStyle}>
          {/* Pool selector (system-wide only) */}
          {isSystemWide && (
            <div>
              <label style={labelStyle}>Pool</label>
              <Select value={selectedPoolId} onValueChange={setSelectedPoolId} disabled={isLoadingPools}>
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingPools ? 'Loading pools…' : 'Select a pool'} />
                </SelectTrigger>
                <SelectContent>
                  {pools.map(pool => (
                    <SelectItem key={pool.id} value={pool.id}>
                      {pool.name} ({pool.is_active ? 'Active' : 'Inactive'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {pools.length === 0 && !isLoadingPools && (
                <p style={{ ...b, fontSize: '0.75rem', color: textDim, marginTop: '0.3rem' }}>No pools available</p>
              )}
            </div>
          )}

          <div className="admin-3col-grid" style={{ marginBottom: 0 }}>
            <div>
              <label style={labelStyle}>Week</label>
              <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                <SelectTrigger>
                  <SelectValue placeholder="Select week" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 18 }, (_, i) => i + 1).map(week => (
                    <SelectItem key={week} value={week.toString()}>
                      Week {week}{PERIOD_WEEKS.includes(week as typeof PERIOD_WEEKS[number]) ? ' (Tie-breaker)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label style={labelStyle}>Season</label>
              <input
                type="number"
                value={selectedSeason}
                onChange={(e) => setSelectedSeason(e.target.value)}
                min="2020"
                max="2030"
                step="1"
                style={seasonInputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Season Type</label>
              <Select value={selectedSeasonType} onValueChange={setSelectedSeasonType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select season type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Preseason</SelectItem>
                  <SelectItem value="2">Regular Season</SelectItem>
                  <SelectItem value="3">Postseason</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isPeriodWeek && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
              padding: '0.75rem 1rem',
              background: 'oklch(72% 0.16 60 / 0.1)',
              border: `1px solid oklch(72% 0.16 60 / 0.35)`,
              borderRadius: 6,
            }}>
              <Calendar style={{ width: 15, height: 15, color: amber, flexShrink: 0, marginTop: 2 }} />
              <div>
                <p style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.06em', color: amber, textTransform: 'uppercase' }}>
                  Tie-breaker Week Detected
                </p>
                <p style={{ ...b, fontSize: '0.75rem', color: textMid, marginTop: '0.2rem' }}>
                  Monday night scores (tie breakers) will be included in the export.
                </p>
              </div>
            </div>
          )}

          <button
            onClick={handleExportWeeklyPicks}
            disabled={isExportingWeekly || (isSystemWide && !selectedPoolId)}
            style={actionBtnStyle(isExportingWeekly || (isSystemWide && !selectedPoolId))}
          >
            <Download style={{ width: 14, height: 14 }} />
            {isExportingWeekly ? 'Exporting…' : 'Export Weekly Picks'}
          </button>
        </div>
      </div>

      {/* ── Period Data Export ── */}
      <div style={{ ...cardStyle, borderLeft: `3px solid ${purple}` }}>
        <div style={cardHeaderStyle}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'oklch(65% 0.12 290 / 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Trophy style={{ width: 16, height: 16, color: purple }} />
          </div>
          <div>
            <h3 style={{ ...bc, fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase' }}>
              Export Period Data
            </h3>
            <p style={{ ...b, fontSize: '0.75rem', color: textDim, marginTop: '0.2rem' }}>
              Export complete period standings and calculations. Includes weekly breakdowns, total points, and period rankings.
            </p>
          </div>
        </div>

        <div style={cardBodyStyle}>
          {isSystemWide && (
            <div>
              <label style={labelStyle}>Pool</label>
              <Select value={selectedPoolId} onValueChange={setSelectedPoolId} disabled={isLoadingPools}>
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingPools ? 'Loading pools…' : 'Select a pool'} />
                </SelectTrigger>
                <SelectContent>
                  {pools.map(pool => (
                    <SelectItem key={pool.id} value={pool.id}>
                      {pool.name} ({pool.is_active ? 'Active' : 'Inactive'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {pools.length === 0 && !isLoadingPools && (
                <p style={{ ...b, fontSize: '0.75rem', color: textDim, marginTop: '0.3rem' }}>No pools available</p>
              )}
            </div>
          )}

          <div className="admin-2col-grid" style={{ marginBottom: 0 }}>
            <div>
              <label style={labelStyle}>Period</label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Period 1">Period 1 (Weeks 1–4)</SelectItem>
                  <SelectItem value="Period 2">Period 2 (Weeks 5–9)</SelectItem>
                  <SelectItem value="Period 3">Period 3 (Weeks 10–14)</SelectItem>
                  <SelectItem value="Period 4">Period 4 (Weeks 15–18)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label style={labelStyle}>Season</label>
              <input
                type="number"
                value={selectedSeason}
                onChange={(e) => setSelectedSeason(e.target.value)}
                min="2020"
                max="2030"
                step="1"
                style={seasonInputStyle}
              />
            </div>
          </div>

          <button
            onClick={handleExportPeriodData}
            disabled={isExportingPeriod || !selectedPeriod || (isSystemWide && !selectedPoolId)}
            style={actionBtnStyle(isExportingPeriod || !selectedPeriod || (isSystemWide && !selectedPoolId), purple)}
          >
            <Download style={{ width: 14, height: 14 }} />
            {isExportingPeriod ? 'Exporting…' : 'Export Period Data'}
          </button>
        </div>
      </div>

      {/* ── Info card ── */}
      <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', borderBottom: `1px solid ${border}` }}>
          <Info style={{ width: 14, height: 14, color: textDim }} />
          <span style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase' }}>
            Export Information
          </span>
        </div>
        <div style={{ padding: '1rem 1.25rem', display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
          <div>
            <p style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.4rem' }}>
              Weekly Picks Export includes:
            </p>
            <ul style={{ ...b, fontSize: '0.78rem', color: textDim, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              {['All participant picks with confidence points', 'Game results and actual winners', 'Points earned for each pick', 'Monday night scores (tie-breaker weeks)', 'Game kickoff times and status'].map(item => (
                <li key={item} style={{ listStyleType: 'disc' }}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <p style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', color: purple, textTransform: 'uppercase', marginBottom: '0.4rem' }}>
              Period Data Export includes:
            </p>
            <ul style={{ ...b, fontSize: '0.78rem', color: textDim, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              {['Total points and correct picks for the period', 'Weekly breakdown for each participant', 'Weeks won count', 'Accuracy percentages', 'Period rankings'].map(item => (
                <li key={item} style={{ listStyleType: 'disc' }}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
