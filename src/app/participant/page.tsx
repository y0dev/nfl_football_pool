'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { WeeklyPick } from '@/components/picks/weekly-pick';
import { PickUserSelection } from '@/components/picks/pick-user-selection';
import { RecentPicksViewer } from '@/components/picks/recent-picks-viewer';
import { Leaderboard } from '@/components/leaderboard/leaderboard';
import { ArrowLeft, Trophy, Users, Calendar, Clock, AlertTriangle, Info, Share2, BarChart3, Eye, EyeOff, Target, Zap, Lock, Unlock, LogOut } from 'lucide-react';
import Link from 'next/link';
import { loadCurrentWeek, getUpcomingWeek } from '@/actions/loadCurrentWeek';

import { Game, SelectedUser } from '@/types/game';
import { userSessionManager } from '@/lib/user-session';
import { DEFAULT_POOL_SEASON, debugLog, debugError} from '@/lib/utils';
import { OffseasonBanner } from '@/components/ui/offseason-banner';

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

function ParticipantContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const poolId = searchParams.get('pool');
  const weekParam = searchParams.get('week');
  const seasonTypeParam = searchParams.get('seasonType');

  // Redirect to new route structure
  useEffect(() => {
    if (poolId) {
      const newUrl = `/pool/${poolId}/picks?${weekParam ? `week=${weekParam}` : ''}${seasonTypeParam ? `${weekParam ? '&' : ''}seasonType=${seasonTypeParam}` : ''}`;
      router.replace(newUrl);
    } else {
      router.replace('/');
    }
  }, [poolId, weekParam, seasonTypeParam, router]);

  const [poolName, setPoolName] = useState<string>('');
  const [currentWeek, setCurrentWeek] = useState<number>(1);
  const [currentSeasonType, setCurrentSeasonType] = useState<number>(2);
  const [poolSeason, setPoolSeason] = useState<number>(DEFAULT_POOL_SEASON);
  const [isOffseasonState, setIsOffseasonState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [games, setGames] = useState<Game[]>([]);
  const [isTestMode, setIsTestMode] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showGameDetails, setShowGameDetails] = useState(false);
  const [countdown, setCountdown] = useState<string>('');
  const [showQuickStats, setShowQuickStats] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [submittedCount, setSubmittedCount] = useState(0);

  const [showRecentPicks, setShowRecentPicks] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState<Record<string, { submitted: boolean; name: string }>>({});
  const [isPoolAdmin, setIsPoolAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [gamesStarted, setGamesStarted] = useState(false);
  const [hasPicks, setHasPicks] = useState(false);

  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  const { toast } = useToast();

  // Helper function to get current user's submission status
  const getCurrentUserSubmissionStatus = () => {
    if (!selectedUser) return false;
    return hasSubmitted[selectedUser.id]?.submitted || false;
  };

  // Helper function to get the most recently submitted user
  const getMostRecentSubmittedUser = () => {
    const submittedUsers = Object.entries(hasSubmitted)
      .filter(([_, data]) => data.submitted)
      .map(([userId, data]) => ({ id: userId, name: data.name }));

    return submittedUsers.length > 0 ? submittedUsers[0] : null;
  };

  const handleLogout = async () => {
    try {
      const { getSupabaseClient } = await import('@/lib/supabase');
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
      router.push('/admin/login');
    } catch (error) {
      debugError('Error logging out:', error);
    }
  };

  // Countdown timer effect
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

  const loadData = async () => {
    try {
      setIsLoading(true);

      // Use the week and season type from URL parameters
      let weekToUse: number;
      let seasonTypeToUse: number;

      if (weekParam && !isNaN(parseInt(weekParam)) && parseInt(weekParam) >= 1) {
        weekToUse = parseInt(weekParam);
        seasonTypeToUse = seasonTypeParam ? parseInt(seasonTypeParam) : 2;
        setCurrentWeek(weekToUse);
        setCurrentSeasonType(seasonTypeToUse);

        debugLog('Participant page: Using URL parameters - week:', weekToUse, 'season type:', seasonTypeToUse);
      } else {
        const upcomingWeek = await getUpcomingWeek();
        if (upcomingWeek.seasonType === 0) {
          setIsOffseasonState(true);
          setIsLoading(false);
          return;
        }
        weekToUse = upcomingWeek.week;
        seasonTypeToUse = upcomingWeek.seasonType;
        setCurrentWeek(weekToUse);
        setCurrentSeasonType(seasonTypeToUse);

        debugLog('Participant page: Using upcoming week - week:', weekToUse, 'season type:', seasonTypeToUse);

        toast({
          title: "Week not specified",
          description: `Showing upcoming week (Week ${upcomingWeek.week})`,
          duration: 3000,
        });
      }

      // Load pool information using the public API endpoint
      if (poolId) {
        try {
          const response = await fetch(`/api/pools/${poolId}?week=${weekToUse}&seasonType=${seasonTypeToUse}`);

          if (response.ok) {
            const result = await response.json();
            if (result.success && result.pool) {
              const pool = result.pool;
              setPoolName(pool.name);
              setPoolSeason(pool.season || DEFAULT_POOL_SEASON);
              setParticipantCount(pool.participant_count || 0);
              setIsTestMode(pool.is_test_mode || false);

              if (pool.picks_status) {
                setHasPicks(pool.picks_status.hasPicks || false);
                setSubmittedCount(pool.picks_status.submittedCount || 0);
              }
            } else {
              setError('Pool not found. Please check the pool link.');
            }
          } else {
            setError('Failed to load pool information. Please try again.');
          }
        } catch (error) {
          debugError('Error loading pool:', error);
          setError('Failed to load pool information. Please try again.');
        }
      } else {
        setError('Pool ID is required. Please use a valid pool link.');
      }

      // Check admin status directly using the user session
      try {
        const { getSupabaseClient } = await import('@/lib/supabase');
        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          const { data: admin } = await supabase
            .from('admins')
            .select('id, is_super_admin')
            .eq('id', session.user.id)
            .single();

          if (admin) {
            setIsAdmin(true);
            setIsSuperAdmin(admin.is_super_admin);

            if (poolId) {
              const { data: poolData } = await supabase
                .from('pools')
                .select('created_by')
                .eq('id', poolId)
                .single();

              if (poolData && poolData.created_by === session.user.email) {
                setIsPoolAdmin(true);
              }
            }
          }
        }
      } catch (error) {
        debugError('Error checking admin status:', error);
      }

      // Load games for the week using the new API route
      try {
        debugLog('Participant page: Loading games for week:', weekToUse, 'season type:', seasonTypeToUse);

        const response = await fetch(`/api/games/week?week=${weekToUse}&seasonType=${seasonTypeToUse}`);

        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            const gamesData = result.games;
            setGames(gamesData);

            debugLog('Participant page: Loaded games:', gamesData.map((g: Game) => ({ id: g.id, home_team: g.home_team, away_team: g.away_team, week: g.week, season_type: g.season_type })));

            const now = new Date();
            const hasStarted = gamesData.some((game: Game) => {
              const gameTime = new Date(game.kickoff_time);
              return gameTime <= now;
            });
            setGamesStarted(hasStarted);

            if (hasStarted) {
              setShowLeaderboard(true);
            }
          } else {
            debugError('API returned error:', result.error);
            toast({
              title: "Warning",
              description: "Could not load games data",
              variant: "destructive",
            });
          }
        } else {
          throw new Error('Failed to load games');
        }
      } catch (error) {
        debugError('Error loading games:', error);
        toast({
          title: "Warning",
          description: "Could not load games data",
          variant: "destructive",
        });
      }

      // Check if there's a saved user session for this pool
      if (poolId) {
        try {
          const allSessions = userSessionManager.getAllSessions();
          const poolSession = allSessions.find(session => session.poolId === poolId);

          if (poolSession && poolSession.userId) {
            debugLog('Restoring user session:', poolSession);
            setSelectedUser({
              id: poolSession.userId,
              name: poolSession.userName
            });
          }
        } catch (error) {
          debugLog('No saved user session found for pool:', poolId);
        }
      }

      setLastUpdated(new Date());
    } catch (error) {
      debugError('Error loading participant data:', error);
      setError('Failed to load pool information. Please try again or contact the pool commissioner.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [poolId, weekParam]);

  useEffect(() => {
    loadParticipantStats();
    checkAdminPermissions();
    checkWeekPicksStatus();
  }, [poolId, currentWeek, currentSeasonType]);

  useEffect(() => {
    checkUserSubmissionStatus();
  }, [selectedUser, poolId, currentWeek, currentSeasonType]);

  const handleRefresh = async () => {
    setIsLoading(true);
    await loadData();
  };

  const handleUserSelected = (userId: string, userName: string) => {
    const user = { id: userId, name: userName };
    setSelectedUser(user);
    loadPicksFromLocalStorage(userId, poolId!, currentWeek, currentSeasonType);
  };

  const loadPicksFromLocalStorage = async (participantId: string, poolId: string, week: number, seasonType: number) => {
    try {
      const { pickStorage } = await import('@/lib/pick-storage');

      if (pickStorage.hasValidPicks(participantId, poolId, week)) {
        const storedPicks = pickStorage.loadPicks(participantId, poolId, week);

        if (storedPicks && storedPicks.length > 0) {
          toast({
            title: "Picks Restored",
            description: `Found ${storedPicks.length} saved picks from your previous session. You can review and submit them.`,
            duration: 5000,
          });

          debugLog('Loaded picks from localStorage:', storedPicks);
        }
      } else {
        debugLog('No valid picks found in localStorage for:', { participantId, poolId, week });
      }
    } catch (error) {
      debugError('Error loading picks from localStorage:', error);
      toast({
        title: "Warning",
        description: "Could not load saved picks from previous session",
        variant: "destructive",
      });
    }
  };

  const handlePicksSubmitted = async () => {
    setShowSuccessDialog(true);

    if (selectedUser) {
      setHasSubmitted(prev => ({ ...prev, [selectedUser.id]: { submitted: true, name: selectedUser.name } }));
    }

    await loadData();
    await loadParticipantStats();
    await checkUserSubmissionStatus();

    setSelectedUser(null);

    debugLog('Picks submitted successfully, clearing user selection to allow new user selection');
  };

  const handleUserChangeRequested = () => {
    debugLog('User change requested. Current user:', selectedUser);

    setSelectedUser(null);

    if (selectedUser) {
      const clearStoredPicks = async () => {
        try {
          const { pickStorage } = await import('@/lib/pick-storage');
          pickStorage.clearPicks();
          debugLog('Cleared stored picks for user:', selectedUser.id);
        } catch (error) {
          debugError('Error clearing stored picks:', error);
        }
      };
      clearStoredPicks();
    }

    setHasSubmitted({});

    debugLog('User selection interface should now be visible');

    toast({
      title: "User Changed",
      description: "Please select a new user to make picks",
    });
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${poolName} - Week ${currentWeek} Picks`,
          text: `Join me in making picks for ${poolName} Week ${currentWeek}!`,
          url: url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast({
          title: "Link Copied",
          description: "Pool link copied to clipboard",
        });
      }
    } catch (error) {
      debugError('Error sharing:', error);
    }
  };

  const getGameStatusStats = () => {
    if (games.length === 0) return null;

    const now = new Date();
    const stats = {
      total: games.length,
      upcoming: 0,
      inProgress: 0,
      finished: 0,
      locked: 0
    };

    games.forEach(game => {
      const gameTime = new Date(game.kickoff_time);
      const timeDiff = gameTime.getTime() - now.getTime();

      if (timeDiff > 0) {
        stats.upcoming++;
        if (timeDiff <= 24 * 60 * 60 * 1000) {
          stats.locked++;
        }
      } else if (game.status === 'finished' || game.winner) {
        stats.finished++;
      } else {
        stats.inProgress++;
      }
    });

    return stats;
  };

  const getDeadlineInfo = () => {
    if (games.length === 0) return null;

    const firstGame = games[0];
    const gameTime = new Date(firstGame.kickoff_time);
    const now = new Date();
    const timeDiff = gameTime.getTime() - now.getTime();

    if (timeDiff <= 0) {
      return { status: 'locked', message: 'Picks are locked - games have started' };
    }

    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours < 1) {
      return { status: 'urgent', message: `Picks close in ${minutes} minutes` };
    } else if (hours < 24) {
      return { status: 'warning', message: `Picks close in ${hours} hours` };
    } else {
      const days = Math.floor(hours / 24);
      return { status: 'info', message: `Picks close in ${days} days` };
    }
  };

  const loadParticipantStats = async () => {
    debugLog('Participant stats loaded from API endpoint');
  };

  const checkUserSubmissionStatus = async () => {
    if (!poolId || !selectedUser) return;

    try {
      debugLog('Checking submission status for:', {
        participantId: selectedUser.id,
        poolId,
        currentWeek,
        currentSeasonType
      });

      const { getSupabaseServiceClient } = await import('@/lib/supabase');
      const supabase = getSupabaseServiceClient();

      const { data: gamesForWeek, error: gamesError } = await supabase
        .from('games')
        .select('id')
        .eq('week', currentWeek)
        .eq('season_type', currentSeasonType);

      if (gamesError) {
        debugError('Error fetching games for week:', gamesError);
        return;
      }

      debugLog('Games for week:', { gamesForWeek, count: gamesForWeek?.length || 0 });

      if (!gamesForWeek || gamesForWeek.length === 0) {
        debugLog('No games found for week, cannot check picks');
        return;
      }

      const gameIds = gamesForWeek.map(g => g.id);

      const { data: picks, error: picksError } = await supabase
        .from('picks')
        .select('id, game_id')
        .eq('participant_id', selectedUser.id)
        .eq('pool_id', poolId)
        .in('game_id', gameIds);

      if (picksError) {
        debugError('Error checking picks:', picksError);
        return;
      }

      debugLog('Picks found for current user:', { picks, count: picks?.length || 0 });

      const hasSubmittedVal = picks && picks.length > 0 && picks.length === gameIds.length;
      setHasSubmitted(prev => ({ ...prev, [selectedUser.id]: { submitted: hasSubmittedVal, name: selectedUser.name } }));

      debugLog('Submission status updated for current user:', { hasSubmitted: hasSubmittedVal, picksCount: picks?.length || 0, gamesCount: gameIds.length });
    } catch (error) {
      debugError('Error checking submission status:', error);
    }
  };

  const checkWeekPicksStatus = async () => {
    debugLog('Week picks status loaded from API endpoint');
  };

  const checkAdminPermissions = async () => {
    debugLog('Admin permissions loaded from API endpoint');
  };

  const unlockParticipantPicks = async (participantId: string) => {
    if (!isPoolAdmin && !isSuperAdmin) {
      toast({
        title: "Permission Denied",
        description: "Only pool commissioners or admins can unlock picks",
        variant: "destructive",
      });
      return;
    }

    try {
      const { getSupabaseServiceClient } = await import('@/lib/supabase');
      const supabase = getSupabaseServiceClient();

      const { error } = await supabase
        .from('picks')
        .delete()
        .eq('participant_id', participantId)
        .eq('pool_id', poolId)
        .in('game_id', games.map(g => g.id));

      if (error) {
        throw error;
      }

      await supabase
        .from('audit_logs')
        .insert({
          action: 'unlock_participant_picks',
          admin_id: null,
          entity: 'participant_picks',
          entity_id: participantId,
          details: {
            participant_id: participantId,
            pool_id: poolId,
            week: currentWeek,
            season_type: currentSeasonType,
            unlocked_by: isSuperAdmin ? 'admin' : 'pool_commissioner'
          }
        });

      toast({
        title: "Picks Unlocked",
        description: "Participant can now make new picks",
      });

      setHasSubmitted(prev => ({ ...prev, [participantId]: { submitted: false, name: '' } }));
      await checkUserSubmissionStatus();
      await loadParticipantStats();
    } catch (error) {
      debugError('Error unlocking picks:', error);
      toast({
        title: "Error",
        description: "Failed to unlock picks",
        variant: "destructive",
      });
    }
  };

  // ── Loading state ──
  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '2rem', maxWidth: 400, width: '100%' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ height: 16, background: border, borderRadius: 4, width: '75%', opacity: 0.6 }} />
            <div style={{ height: 14, background: border, borderRadius: 4, width: '50%', opacity: 0.6 }} />
            <div style={{ height: 36, background: border, borderRadius: 6, opacity: 0.6 }} />
          </div>
          <p style={{ ...b, color: textMid, fontSize: '0.875rem', marginTop: '1rem', textAlign: 'center' }}>Redirecting to new page...</p>
        </div>
      </div>
    );
  }

  // ── Offseason state ──
  if (isOffseasonState) {
    return (
      <div style={{ minHeight: '100vh', background: bg }}>
        <div style={{ padding: 'clamp(2rem, 4vw, 3rem) 1rem', maxWidth: 1200, margin: '0 auto' }}>
          <OffseasonBanner />
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
        <div style={{ background: card, border: `1px solid ${border}`, borderTop: `3px solid ${liveRed}`, borderRadius: 10, padding: '2rem', maxWidth: 400, width: '100%', textAlign: 'center' }}>
          <p style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: liveRed, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Error</p>
          <p style={{ ...b, fontSize: '0.875rem', color: textMid, marginBottom: '1.25rem' }}>{error}</p>
          <Link href="/">
            <button style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.55rem 1rem',
              background: surface, color: textMid,
              border: `1px solid ${border}`, borderRadius: 6,
              ...bc, fontWeight: 700, fontSize: '0.78rem',
              letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer',
            }}>
              <ArrowLeft style={{ width: 13, height: 13 }} />
              Back to Home
            </button>
          </Link>
        </div>
      </div>
    );
  }

  // Check if this is a past week with no picks
  const isPastWeek = games.length > 0 && games.every(game => {
    const gameTime = new Date(game.kickoff_time);
    return gameTime < new Date();
  });

  // Show loading state while checking picks status for past weeks
  if (isPastWeek && isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '2rem', maxWidth: 400, width: '100%' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ height: 20, background: border, borderRadius: 4, width: '75%', opacity: 0.6 }} />
            <div style={{ height: 14, background: border, borderRadius: 4, width: '50%', opacity: 0.6 }} />
            <div style={{ height: 32, background: border, borderRadius: 6, opacity: 0.6 }} />
          </div>
        </div>
      </div>
    );
  }

  if (isPastWeek && !hasPicks && !isLoading) {
    const seasonType = seasonTypeParam ? parseInt(seasonTypeParam) : 2;
    const seasonTypeNames: Record<number, string> = { 1: 'Preseason', 2: 'Regular', 3: 'Postseason' };

    return (
      <div style={{ background: bg, minHeight: '100vh' }}>
        {/* Nav */}
        <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'oklch(13% 0.025 255 / 0.95)', backdropFilter: 'blur(14px)', borderBottom: `1px solid ${border}` }}>
          <div className="lp-inner" style={{ paddingTop: '0.75rem', paddingBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.6rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  <ArrowLeft style={{ width: 12, height: 12 }} /> Back
                </button>
                <div style={{ width: 1, height: 20, background: border }} />
                <span style={{ ...bc, fontWeight: 800, fontSize: '0.92rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase' }}>Sunday Huddle</span>
              </div>
              {isAdmin && (
                <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.7rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  <LogOut style={{ width: 11, height: 11 }} /> Log Out
                </button>
              )}
            </div>
          </div>
        </nav>

        {/* Hero */}
        <section style={{ background: bg, backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 59px, oklch(100% 0 0 / 0.022) 59px, oklch(100% 0 0 / 0.022) 60px)`, padding: 'clamp(2rem, 4vw, 3rem) 0' }}>
          <div className="lp-inner">
            <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.26em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.6rem' }}>Pool — Week {currentWeek}</p>
            <h1 style={{ ...bc, fontWeight: 900, fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', lineHeight: 0.95, color: text, textTransform: 'uppercase', marginBottom: '0.6rem' }}>
              {poolName || 'NFL Confidence'} <span style={{ color: gold }}>Pool</span>
            </h1>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
              <span style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.08em', padding: '0.15rem 0.5rem', borderRadius: 4, textTransform: 'uppercase', background: 'oklch(26% 0.03 255)', color: textMid, border: `1px solid ${border}` }}>Week {currentWeek}</span>
              <span style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.08em', padding: '0.15rem 0.5rem', borderRadius: 4, textTransform: 'uppercase', background: 'oklch(26% 0.03 255)', color: textMid, border: `1px solid ${border}` }}>{games.length} games</span>
              <span style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.08em', padding: '0.15rem 0.5rem', borderRadius: 4, textTransform: 'uppercase', background: 'oklch(26% 0.03 255)', color: textMid, border: `1px solid ${border}` }}>{seasonTypeNames[seasonType] || 'Unknown'}</span>
            </div>
          </div>
        </section>
        <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${green}, transparent)` }} />

        {/* No Picks Message */}
        <section style={{ background: bg, padding: '2.5rem 0' }}>
          <div className="lp-inner">
            <div style={{ maxWidth: 560, margin: '0 auto', background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '2rem', textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, background: surface, border: `1px solid ${border}`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <Calendar style={{ width: 24, height: 24, color: textDim }} />
              </div>
              <p style={{ ...bc, fontWeight: 800, fontSize: '1.1rem', color: text, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Week {currentWeek} Not Available</p>
              <p style={{ ...b, fontSize: '0.875rem', color: textMid, marginBottom: '1.25rem' }}>
                No picks were submitted for this week in {poolName}
              </p>
              <div style={{ ...b, fontSize: '0.8rem', color: textDim, textAlign: 'left', marginBottom: '1.25rem', lineHeight: 1.6 }}>
                <p style={{ marginBottom: '0.5rem' }}>This week has already passed, but no participants submitted picks.</p>
                <p style={{ marginBottom: '0.25rem' }}>This could happen if:</p>
                <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <li>The pool was created after this week</li>
                  <li>No participants joined the pool for this week</li>
                  <li>All picks were deleted by an admin</li>
                </ul>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center' }}>
                <Link href="/">
                  <button style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    <ArrowLeft style={{ width: 13, height: 13 }} />
                    Back to Home
                  </button>
                </Link>
                {isAdmin && (
                  <Link href="/admin/dashboard">
                    <button style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1rem', background: green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}>
                      <Trophy style={{ width: 13, height: 13 }} />
                      Go to Dashboard
                    </button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const seasonType = seasonTypeParam ? parseInt(seasonTypeParam) : 2;
  const seasonTypeNames: Record<number, string> = { 1: 'Preseason', 2: 'Regular', 3: 'Postseason' };
  const deadlineInfo = getDeadlineInfo();
  const gameStats = getGameStatusStats();

  const getDeadlineStyle = (status: string): React.CSSProperties => {
    switch (status) {
      case 'urgent': return { background: 'oklch(62% 0.22 25 / 0.1)', border: `1px solid oklch(62% 0.22 25 / 0.4)`, color: liveRed };
      case 'warning': return { background: 'oklch(72% 0.16 60 / 0.1)', border: `1px solid oklch(72% 0.16 60 / 0.35)`, color: amber };
      case 'locked': return { background: `${surface}`, border: `1px solid ${border}`, color: textDim };
      default: return { background: 'oklch(59% 0.15 155 / 0.08)', border: `1px solid oklch(46% 0.14 155 / 0.35)`, color: greenHi };
    }
  };

  return (
    <div style={{ background: bg, minHeight: '100vh' }}>

      {/* ── NAV ── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'oklch(13% 0.025 255 / 0.95)', backdropFilter: 'blur(14px)', borderBottom: `1px solid ${border}` }}>
        <div className="lp-inner" style={{ paddingTop: '0.75rem', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.6rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}>
                <ArrowLeft style={{ width: 12, height: 12 }} /> Back
              </button>
              <div style={{ width: 1, height: 20, background: border }} />
              <span style={{ ...bc, fontWeight: 800, fontSize: '0.92rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase' }}>Sunday Huddle</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                onClick={handleShare}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.6rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
              >
                <Share2 style={{ width: 11, height: 11 }} /> Share
              </button>
              {isAdmin && (
                <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.7rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  <LogOut style={{ width: 11, height: 11 }} /> Log Out
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ background: bg, backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 59px, oklch(100% 0 0 / 0.022) 59px, oklch(100% 0 0 / 0.022) 60px)`, padding: 'clamp(2rem, 4vw, 3rem) 0' }}>
        <div className="lp-inner">
          <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.26em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ display: 'inline-block', width: 18, height: 2, background: greenHi, borderRadius: 1 }} />
            Week {currentWeek} Picks
          </p>
          <h1 style={{ ...bc, fontWeight: 900, fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', lineHeight: 0.95, color: text, textTransform: 'uppercase', marginBottom: '0.6rem' }}>
            {poolName ? poolName.split(' ').slice(0, -1).join(' ') || poolName : 'NFL Confidence'}<br />
            {poolName && poolName.split(' ').length > 1 && <span style={{ color: gold }}>{poolName.split(' ').slice(-1)[0]}</span>}
          </h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem', alignItems: 'center' }}>
            <span style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.08em', padding: '0.15rem 0.5rem', borderRadius: 4, textTransform: 'uppercase', background: 'oklch(26% 0.03 255)', color: textMid, border: `1px solid ${border}` }}>Week {currentWeek}</span>
            <span style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.08em', padding: '0.15rem 0.5rem', borderRadius: 4, textTransform: 'uppercase', background: 'oklch(26% 0.03 255)', color: textMid, border: `1px solid ${border}` }}>{games.length} games</span>
            <span style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.08em', padding: '0.15rem 0.5rem', borderRadius: 4, textTransform: 'uppercase', background: 'oklch(26% 0.03 255)', color: textMid, border: `1px solid ${border}` }}>{seasonTypeNames[seasonType] || 'Unknown'}</span>
            {isTestMode && (
              <span style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.08em', padding: '0.15rem 0.5rem', borderRadius: 4, textTransform: 'uppercase', background: 'oklch(72% 0.16 60 / 0.15)', color: amber, border: `1px solid oklch(72% 0.16 60 / 0.35)` }}>Test Mode</span>
            )}
            {lastUpdated && (
              <span style={{ ...b, fontSize: '0.68rem', color: textDim }}>Updated {lastUpdated.toLocaleTimeString()}</span>
            )}
          </div>

          {/* Deadline warning inline with hero */}
          {deadlineInfo && (
            <div style={{ marginTop: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.75rem', borderRadius: 6, ...getDeadlineStyle(deadlineInfo.status) }}>
              {deadlineInfo.status === 'urgent' && <AlertTriangle style={{ width: 13, height: 13 }} />}
              {deadlineInfo.status === 'warning' && <Clock style={{ width: 13, height: 13 }} />}
              {deadlineInfo.status === 'locked' && <AlertTriangle style={{ width: 13, height: 13 }} />}
              {deadlineInfo.status === 'info' && <Info style={{ width: 13, height: 13 }} />}
              <span style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.05em' }}>{deadlineInfo.message}</span>
            </div>
          )}
        </div>
      </section>
      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${green}, transparent)` }} />

      {/* ── MAIN CONTENT ── */}
      <section style={{ background: bg, padding: '2rem 0' }}>
        <div className="lp-inner" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Quick Stats Toggle */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowQuickStats(!showQuickStats)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.75rem', background: showQuickStats ? green : 'transparent', color: showQuickStats ? text : textMid, border: `1px solid ${showQuickStats ? green : border}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
            >
              <Users style={{ width: 12, height: 12 }} /> Stats
            </button>
            <button
              onClick={() => { setShowGameDetails(!showGameDetails); if (!showGameDetails) setShowLeaderboard(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.75rem', background: showGameDetails ? green : 'transparent', color: showGameDetails ? text : textMid, border: `1px solid ${showGameDetails ? green : border}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
            >
              {showGameDetails ? <EyeOff style={{ width: 12, height: 12 }} /> : <Eye style={{ width: 12, height: 12 }} />} Game Details
            </button>
          </div>

          {/* Quick Stats */}
          {showQuickStats && (
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <Users style={{ width: 16, height: 16, color: greenHi }} />
                <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', color: text, textTransform: 'uppercase' }}>Pool Statistics</p>
              </div>
              <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginBottom: '1.1rem' }}>Current participation and submission status</p>
              <div className="admin-stats-grid" style={{ marginBottom: '1rem' }}>
                {[
                  { label: 'Total Participants', value: participantCount, color: greenHi },
                  { label: 'Submitted Picks', value: submittedCount, color: greenHi },
                  { label: 'Pending', value: participantCount - submittedCount, color: amber },
                  { label: 'Completion', value: `${participantCount > 0 ? Math.round((submittedCount / participantCount) * 100) : 0}%`, color: 'oklch(65% 0.12 290)' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ textAlign: 'center', background: surface, border: `1px solid ${border}`, borderRadius: 8, padding: '0.75rem' }}>
                    <p style={{ ...bc, fontWeight: 900, fontSize: '1.5rem', color, lineHeight: 1.1 }}>{value}</p>
                    <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.2rem' }}>{label}</p>
                  </div>
                ))}
              </div>
              {/* Progress bar */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span style={{ ...b, fontSize: '0.75rem', color: textDim }}>Submission Progress</span>
                  <span style={{ ...bc, fontWeight: 700, fontSize: '0.75rem', color: textMid }}>{submittedCount} of {participantCount}</span>
                </div>
                <div style={{ width: '100%', height: 6, background: border, borderRadius: 3 }}>
                  <div style={{ height: 6, borderRadius: 3, background: `linear-gradient(90deg, ${green}, ${greenHi})`, width: `${participantCount > 0 ? (submittedCount / participantCount) * 100 : 0}%`, transition: 'width 0.3s' }} />
                </div>
              </div>
            </div>
          )}

          {/* Game Stats */}
          {gameStats && (
            <div className="admin-stats-grid">
              {[
                { label: 'Total Games', value: gameStats.total, color: greenHi },
                { label: 'Upcoming', value: gameStats.upcoming, color: greenHi },
                { label: 'In Progress', value: gameStats.inProgress, color: amber },
                { label: 'Finished', value: gameStats.finished, color: textMid },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '1rem', textAlign: 'center' }}>
                  <p style={{ ...bc, fontWeight: 900, fontSize: '1.75rem', color, lineHeight: 1.1 }}>{value}</p>
                  <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.2rem' }}>{label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Game Details */}
          {showGameDetails && games.length > 0 && (
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <Target style={{ width: 16, height: 16, color: greenHi }} />
                <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', color: text, textTransform: 'uppercase' }}>Week {currentWeek} Game Details</p>
              </div>
              <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginBottom: '1rem' }}>Detailed view of all games and their status</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {games.map((game, index) => {
                  const gameTime = new Date(game.kickoff_time);
                  const now = new Date();
                  const timeDiff = gameTime.getTime() - now.getTime();
                  const isLocked = timeDiff <= 0;
                  const isUpcoming = timeDiff > 0 && timeDiff <= 24 * 60 * 60 * 1000;

                  const rowBg = isLocked ? surface : isUpcoming ? 'oklch(72% 0.16 60 / 0.06)' : 'oklch(46% 0.14 155 / 0.06)';
                  const rowBorder = isLocked ? border : isUpcoming ? 'oklch(72% 0.16 60 / 0.3)' : 'oklch(46% 0.14 155 / 0.3)';
                  const statusColor = isLocked ? textDim : isUpcoming ? amber : greenHi;
                  const statusLabel = isLocked ? 'Locked' : isUpcoming ? 'Upcoming' : 'Available';

                  return (
                    <div key={game.id} style={{ background: rowBg, border: `1px solid ${rowBorder}`, borderRadius: 7, padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            <span style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', color: textMid }}>Game {index + 1}</span>
                            <span style={{ ...bc, fontWeight: 700, fontSize: '0.6rem', letterSpacing: '0.06em', padding: '0.1rem 0.4rem', borderRadius: 3, textTransform: 'uppercase', background: 'transparent', border: `1px solid ${statusColor}`, color: statusColor }}>{statusLabel}</span>
                          </div>
                          <p style={{ ...b, fontWeight: 600, fontSize: '0.875rem', color: text }}>{game.away_team} @ {game.home_team}</p>
                          <p style={{ ...b, fontSize: '0.72rem', color: textDim }}>{gameTime.toLocaleDateString()} at {gameTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        {game.winner && (
                          <span style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.06em', padding: '0.15rem 0.5rem', borderRadius: 4, textTransform: 'uppercase', background: 'oklch(46% 0.14 155 / 0.2)', color: greenHi, border: `1px solid oklch(46% 0.14 155 / 0.4)` }}>
                            Winner: {game.winner}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Leaderboard or Picks */}
          {gamesStarted ? (
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <Trophy style={{ width: 18, height: 18, color: gold }} />
                <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', color: text, textTransform: 'uppercase' }}>Week {currentWeek} Leaderboard</p>
              </div>
              <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginBottom: '1.1rem' }}>
                Current standings for {poolName} — Games are in progress
              </p>
              <Leaderboard poolId={poolId!} weekNumber={currentWeek} seasonType={currentSeasonType} season={poolSeason} />
            </div>
          ) : (
            <>
              {/* Picks Section */}
              <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <Zap style={{ width: 16, height: 16, color: greenHi }} />
                  <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', color: text, textTransform: 'uppercase' }}>Week {currentWeek} Picks</p>
                </div>
                <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginBottom: '1.1rem' }}>
                  {selectedUser && hasSubmitted[selectedUser.id]?.submitted
                    ? "You have already submitted your picks for this week. Only admins can unlock your picks to make changes."
                    : "Select the winner for each game and assign confidence points"
                  }
                </p>

                {selectedUser ? (
                  hasSubmitted[selectedUser.id]?.submitted ? (
                    <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                      <Lock style={{ width: 40, height: 40, color: textDim, margin: '0 auto 0.75rem' }} />
                      <p style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: textMid, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Picks Submitted</p>
                      <p style={{ ...b, fontSize: '0.8rem', color: textDim, marginBottom: '1rem' }}>Your picks are locked for this week</p>
                      {(isPoolAdmin || isSuperAdmin) && (
                        <button
                          onClick={() => unlockParticipantPicks(selectedUser.id)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1rem', background: 'transparent', color: amber, border: `1px solid oklch(72% 0.16 60 / 0.4)`, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
                        >
                          <Unlock style={{ width: 13, height: 13 }} />
                          Unlock Picks
                        </button>
                      )}
                    </div>
                  ) : games.length > 0 ? (
                    <div>
                      {(process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_NODE_ENV === 'development') && (
                        <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'oklch(59% 0.15 155 / 0.08)', border: `1px solid oklch(46% 0.14 155 / 0.3)`, borderRadius: 6 }}>
                          <p style={{ ...b, fontSize: '0.78rem', color: greenHi }}>
                            <strong>User Selected:</strong> {selectedUser.name} (ID: {selectedUser.id})
                          </p>
                          <p style={{ ...b, fontSize: '0.75rem', color: textMid }}>
                            Pool: {poolId} | Week: {currentWeek} | Season Type: {currentSeasonType}
                          </p>
                          <p style={{ ...b, fontSize: '0.75rem', color: textMid }}>
                            <strong>Submission Status:</strong> {hasSubmitted[selectedUser.id]?.submitted ? 'Submitted' : 'Not Submitted'}
                          </p>
                          <p style={{ ...b, fontSize: '0.72rem', color: textDim }}>
                            <strong>All Users Status:</strong> {JSON.stringify(hasSubmitted)}
                          </p>
                        </div>
                      )}
                      <WeeklyPick
                        poolId={poolId!}
                        weekNumber={currentWeek}
                        seasonType={currentSeasonType}
                        selectedUser={selectedUser}
                        games={games}
                        preventGameLoading={true}
                        onPicksSubmitted={handlePicksSubmitted}
                        onUserChangeRequested={handleUserChangeRequested}
                      />
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                      <p style={{ ...b, fontSize: '0.875rem', color: textDim }}>No games found for Week {currentWeek}</p>
                    </div>
                  )
                ) : (
                  <div>
                    {Object.keys(hasSubmitted).length > 0 && (
                      <div style={{ marginBottom: '1rem', padding: '0.85rem 1rem', background: 'oklch(46% 0.14 155 / 0.08)', border: `1px solid oklch(46% 0.14 155 / 0.3)`, borderRadius: 8 }}>
                        <p style={{ ...b, fontSize: '0.8rem', color: greenHi, textAlign: 'center', marginBottom: '0.75rem' }}>
                          <strong>Picks submitted successfully!</strong> Best of luck this week!
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => {
                              const recentUser = getMostRecentSubmittedUser();
                              if (recentUser) {
                                setSelectedUser({ id: recentUser.id, name: recentUser.name });
                                setShowRecentPicks(true);
                              } else {
                                setShowRecentPicks(true);
                              }
                            }}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.75rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}
                          >
                            <Eye style={{ width: 11, height: 11 }} />
                            View Submitted Picks
                          </button>
                          <button
                            onClick={() => setShowLeaderboard(true)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.75rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}
                          >
                            <BarChart3 style={{ width: 11, height: 11 }} />
                            View Leaderboard
                          </button>
                        </div>
                      </div>
                    )}
                    <PickUserSelection
                      poolId={poolId!}
                      weekNumber={currentWeek}
                      seasonType={currentSeasonType}
                      onUserSelected={handleUserSelected}
                    />
                  </div>
                )}
              </div>

              {/* Your Picks Section */}
              {selectedUser && hasSubmitted[selectedUser.id]?.submitted && (
                <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <Eye style={{ width: 16, height: 16, color: greenHi }} />
                    <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', color: text, textTransform: 'uppercase' }}>Your Picks for Week {currentWeek}</p>
                  </div>
                  <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginBottom: '1.1rem' }}>
                    Review your submitted picks for this week (picks are locked until games start)
                  </p>
                  <RecentPicksViewer
                    poolId={poolId!}
                    participantId={selectedUser.id}
                    participantName={selectedUser.name}
                    weekNumber={currentWeek}
                    seasonType={currentSeasonType}
                    games={games}
                    canUnlock={isPoolAdmin || isSuperAdmin}
                    onUnlock={unlockParticipantPicks}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Recent Picks Dialog */}
      {showRecentPicks && (
        <Dialog open={showRecentPicks} onOpenChange={setShowRecentPicks}>
          <DialogContent style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, maxWidth: 800, maxHeight: '80vh', overflowY: 'auto' }}>
            <DialogHeader>
              <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase' }}>
                <Eye style={{ width: 16, height: 16, color: greenHi }} />
                {selectedUser && hasSubmitted[selectedUser.id]?.submitted
                  ? `${selectedUser.name}'s Submitted Picks for Week ${currentWeek}`
                  : `Submitted Picks for Week ${currentWeek}`
                }
              </DialogTitle>
              <DialogDescription style={{ ...b, fontSize: '0.8rem', color: textDim }}>
                {selectedUser && hasSubmitted[selectedUser.id]?.submitted
                  ? `Review ${selectedUser.name}'s picks for this week`
                  : "Review all submitted picks for this week"
                }
              </DialogDescription>
            </DialogHeader>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {selectedUser && hasSubmitted[selectedUser.id]?.submitted ? (
                <div style={{ padding: '1rem', background: surface, border: `1px solid ${border}`, borderRadius: 8 }}>
                  <p style={{ ...bc, fontWeight: 700, fontSize: '0.8rem', color: textMid, textTransform: 'uppercase', marginBottom: '0.75rem' }}>User: {selectedUser.name}</p>
                  <RecentPicksViewer
                    poolId={poolId!}
                    participantId={selectedUser.id}
                    participantName={selectedUser.name}
                    weekNumber={currentWeek}
                    seasonType={currentSeasonType}
                    games={games}
                    canUnlock={isPoolAdmin || isSuperAdmin}
                    onUnlock={unlockParticipantPicks}
                  />
                </div>
              ) : (
                Object.entries(hasSubmitted).map(([userId, data]) => {
                  if (!data.submitted) return null;

                  return (
                    <div key={userId} style={{ padding: '1rem', background: surface, border: `1px solid ${border}`, borderRadius: 8 }}>
                      <p style={{ ...bc, fontWeight: 700, fontSize: '0.8rem', color: textMid, textTransform: 'uppercase', marginBottom: '0.75rem' }}>User: {data.name}</p>
                      <RecentPicksViewer
                        poolId={poolId!}
                        participantId={userId}
                        participantName={data.name}
                        weekNumber={currentWeek}
                        seasonType={currentSeasonType}
                        games={games}
                        canUnlock={isPoolAdmin || isSuperAdmin}
                        onUnlock={unlockParticipantPicks}
                      />
                    </div>
                  );
                })
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '1rem' }}>
              <button
                onClick={() => setShowRecentPicks(false)}
                style={{ padding: '0.5rem 1rem', background: surface, color: textMid, border: `1px solid ${border}`, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent style={{ background: card, border: `1px solid ${border}`, borderTop: `3px solid ${green}`, borderRadius: 10, maxWidth: 420 }}>
          <DialogHeader>
            <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase' }}>
              <Trophy style={{ width: 18, height: 18, color: gold }} />
              Picks Submitted Successfully!
            </DialogTitle>
            <DialogDescription style={{ ...b, fontSize: '0.85rem', color: textMid }}>
              Your picks for Week {currentWeek} have been submitted. You can now select another user to make picks, or review the leaderboard.
            </DialogDescription>
          </DialogHeader>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setShowSuccessDialog(false)}
              style={{ padding: '0.5rem 1rem', background: green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ParticipantPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'oklch(13% 0.025 255)' }}>
        <div style={{ background: 'oklch(20% 0.03 255)', border: '1px solid oklch(26% 0.03 255)', borderRadius: 10, padding: '2rem', maxWidth: 400, width: '100%' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ height: 20, background: 'oklch(26% 0.03 255)', borderRadius: 4, width: '75%', opacity: 0.6 }} />
            <div style={{ height: 14, background: 'oklch(26% 0.03 255)', borderRadius: 4, width: '50%', opacity: 0.6 }} />
            <div style={{ height: 36, background: 'oklch(26% 0.03 255)', borderRadius: 6, opacity: 0.6 }} />
          </div>
        </div>
      </div>
    }>
      <ParticipantContent />
    </Suspense>
  );
}
