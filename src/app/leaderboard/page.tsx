'use client';

import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AuthProvider, useAuth } from '@/lib/auth';
import { SharedAdminGuard } from '@/components/auth/shared-admin-guard';
import { loadCurrentWeek } from '@/actions/loadCurrentWeek';
import { LeaderboardEntryWithPicks } from '@/actions/loadPicksForLeaderboard';
import { debugLog, createPageUrl, DEFAULT_POOL_SEASON, getMaxWeeksForSeason, getSeasonTypeName, SEASON_TYPE_OPTIONS, debugError} from '@/lib/utils';
import {
  ArrowLeft,
  Trophy,
  Calendar,
  BarChart3,
  Filter,
  Search,
  AlertTriangle,
  Crown,
  Target,
  CalendarDays,
  LogOut,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Game, LeaderboardEntry } from '@/types/game';
import { WeeklyWinner, SeasonWinner, PeriodWinner } from '@/types/winners';
import { Footer } from '@/components/layout/Footer';
import { LEADERBOARD_TOOL_PLAN_MESSAGE } from '@/lib/plan';

// Fake preview rows shown behind the upgrade overlay for free-plan
// commissioners — never real participant data.
const TEASER_POOL_ID = '__teaser__';
const TEASER_LEADERBOARD: LeaderboardEntryWithPicks[] = [
  { participant_id: 't1', participant_name: 'Jordan A.', total_points: 84, correct_picks: 11, total_picks: 16, game_points: {}, picks: [] },
  { participant_id: 't2', participant_name: 'Casey M.',  total_points: 76, correct_picks: 10, total_picks: 16, game_points: {}, picks: [] },
  { participant_id: 't3', participant_name: 'Riley T.',  total_points: 71, correct_picks: 9,  total_picks: 16, game_points: {}, picks: [] },
  { participant_id: 't4', participant_name: 'Sam K.',    total_points: 63, correct_picks: 8,  total_picks: 16, game_points: {}, picks: [] },
];

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
const purple  = 'oklch(65% 0.12 290)';
const liveRed = 'oklch(62% 0.22 25)';

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

interface Pool {
  id: string;
  name: string;
  created_by: string;
  season: number;
  is_active: boolean;
  created_at: string;
  season_scope?: number[];
}

const TABS = [
  { id: 'weekly',    label: 'Weekly',    icon: CalendarDays },
  { id: 'season',    label: 'Season',    icon: Trophy },
  { id: 'periods',   label: 'Periods',   icon: Target },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
];

function LeaderboardContent() {
  const { user, verifyAdminStatus } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [currentWeek, setCurrentWeek] = useState(1);
  const [currentSeasonType, setCurrentSeasonType] = useState(2);
  const [selectedPool, setSelectedPool] = useState<string>('');
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedSeasonType, setSelectedSeasonType] = useState(2);
  const [selectedPoolSeason, setSelectedPoolSeason] = useState<number>(DEFAULT_POOL_SEASON);
  const [selectedPoolSeasonScope, setSelectedPoolSeasonScope] = useState<number[]>(SEASON_TYPE_OPTIONS.map(o => o.value));
  const [pools, setPools] = useState<Pool[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardWithPicks, setLeaderboardWithPicks] = useState<LeaderboardEntryWithPicks[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGamesStarted, setIsGamesStarted] = useState(false);
  const [allGamesFinished, setAllGamesFinished] = useState(false);

  // Winner data
  const [weeklyWinners, setWeeklyWinners] = useState<WeeklyWinner[]>([]);
  const [seasonWinner, setSeasonWinner] = useState<SeasonWinner | null>(null);
  const [periodWinners, setPeriodWinners] = useState<PeriodWinner[]>([]);
  const [isLoadingWinners, setIsLoadingWinners] = useState(false);

  // Admin-specific features
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'points' | 'accuracy' | 'name' | 'correct_picks'>('points');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showOnlySubmitted, setShowOnlySubmitted] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [activeTab, setActiveTab] = useState('weekly');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Standard-plan gate: super admins always pass; commissioners need a
  // paying (non-free) plan. Free or expired-trial accounts see this same
  // page rendered with fake teaser data behind an upgrade overlay.
  const [isGated, setIsGated] = useState(false);

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        if (user) {
          debugLog('Checking admin status for user:', user.email);
          const superAdminStatus = await verifyAdminStatus(true);
          setIsSuperAdmin(superAdminStatus);

          let gated = false;
          if (!superAdminStatus) {
            try {
              const res = await fetch(`/api/admin/plan-status?adminId=${user.id}`);
              const data = await res.json();
              gated = !(data.success && data.plan !== 'free');
            } catch {
              // If the plan check itself fails, fail closed (gated) rather
              // than leak real pool data on an error.
              gated = true;
            }
          }
          setIsGated(gated);

          if (gated) {
            loadTeaserData();
          } else {
            await loadData(superAdminStatus);
          }
        }
      } catch (error) {
        debugError('Error checking admin status:', error);
      }
    };

    const loadData = async (superAdminStatus: boolean) => {
      try {
        const weekData = await loadCurrentWeek();
        setCurrentWeek(weekData?.week_number || 1);
        setCurrentSeasonType(weekData?.season_type || 2);
        setSelectedWeek(weekData?.week_number || 1);
        setSelectedSeasonType(weekData?.season_type || 2);
        await loadPoolsData(superAdminStatus);
      } catch (error) {
        debugError('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Fake preview so the gated page never touches real pool/participant
    // data — no real API calls are made for a gated commissioner.
    const loadTeaserData = () => {
      const now = new Date();
      setCurrentWeek(1);
      setCurrentSeasonType(2);
      setSelectedWeek(1);
      setSelectedSeasonType(2);
      setPools([{
        id: TEASER_POOL_ID,
        name: 'Your Pool (preview)',
        created_by: user?.email || '',
        season: DEFAULT_POOL_SEASON,
        is_active: true,
        created_at: now.toISOString(),
      }]);
      setSelectedPool(TEASER_POOL_ID);
      setSelectedPoolSeason(DEFAULT_POOL_SEASON);
      setLeaderboardWithPicks(TEASER_LEADERBOARD);
      setIsLoading(false);
    };

    checkAdminStatus();
  }, [user, verifyAdminStatus, router]);

  // Restrict the leaderboard to the season types the selected pool actually
  // covers (same season_scope clamping the picks page uses), so a
  // regular-season-only pool can't be viewed as if it had playoffs.
  useEffect(() => {
    if (isGated || !selectedPool) return;
    const poolData = pools.find(p => p.id === selectedPool);
    if (!poolData) return;
    const scope = (Array.isArray(poolData.season_scope) && poolData.season_scope.length > 0)
      ? poolData.season_scope
      : [2];
    setSelectedPoolSeasonScope(prev =>
      prev.length === scope.length && prev.every((v, i) => v === scope[i]) ? prev : scope
    );
    if (!scope.includes(selectedSeasonType)) {
      setSelectedSeasonType([...scope].sort((a, b) => a - b)[0]);
      setSelectedWeek(1);
    }
  }, [selectedPool, pools, isGated, selectedSeasonType]);

  useEffect(() => {
    if (isGated) return; // teaser data is already set directly — no real fetches
    if (selectedPool && selectedWeek && selectedSeasonType && selectedPoolSeasonScope.includes(selectedSeasonType)) {
      loadLeaderboardData();
      loadGamesData();
      loadWinnerData();
    }
  }, [selectedPool, selectedWeek, selectedSeasonType, selectedPoolSeasonScope, isGated]);

  const loadPoolsData = async (superAdminStatus: boolean) => {
    try {
      const { getSupabaseServiceClient } = await import('@/lib/supabase');
      const supabase = getSupabaseServiceClient();

      let poolsQuery = supabase
        .from('pools')
        .select('*')
        .order('created_at', { ascending: false });

      if (!superAdminStatus) {
        poolsQuery = poolsQuery.eq('created_by', user?.email);
      }

      const { data: poolsData, error: poolsError } = await poolsQuery;
      if (poolsError) throw poolsError;

      setPools(poolsData || []);
      if (poolsData && poolsData.length > 0 && !selectedPool) {
        setSelectedPool(poolsData[0].id);
      }
    } catch (error) {
      debugError('Error loading pools:', error);
    }
  };

  const loadLeaderboardData = async () => {
    try {
      if (selectedPool) {
        const selectedPoolData = pools.find(p => p.id === selectedPool);
        if (selectedPoolData) {
          setSelectedPoolSeason(selectedPoolData.season || DEFAULT_POOL_SEASON);
        }
      }
      debugLog('Loading leaderboard data for:', { pool: selectedPool, week: selectedWeek, seasonType: selectedSeasonType, season: selectedPoolSeason });
      const response = await fetch(`/api/leaderboard?poolId=${selectedPool}&week=${selectedWeek}&seasonType=${selectedSeasonType}${selectedPoolSeason ? `&season=${selectedPoolSeason}` : ''}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setLeaderboardWithPicks(result.leaderboard);
          setGames(result.games);
        } else {
          debugError('API returned error:', result.error);
          setLeaderboardWithPicks([]);
        }
      } else {
        debugError('Failed to load leaderboard data');
        setLeaderboardWithPicks([]);
      }
      setLeaderboard([]);
    } catch (error) {
      debugError('Error loading leaderboard:', error);
      setLeaderboard([]);
      setLeaderboardWithPicks([]);
    }
  };

  const loadGamesData = async () => {
    try {
      const response = await fetch(`/api/games/week?week=${selectedWeek}&seasonType=${selectedSeasonType}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          const gamesData = result.games;
          setGames(gamesData);
          const now = new Date();
          const hasStarted = gamesData.some((game: Game) => new Date(game.kickoff_time) < now);
          setIsGamesStarted(hasStarted);
          const allFinished = gamesData.every((game: Game) => game.status === 'final' || game.status === 'post');
          setAllGamesFinished(allFinished);
        } else {
          debugError('API returned error:', result.error);
          setGames([]);
        }
      } else {
        debugError('Failed to load games');
        setGames([]);
      }
    } catch (error) {
      debugError('Error loading games:', error);
      setGames([]);
    }
  };

  const loadWinnerData = async () => {
    if (!selectedPool || !selectedPoolSeason) return;
    setIsLoadingWinners(true);
    try {
      const weeklyResponse = await fetch(`/api/admin/winners/weekly?poolId=${selectedPool}&season=${selectedPoolSeason}`);
      if (weeklyResponse.ok) {
        const result = await weeklyResponse.json();
        if (result.success) setWeeklyWinners(result.weeklyWinners);
      }
      const seasonResponse = await fetch(`/api/admin/winners/season?poolId=${selectedPool}&season=${selectedPoolSeason}`);
      if (seasonResponse.ok) {
        const result = await seasonResponse.json();
        if (result.success) setSeasonWinner(result.seasonWinner);
      }
      const periodResponse = await fetch(`/api/admin/winners/period?poolId=${selectedPool}&season=${selectedPoolSeason}`);
      if (periodResponse.ok) {
        const result = await periodResponse.json();
        if (result.success) setPeriodWinners(result.periodWinners);
      }
    } catch (error) {
      debugError('Error loading winner data:', error);
    } finally {
      setIsLoadingWinners(false);
    }
  };

  const filteredAndSortedLeaderboard = () => {
    let data = leaderboardWithPicks;
    if (searchTerm) {
      data = data.filter(entry => entry.participant_name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    if (showOnlySubmitted) {
      data = data.filter(entry => entry.total_picks > 0);
    }
    data.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;
      switch (sortBy) {
        case 'points':      aValue = a.total_points;  bValue = b.total_points;  break;
        case 'accuracy':    aValue = a.total_picks > 0 ? (a.correct_picks / a.total_picks) * 100 : 0; bValue = b.total_picks > 0 ? (b.correct_picks / b.total_picks) * 100 : 0; break;
        case 'name':        aValue = a.participant_name.toLowerCase(); bValue = b.participant_name.toLowerCase(); break;
        case 'correct_picks': aValue = a.correct_picks; bValue = b.correct_picks; break;
        default:            aValue = a.total_points;  bValue = b.total_points;
      }
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }
      return sortOrder === 'asc' ? (aValue as number) - (bValue as number) : (bValue as number) - (aValue as number);
    });
    return data;
  };

  const getPeriodDisplayName = (periodName: string) => {
    const periodNames: { [key: string]: string } = {
      'Q1': 'First Quarter (Weeks 1-4)',
      'Q2': 'Second Quarter (Weeks 5-8)',
      'Q3': 'Third Quarter (Weeks 9-12)',
      'Q4': 'Fourth Quarter (Weeks 13-16)',
      'Playoffs': 'Playoffs'
    };
    return periodNames[periodName] || periodName;
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw style={{ width: 32, height: 32, color: textDim, margin: '0 auto 0.75rem', animation: 'spin 1s linear infinite' }} />
          <p style={{ ...b, color: textMid, fontSize: '0.9rem' }}>Loading leaderboard data…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: bg, minHeight: '100vh', position: 'relative' }}>
      <div style={isGated ? { filter: 'blur(6px)', pointerEvents: 'none', userSelect: 'none' } : undefined} aria-hidden={isGated || undefined}>

      {/* NAV */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'oklch(13% 0.025 255 / 0.95)',
        backdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${border}`,
      }}>
        <div className="lp-inner" style={{ paddingTop: '0.75rem', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', rowGap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
              <button
                onClick={() => router.push(isSuperAdmin ? '/admin/dashboard' : '/dashboard')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  padding: '0.35rem 0.6rem',
                  background: 'transparent', color: textMid,
                  border: `1px solid ${border}`, borderRadius: 5,
                  ...bc, fontWeight: 600, fontSize: '0.72rem',
                  letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer', flexShrink: 0,
                }}
              >
                <ArrowLeft style={{ width: 12, height: 12 }} /> <span className="pools-nav-label">Back</span>
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: green, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Trophy style={{ width: 14, height: 14, color: text }} />
                </div>
                <span style={{ ...bc, fontWeight: 800, fontSize: '0.92rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  Sunday Huddle
                </span>
              </div>
            </div>
            <button
              style={{
                display: 'flex', alignItems: 'center', gap: '0.35rem',
                padding: '0.35rem 0.7rem',
                background: 'transparent', color: textMid,
                border: `1px solid ${border}`, borderRadius: 5,
                ...bc, fontWeight: 600, fontSize: '0.72rem',
                letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer',
              }}
            >
              <LogOut style={{ width: 11, height: 11 }} /> <span className="pools-nav-label">Sign Out</span>
            </button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{
        background: bg,
        backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 59px, oklch(100% 0 0 / 0.022) 59px, oklch(100% 0 0 / 0.022) 60px)`,
        padding: 'clamp(2rem, 4vw, 3rem) 0',
      }}>
        <div className="lp-inner">
          <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.26em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ display: 'inline-block', width: 18, height: 2, background: greenHi, borderRadius: 1 }} />
            Pool Analytics
          </p>
          <h1 style={{ ...bc, fontWeight: 900, fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', lineHeight: 0.95, color: text, textTransform: 'uppercase', marginBottom: '0.6rem' }}>
            {isSuperAdmin ? 'Pool Analytics &' : 'My Pool Analytics &'}<br />
            <span style={{ color: gold }}>Winners</span>
          </h1>
          <p style={{ ...b, fontSize: '0.875rem', color: textMid, marginTop: '0.75rem' }}>
            {isSuperAdmin
              ? 'Comprehensive view of all pool performance, weekly leaderboards, and season winners'
              : 'View performance, leaderboards, and winners for your pools'}
          </p>
        </div>
      </section>

      {/* green rule */}
      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${green}, transparent)` }} />

      {/* TABS */}
      <section style={{ background: surface, borderBottom: `1px solid ${border}`, position: 'sticky', top: 57, zIndex: 40 }}>
        <div className="lp-inner">
          <div className="hide-scrollbar" style={{ display: 'flex', gap: '0.25rem', overflowX: 'auto', paddingTop: '0.5rem' }}>
            {TABS.map(({ id, label, icon: Icon }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                    padding: '0.5rem 0.85rem',
                    background: active ? green : 'transparent',
                    color: active ? text : textMid,
                    border: `1px solid ${active ? green : 'transparent'}`,
                    borderBottom: active ? `1px solid ${green}` : `1px solid transparent`,
                    borderRadius: '6px 6px 0 0',
                    ...bc, fontWeight: 700, fontSize: '0.72rem',
                    letterSpacing: '0.07em', textTransform: 'uppercase',
                    cursor: 'pointer', whiteSpace: 'nowrap', marginBottom: -1,
                  }}
                >
                  <Icon style={{ width: 12, height: 12 }} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* MAIN CONTENT */}
      <section style={{ background: bg, padding: '2rem 0', minHeight: '50vh' }}>
        <div className="lp-inner">

          {/* Pool Selection Card */}
          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <BarChart3 style={{ width: 16, height: 16, color: greenHi }} />
              <span style={{ ...bc, fontWeight: 800, fontSize: '0.85rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase' }}>Pool Selection</span>
            </div>
            <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginBottom: '0.75rem' }}>Select pool to view analytics data</p>
            <div style={{ maxWidth: 360 }}>
              <label style={{ ...bc, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.07em', color: textDim, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>Pool</label>
              <Select value={selectedPool} onValueChange={setSelectedPool}>
                <SelectTrigger style={{ background: surface, border: `1px solid ${border}`, color: text }}>
                  <SelectValue placeholder="Select a pool" />
                </SelectTrigger>
                <SelectContent>
                  {pools.map((pool) => (
                    <SelectItem key={pool.id} value={pool.id}>{pool.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Current Selection Info */}
          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                  {pools.find(p => p.id === selectedPool)?.name || 'No Pool Selected'}
                </h3>
                <p style={{ ...b, fontSize: '0.78rem', color: textMid }}>Season {selectedPoolSeason}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ ...b, fontSize: '0.78rem', color: textDim }}>Games: {games.length}</div>
                <div style={{ ...b, fontSize: '0.78rem', color: textDim }}>Participants: {leaderboardWithPicks.length}</div>
              </div>
            </div>
          </div>

          {/* ── WEEKLY TAB ── */}
          {activeTab === 'weekly' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

              {/* Week & Season Type Selection */}
              <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <Calendar style={{ width: 16, height: 16, color: greenHi }} />
                  <span style={{ ...bc, fontWeight: 800, fontSize: '0.85rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase' }}>Week & Season Selection</span>
                </div>
                <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginBottom: '1rem' }}>Select the specific week and season type for the leaderboard</p>
                <div className="admin-2col-grid" style={{ marginBottom: 0 }}>
                  <div>
                    <label style={{ ...bc, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.07em', color: textDim, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>Season Type</label>
                    <Select value={selectedSeasonType.toString()} onValueChange={(value) => setSelectedSeasonType(parseInt(value))}>
                      <SelectTrigger style={{ background: surface, border: `1px solid ${border}`, color: text }}>
                        <SelectValue placeholder="Select season type" />
                      </SelectTrigger>
                      <SelectContent>
                        {SEASON_TYPE_OPTIONS.filter(({ value }) => selectedPoolSeasonScope.includes(value)).map(({ value, label }) => (
                          <SelectItem key={value} value={value.toString()}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label style={{ ...bc, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.07em', color: textDim, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>Week</label>
                    <Select value={selectedWeek.toString()} onValueChange={(value) => setSelectedWeek(parseInt(value))}>
                      <SelectTrigger style={{ background: surface, border: `1px solid ${border}`, color: text }}>
                        <SelectValue placeholder="Select week" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: getMaxWeeksForSeason(selectedSeasonType) }, (_, i) => i + 1).map((week) => (
                          <SelectItem key={week} value={week.toString()}>Week {week}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Commissioner Controls */}
              <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <Filter style={{ width: 16, height: 16, color: greenHi }} />
                  <span style={{ ...bc, fontWeight: 800, fontSize: '0.85rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase' }}>Commissioner Controls</span>
                </div>
                <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginBottom: '1rem' }}>Advanced filtering, sorting, and management tools</p>

                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <Search style={{ width: 14, height: 14, color: textDim, position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="text"
                      placeholder="Search participants..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      style={{
                        width: '100%', paddingLeft: '2.25rem', paddingRight: '1rem',
                        paddingTop: '0.5rem', paddingBottom: '0.5rem',
                        background: surface, border: `1px solid ${border}`, borderRadius: 6,
                        ...b, fontSize: '0.85rem', color: text,
                        outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <button
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.35rem',
                      padding: '0.5rem 0.85rem',
                      background: showAdvancedFilters ? green : 'transparent',
                      color: showAdvancedFilters ? text : textMid,
                      border: `1px solid ${showAdvancedFilters ? green : border}`,
                      borderRadius: 6,
                      ...bc, fontWeight: 700, fontSize: '0.72rem',
                      letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer',
                    }}
                  >
                    <Filter style={{ width: 12, height: 12 }} />
                    {showAdvancedFilters ? 'Hide' : 'Show'} Filters
                  </button>
                </div>

                {showAdvancedFilters && (
                  <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 8, padding: '1rem', display: 'grid', gap: '0.75rem' }}>
                    <div className="admin-3col-grid" style={{ marginBottom: 0 }}>
                      <div>
                        <label style={{ ...bc, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.07em', color: textDim, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>Sort By</label>
                        <Select value={sortBy} onValueChange={(value: 'points' | 'accuracy' | 'name' | 'correct_picks') => setSortBy(value)}>
                          <SelectTrigger style={{ background: card, border: `1px solid ${border}`, color: text }}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="points">Total Points</SelectItem>
                            <SelectItem value="accuracy">Accuracy %</SelectItem>
                            <SelectItem value="name">Name</SelectItem>
                            <SelectItem value="correct_picks">Correct Picks</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label style={{ ...bc, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.07em', color: textDim, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>Sort Order</label>
                        <Select value={sortOrder} onValueChange={(value: 'asc' | 'desc') => setSortOrder(value)}>
                          <SelectTrigger style={{ background: card, border: `1px solid ${border}`, color: text }}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="desc">Descending</SelectItem>
                            <SelectItem value="asc">Ascending</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={showOnlySubmitted}
                            onChange={(e) => setShowOnlySubmitted(e.target.checked)}
                            style={{ accentColor: greenHi }}
                          />
                          <span style={{ ...b, fontSize: '0.82rem', color: textMid }}>Show only submitted</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Weekly Leaderboard Table */}
              <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '1.25rem 1.25rem 0.75rem', borderBottom: `1px solid ${border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <Trophy style={{ width: 16, height: 16, color: gold }} />
                    <span style={{ ...bc, fontWeight: 800, fontSize: '0.85rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase' }}>
                      Week {selectedWeek} Leaderboard
                    </span>
                  </div>
                  <p style={{ ...b, fontSize: '0.78rem', color: textDim }}>
                    {getSeasonTypeName(selectedSeasonType)} — {pools.find(p => p.id === selectedPool)?.name}
                  </p>
                </div>

                {leaderboardWithPicks.length > 0 ? (() => {
                  const sortedLeaderboard = filteredAndSortedLeaderboard();
                  // Nobody has actually scored yet — don't crown a leader.
                  const hasScores = sortedLeaderboard.some(entry => entry.total_points > 0);
                  return (
                  <div style={{ overflowX: 'auto', width: '100%' }}>
                    <Table style={{ width: 'max-content', minWidth: '100%' }}>
                      <TableHeader>
                        <TableRow style={{ borderBottom: `1px solid ${border}`, background: surface }}>
                          <TableHead style={{ ...bc, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase', minWidth: '3.5rem', whiteSpace: 'nowrap' }}>Rank</TableHead>
                          <TableHead style={{ ...bc, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase', minWidth: '10rem', whiteSpace: 'nowrap' }}>Participant</TableHead>
                          <TableHead style={{ ...bc, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase', textAlign: 'center', minWidth: '6rem', whiteSpace: 'nowrap' }}>Total Points</TableHead>
                          <TableHead style={{ ...bc, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase', textAlign: 'center', minWidth: '6.5rem', whiteSpace: 'nowrap' }}>Correct Picks</TableHead>
                          <TableHead style={{ ...bc, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase', textAlign: 'center', minWidth: '5.5rem', whiteSpace: 'nowrap' }}>Total Picks</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedLeaderboard.map((entry, index) => (
                          <TableRow key={entry.participant_id} style={{ borderBottom: `1px solid ${border}`, background: index % 2 === 0 ? 'transparent' : 'oklch(18% 0.028 255 / 0.5)' }}>
                            <TableCell style={{ ...b, fontSize: '0.875rem', color: text }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {hasScores && index === 0 && <Trophy style={{ width: 14, height: 14, color: gold }} />}
                                {hasScores && index === 1 && <Trophy style={{ width: 14, height: 14, color: textMid }} />}
                                {hasScores && index === 2 && <Trophy style={{ width: 14, height: 14, color: amber }} />}
                                <span style={{ color: hasScores && index < 3 ? text : textMid }}>{index + 1}</span>
                              </div>
                            </TableCell>
                            <TableCell style={{ ...b, fontSize: '0.875rem', color: text, fontWeight: 600 }}>
                              {entry.participant_name}
                            </TableCell>
                            <TableCell style={{ ...bc, fontSize: '0.95rem', fontWeight: 900, color: greenHi, textAlign: 'center' }}>
                              {entry.total_points}
                            </TableCell>
                            <TableCell style={{ ...b, fontSize: '0.875rem', color: textMid, textAlign: 'center' }}>
                              {entry.correct_picks}
                            </TableCell>
                            <TableCell style={{ ...b, fontSize: '0.875rem', color: textDim, textAlign: 'center' }}>
                              {entry.total_picks}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  );
                })() : (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                    <BarChart3 style={{ width: 40, height: 40, color: textDim, margin: '0 auto 0.75rem' }} />
                    <h3 style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase', marginBottom: '0.4rem' }}>No Leaderboard Data</h3>
                    <p style={{ ...b, fontSize: '0.85rem', color: textMid }}>No participants have submitted picks for this week yet.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── SEASON TAB ── */}
          {activeTab === 'season' && (
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '1.25rem', borderBottom: `1px solid ${border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <Crown style={{ width: 16, height: 16, color: gold }} />
                  <span style={{ ...bc, fontWeight: 800, fontSize: '0.85rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase' }}>
                    Season {selectedPoolSeason} Champion
                  </span>
                </div>
                <p style={{ ...b, fontSize: '0.78rem', color: textDim }}>Overall season winner and performance statistics</p>
              </div>
              <div style={{ padding: '1.25rem' }}>
                {isLoadingWinners ? (
                  <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <RefreshCw style={{ width: 28, height: 28, color: textDim, margin: '0 auto 0.5rem', animation: 'spin 1s linear infinite' }} />
                    <p style={{ ...b, fontSize: '0.85rem', color: textMid }}>Loading season data...</p>
                  </div>
                ) : seasonWinner ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Champion card */}
                    <div style={{ background: `oklch(74% 0.16 72 / 0.12)`, border: `2px solid ${gold}`, borderRadius: 10, padding: '1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div style={{ background: gold, borderRadius: '50%', padding: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Crown style={{ width: 24, height: 24, color: bg }} />
                          </div>
                          <div>
                            <h3 style={{ ...bc, fontWeight: 900, fontSize: '1.4rem', color: gold, textTransform: 'uppercase', lineHeight: 1 }}>
                              {seasonWinner.winner_name}
                            </h3>
                            <p style={{ ...b, fontSize: '0.82rem', color: textMid, marginTop: '0.2rem' }}>Season {selectedPoolSeason} Champion</p>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ ...bc, fontWeight: 900, fontSize: '2rem', color: gold, lineHeight: 1 }}>{seasonWinner.total_points}</div>
                          <div style={{ ...b, fontSize: '0.75rem', color: textDim }}>Total Points</div>
                        </div>
                      </div>
                    </div>

                    {/* Stats grid */}
                    <div className="admin-3col-grid" style={{ marginBottom: 0 }}>
                      {[
                        { value: seasonWinner.total_correct_picks, label: 'Correct Picks', color: greenHi },
                        { value: seasonWinner.weeks_won, label: 'Weeks Won', color: gold },
                        { value: seasonWinner.total_participants, label: 'Total Participants', color: purple },
                      ].map(({ value, label, color }) => (
                        <div key={label} style={{ background: surface, border: `1px solid ${border}`, borderRadius: 8, padding: '1rem', textAlign: 'center' }}>
                          <div style={{ ...bc, fontWeight: 900, fontSize: '1.75rem', color, lineHeight: 1 }}>{value}</div>
                          <div style={{ ...b, fontSize: '0.75rem', color: textDim, marginTop: '0.25rem' }}>{label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Tie breaker info */}
                    {seasonWinner.tie_breaker_used && (
                      <div style={{ background: `${amber}1a`, border: `1px solid ${amber}40`, borderRadius: 8, padding: '1rem' }}>
                        <h4 style={{ ...bc, fontWeight: 800, fontSize: '0.8rem', letterSpacing: '0.07em', color: amber, textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <AlertTriangle style={{ width: 13, height: 13 }} />
                          Tie Breaker Used
                        </h4>
                        <div style={{ ...b, fontSize: '0.82rem', color: textMid, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <p><strong style={{ color: text }}>Question:</strong> {seasonWinner.tie_breaker_question}</p>
                          <p><strong style={{ color: text }}>Correct Answer:</strong> {seasonWinner.tie_breaker_answer}</p>
                          <p><strong style={{ color: text }}>Winner&apos;s Answer:</strong> {seasonWinner.winner_tie_breaker_answer}</p>
                          <p><strong style={{ color: text }}>Difference:</strong> {seasonWinner.tie_breaker_difference}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                    <Trophy style={{ width: 40, height: 40, color: textDim, margin: '0 auto 0.75rem' }} />
                    <h3 style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase', marginBottom: '0.4rem' }}>No Season Winner Yet</h3>
                    <p style={{ ...b, fontSize: '0.85rem', color: textMid }}>The season is still in progress. Check back after all weeks are completed.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── PERIODS TAB ── */}
          {activeTab === 'periods' && (
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '1.25rem', borderBottom: `1px solid ${border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <Target style={{ width: 16, height: 16, color: greenHi }} />
                  <span style={{ ...bc, fontWeight: 800, fontSize: '0.85rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase' }}>Quarter Winners</span>
                </div>
                <p style={{ ...b, fontSize: '0.78rem', color: textDim }}>Winners for different periods of the season (quarters, playoffs, etc.)</p>
              </div>
              <div style={{ padding: '1.25rem' }}>
                {isLoadingWinners ? (
                  <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <RefreshCw style={{ width: 28, height: 28, color: textDim, margin: '0 auto 0.5rem', animation: 'spin 1s linear infinite' }} />
                    <p style={{ ...b, fontSize: '0.85rem', color: textMid }}>Loading quarter data...</p>
                  </div>
                ) : periodWinners.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {periodWinners.map((period) => (
                      <div key={period.id} style={{ background: surface, border: `1px solid ${border}`, borderLeft: `4px solid ${green}`, borderRadius: 8, padding: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.75rem' }}>
                          <div>
                            <h4 style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', color: text, textTransform: 'uppercase' }}>
                              {getPeriodDisplayName(period.period_name).replace('Period', 'Quarter')}
                            </h4>
                            <p style={{ ...b, fontSize: '0.78rem', color: textDim }}>Weeks {period.start_week} - {period.end_week}</p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ ...bc, fontWeight: 900, fontSize: '1.1rem', color: greenHi }}>{period.winner_name}</div>
                            <div style={{ ...b, fontSize: '0.75rem', color: textDim }}>{period.period_points} points</div>
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                          {[
                            { value: period.period_correct_picks, label: 'Correct Picks' },
                            { value: period.weeks_won, label: 'Weeks Won' },
                            { value: period.total_participants, label: 'Participants' },
                          ].map(({ value, label }) => (
                            <div key={label} style={{ textAlign: 'center', background: card, borderRadius: 6, padding: '0.5rem' }}>
                              <div style={{ ...bc, fontWeight: 900, fontSize: '1.1rem', color: text }}>{value}</div>
                              <div style={{ ...b, fontSize: '0.7rem', color: textDim }}>{label}</div>
                            </div>
                          ))}
                        </div>
                        {period.tie_breaker_used && (
                          <div style={{ marginTop: '0.75rem', padding: '0.4rem 0.6rem', background: `${amber}1a`, borderRadius: 5 }}>
                            <span style={{ ...b, fontSize: '0.75rem', color: amber }}>
                              <strong>Tie Breaker Used:</strong> Difference of {period.tie_breaker_difference}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                    <Target style={{ width: 40, height: 40, color: textDim, margin: '0 auto 0.75rem' }} />
                    <h3 style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase', marginBottom: '0.4rem' }}>No Quarter Winners Yet</h3>
                    <p style={{ ...b, fontSize: '0.85rem', color: textMid }}>Quarter winners will be calculated as the season progresses.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── ANALYTICS TAB ── */}
          {activeTab === 'analytics' && (
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '1.25rem', borderBottom: `1px solid ${border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <BarChart3 style={{ width: 16, height: 16, color: greenHi }} />
                  <span style={{ ...bc, fontWeight: 800, fontSize: '0.85rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase' }}>Performance Analytics</span>
                </div>
                <p style={{ ...b, fontSize: '0.78rem', color: textDim }}>Detailed analytics and insights for the selected pool</p>
              </div>
              <div style={{ padding: '1.25rem' }}>
                {isLoadingWinners ? (
                  <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <RefreshCw style={{ width: 28, height: 28, color: textDim, margin: '0 auto 0.5rem', animation: 'spin 1s linear infinite' }} />
                    <p style={{ ...b, fontSize: '0.85rem', color: textMid }}>Loading analytics...</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {/* Weekly Winners Summary */}
                    <div>
                      <h4 style={{ ...bc, fontWeight: 800, fontSize: '0.85rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase', marginBottom: '0.75rem' }}>Weekly Winners Summary</h4>
                      {weeklyWinners.length > 0 ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
                          {weeklyWinners.map((winner) => (
                            <div key={winner.id} style={{ background: surface, border: `1px solid ${border}`, borderLeft: `4px solid ${green}`, borderRadius: 8, padding: '0.85rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                  <div style={{ ...bc, fontWeight: 800, fontSize: '0.85rem', color: text, textTransform: 'uppercase' }}>Week {winner.week}</div>
                                  <div style={{ ...b, fontSize: '0.78rem', color: textMid }}>{winner.winner_name}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ ...bc, fontWeight: 900, fontSize: '1.25rem', color: greenHi }}>{winner.winner_points}</div>
                                  <div style={{ ...b, fontSize: '0.7rem', color: textDim }}>points</div>
                                </div>
                              </div>
                              {winner.tie_breaker_used && (
                                <div style={{ marginTop: '0.4rem', padding: '0.2rem 0.4rem', background: `${amber}1a`, borderRadius: 4 }}>
                                  <span style={{ ...b, fontSize: '0.7rem', color: amber }}>Tie breaker used</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ ...b, fontSize: '0.85rem', color: textDim }}>No weekly winners data available yet.</p>
                      )}
                    </div>

                    {/* Performance Metrics */}
                    <div>
                      <h4 style={{ ...bc, fontWeight: 800, fontSize: '0.85rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase', marginBottom: '0.75rem' }}>Performance Metrics</h4>
                      <div className="admin-actions-grid">
                        {[
                          { value: weeklyWinners.length, label: 'Weeks Completed', color: greenHi },
                          { value: weeklyWinners.filter(w => w.tie_breaker_used).length, label: 'Tie Breakers Used', color: amber },
                          { value: leaderboardWithPicks.length, label: 'Active Participants', color: purple },
                          { value: games.length, label: 'Total Games', color: gold },
                        ].map(({ value, label, color }) => (
                          <div key={label} style={{ background: surface, border: `1px solid ${border}`, borderRadius: 8, padding: '1rem', textAlign: 'center' }}>
                            <div style={{ ...bc, fontWeight: 900, fontSize: '1.75rem', color, lineHeight: 1 }}>{value}</div>
                            <div style={{ ...b, fontSize: '0.75rem', color: textDim, marginTop: '0.25rem' }}>{label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Debug Info */}
          {process.env.NODE_ENV === 'development' && (
            <div style={{ background: 'oklch(20% 0.05 255)', border: `1px solid oklch(35% 0.08 255)`, borderRadius: 10, padding: '1rem', marginTop: '1.5rem' }}>
              <h3 style={{ ...bc, fontWeight: 800, fontSize: '0.8rem', letterSpacing: '0.07em', color: purple, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Debug Info</h3>
              <div style={{ ...b, fontSize: '0.78rem', color: textMid, display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                <p>Leaderboard entries: {leaderboardWithPicks.length}</p>
                <p>Games: {games.length}</p>
                <p>Weekly winners: {weeklyWinners.length}</p>
                <p>Quarter winners: {periodWinners.length}</p>
                <p>Season winner: {seasonWinner ? 'Yes' : 'No'}</p>
                <p>Selected pool: {selectedPool}</p>
                <p>Selected week: {selectedWeek}</p>
                <p>Season type: {selectedSeasonType}</p>
              </div>
            </div>
          )}

        </div>
      </section>

      {/* FOOTER */}
      <Footer pageName="Leaderboard" />
      </div>

      {isGated && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'oklch(13% 0.025 255 / 0.55)', padding: '1rem',
        }}>
          <div style={{
            background: card, border: `1px solid ${green}`, borderRadius: 12,
            padding: '2rem', maxWidth: 420, width: '100%', textAlign: 'center',
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%', background: `${green}25`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem',
            }}>
              <Lock style={{ width: 22, height: 22, color: greenHi }} />
            </div>
            <h2 style={{ ...bc, fontWeight: 800, fontSize: '1.15rem', color: text, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.6rem' }}>
              Standard Plan Required
            </h2>
            <p style={{ ...b, fontSize: '0.88rem', color: textMid, lineHeight: 1.6, marginBottom: '1.5rem' }}>
              {LEADERBOARD_TOOL_PLAN_MESSAGE} The data behind this preview is fake — your real pools stay private until you upgrade.
            </p>
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => router.push('/upgrade')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.6rem 1.2rem', background: green, color: text,
                  border: 'none', borderRadius: 6,
                  ...bc, fontWeight: 700, fontSize: '0.78rem',
                  letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer',
                }}
              >
                Upgrade to Standard
              </button>
              <button
                onClick={() => router.push(isSuperAdmin ? '/admin/dashboard' : '/dashboard')}
                style={{
                  padding: '0.6rem 1.2rem', background: 'transparent', color: textMid,
                  border: `1px solid ${border}`, borderRadius: 6,
                  ...bc, fontWeight: 700, fontSize: '0.78rem',
                  letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer',
                }}
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <AuthProvider>
      <SharedAdminGuard>
        <LeaderboardContent />
      </SharedAdminGuard>
    </AuthProvider>
  );
}
