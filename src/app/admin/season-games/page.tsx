'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ArrowLeft, Calendar, RefreshCw, LogOut, ChevronDown, ChevronRight,
  Download, Trash2, Lock, Unlock, CheckCircle2, AlertTriangle, Loader2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { AuthProvider } from '@/lib/auth';
import { AdminGuard } from '@/components/auth/admin-guard';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Footer } from '@/components/layout/Footer';

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
const liveRed = 'oklch(62% 0.22 25)';
const amber   = 'oklch(78% 0.15 70)';
const purple  = 'oklch(65% 0.12 290)';

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

interface WeekGame {
  id: string;
  home_team: string;
  away_team: string;
  time?: string;
  date?: string;
  kickoff_time?: string;
  week: number;
  season: number;
  season_type: number;
  home_team_id?: string;
  away_team_id?: string;
  game_status?: string;
  home_score?: number | null;
  away_score?: number | null;
  winner?: string | null;
}

interface WeekData {
  week: number;
  games: WeekGame[];
}

const SEASON_TYPES = [
  { value: 1, label: 'Preseason', weeks: 4 },
  { value: 2, label: 'Regular Season', weeks: 18 },
  { value: 3, label: 'Playoffs', weeks: 4 },
];

const currentYear = new Date().getFullYear();
const YEARS = [currentYear - 1, currentYear, currentYear + 1];


function formatKickoff(isoStr?: string): string {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    return d.toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    }) + ' CT';
  } catch {
    return isoStr;
  }
}

function gameKickoff(g: WeekGame): string {
  return formatKickoff(g.kickoff_time ?? g.time ?? g.date);
}

function WeekCard({
  weekData, isExpanded, onToggle, locked, onLock, isExisting, isProcessing,
}: {
  weekData: WeekData;
  isExpanded: boolean;
  onToggle: () => void;
  locked: boolean;
  onLock: (locked: boolean) => void;
  isExisting: boolean;
  isProcessing: boolean;
}) {
  const first = weekData.games[0];
  const kickoffRange = first ? formatKickoff(first.kickoff_time ?? first.time ?? first.date) : '';

  const finalCount     = weekData.games.filter(g => g.game_status === 'final').length;
  const liveCount      = weekData.games.filter(g => g.game_status === 'live').length;
  const scheduledCount = weekData.games.length - finalCount - liveCount;
  const allFinal       = isExisting && finalCount === weekData.games.length;

  return (
    <div style={{ background: surface, border: `1px solid ${locked ? amber + '80' : border}`, borderLeft: `3px solid ${allFinal ? textDim : locked ? amber : green}`, borderRadius: 8, overflow: 'hidden' }}>
      <button
        onClick={onToggle}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1rem', background: 'transparent', border: 'none', cursor: 'pointer', gap: '1rem' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {isExpanded
            ? <ChevronDown style={{ width: 14, height: 14, color: textDim, flexShrink: 0 }} />
            : <ChevronRight style={{ width: 14, height: 14, color: textDim, flexShrink: 0 }} />}
          <span style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', color: allFinal ? textMid : text, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Week {weekData.week}
          </span>
          {isExisting ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              {finalCount > 0 && <span style={{ ...bc, fontWeight: 600, fontSize: '0.62rem', letterSpacing: '0.08em', color: textDim, background: 'oklch(50% 0.018 255 / 0.15)', padding: '0.1rem 0.4rem', borderRadius: 3, textTransform: 'uppercase' }}>{finalCount} Final</span>}
              {liveCount > 0 && <span style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.08em', color: liveRed, background: 'oklch(62% 0.22 25 / 0.12)', padding: '0.1rem 0.4rem', borderRadius: 3, textTransform: 'uppercase' }}>● {liveCount} Live</span>}
              {scheduledCount > 0 && <span style={{ ...bc, fontWeight: 600, fontSize: '0.62rem', letterSpacing: '0.08em', color: greenHi, background: 'oklch(46% 0.14 155 / 0.12)', padding: '0.1rem 0.4rem', borderRadius: 3, textTransform: 'uppercase' }}>{scheduledCount} Upcoming</span>}
            </span>
          ) : (
            <span style={{ ...bc, fontWeight: 600, fontSize: '0.65rem', letterSpacing: '0.08em', color: greenHi, background: 'oklch(46% 0.14 155 / 0.12)', padding: '0.1rem 0.4rem', borderRadius: 3, textTransform: 'uppercase' }}>
              {weekData.games.length} games
            </span>
          )}
          {locked && (
            <span style={{ ...bc, fontWeight: 600, fontSize: '0.62rem', letterSpacing: '0.08em', color: amber, background: 'oklch(78% 0.15 70 / 0.12)', padding: '0.1rem 0.4rem', borderRadius: 3, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Lock style={{ width: 9, height: 9 }} /> Locked
            </span>
          )}
        </div>
        <span style={{ ...b, fontSize: '0.72rem', color: textDim, flexShrink: 0 }}>{kickoffRange}</span>
      </button>

      {isExpanded && (
        <div style={{ borderTop: `1px solid ${border}` }}>
          <div style={{ padding: '0.5rem 1rem 1rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.09em', color: textDim, textTransform: 'uppercase', padding: '0.4rem 0.5rem', textAlign: 'left', borderBottom: `1px solid ${border}` }}>Matchup</th>
                  <th style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.09em', color: textDim, textTransform: 'uppercase', padding: '0.4rem 0.5rem', textAlign: 'left', borderBottom: `1px solid ${border}` }}>Kickoff</th>
                  {isExisting && <th style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.09em', color: textDim, textTransform: 'uppercase', padding: '0.4rem 0.5rem', textAlign: 'left', borderBottom: `1px solid ${border}` }}>Result</th>}
                </tr>
              </thead>
              <tbody>
                {weekData.games.map((g, i) => {
                  const isFinal = g.game_status === 'final';
                  const isLive  = g.game_status === 'live';
                  const hasScore = (isFinal || isLive) && g.away_score != null && g.home_score != null;
                  const awayWon = hasScore && g.away_score! > g.home_score!;
                  const homeWon = hasScore && g.home_score! > g.away_score!;
                  return (
                    <tr key={g.id} style={{ background: i % 2 === 0 ? 'transparent' : 'oklch(17% 0.028 255 / 0.4)' }}>
                      <td style={{ padding: '0.45rem 0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <span style={{ ...b, fontSize: '0.8rem', color: hasScore && !awayWon ? textMid : text, fontWeight: awayWon ? 700 : 400 }}>{g.away_team}</span>
                          {hasScore && <span style={{ ...bc, fontWeight: 900, fontSize: '0.95rem', color: awayWon ? text : textDim, minWidth: '1.5ch', textAlign: 'right' }}>{g.away_score}</span>}
                          <span style={{ ...b, fontSize: '0.7rem', color: textDim }}>@</span>
                          {hasScore && <span style={{ ...bc, fontWeight: 900, fontSize: '0.95rem', color: homeWon ? text : textDim, minWidth: '1.5ch' }}>{g.home_score}</span>}
                          <span style={{ ...b, fontSize: '0.8rem', color: hasScore && !homeWon ? textMid : text, fontWeight: homeWon ? 700 : 400 }}>{g.home_team}</span>
                          {isLive && <span style={{ ...bc, fontWeight: 700, fontSize: '0.58rem', color: liveRed, background: 'oklch(62% 0.22 25 / 0.15)', padding: '0.1rem 0.3rem', borderRadius: 3, letterSpacing: '0.08em', textTransform: 'uppercase', animation: 'pulse 2s infinite' }}>Live</span>}
                        </div>
                      </td>
                      <td style={{ ...b, fontSize: '0.75rem', color: textDim, padding: '0.45rem 0.5rem', whiteSpace: 'nowrap' }}>{gameKickoff(g)}</td>
                      {isExisting && (
                        <td style={{ padding: '0.45rem 0.5rem' }}>
                          <span style={{ ...bc, fontWeight: 600, fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: isFinal ? textDim : isLive ? liveRed : greenHi, background: isFinal ? 'oklch(50% 0.018 255 / 0.1)' : isLive ? 'oklch(62% 0.22 25 / 0.1)' : 'oklch(46% 0.14 155 / 0.1)', padding: '0.1rem 0.35rem', borderRadius: 3 }}>
                            {isFinal ? 'Final' : isLive ? '● Live' : g.game_status ?? 'Scheduled'}
                          </span>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {isExisting && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                <button
                  onClick={() => onLock(!locked)}
                  disabled={isProcessing}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.65rem', background: locked ? 'oklch(78% 0.15 70 / 0.12)' : 'transparent', color: locked ? amber : textMid, border: `1px solid ${locked ? amber + '80' : border}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.65rem', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: isProcessing ? 'not-allowed' : 'pointer', opacity: isProcessing ? 0.6 : 1 }}
                >
                  {locked ? <><Unlock style={{ width: 10, height: 10 }} /> Unlock Week</> : <><Lock style={{ width: 10, height: 10 }} /> Lock Week</>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SeasonGamesContent() {
  const { signOut } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [season, setSeason]           = useState(currentYear);
  const [seasonType, setSeasonType]   = useState(2);
  const [existingWeeks, setExistingWeeks] = useState<WeekData[]>([]);
  const [previewWeeks, setPreviewWeeks]   = useState<WeekData[]>([]);
  const [lockedWeeks, setLockedWeeks]     = useState<Set<number>>(new Set());
  const [expandedExisting, setExpandedExisting] = useState<Set<number>>(new Set());
  const [expandedPreview, setExpandedPreview]   = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading]       = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [genProgress, setGenProgress]   = useState({ current: 0, total: 0 });
  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [importResult, setImportResult] = useState<{ gamesImported: number } | null>(null);

  const abortRef = useRef(false);
  const maxWeeks = SEASON_TYPES.find(s => s.value === seasonType)?.weeks ?? 18;

  const loadExisting = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/season-games?season=${season}&seasonType=${seasonType}`);
      const data = await res.json();
      if (data.success) setExistingWeeks(data.weeks ?? []);
    } catch {
      toast({ title: 'Error', description: 'Failed to load existing schedule', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [season, seasonType, toast]);

  const loadLockedWeeks = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/games/lock-week?season=${season}&seasonType=${seasonType}`);
      const data = await res.json();
      if (data.success) setLockedWeeks(new Set(data.lockedWeeks ?? []));
    } catch {
      setLockedWeeks(new Set());
    }
  }, [season, seasonType]);

  useEffect(() => {
    setPreviewWeeks([]);
    setImportResult(null);
    Promise.all([loadExisting(), loadLockedWeeks()]);
  }, [loadExisting, loadLockedWeeks]);

  const handleGenerate = async () => {
    abortRef.current = false;
    setIsGenerating(true);
    setPreviewWeeks([]);
    setImportResult(null);
    setExpandedPreview(new Set());

    let startWeek = 0;
    let totalWeeks = maxWeeks;
    // week number → { start, end } in YYYYMMDD (dashes stripped from weekSchedule ISO strings)
    const weekRangeMap = new Map<number, { start: string; end: string }>();

    // Fetch /current to get the computed week schedule (date windows per week).
    // For the current year it also returns live game data for the active week.
    try {
      setGenProgress({ current: 0, total: maxWeeks });
      const res = await fetch(`/api/admin/season-games/current?seasonType=${seasonType}`);
      const data = await res.json();

      if (data.success) {
        console.log('Received current season data:', data);
        if (data.totalWeeks > 0) totalWeeks = data.totalWeeks;

        // Build map from weekSchedule — strip dashes to convert ISO → YYYYMMDD
        (data.weekSchedule ?? []).forEach((w: { week: number; weekStart: string; weekEnd: string }) => {
          if (w.weekStart && w.weekEnd) {
            weekRangeMap.set(w.week, {
              start: w.weekStart.replace(/-/g, ''),
              end:   w.weekEnd.replace(/-/g, ''),
            });
          }
        });

        // For the current year, use live games from /current for the active week
        if (season === currentYear && data.games?.length > 0) {
          startWeek = data.week;
          setPreviewWeeks([{ week: data.week, games: data.games }]);
          setGenProgress({ current: data.week, total: totalWeeks });
        }
      }
    } catch {
      // Fall back to starting from week 1 with no date windows
    }

    // Fetch remaining weeks using the date windows from weekSchedule
    for (let week = startWeek + 1; week <= totalWeeks; week++) {
      if (abortRef.current) break;
      setGenProgress({ current: week, total: totalWeeks });

      const range = weekRangeMap.get(week);
      if (!range) continue; // no window for this week in the schedule — skip
      try {
        const res = await fetch('/api/admin/season-games/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ weekStart: range.start, weekEnd: range.end, week }),
        });
        const data = await res.json();
        console.log(`Received generated games for week ${week}:`, data);
        if (data.success && data.games.length > 0) {
          setPreviewWeeks(prev => [...prev, { week: data.week, games: data.games }]);
        }
      } catch {
        // Skip failed weeks silently
      }
    }

    setIsGenerating(false);
  };

  const handleStopGenerate = () => {
    abortRef.current = true;
    setIsGenerating(false);
  };

  const handleSubmit = async () => {
    if (previewWeeks.length === 0) return;
    setIsSubmitting(true);
    try {
      const allGames = previewWeeks.flatMap(w => w.games);
      const res = await fetch('/api/admin/season-games/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ games: allGames }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setImportResult({ gamesImported: data.gamesImported });
      setPreviewWeeks([]);
      toast({ title: 'Season Imported', description: `${data.gamesImported} games added to the database` });
      await loadExisting();
    } catch (e) {
      toast({ title: 'Import Failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRollback = async () => {
    setIsProcessing(true);
    setRollbackOpen(false);
    try {
      const res = await fetch('/api/admin/season-games/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season, seasonType }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setExistingWeeks([]);
      setLockedWeeks(new Set());
      setImportResult(null);
      toast({ title: 'Rollback Complete', description: `${data.gamesDeleted ?? 'All'} games removed for Season ${season}` });
    } catch (e) {
      toast({ title: 'Rollback Failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLockWeek = async (week: number, lock: boolean) => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/admin/games/lock-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season, week, seasonType, locked: lock }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? 'Lock failed');
      setLockedWeeks(prev => {
        const next = new Set(prev);
        lock ? next.add(week) : next.delete(week);
        return next;
      });
      toast({ title: lock ? 'Week Locked' : 'Week Unlocked', description: `Week ${week} is now ${lock ? 'locked' : 'unlocked'}` });
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try { await signOut(); router.push('/admin/login'); }
    catch { setIsLoggingOut(false); }
  };

  const totalPreviewGames = useMemo(() => previewWeeks.reduce((s, w) => s + w.games.length, 0), [previewWeeks]);
  const seasonTypeLabel = SEASON_TYPES.find(s => s.value === seasonType)?.label ?? '';

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
        <div className="animate-spin rounded-full h-16 w-16" style={{ borderWidth: '3px', borderStyle: 'solid', borderColor: border, borderTopColor: green }} />
      </div>
    );
  }

  return (
    <div style={{ background: bg, minHeight: '100vh' }}>

      {/* ── NAV ── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'oklch(13% 0.025 255 / 0.95)', backdropFilter: 'blur(14px)', borderBottom: `1px solid ${border}` }}>
        <div className="lp-inner" style={{ paddingTop: '0.75rem', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
              <button onClick={() => router.push('/admin/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.6rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}>
                <ArrowLeft style={{ width: 12, height: 12 }} /> Back
              </button>
              <div style={{ width: 1, height: 20, background: border }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: green, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Calendar style={{ width: 14, height: 14, color: text }} />
                </div>
                <span style={{ ...bc, fontWeight: 800, fontSize: '0.92rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase' }}>Season Games</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
              <button onClick={() => Promise.all([loadExisting(), loadLockedWeeks()])} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.75rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 6, ...bc, fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}>
                <RefreshCw style={{ width: 12, height: 12 }} /> Refresh
              </button>
              <button onClick={handleLogout} disabled={isLoggingOut} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.75rem', background: liveRed, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: isLoggingOut ? 'not-allowed' : 'pointer', opacity: isLoggingOut ? 0.6 : 1 }}>
                <LogOut style={{ width: 12, height: 12 }} /> Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── CONTROLS ── */}
      <section style={{ background: surface, padding: '2rem 0', borderBottom: `1px solid ${border}` }}>
        <div className="lp-inner">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap' }}>

            {/* Season year */}
            <div>
              <label style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.09em', color: textDim, textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem' }}>Season Year</label>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                {YEARS.map(y => (
                  <button key={y} onClick={() => setSeason(y)} style={{ padding: '0.4rem 0.75rem', background: season === y ? green : 'transparent', color: season === y ? text : textMid, border: `1px solid ${season === y ? green : border}`, borderRadius: 5, ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.06em', cursor: 'pointer' }}>
                    {y}
                  </button>
                ))}
              </div>
            </div>

            {/* Season type */}
            <div>
              <label style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.09em', color: textDim, textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem' }}>Season Type</label>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                {SEASON_TYPES.map(st => (
                  <button key={st.value} onClick={() => setSeasonType(st.value)} style={{ padding: '0.4rem 0.75rem', background: seasonType === st.value ? green : 'transparent', color: seasonType === st.value ? text : textMid, border: `1px solid ${seasonType === st.value ? green : border}`, borderRadius: 5, ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.06em', cursor: 'pointer' }}>
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate */}
            <div style={{ marginLeft: 'auto' }}>
              {isGenerating ? (
                <button onClick={handleStopGenerate} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: 'oklch(62% 0.22 25 / 0.12)', color: liveRed, border: `1px solid ${liveRed}`, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  <Loader2 style={{ width: 13, height: 13, animation: 'spin 0.8s linear infinite' }} />
                  Stop ({genProgress.current}/{genProgress.total})
                </button>
              ) : (
                <button onClick={handleGenerate} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  <Download style={{ width: 13, height: 13 }} />
                  Generate {season} {seasonTypeLabel} Preview
                </button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {isGenerating && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ ...b, fontSize: '0.75rem', color: textMid }}>Fetching Week {genProgress.current} of {genProgress.total} from ESPN…</span>
                <span style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', color: greenHi }}>{previewWeeks.length} weeks ready</span>
              </div>
              <div style={{ height: 4, background: border, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: green, borderRadius: 2, width: `${(genProgress.current / genProgress.total) * 100}%`, transition: 'width 0.3s ease' }} />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── green rule ── */}
      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${green}, transparent)` }} />

      {/* ── PREVIEW ── */}
      {previewWeeks.length > 0 && (
        <section style={{ background: bg, padding: '2.5rem 0' }}>
          <div className="lp-inner">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ display: 'block', width: 3, height: 22, background: purple, borderRadius: 2 }} />
                <h2 style={{ ...bc, fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.06em', color: text, textTransform: 'uppercase' }}>
                  Preview — {previewWeeks.length} Weeks · {totalPreviewGames} Games
                </h2>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => setPreviewWeeks([])} style={{ padding: '0.4rem 0.75rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  Clear Preview
                </button>
                <button onClick={handleSubmit} disabled={isSubmitting || totalPreviewGames === 0} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.875rem', background: green, color: text, border: 'none', borderRadius: 5, ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: (isSubmitting || totalPreviewGames === 0) ? 'not-allowed' : 'pointer', opacity: (isSubmitting || totalPreviewGames === 0) ? 0.6 : 1 }}>
                  {isSubmitting ? <><RefreshCw style={{ width: 12, height: 12, animation: 'spin 0.8s linear infinite' }} /> Importing…</> : <><CheckCircle2 style={{ width: 12, height: 12 }} /> Submit {totalPreviewGames} Games</>}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {previewWeeks.map(w => (
                <WeekCard
                  key={w.week}
                  weekData={w}
                  isExpanded={expandedPreview.has(w.week)}
                  onToggle={() => setExpandedPreview(prev => { const n = new Set(prev); n.has(w.week) ? n.delete(w.week) : n.add(w.week); return n; })}
                  locked={false}
                  onLock={() => {}}
                  isExisting={false}
                  isProcessing={false}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── IMPORT SUCCESS BANNER ── */}
      {importResult && (
        <section style={{ background: bg, padding: '1rem 0' }}>
          <div className="lp-inner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem', background: 'oklch(46% 0.14 155 / 0.1)', border: `1px solid oklch(46% 0.14 155 / 0.3)`, borderRadius: 8 }}>
              <CheckCircle2 style={{ width: 18, height: 18, color: greenHi, flexShrink: 0 }} />
              <span style={{ ...b, fontSize: '0.875rem', color: text }}>
                Successfully imported <strong style={{ color: greenHi }}>{importResult.gamesImported} games</strong> for the {season} {seasonTypeLabel}. The schedule is now live below.
              </span>
            </div>
          </div>
        </section>
      )}

      {/* ── EXISTING SCHEDULE ── */}
      <section style={{ background: bg, padding: '2.5rem 0' }}>
        <div className="lp-inner">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ display: 'block', width: 3, height: 22, background: green, borderRadius: 2 }} />
              <h2 style={{ ...bc, fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.06em', color: text, textTransform: 'uppercase' }}>
                {season} {seasonTypeLabel}
                {existingWeeks.length > 0 && (
                  <span style={{ color: textDim, fontWeight: 600, marginLeft: '0.5rem' }}>
                    — {existingWeeks.length} weeks · {existingWeeks.reduce((s, w) => s + w.games.length, 0)} games
                  </span>
                )}
              </h2>
            </div>
            {existingWeeks.length > 0 && (
              <button onClick={() => setRollbackOpen(true)} disabled={isProcessing} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.75rem', background: 'oklch(50% 0.22 25 / 0.12)', color: liveRed, border: `1px solid oklch(62% 0.22 25 / 0.5)`, borderRadius: 5, ...bc, fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: isProcessing ? 'not-allowed' : 'pointer', opacity: isProcessing ? 0.6 : 1 }}>
                <Trash2 style={{ width: 11, height: 11 }} /> Rollback Season
              </button>
            )}
          </div>

          {existingWeeks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', background: surface, border: `1px solid ${border}`, borderRadius: 8 }}>
              <Calendar style={{ width: 40, height: 40, color: textDim, margin: '0 auto 1rem' }} />
              <p style={{ ...b, color: textMid, fontSize: '0.9rem', marginBottom: '0.4rem' }}>No games in the database for {season} {seasonTypeLabel}.</p>
              <p style={{ ...b, color: textDim, fontSize: '0.8rem' }}>Use Generate Preview above to fetch from ESPN, then Submit to import.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {existingWeeks.map(w => (
                <WeekCard
                  key={w.week}
                  weekData={w}
                  isExpanded={expandedExisting.has(w.week)}
                  onToggle={() => setExpandedExisting(prev => { const n = new Set(prev); n.has(w.week) ? n.delete(w.week) : n.add(w.week); return n; })}
                  locked={lockedWeeks.has(w.week)}
                  onLock={(lock) => handleLockWeek(w.week, lock)}
                  isExisting={true}
                  isProcessing={isProcessing}
                />
              ))}
            </div>
          )}

          {/* Stats footer */}
          {existingWeeks.length > 0 && (
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
              {[
                { label: 'Total Weeks', value: existingWeeks.length, color: gold },
                { label: 'Total Games', value: existingWeeks.reduce((s, w) => s + w.games.length, 0), color: greenHi },
                { label: 'Locked Weeks', value: lockedWeeks.size, color: amber },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: surface, border: `1px solid ${border}`, borderLeft: `3px solid ${color}`, borderRadius: 7, padding: '0.75rem 1rem', minWidth: 100 }}>
                  <div style={{ ...bc, fontWeight: 900, fontSize: '1.75rem', color, lineHeight: 1 }}>{value}</div>
                  <div style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', color: textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '0.2rem' }}>{label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer pageName="Season Games" />

      {/* ── Rollback Confirm ── */}
      <AlertDialog open={rollbackOpen} onOpenChange={setRollbackOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: liveRed, ...bc, fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              <AlertTriangle style={{ width: 16, height: 16 }} /> Rollback {season} {seasonTypeLabel}
            </AlertDialogTitle>
            <AlertDialogDescription style={{ color: textMid }}>
              This will permanently delete <strong style={{ color: text }}>all {existingWeeks.reduce((s, w) => s + w.games.length, 0)} games</strong> for the {season} {seasonTypeLabel} from the database. Pick data may become orphaned. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRollback}
              style={{ background: 'oklch(50% 0.22 25 / 0.2)', color: liveRed, border: `1px solid ${liveRed}` }}
            >
              Delete All Games
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function SeasonGamesPage() {
  return (
    <AuthProvider>
      <AdminGuard requireSuperAdmin={true}>
        <SeasonGamesContent />
      </AdminGuard>
    </AuthProvider>
  );
}
