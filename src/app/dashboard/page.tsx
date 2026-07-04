'use client';

import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Trophy,
  LogOut,
  Plus,
  Bell,
  TrendingUp,
  Clock,
  AlertTriangle,
  RefreshCw,
  Users,
  Edit,
  Calendar,
  BarChart3,
  Link2,
  Check,
  Settings,
  Download,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { adminService, DashboardStats } from '@/lib/admin-service';
import { getUpcomingWeek } from '@/actions/loadCurrentWeek';
import { debugLog, createPageUrl, debugError} from '@/lib/utils';
import { Game } from '@/types/game';
import { AuthProvider } from '@/lib/auth';
import { AdminGuard } from '@/components/auth/admin-guard';
import { CreatePoolDialog } from '@/components/pools/create-pool-dialog';
import { loadWeekGames } from '@/actions/loadWeekGames';
import { Footer } from '@/components/layout/Footer';
import { OffseasonBanner } from '@/components/ui/offseason-banner';
import { ParticipantManagement } from '@/components/admin/participant-management';
import { OverridePicksPanel } from '@/components/admin/override-picks-panel';
import { SeasonReviewPanel } from '@/components/admin/season-review-panel';
import { PlayoffParticipantsList } from '@/components/admin/playoff-participants-list';
import { PoolSettings } from '@/components/admin/pool-settings';
import { ExportData } from '@/components/admin/export-data';

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
const amber   = 'oklch(72% 0.16 60)';
const liveRed = 'oklch(62% 0.22 25)';

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

function CommissionerDashboardContent() {
  const { user, signOut, verifyAdminStatus } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [currentWeek, setCurrentWeek] = useState(1);
  const [currentSeasonType, setCurrentSeasonType] = useState(2);
  const [currentSeason, setCurrentSeason] = useState(new Date().getFullYear());
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    totalPools: 0,
    activePools: 0,
    totalParticipants: 0,
    totalGames: 0,
    pendingSubmissions: 0,
    completedSubmissions: 0
  });
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [poolSelectionOpen, setPoolSelectionOpen] = useState(false);
  const [availablePools, setAvailablePools] = useState<Array<{id: string, name: string, season_scope?: number[]}>>([]);
  const [selectedPoolId, setSelectedPoolId] = useState<string>('');
  const [importPicksOpen, setImportPicksOpen] = useState(false);
  const [selectedPoolForImport, setSelectedPoolForImport] = useState<{id: string, name: string} | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [poolSelectionMode, setPoolSelectionMode] = useState<'invite' | 'import'>('invite');
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [createPoolDialogOpen, setCreatePoolDialogOpen] = useState(false);
  const [recentActivity, setRecentActivity] = useState<Array<{
    type: 'pool_created' | 'participant_joined' | 'picks_submitted' | 'reminder_sent';
    description: string;
    timestamp: string;
    pool_name?: string;
    participant_name?: string;
  }>>([]);
  const [countdown, setCountdown] = useState<string>('');
  const [games, setGames] = useState<Game[]>([]);
  const [selectedPoolStats, setSelectedPoolStats] = useState({ participants: 0, completed: 0, pending: 0, completionRate: 0 });
  const [poolLeader, setPoolLeader] = useState<{ name: string; points: number; correctPicks: number } | null>(null);
  const [missingParticipants, setMissingParticipants] = useState<Array<{ id: string; name: string }>>([]);
  const [weekGamesCount, setWeekGamesCount] = useState(0);
  const [activePoolTab, setActivePoolTab] = useState<'overview' | 'players' | 'leaderboard' | 'override-picks' | 'season-review' | 'playoffs' | 'export' | 'settings'>('overview');
  const [leaderboardEntries, setLeaderboardEntries] = useState<Array<{ participantId: string; name: string; points: number; correctPicks: number }>>([]);
  const [planInfo, setPlanInfo] = useState<{ plan: string; isTrialActive: boolean; daysLeft: number } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const { week, seasonType } = await getUpcomingWeek();
        setCurrentWeek(week);
        setCurrentSeasonType(seasonType);

        if (user) {
          debugLog('Checking admin status for user:', user.email);
          const superAdminStatus = await verifyAdminStatus(true);
          setIsSuperAdmin(superAdminStatus);
          debugLog('Super admin status:', superAdminStatus);

          if (superAdminStatus) {
            router.push(createPageUrl('admindashboard'));
            return;
          }

          await loadDashboardStats();
          generateNotifications();
          loadRecentActivity();
          await loadGames();

          fetch(`/api/admin/plan-status?adminId=${user.id}`)
            .then(r => r.json())
            .then(d => { if (d.success) setPlanInfo({ plan: d.plan, isTrialActive: d.isTrialActive, daysLeft: d.daysLeft }); })
            .catch(() => {});
        }
      } catch (error) {
        debugError('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user, verifyAdminStatus, router]);

  useEffect(() => {
    const handleOpenCreatePool = () => {
      setCreatePoolDialogOpen(true);
    };
    document.addEventListener('openCreatePoolDialog', handleOpenCreatePool);
    return () => {
      document.removeEventListener('openCreatePoolDialog', handleOpenCreatePool);
    };
  }, []);

  useEffect(() => {
    if (games.length === 0) return;

    const timer = setInterval(() => {
      const firstGame = games[0];
      const gameTime = new Date(firstGame.kickoff_time);
      const now = new Date();
      const timeDiff = gameTime.getTime() - now.getTime();

      if (timeDiff <= 0) {
        setCountdown('Games Started');
        return;
      }

      const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

      if (days > 0) {
        setCountdown(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setCountdown(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setCountdown(`${minutes}m ${seconds}s`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [games]);

  useEffect(() => {
    if (currentWeek && currentSeasonType) {
      loadGames();
    }
  }, [currentWeek, currentSeasonType]);

  useEffect(() => {
    if (selectedPoolId) {
      setActivePoolTab('overview');
      loadSelectedPoolStats(selectedPoolId);
    }
  }, [selectedPoolId, currentWeek, currentSeasonType]);

  const loadDashboardStats = async () => {
    try {
      if (!user?.email) return;

      const stats = await adminService.getDashboardStats(
        currentWeek,
        currentSeasonType,
        user.email,
        false
      );

      setDashboardStats(stats);

      const pools = await adminService.getActivePools(
        user.email,
        false
      );
      debugLog('stats pools', pools);
      setAvailablePools(pools);
      if (pools.length > 0) setSelectedPoolId(prev => prev || pools[0].id);
    } catch (error) {
      debugError('Error loading dashboard stats:', error);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data',
        variant: 'destructive',
      });
    }
  };

  const loadGames = async () => {
    try {
      const gamesData = await loadWeekGames(currentWeek, currentSeasonType, currentSeason);
      setGames(gamesData);
      debugLog('Loaded games for countdown:', gamesData.length);
    } catch (error) {
      debugError('Error loading games for countdown:', error);
    }
  };

  const loadSelectedPoolStats = async (poolId: string) => {
    try {
      const { getSupabaseServiceClient } = await import('@/lib/supabase');
      const supabase = getSupabaseServiceClient();

      // Parallel: participant list + current week games
      const [{ data: allParticipants }, { data: weekGames }] = await Promise.all([
        supabase.from('participants').select('id, name').eq('pool_id', poolId).eq('is_active', true),
        supabase.from('games').select('id').eq('week', currentWeek).eq('season_type', currentSeasonType),
      ]);

      const total = allParticipants?.length ?? 0;
      const gameIds = weekGames?.map(g => g.id) ?? [];
      setWeekGamesCount(gameIds.length);

      let submittedIds = new Set<string>();
      if (gameIds.length > 0) {
        const { data: picks } = await supabase
          .from('picks')
          .select('participant_id')
          .eq('pool_id', poolId)
          .in('game_id', gameIds);
        submittedIds = new Set((picks ?? []).map(p => p.participant_id));
      }

      const completed = submittedIds.size;
      const pending = Math.max(0, total - completed);
      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
      setSelectedPoolStats({ participants: total, completed, pending, completionRate });

      // Missing participants for this week
      setMissingParticipants(
        (allParticipants ?? []).filter(p => !submittedIds.has(p.id))
      );

      // Pool leader — season total from scores table
      const { data: seasonScores } = await supabase
        .from('scores')
        .select('participant_id, points, correct_picks')
        .eq('pool_id', poolId)
        .eq('season', currentSeason)
        .eq('season_type', currentSeasonType);

      if (seasonScores && seasonScores.length > 0) {
        const totalsMap = new Map<string, { points: number; correctPicks: number }>();
        seasonScores.forEach(s => {
          const e = totalsMap.get(s.participant_id);
          if (e) { e.points += s.points; e.correctPicks += s.correct_picks; }
          else { totalsMap.set(s.participant_id, { points: s.points, correctPicks: s.correct_picks }); }
        });
        let leaderId = '';
        let leaderPts = -1;
        totalsMap.forEach((v, id) => { if (v.points > leaderPts) { leaderPts = v.points; leaderId = id; } });
        if (leaderId) {
          const leaderName = (allParticipants ?? []).find(p => p.id === leaderId)?.name ?? 'Unknown';
          const ld = totalsMap.get(leaderId)!;
          setPoolLeader({ name: leaderName, points: ld.points, correctPicks: ld.correctPicks });
        } else {
          setPoolLeader(null);
        }
        // Build ranked leaderboard
        const ranked = [...totalsMap.entries()]
          .map(([id, { points, correctPicks }]) => ({
            participantId: id,
            name: (allParticipants ?? []).find(p => p.id === id)?.name ?? 'Unknown',
            points,
            correctPicks,
          }))
          .sort((a, b) => b.points - a.points);
        setLeaderboardEntries(ranked);
      } else if (allParticipants && allParticipants.length > 0) {
        // No scores yet — show first participant at 0
        setPoolLeader({ name: allParticipants[0].name, points: 0, correctPicks: 0 });
        setLeaderboardEntries(
          (allParticipants ?? []).map(p => ({ participantId: p.id, name: p.name, points: 0, correctPicks: 0 }))
        );
      } else {
        setPoolLeader(null);
        setLeaderboardEntries([]);
      }
    } catch (error) {
      debugError('Error loading pool stats:', error);
    }
  };

  const loadRecentActivity = async () => {
    try {
      if (!user?.email) return;

      const { getSupabaseServiceClient } = await import('@/lib/supabase');
      const supabase = getSupabaseServiceClient();

      const activities: any[] = [];
      const now = new Date();
      const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Get all pools this commissioner manages
      const { data: commissionerPools } = await supabase
        .from('pools')
        .select('id, name, created_at')
        .eq('created_by', user.email)
        .order('created_at', { ascending: false });

      const commissionerPoolIds = commissionerPools?.map(p => p.id) ?? [];

      // Pool creation events (last 30 days only)
      const recentPools = commissionerPools?.filter(p => p.created_at >= last30Days) ?? [];
      recentPools.slice(0, 3).forEach(pool => {
        activities.push({
          type: 'pool_created' as const,
          description: `Created new pool "${pool.name}"`,
          timestamp: pool.created_at,
          pool_name: pool.name,
        });
      });

      if (commissionerPoolIds.length === 0) {
        setRecentActivity(activities);
        return;
      }

      const poolNameMap = new Map(commissionerPools?.map(p => [p.id, p.name]) || []);

      // Participants who joined this commissioner's pools in the last 30 days
      const { data: participants } = await supabase
        .from('participants')
        .select('id, name, created_at, pool_id')
        .in('pool_id', commissionerPoolIds)
        .eq('is_active', true)
        .gte('created_at', last30Days)
        .order('created_at', { ascending: false })
        .limit(5);

      participants?.forEach(participant => {
        activities.push({
          type: 'participant_joined' as const,
          description: `${participant.name || 'New Participant'} joined "${poolNameMap.get(participant.pool_id) || 'Unknown Pool'}"`,
          timestamp: participant.created_at,
          participant_name: participant.name || 'New Participant',
          pool_name: poolNameMap.get(participant.pool_id),
        });
      });

      // Pick submissions in this commissioner's pools in the last 30 days
      const { data: picks } = await supabase
        .from('picks')
        .select('created_at, participant_id, pool_id')
        .in('pool_id', commissionerPoolIds)
        .gte('created_at', last30Days)
        .order('created_at', { ascending: false })
        .limit(10);

      if (picks && picks.length > 0) {
        const poolSubmissions = new Map<string, Set<string>>();
        picks.forEach(pick => {
          if (!poolSubmissions.has(pick.pool_id)) poolSubmissions.set(pick.pool_id, new Set());
          poolSubmissions.get(pick.pool_id)?.add(pick.participant_id);
        });

        poolSubmissions.forEach((submitters, poolId) => {
          const count = submitters.size;
          if (count > 0) {
            activities.push({
              type: 'picks_submitted' as const,
              description: `${count} participant${count !== 1 ? 's' : ''} submitted picks for "${poolNameMap.get(poolId) || 'Unknown Pool'}"`,
              timestamp: picks.find(p => p.pool_id === poolId)?.created_at || now.toISOString(),
            });
          }
        });
      }

      setRecentActivity(
        activities
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 5)
      );
    } catch (error) {
      debugError('Error loading recent activity:', error);
      setRecentActivity([]);
    }
  };

  const handlePoolCreated = async () => {
    await loadDashboardStats();
    await loadRecentActivity();
    toast({
      title: 'Pool Created',
      description: 'New pool has been created successfully',
    });
  };

  const generateNotifications = () => {
    const newNotifications: string[] = [];

    if (dashboardStats.totalPools === 0) {
      newNotifications.push('You haven\'t created any pools yet. Create your first pool to get started!');
      setNotifications(newNotifications);
      return;
    }

    if (dashboardStats.pendingSubmissions > 0) {
      newNotifications.push(`${dashboardStats.pendingSubmissions} participants haven't submitted picks for Week ${currentWeek}`);
    }

    if (dashboardStats.totalGames === 0) {
      newNotifications.push('No games scheduled for the current week');
    }

    if (dashboardStats.activePools === 0) {
      newNotifications.push('All your pools are currently inactive');
    }

    if (dashboardStats.totalParticipants === 0) {
      newNotifications.push('No participants have joined your pools yet');
    }

    if (dashboardStats.completedSubmissions > 0 && dashboardStats.pendingSubmissions === 0) {
      newNotifications.push('All participants have submitted their picks for this week!');
    }

    setNotifications(newNotifications);
  };

  const handleCopyPicksLink = async () => {
    if (!selectedPoolId) return;
    const url = `${window.location.origin}/pool/${selectedPoolId}/picks?week=${currentWeek}&seasonType=${currentSeasonType}`;
    await navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadDashboardStats();
      await loadGames();
      generateNotifications();
      loadRecentActivity();
      setLastRefresh(new Date());
      toast({ title: 'Dashboard Refreshed', description: 'All data has been updated' });
    } catch (error) {
      debugError('Error refreshing dashboard:', error);
      toast({ title: 'Refresh Failed', description: 'Failed to refresh dashboard data', variant: 'destructive' });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const { getSupabaseClient } = await import('@/lib/supabase');
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
      await signOut();
      router.push(createPageUrl('adminlogin'));
    } catch (error) {
      debugError('Error logging out:', error);
      setIsLoggingOut(false);
    }
  };

  const loadCountdown = async () => {
    try {
      const { getSupabaseServiceClient } = await import('@/lib/supabase');
      const supabase = getSupabaseServiceClient();
      const { data } = await supabase
        .from('seasons')
        .select('picks_close_at')
        .eq('season_type', currentSeasonType)
        .eq('week', currentWeek)
        .single();

      if (data?.picks_close_at) {
        const picksCloseAt = new Date(data.picks_close_at);
        const now = new Date();
        const diffInSeconds = (picksCloseAt.getTime() - now.getTime()) / 1000;

        if (diffInSeconds > 0) {
          setCountdown(`${Math.floor(diffInSeconds / 3600)}h ${Math.floor((diffInSeconds % 3600) / 60)}m`);
        } else {
          setCountdown('Games Started');
        }
      } else {
        setCountdown('Games Started');
      }
    } catch (error) {
      debugError('Error loading countdown:', error);
      setCountdown('Games Started');
    }
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw style={{ width: 32, height: 32, color: textDim, margin: '0 auto 0.75rem', animation: 'spin 1s linear infinite' }} />
          <p style={{ ...b, color: textMid, fontSize: '0.9rem' }}>Loading dashboard…</p>
        </div>
      </div>
    );
  }

  const poolStats = [
    { label: 'Participants', value: String(selectedPoolStats.participants), sub: 'In this pool',    accent: text },
    { label: 'Pending',      value: String(selectedPoolStats.pending),      sub: 'Need picks',      accent: amber },
    { label: 'Completed',    value: String(selectedPoolStats.completed),    sub: 'Picks submitted', accent: greenHi },
    { label: 'Completion',   value: `${selectedPoolStats.completionRate}%`, sub: 'Rate',            accent: 'oklch(59% 0.18 230)' },
  ];

  const selectedPool = availablePools.find(p => p.id === selectedPoolId) ?? null;
  const selectedPoolHasPlayoffs = selectedPool?.season_scope?.includes(3) ?? false;
  const selectedPoolHasRegularSeason = selectedPool?.season_scope?.includes(2) ?? true;

  const activityAccent = (type: string) => {
    if (type === 'pool_created') return greenHi;
    if (type === 'participant_joined') return 'oklch(59% 0.18 230)';
    if (type === 'picks_submitted') return 'oklch(62% 0.16 300)';
    return textDim;
  };

  return (
    <div style={{ background: bg, minHeight: '100vh' }}>

      {/* NAV */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'oklch(13% 0.025 255 / 0.95)',
        backdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${border}`,
      }}>
        <div className="lp-inner" style={{ paddingTop: '0.75rem', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', rowGap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: green, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Trophy style={{ width: 14, height: 14, color: text }} />
              </div>
              <span style={{ ...bc, fontWeight: 800, fontSize: '0.92rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                Sunday Huddle
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => setCreatePoolDialogOpen(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.3rem',
                  padding: '0.35rem 0.7rem',
                  background: green, color: text,
                  border: 'none', borderRadius: 5,
                  ...bc, fontWeight: 700, fontSize: '0.72rem',
                  letterSpacing: '0.07em', textTransform: 'uppercase',
                  cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                <Plus style={{ width: 11, height: 11 }} />
                <span className="pools-nav-label">New Pool</span>
              </button>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  padding: '0.35rem 0.7rem',
                  background: 'transparent', color: textMid,
                  border: `1px solid ${border}`, borderRadius: 5,
                  ...bc, fontWeight: 600, fontSize: '0.72rem',
                  letterSpacing: '0.07em', textTransform: 'uppercase',
                  cursor: isLoggingOut ? 'not-allowed' : 'pointer',
                  opacity: isLoggingOut ? 0.5 : 1, whiteSpace: 'nowrap',
                }}
              >
                <LogOut style={{ width: 11, height: 11 }} />
                <span className="pools-nav-label">{isLoggingOut ? 'Logging out…' : 'Logout'}</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Plan banner */}
      {planInfo?.isTrialActive && (
        <div style={{ background: 'oklch(28% 0.08 60)', borderBottom: `1px solid oklch(40% 0.12 60)` }}>
          <div className="lp-inner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', paddingTop: '0.55rem', paddingBottom: '0.55rem' }}>
            <p style={{ ...b, fontSize: '0.8rem', color: 'oklch(85% 0.09 60)', margin: 0 }}>
              <strong style={{ color: amber }}>Standard trial</strong> — {planInfo.daysLeft} day{planInfo.daysLeft !== 1 ? 's' : ''} remaining. After it ends your account reverts to the free tier (1 pool, 15 participants).
            </p>
          </div>
        </div>
      )}
      {planInfo && !planInfo.isTrialActive && planInfo.plan === 'free' && (
        <div style={{ background: 'oklch(20% 0.03 255)', borderBottom: `1px solid ${border}` }}>
          <div className="lp-inner" style={{ paddingTop: '0.55rem', paddingBottom: '0.55rem' }}>
            <p style={{ ...b, fontSize: '0.8rem', color: textMid, margin: 0 }}>
              Free plan — limited to 1 pool and 15 participants per pool.
            </p>
          </div>
        </div>
      )}

      {/* HERO */}
      <section style={{
        background: bg,
        backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 59px, oklch(100% 0 0 / 0.022) 59px, oklch(100% 0 0 / 0.022) 60px)`,
        padding: 'clamp(3rem, 6vw, 5rem) 0',
      }}>
        <div className="lp-inner">
          <div className="lp-hero-row">

            {/* Left: title + description */}
            <div className="lp-hero-text">
              <p style={{ ...bc, fontWeight: 700, fontSize: '0.67rem', letterSpacing: '0.28em', color: greenHi, textTransform: 'uppercase', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                <span style={{ display: 'inline-block', width: 20, height: 2, background: greenHi, borderRadius: 1, flexShrink: 0 }} />
                Commissioner HQ
              </p>
              <h1 style={{ ...bc, fontWeight: 900, fontSize: 'clamp(3rem, 7vw, 4.5rem)', lineHeight: 0.92, letterSpacing: '-0.01em', color: text, textTransform: 'uppercase', marginBottom: '1.5rem' }}>
                Commissioner<br /><span style={{ color: gold }}>Dashboard</span>
              </h1>
              <p style={{ ...b, fontSize: '0.95rem', lineHeight: 1.72, color: textMid, maxWidth: '36ch' }}>
                Manage your Sunday Huddles and participants.
              </p>
              <p style={{ ...bc, fontSize: '0.75rem', fontWeight: 600, color: textDim, marginTop: '1rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Week {currentWeek} · Refreshed {lastRefresh.toLocaleTimeString()}
              </p>
            </div>

            {/* Right: commissioner access overview */}
            <div className="lp-hero-card">
              <div style={{ background: surface, border: `1px solid ${border}`, borderTop: `3px solid ${green}`, borderRadius: 10, padding: '1.75rem' }}>
                <p style={{ ...bc, fontWeight: 700, fontSize: '0.63rem', letterSpacing: '0.24em', color: greenHi, textTransform: 'uppercase', marginBottom: '1.25rem' }}>
                  Commissioner Access
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  {[
                    { label: 'Status', value: 'Active', sub: 'Account standing' },
                    { label: 'Pools', value: String(dashboardStats.totalPools), sub: `${dashboardStats.activePools} active` },
                    { label: 'Members', value: String(dashboardStats.totalParticipants), sub: 'Across all pools' },
                  ].map(({ label, value, sub }) => (
                    <div key={label} style={{ background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '1rem' }}>
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

      {/* green rule */}
      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${green}, transparent)` }} />

      <section style={{ background: bg, padding: '2.5rem 0' }}>
        <div className="lp-inner">

          {/* Offseason Banner */}
          {currentSeasonType === 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <OffseasonBanner message="The NFL season has ended. Your pools and historical data remain accessible below." />
            </div>
          )}

          {/* Countdown Timer */}
          {currentSeasonType !== 0 && countdown && countdown !== 'Games Started' && (
            <div style={{
              background: 'oklch(20% 0.04 230)',
              border: `1px solid oklch(30% 0.06 230)`,
              borderRadius: 8,
              padding: '1rem 1.25rem',
              marginBottom: '2rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
            }}>
              <Clock style={{ width: 18, height: 18, color: 'oklch(59% 0.18 230)', flexShrink: 0 }} />
              <div style={{ textAlign: 'center' }}>
                <p style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: 'oklch(82% 0.12 230)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Picks Close In: {countdown}
                </p>
                <p style={{ ...b, fontSize: '0.78rem', color: 'oklch(62% 0.1 230)', marginTop: '0.2rem' }}>
                  Make sure participants submit their picks before kickoff
                </p>
              </div>
            </div>
          )}

          {/* Games Started Warning */}
          {currentSeasonType !== 0 && countdown === 'Games Started' && (
            <div style={{
              background: 'oklch(18% 0.04 25)',
              border: `1px solid oklch(30% 0.08 25)`,
              borderRadius: 8,
              padding: '1rem 1.25rem',
              marginBottom: '2rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
            }}>
              <AlertTriangle style={{ width: 18, height: 18, color: liveRed, flexShrink: 0 }} />
              <div style={{ textAlign: 'center' }}>
                <p style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: 'oklch(82% 0.14 25)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Games Have Started!
                </p>
                <p style={{ ...b, fontSize: '0.78rem', color: 'oklch(62% 0.1 25)', marginTop: '0.2rem' }}>
                  All picks are now locked for Week {currentWeek}
                </p>
              </div>
            </div>
          )}

          {/* Pool Workspace */}
          <div id='pool-workspace' style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.2em', color: textDim, textTransform: 'uppercase' }}>
              Pool Workspace
            </p>
            {availablePools.length > 0 && (
              <Select value={selectedPoolId} onValueChange={setSelectedPoolId}>
                <SelectTrigger style={{ minWidth: 200, background: card, border: `1px solid ${border}`, color: text, fontSize: '0.78rem' }}>
                  <SelectValue placeholder="Select a pool" />
                </SelectTrigger>
                <SelectContent>
                  {availablePools.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedPool ? (
            <div style={{ marginBottom: '2.5rem' }}>
              {/* Pool info card */}
              <div style={{
                background: surface,
                border: `1px solid ${border}`,
                borderTop: `3px solid ${green}`,
                borderRadius: 10,
                padding: '1.25rem 1.5rem',
                marginBottom: '0.75rem',
              }}>
                {/* Top row: pool identity */}
                <div
                  className='pool-identity'
                  style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap', alignItems: 'center', paddingBottom: '1rem', marginBottom: '1rem', borderBottom: `1px solid ${border}` }}
                >
                  <div>
                    <p style={{ ...bc, fontSize: '0.56rem', fontWeight: 700, letterSpacing: '0.22em', color: textDim, textTransform: 'uppercase', marginBottom: '0.2rem' }}>Pool</p>
                    <p style={{ ...bc, fontWeight: 800, fontSize: '1.05rem', color: text }}>{selectedPool.name}</p>
                  </div>
                  <div>
                    <p style={{ ...bc, fontSize: '0.56rem', fontWeight: 700, letterSpacing: '0.22em', color: textDim, textTransform: 'uppercase', marginBottom: '0.2rem' }}>Year</p>
                    <p style={{ ...bc, fontWeight: 800, fontSize: '1.05rem', color: text }}>{currentSeason}</p>
                  </div>
                  <div>
                    <p style={{ ...bc, fontSize: '0.56rem', fontWeight: 700, letterSpacing: '0.22em', color: textDim, textTransform: 'uppercase', marginBottom: '0.2rem' }}>Current Week</p>
                    <p style={{ ...bc, fontWeight: 800, fontSize: '1.05rem', color: text }}>{currentWeek}</p>
                  </div>
                  <div style={{ marginLeft: 'auto' }}>
                    <p style={{ ...bc, fontSize: '0.56rem', fontWeight: 700, letterSpacing: '0.22em', color: textDim, textTransform: 'uppercase', marginBottom: '0.2rem' }}>Picks Page</p>
                    <button
                      onClick={handleCopyPicksLink}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                        padding: '0.3rem 0.65rem',
                        background: linkCopied ? 'oklch(46% 0.14 155 / 0.15)' : 'transparent',
                        color: linkCopied ? greenHi : textMid,
                        border: `1px solid ${linkCopied ? 'oklch(46% 0.14 155 / 0.4)' : border}`,
                        borderRadius: 5, cursor: 'pointer',
                        transition: 'all 0.15s',
                        ...bc, fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase',
                      }}
                    >
                      {linkCopied
                        ? <><Check style={{ width: 11, height: 11 }} /> Copied!</>
                        : <><Link2 style={{ width: 11, height: 11 }} /> Copy Link</>}
                    </button>
                  </div>
                </div>
                {/* Bottom row: pool stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.75rem' }}>
                  {poolStats.map(({ label, value, sub, accent }) => (
                    <div key={label} style={{ background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '0.875rem 1rem' }}>
                      <p style={{ ...bc, fontWeight: 900, fontSize: '1.75rem', color: accent, lineHeight: 1, letterSpacing: '0.02em' }}>{value}</p>
                      <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', color: text, letterSpacing: '0.07em', textTransform: 'uppercase', marginTop: '0.25rem' }}>{label}</p>
                      <p style={{ ...b, fontSize: '0.65rem', color: textDim, marginTop: '0.1rem' }}>{sub}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pool tab bar */}
              <div style={{ background: 'oklch(17% 0.028 255)', border: `1px solid ${border}`, borderRadius: 8, padding: '0.25rem', display: 'flex', gap: '0.15rem', overflowX: 'auto', marginBottom: '0.75rem' }} className="hide-scrollbar">
                {([
                  { id: 'overview',       label: 'Overview',       icon: TrendingUp },
                  { id: 'players',        label: 'Players',        icon: Users },
                  { id: 'leaderboard',    label: 'Leaderboard',    icon: BarChart3 },
                  { id: 'override-picks', label: 'Override Picks', icon: Edit },
                  { id: 'season-review',  label: 'Season Review',  icon: Calendar },
                  { id: 'playoffs',       label: 'Playoffs',       icon: Trophy },
                  { id: 'export',         label: 'Export',         icon: Download },
                  { id: 'settings',       label: 'Settings',       icon: Settings },
                ] as const)
                  .filter(t => t.id !== 'playoffs' || selectedPoolHasPlayoffs)
                  .filter(t => t.id !== 'season-review' || selectedPoolHasRegularSeason)
                  .map(({ id, label, icon: Icon }) => {
                  const active = activePoolTab === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setActivePoolTab(id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.3rem',
                        padding: '0.45rem 0.75rem', flexShrink: 0,
                        background: active ? green : 'transparent',
                        color: active ? text : textMid,
                        border: `1px solid ${active ? green : 'transparent'}`,
                        borderRadius: 6, cursor: 'pointer',
                        ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase',
                      }}
                    >
                      <Icon style={{ width: 13, height: 13 }} />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Overview tab */}
              {activePoolTab === 'overview' && (
                <>
                  {poolLeader && (
                    <div style={{ background: 'oklch(19% 0.04 72)', border: `1px solid oklch(35% 0.1 72)`, borderLeft: `4px solid ${gold}`, borderRadius: 10, padding: '1.1rem 1.5rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, background: 'oklch(74% 0.16 72 / 0.18)', border: `1px solid oklch(74% 0.16 72 / 0.45)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Trophy style={{ width: 18, height: 18, color: gold }} />
                      </div>
                      <div>
                        <p style={{ ...bc, fontWeight: 700, fontSize: '0.56rem', letterSpacing: '0.22em', color: gold, textTransform: 'uppercase', marginBottom: '0.2rem' }}>Pool Leader</p>
                        <p style={{ ...bc, fontWeight: 800, fontSize: '1.05rem', color: text, letterSpacing: '0.02em' }}>
                          {poolLeader.name}
                          <span style={{ color: textMid, fontWeight: 600, fontSize: '0.9rem' }}>{' '}· {poolLeader.points} pts</span>
                        </p>
                        <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.1rem' }}>
                          {poolLeader.correctPicks} correct pick{poolLeader.correctPicks !== 1 ? 's' : ''} this season
                        </p>
                      </div>
                    </div>
                  )}
                  {currentSeasonType !== 0 && missingParticipants.length > 0 && (
                    <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1.1rem 1.5rem', marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
                        <AlertTriangle style={{ width: 14, height: 14, color: amber, flexShrink: 0 }} />
                        <p style={{ ...bc, fontWeight: 700, fontSize: '0.78rem', color: text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Missing Picks — Week {currentWeek}</p>
                        <span style={{ marginLeft: 'auto', ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.08em', color: amber, background: 'oklch(72% 0.16 60 / 0.12)', border: '1px solid oklch(72% 0.16 60 / 0.3)', borderRadius: 4, padding: '0.15rem 0.5rem' }}>
                          {missingParticipants.length} pending
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.5rem' }}>
                        {missingParticipants.map(p => (
                          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: surface, border: `1px solid ${border}`, borderRadius: 6, padding: '0.55rem 0.75rem' }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: 'oklch(72% 0.16 60 / 0.15)', border: '1px solid oklch(72% 0.16 60 / 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', ...bc, fontWeight: 800, fontSize: '0.72rem', color: amber }}>
                              {p.name.charAt(0).toUpperCase()}
                            </div>
                            <span style={{ ...b, fontSize: '0.8rem', color: text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {currentSeasonType !== 0 && missingParticipants.length === 0 && weekGamesCount > 0 && selectedPoolStats.participants > 0 && (
                    <div style={{ background: 'oklch(18% 0.04 155)', border: `1px solid oklch(32% 0.1 155)`, borderRadius: 10, padding: '0.875rem 1.5rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: greenHi, flexShrink: 0 }} />
                      <p style={{ ...bc, fontWeight: 700, fontSize: '0.75rem', color: greenHi, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                        All picks submitted for Week {currentWeek}
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Players tab */}
              {activePoolTab === 'players' && selectedPool && (
                <ParticipantManagement poolId={selectedPoolId} poolName={selectedPool.name} />
              )}

              {/* Leaderboard tab */}
              {activePoolTab === 'leaderboard' && (
                <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                    <Trophy style={{ width: 16, height: 16, color: gold }} />
                    <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase' }}>Season Standings</p>
                  </div>
                  {leaderboardEntries.length === 0 ? (
                    <p style={{ ...b, fontSize: '0.82rem', color: textDim }}>No scores recorded yet for this season.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {leaderboardEntries.map((entry, index) => (
                        <div key={entry.participantId} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: 'oklch(17% 0.028 255)', border: `1px solid ${border}`, borderRadius: 8 }}>
                          <span style={{ ...bc, fontWeight: 800, fontSize: '0.82rem', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: index === 0 ? 'oklch(74% 0.16 72 / 0.18)' : 'oklch(26% 0.03 255)', color: index === 0 ? gold : textDim, border: `1px solid ${index === 0 ? 'oklch(74% 0.16 72 / 0.4)' : border}` }}>
                            {index + 1}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ ...b, fontWeight: 600, fontSize: '0.875rem', color: text }}>{entry.name}</p>
                            <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.1rem' }}>{entry.correctPicks} correct picks</p>
                          </div>
                          <p style={{ ...bc, fontWeight: 900, fontSize: '1.1rem', color: index === 0 ? gold : greenHi, letterSpacing: '0.02em' }}>
                            {entry.points} <span style={{ ...b, fontWeight: 400, fontSize: '0.72rem', color: textDim }}>pts</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Override Picks tab */}
              {activePoolTab === 'override-picks' && selectedPool && (
                <OverridePicksPanel poolId={selectedPoolId} poolName={selectedPool.name} currentSeason={currentSeason} seasonScope={selectedPool.season_scope} />
              )}

              {/* Season Review tab */}
              {activePoolTab === 'season-review' && selectedPoolHasRegularSeason && (
                <SeasonReviewPanel poolId={selectedPoolId} season={currentSeason} />
              )}

              {/* Playoffs tab */}
              {activePoolTab === 'playoffs' && selectedPool && selectedPoolHasPlayoffs && (
                <div>
                  <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '1.25rem', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <Trophy style={{ width: 14, height: 14, color: greenHi }} />
                      <p style={{ ...bc, fontWeight: 800, fontSize: '0.85rem', color: text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Playoff Confidence Points</p>
                    </div>
                    <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginBottom: '1rem' }}>Manage playoff confidence points and view participant submission status</p>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => router.push(`/pool/${selectedPoolId}/playoffs`)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 0.9rem', background: green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
                      >
                        <Trophy style={{ width: 12, height: 12 }} /> Manage Playoff Confidence Points
                      </button>
                    </div>
                  </div>
                  <PlayoffParticipantsList poolId={selectedPoolId} poolSeason={currentSeason} />
                </div>
              )}

              {/* Export tab */}
              {activePoolTab === 'export' && selectedPool && (
                <ExportData
                  poolId={selectedPoolId}
                  poolName={selectedPool.name}
                  currentWeek={currentWeek}
                  currentSeason={currentSeason}
                />
              )}

              {/* Settings tab */}
              {activePoolTab === 'settings' && selectedPool && (
                <PoolSettings
                  poolId={selectedPoolId}
                  poolName={selectedPool.name}
                  onPoolDeleted={() => { setSelectedPoolId(''); setActivePoolTab('overview'); }}
                />
              )}
            </div>
          ) : (
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '2rem', textAlign: 'center', marginBottom: '2.5rem' }}>
              <Trophy style={{ width: 24, height: 24, color: textDim, margin: '0 auto 0.75rem' }} />
              <p style={{ ...bc, fontWeight: 700, fontSize: '0.88rem', color: textMid, textTransform: 'uppercase', letterSpacing: '0.07em' }}>No Pools Yet</p>
              <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginTop: '0.35rem' }}>Create a pool to manage it here.</p>
              <button
                onClick={() => setCreatePoolDialogOpen(true)}
                style={{
                  marginTop: '1rem',
                  padding: '0.45rem 1.1rem',
                  background: green, color: text,
                  border: 'none', borderRadius: 5,
                  ...bc, fontWeight: 700, fontSize: '0.75rem',
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                }}
              >
                <Plus style={{ width: 12, height: 12 }} /> Create First Pool
              </button>
            </div>
          )}

          {/* Recent Activity */}
          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '1.25rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <TrendingUp style={{ width: 14, height: 14, color: greenHi }} />
              <p style={{ ...bc, fontWeight: 800, fontSize: '0.85rem', color: text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Recent Activity
              </p>
            </div>
            <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginBottom: '1rem' }}>
              Latest updates and notifications
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {recentActivity.length > 0 ? (
                recentActivity.map((activity, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.75rem 1rem',
                      background: surface, border: `1px solid ${border}`,
                      borderRadius: 6,
                    }}
                  >
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: activityAccent(activity.type),
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ ...b, fontSize: '0.82rem', color: text, fontWeight: 600 }}>
                        {activity.description}
                      </p>
                      <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.15rem' }}>
                        {new Date(activity.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                  <Bell style={{ width: 36, height: 36, color: textDim, margin: '0 auto 0.75rem' }} />
                  <p style={{ ...b, fontSize: '0.85rem', color: textDim }}>No recent activity</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </section>

      {/* FOOTER */}
      <Footer pageName="Commissioner HQ" />

      {/* Create Pool Dialog */}
      <CreatePoolDialog
        open={createPoolDialogOpen}
        onOpenChange={setCreatePoolDialogOpen}
        onPoolCreated={handlePoolCreated}
      />
    </div>
  );
}

export default function CommissionerDashboard() {
  return (
    <AuthProvider>
      <AdminGuard>
        <CommissionerDashboardContent />
      </AdminGuard>
    </AuthProvider>
  );
}
