'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { WeeklyPick } from '@/components/picks/weekly-pick';
import { PickUserSelection } from '@/components/picks/pick-user-selection';
import { RecentPicksViewer } from '@/components/picks/recent-picks-viewer';
import { Leaderboard } from '@/components/leaderboard/leaderboard';
import { ArrowLeft, Trophy, Users, Calendar, Clock, AlertTriangle, Info, Share2, BarChart3, Eye, EyeOff, Target, Zap, Lock, Unlock, LogOut } from 'lucide-react';
import Link from 'next/link';
import { loadPools, loadPool } from '@/actions/loadPools';
import { loadCurrentWeek, getUpcomingWeek } from '@/actions/loadCurrentWeek';
import { loadWeekGames } from '@/actions/loadWeekGames';
import { Game, SelectedUser } from '@/types/game';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';

function ParticipantContent() {
  const searchParams = useSearchParams();
  const poolId = searchParams.get('pool');
  const weekParam = searchParams.get('week');
  const seasonTypeParam = searchParams.get('seasonType');
  
  const [poolName, setPoolName] = useState<string>('');
  const [currentWeek, setCurrentWeek] = useState<number>(1);
  const [currentSeasonType, setCurrentSeasonType] = useState<number>(2);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [games, setGames] = useState<Game[]>([]);
  const [isTestMode, setIsTestMode] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [poolRequiresAccessCode, setPoolRequiresAccessCode] = useState<boolean>(true);
  const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showGameDetails, setShowGameDetails] = useState(false);
  const [countdown, setCountdown] = useState<string>('');
  const [showQuickStats, setShowQuickStats] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [submittedCount, setSubmittedCount] = useState(0);

  const [showRecentPicks, setShowRecentPicks] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isPoolAdmin, setIsPoolAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [gamesStarted, setGamesStarted] = useState(false);
  const [hasPicks, setHasPicks] = useState(false);
  const [isLoadingPicks, setIsLoadingPicks] = useState(false);
  
  const { toast } = useToast();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      const { getSupabaseClient } = await import('@/lib/supabase');
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
      router.push('/admin/login');
    } catch (error) {
      console.error('Error logging out:', error);
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
        seasonTypeToUse = seasonTypeParam ? parseInt(seasonTypeParam) : 2; // Default to regular season
        setCurrentWeek(weekToUse);
        setCurrentSeasonType(seasonTypeToUse);
      } else {
        // Fallback to upcoming week only if no valid week in URL
        const upcomingWeek = await getUpcomingWeek();
        weekToUse = upcomingWeek.week;
        seasonTypeToUse = upcomingWeek.seasonType;
        setCurrentWeek(weekToUse);
        setCurrentSeasonType(seasonTypeToUse);
        
        // Show a helpful message for empty week parameter
        toast({
          title: "Week not specified",
          description: `Showing upcoming week (Week ${upcomingWeek.week})`,
          duration: 3000,
        });
      }

      // Load pool information
      if (poolId) {
        const pool = await loadPool(poolId);
        if (pool) {
          setPoolName(pool.name);
          setPoolRequiresAccessCode(pool.require_access_code);
        } else {
          setError('Pool not found. Please check the pool link.');
        }
      } else {
        setError('Pool ID is required. Please use a valid pool link.');
      }

      // Load games for the week using the determined week and season type
      try {
        const gamesData = await loadWeekGames(weekToUse, seasonTypeToUse);
        setGames(gamesData);
        
        // Check if any games have started
        const now = new Date();
        const hasStarted = gamesData.some(game => {
          const gameTime = new Date(game.kickoff_time);
          return gameTime <= now;
        });
        setGamesStarted(hasStarted);
        
        // Automatically show leaderboard when games start
        if (hasStarted) {
          setShowLeaderboard(true);
        }
      } catch (error) {
        console.error('Error loading games:', error);
        toast({
          title: "Warning",
          description: "Could not load games data",
          variant: "destructive",
        });
      }

      // Check if this is test mode (no participants in pool)
      if (poolId) {
        try {
          const { getSupabaseClient } = await import('@/lib/supabase');
          const supabase = getSupabaseClient();
          const { data: participants } = await supabase
            .from('participants')
            .select('id')
            .eq('pool_id', poolId)
            .eq('is_active', true);
          
          if (!participants || participants.length === 0) {
            setIsTestMode(true);
          }
        } catch (error) {
          console.error('Error checking participants:', error);
        }
      }

      // Check if user is admin (for back button visibility)
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
          setIsAdmin(!!admin);
          setIsSuperAdmin(admin?.is_super_admin || false);
          
          // Check if user is the pool admin (created the pool)
          if (poolId) {
            const { data: pool } = await supabase
              .from('pools')
              .select('created_by')
              .eq('id', poolId)
              .single();
            
            if (pool && pool.created_by === session.user.email) {
              setIsPoolAdmin(true);
            }
          }
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
      }

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error loading participant data:', error);
      setError('Failed to load pool information. Please try again or contact the pool administrator.');
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

  const handlePicksSubmitted = async () => {
    // Refresh the page data when picks are submitted
    await loadData();
    await loadParticipantStats();
    await checkUserSubmissionStatus();
  };

  const handleUserSelected = (userId: string, userName: string) => {
    setSelectedUser({ id: userId, name: userName });
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
      console.error('Error sharing:', error);
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
        if (timeDiff <= 24 * 60 * 60 * 1000) { // Within 24 hours
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
    if (!poolId) return;
    
    try {
      const { getSupabaseClient } = await import('@/lib/supabase');
      const supabase = getSupabaseClient();
      
      // Get total participants
      const { data: participants } = await supabase
        .from('participants')
        .select('id')
        .eq('pool_id', poolId)
        .eq('is_active', true);
      
      setParticipantCount(participants?.length || 0);
      
      // Get submitted participants
      const { data: picks } = await supabase
        .from('picks')
        .select('participant_id, games!inner(week, season_type)')
        .eq('pool_id', poolId)
        .eq('games.week', currentWeek)
        .eq('games.season_type', currentSeasonType);
      
      const submittedIds = new Set(picks?.map(p => p.participant_id) || []);
      setSubmittedCount(submittedIds.size);
    } catch (error) {
      console.error('Error loading participant stats:', error);
    }
  };

  const checkUserSubmissionStatus = async () => {
    if (!poolId || !selectedUser) return;
    
    try {
      const { getSupabaseClient } = await import('@/lib/supabase');
      const supabase = getSupabaseClient();
      
      // Check if user has submitted picks for this week
      const { data: picks } = await supabase
        .from('picks')
        .select('id, games!inner(week, season_type)')
        .eq('participant_id', selectedUser.id)
        .eq('pool_id', poolId)
        .eq('games.week', currentWeek)
        .eq('games.season_type', currentSeasonType);
      
      setHasSubmitted(Boolean(picks && picks.length > 0));
    } catch (error) {
      console.error('Error checking submission status:', error);
    }
  };

  const checkWeekPicksStatus = async () => {
    if (!poolId) return;
    
    try {
      setIsLoadingPicks(true);
      const { getSupabaseClient } = await import('@/lib/supabase');
      const supabase = getSupabaseClient();
      
      // Check if any participants have submitted picks for this week
      const { data: picks } = await supabase
        .from('picks')
        .select('id, games!inner(week, season_type)')
        .eq('pool_id', poolId)
        .eq('games.week', currentWeek)
        .eq('games.season_type', currentSeasonType);
      
      setHasPicks(Boolean(picks && picks.length > 0));
    } catch (error) {
      console.error('Error checking week picks status:', error);
      setHasPicks(false);
    } finally {
      setIsLoadingPicks(false);
    }
  };

  const checkAdminPermissions = async () => {
    try {
      const { getSupabaseClient } = await import('@/lib/supabase');
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // Check if user is an admin
        const { data: admin } = await supabase
          .from('admins')
          .select('id, is_super_admin')
          .eq('id', session.user.id)
          .single();
        
        if (admin) {
          setIsAdmin(true);
          setIsSuperAdmin(admin.is_super_admin);
          
          // Check if user is the pool admin (created the pool)
          if (poolId) {
            const { data: pool } = await supabase
              .from('pools')
              .select('created_by')
              .eq('id', poolId)
              .single();
            
            if (pool && pool.created_by === session.user.email) {
              setIsPoolAdmin(true);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error checking admin permissions:', error);
    }
  };

  const unlockParticipantPicks = async (participantId: string) => {
    if (!isPoolAdmin && !isSuperAdmin) {
      toast({
        title: "Permission Denied",
        description: "Only pool admins or super admins can unlock picks",
        variant: "destructive",
      });
      return;
    }

    try {
      const { getSupabaseClient } = await import('@/lib/supabase');
      const supabase = getSupabaseClient();
      
      // Delete the picks for this participant for this week
      const { error } = await supabase
        .from('picks')
        .delete()
        .eq('participant_id', participantId)
        .eq('pool_id', poolId)
        .in('game_id', games.map(g => g.id));
      
      if (error) {
        throw error;
      }

      // Log the unlock action
      await supabase
        .from('audit_logs')
        .insert({
          action: 'unlock_participant_picks',
          user_id: participantId,
          pool_id: poolId,
          details: JSON.stringify({ 
            participant_id: participantId, 
            week: currentWeek, 
            season_type: currentSeasonType,
            unlocked_by: isSuperAdmin ? 'super_admin' : 'pool_admin'
          }),
          created_at: new Date().toISOString()
        });

      toast({
        title: "Picks Unlocked",
        description: "Participant can now make new picks",
      });

      // Refresh the submission status
      await checkUserSubmissionStatus();
      await loadParticipantStats();
    } catch (error) {
      console.error('Error unlocking picks:', error);
      toast({
        title: "Error",
        description: "Failed to unlock picks",
        variant: "destructive",
      });
    }
  };





  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-8 bg-gray-200 rounded"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-red-600">Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href="/">
              <Button>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if this is a past week with no picks
  const isPastWeek = games.length > 0 && games.every(game => {
    const gameTime = new Date(game.kickoff_time);
    return gameTime < new Date();
  });

  // Show loading state while checking picks status for past weeks
  if (isPastWeek && isLoadingPicks) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-8 bg-gray-200 rounded"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isPastWeek && !hasPicks && !isLoadingPicks) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="container mx-auto p-4 md:p-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
              <div className="flex items-center gap-4">
                {isAdmin && (
                  <Link href="/admin/dashboard">
                    <Button variant="outline" size="sm" className="flex items-center gap-2">
                      <ArrowLeft className="h-4 w-4" />
                      <span className="hidden sm:inline">Back to Dashboard</span>
                      <span className="sm:hidden">Back</span>
                    </Button>
                  </Link>
                )}
                <div className="flex items-center gap-2">
                  <Trophy className="h-6 w-6 text-blue-600" />
                  <h1 className="text-xl sm:text-2xl font-bold">NFL Confidence Pool</h1>
                </div>
              </div>
            </div>
            
            {/* Pool Info */}
            <div className="bg-white rounded-lg p-4 md:p-6 shadow-sm border">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-500" />
                    <span className="font-semibold text-lg">{poolName}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <Badge variant="outline">Week {currentWeek}</Badge>
                    <span className="text-sm text-gray-500">
                      {games.length} games
                    </span>
                    {(() => {
                        const seasonType = seasonTypeParam ? parseInt(seasonTypeParam) : 2;
                        const seasonTypeNames = { 1: 'Preseason', 2: 'Regular', 3: 'Postseason' };
                        return (
                        <Badge variant="secondary" className="text-xs">
                          {seasonTypeNames[seasonType as keyof typeof seasonTypeNames] || 'Unknown'}
                        </Badge>
                      );
                      })()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* No Picks Available Message */}
          <Card className="max-w-2xl mx-auto">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                <Calendar className="h-8 w-8 text-gray-400" />
              </div>
              <CardTitle className="text-gray-900">Week {currentWeek} Not Available</CardTitle>
              <CardDescription className="text-gray-600">
                No picks were submitted for this week in {poolName}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <div className="text-sm text-gray-500 space-y-2">
                <p>This week has already passed, but no participants submitted picks.</p>
                <p>This could happen if:</p>
                <ul className="list-disc list-inside text-left max-w-md mx-auto space-y-1">
                  <li>The pool was created after this week</li>
                  <li>No participants joined the pool for this week</li>
                  <li>All picks were deleted by an admin</li>
                </ul>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                <Link href="/">
                  <Button variant="outline" className="flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Home
                  </Button>
                </Link>
                {isAdmin && (
                  <Link href="/admin/dashboard">
                    <Button className="flex items-center gap-2">
                      <Trophy className="h-4 w-4" />
                      Go to Dashboard
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Floating Back Button for Mobile - Only show if admin */}
      {isAdmin && (
      <div className="fixed top-4 left-4 z-50 sm:hidden">
          <Link href="/admin/dashboard">
          <Button variant="outline" size="sm" className="shadow-lg">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      </div>
      )}
      
      <div className="container mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
            <div className="flex items-center gap-4">
              {isAdmin && (
                <Link href="/admin/dashboard">
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Back to Dashboard</span>
                  <span className="sm:hidden">Back</span>
                </Button>
              </Link>
              )}
              <div className="flex items-center gap-2">
                <Trophy className="h-6 w-6 text-blue-600" />
                <h1 className="text-xl sm:text-2xl font-bold">NFL Confidence Pool</h1>
              </div>
            </div>
          </div>
          
          {/* Pool Info */}
          <div className="bg-white rounded-lg p-4 md:p-6 shadow-sm border">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-gray-500" />
                  <span className="font-semibold text-lg">{poolName}</span>
                  {isTestMode && (
                    <Badge variant="secondary" className="text-xs">Test Mode</Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <Badge variant="outline">Week {currentWeek}</Badge>
                  <span className="text-sm text-gray-500">
                    {games.length} games
                  </span>
                  {(() => {
                      const seasonType = seasonTypeParam ? parseInt(seasonTypeParam) : 2; // Default to regular season for display
                      const seasonTypeNames = { 1: 'Preseason', 2: 'Regular', 3: 'Postseason' };
                      return (
                      <Badge variant="secondary" className="text-xs">
                        {seasonTypeNames[seasonType as keyof typeof seasonTypeNames] || 'Unknown'}
                      </Badge>
                    );
                  })()}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Info className="h-4 w-4 text-gray-500" />
                  <Badge variant={poolRequiresAccessCode ? "default" : "secondary"} className="text-xs">
                    {poolRequiresAccessCode ? "Access Code Required" : "No Access Code Required"}
                  </Badge>
                </div>
                {lastUpdated && (
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    Last updated: {lastUpdated.toLocaleTimeString()}
                  </div>
                )}
              </div>
              
              <div className="flex flex-col lg:flex-row items-center gap-4">
                <div className="text-sm text-gray-600 text-center lg:text-right">
                  <p>Welcome to the pool!</p>
                  <p>Make your picks below to participate.</p>
                </div>
                <div className="flex flex-wrap justify-center gap-2 max-w-full px-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleShare}
                    className="flex items-center gap-2 min-w-fit px-3 py-2"
                  >
                    <Share2 className="h-4 w-4" />
                    <span className="hidden md:inline">Share</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowGameDetails(!showGameDetails);
                      if (!showGameDetails) {
                        setShowLeaderboard(false);
                      }
                    }}
                    className="flex items-center gap-2 min-w-fit px-3 py-2"
                  >
                    {showGameDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    <span className="hidden md:inline">Game Details</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowQuickStats(!showQuickStats)}
                    className="flex items-center gap-2 min-w-fit px-3 py-2"
                  >
                    <Users className="h-4 w-4" />
                    <span className="hidden md:inline">Stats</span>
                  </Button>



                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLogout}
                      className="flex items-center gap-2 min-w-fit px-3 py-2"
                    >
                      <LogOut className="h-4 w-4" />
                      <span className="hidden md:inline">Log Out</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Deadline Warning */}
          {(() => {
            const deadlineInfo = getDeadlineInfo();
            if (!deadlineInfo) return null;
            
            const getStatusColor = (status: string) => {
              switch (status) {
                case 'urgent': return 'bg-red-50 border-red-200 text-red-800';
                case 'warning': return 'bg-orange-50 border-orange-200 text-orange-800';
                case 'locked': return 'bg-gray-50 border-gray-200 text-gray-800';
                default: return 'bg-blue-50 border-blue-200 text-blue-800';
              }
            };
            
            const getStatusIcon = (status: string) => {
              switch (status) {
                case 'urgent': return <AlertTriangle className="h-4 w-4" />;
                case 'warning': return <Clock className="h-4 w-4" />;
                case 'locked': return <AlertTriangle className="h-4 w-4" />;
                default: return <Info className="h-4 w-4" />;
              }
            };
            
            return (
              <div className={`mt-2 p-3 rounded-lg border ${getStatusColor(deadlineInfo.status)}`}>
                <div className="flex items-center gap-2">
                  {getStatusIcon(deadlineInfo.status)}
                  <span className="text-sm font-medium">{deadlineInfo.message}</span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Main Content */}
        <div className="space-y-6">
          {/* Quick Stats */}
          {showQuickStats && (
            <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-900">
                  <Users className="h-5 w-5" />
                  Pool Statistics
                </CardTitle>
                <CardDescription className="text-green-700">
                  Current participation and submission status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{participantCount}</div>
                    <div className="text-sm text-green-700">Total Participants</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{submittedCount}</div>
                    <div className="text-sm text-blue-700">Submitted Picks</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{participantCount - submittedCount}</div>
                    <div className="text-sm text-orange-700">Pending</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {participantCount > 0 ? Math.round((submittedCount / participantCount) * 100) : 0}%
                    </div>
                    <div className="text-sm text-purple-700">Completion Rate</div>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-white rounded-lg border">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Submission Progress:</span>
                    <span className="font-medium">
                      {submittedCount} of {participantCount} participants
                    </span>
                  </div>
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${participantCount > 0 ? (submittedCount / participantCount) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Game Stats */}
          {(() => {
            const stats = getGameStatusStats();
            if (!stats) return null;
            
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="text-center">
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                    <div className="text-sm text-gray-600">Total Games</div>
                  </CardContent>
                </Card>
                <Card className="text-center">
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-green-600">{stats.upcoming}</div>
                    <div className="text-sm text-gray-600">Upcoming</div>
                  </CardContent>
                </Card>
                <Card className="text-center">
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-orange-600">{stats.inProgress}</div>
                    <div className="text-sm text-gray-600">In Progress</div>
                  </CardContent>
                </Card>
                <Card className="text-center">
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-gray-600">{stats.finished}</div>
                    <div className="text-sm text-gray-600">Finished</div>
                  </CardContent>
                </Card>
              </div>
            );
          })()}

          {/* Countdown Timer */}
          {countdown === null && (
            <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-center gap-3">
                  <Clock className="h-5 w-5 text-blue-600" />
                  <div className="text-center">
                    <div className="text-lg font-bold text-blue-900">
                      {countdown === 'Games Started' ? 'Games Have Started!' : `Picks Close In: ${countdown}`}
                    </div>
                    <div className="text-sm text-blue-700">
                      {countdown === 'Games Started' 
                        ? 'All picks are now locked' 
                        : 'Make sure to submit your picks before kickoff'
                      }
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Game Details Toggle */}
          {showGameDetails && games.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Week {currentWeek} Game Details
                </CardTitle>
                <CardDescription>
                  Detailed view of all games and their status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {games.map((game, index) => {
                    const gameTime = new Date(game.kickoff_time);
                    const now = new Date();
                    const timeDiff = gameTime.getTime() - now.getTime();
                    const isLocked = timeDiff <= 0;
                    const isUpcoming = timeDiff > 0 && timeDiff <= 24 * 60 * 60 * 1000;
                    
                    return (
                      <div key={game.id} className={`p-3 border rounded-lg ${isLocked ? 'bg-gray-50' : isUpcoming ? 'bg-orange-50' : 'bg-green-50'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-sm">Game {index + 1}</span>
                              {isLocked && <Badge variant="secondary" className="text-xs">Locked</Badge>}
                              {isUpcoming && <Badge variant="outline" className="text-xs text-orange-600">Upcoming</Badge>}
                              {!isLocked && !isUpcoming && <Badge variant="outline" className="text-xs text-green-600">Available</Badge>}
                            </div>
                            <div className="text-sm font-medium">
                              {game.away_team} @ {game.home_team}
                            </div>
                            <div className="text-xs text-gray-500">
                              {gameTime.toLocaleDateString()} at {gameTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          <div className="text-right">
                            {game.winner && (
                              <Badge variant="default" className="bg-green-100 text-green-800">
                                Winner: {game.winner}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Show Leaderboard when games have started, otherwise show picks */}
          {gamesStarted ? (
            <>
              {/* Leaderboard Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-600" />
                    Week {currentWeek} Leaderboard
                  </CardTitle>
                  <CardDescription>
                    Current standings for {poolName} - Games are in progress
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Leaderboard poolId={poolId!} weekNumber={currentWeek} seasonType={currentSeasonType} />
                </CardContent>
              </Card>

              {/* Recent Picks Section - Show when games have started */}
              {selectedUser && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="h-5 w-5 text-blue-600" />
                      Your Picks for Week {currentWeek}
                    </CardTitle>
                    <CardDescription>
                      Review your submitted picks for this week
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
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
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <>
              {/* Picks Section - Only show when games haven't started */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-blue-600" />
                    Week {currentWeek} Picks
                  </CardTitle>
                  <CardDescription>
                    {hasSubmitted 
                      ? "You have already submitted your picks for this week. Only admins can unlock your picks to make changes."
                      : "Select the winner for each game and assign confidence points"
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedUser ? (
                    hasSubmitted ? (
                      <div className="text-center py-8">
                        <div className="text-gray-500 mb-4">
                          <Lock className="h-12 w-12 mx-auto mb-2" />
                          <p className="text-lg font-medium">Picks Submitted</p>
                          <p className="text-sm">Your picks are locked for this week</p>
                        </div>
                        {(isPoolAdmin || isSuperAdmin) && (
                          <Button
                            onClick={() => unlockParticipantPicks(selectedUser.id)}
                            variant="outline"
                            className="flex items-center gap-2"
                          >
                            <Unlock className="h-4 w-4" />
                            Unlock Picks
                          </Button>
                        )}
                      </div>
                    ) : games.length > 0 ? (
                      <WeeklyPick 
                        poolId={poolId!} 
                        weekNumber={currentWeek} 
                        seasonType={currentSeasonType}
                        selectedUser={selectedUser}
                        games={games}
                        preventGameLoading={true}
                        onPicksSubmitted={handlePicksSubmitted}
                      />
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        No games found for Week {currentWeek}
                      </div>
                    )
                  ) : (
                    <PickUserSelection 
                      poolId={poolId!} 
                      weekNumber={currentWeek} 
                      onUserSelected={handleUserSelected}
                    />
                  )}
                </CardContent>
              </Card>

              {/* Optional Leaderboard Button - Only show when games haven't started */}
              {showLeaderboard && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-green-600" />
                      Week {currentWeek} Leaderboard
                    </CardTitle>
                    <CardDescription>
                      Current standings for {poolName}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Leaderboard poolId={poolId!} weekNumber={currentWeek} seasonType={currentSeasonType} />
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ParticipantPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-8 bg-gray-200 rounded"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    }>
      <ParticipantContent />
    </Suspense>
  );
}
