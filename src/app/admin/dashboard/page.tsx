'use client';

import { useState, useEffect, useRef, type ComponentType, type CSSProperties } from 'react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Shield,
  Users,
  Trophy,
  Calendar,
  LogOut,
  Bell,
  RefreshCw,
  Plus,
  X,
  Settings,
  TrendingUp,
  BarChart3,
  Edit,
  AlertTriangle,
  Link2,
  Check,
  Zap,
  Clock,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { adminService, DashboardStats, Admin } from '@/lib/admin-service';
import { getUpcomingWeek } from '@/actions/loadCurrentWeek';
import { debugLog, createPageUrl, debugError, getTeam, getTeamAbbreviation } from '@/lib/utils';
import { AuthProvider } from '@/lib/auth';
import { AdminGuard } from '@/components/auth/admin-guard';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CreatePoolDialog } from '@/components/pools/create-pool-dialog';
import { ExportData } from '@/components/admin/export-data';
import { Footer } from '@/components/layout/Footer';
import { OffseasonBanner } from '@/components/ui/offseason-banner';
import { ParticipantManagement } from '@/components/admin/participant-management';
import { OverridePicksPanel } from '@/components/admin/override-picks-panel';
import { SeasonReviewPanel } from '@/components/admin/season-review-panel';
import { PlayoffParticipantsList } from '@/components/admin/playoff-participants-list';
import { PoolSettings } from '@/components/admin/pool-settings';

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
const amber   = 'oklch(72% 0.16 60)';

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

const quarterOptions = [
  { value: 'all',      label: 'All Quarters' },
  { value: 'Q1',       label: 'Quarter 1 (Weeks 1-4)' },
  { value: 'Q2',       label: 'Quarter 2 (Weeks 5-8)' },
  { value: 'Q3',       label: 'Quarter 3 (Weeks 9-12)' },
  { value: 'Q4',       label: 'Quarter 4 (Weeks 13-16)' },
  { value: 'Playoffs', label: 'Playoffs (Weeks 17-20)' },
];

const GAMES_SEASON_TYPES = [
  { value: 1, label: 'Preseason', weeks: 4 },
  { value: 2, label: 'Regular Season', weeks: 18 },
  { value: 3, label: 'Playoffs', weeks: 4 },
];
const gamesCurrentYear = new Date().getFullYear();
const GAMES_YEARS = [gamesCurrentYear - 1, gamesCurrentYear, gamesCurrentYear + 1];

interface WeekGame {
  id: string;
  home_team: string;
  away_team: string;
  kickoff_time: string;
  status: string;
  winner?: string | null;
  home_score?: number | null;
  away_score?: number | null;
}

interface Pool {
  id: string;
  name: string;
  season: number;
  is_active: boolean;
  is_closed?: boolean;
  season_scope?: number[];
}

interface QuickAction {
  icon: ComponentType<{ style?: CSSProperties }>;
  accent: string;
  title: string;
  onClick: () => void;
}

function QuickActionsPanel({
  actions, selectedQuarter, setSelectedQuarter, isGeneratingWinners, handleGeneratePeriodWinners,
}: {
  actions: QuickAction[];
  selectedQuarter: string;
  setSelectedQuarter: (v: string) => void;
  isGeneratingWinners: boolean;
  handleGeneratePeriodWinners: () => void;
}) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
        <span style={{ display: 'block', width: 3, height: 16, background: green, borderRadius: 2, flexShrink: 0 }} />
        <h2 style={{ ...bc, fontWeight: 800, fontSize: '0.8rem', letterSpacing: '0.06em', color: text, textTransform: 'uppercase' }}>
          Quick Actions
        </h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {actions.map(({ icon: Icon, accent, title, onClick }) => (
          <button
            key={title}
            onClick={onClick}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.55rem',
              padding: '0.55rem 0.65rem', width: '100%',
              background: 'transparent', border: `1px solid ${border}`, borderRadius: 7,
              color: text, textAlign: 'left', cursor: 'pointer',
              ...b, fontSize: '0.76rem', fontWeight: 600,
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = card; e.currentTarget.style.borderColor = accent; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = border; }}
          >
            <Icon style={{ width: 14, height: 14, color: accent, flexShrink: 0 }} />
            {title}
          </button>
        ))}
      </div>

      <div style={{ borderTop: `1px solid ${border}`, marginTop: '0.75rem', paddingTop: '0.75rem' }}>
        <p style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', ...bc, fontWeight: 700, fontSize: '0.68rem', color: textDim, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
          <Trophy style={{ width: 12, height: 12, color: gold }} /> Period Winners
        </p>
        <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
          <SelectTrigger style={{ width: '100%', fontSize: '0.76rem' }}>
            <SelectValue placeholder="Select quarter" />
          </SelectTrigger>
          <SelectContent>
            {quarterOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          onClick={handleGeneratePeriodWinners}
          disabled={isGeneratingWinners}
          style={{
            marginTop: '0.5rem', width: '100%',
            padding: '0.5rem 0.75rem',
            background: isGeneratingWinners ? 'oklch(35% 0.08 155)' : green,
            color: text, border: 'none', borderRadius: 6,
            ...bc, fontWeight: 700, fontSize: '0.72rem',
            letterSpacing: '0.06em', textTransform: 'uppercase',
            cursor: isGeneratingWinners ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
          }}
        >
          {isGeneratingWinners
            ? <><RefreshCw style={{ width: 12, height: 12 }} className="animate-spin" /> Generating…</>
            : <><Trophy style={{ width: 12, height: 12 }} /> Generate Winners</>
          }
        </button>
      </div>
    </>
  );
}

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
  const [pools, setPools] = useState<Pool[]>([]);
  const [selectedPoolId, setSelectedPoolId] = useState<string>('');
  const [poolsLoading, setPoolsLoading] = useState(false);
  const [recentActivity, setRecentActivity] = useState<Array<{
    type: 'pool_created' | 'participant_joined' | 'picks_submitted';
    description: string;
    timestamp: string;
    pool_name?: string;
    pool_id?: string;
  }>>([]);
  const [activityPoolFilter, setActivityPoolFilter] = useState<string>('all');
  const [currentSeason, setCurrentSeason] = useState(new Date().getFullYear());
  const [activePoolTab, setActivePoolTab] = useState<'overview' | 'players' | 'leaderboard' | 'override-picks' | 'season-review' | 'playoffs' | 'settings'>('overview');
  const [selectedPoolStats, setSelectedPoolStats] = useState({ participants: 0, completed: 0, pending: 0, completionRate: 0 });
  const [poolLeader, setPoolLeader] = useState<{ name: string; points: number; correctPicks: number } | null>(null);
  const [missingParticipants, setMissingParticipants] = useState<Array<{ id: string; name: string }>>([]);
  const [weekGamesCount, setWeekGamesCount] = useState(0);
  const [leaderboardEntries, setLeaderboardEntries] = useState<Array<{ participantId: string; name: string; points: number; correctPicks: number }>>([]);
  const [linkCopied, setLinkCopied] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);

  // Games browser (season/week toggle)
  const [gamesSeasonYear, setGamesSeasonYear] = useState(gamesCurrentYear);
  const [gamesSeasonType, setGamesSeasonType] = useState(2);
  const [gamesWeek, setGamesWeek]             = useState(1);
  const [gamesByWeek, setGamesByWeek]         = useState<{ week: number; games: WeekGame[] }[]>([]);
  const [gamesListLoading, setGamesListLoading] = useState(false);
  const gamesToggleSeeded = useRef(false);

  // Seed the games browser to "this week" once real season/week data loads, then
  // leave it alone so manual toggling isn't fought by later re-renders.
  useEffect(() => {
    if (!gamesToggleSeeded.current && currentSeasonType && currentSeasonType !== 0) {
      gamesToggleSeeded.current = true;
      setGamesSeasonYear(currentSeason);
      setGamesSeasonType(currentSeasonType);
      setGamesWeek(currentWeek);
    }
  }, [currentSeason, currentSeasonType, currentWeek]);

  useEffect(() => {
    const loadGamesForSeason = async () => {
      setGamesListLoading(true);
      try {
        const res = await fetch(`/api/admin/season-games?season=${gamesSeasonYear}&seasonType=${gamesSeasonType}`);
        const data = await res.json();
        if (data.success) setGamesByWeek(data.weeks ?? []);
      } catch (err) {
        debugError('Error loading games for season:', err);
      } finally {
        setGamesListLoading(false);
      }
    };
    loadGamesForSeason();
  }, [gamesSeasonYear, gamesSeasonType]);

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
            if (superAdminStatus) {
              await loadAdmins();
              await loadPools();
              await loadRecentActivity();
            }
          } catch (error) {
            debugLog('Error verifying admin status:', error);
            setIsLoading(false);
            return;
          }
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
    if (currentWeek && currentSeasonType !== undefined && isSuperAdmin !== undefined) {
      if (currentSeasonType !== 0) {
        loadDashboardStats();
        loadLastGameUpdate();
      }
    }
  }, [currentWeek, currentSeasonType, isSuperAdmin]);

  // Notifications must reflect the DB-fetched dashboardStats, never the zeroed
  // initial state — regenerate only once loadDashboardStats has actually resolved.
  useEffect(() => {
    if (currentSeasonType === 0) {
      setNotifications([]);
      return;
    }
    generateNotifications();
  }, [dashboardStats, currentSeasonType]);

  useEffect(() => {
    const handleOpenCreatePool = () => setCreatePoolDialogOpen(true);
    document.addEventListener('openCreatePoolDialog', handleOpenCreatePool);
    return () => document.removeEventListener('openCreatePoolDialog', handleOpenCreatePool);
  }, []);

  useEffect(() => {
    if (selectedPoolId) {
      const pool = pools.find(p => p.id === selectedPoolId);
      const season = pool?.season ?? new Date().getFullYear();
      setCurrentSeason(season);
      setActivePoolTab('overview');
      loadSelectedPoolStats(selectedPoolId, season);
    }
  }, [selectedPoolId, currentWeek, currentSeasonType]);

  const loadDashboardStats = async () => {
    try {
      if (!user?.email) return;
      const stats = await adminService.getDashboardStats(currentWeek, currentSeasonType, user.email, true);
      setDashboardStats(stats);
    } catch (error) {
      debugError('Error loading dashboard stats:', error);
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
      debugError('Error loading last game update:', error);
    }
  };

  const loadAdmins = async () => {
    try {
      const adminsData = await adminService.getAdmins();
      setAdmins(adminsData);
    } catch (error) {
      debugError('Error loading admins:', error);
      toast({ title: 'Error', description: 'Failed to load admin data', variant: 'destructive' });
    }
  };

  const loadPools = async () => {
    setPoolsLoading(true);
    try {
      const response = await fetch('/api/admin/all-pools');
      if (!response.ok) return;
      const data = await response.json();
      if (data.success && Array.isArray(data.pools)) {
        const sorted: Pool[] = [...data.pools].sort((a: Pool, b: Pool) => b.season - a.season);
        setPools(sorted);
        const stillExists = sorted.some(p => p.id === selectedPoolId);
        if (sorted.length > 0 && !stillExists) setSelectedPoolId(sorted[0].id);
      }
    } catch (err) {
      debugError('Error loading pools:', err);
    } finally {
      setPoolsLoading(false);
    }
  };

  const loadRecentActivity = async () => {
    try {
      const { getSupabaseServiceClient } = await import('@/lib/supabase');
      const supabase = getSupabaseServiceClient();
      const activities: { type: 'pool_created' | 'participant_joined' | 'picks_submitted'; description: string; timestamp: string; pool_name?: string; pool_id?: string; }[] = [];
      const now = new Date();
      const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const { data: allPools } = await supabase.from('pools').select('id, name, created_at');
      const poolNameMap = new Map(allPools?.map(p => [p.id, p.name]) || []);

      const recentPools = (allPools ?? []).filter(p => p.created_at >= last30Days);
      recentPools.slice(0, 5).forEach(pool => {
        activities.push({
          type: 'pool_created',
          description: `Pool "${pool.name}" was created`,
          timestamp: pool.created_at,
          pool_name: pool.name,
          pool_id: pool.id,
        });
      });

      const { data: participants } = await supabase
        .from('participants')
        .select('id, name, created_at, pool_id')
        .eq('is_active', true)
        .gte('created_at', last30Days)
        .order('created_at', { ascending: false })
        .limit(10);

      participants?.forEach(participant => {
        activities.push({
          type: 'participant_joined',
          description: `${participant.name || 'New Participant'} joined "${poolNameMap.get(participant.pool_id) || 'Unknown Pool'}"`,
          timestamp: participant.created_at,
          pool_name: poolNameMap.get(participant.pool_id),
          pool_id: participant.pool_id,
        });
      });

      const { data: picks } = await supabase
        .from('picks')
        .select('created_at, participant_id, pool_id')
        .gte('created_at', last30Days)
        .order('created_at', { ascending: false })
        .limit(20);

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
              type: 'picks_submitted',
              description: `${count} participant${count !== 1 ? 's' : ''} submitted picks for "${poolNameMap.get(poolId) || 'Unknown Pool'}"`,
              timestamp: picks.find(p => p.pool_id === poolId)?.created_at || now.toISOString(),
              pool_name: poolNameMap.get(poolId),
              pool_id: poolId,
            });
          }
        });
      }

      setRecentActivity(
        activities
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 10)
      );
    } catch (error) {
      debugError('Error loading recent activity:', error);
      setRecentActivity([]);
    }
  };

  const loadSelectedPoolStats = async (poolId: string, season: number) => {
    try {
      const { getSupabaseServiceClient } = await import('@/lib/supabase');
      const supabase = getSupabaseServiceClient();

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
      setMissingParticipants((allParticipants ?? []).filter(p => !submittedIds.has(p.id)));

      const { data: seasonScores } = await supabase
        .from('scores')
        .select('participant_id, points, correct_picks')
        .eq('pool_id', poolId)
        .eq('season', season);

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
        setPoolLeader({ name: allParticipants[0].name, points: 0, correctPicks: 0 });
        setLeaderboardEntries((allParticipants ?? []).map(p => ({ participantId: p.id, name: p.name, points: 0, correctPicks: 0 })));
      } else {
        setPoolLeader(null);
        setLeaderboardEntries([]);
      }
    } catch (error) {
      debugError('Error loading pool stats:', error);
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
    if (dashboardStats.totalGames === 0)
      n.push('🏈 No games scheduled for the current week. Check NFL sync.');
    setNotifications(n);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadDashboardStats();
      await loadLastGameUpdate();
      await loadRecentActivity();
      await loadPools();
      setLastRefresh(new Date());
      toast({ title: 'Dashboard Refreshed', description: 'All data has been updated' });
    } catch {
      toast({ title: 'Refresh Failed', description: 'Failed to refresh dashboard data', variant: 'destructive' });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handlePoolCreated = async () => {
    await Promise.all([loadDashboardStats(), loadPools()]);
    toast({ title: 'Pool Created', description: 'New pool has been created successfully' });
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
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

  const handleCopyPicksLink = async () => {
    if (!selectedPoolId) return;
    const url = `${window.location.origin}/pool/${selectedPoolId}/picks?week=${currentWeek}&seasonType=${currentSeasonType}`;
    await navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
        <div className="animate-spin rounded-full h-16 w-16" style={{ borderWidth: '3px', borderStyle: 'solid', borderColor: border, borderTopColor: green }} />
      </div>
    );
  }


  const selectedPool = pools.find(p => p.id === selectedPoolId) ?? null;
  const selectedPoolHasPlayoffs = selectedPool?.season_scope?.includes(3) ?? false;
  const gamesSeasonTypeWeeks = GAMES_SEASON_TYPES.find(t => t.value === gamesSeasonType)?.weeks ?? 18;
  const gamesForSelectedWeek = gamesByWeek.find(w => w.week === gamesWeek)?.games ?? [];
  const poolStats = [
    { label: 'Participants', value: String(selectedPoolStats.participants), sub: 'In this pool',    accent: text },
    { label: 'Pending',      value: String(selectedPoolStats.pending),      sub: 'Need picks',      accent: amber },
    { label: 'Completed',    value: String(selectedPoolStats.completed),    sub: 'Picks submitted', accent: greenHi },
    { label: 'Completion',   value: `${selectedPoolStats.completionRate}%`, sub: 'Rate',            accent: 'oklch(59% 0.18 230)' },
  ];
  const seasonLabel = currentSeasonType === 0 ? '' : currentSeasonType === 1 ? 'Preseason' : currentSeasonType === 2 ? 'Regular Season' : 'Postseason';
  const activityAccent = (type: string) => {
    if (type === 'pool_created') return greenHi;
    if (type === 'participant_joined') return 'oklch(59% 0.18 230)';
    if (type === 'picks_submitted') return 'oklch(62% 0.16 300)';
    return textDim;
  };
  const filteredActivity = activityPoolFilter === 'all'
    ? recentActivity
    : recentActivity.filter(a => a.pool_id === activityPoolFilter);
  const weekTitle = currentSeasonType === 0 ? 'Offseason' : `Week ${currentWeek} - ${seasonLabel}`;

  const statItems = [
    { label: 'Total Pools',    value: dashboardStats.totalPools,                          sub: `${dashboardStats.activePools} active` },
    { label: 'Participants',   value: dashboardStats.totalParticipants,                    sub: 'Across all pools' },
    { label: 'Admins',         value: admins.filter(a => a.is_super_admin).length,         sub: 'System administrators' },
    { label: 'Commissioners',  value: admins.filter(a => !a.is_super_admin).length,        sub: 'Pool managers' },
  ];

  const now = new Date();
  const commissionerAdmins = admins.filter(a => !a.is_super_admin);
  const payingCommissioners = commissionerAdmins.filter(a => a.plan === 'standard' || a.plan === 'pro').length;
  const freeCommissioners   = commissionerAdmins.filter(a => (a.plan ?? 'free') === 'free').length;
  const trialingCommissioners = commissionerAdmins.filter(a => a.trial_ends_at && new Date(a.trial_ends_at) > now).length;
  const planItems = [
    { label: 'Paying',   value: payingCommissioners,   sub: 'Standard + Pro plans', color: greenHi },
    { label: 'Free',     value: freeCommissioners,     sub: 'Free plan',            color: textDim },
    { label: 'On Trial',  value: trialingCommissioners,  sub: 'Temporary Standard access', color: amber },
  ];

  const actions = [
    { icon: Users,    accent: green,                    title: 'Manage Commissioners', onClick: () => router.push(createPageUrl('admincommissioners')) },
    { icon: Shield,   accent: green,                    title: 'Manage Admins',        onClick: () => router.push('/admin/manage-admins') },
    { icon: Trophy,   accent: gold,                     title: 'Playoff Management',   onClick: () => router.push('/admin/playoffs') },
    { icon: Calendar, accent: green,                    title: 'NFL Sync',             onClick: () => router.push(createPageUrl('adminnflsync')) },
    { icon: Calendar, accent: 'oklch(65% 0.12 290)',    title: 'Season Games',         onClick: () => router.push('/admin/season-games') },
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
              <div className="pools-nav-label" style={{ minWidth: 0 }}>
                <span style={{ ...bc, fontWeight: 800, fontSize: '0.95rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase', display: 'block', whiteSpace: 'nowrap' }}>
                  Commissioner HQ
                </span>
                <span style={{ ...bc, fontWeight: 600, fontSize: '0.6rem', letterSpacing: '0.18em', color: greenHi, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  System Administration
                </span>
              </div>
              <Badge variant="outline" className="pools-nav-label" style={{ fontSize: '0.6rem', flexShrink: 0, borderColor: border, color: textMid }}>
                Super Admin
              </Badge>
            </div>

            {/* Right: utility buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                title="Refresh"
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  padding: '0.4rem 0.65rem',
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
                <span className="pools-nav-label">{isRefreshing ? 'Refreshing…' : 'Refresh'}</span>
              </button>

              <button
                onClick={() => {
                  const next = !showNotifications;
                  setShowNotifications(next);
                  if (next) window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
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
                onClick={() => router.push(createPageUrl('adminsettings'))}
                title="Account Settings"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 34, height: 34,
                  background: 'transparent', color: textMid,
                  border: `1px solid ${border}`, borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                <Settings style={{ width: 15, height: 15 }} />
              </button>

              <button
                onClick={() => setCreatePoolDialogOpen(true)}
                title="New Pool"
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  padding: '0.4rem 0.75rem',
                  background: green, color: text,
                  border: 'none', borderRadius: 6,
                  ...bc, fontWeight: 700, fontSize: '0.72rem',
                  letterSpacing: '0.07em', textTransform: 'uppercase',
                  cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                <Plus style={{ width: 12, height: 12 }} />
                <span className="pools-nav-label">New Pool</span>
              </button>

              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                title="Logout"
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  padding: '0.4rem 0.65rem',
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
                <span className="pools-nav-label">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Notifications Banner ── */}
      {showNotifications && (
        <div style={{ background: 'oklch(18% 0.03 255)', borderBottom: `1px solid ${border}` }}>
          <div className="lp-inner" style={{ paddingTop: '0.875rem', paddingBottom: '0.875rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.18em', color: textDim, textTransform: 'uppercase' }}>
                Notifications {notifications.length > 0 && `(${notifications.length})`}
              </span>
              {notifications.length > 0 && (
                <button
                  onClick={() => setNotifications([])}
                  style={{ ...bc, fontSize: '0.62rem', fontWeight: 600, color: textDim, letterSpacing: '0.08em', textTransform: 'uppercase', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.1rem 0.3rem' }}
                >
                  Clear All
                </button>
              )}
            </div>
            {notifications.length === 0 ? (
              <p style={{ ...b, fontSize: '0.8rem', color: textDim }}>No new notifications</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {notifications.map((n, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: greenHi, flexShrink: 0 }} />
                    <span style={{ ...b, fontSize: '0.8rem', color: textMid, flex: 1 }}>{n}</span>
                    <button
                      onClick={() => setNotifications(prev => prev.filter((_, idx) => idx !== i))}
                      aria-label="Dismiss notification"
                      style={{
                        width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                        background: 'transparent', border: `1px solid ${border}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: textDim,
                      }}
                    >
                      <X style={{ width: 10, height: 10 }} />
                    </button>
                  </div>
                ))}
              </div>
            )}
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

      {/* ── COMMISSIONER PLANS ── */}
      <section style={{ background: surface, padding: '2.5rem 0' }}>
        <div className="lp-inner">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ display: 'block', width: 3, height: 22, background: green, borderRadius: 2, flexShrink: 0 }} />
              <h2 style={{ ...bc, fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.06em', color: text, textTransform: 'uppercase' }}>
                Commissioner Plans
              </h2>
            </div>
            <button
              onClick={() => router.push('/admin/commissioners')}
              style={{ ...bc, fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: greenHi, background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              Manage &amp; Send Promo →
            </button>
          </div>
          <div className="admin-3col-grid" style={{ marginBottom: 0 }}>
            {planItems.map(({ label, value, sub, color }) => (
              <div key={label} style={{ background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '1rem' }}>
                <div style={{ ...bc, fontWeight: 900, fontSize: '2rem', color, lineHeight: 1, letterSpacing: '0.02em' }}>{value}</div>
                <div style={{ ...bc, fontWeight: 700, fontSize: '0.68rem', color: text, letterSpacing: '0.07em', textTransform: 'uppercase', marginTop: '0.3rem' }}>{label}</div>
                <div style={{ ...b, fontSize: '0.68rem', color: textDim, marginTop: '0.15rem' }}>{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── OFFSEASON BANNER ── */}
      {currentSeasonType === 0 && (
        <section style={{ background: bg, padding: '2rem 0' }}>
          <div className="lp-inner">
            <OffseasonBanner message="The NFL season has ended. Use the tools below to manage pools and pre-load the upcoming season's games." />
          </div>
        </section>
      )}

      {/* ── WEEK SCOREBOARD ── */}
      <section
       id="week-scoreboard"
       style={{ background: bg, padding: '3.5rem 0' }}>
        <div className="lp-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <span style={{ display: 'block', width: 3, height: 24, background: green, borderRadius: 2, flexShrink: 0 }} />
            <h3 style={{ ...bc, fontWeight: 800, fontSize: '1.25rem', letterSpacing: '0.06em', color: text, textTransform: 'uppercase' }}>
              {weekTitle}
            </h3>
            <span style={{ ...bc, fontSize: '0.72rem', color: textDim, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              {seasonLabel}
            </span>
          </div>

          <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden' }}>
            {/* Column headers */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
              background: card, borderBottom: `1px solid ${border}`,
              padding: '0.625rem 1.25rem',
            }}>
              {['Games', 'Last Sync'].map(h => (
                <div key={h} style={{ textAlign: 'center' }}>
                  <span style={{ ...bc, fontWeight: 700, fontSize: '0.6rem', letterSpacing: '0.2em', color: textDim, textTransform: 'uppercase' }}>{h}</span>
                </div>
              ))}
            </div>

            {/* Values */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', padding: '1.75rem 1.25rem', gap: '1rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ ...bc, fontWeight: 900, fontSize: '2.5rem', color: greenHi, lineHeight: 1, letterSpacing: '0.02em' }}>
                  {dashboardStats.totalGames}
                </div>
                <div style={{ ...b, fontSize: '0.7rem', color: textDim, marginTop: '0.25rem' }}>scheduled</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ ...bc, fontWeight: 700, fontSize: '1.1rem', color: text, lineHeight: 1 }}>
                  {lastGameUpdate ? lastGameUpdate.toLocaleTimeString() : '—'}
                </div>
                <div style={{ ...b, fontSize: '0.7rem', color: textDim, marginTop: '0.25rem' }}>last game sync</div>
              </div>
            </div>
          </div>

          {/* Games browser — toggle season / week, list games for that week */}
          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <div>
                <p style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.1em', color: textDim, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Season</p>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  {GAMES_YEARS.map(y => (
                    <button
                      key={y}
                      onClick={() => setGamesSeasonYear(y)}
                      style={{ padding: '0.4rem 0.7rem', background: gamesSeasonYear === y ? green : 'transparent', color: gamesSeasonYear === y ? text : textMid, border: `1px solid ${gamesSeasonYear === y ? green : border}`, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.76rem', letterSpacing: '0.04em', cursor: 'pointer' }}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.1em', color: textDim, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Type</p>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  {GAMES_SEASON_TYPES.map(st => (
                    <button
                      key={st.value}
                      onClick={() => { setGamesSeasonType(st.value); setGamesWeek(1); }}
                      style={{ padding: '0.4rem 0.7rem', background: gamesSeasonType === st.value ? green : 'transparent', color: gamesSeasonType === st.value ? text : textMid, border: `1px solid ${gamesSeasonType === st.value ? green : border}`, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.76rem', letterSpacing: '0.04em', cursor: 'pointer' }}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Week pills */}
            <div className="hide-scrollbar" style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.25rem', marginBottom: '1rem' }}>
              {Array.from({ length: gamesSeasonTypeWeeks }, (_, i) => i + 1).map(w => (
                <button
                  key={w}
                  onClick={() => setGamesWeek(w)}
                  style={{
                    width: 36, height: 36, flexShrink: 0, borderRadius: 8,
                    background: gamesWeek === w ? green : card,
                    color: gamesWeek === w ? text : textMid,
                    border: `1px solid ${gamesWeek === w ? green : border}`,
                    ...bc, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
                  }}
                >
                  {w}
                </button>
              ))}
            </div>

            {/* Games list */}
            {gamesListLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: textDim, ...b, fontSize: '0.85rem' }}>Loading games…</div>
            ) : gamesForSelectedWeek.length === 0 ? (
              <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 10, padding: '2rem', textAlign: 'center' }}>
                <p style={{ ...b, fontSize: '0.85rem', color: textDim }}>No games scheduled for Week {gamesWeek}.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {gamesForSelectedWeek.map(g => {
                  const away = getTeam(getTeamAbbreviation(g.away_team));
                  const home = getTeam(getTeamAbbreviation(g.home_team));
                  const statusNorm = g.status?.toLowerCase();
                  const isFinal = statusNorm === 'final' || statusNorm === 'post';
                  const isLive = statusNorm === 'in_progress' || statusNorm === 'live';
                  const winnerCity = g.winner ? getTeam(getTeamAbbreviation(g.winner)).city : null;
                  let kickoffLabel = '';
                  try { kickoffLabel = format(new Date(g.kickoff_time), 'EEE MMM d, h:mm a'); } catch { kickoffLabel = g.kickoff_time; }

                  return (
                    <div
                      key={g.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        background: card, border: `1px solid ${border}`, borderRadius: 10,
                        padding: '0.75rem 1rem',
                      }}
                    >
                      <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: away.color, ...bc, fontWeight: 900, fontSize: '0.65rem', color: '#fff' }}>
                        {away.abbreviation}
                      </div>
                      <span style={{ ...b, fontSize: '0.72rem', color: textDim, flexShrink: 0 }}>@</span>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: home.color, ...bc, fontWeight: 900, fontSize: '0.65rem', color: '#fff' }}>
                        {home.abbreviation}
                      </div>
                      <p style={{ ...b, fontSize: '0.85rem', color: text, flex: 1, minWidth: 0 }}>
                        {away.city} at {home.city}
                      </p>
                      <div style={{ flexShrink: 0, textAlign: 'right' }}>
                        {isFinal && winnerCity ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', ...bc, fontWeight: 700, fontSize: '0.78rem', color: greenHi }}>
                            <Check size={13} /> {winnerCity}
                          </span>
                        ) : isLive ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', ...bc, fontWeight: 700, fontSize: '0.78rem', color: liveRed }}>
                            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: liveRed, animation: 'pulse 1.4s ease-in-out infinite' }} />
                            {g.away_score ?? 0}-{g.home_score ?? 0}
                          </span>
                        ) : (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', ...b, fontSize: '0.75rem', color: textDim }}>
                            <Clock size={12} /> {kickoffLabel}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── POOL WORKSPACE ── */}
      <section style={{ background: surface, padding: '3.5rem 0' }}>
        <div id='pool-workspace' className="lp-inner">

          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ display: 'block', width: 3, height: 24, background: green, borderRadius: 2, flexShrink: 0 }} />
              <h2 style={{ ...bc, fontWeight: 800, fontSize: '1.25rem', letterSpacing: '0.06em', color: text, textTransform: 'uppercase' }}>
                Pool Workspace
              </h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {poolsLoading ? (
                <span style={{ ...b, fontSize: '0.8rem', color: textDim }}>Loading pools…</span>
              ) : pools.length > 0 ? (
                <Select value={selectedPoolId} onValueChange={setSelectedPoolId}>
                  <SelectTrigger style={{ minWidth: 220, background: card, border: `1px solid ${border}`, color: text }}>
                    <SelectValue placeholder="Select a pool" />
                  </SelectTrigger>
                  <SelectContent>
                    {pools.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name} ({p.season})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </div>
          </div>

          {selectedPool ? (
            <div>
              {/* Pool info card */}
              <div style={{
                background: card,
                border: `1px solid ${border}`,
                borderTop: `3px solid ${green}`,
                borderRadius: 10,
                padding: '1.25rem 1.5rem',
                marginBottom: '0.75rem',
              }}>
                {/* Top row: pool identity */}
                <div
                  className="pool-identity"
                  style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap', alignItems: 'center', paddingBottom: '1rem', marginBottom: '1rem', borderBottom: `1px solid ${border}` }}
                >
                  <div>
                    <p style={{ ...bc, fontSize: '0.56rem', fontWeight: 700, letterSpacing: '0.22em', color: textDim, textTransform: 'uppercase', marginBottom: '0.2rem' }}>Pool</p>
                    <p style={{ ...bc, fontWeight: 800, fontSize: '1.05rem', color: text }}>{selectedPool.name}</p>
                  </div>
                  <div>
                    <p style={{ ...bc, fontSize: '0.56rem', fontWeight: 700, letterSpacing: '0.22em', color: textDim, textTransform: 'uppercase', marginBottom: '0.2rem' }}>Year</p>
                    <p style={{ ...bc, fontWeight: 800, fontSize: '1.05rem', color: text }}>{selectedPool.season}</p>
                  </div>
                  <div>
                    <p style={{ ...bc, fontSize: '0.56rem', fontWeight: 700, letterSpacing: '0.22em', color: textDim, textTransform: 'uppercase', marginBottom: '0.2rem' }}>Current Week</p>
                    <p style={{ ...bc, fontWeight: 800, fontSize: '1.05rem', color: text }}>{currentWeek}</p>
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: selectedPool.is_active ? green : textDim, flexShrink: 0 }} />
                      <span style={{ ...bc, fontSize: '0.68rem', fontWeight: 700, color: selectedPool.is_active ? greenHi : textDim, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                        {selectedPool.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
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
              <div className="hide-scrollbar" style={{ background: 'oklch(17% 0.028 255)', border: `1px solid ${border}`, borderRadius: 8, padding: '0.25rem', display: 'flex', gap: '0.15rem', overflowX: 'auto', marginBottom: '0.75rem' }}>
                {([
                  { id: 'overview',       label: 'Overview',       icon: TrendingUp },
                  { id: 'players',        label: 'Players',        icon: Users },
                  { id: 'leaderboard',    label: 'Leaderboard',    icon: BarChart3 },
                  { id: 'override-picks', label: 'Override Picks', icon: Edit },
                  { id: 'season-review',  label: 'Season Review',  icon: Calendar },
                  { id: 'playoffs',       label: 'Playoffs',       icon: Trophy },
                  { id: 'settings',       label: 'Settings',       icon: Settings },
                ] as const).filter(t => t.id !== 'playoffs' || selectedPoolHasPlayoffs).map(({ id, label, icon: Icon }) => {
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
                      <span className="pool-tab-label">{label}</span>
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
              {activePoolTab === 'players' && (
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
              {activePoolTab === 'override-picks' && (
                <OverridePicksPanel poolId={selectedPoolId} poolName={selectedPool.name} currentSeason={selectedPool.season} />
              )}

              {/* Season Review tab */}
              {activePoolTab === 'season-review' && (
                <SeasonReviewPanel poolId={selectedPoolId} season={selectedPool.season} />
              )}

              {/* Playoffs tab */}
              {activePoolTab === 'playoffs' && selectedPoolHasPlayoffs && (
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
                  <PlayoffParticipantsList poolId={selectedPoolId} poolSeason={selectedPool.season} />
                </div>
              )}

              {/* Settings tab */}
              {activePoolTab === 'settings' && (
                <PoolSettings
                  poolId={selectedPoolId}
                  poolName={selectedPool.name}
                  onPoolDeleted={() => { setSelectedPoolId(''); setActivePoolTab('overview'); }}
                />
              )}
            </div>
          ) : !poolsLoading ? (
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '2.5rem', textAlign: 'center' }}>
              <Trophy style={{ width: 24, height: 24, color: textDim, margin: '0 auto 0.75rem' }} />
              <p style={{ ...bc, fontWeight: 700, fontSize: '0.9rem', color: textMid, textTransform: 'uppercase', letterSpacing: '0.07em' }}>No Pools Yet</p>
              <p style={{ ...b, fontSize: '0.8rem', color: textDim, marginTop: '0.4rem' }}>Create a pool to manage it here.</p>
              <button
                onClick={() => setCreatePoolDialogOpen(true)}
                style={{
                  marginTop: '1.25rem',
                  padding: '0.5rem 1.25rem',
                  background: green, color: text,
                  border: 'none', borderRadius: 6,
                  ...bc, fontWeight: 700, fontSize: '0.78rem',
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                }}
              >
                <Plus style={{ width: 13, height: 13 }} /> Create First Pool
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {/* ── QUICK ACTIONS (toggle — FAB opens a closable panel at any screen size) ── */}
      <button
        onClick={() => setQuickActionsOpen(true)}
        aria-label="Open quick actions"
        style={{
          position: 'fixed', bottom: '1.25rem', right: '1.25rem',
          width: 52, height: 52, borderRadius: '50%',
          background: green, color: text, border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 20px oklch(0% 0 0 / 0.45)',
          cursor: 'pointer', zIndex: 45,
        }}
      >
        <Zap style={{ width: 22, height: 22 }} />
      </button>

      <Dialog open={quickActionsOpen} onOpenChange={setQuickActionsOpen}>
        <DialogContent style={{ maxWidth: '22rem', background: surface, border: `1px solid ${border}` }}>
          <DialogHeader>
            <DialogTitle className="sr-only">Quick Actions</DialogTitle>
          </DialogHeader>
          <QuickActionsPanel
            actions={actions}
            selectedQuarter={selectedQuarter}
            setSelectedQuarter={setSelectedQuarter}
            isGeneratingWinners={isGeneratingWinners}
            handleGeneratePeriodWinners={handleGeneratePeriodWinners}
          />
        </DialogContent>
      </Dialog>

      {/* ── RECENT ACTIVITY ── */}
      <section style={{ background: bg, padding: '3.5rem 0' }}>
        <div className="lp-inner">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ display: 'block', width: 3, height: 24, background: green, borderRadius: 2, flexShrink: 0 }} />
              <h2 style={{ ...bc, fontWeight: 800, fontSize: '1.25rem', letterSpacing: '0.06em', color: text, textTransform: 'uppercase' }}>
                Recent Activity
              </h2>
            </div>
            <Select value={activityPoolFilter} onValueChange={setActivityPoolFilter}>
              <SelectTrigger style={{ minWidth: 200, background: card, border: `1px solid ${border}`, color: text }}>
                <SelectValue placeholder="Filter by pool" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Pools</SelectItem>
                {pools.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name} ({p.season})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 10, padding: '1.5rem' }}>
            {filteredActivity.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {filteredActivity.map((activity, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.875rem 1rem',
                      background: card, border: `1px solid ${border}`,
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: activityAccent(activity.type) }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ ...b, fontSize: '0.85rem', color: text, fontWeight: 600 }}>
                        {activity.description}
                      </p>
                      {activity.pool_name && (
                        <p style={{ ...bc, fontSize: '0.65rem', fontWeight: 700, color: textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '0.15rem' }}>
                          {activity.pool_name}
                        </p>
                      )}
                    </div>
                    <p style={{ ...b, fontSize: '0.72rem', color: textDim, flexShrink: 0 }}>
                      {new Date(activity.timestamp).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                <TrendingUp style={{ width: 32, height: 32, color: textDim, margin: '0 auto 0.75rem' }} />
                <p style={{ ...bc, fontWeight: 700, fontSize: '0.88rem', color: textMid, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  {activityPoolFilter === 'all' ? 'No recent activity' : 'No activity for this pool'}
                </p>
                <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginTop: '0.35rem' }}>Activity from the last 30 days will appear here.</p>
              </div>
            )}
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
              alignSelf: 'start',
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

export default function AdminDashboardPage() {
  return (
    <AuthProvider>
      <AdminGuard>
        <AdminDashboardContent />
      </AdminGuard>
    </AuthProvider>
  );
}
