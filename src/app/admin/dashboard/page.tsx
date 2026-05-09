'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Shield,
  Users,
  Trophy,
  BarChart3,
  Mail,
  Calendar,
  LogOut,
  Bell,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { adminService, DashboardStats, Admin } from '@/lib/admin-service';
import { getUpcomingWeek } from '@/actions/loadCurrentWeek';
import { debugLog, createPageUrl } from '@/lib/utils';
import { AuthProvider } from '@/lib/auth';
import { AdminGuard } from '@/components/auth/admin-guard';
import { CreatePoolDialog } from '@/components/pools/create-pool-dialog';
import { ExportData } from '@/components/admin/export-data';

// Design tokens — match landing page exactly
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

const quarterOptions = [
  { value: 'all',      label: 'All Quarters' },
  { value: 'Q1',       label: 'Quarter 1 (Weeks 1–4)' },
  { value: 'Q2',       label: 'Quarter 2 (Weeks 5–8)' },
  { value: 'Q3',       label: 'Quarter 3 (Weeks 9–12)' },
  { value: 'Q4',       label: 'Quarter 4 (Weeks 13–16)' },
  { value: 'Playoffs', label: 'Playoffs (Weeks 17–20)' },
];

function AdminDashboardContent() {
  const { user, signOut, verifyAdminStatus } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [currentWeek, setCurrentWeek] = useState(1);
  const [currentSeasonType, setCurrentSeasonType] = useState(2);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    totalPools: 0,
    activePools: 0,
    totalParticipants: 0,
    totalGames: 0,
    pendingSubmissions: 0,
    completedSubmissions: 0,
  });
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [lastGameUpdate, setLastGameUpdate] = useState<Date | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [createPoolDialogOpen, setCreatePoolDialogOpen] = useState(false);
  const [isGeneratingWinners, setIsGeneratingWinners] = useState(false);
  const [selectedQuarter, setSelectedQuarter] = useState<string>('all');

  useEffect(() => {
    const loadData = async () => {
      try {
        const { week, seasonType } = await getUpcomingWeek();
        setCurrentWeek(week);
        setCurrentSeasonType(seasonType);

        if (user) {
          debugLog('Checking admin status for user:', user.email);
          try {
            const superAdminStatus = await verifyAdminStatus(true);
            setIsSuperAdmin(superAdminStatus);
            if (!superAdminStatus) {
              router.push(createPageUrl('dashboard'));
              return;
            }
            if (superAdminStatus) await loadAdmins();
          } catch (error) {
            debugLog('Error verifying admin status:', error);
            setIsLoading(false);
            return;
          }
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [user, verifyAdminStatus, router]);

  useEffect(() => {
    if (currentWeek && currentSeasonType && isSuperAdmin !== undefined) {
      loadDashboardStats();
      loadLastGameUpdate();
      generateNotifications();
    }
  }, [currentWeek, currentSeasonType, isSuperAdmin]);

  useEffect(() => {
    const handleOpenCreatePool = () => setCreatePoolDialogOpen(true);
    document.addEventListener('openCreatePoolDialog', handleOpenCreatePool);
    return () => document.removeEventListener('openCreatePoolDialog', handleOpenCreatePool);
  }, []);

  const loadDashboardStats = async () => {
    try {
      if (!user?.email) return;
      const stats = await adminService.getDashboardStats(currentWeek, currentSeasonType, user.email, true);
      setDashboardStats(stats);
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
      toast({ title: 'Error', description: 'Failed to load dashboard data', variant: 'destructive' });
    }
  };

  const loadLastGameUpdate = async () => {
    try {
      const response = await fetch('/api/games?action=last-update');
      if (!response.ok) return;
      const data = await response.json();
      if (data.success && data.lastUpdate) setLastGameUpdate(new Date(data.lastUpdate));
    } catch (error) {
      console.error('Error loading last game update:', error);
    }
  };

  const loadAdmins = async () => {
    try {
      const adminsData = await adminService.getAdmins();
      setAdmins(adminsData);
    } catch (error) {
      console.error('Error loading admins:', error);
      toast({ title: 'Error', description: 'Failed to load admin data', variant: 'destructive' });
    }
  };

  const generateNotifications = () => {
    const n: string[] = [];
    if (dashboardStats.totalPools === 0)
      n.push('🚨 No active pools found. Create a pool to get started!');
    if (dashboardStats.activePools === 0 && dashboardStats.totalPools > 0)
      n.push('⚠️ All pools are currently inactive.');
    if (dashboardStats.totalParticipants === 0 && dashboardStats.totalPools > 0)
      n.push('📢 No participants have joined any pools yet. Consider sending invitations.');
    if (dashboardStats.pendingSubmissions > 0) {
      const pct = Math.round((dashboardStats.completedSubmissions / (dashboardStats.completedSubmissions + dashboardStats.pendingSubmissions)) * 100);
      n.push(`📊 Week ${currentWeek}: ${dashboardStats.completedSubmissions}/${dashboardStats.completedSubmissions + dashboardStats.pendingSubmissions} submissions (${pct}%)`);
    }
    if (dashboardStats.completedSubmissions > 0 && dashboardStats.pendingSubmissions === 0)
      n.push('✅ All participants have submitted picks for this week!');
    if (dashboardStats.totalGames === 0)
      n.push('🏈 No games scheduled for the current week. Check NFL sync.');
    if (dashboardStats.pendingSubmissions > 10)
      n.push("⏰ Consider sending reminder emails to participants who haven't submitted picks.");
    setNotifications(n);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadDashboardStats();
      await loadLastGameUpdate();
      generateNotifications();
      setLastRefresh(new Date());
      toast({ title: 'Dashboard Refreshed', description: 'All data has been updated' });
    } catch {
      toast({ title: 'Refresh Failed', description: 'Failed to refresh dashboard data', variant: 'destructive' });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handlePoolCreated = async () => {
    await loadDashboardStats();
    toast({ title: 'Pool Created', description: 'New pool has been created successfully' });
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const { getSupabaseClient } = await import('@/lib/supabase');
      await getSupabaseClient().auth.signOut();
      await signOut();
      router.push(createPageUrl('adminlogin'));
    } catch {
      setIsLoggingOut(false);
    }
  };

  const handleGeneratePeriodWinners = async () => {
    setIsGeneratingWinners(true);
    try {
      const response = await fetch('/api/admin/winners/period', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season: 2025, generateAllPools: true, quarter: selectedQuarter }),
      });
      if (!response.ok) throw new Error('Failed to generate period winners');
      const result = await response.json();
      const summaryData = {
        operation: 'Period Winners Generation',
        timestamp: new Date().toISOString(),
        poolsProcessed: result.poolsProcessed || 0,
        poolsWithWinners: result.poolsWithWinners || 0,
        generatedWinners: result.generatedWinners || 0,
        noWinners: result.noWinners || 0,
        errors: result.errors || 0,
        results: result.results || [],
      };
      localStorage.setItem('adminSummaryData', JSON.stringify(summaryData));
      toast({ title: 'Period Winners Generated', description: `Processed ${summaryData.poolsProcessed} pools, generated ${summaryData.generatedWinners} winners`, duration: 4000 });
      router.push('/admin/summary');
      await loadDashboardStats();
    } catch {
      toast({ title: 'Error', description: 'Failed to generate period winners. Please try again.', variant: 'destructive' });
    } finally {
      setIsGeneratingWinners(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
        <div className="animate-spin rounded-full h-16 w-16" style={{ borderWidth: '3px', borderStyle: 'solid', borderColor: border, borderTopColor: green }} />
      </div>
    );
  }

  const seasonLabel = currentSeasonType === 1 ? 'Preseason' : currentSeasonType === 2 ? 'Regular Season' : 'Postseason';

  const statItems = [
    { label: 'Total Pools',    value: dashboardStats.totalPools,                          sub: `${dashboardStats.activePools} active` },
    { label: 'Participants',   value: dashboardStats.totalParticipants,                    sub: 'Across all pools' },
    { label: 'Admins',         value: admins.filter(a => a.is_super_admin).length,         sub: 'System administrators' },
    { label: 'Commissioners',  value: admins.filter(a => !a.is_super_admin).length,        sub: 'Pool managers' },
  ];

  const actions = [
    { icon: Users,    accent: green,                   title: 'Manage Commissioners', desc: 'Create and manage commissioner accounts',    label: 'Manage Commissioners', onClick: () => router.push(createPageUrl('admincommissioners')) },
    { icon: Shield,   accent: green,                   title: 'Manage Admins',        desc: 'Reset passwords and manage admin accounts',  label: 'Manage Admins',        onClick: () => router.push('/admin/manage-admins') },
    { icon: Trophy,   accent: gold,                    title: 'Pool Management',      desc: 'Manage pools and participants',               label: 'Manage Pools',         onClick: () => router.push(createPageUrl('adminpools')) },
    { icon: Mail,     accent: green,                   title: 'Email Management',     desc: 'Send emails and manage communications',       label: 'Email Management',     onClick: () => router.push(createPageUrl('adminreminders')) },
    { icon: Trophy,   accent: gold,                    title: 'Playoff Management',   desc: 'Manage playoff teams and games',              label: 'Manage Playoffs',      onClick: () => router.push('/admin/playoffs') },
    { icon: Calendar, accent: green,                   title: 'NFL Sync',             desc: 'Synchronize NFL game data',                  label: 'NFL Sync',             onClick: () => router.push(createPageUrl('adminnflsync')) },
    { icon: BarChart3, accent: 'oklch(62% 0.12 270)', title: 'Season Review',        desc: 'Review each pool by week',                   label: 'Season Review',        onClick: () => router.push('/season-review') },
    { icon: Plus,     accent: green,                   title: 'Create Pool',          desc: 'Create a new confidence pool',               label: 'Create Pool',          onClick: () => { document.dispatchEvent(new CustomEvent('openCreatePoolDialog')); } },
  ];

  return (
    <div style={{ background: bg, minHeight: '100vh' }}>

      {/* ── NAV ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'oklch(13% 0.025 255 / 0.95)',
        backdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${border}`,
      }}>
        <div className="lp-inner" style={{ paddingTop: '0.75rem', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>

            {/* Left: branding */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%',
                background: green, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Shield style={{ width: 16, height: 16, color: text }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <span style={{ ...bc, fontWeight: 800, fontSize: '0.95rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase', display: 'block' }}>
                  Commissioner HQ
                </span>
                <span style={{ ...bc, fontWeight: 600, fontSize: '0.6rem', letterSpacing: '0.18em', color: greenHi, textTransform: 'uppercase' }}>
                  System Administration
                </span>
              </div>
              <Badge variant="outline" style={{ fontSize: '0.6rem', flexShrink: 0, borderColor: border, color: textMid }}>
                Super Admin
              </Badge>
            </div>

            {/* Right: utility buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  padding: '0.4rem 0.75rem',
                  background: 'transparent', color: textMid,
                  border: `1px solid ${border}`, borderRadius: 6,
                  ...bc, fontWeight: 600, fontSize: '0.72rem',
                  letterSpacing: '0.07em', textTransform: 'uppercase',
                  cursor: isRefreshing ? 'not-allowed' : 'pointer',
                  opacity: isRefreshing ? 0.6 : 1,
                  whiteSpace: 'nowrap',
                }}
              >
                <RefreshCw style={{ width: 12, height: 12 }} className={isRefreshing ? 'animate-spin' : ''} />
                {isRefreshing ? 'Refreshing…' : 'Refresh'}
              </button>

              <button
                onClick={() => setShowNotifications(!showNotifications)}
                style={{
                  position: 'relative',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 34, height: 34,
                  background: 'transparent', color: textMid,
                  border: `1px solid ${border}`, borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                <Bell style={{ width: 15, height: 15 }} />
                {notifications.length > 0 && (
                  <span style={{
                    position: 'absolute', top: -5, right: -5,
                    width: 16, height: 16, borderRadius: '50%',
                    background: liveRed, color: text,
                    ...bc, fontWeight: 700, fontSize: '0.6rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {notifications.length}
                  </span>
                )}
              </button>

              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  padding: '0.4rem 0.75rem',
                  background: liveRed, color: text,
                  border: 'none', borderRadius: 6,
                  ...bc, fontWeight: 700, fontSize: '0.72rem',
                  letterSpacing: '0.07em', textTransform: 'uppercase',
                  cursor: isLoggingOut ? 'not-allowed' : 'pointer',
                  opacity: isLoggingOut ? 0.6 : 1,
                  whiteSpace: 'nowrap',
                }}
              >
                <LogOut style={{ width: 12, height: 12 }} />
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Notifications Banner ── */}
      {showNotifications && notifications.length > 0 && (
        <div style={{ background: 'oklch(18% 0.03 255)', borderBottom: `1px solid ${border}` }}>
          <div className="lp-inner" style={{ paddingTop: '0.875rem', paddingBottom: '0.875rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {notifications.map((n, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', ...b, fontSize: '0.8rem', color: textMid }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: greenHi, flexShrink: 0, marginTop: 6 }} />
                  {n}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── HERO ── */}
      <section style={{
        background: bg,
        backgroundImage: `repeating-linear-gradient(
          0deg,
          transparent,
          transparent 59px,
          oklch(100% 0 0 / 0.022) 59px,
          oklch(100% 0 0 / 0.022) 60px
        )`,
        padding: 'clamp(3rem, 6vw, 5rem) 0',
      }}>
        <div className="lp-inner">
          <div className="lp-hero-row">

            {/* Left: title + description */}
            <div className="lp-hero-text">
              <p style={{
                ...bc, fontWeight: 700, fontSize: '0.67rem',
                letterSpacing: '0.28em', color: greenHi,
                textTransform: 'uppercase', marginBottom: '1rem',
                display: 'flex', alignItems: 'center', gap: '0.55rem',
              }}>
                <span style={{ display: 'inline-block', width: 20, height: 2, background: greenHi, borderRadius: 1, flexShrink: 0 }} />
                System Administration
              </p>

              <h1 style={{
                ...bc, fontWeight: 900,
                fontSize: 'clamp(3rem, 7vw, 4.5rem)',
                lineHeight: 0.92, letterSpacing: '-0.01em',
                color: text, textTransform: 'uppercase',
                marginBottom: '1.5rem',
              }}>
                Commissioner<br />
                <span style={{ color: gold }}>HQ</span>
              </h1>

              <p style={{ ...b, fontSize: '0.95rem', lineHeight: 1.72, color: textMid, maxWidth: '36ch' }}>
                Manage pools, commissioners, and game data across the entire system.
              </p>

              <p style={{
                ...bc, fontSize: '0.75rem', fontWeight: 600, color: textDim,
                marginTop: '1rem', letterSpacing: '0.06em', textTransform: 'uppercase',
              }}>
                Week {currentWeek} · {seasonLabel} · Refreshed {lastRefresh.toLocaleTimeString()}
              </p>
            </div>

            {/* Right: system overview stats */}
            <div className="lp-hero-card">
              <div style={{
                background: surface,
                border: `1px solid ${border}`,
                borderTop: `3px solid ${green}`,
                borderRadius: 10,
                padding: '1.75rem',
              }}>
                <p style={{
                  ...bc, fontWeight: 700, fontSize: '0.63rem',
                  letterSpacing: '0.24em', color: greenHi,
                  textTransform: 'uppercase', marginBottom: '1.25rem',
                }}>
                  System Overview
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  {statItems.map(({ label, value, sub }) => (
                    <div key={label} style={{
                      background: card,
                      border: `1px solid ${border}`,
                      borderRadius: 8,
                      padding: '1rem',
                    }}>
                      <div style={{ ...bc, fontWeight: 900, fontSize: '2.25rem', color: gold, lineHeight: 1, letterSpacing: '0.02em' }}>
                        {value}
                      </div>
                      <div style={{ ...bc, fontWeight: 700, fontSize: '0.68rem', color: text, letterSpacing: '0.07em', textTransform: 'uppercase', marginTop: '0.3rem' }}>
                        {label}
                      </div>
                      <div style={{ ...b, fontSize: '0.68rem', color: textDim, marginTop: '0.15rem' }}>
                        {sub}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── green rule ── */}
      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${green}, transparent)` }} />

      {/* ── QUICK ACTIONS ── */}
      <section style={{ background: surface, padding: '3rem 0' }}>
        <div className="lp-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <span style={{ display: 'block', width: 3, height: 24, background: green, borderRadius: 2, flexShrink: 0 }} />
            <h2 style={{ ...bc, fontWeight: 800, fontSize: '1.25rem', letterSpacing: '0.06em', color: text, textTransform: 'uppercase' }}>
              Quick Actions
            </h2>
          </div>

          <div className="admin-actions-grid">
            {actions.map(({ icon: Icon, accent, title, desc, label, onClick }) => (
              <div key={title} style={{
                background: card,
                border: `1px solid ${border}`,
                borderLeft: `3px solid ${accent}`,
                borderRadius: 8,
                padding: '1.5rem',
                display: 'flex', flexDirection: 'column', gap: '0.75rem',
              }}>
                <div>
                  <Icon style={{ width: 20, height: 20, color: accent, marginBottom: '0.5rem' }} />
                  <h3 style={{ ...bc, fontWeight: 700, fontSize: '0.92rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                    {title}
                  </h3>
                  <p style={{ ...b, fontSize: '0.82rem', lineHeight: 1.55, color: textMid }}>
                    {desc}
                  </p>
                </div>
                <button
                  onClick={onClick}
                  style={{
                    marginTop: 'auto',
                    padding: '0.5rem 1rem',
                    background: green, color: text,
                    border: 'none', borderRadius: 6,
                    ...bc, fontWeight: 700, fontSize: '0.8rem',
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    cursor: 'pointer', transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = greenHi)}
                  onMouseLeave={e => (e.currentTarget.style.background = green)}
                >
                  {label}
                </button>
              </div>
            ))}

            {/* Generate Period Winners — has extra Select UI */}
            <div style={{
              background: card,
              border: `1px solid ${border}`,
              borderLeft: `3px solid ${gold}`,
              borderRadius: 8,
              padding: '1.5rem',
              display: 'flex', flexDirection: 'column', gap: '0.75rem',
            }}>
              <div>
                <Trophy style={{ width: 20, height: 20, color: gold, marginBottom: '0.5rem' }} />
                <h3 style={{ ...bc, fontWeight: 700, fontSize: '0.92rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                  Generate Period Winners
                </h3>
                <p style={{ ...b, fontSize: '0.82rem', lineHeight: 1.55, color: textMid }}>
                  Calculate and generate period winners for all pools
                </p>
              </div>
              <div>
                <label style={{ ...bc, fontSize: '0.68rem', fontWeight: 600, color: textDim, display: 'block', marginBottom: '0.375rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Select Quarter
                </label>
                <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
                  <SelectTrigger style={{ width: '100%' }}>
                    <SelectValue placeholder="Select quarter" />
                  </SelectTrigger>
                  <SelectContent>
                    {quarterOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <button
                onClick={handleGeneratePeriodWinners}
                disabled={isGeneratingWinners}
                style={{
                  marginTop: 'auto',
                  padding: '0.5rem 1rem',
                  background: isGeneratingWinners ? 'oklch(35% 0.08 155)' : green,
                  color: text, border: 'none', borderRadius: 6,
                  ...bc, fontWeight: 700, fontSize: '0.8rem',
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  cursor: isGeneratingWinners ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                }}
              >
                {isGeneratingWinners
                  ? <><RefreshCw style={{ width: 13, height: 13 }} className="animate-spin" /> Generating…</>
                  : <><Trophy style={{ width: 13, height: 13 }} /> Generate Winners</>
                }
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── WEEK SCOREBOARD ── */}
      <section style={{ background: bg, padding: '3.5rem 0' }}>
        <div className="lp-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <span style={{ display: 'block', width: 3, height: 24, background: green, borderRadius: 2, flexShrink: 0 }} />
            <h3 style={{ ...bc, fontWeight: 800, fontSize: '1.25rem', letterSpacing: '0.06em', color: text, textTransform: 'uppercase' }}>
              Week {currentWeek} Scoreboard
            </h3>
            <span style={{ ...bc, fontSize: '0.72rem', color: textDim, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              {seasonLabel}
            </span>
          </div>

          <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden' }}>
            {/* Column headers */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
              background: card, borderBottom: `1px solid ${border}`,
              padding: '0.625rem 1.25rem',
            }}>
              {['Games', 'Pending', 'Submitted', 'Last Sync'].map(h => (
                <div key={h} style={{ textAlign: 'center' }}>
                  <span style={{ ...bc, fontWeight: 700, fontSize: '0.6rem', letterSpacing: '0.2em', color: textDim, textTransform: 'uppercase' }}>{h}</span>
                </div>
              ))}
            </div>

            {/* Values */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', padding: '1.75rem 1.25rem', gap: '1rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ ...bc, fontWeight: 900, fontSize: '2.5rem', color: greenHi, lineHeight: 1, letterSpacing: '0.02em' }}>
                  {dashboardStats.totalGames}
                </div>
                <div style={{ ...b, fontSize: '0.7rem', color: textDim, marginTop: '0.25rem' }}>scheduled</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ ...bc, fontWeight: 900, fontSize: '2.5rem', color: gold, lineHeight: 1, letterSpacing: '0.02em' }}>
                  {dashboardStats.pendingSubmissions}
                </div>
                <div style={{ ...b, fontSize: '0.7rem', color: textDim, marginTop: '0.25rem' }}>awaiting picks</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ ...bc, fontWeight: 900, fontSize: '2.5rem', color: greenHi, lineHeight: 1, letterSpacing: '0.02em' }}>
                  {dashboardStats.completedSubmissions}
                </div>
                <div style={{ ...b, fontSize: '0.7rem', color: textDim, marginTop: '0.25rem' }}>picks submitted</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ ...bc, fontWeight: 700, fontSize: '1.1rem', color: text, lineHeight: 1 }}>
                  {lastGameUpdate ? lastGameUpdate.toLocaleTimeString() : '—'}
                </div>
                <div style={{ ...b, fontSize: '0.7rem', color: textDim, marginTop: '0.25rem' }}>last game sync</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── ACCESS + EXPORT ── */}
      <section style={{ background: surface, padding: '4rem 0' }}>
        <div className="lp-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <span style={{ display: 'block', width: 3, height: 24, background: green, borderRadius: 2, flexShrink: 0 }} />
            <h3 style={{ ...bc, fontWeight: 800, fontSize: '1.25rem', letterSpacing: '0.06em', color: text, textTransform: 'uppercase' }}>
              Your Access
            </h3>
          </div>

          <div className="admin-2col-grid">
            {/* Role info */}
            <div style={{
              background: card,
              border: `1px solid ${border}`,
              borderLeft: `3px solid ${green}`,
              borderRadius: 8,
              padding: '1.5rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <Shield style={{ width: 16, height: 16, color: greenHi }} />
                <h4 style={{ ...bc, fontWeight: 700, fontSize: '0.82rem', letterSpacing: '0.08em', color: text, textTransform: 'uppercase' }}>
                  Role Information
                </h4>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {[
                  { label: 'Primary Role',       value: 'System Admin' },
                  { label: 'Global Permissions', value: 'Full system access' },
                  { label: 'Pool Access',        value: `All pools (${dashboardStats.totalPools})` },
                  { label: 'Status',             value: 'Active' },
                  { label: 'Last Game Update',   value: lastGameUpdate ? lastGameUpdate.toLocaleString() : 'Never' },
                  { label: 'Last Refresh',       value: lastRefresh.toLocaleString() },
                ].map(({ label, value }, i, arr) => (
                  <div
                    key={label}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '0.625rem 0',
                      borderBottom: i < arr.length - 1 ? `1px solid ${border}` : 'none',
                    }}
                  >
                    <span style={{ ...bc, fontWeight: 600, fontSize: '0.75rem', color: textDim, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      {label}
                    </span>
                    <span style={{ ...b, fontSize: '0.82rem', color: text }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Data export */}
            <ExportData
              poolId="system-wide"
              poolName="All Pools"
              currentWeek={currentWeek}
              currentSeason={new Date().getFullYear()}
            />
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: bg, borderTop: `1px solid ${border}`, padding: '2rem 0' }}>
        <div className="lp-inner" style={{ textAlign: 'center' }}>
          <p style={{ ...b, fontSize: '0.82rem', color: textDim }}>
            &copy; {new Date().getFullYear()} NFL Confidence Pool · Commissioner HQ
          </p>
        </div>
      </footer>

      {/* Create Pool Dialog */}
      <CreatePoolDialog
        open={createPoolDialogOpen}
        onOpenChange={setCreatePoolDialogOpen}
        onPoolCreated={handlePoolCreated}
      />
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <AuthProvider>
      <AdminGuard>
        <AdminDashboardContent />
      </AdminGuard>
    </AuthProvider>
  );
}
