'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { enUS } from 'date-fns/locale';
import {
  ArrowLeft, RefreshCw, CheckCircle, XCircle, AlertTriangle,
  Calendar as CalendarIcon, Clock, Trophy, Activity,
  Database, Globe, Zap, Settings, LogOut,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { AuthProvider } from '@/lib/auth';
import { AdminGuard } from '@/components/auth/admin-guard';
import { debugLog, debugError} from '@/lib/utils';
import { Footer } from '@/components/layout/Footer';

interface SyncResult {
  success: boolean;
  message: string;
  gamesProcessed: number;
  gamesUpdated: number;
  gamesFailed: number;
  failedGameDetails?: Array<{ gameId: string; error: string }>;
  seasonType: number;
  week: number;
  year: number;
  endpoint: string;
  timestamp?: string;
  gamesUpdatedFlag?: boolean;
  teamRecordsUpdatedFlag?: boolean;
  teamRecordsUpdated?: number;
}

interface SyncHistory {
  id: string;
  timestamp: string;
  result: SyncResult;
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

function NFLSyncContent() {
  const { user, signOut, verifyAdminStatus } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncHistory[]>([]);
  const [showSyncPopup, setShowSyncPopup] = useState(false);
  const [currentStats, setCurrentStats] = useState({ totalGames: 0, liveGames: 0, completedGames: 0, scheduledGames: 0 });
  const [upcomingSync, setUpcomingSync] = useState({ week: 1, seasonType: 2, year: new Date().getFullYear() });
  const [selectedSyncOptions, setSelectedSyncOptions] = useState({ date: new Date(), updateGames: true, updateTeamRecords: true });
  const [showSyncOptions, setShowSyncOptions] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        if (user) {
          const superAdminStatus = await verifyAdminStatus(true);
          setIsSuperAdmin(superAdminStatus);
          if (!superAdminStatus) { router.push('/dashboard'); return; }
          await loadCurrentStats();
          loadSyncHistory();
          setUpcomingSync(getUpcomingSyncInfo());
          setSelectedSyncOptions({ date: new Date(), updateGames: true, updateTeamRecords: true });
        }
      } catch (error) {
        debugError('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [user, verifyAdminStatus, router]);

  const getUpcomingSyncInfo = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    let seasonType = 2, week = 1;
    if (month === 8 && d.getDate() < 25) { seasonType = 1; week = Math.max(1, Math.min(4, Math.floor(d.getDate() / 7) + 1)); }
    else if ((month >= 8 && d.getDate() >= 25) && month <= 12) { seasonType = 2; week = Math.max(1, Math.min(18, Math.floor((month - 9) * 4) + Math.floor(d.getDate() / 7))); }
    else if (month >= 1 && month <= 2) { seasonType = 3; week = Math.max(1, Math.min(5, Math.floor((month - 1) * 4) + Math.floor(d.getDate() / 7))); }
    return { week, seasonType, year };
  };

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

  const loadSyncHistory = () => {
    try {
      const history = localStorage.getItem('nfl-sync-history');
      if (history) setSyncHistory(JSON.parse(history));
    } catch (error) {
      debugError('Error loading sync history:', error);
    }
  };

  const saveSyncHistory = (result: SyncResult) => {
    try {
      const historyItem: SyncHistory = { id: Date.now().toString(), timestamp: new Date().toISOString(), result };
      const newHistory = [historyItem, ...syncHistory.slice(0, 9)];
      setSyncHistory(newHistory);
      localStorage.setItem('nfl-sync-history', JSON.stringify(newHistory));
    } catch (error) {
      debugError('Error saving sync history:', error);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/admin/nfl-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timestamp: selectedSyncOptions.date.toISOString(), updateGames: selectedSyncOptions.updateGames, updateTeamRecords: selectedSyncOptions.updateTeamRecords }),
      });
      const result: SyncResult = await response.json();
      setLastSyncResult(result);
      setShowSyncPopup(true);
      saveSyncHistory(result);
      if (result.success) {
        toast({ title: 'Sync Successful', description: `Updated ${result.gamesUpdated} games` });
        await loadCurrentStats();
      } else {
        toast({ title: 'Sync Failed', description: result.message || 'Failed to sync NFL data', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Sync Error', description: 'Failed to connect to sync service', variant: 'destructive' });
    } finally {
      setIsSyncing(false);
    }
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

  const getSeasonTypeLabel = (type: number) => {
    if (type === 1) return 'Preseason';
    if (type === 2) return 'Regular Season';
    return 'Postseason';
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

  return (
    <div style={{ background: bg, minHeight: '100vh' }}>

      {/* ── NAV ── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'oklch(13% 0.025 255 / 0.95)', backdropFilter: 'blur(14px)', borderBottom: `1px solid ${border}` }}>
        <div className="lp-inner" style={{ paddingTop: '0.75rem', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
              <button onClick={() => router.push('/admin/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.6rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}>
                <ArrowLeft style={{ width: 12, height: 12 }} /> Back
              </button>
              <div style={{ width: 1, height: 20, background: border }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: green, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Globe style={{ width: 14, height: 14, color: text }} />
                </div>
                <span style={{ ...bc, fontWeight: 800, fontSize: '0.92rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase' }}>NFL Data Sync</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
              <button onClick={handleSync} disabled={isSyncing} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.875rem', background: isSyncing ? 'oklch(35% 0.08 155)' : green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: isSyncing ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                <RefreshCw style={{ width: 13, height: 13 }} className={isSyncing ? 'animate-spin' : ''} />
                {isSyncing ? 'Syncing…' : 'Sync Now'}
              </button>
              <button onClick={handleLogout} disabled={isLoggingOut} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.75rem', background: liveRed, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: isLoggingOut ? 'not-allowed' : 'pointer', opacity: isLoggingOut ? 0.6 : 1 }}>
                <LogOut style={{ width: 12, height: 12 }} /> Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ background: bg, backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 59px, oklch(100% 0 0 / 0.022) 59px, oklch(100% 0 0 / 0.022) 60px)`, padding: 'clamp(2.5rem, 5vw, 4rem) 0' }}>
        <div className="lp-inner">
          <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.26em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ display: 'inline-block', width: 18, height: 2, background: greenHi, borderRadius: 1 }} /> ESPN API Integration
          </p>
          <h1 style={{ ...bc, fontWeight: 900, fontSize: 'clamp(2rem, 5vw, 3.25rem)', lineHeight: 0.95, color: text, textTransform: 'uppercase', marginBottom: '0.75rem' }}>
            NFL Data<br /><span style={{ color: gold }}>Sync</span>
          </h1>
          <p style={{ ...b, fontSize: '0.9rem', color: textMid, maxWidth: '40ch' }}>
            Synchronize NFL game data from ESPN API to keep scores, schedules, and game status up to date.
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

      {/* ── SYNC CONFIG ── */}
      <section style={{ background: bg, padding: '3rem 0' }}>
        <div className="lp-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <span style={{ display: 'block', width: 3, height: 22, background: green, borderRadius: 2 }} />
            <h3 style={{ ...bc, fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.06em', color: text, textTransform: 'uppercase' }}>Sync Configuration</h3>
          </div>

          <div className="admin-2col-grid" style={{ marginBottom: 0 }}>
            {/* Upcoming sync info */}
            <div style={{ background: surface, border: `1px solid ${border}`, borderLeft: `3px solid ${green}`, borderRadius: 8, padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <CalendarIcon style={{ width: 16, height: 16, color: greenHi }} />
                <h4 style={{ ...bc, fontWeight: 700, fontSize: '0.82rem', letterSpacing: '0.08em', color: text, textTransform: 'uppercase' }}>Upcoming Sync Target</h4>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
                {[
                  { label: 'Week', value: upcomingSync.week, color: greenHi },
                  { label: 'Season Type', value: getSeasonTypeLabel(upcomingSync.seasonType), color: gold },
                  { label: 'Year', value: upcomingSync.year, color: textMid },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background: card, border: `1px solid ${border}`, borderRadius: 6, padding: '0.75rem', textAlign: 'center' }}>
                    <div style={{ ...bc, fontWeight: 800, fontSize: '1.1rem', color, lineHeight: 1 }}>{value}</div>
                    <div style={{ ...b, fontSize: '0.7rem', color: textDim, marginTop: '0.25rem' }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 6, padding: '0.625rem 0.875rem', textAlign: 'center' }}>
                <span style={{ ...b, fontSize: '0.8rem', color: textMid }}>
                  Default: {format(new Date(), 'MMM dd, yyyy', { locale: enUS })} (ESPN API)
                </span>
              </div>
            </div>

            {/* Sync options */}
            <div style={{ background: surface, border: `1px solid ${border}`, borderLeft: `3px solid ${gold}`, borderRadius: 8, padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Settings style={{ width: 16, height: 16, color: gold } } />
                  <h4 style={{ ...bc, fontWeight: 700, fontSize: '0.82rem', letterSpacing: '0.08em', color: text, textTransform: 'uppercase' }}>Sync Options</h4>
                </div>
                <button onClick={() => setShowSyncOptions(!showSyncOptions)} style={{ ...bc, fontWeight: 600, fontSize: '0.68rem', letterSpacing: '0.07em', color: textDim, textTransform: 'uppercase', background: 'transparent', border: `1px solid ${border}`, borderRadius: 4, padding: '0.25rem 0.5rem', cursor: 'pointer' }}>
                  {showSyncOptions ? 'Hide' : 'Show'}
                </button>
              </div>

              {showSyncOptions ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label htmlFor="sync-date" style={{ ...bc, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
                      Sync Date
                    </label>
                    <input
                      id="sync-date"
                      type="date"
                      value={selectedSyncOptions.date.toISOString().split('T')[0]}
                      onChange={(e) => setSelectedSyncOptions(prev => ({ ...prev, date: e.target.value ? new Date(e.target.value) : new Date() }))}
                      max={new Date().toISOString().split('T')[0]}
                      style={{ width: '100%', padding: '0.5rem 0.75rem', background: card, border: `1px solid ${border}`, borderRadius: 5, color: text, ...b, fontSize: '0.85rem', outline: 'none' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '1.5rem' }}>
                    {[
                      { key: 'updateGames', label: 'Update Games' },
                      { key: 'updateTeamRecords', label: 'Update Team Records' },
                    ].map(({ key, label }) => (
                      <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={selectedSyncOptions[key as keyof typeof selectedSyncOptions] as boolean}
                          onChange={(e) => setSelectedSyncOptions(prev => ({ ...prev, [key]: e.target.checked }))}
                          style={{ width: 15, height: 15, accentColor: green }}
                        />
                        <span style={{ ...bc, fontWeight: 600, fontSize: '0.78rem', color: textMid, letterSpacing: '0.04em' }}>{label}</span>
                      </label>
                    ))}
                  </div>
                  <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 6, padding: '0.625rem 0.875rem' }}>
                    <span style={{ ...b, fontSize: '0.78rem', color: textMid }}>
                      Target: {format(selectedSyncOptions.date, 'MMM dd, yyyy', { locale: enUS })}
                    </span>
                  </div>
                </div>
              ) : (
                <p style={{ ...b, fontSize: '0.82rem', color: textDim }}>Configure which date and data types to synchronize from ESPN API.</p>
              )}
            </div>
          </div>

          {/* Last sync result */}
          {lastSyncResult && (
            <div style={{ marginTop: '1.5rem', background: surface, border: `1px solid ${border}`, borderLeft: `3px solid ${lastSyncResult.success ? greenHi : liveRed}`, borderRadius: 8, padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                {lastSyncResult.success
                  ? <CheckCircle style={{ width: 16, height: 16, color: greenHi }} />
                  : <XCircle style={{ width: 16, height: 16, color: liveRed }} />
                }
                <h4 style={{ ...bc, fontWeight: 700, fontSize: '0.82rem', letterSpacing: '0.08em', color: text, textTransform: 'uppercase' }}>Last Sync Result</h4>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem' }}>
                {[
                  { label: 'Processed', value: lastSyncResult.gamesProcessed, color: gold },
                  { label: 'Updated', value: lastSyncResult.gamesUpdated, color: greenHi },
                  { label: 'Failed', value: lastSyncResult.gamesFailed, color: liveRed },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background: card, border: `1px solid ${border}`, borderRadius: 6, padding: '0.875rem', textAlign: 'center' }}>
                    <div style={{ ...bc, fontWeight: 900, fontSize: '1.75rem', color, lineHeight: 1 }}>{value}</div>
                    <div style={{ ...b, fontSize: '0.7rem', color: textDim, marginTop: '0.25rem' }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sync history */}
          {syncHistory.length > 0 && (
            <div style={{ marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <span style={{ display: 'block', width: 3, height: 22, background: green, borderRadius: 2 }} />
                <h3 style={{ ...bc, fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.06em', color: text, textTransform: 'uppercase' }}>Sync History</h3>
              </div>
              <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 8, overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '1rem', background: card, borderBottom: `1px solid ${border}`, padding: '0.625rem 1.25rem' }}>
                  {['Timestamp', 'Updated', 'Failed'].map(h => (
                    <div key={h} style={{ ...bc, fontWeight: 700, fontSize: '0.6rem', letterSpacing: '0.2em', color: textDim, textTransform: 'uppercase' }}>{h}</div>
                  ))}
                </div>
                {syncHistory.map((item, idx) => (
                  <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '1rem', padding: '0.875rem 1.25rem', alignItems: 'center', borderBottom: idx < syncHistory.length - 1 ? `1px solid ${border}` : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {item.result.success
                        ? <CheckCircle style={{ width: 14, height: 14, color: greenHi, flexShrink: 0 }} />
                        : <XCircle style={{ width: 14, height: 14, color: liveRed, flexShrink: 0 }} />
                      }
                      <span style={{ ...b, fontSize: '0.8rem', color: textMid }}>{new Date(item.timestamp).toLocaleString()}</span>
                    </div>
                    <span style={{ ...bc, fontWeight: 700, fontSize: '0.9rem', color: greenHi }}>{item.result.gamesUpdated}</span>
                    <span style={{ ...bc, fontWeight: 700, fontSize: '0.9rem', color: item.result.gamesFailed > 0 ? liveRed : textDim }}>{item.result.gamesFailed}</span>
                  </div>
                ))}
              </div>
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
              { icon: RefreshCw, accent: gold,     title: 'Automatic Updates',  body: 'Games are updated in batches to prevent rate limiting. Handles preseason, regular season, and postseason.' },
              { icon: Trophy,    accent: 'oklch(65% 0.12 290)', title: 'Pool Integration', body: 'Updated game data automatically affects all active pools, ensuring accurate scoring and leaderboard calculations.' },
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

      {/* Sync Results Dialog */}
      <Dialog open={showSyncPopup} onOpenChange={setShowSyncPopup}>
        <DialogContent style={{ maxWidth: '42rem', maxHeight: '80vh', overflowY: 'auto' }}>
          <DialogHeader>
            <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {lastSyncResult?.success
                ? <><CheckCircle style={{ width: 18, height: 18 }} /> Sync Completed</>
                : <><XCircle style={{ width: 18, height: 18 }} /> Sync Failed</>
              }
            </DialogTitle>
            <DialogDescription>
              {lastSyncResult?.success ? 'NFL data synchronization completed.' : 'NFL data synchronization encountered an error.'}
            </DialogDescription>
          </DialogHeader>
          {lastSyncResult && (
            <div className="space-y-4">
              <div className="admin-week-grid">
                {lastSyncResult.gamesUpdatedFlag && (
                  <>
                    <div className="text-center p-3 rounded-lg border"><div className="text-2xl font-bold">{lastSyncResult.gamesProcessed}</div><div className="text-sm text-muted-foreground">Processed</div></div>
                    <div className="text-center p-3 rounded-lg border"><div className="text-2xl font-bold">{lastSyncResult.gamesUpdated}</div><div className="text-sm text-muted-foreground">Updated</div></div>
                    <div className="text-center p-3 rounded-lg border"><div className="text-2xl font-bold">{lastSyncResult.gamesFailed}</div><div className="text-sm text-muted-foreground">Failed</div></div>
                  </>
                )}
                {lastSyncResult.teamRecordsUpdatedFlag && (
                  <div className="text-center p-3 rounded-lg border"><div className="text-2xl font-bold">{lastSyncResult.teamRecordsUpdated || 0}</div><div className="text-sm text-muted-foreground">Team Records</div></div>
                )}
              </div>
              {lastSyncResult.failedGameDetails && lastSyncResult.failedGameDetails.length > 0 && (
                <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10">
                  <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> Failed Games ({lastSyncResult.failedGameDetails.length})
                  </h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {lastSyncResult.failedGameDetails.slice(0, 5).map((d, i) => (
                      <div key={i} className="text-xs p-2 rounded border border-destructive/20">
                        <div>Game: {d.gameId}</div><div>Error: {d.error}</div>
                      </div>
                    ))}
                    {lastSyncResult.failedGameDetails.length > 5 && <div className="text-xs text-muted-foreground">…and {lastSyncResult.failedGameDetails.length - 5} more</div>}
                  </div>
                </div>
              )}
              <p className="text-sm text-muted-foreground">{lastSyncResult.message}</p>
            </div>
          )}
          <DialogFooter>
            <button onClick={() => setShowSyncPopup(false)} style={{ padding: '0.5rem 1.25rem', background: green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}>Close</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
