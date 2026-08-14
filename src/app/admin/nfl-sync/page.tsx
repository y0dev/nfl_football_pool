'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { enUS } from 'date-fns/locale';
import {
  RefreshCw, CheckCircle, XCircle, AlertTriangle,
  Calendar as CalendarIcon, Clock, Trophy,
  Database, Settings, Check, X, CircleDot,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { AuthProvider } from '@/lib/auth';
import { AdminGuard } from '@/components/auth/admin-guard';
import { debugLog, debugError} from '@/lib/utils';
import { Footer } from '@/components/layout/Footer';
import { AppNav } from '@/components/layout/AppNav';

interface ProposedChangeView {
  id: string;
  externalGameId: string;
  changeType: 'new' | 'updated';
  fieldDiffs: Record<string, { old: unknown; new: unknown }>;
  summaryLines: string[];
  homeTeam: string;
  awayTeam: string;
  week: number;
  season: number;
  seasonType: number;
}

interface SyncPreviewState {
  runId: string;
  summary: { gamesChecked: number; newCount: number; updatedCount: number; unchangedCount: number };
  changes: ProposedChangeView[];
}

interface SyncRunSummary {
  id: string;
  created_at: string;
  reviewed_at: string | null;
  status: string;
  season: number;
  season_type: number;
  week: number | null;
  games_checked: number;
  new_count: number;
  updated_count: number;
  unchanged_count: number;
  applied_count: number;
  rejected_count: number;
  stale_count: number;
  requested_by: string;
  error: string | null;
}

interface SyncStatusState {
  lastRun: SyncRunSummary | null;
  lastSuccessfulRun: SyncRunSummary | null;
  pendingRuns: Pick<SyncRunSummary, 'id' | 'created_at' | 'season' | 'season_type' | 'week' | 'new_count' | 'updated_count' | 'unchanged_count'>[];
}

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

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

const FIELD_LABELS: Record<string, string> = {
  kickoff_time: 'Kickoff',
  status: 'Status',
  home_score: 'Home Score',
  away_score: 'Away Score',
  winner: 'Winner',
  home_team: 'Home Team',
  away_team: 'Away Team',
  home_team_id: 'Home Abbr.',
  away_team_id: 'Away Abbr.',
};

function formatFieldValue(field: string, value: unknown): string {
  if (value == null || value === '') return '—';
  if (field === 'kickoff_time') {
    try { return format(new Date(value as string), 'MMM d, h:mm a'); } catch { return String(value); }
  }
  if (field === 'status') return String(value).toUpperCase();
  return String(value);
}

function getSeasonTypeLabel(type: number) {
  if (type === 1) return 'Preseason';
  if (type === 2) return 'Regular Season';
  return 'Postseason';
}

function NFLSyncContent() {
  const { user, signOut, verifyAdminStatus } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [currentStats, setCurrentStats] = useState({ totalGames: 0, liveGames: 0, completedGames: 0, scheduledGames: 0 });
  const [previewDate, setPreviewDate] = useState(new Date());
  const [showSyncOptions, setShowSyncOptions] = useState(false);

  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [preview, setPreview] = useState<SyncPreviewState | null>(null);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<{ appliedCount: number; rejectedCount: number; staleCount: number; message: string } | null>(null);

  const [syncStatus, setSyncStatus] = useState<SyncStatusState | null>(null);
  const [teamRecordsSyncing, setTeamRecordsSyncing] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        if (user) {
          const superAdminStatus = await verifyAdminStatus(true);
          setIsSuperAdmin(superAdminStatus);
          if (!superAdminStatus) { router.push('/dashboard'); return; }
          await loadCurrentStats();
          await loadSyncStatus();
        }
      } catch (error) {
        debugError('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, verifyAdminStatus, router]);

  const loadCurrentStats = async () => {
    try {
      const res = await fetch(`/api/admin/games/stats?season=${new Date().getFullYear()}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) setCurrentStats(data.stats);
    } catch (error) {
      debugError('Error loading current stats:', error);
    }
  };

  const loadSyncStatus = async () => {
    if (!user?.email) return;
    try {
      const res = await fetch('/api/admin/nfl-sync/status', { headers: { 'x-admin-email': user.email } });
      const data = await res.json();
      if (data.success) setSyncStatus(data);
    } catch (error) {
      debugError('Error loading sync status:', error);
    }
  };

  const handlePreview = async () => {
    setPreviewLoading(true);
    setPreviewError('');
    setApplyResult(null);
    try {
      const res = await fetch('/api/admin/nfl-sync/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-email': user?.email ?? '' },
        body: JSON.stringify({ date: previewDate.toISOString() }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.runId) {
          setPreview({ runId: data.runId, summary: data.summary, changes: data.changes });
          setApprovedIds(new Set());
        } else {
          setPreview(null);
          toast({ title: 'Nothing to preview', description: data.message || 'No games found for this week.' });
        }
        debugLog('Preview loaded:', data);
      } else {
        setPreviewError(data.error || 'Preview failed');
        toast({ title: 'Preview Failed', description: data.error, variant: 'destructive' });
      }
    } catch {
      setPreviewError('Failed to connect to sync service');
      toast({ title: 'Error', description: 'Failed to connect to sync service', variant: 'destructive' });
    } finally {
      setPreviewLoading(false);
    }
  };

  const applyDecisions = async (opts: { approveAll?: boolean; rejectAll?: boolean } = {}) => {
    if (!preview) return;
    setApplying(true);
    try {
      const decisions: Record<string, 'approved' | 'rejected'> = {};
      for (const c of preview.changes) decisions[c.id] = approvedIds.has(c.id) ? 'approved' : 'rejected';

      const res = await fetch('/api/admin/nfl-sync/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-email': user?.email ?? '' },
        body: JSON.stringify({ runId: preview.runId, decisions, ...opts }),
      });
      const data = await res.json();
      if (data.success) {
        setApplyResult(data);
        toast({ title: 'Sync Applied', description: data.message });
        setPreview(null);
        setApprovedIds(new Set());
        await loadCurrentStats();
        await loadSyncStatus();
      } else {
        toast({ title: 'Apply Failed', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to apply changes', variant: 'destructive' });
    } finally {
      setApplying(false);
    }
  };

  const handleTeamRecordsSync = async () => {
    setTeamRecordsSyncing(true);
    try {
      const res = await fetch('/api/admin/nfl-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-email': user?.email ?? '' },
        body: JSON.stringify({ timestamp: previewDate.toISOString() }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Team Records Updated', description: `Updated ${data.teamRecordsUpdated} team records for ${data.season}.` });
      } else {
        toast({ title: 'Failed', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to update team records', variant: 'destructive' });
    } finally {
      setTeamRecordsSyncing(false);
    }
  };

  const toggleApproved = (id: string) => {
    setApprovedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      router.push('/admin/login');
    } catch {
      setIsLoggingOut(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
        <div className="animate-spin rounded-full h-16 w-16" style={{ borderWidth: '3px', borderStyle: 'solid', borderColor: border, borderTopColor: green }} />
      </div>
    );
  }

  const statsData = [
    { label: 'Total Games',  value: currentStats.totalGames,     color: gold },
    { label: 'Live',         value: currentStats.liveGames,       color: liveRed },
    { label: 'Completed',    value: currentStats.completedGames,  color: greenHi },
    { label: 'Scheduled',    value: currentStats.scheduledGames,  color: textMid },
  ];

  const newChanges = preview?.changes.filter(c => c.changeType === 'new') ?? [];
  const updatedChanges = preview?.changes.filter(c => c.changeType === 'updated') ?? [];

  const renderChangeCard = (change: ProposedChangeView) => {
    const approved = approvedIds.has(change.id);
    return (
      <div key={change.id} style={{ background: card, border: `1px solid ${approved ? green : border}`, borderRadius: 8, padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: change.changeType === 'updated' ? '0.75rem' : 0 }}>
          <div>
            <p style={{ ...bc, fontWeight: 800, fontSize: '0.95rem', color: text, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              {change.awayTeam || '—'} @ {change.homeTeam}
            </p>
            <p style={{ ...b, fontSize: '0.75rem', color: textDim, marginTop: '0.15rem' }}>
              {getSeasonTypeLabel(change.seasonType)} · Week {change.week}
            </p>
          </div>
          <button
            onClick={() => toggleApproved(change.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0,
              padding: '0.35rem 0.7rem', borderRadius: 6,
              background: approved ? green : 'transparent',
              border: `1px solid ${approved ? green : border}`,
              color: approved ? text : textMid,
              ...bc, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            {approved ? <Check style={{ width: 12, height: 12 }} /> : <CircleDot style={{ width: 12, height: 12 }} />}
            {approved ? 'Approved' : 'Approve'}
          </button>
        </div>

        {change.changeType === 'updated' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
            {Object.entries(change.fieldDiffs).map(([field, diff]) => (
              <div key={field} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 6, padding: '0.5rem 0.7rem' }}>
                <p style={{ ...bc, fontWeight: 700, fontSize: '0.6rem', letterSpacing: '0.1em', color: textDim, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                  {FIELD_LABELS[field] ?? field}
                </p>
                <p style={{ ...b, fontSize: '0.78rem', color: liveRed, textDecoration: 'line-through', marginBottom: '0.1rem' }}>
                  {formatFieldValue(field, diff.old)}
                </p>
                <p style={{ ...bc, fontWeight: 700, fontSize: '0.85rem', color: greenHi }}>
                  {formatFieldValue(field, diff.new)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ background: bg, minHeight: '100vh' }}>

      {/* ── NAV ── */}
      <AppNav
        isAuthenticated
        isSuperAdmin
        onSignOut={handleLogout}
        rightSlot={
          <button onClick={handlePreview} disabled={previewLoading} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.875rem', background: previewLoading ? 'oklch(35% 0.08 155)' : green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: previewLoading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
            <RefreshCw style={{ width: 13, height: 13 }} className={previewLoading ? 'animate-spin' : ''} />
            <span className="pools-nav-label">{previewLoading ? 'Fetching…' : 'Preview NFL Data'}</span>
          </button>
        }
      />

      {/* ── HERO ── */}
      <section style={{ background: bg, backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 59px, oklch(100% 0 0 / 0.022) 59px, oklch(100% 0 0 / 0.022) 60px)`, padding: 'clamp(2.5rem, 5vw, 4rem) 0' }}>
        <div className="lp-inner">
          <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.26em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ display: 'inline-block', width: 18, height: 2, background: greenHi, borderRadius: 1 }} /> ESPN API Integration
          </p>
          <h1 style={{ ...bc, fontWeight: 900, fontSize: 'clamp(2rem, 5vw, 3.25rem)', lineHeight: 0.95, color: text, textTransform: 'uppercase', marginBottom: '0.75rem' }}>
            NFL Data<br /><span style={{ color: gold }}>Sync</span>
          </h1>
          <p style={{ ...b, fontSize: '0.9rem', color: textMid, maxWidth: '48ch' }}>
            Fetch NFL game data from ESPN, review exactly what changed, and approve only the updates you want written to the database.
          </p>
        </div>
      </section>

      {/* ── green rule ── */}
      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${green}, transparent)` }} />

      {/* ── STATS ── */}
      <section style={{ background: surface, padding: '2.5rem 0' }}>
        <div className="lp-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <span style={{ display: 'block', width: 3, height: 22, background: green, borderRadius: 2 }} />
            <h2 style={{ ...bc, fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.06em', color: text, textTransform: 'uppercase' }}>Current Season Stats</h2>
          </div>
          <div className="admin-stats-grid" style={{ marginBottom: 0 }}>
            {statsData.map(({ label, value, color }) => (
              <div key={label} style={{ background: card, border: `1px solid ${border}`, borderLeft: `3px solid ${color}`, borderRadius: 8, padding: '1.25rem' }}>
                <div style={{ ...bc, fontWeight: 900, fontSize: '2.25rem', color, lineHeight: 1, letterSpacing: '0.02em' }}>{value}</div>
                <div style={{ ...bc, fontWeight: 700, fontSize: '0.7rem', color: text, letterSpacing: '0.07em', textTransform: 'uppercase', marginTop: '0.3rem' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SYNC STATUS ── */}
      <section style={{ background: bg, padding: '2.5rem 0 0' }}>
        <div className="lp-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <span style={{ display: 'block', width: 3, height: 22, background: green, borderRadius: 2 }} />
            <h3 style={{ ...bc, fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.06em', color: text, textTransform: 'uppercase' }}>Sync Status</h3>
          </div>
          <div className="admin-2col-grid" style={{ marginBottom: 0 }}>
            <div style={{ background: surface, border: `1px solid ${border}`, borderLeft: `3px solid ${greenHi}`, borderRadius: 8, padding: '1.25rem 1.5rem' }}>
              <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.1em', color: textDim, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Last Successful Sync</p>
              {syncStatus?.lastSuccessfulRun ? (
                <>
                  <p style={{ ...bc, fontWeight: 800, fontSize: '1.1rem', color: text }}>
                    {new Date(syncStatus.lastSuccessfulRun.reviewed_at ?? syncStatus.lastSuccessfulRun.created_at).toLocaleString()}
                  </p>
                  <p style={{ ...b, fontSize: '0.8rem', color: textMid, marginTop: '0.25rem' }}>
                    {syncStatus.lastSuccessfulRun.games_checked} checked · {syncStatus.lastSuccessfulRun.applied_count} applied
                  </p>
                </>
              ) : (
                <p style={{ ...b, fontSize: '0.85rem', color: textDim }}>No sync has been applied yet.</p>
              )}
            </div>
            <div style={{ background: surface, border: `1px solid ${border}`, borderLeft: `3px solid ${syncStatus?.lastRun?.error ? liveRed : gold}`, borderRadius: 8, padding: '1.25rem 1.5rem' }}>
              <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.1em', color: textDim, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Last Sync Attempt</p>
              {syncStatus?.lastRun ? (
                <>
                  <p style={{ ...bc, fontWeight: 800, fontSize: '1.1rem', color: text }}>
                    {new Date(syncStatus.lastRun.created_at).toLocaleString()}
                  </p>
                  <p style={{ ...b, fontSize: '0.8rem', color: textMid, marginTop: '0.25rem' }}>
                    {getSeasonTypeLabel(syncStatus.lastRun.season_type)} Week {syncStatus.lastRun.week ?? '—'} · Status: {syncStatus.lastRun.status.replace('_', ' ')}
                  </p>
                </>
              ) : (
                <p style={{ ...b, fontSize: '0.85rem', color: textDim }}>No sync has been run yet.</p>
              )}
            </div>
          </div>
          {syncStatus && syncStatus.pendingRuns.length > 0 && (
            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'oklch(20% 0.05 70 / 0.4)', border: `1px solid oklch(70% 0.16 70 / 0.4)`, borderRadius: 8, padding: '0.75rem 1rem' }}>
              <AlertTriangle style={{ width: 15, height: 15, color: 'oklch(78% 0.16 70)', flexShrink: 0 }} />
              <p style={{ ...b, fontSize: '0.82rem', color: 'oklch(85% 0.1 70)' }}>
                {syncStatus.pendingRuns.length} previous preview{syncStatus.pendingRuns.length === 1 ? '' : 's'} still awaiting review. Run a new preview to pick up where you left off.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── SYNC CONFIG ── */}
      <section style={{ background: bg, padding: '2.5rem 0 3rem' }}>
        <div className="lp-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <span style={{ display: 'block', width: 3, height: 22, background: green, borderRadius: 2 }} />
            <h3 style={{ ...bc, fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.06em', color: text, textTransform: 'uppercase' }}>Manual Sync</h3>
          </div>

          <div className="admin-2col-grid" style={{ marginBottom: '1.5rem' }}>
            <div style={{ background: surface, border: `1px solid ${border}`, borderLeft: `3px solid ${green}`, borderRadius: 8, padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CalendarIcon style={{ width: 16, height: 16, color: greenHi }} />
                  <h4 style={{ ...bc, fontWeight: 700, fontSize: '0.82rem', letterSpacing: '0.08em', color: text, textTransform: 'uppercase' }}>Sync Target</h4>
                </div>
                <button onClick={() => setShowSyncOptions(!showSyncOptions)} style={{ ...bc, fontWeight: 600, fontSize: '0.68rem', letterSpacing: '0.07em', color: textDim, textTransform: 'uppercase', background: 'transparent', border: `1px solid ${border}`, borderRadius: 4, padding: '0.25rem 0.5rem', cursor: 'pointer' }}>
                  {showSyncOptions ? 'Hide' : 'Change'}
                </button>
              </div>
              {showSyncOptions ? (
                <div>
                  <label htmlFor="sync-date" style={{ ...bc, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
                    Any date within the target week
                  </label>
                  <input
                    id="sync-date"
                    type="date"
                    value={previewDate.toISOString().split('T')[0]}
                    onChange={(e) => setPreviewDate(e.target.value ? new Date(e.target.value) : new Date())}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', background: card, border: `1px solid ${border}`, borderRadius: 5, color: text, ...b, fontSize: '0.85rem', outline: 'none' }}
                  />
                </div>
              ) : (
                <p style={{ ...b, fontSize: '0.85rem', color: textMid }}>
                  Week containing {format(previewDate, 'MMM dd, yyyy', { locale: enUS })}
                </p>
              )}
            </div>

            <div style={{ background: surface, border: `1px solid ${border}`, borderLeft: `3px solid ${gold}`, borderRadius: 8, padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <Settings style={{ width: 16, height: 16, color: gold }} />
                <h4 style={{ ...bc, fontWeight: 700, fontSize: '0.82rem', letterSpacing: '0.08em', color: text, textTransform: 'uppercase' }}>Team Records</h4>
              </div>
              <p style={{ ...b, fontSize: '0.8rem', color: textMid, marginBottom: '1rem', lineHeight: 1.5 }}>
                Win/loss records are lower-stakes than game data — they never affect picks or scoring — so this updates immediately without a review step.
              </p>
              <button
                onClick={handleTeamRecordsSync}
                disabled={teamRecordsSyncing}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: teamRecordsSyncing ? 'oklch(35% 0.08 70)' : 'transparent', color: gold, border: `1px solid ${gold}`, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: teamRecordsSyncing ? 'not-allowed' : 'pointer' }}
              >
                <RefreshCw style={{ width: 12, height: 12 }} className={teamRecordsSyncing ? 'animate-spin' : ''} />
                {teamRecordsSyncing ? 'Updating…' : 'Update Team Records'}
              </button>
            </div>
          </div>

          {previewError && (
            <div style={{ background: 'oklch(62% 0.22 25 / 0.1)', border: `1px solid oklch(62% 0.22 25 / 0.4)`, borderRadius: 8, padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
              <XCircle style={{ width: 16, height: 16, color: liveRed, flexShrink: 0, marginTop: 1 }} />
              <div>
                <p style={{ ...bc, fontWeight: 700, fontSize: '0.8rem', color: liveRed, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.2rem' }}>Sync Failed</p>
                <p style={{ ...b, fontSize: '0.82rem', color: textMid }}>{previewError} — no database changes were made.</p>
              </div>
            </div>
          )}

          {applyResult && (
            <div style={{ background: 'oklch(46% 0.14 155 / 0.1)', border: `1px solid oklch(46% 0.14 155 / 0.4)`, borderRadius: 8, padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
              <CheckCircle style={{ width: 16, height: 16, color: greenHi, flexShrink: 0, marginTop: 1 }} />
              <p style={{ ...b, fontSize: '0.85rem', color: textMid }}>{applyResult.message}</p>
            </div>
          )}

          {/* ── PREVIEW ── */}
          {preview && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {[
                    { label: 'Checked', value: preview.summary.gamesChecked, color: textMid },
                    { label: 'New', value: preview.summary.newCount, color: greenHi },
                    { label: 'Updated', value: preview.summary.updatedCount, color: gold },
                    { label: 'Unchanged', value: preview.summary.unchangedCount, color: textDim },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ background: card, border: `1px solid ${border}`, borderRadius: 6, padding: '0.6rem 1rem', textAlign: 'center' }}>
                      <div style={{ ...bc, fontWeight: 900, fontSize: '1.3rem', color, lineHeight: 1 }}>{value}</div>
                      <div style={{ ...b, fontSize: '0.65rem', color: textDim, marginTop: '0.15rem' }}>{label}</div>
                    </div>
                  ))}
                </div>
                {preview.changes.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => setApprovedIds(new Set(preview.changes.map(c => c.id)))} style={{ padding: '0.5rem 0.9rem', background: 'transparent', color: greenHi, border: `1px solid oklch(46% 0.14 155 / 0.5)`, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                      Approve All
                    </button>
                    <button onClick={() => setApprovedIds(new Set())} style={{ padding: '0.5rem 0.9rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                      Reject All
                    </button>
                  </div>
                )}
              </div>

              {newChanges.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <p style={{ ...bc, fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.12em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.6rem' }}>New Games ({newChanges.length})</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>{newChanges.map(renderChangeCard)}</div>
                </div>
              )}

              {updatedChanges.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <p style={{ ...bc, fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.12em', color: gold, textTransform: 'uppercase', marginBottom: '0.6rem' }}>Updated Games ({updatedChanges.length})</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>{updatedChanges.map(renderChangeCard)}</div>
                </div>
              )}

              {preview.summary.unchangedCount > 0 && (
                <p style={{ ...b, fontSize: '0.8rem', color: textDim, marginBottom: '1.5rem' }}>
                  {preview.summary.unchangedCount} game{preview.summary.unchangedCount === 1 ? '' : 's'} unchanged — no approval needed.
                </p>
              )}

              {preview.changes.length > 0 && (
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    onClick={() => applyDecisions()}
                    disabled={applying || approvedIds.size === 0}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.65rem 1.25rem', background: applying || approvedIds.size === 0 ? 'oklch(35% 0.08 155)' : green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: applying || approvedIds.size === 0 ? 'not-allowed' : 'pointer' }}
                  >
                    <Check style={{ width: 14, height: 14 }} />
                    {applying ? 'Applying…' : `Apply ${approvedIds.size} Approved`}
                  </button>
                  <button
                    onClick={() => applyDecisions({ rejectAll: true })}
                    disabled={applying}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.65rem 1.25rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: applying ? 'not-allowed' : 'pointer' }}
                  >
                    <X style={{ width: 14, height: 14 }} />
                    Reject All &amp; Close
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── ABOUT ── */}
      <section style={{ background: surface, padding: '3rem 0' }}>
        <div className="lp-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <span style={{ display: 'block', width: 3, height: 22, background: green, borderRadius: 2 }} />
            <h3 style={{ ...bc, fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.06em', color: text, textTransform: 'uppercase' }}>About NFL Sync</h3>
          </div>
          <div className="lp-features">
            {[
              { icon: Database,  accent: greenHi,  title: 'Data Source',        body: 'Game data is fetched from ESPN API, providing real-time scores, schedules, and game status updates.' },
              { icon: RefreshCw, accent: gold,     title: 'Review Before Writing', body: 'Nothing is written to the database until you approve it. Reject anything that looks wrong and it stays untouched.' },
              { icon: Trophy,    accent: 'oklch(65% 0.12 290)', title: 'Pool Integration', body: 'Approved game data flows through the same scoring pipeline every pool already uses — no separate calculations here.' },
            ].map(({ icon: Icon, accent, title, body }) => (
              <div key={title} style={{ background: card, border: `1px solid ${border}`, borderLeft: `3px solid ${accent}`, borderRadius: 8, padding: '1.25rem 1.5rem' }}>
                <Icon style={{ width: 18, height: 18, color: accent, marginBottom: '0.625rem' }} />
                <h4 style={{ ...bc, fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.06em', color: text, textTransform: 'uppercase', marginBottom: '0.4rem' }}>{title}</h4>
                <p style={{ ...b, fontSize: '0.82rem', lineHeight: 1.6, color: textMid }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <Footer pageName="Commissioner HQ" />
    </div>
  );
}

export default function NFLSyncPage() {
  return (
    <AuthProvider>
      <AdminGuard>
        <NFLSyncContent />
      </AdminGuard>
    </AuthProvider>
  );
}
