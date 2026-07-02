'use client';

import { useState, useEffect, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Target, Users, Calendar, Edit, Shield, RefreshCw, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { AuthProvider } from '@/lib/auth';
import { AdminGuard } from '@/components/auth/admin-guard';
import { PERIOD_WEEKS, SUPER_BOWL_SEASON_TYPE, debugLog, debugError} from '@/lib/utils';
import { getSupabaseClient, getSupabaseServiceClient } from '@/lib/supabase';
import { getMondayNightGameInfo } from '@/lib/monday-night-utils';
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
const amber   = 'oklch(72% 0.16 60)';

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

interface Pool {
  id: string;
  name: string;
  season: number;
  is_active: boolean;
}

interface Pick {
  id: string;
  participant_id: string;
  pool_id: string;
  game_id: string;
  predicted_winner: string;
  confidence_points: number;
  locked: boolean;
  submitted_by?: string;
  created_at: string;
  participants?: {
    name: string;
    email?: string;
  };
  games?: {
  home_team: string;
  away_team: string;
    week: number;
    season: number;
    season_type: number;
  };
}

interface WeekInfo {
  week: number;
  season: number;
  seasonType: number;
  isPeriodWeek: boolean;
  isSuperBowl: boolean;
}

function OverridePicksContent() {
  const router = useRouter();
  const { toast } = useToast();
  const { signOut } = useAuth();
  const [pools, setPools] = useState<Pool[]>([]);
  const [selectedPool, setSelectedPool] = useState<string>('');
  const [weeks, setWeeks] = useState<number[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [seasonTypes, setSeasonTypes] = useState<{ value: number; label: string }[]>([]);
  const [selectedSeasonType, setSelectedSeasonType] = useState<string>('2');
  const [currentSeason, setCurrentSeason] = useState<number>(2024);
  const [isLoading, setIsLoading] = useState(true);
  const [weekInfo, setWeekInfo] = useState<WeekInfo | null>(null);
  const [error] = useState<string | null>(null);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [isLoadingPicks, setIsLoadingPicks] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddPickDialog, setShowAddPickDialog] = useState(false);
  const [showMondayNightDialog, setShowMondayNightDialog] = useState(false);
  const [selectedParticipantForManagement, setSelectedParticipantForManagement] = useState<string>('');
  const [selectedParticipantForNewPick, setSelectedParticipantForNewPick] = useState<string>('');
  const [availableGames, setAvailableGames] = useState<Array<{
    id: string;
    home_team: string;
    away_team: string;
    week: number;
    season: number;
    season_type: number;
    kickoff_time: string;
    status: string;
  }>>([]);
  const [allParticipants, setAllParticipants] = useState<Array<{
    id: string;
    name: string;
    email: string | null;
  }>>([]);
  const [newPickData, setNewPickData] = useState<{
    gameId: string;
    predictedWinner: string;
    confidencePoints: number;
  }>({
    gameId: '',
    predictedWinner: '',
    confidencePoints: 1
  });
  const [mondayNightScore, setMondayNightScore] = useState<string>('');

  const loadPools = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      const serviceSupabase = getSupabaseServiceClient();

      if (!supabase && !serviceSupabase) {
        debugError('❌ No Supabase client available');
        toast({
          title: 'Error',
          description: 'Database connection not available',
          variant: 'destructive'
        });
        return;
      }

      const client = serviceSupabase || supabase;

      const { data: poolsData, error } = await client
        .from('pools')
        .select('id, name, season, is_active')
        .eq('is_active', true)
        .order('name');

      if (error) {
        debugError('❌ Error loading pools:', error);
        toast({
          title: 'Error',
          description: 'Failed to load pools',
          variant: 'destructive'
        });
        return;
      }

      setPools(poolsData || []);
      } catch (error) {
      debugError('❌ Error loading pools:', error);
        toast({
          title: 'Error',
        description: 'Failed to load pools',
        variant: 'destructive'
      });
    }
  }, [toast]);

  const loadPicks = useCallback(async (poolId: string, week: number, season: number, seasonType: number) => {
    setIsLoadingPicks(true);
    try {
      const supabase = getSupabaseClient();
      const serviceSupabase = getSupabaseServiceClient();
      const client = serviceSupabase || supabase;

      if (!client) {
        debugError('❌ No Supabase client available for loading picks');
        toast({
          title: 'Error',
          description: 'Database connection not available',
          variant: 'destructive'
        });
        return;
      }

      const { data: gamesData, error: gamesError } = await client
        .from('games')
        .select('id, week, season, season_type')
        .eq('week', week)
        .eq('season', season)
        .eq('season_type', seasonType);

      if (gamesError) {
        debugError('❌ Error loading games:', gamesError);
        toast({
          title: 'Error',
          description: 'Failed to load games for this week',
          variant: 'destructive'
        });
        return;
      }

      const gameIds = gamesData?.map(game => game.id) || [];

      debugLog(`🔍 Loading picks for Week ${week}, Season ${season}, Season Type ${seasonType}`);
      debugLog(`🎮 Found ${gameIds.length} games:`, gamesData?.map(g => ({ id: g.id, week: g.week, season: g.season, season_type: g.season_type })));

      if (gameIds.length === 0) {
        debugLog('❌ No games found for this week/season/season_type combination');
        setPicks([]);
        return;
      }

      const { data: picksData, error } = await client
        .from('picks')
        .select(`
          id,
          participant_id,
          pool_id,
          game_id,
          predicted_winner,
          confidence_points,
          locked,
          submitted_by,
          created_at,
          participants(name, email),
          games(home_team, away_team, week, season, season_type)
        `)
        .eq('pool_id', poolId)
        .in('game_id', gameIds)
        .order('created_at', { ascending: false });

      if (error) {
        debugError('❌ Error loading picks:', error);
        toast({
          title: 'Error',
          description: 'Failed to load picks',
          variant: 'destructive'
        });
        return;
      }

      const transformedPicks = (picksData || []).map(pick => ({
        ...pick,
        participants: Array.isArray(pick.participants) ? pick.participants[0] : pick.participants,
        games: Array.isArray(pick.games) ? pick.games[0] : pick.games
      }));

      debugLog(`📝 Found ${transformedPicks.length} picks:`, transformedPicks.map(p => ({
        id: p.id,
        participant: p.participants?.name,
        game: p.games ? `${p.games.away_team} @ ${p.games.home_team}` : 'Unknown',
        week: p.games?.week,
        season: p.games?.season,
        season_type: p.games?.season_type
      })));

      setPicks(transformedPicks);
    } catch (error) {
      debugError('❌ Error loading picks:', error);
      toast({
        title: 'Error',
        description: 'Failed to load picks',
        variant: 'destructive'
      });
    } finally {
      setIsLoadingPicks(false);
    }
  }, [toast]);


  const loadAvailableGames = useCallback(async (week: number, season: number, seasonType: number) => {
    try {
      const supabase = getSupabaseClient();
      const serviceSupabase = getSupabaseServiceClient();
      const client = serviceSupabase || supabase;

      if (!client) {
        debugError('❌ No Supabase client available for loading games');
        return;
      }

      const { data: gamesData, error } = await client
        .from('games')
        .select('id, home_team, away_team, week, season, season_type, kickoff_time, status')
        .eq('week', week)
        .eq('season', season)
        .eq('season_type', seasonType)
        .order('kickoff_time', { ascending: true });

      if (error) {
        debugError('❌ Error loading games:', error);
        toast({
          title: 'Error',
          description: 'Failed to load games',
          variant: 'destructive'
        });
        return;
      }

      setAvailableGames(gamesData || []);
    } catch (error) {
      debugError('❌ Error loading games:', error);
      toast({
        title: 'Error',
        description: 'Failed to load games',
        variant: 'destructive'
      });
    }
  }, [toast]);

  const loadAllParticipants = useCallback(async (poolId: string) => {
    try {
      const supabase = getSupabaseClient();
      const serviceSupabase = getSupabaseServiceClient();
      const client = serviceSupabase || supabase;

      if (!client) {
        debugError('❌ No Supabase client available for loading participants');
        return;
      }

      const { data: participantsData, error } = await client
        .from('participants')
        .select('id, name, email')
        .eq('pool_id', poolId)
        .eq('is_active', true)
        .order('name');

      if (error) {
        debugError('❌ Error loading participants:', error);
        toast({
          title: 'Error',
          description: 'Failed to load participants',
          variant: 'destructive'
        });
        return;
      }

      setAllParticipants(participantsData || []);
    } catch (error) {
      debugError('❌ Error loading participants:', error);
      toast({
        title: 'Error',
        description: 'Failed to load participants',
        variant: 'destructive'
      });
    }
  }, [toast]);

  const submitNewPick = useCallback(async () => {
    const participantId = selectedParticipantForNewPick || selectedParticipantForManagement;
    if (!participantId || !newPickData.gameId || !newPickData.predictedWinner) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      });
      return;
    }

    setIsSaving(true);
    try {
      const supabase = getSupabaseClient();
      const serviceSupabase = getSupabaseServiceClient();
      const client = serviceSupabase || supabase;

      if (!client) {
      toast({
          title: 'Error',
          description: 'Database connection not available',
          variant: 'destructive'
      });
      return;
    }

        const { error } = await client
          .from('picks')
          .insert({
            participant_id: participantId,
            pool_id: selectedPool,
            game_id: newPickData.gameId,
            predicted_winner: newPickData.predictedWinner,
            confidence_points: newPickData.confidencePoints,
            submitted_by: 'admin_override'
          });

      if (error) {
        debugError('❌ Error submitting new pick:', error);
      toast({
          title: 'Error',
          description: 'Failed to submit pick',
          variant: 'destructive'
      });
      return;
    }

      if (selectedPool && selectedWeek && currentSeason) {
        await loadPicks(selectedPool, parseInt(selectedWeek), currentSeason, parseInt(selectedSeasonType || '2'));
      }

      setShowAddPickDialog(false);
      setSelectedParticipantForNewPick('');
      setNewPickData({
        gameId: '',
        predictedWinner: '',
        confidencePoints: 1
      });

        toast({
        title: 'Success',
        description: 'Pick submitted successfully'
      });
    } catch (error) {
      debugError('❌ Error submitting new pick:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit pick',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  }, [selectedParticipantForNewPick, selectedParticipantForManagement, newPickData, selectedPool, selectedWeek, currentSeason, selectedSeasonType, loadPicks, toast]);

  const submitMondayNightScore = useCallback(async () => {
    if (!selectedParticipantForManagement || !mondayNightScore) {
      toast({
        title: 'Error',
        description: 'Please enter a Monday night score',
        variant: 'destructive'
        });
        return;
      }

    const score = parseInt(mondayNightScore);
    if (isNaN(score) || score < 0) {
        toast({
        title: 'Error',
        description: 'Monday night score must be a positive number',
        variant: 'destructive'
        });
        return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/override-monday-night-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poolId: selectedPool,
          participantId: selectedParticipantForManagement,
          week: parseInt(selectedWeek || '1'),
          season: currentSeason,
          seasonType: parseInt(selectedSeasonType || '2'),
          mondayNightScore: score
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({ title: 'Success', description: result.message });
        setShowMondayNightDialog(false);
        setMondayNightScore('');
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    } catch (error) {
      debugError('Error submitting Monday night score:', error);
      toast({ title: 'Error', description: 'An unexpected error occurred', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }, [selectedParticipantForManagement, mondayNightScore, selectedPool, selectedWeek, currentSeason, selectedSeasonType, toast]);

  const loadCurrentWeek = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        debugError('Supabase client not initialized');
        setIsLoading(false);
        return;
      }

      const { data: game, error } = await supabase
        .from('games')
        .select('week, season, season_type')
        .order('week', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        debugError('Error loading current week:', error);
        setCurrentSeason(2024);
        const regularWeeks = Array.from({ length: 18 }, (_, i) => i + 1);
        setWeeks(regularWeeks);
        setSeasonTypes([
          { value: 1, label: 'Preseason' },
          { value: 2, label: 'Regular Season' },
          { value: 3, label: 'Playoffs' }
        ]);
        return;
      }

      if (game) {
        setCurrentSeason(game.season || 2024);
        const regularWeeks = Array.from({ length: 18 }, (_, i) => i + 1);
        setWeeks(regularWeeks);
        setSeasonTypes([
          { value: 1, label: 'Preseason' },
          { value: 2, label: 'Regular Season' },
          { value: 3, label: 'Playoffs' }
        ]);
      }
    } catch (error) {
      debugError('Error loading current week:', error);
      setCurrentSeason(2024);
      const regularWeeks = Array.from({ length: 18 }, (_, i) => i + 1);
      setWeeks(regularWeeks);
      setSeasonTypes([
        { value: 1, label: 'Preseason' },
        { value: 2, label: 'Regular Season' },
        { value: 3, label: 'Playoffs' }
      ]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPools();
    loadCurrentWeek();
  }, [loadPools, loadCurrentWeek]);

  useEffect(() => {
    if (selectedPool && selectedWeek && selectedSeasonType) {
      const week = parseInt(selectedWeek);
      const seasonType = parseInt(selectedSeasonType);
      const isPeriodWeek = PERIOD_WEEKS.includes(week as typeof PERIOD_WEEKS[number]);
      const isSuperBowl = seasonType === SUPER_BOWL_SEASON_TYPE;

      setWeekInfo({
        week,
        season: currentSeason,
        seasonType,
        isPeriodWeek,
        isSuperBowl
      });

      loadPicks(selectedPool, week, currentSeason, seasonType);
      loadAvailableGames(week, currentSeason, seasonType);
      loadAllParticipants(selectedPool);
      } else {
      setWeekInfo(null);
      setPicks([]);
      setAvailableGames([]);
      setAllParticipants([]);
    }
  }, [selectedPool, selectedWeek, selectedSeasonType, currentSeason, loadPicks, loadAvailableGames, loadAllParticipants]);

  const selectedPoolData = pools.find(p => p.id === selectedPool);

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
        <div style={{ background: card, border: `1px solid ${border}`, borderTop: `3px solid ${green}`, borderRadius: 10, padding: '2rem', maxWidth: 400, width: '100%', textAlign: 'center' }}>
          <Shield style={{ width: 40, height: 40, color: textDim, margin: '0 auto 0.75rem' }} />
          <h2 style={{ ...bc, fontWeight: 800, fontSize: '1.1rem', color: text, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Error</h2>
          <p style={{ ...b, fontSize: '0.875rem', color: textMid, marginBottom: '1.25rem' }}>{error}</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
              width: '100%', padding: '0.6rem 1rem',
              background: green, color: text, border: 'none', borderRadius: 6,
              ...bc, fontWeight: 700, fontSize: '0.8rem',
              letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer',
            }}
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw style={{ width: 32, height: 32, color: textDim, margin: '0 auto 0.75rem', animation: 'spin 1s linear infinite' }} />
          <p style={{ ...b, color: textMid, fontSize: '0.9rem' }}>Loading override picks…</p>
        </div>
      </div>
    );
  }

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                onClick={() => router.back()}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  padding: '0.35rem 0.6rem',
                  background: 'transparent', color: textMid,
                  border: `1px solid ${border}`, borderRadius: 5,
                  ...bc, fontWeight: 600, fontSize: '0.72rem',
                  letterSpacing: '0.07em', textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
              >
                <ArrowLeft style={{ width: 12, height: 12 }} /> Back
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: green, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Shield style={{ width: 13, height: 13, color: text }} />
                </div>
                <span style={{ ...bc, fontWeight: 800, fontSize: '0.92rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase' }}>
                  Commissioner Override
                </span>
              </div>
            </div>
            <button
              onClick={() => signOut()}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.35rem',
                padding: '0.35rem 0.7rem',
                background: 'transparent', color: textMid,
                border: `1px solid ${border}`, borderRadius: 5,
                ...bc, fontWeight: 600, fontSize: '0.72rem',
                letterSpacing: '0.07em', textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              <LogOut style={{ width: 11, height: 11 }} /> Sign Out
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{
        background: bg,
        backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 59px, oklch(100% 0 0 / 0.022) 59px, oklch(100% 0 0 / 0.022) 60px)`,
        padding: 'clamp(2rem, 4vw, 3rem) 0',
      }}>
        <div className="lp-inner">
          <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.26em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ display: 'inline-block', width: 18, height: 2, background: greenHi, borderRadius: 1 }} />
            Commissioner Tools
          </p>
          <h1 style={{ ...bc, fontWeight: 900, fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', lineHeight: 0.95, color: text, textTransform: 'uppercase', marginBottom: '0.6rem' }}>
            Override <span style={{ color: gold }}>Picks</span>
          </h1>
          <p style={{ ...b, fontSize: '0.9rem', color: textMid, marginTop: '0.75rem' }}>
            Override participant picks and Monday night scores
          </p>
        </div>
      </section>

      {/* ── green rule ── */}
      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${green}, transparent)` }} />

      {/* ── CONTENT ── */}
      <section style={{ background: bg, padding: '2.5rem 0', minHeight: '50vh' }}>
        <div className="lp-inner" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Selection Controls */}
          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
              <Target style={{ width: 16, height: 16, color: greenHi }} />
              <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase' }}>
                Select Pool and Week
              </p>
            </div>
            <p style={{ ...b, fontSize: '0.8rem', color: textDim, marginBottom: '1.25rem' }}>
              Choose the pool and week you want to override picks for
            </p>

            <div className="admin-3col-grid" style={{ marginBottom: 0 }}>
              <div>
                <label style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', color: textMid, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>Pool</label>
                <Select value={selectedPool} onValueChange={setSelectedPool}>
                  <SelectTrigger style={{ background: surface, border: `1px solid ${border}`, color: text, ...b }}>
                    <SelectValue placeholder="Select a pool" />
                  </SelectTrigger>
                  <SelectContent>
                    {pools.map((pool) => (
                      <SelectItem key={pool.id} value={pool.id}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Users style={{ width: 13, height: 13 }} />
                          <span>{pool.name}</span>
                          <span style={{ ...bc, fontSize: '0.68rem', color: textDim, marginLeft: '0.25rem' }}>{pool.season}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', color: textMid, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>Week</label>
                <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                  <SelectTrigger style={{ background: surface, border: `1px solid ${border}`, color: text, ...b }}>
                    <SelectValue placeholder="Select a week" />
                  </SelectTrigger>
                  <SelectContent>
                    {weeks.map((week) => {
                      const isPeriodWeek = PERIOD_WEEKS.includes(week as typeof PERIOD_WEEKS[number]);
                      return (
                        <SelectItem key={week} value={week.toString()}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Calendar style={{ width: 13, height: 13 }} />
                            <span>Week {week}</span>
                            {isPeriodWeek && (
                              <span style={{ ...bc, fontWeight: 700, fontSize: '0.6rem', letterSpacing: '0.07em', padding: '0.1rem 0.35rem', borderRadius: 3, textTransform: 'uppercase', background: `oklch(72% 0.16 60 / 0.15)`, color: amber, border: `1px solid oklch(72% 0.16 60 / 0.35)` }}>
                                Tie-breaker
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', color: textMid, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>Season Type</label>
                <Select value={selectedSeasonType} onValueChange={setSelectedSeasonType}>
                  <SelectTrigger style={{ background: surface, border: `1px solid ${border}`, color: text, ...b }}>
                    <SelectValue placeholder="Select season type" />
                  </SelectTrigger>
                  <SelectContent>
                    {seasonTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value.toString()}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedPool && selectedWeek && selectedSeasonType && (
              <div style={{ marginTop: '1rem', padding: '0.85rem 1rem', background: surface, border: `1px solid ${border}`, borderLeft: `3px solid ${greenHi}`, borderRadius: 8 }}>
                <p style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Selected Configuration</p>
                <div className="admin-3col-grid" style={{ marginBottom: 0 }}>
                  <div>
                    <p style={{ ...bc, fontSize: '0.68rem', color: textDim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pool</p>
                    <p style={{ ...b, fontSize: '0.85rem', color: text, marginTop: '0.2rem' }}>{selectedPoolData?.name}</p>
                  </div>
                  <div>
                    <p style={{ ...bc, fontSize: '0.68rem', color: textDim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Week</p>
                    <p style={{ ...b, fontSize: '0.85rem', color: text, marginTop: '0.2rem' }}>Week {selectedWeek}</p>
                  </div>
                  <div>
                    <p style={{ ...bc, fontSize: '0.68rem', color: textDim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Season Type</p>
                    <p style={{ ...b, fontSize: '0.85rem', color: text, marginTop: '0.2rem' }}>
                      {seasonTypes.find(t => t.value.toString() === selectedSeasonType)?.label}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Participant Selection and Management */}
          {weekInfo && selectedPoolData && (
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                <Users style={{ width: 16, height: 16, color: greenHi }} />
                <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase' }}>
                  Manage Participant Picks — Week {weekInfo.week}
                </p>
              </div>
              <p style={{ ...b, fontSize: '0.8rem', color: textDim, marginBottom: '1.25rem' }}>
                Select a participant to add picks, override existing picks, or update Monday night scores.
              </p>

              {/* Participant Selection */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', color: textMid, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
                  Select Participant
                </label>
                <Select value={selectedParticipantForManagement} onValueChange={setSelectedParticipantForManagement}>
                  <SelectTrigger style={{ background: surface, border: `1px solid ${border}`, color: text, ...b }}>
                    <SelectValue placeholder="Choose a participant to manage" />
                  </SelectTrigger>
                  <SelectContent>
                    {allParticipants.map(participant => (
                      <SelectItem key={participant.id} value={participant.id}>
                        {participant.name} ({participant.email || 'No email'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Participant Actions */}
              {selectedParticipantForManagement && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {(() => {
                    const participantPicks = picks.filter(p => p.participant_id === selectedParticipantForManagement);
                    const participant = allParticipants.find(p => p.id === selectedParticipantForManagement);

                    return (
                      <>
                        <div style={{ padding: '0.85rem 1rem', background: surface, border: `1px solid ${border}`, borderRadius: 8 }}>
                          <p style={{ ...bc, fontWeight: 800, fontSize: '0.88rem', color: text, marginBottom: '0.3rem' }}>{participant?.name}</p>
                          <p style={{ ...b, fontSize: '0.8rem', color: textMid }}>
                            {participantPicks.length > 0
                              ? `${participantPicks.length} picks submitted for Week ${weekInfo.week}`
                              : `No picks submitted for Week ${weekInfo.week}`}
                          </p>
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => setShowAddPickDialog(true)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '0.4rem',
                              padding: '0.5rem 0.9rem',
                              background: green, color: text,
                              border: 'none', borderRadius: 6,
                              ...bc, fontWeight: 700, fontSize: '0.75rem',
                              letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer',
                            }}
                          >
                            <Edit style={{ width: 13, height: 13 }} />
                            {participantPicks.length > 0 ? 'Override Picks' : 'Add Picks'}
                          </button>

                          {(weekInfo.isPeriodWeek || weekInfo.isSuperBowl) && (
                            <button
                              onClick={() => setShowMondayNightDialog(true)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '0.4rem',
                                padding: '0.5rem 0.9rem',
                                background: 'transparent', color: textMid,
                                border: `1px solid ${border}`, borderRadius: 6,
                                ...bc, fontWeight: 700, fontSize: '0.75rem',
                                letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer',
                              }}
                            >
                              <Target style={{ width: 13, height: 13 }} />
                              Update Monday Night Score
                            </button>
                          )}
                        </div>

                        {/* Show existing picks */}
                        {participantPicks.length > 0 && (
                          <div>
                            <p style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', color: textDim, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                              Current Picks
                            </p>
                            <div className="admin-2col-grid" style={{ marginBottom: 0 }}>
                              {participantPicks.map(pick => (
                                <div key={pick.id} style={{ padding: '0.65rem 0.85rem', background: surface, border: `1px solid ${border}`, borderRadius: 6 }}>
                                  <p style={{ ...b, fontWeight: 600, fontSize: '0.8rem', color: text }}>{pick.games?.away_team} @ {pick.games?.home_team}</p>
                                  <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.2rem' }}>
                                    Pick: {pick.predicted_winner} ({pick.confidence_points} pts)
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Additional Actions */}
          {weekInfo && selectedPoolData && picks.length > 0 && (
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                <Target style={{ width: 16, height: 16, color: greenHi }} />
                <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase' }}>
                  Additional Actions
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => toast({ title: 'Info', description: 'Bulk edit functionality coming soon' })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.5rem 0.9rem',
                    background: 'transparent', color: textMid,
                    border: `1px solid ${border}`, borderRadius: 6,
                    ...bc, fontWeight: 700, fontSize: '0.75rem',
                    letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer',
                  }}
                >
                  <Edit style={{ width: 13, height: 13 }} />
                  Bulk Edit
                </button>
                <button
                  onClick={() => toast({ title: 'Info', description: 'Export functionality coming soon' })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.5rem 0.9rem',
                    background: 'transparent', color: textMid,
                    border: `1px solid ${border}`, borderRadius: 6,
                    ...bc, fontWeight: 700, fontSize: '0.75rem',
                    letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer',
                  }}
                >
                  <Users style={{ width: 13, height: 13 }} />
                  Export
                </button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!selectedPool && (
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1.5rem' }}>
              <p style={{ ...b, fontSize: '0.875rem', color: textDim }}>
                Please select a pool, week, and season type to begin overriding picks.
              </p>
            </div>
          )}

          {/* Loading picks indicator */}
          {isLoadingPicks && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem 0' }}>
              <RefreshCw style={{ width: 16, height: 16, color: textDim, animation: 'spin 1s linear infinite' }} />
              <p style={{ ...b, fontSize: '0.8rem', color: textDim }}>Loading picks…</p>
            </div>
          )}

        </div>
      </section>

      {/* Add Pick Dialog */}
      <Dialog open={showAddPickDialog} onOpenChange={setShowAddPickDialog}>
        <DialogContent style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, maxWidth: 480 }}>
          <DialogHeader>
            <DialogTitle style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Add Pick for Participant
            </DialogTitle>
            <DialogDescription style={{ ...b, fontSize: '0.8rem', color: textDim }}>
              Submit a pick on behalf of a participant who hasn&apos;t submitted yet.
            </DialogDescription>
          </DialogHeader>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '0.5rem' }}>
            {/* Participant Selection */}
            <div>
              <Label style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', color: textMid, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
                Participant
              </Label>
              <Select
                value={selectedParticipantForNewPick || selectedParticipantForManagement}
                onValueChange={setSelectedParticipantForNewPick}
              >
                <SelectTrigger style={{ background: surface, border: `1px solid ${border}`, color: text, ...b }}>
                  <SelectValue placeholder="Select a participant" />
                </SelectTrigger>
                <SelectContent>
                  {allParticipants.map(participant => (
                    <SelectItem key={participant.id} value={participant.id}>
                      {participant.name} ({participant.email || 'No email'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Game Selection */}
            <div>
              <Label style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', color: textMid, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
                Game
              </Label>
              <Select
                value={newPickData.gameId}
                onValueChange={(value) => {
                  const game = availableGames.find(g => g.id === value);
                  setNewPickData(prev => ({
                    ...prev,
                    gameId: value,
                    predictedWinner: game ? game.home_team : ''
                  }));
                }}
              >
                <SelectTrigger style={{ background: surface, border: `1px solid ${border}`, color: text, ...b }}>
                  <SelectValue placeholder="Select a game" />
                </SelectTrigger>
                <SelectContent>
                  {availableGames.map(game => (
                    <SelectItem key={game.id} value={game.id}>
                      {game.away_team} @ {game.home_team}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Predicted Winner */}
            {newPickData.gameId && (
              <div>
                <Label style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', color: textMid, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
                  Predicted Winner
                </Label>
                <Select
                  value={newPickData.predictedWinner}
                  onValueChange={(value) => setNewPickData(prev => ({ ...prev, predictedWinner: value }))}
                >
                  <SelectTrigger style={{ background: surface, border: `1px solid ${border}`, color: text, ...b }}>
                    <SelectValue placeholder="Select winner" />
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const game = availableGames.find(g => g.id === newPickData.gameId);
                      return game ? (
                        <>
                          <SelectItem value={game.home_team}>{game.home_team}</SelectItem>
                          <SelectItem value={game.away_team}>{game.away_team}</SelectItem>
                        </>
                      ) : null;
                    })()}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Confidence Points */}
            <div>
              <Label style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', color: textMid, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
                Confidence Points
              </Label>
              <input
                id="confidencePoints"
                type="number"
                min="1"
                max="16"
                value={newPickData.confidencePoints}
                onChange={(e) => setNewPickData(prev => ({ ...prev, confidencePoints: parseInt(e.target.value) || 1 }))}
                style={{ background: surface, border: `1px solid ${border}`, color: text, padding: '0.5rem 0.75rem', width: '100%', borderRadius: 6, boxSizing: 'border-box', ...b, fontSize: '0.875rem' }}
              />
            </div>
          </div>

          <DialogFooter style={{ paddingTop: '0.5rem', display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setShowAddPickDialog(false)}
              style={{
                padding: '0.5rem 0.9rem',
                background: 'transparent', color: textMid,
                border: `1px solid ${border}`, borderRadius: 6,
                ...bc, fontWeight: 700, fontSize: '0.75rem',
                letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={submitNewPick}
              disabled={isSaving}
              style={{
                padding: '0.5rem 0.9rem',
                background: isSaving ? textDim : green, color: text,
                border: 'none', borderRadius: 6,
                ...bc, fontWeight: 700, fontSize: '0.75rem',
                letterSpacing: '0.07em', textTransform: 'uppercase', cursor: isSaving ? 'not-allowed' : 'pointer',
              }}
            >
              {isSaving ? 'Submitting…' : 'Submit Pick'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Monday Night Score Dialog */}
      <Dialog open={showMondayNightDialog} onOpenChange={setShowMondayNightDialog}>
        <DialogContent style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, maxWidth: 480 }}>
          <DialogHeader>
            <DialogTitle style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Update Monday Night Score
            </DialogTitle>
            <DialogDescription style={{ ...b, fontSize: '0.8rem', color: textDim }}>
              Set the Monday night game score prediction for {allParticipants.find(p => p.id === selectedParticipantForManagement)?.name}.
            </DialogDescription>
          </DialogHeader>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '0.5rem' }}>
            {/* Monday Night Game Info */}
            {(() => {
              const mondayNightGameInfo = getMondayNightGameInfo(availableGames);
              return mondayNightGameInfo ? (
                <div style={{ padding: '0.85rem 1rem', background: surface, border: `1px solid ${border}`, borderLeft: `3px solid ${greenHi}`, borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                    <Calendar style={{ width: 13, height: 13, color: greenHi }} />
                    <span style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', color: greenHi, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Monday Night Game</span>
                  </div>
                  <p style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text }}>{mondayNightGameInfo.displayText}</p>
                  <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.25rem' }}>
                    Kickoff: {new Date(mondayNightGameInfo.game.kickoff_time).toLocaleString()}
                  </p>
                </div>
              ) : null;
            })()}

            <div>
              <Label style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', color: textMid, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
                Monday Night Score
              </Label>
              <input
                id="mondayNightScore"
                type="number"
                min="0"
                step="1"
                placeholder="e.g., 45"
                value={mondayNightScore}
                onChange={(e) => setMondayNightScore(e.target.value)}
                style={{ background: surface, border: `1px solid ${border}`, color: text, padding: '0.5rem 0.75rem', width: '100%', borderRadius: 6, boxSizing: 'border-box', ...b, fontSize: '0.875rem' }}
              />
              <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.35rem' }}>
                Enter the predicted total points scored in the Monday night game.
              </p>
            </div>
          </div>

          <DialogFooter style={{ paddingTop: '0.5rem', display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setShowMondayNightDialog(false)}
              style={{
                padding: '0.5rem 0.9rem',
                background: 'transparent', color: textMid,
                border: `1px solid ${border}`, borderRadius: 6,
                ...bc, fontWeight: 700, fontSize: '0.75rem',
                letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={submitMondayNightScore}
              disabled={isSaving}
              style={{
                padding: '0.5rem 0.9rem',
                background: isSaving ? textDim : green, color: text,
                border: 'none', borderRadius: 6,
                ...bc, fontWeight: 700, fontSize: '0.75rem',
                letterSpacing: '0.07em', textTransform: 'uppercase', cursor: isSaving ? 'not-allowed' : 'pointer',
              }}
            >
              {isSaving ? 'Saving…' : 'Save Score'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function OverridePicksPage() {
  return (
    <AuthProvider>
      <AdminGuard>
        <OverridePicksContent />
      </AdminGuard>
    </AuthProvider>
  );
}
