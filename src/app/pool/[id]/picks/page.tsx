'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { WeeklyPick } from '@/components/picks/weekly-pick';
import { PickUserSelection } from '@/components/picks/pick-user-selection';
import { RecentPicksViewer } from '@/components/picks/recent-picks-viewer';
import { Leaderboard } from '@/components/leaderboard/leaderboard';
import { SeasonLeaderboard } from '@/components/leaderboard/season-leaderboard';
import { QuarterLeaderboard } from '@/components/leaderboard/quarter-leaderboard';
import { ArrowLeft, Trophy, Users, Calendar, Clock, AlertTriangle, Info, Share2, BarChart3, Eye, EyeOff, Target, Zap, Lock, Unlock, LogOut, RefreshCw, Crown, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { pickStorage } from '@/lib/pick-storage';
import { getUpcomingWeek } from '@/actions/loadCurrentWeek';

import { Game, SelectedUser } from '@/types/game';
//
import { useRouter } from 'next/navigation';
import { userSessionManager } from '@/lib/user-session';
import { debugLog, DEFAULT_POOL_SEASON, SESSION_CLEANUP_INTERVAL, PERIOD_WEEKS } from '@/lib/utils';

// Helper functions for period calculations
function getPeriodName(week: number): string {
  if (week <= 4) return 'Period 1';
  if (week <= 9) return 'Period 2';
  if (week <= 14) return 'Period 3';
  if (week <= 18) return 'Period 4';
  return 'Unknown Period';
}

function getPeriodNumber(week: number): number {
  if (week <= 4) return 1;
  if (week <= 9) return 2;
  if (week <= 14) return 3;
  if (week <= 18) return 4;
  return 0;
}

function getPeriodWeeks(week: number): number[] {
  if (week <= 4) return [1, 2, 3, 4];
  if (week <= 9) return [5, 6, 7, 8, 9];
  if (week <= 14) return [10, 11, 12, 13, 14];
  if (week <= 18) return [15, 16, 17, 18];
  return [];
}

function PoolPicksContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const poolId = params.id as string;
  const weekParam = searchParams.get('week');
  const seasonTypeParam = searchParams.get('seasonType');
  
  const [poolName, setPoolName] = useState<string>('');
  const [currentWeek, setCurrentWeek] = useState<number>(1);
  const [currentSeasonType, setCurrentSeasonType] = useState<number>(2);
  const [poolSeason, setPoolSeason] = useState<number>(DEFAULT_POOL_SEASON);
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
  // const [hasPicks, setHasPicks] = useState(false); // retained for future use
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [weekWinner, setWeekWinner] = useState<{
    participant_name: string;
    points: number;
    correct_picks: number;
  } | null>(null);
  const [weekHasPicks, setWeekHasPicks] = useState(false);
  const [weekEnded, setWeekEnded] = useState(false);
  const [upcomingWeek, setUpcomingWeek] = useState<{week: number, seasonType: number}>({week: 1, seasonType: 2});
  
  const { toast } = useToast();
  const router = useRouter();

  // Helper function to get current user's submission status
  // const getCurrentUserSubmissionStatus = () => {
  //   if (!selectedUser) return false;
  //   return hasSubmitted[selectedUser.id]?.submitted || false;
  // };

  // Helper function to get the most recently submitted user
  // const getMostRecentSubmittedUser = () => {
  //   const submittedUsers = Object.entries(hasSubmitted)
  //     .filter(([_, data]) => data.submitted)
  //     .map(([userId, data]) => ({ id: userId, name: data.name }));
  //   return submittedUsers.length > 0 ? submittedUsers[0] : null;
  // };

  // Navigate to a specific week with season transition handling
  const navigateToWeek = (week: number, seasonType: number) => {
    // Handle season transitions
    let targetWeek = week;
    let targetSeasonType = seasonType;
    // const targetSeason = season;

    // Previous week navigation
    if (week < 1) {
      if (seasonType === 1) { // Preseason
        // Can't go before preseason
        return;
      } else if (seasonType === 2) { // Regular Season
        targetSeasonType = 1; // Go to Preseason
        targetWeek = 4; // Last week of preseason
      } else if (seasonType === 3) { // Postseason
        targetSeasonType = 2; // Go to Regular Season
        targetWeek = 18; // Last week of regular season
      }
    }

    // Next week navigation
    if (week > 18) {
      if (seasonType === 1) { // Preseason
        targetSeasonType = 2; // Go to Regular Season
        targetWeek = 1; // First week of regular season
      } else if (seasonType === 2) { // Regular Season
        targetSeasonType = 3; // Go to Postseason
        targetWeek = 1; // First week of postseason
      } else if (seasonType === 3) { // Postseason
        // Can't go beyond postseason
        return;
      }
    }

    // Handle week boundaries within season types
    if (seasonType === 1 && week > 4) { // Preseason max 4 weeks
      targetSeasonType = 2;
      targetWeek = 1;
    } else if (seasonType === 2 && week > 18) { // Regular season max 18 weeks
      targetSeasonType = 3;
      targetWeek = 1;
    } else if (seasonType === 3 && week > 5) { // Postseason max 5 weeks
      return; // Can't go beyond postseason
    }

    // Navigate to the new week
    const newUrl = `/pool/${poolId}/picks?week=${targetWeek}&seasonType=${targetSeasonType}`;
    window.location.href = newUrl;
  };

  // Navigate to current week
  const navigateToCurrentWeek = async () => {
    try {
      const upcomingWeek = await getUpcomingWeek();
      const newUrl = `/pool/${poolId}/picks?week=${upcomingWeek.week}&seasonType=${upcomingWeek.seasonType}`;
      window.location.href = newUrl;
    } catch (error) {
      console.error('Error getting current week:', error);
      // Fallback to week 1 regular season
      const newUrl = `/pool/${poolId}/picks?week=1&seasonType=2&season=${poolSeason}`;
      window.location.href = newUrl;
    }
  };

  // Check if week has ended and load winner
  const checkWeekStatus = async () => {
    if (games.length === 0) return;
    
    // Check if all games are properly finished (including tie games)
    const allGamesEnded = games.every(game => {
      const status = game.status?.toLowerCase();
      const hasWinner = game.winner && game.winner.trim() !== '';
      const isFinished = status === 'final' || status === 'post' || status === 'cancelled';
      
      // For tie games, check if scores are equal and game is finished
      const isTieGame = game.home_score !== null && game.away_score !== null && 
                       game.home_score === game.away_score;
      
      const gameEnded = isFinished && (hasWinner || isTieGame);
      
      debugLog('Week status check for game:', {
        game: `${game.away_team} @ ${game.home_team}`,
        status: game.status,
        winner: game.winner,
        home_score: game.home_score,
        away_score: game.away_score,
        isFinished,
        hasWinner,
        isTieGame,
        gameEnded
      });
      
      return gameEnded;
    });
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Week status result:', {
        allGamesEnded,
        gamesCount: games.length,
        gamesStatus: games.map(g => ({ 
          game: `${g.away_team} @ ${g.home_team}`, 
          status: g.status, 
          winner: g.winner 
        }))
      });
    }
    
    setWeekEnded(allGamesEnded);
    if (allGamesEnded) {
      debugLog('Week status result setWeekEnded if allGamesEnded:', {
        poolId,
        weekNumber: currentWeek,
        seasonType: currentSeasonType,
        season: poolSeason
      });
      try {
        // First check if winner already exists in database
        const winnerCheckResponse = await fetch(`/api/admin/week-winner?poolId=${poolId}&week=${currentWeek}&seasonType=${currentSeasonType}&season=${poolSeason}`);
        
        if (winnerCheckResponse.ok) {
          const winnerCheck = await winnerCheckResponse.json();
          
          if (winnerCheck.winnerExists && winnerCheck.winner) {
            // Winner already exists in database, use it
            debugLog('Using existing winner from database:', winnerCheck.winner);
            setWeekWinner({
              participant_name: winnerCheck.winner.winner_name,
              points: winnerCheck.winner.winner_points,
              correct_picks: winnerCheck.winner.winner_correct_picks
            });
            setWeekHasPicks(true);
            setShowLeaderboard(true);
            return; // Exit early since we have the winner
          }
        }
        
        // No winner in database, calculate from leaderboard
        debugLog('No existing winner found, calculating from leaderboard');
        const response = await fetch(`/api/leaderboard?poolId=${poolId}&week=${currentWeek}&seasonType=${currentSeasonType}&season=${poolSeason}`);
        debugLog('Week status result setWeekEnded if allGamesEnded:', response);
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.leaderboard && result.leaderboard.length > 0) {
            debugLog('Leaderboard result:', result);
            const winner = result.leaderboard[0]; // First place
            debugLog('Winner from leaderboard:', winner);
            setWeekWinner({
              participant_name: winner.participant_name,
              points: winner.total_points,
              correct_picks: winner.correct_picks
            });
            setWeekHasPicks(true);
            // Automatically show leaderboard when week ends
            setShowLeaderboard(true);
            
            // If winner has valid points and picks, add to weekly_winners table
            if (winner.total_points > 0 && winner.correct_picks > 0) {
              try {
                const addWinnerResponse = await fetch('/api/admin/week-winner', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    poolId,
                    week: currentWeek,
                    season: poolSeason,
                    seasonType: currentSeasonType,
                    winnerParticipantId: winner.participant_id,
                    winnerName: winner.participant_name,
                    winnerPoints: winner.total_points,
                    winnerCorrectPicks: winner.correct_picks,
                    totalParticipants: result.totalParticipants || 0
                  }),
                });
                
                if (addWinnerResponse.ok) {
                  const addResult = await addWinnerResponse.json();
                  debugLog('Winner added to database:', addResult);
                } else {
                  console.error('Failed to add winner to database:', addWinnerResponse.statusText);
                }
              } catch (error) {
                console.error('Error adding winner to database:', error);
              }
            }
          } else {
            setWeekHasPicks(false);
            // Still show leaderboard even if no picks, but indicate no results
            setShowLeaderboard(true);
          }
        }
      } catch (error) {
        console.error('Error loading week winner:', error);
        setWeekHasPicks(false);
      }
    }
  };

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

  // Check week status when games change
  useEffect(() => {
    checkWeekStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [games, poolId, currentWeek, currentSeasonType, poolSeason]);

  // Automatically show leaderboard when week ends
  useEffect(() => {
    if (weekEnded) {
      setShowLeaderboard(true);
    }
  }, [weekEnded]);

  // Clean up expired sessions periodically
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Clean up expired sessions immediately
    userSessionManager.cleanupExpiredSessions();

    // Set up periodic cleanup every 5 minutes
    const cleanupInterval = setInterval(() => {
      userSessionManager.cleanupExpiredSessions();
    }, SESSION_CLEANUP_INTERVAL);

    return () => clearInterval(cleanupInterval);
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);

      // Validate poolId first
      if (!poolId) {
        notFound();
        return;
      }
      
      // Validate pool ID format (should be a valid UUID)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(poolId)) {
        notFound();
        return;
      }

      debugLog('Pool picks page: Starting data load with:', {
        poolId,
        weekParam,
        seasonTypeParam,
        currentWeek,
        currentSeasonType
      });

      // Use the week and season type from URL parameters
      let weekToUse: number;
      let seasonTypeToUse: number;
      
      if (weekParam && !isNaN(parseInt(weekParam)) && parseInt(weekParam) >= 1) {
        weekToUse = parseInt(weekParam);
        seasonTypeToUse = seasonTypeParam ? parseInt(seasonTypeParam) : 2; // Default to regular season
        setCurrentWeek(weekToUse);
        setCurrentSeasonType(seasonTypeToUse);
        
        // Also get the upcoming week for comparison
        try {
          const upcomingWeek = await getUpcomingWeek();
          setUpcomingWeek({week: upcomingWeek.week, seasonType: upcomingWeek.seasonType});
        } catch (error) {
          console.error('Error getting upcoming week:', error);
          setUpcomingWeek({week: 1, seasonType: 2});
        }
        
        debugLog('Pool picks page: Using URL parameters - week:', weekToUse, 'season type:', seasonTypeToUse);
      } else {
        // Fallback to upcoming week only if no valid week in URL
        const upcomingWeek = await getUpcomingWeek();
        weekToUse = upcomingWeek.week;
        seasonTypeToUse = upcomingWeek.seasonType;
        setCurrentWeek(weekToUse);
        setCurrentSeasonType(seasonTypeToUse);
        setUpcomingWeek({week: upcomingWeek.week, seasonType: upcomingWeek.seasonType});
        
        debugLog('Pool picks page: Using upcoming week - week:', weekToUse, 'season type:', seasonTypeToUse);
        
        // Show a helpful message for empty week parameter
        toast({
          title: "Week not specified",
          description: `Showing upcoming week (Week ${upcomingWeek.week})`,
          duration: 3000,
        });
      }

      // Load pool information using the public API endpoint
      try {
        const apiUrl = `/api/pools/${poolId}?week=${weekToUse}&seasonType=${seasonTypeToUse}`;
        debugLog('Pool picks page: Fetching from API:', apiUrl);
        
        // Add timeout to fetch request
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(apiUrl, {
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.pool) {
            const pool = result.pool;
              
              // Validate that we have a valid pool with a name
              if (!pool.name || pool.name.trim() === '') {
                notFound();
                return;
              }
              
            setPoolName(pool.name);
            setPoolSeason(pool.season || DEFAULT_POOL_SEASON);
            
            // Set participant stats from the API response
            setParticipantCount(pool.participant_count || 0);
            setIsTestMode(pool.is_test_mode || false);
            
            // Set picks status if available
            if (pool.picks_status) {
              // hasPicks is deprecated in this component; only track submitted count
              setSubmittedCount(pool.picks_status.submittedCount || 0);
            }
          } else {
              // Pool not found - redirect to 404 page
              notFound();
          }
        } else {
          const errorText = await response.text();
          console.error('API response error:', response.status, errorText);
          
          // If it's a 404 error, redirect to 404 page
          if (response.status === 404) {
            notFound();
          } else {
          setError(`Failed to load pool information (${response.status}). Please try again.`);
          }
        }
      } catch (error) {
        console.error('Error loading pool:', error);
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            setError('Request timed out. Please try again.');
          } else if (error.message.includes('fetch failed')) {
            setError('Network error: Unable to connect to the server. Please check your internet connection and try again.');
          } else {
            setError(`Failed to load pool information: ${error.message}`);
          }
        } else {
          setError('Failed to load pool information. Please try again.');
        }
      }

      // Check admin status directly using the user session
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
            
            // Check if user is the pool commissioner (created the pool)
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
        console.error('Error checking admin status:', error);
        // Continue without admin status - user can still use the page
      }

      // Load games for the week using the new API route
      try {
        debugLog('Pool picks page: Loading games for week:', weekToUse, 'season type:', seasonTypeToUse);
        
        const gamesApiUrl = `/api/games/week?week=${weekToUse}&seasonType=${seasonTypeToUse}`;
        
        // Add timeout to fetch request
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(gamesApiUrl, {
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            let gamesData = result.games;
            
            // Load team records for the season if games exist
            if (gamesData && gamesData.length > 0) {
              const season = gamesData[0].season || poolSeason;
              
              try {
                const recordsResponse = await fetch(`/api/team-records?season=${season}`, {
                  headers: {
                    'Content-Type': 'application/json',
                  },
                });
                
                if (recordsResponse.ok) {
                  const recordsResult = await recordsResponse.json();
                  if (recordsResult.success && recordsResult.records) {
                    // Create a map of team_id (database UUID) to team record
                    const recordsMapById = new Map<string, any>();
                    // Also create a fallback map by abbreviation
                    const recordsMapByAbbr = new Map<string, any>();
                    
                    recordsResult.records.forEach((record: any) => {
                      const recordData = {
                        wins: record.wins || 0,
                        losses: record.losses || 0,
                        ties: record.ties || 0,
                        home_wins: record.home_wins,
                        home_losses: record.home_losses,
                        home_ties: record.home_ties,
                        road_wins: record.road_wins,
                        road_losses: record.road_losses,
                        road_ties: record.road_ties
                      };
                      
                      // Map by team_id (database UUID) - primary lookup
                      if (record.team_id) {
                        recordsMapById.set(record.team_id, recordData);
                      }
                      
                      // Map by abbreviation as fallback
                      if (record.team_abbreviation) {
                        recordsMapByAbbr.set(record.team_abbreviation.toLowerCase(), recordData);
                      }
                    });
                    
                    // Attach team records to games
                    gamesData = gamesData.map((game: Game) => {
                      // Try to match by team_id (database UUID) first
                      let homeRecord = game.home_team_id ? recordsMapById.get(game.home_team_id.toString()) : undefined;
                      let awayRecord = game.away_team_id ? recordsMapById.get(game.away_team_id.toString()) : undefined;
                      
                      // Fallback to abbreviation matching if UUID match failed
                      if (!homeRecord && game.home_team_id) {
                        const homeAbbr = game.home_team_id.toString().toLowerCase();
                        homeRecord = recordsMapByAbbr.get(homeAbbr);
                      }
                      if (!homeRecord && game.home_team) {
                        homeRecord = recordsMapByAbbr.get(game.home_team.toLowerCase());
                      }
                      
                      if (!awayRecord && game.away_team_id) {
                        const awayAbbr = game.away_team_id.toString().toLowerCase();
                        awayRecord = recordsMapByAbbr.get(awayAbbr);
                      }
                      if (!awayRecord && game.away_team) {
                        awayRecord = recordsMapByAbbr.get(game.away_team.toLowerCase());
                      }
                      
                      return {
                        ...game,
                        home_team_record: homeRecord,
                        away_team_record: awayRecord
                      };
                    });
                    
                    debugLog('Attached team records to games');
                  }
                }
              } catch (recordsError) {
                console.error('Error loading team records:', recordsError);
                // Continue without team records if fetch fails
              }
            }
            
            setGames(gamesData);
            
            debugLog('Loaded games:',
                gamesData.map((g: Game) => ({ id: g.id, home_team: g.home_team, away_team: g.away_team, week: g.week, season_type: g.season_type })));
            
            
            // Check if any games have started (with buffer time)
            const now = new Date();
            const validGames = gamesData.filter((game: Game) => {
              const gameTime = new Date(game.kickoff_time);
              
              // Skip games with obviously invalid dates (like test data)
              const currentYear = now.getFullYear();
              const gameYear = gameTime.getFullYear();
              
              // Check for common test data patterns
              const isTestData = 
                Math.abs(currentYear - gameYear) > 1 || // Different year
                (gameYear === 2025 && gameTime.getMonth() === 7 && gameTime.getDate() === 1) || // August 1, 2025
                gameTime.getTime() < new Date('2024-01-01').getTime(); // Before 2024
              
              if (isTestData) {
                debugLog('Skipping game with test/invalid date:', {
                  game: `${game.away_team} @ ${game.home_team}`,
                  gameYear,
                  currentYear,
                  kickoff: gameTime.toISOString(),
                  isTestData: true
                }); 
                
                return false;
              }
              return true;
            });
            
            debugLog('Valid games count:', validGames.length, 'out of', gamesData.length);
            
            // Only check game start status if we have valid games
            let hasStarted = false;
            if (validGames.length > 0) {
              hasStarted = validGames.some((game: Game) => {
                const gameTime = new Date(game.kickoff_time);
                
                // Consider game started only after kickoff + buffer time (e.g., 1 hour)
                const bufferTime = 60 * 60 * 1000; // 1 hour in milliseconds
                const gameStarted = (gameTime.getTime() + bufferTime) <= now.getTime();
                
                debugLog('Game status check:', {
                    game: `${game.away_team} @ ${game.home_team}`,
                    kickoff: gameTime.toISOString(),
                    now: now.toISOString(),
                    bufferTime: bufferTime / (1000 * 60 * 60), // hours
                    gameStarted
                  });
                
                return gameStarted;
              });
            } else {
              // If all games are test data, don't start games
              hasStarted = false;
              debugLog('All games are test data, setting gamesStarted to false');
            }
            
            setGamesStarted(hasStarted);
            
            debugLog('Overall games started status:', hasStarted);
            
            // Automatically show leaderboard when games start
            if (hasStarted) {
              setShowLeaderboard(true);
            }
          } else {
            console.error('API returned error:', result.error);
            toast({
              title: "Warning",
              description: "Could not load games data",
              variant: "destructive",
            });
          }
        } else {
          const errorText = await response.text();
          console.error('Games API response error:', response.status, errorText);
          throw new Error(`Failed to load games (${response.status})`);
        }
      } catch (e) {
        console.error('Error loading games:', e);
        if (e instanceof Error) {
          if (e.name === 'AbortError') {
            toast({
              title: "Warning",
              description: "Games request timed out",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Warning",
              description: `Could not load games data: ${e.message}`,
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "Warning",
            description: "Could not load games data",
            variant: "destructive",
          });
        }
      }

      // Check if there's a saved user session for this pool
      if (poolId) {
        try {
          // Clean up expired sessions before checking for valid ones
          userSessionManager.cleanupExpiredSessions();
          
          const allSessions = userSessionManager.getAllSessions();
          const poolSession = allSessions.find(session => session.poolId === poolId);
          
          if (poolSession && poolSession.userId) {
            debugLog('Restoring user session:', poolSession);
            setSelectedUser({
              id: poolSession.userId,
              name: poolSession.userName,
            });
          }
        } catch {
          debugLog('No saved user session found for pool:', poolId);
        }
      }

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error loading pool picks data:', error);
              setError('Failed to load pool information. Please try again or contact the pool commissioner.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolId, weekParam]);

  useEffect(() => {
    loadParticipantStats();
    checkAdminPermissions();
    checkWeekPicksStatus();
  }, [poolId, currentWeek, currentSeasonType]);

  useEffect(() => {
    checkUserSubmissionStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser, poolId, currentWeek, currentSeasonType]);

  const handleRefresh = async () => {
    setIsLoading(true);
    setError(''); // Clear any previous errors
    await loadData();
  };

  const handleRetry = async () => {
    debugLog('Retrying data load...');
    await handleRefresh();
  };

  const handleUserSelected = (userId: string, userName: string) => {
    const user = { id: userId, name: userName };
    setSelectedUser(user);
    
    // Load picks from localStorage if they exist
    loadPicksFromLocalStorage(userId, poolId!, currentWeek);
  };

  const loadPicksFromLocalStorage = async (participantId: string, poolId: string, week: number) => {
    try {
      const { pickStorage } = await import('@/lib/pick-storage');
      
      // Check if there are stored picks for this user, pool, and week
      if (pickStorage.hasValidPicks(participantId, poolId, week)) {
        const storedPicks = pickStorage.loadPicks(participantId, poolId, week);
        
        if (storedPicks && storedPicks.length > 0) {
          // Show a toast to inform the user about restored picks
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
      } catch (err) {
        console.error('Error loading picks from localStorage:', err);
      toast({
        title: "Warning",
        description: "Could not load saved picks from previous session",
        variant: "destructive",
      });
    }
  };

  const handlePicksSubmitted = async () => {
    // Show success dialog
    setShowSuccessDialog(true);
    
    // Update the submission status for the current user
    if (selectedUser) {
      setHasSubmitted(prev => ({ ...prev, [selectedUser.id]: { submitted: true, name: selectedUser.name } }));
    }
    
    // Refresh the page data when picks are submitted
    await loadData();
    await loadParticipantStats();
    await checkUserSubmissionStatus();
    
    // Clear the selected user so they can select a different user or see the user selection interface
    setSelectedUser(null);
    
    debugLog('Picks submitted successfully, clearing user selection to allow new user selection');
  };

  const handleUserChangeRequested = () => {
    debugLog('User change requested. Current user:', selectedUser);
    
    // Clear the selected user to show the user selection interface
    setSelectedUser(null);
    
    // Clear any stored picks for the previous user
    if (selectedUser) {
      const clearStoredPicks = async () => {
        try {
          pickStorage.clearPicks();
          debugLog('Cleared stored picks for user:', selectedUser.id);
        } catch (error) {
          console.error('Error clearing stored picks:', error);
        }
      };
      clearStoredPicks();
    }
    
    // Reset submission status
    setHasSubmitted({});
    
    // Clean up expired sessions when user changes
    userSessionManager.cleanupExpiredSessions();

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
      } catch (e) {
      console.error('Error sharing:', e);
    }
  };

  const loadParticipantStats = async () => {
    // Stats are now loaded from the pool API endpoint
    // This function is kept for compatibility but no longer makes database calls
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

      // Use service role client to bypass RLS policies
      const { getSupabaseServiceClient } = await import('@/lib/supabase');
      const supabase = getSupabaseServiceClient();
      
      // First, get the games for this week and season type
      const { data: gamesForWeek, error: gamesError } = await supabase
        .from('games')
        .select('id')
        .eq('week', currentWeek)
        .eq('season_type', currentSeasonType);

      if (gamesError) {
        console.error('Error fetching games for week:', gamesError);
        return;
      }

      debugLog('Games for week:', { gamesForWeek, count: gamesForWeek?.length || 0 });

      if (!gamesForWeek || gamesForWeek.length === 0) {
        debugLog('No games found for week, cannot check picks');
        return;
      }

      const gameIds = gamesForWeek.map(g => g.id);
      
      // Check if THIS SPECIFIC USER has submitted picks for these games
      const { data: picks, error: picksError } = await supabase
        .from('picks')
        .select('id, game_id')
        .eq('participant_id', selectedUser.id)  // Only check for the current user
        .eq('pool_id', poolId)
        .in('game_id', gameIds);

      if (picksError) {
        console.error('Error checking picks:', picksError);
        return;
      }

      debugLog('Picks found for current user:', { picks, count: picks?.length || 0 });

      // User has submitted if they have picks for all games in this week
      const hasSubmitted = picks && picks.length > 0 && picks.length === gameIds.length;
      setHasSubmitted(prev => ({ ...prev, [selectedUser.id]: { submitted: hasSubmitted, name: selectedUser.name } }));

      debugLog('Submission status updated for current user:', { hasSubmitted, picksCount: picks?.length || 0, gamesCount: gameIds.length });
    } catch (error) {
      console.error('Error checking submission status:', error);
    }
  };

  const checkWeekPicksStatus = async () => {
    // Picks status is now loaded from the pool API endpoint
    // This function is kept for compatibility but no longer makes database calls
    debugLog('Week picks status loaded from API endpoint');
  };

  const checkAdminPermissions = async () => {
    // Admin permissions are now loaded from the pool API endpoint
    // This function is kept for compatibility but no longer makes database calls
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
      // Use service role client for admin operations
      const { getSupabaseServiceClient } = await import('@/lib/supabase');
      const supabase = getSupabaseServiceClient();
      
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
          admin_id: null, // Service role doesn't have specific admin ID
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

      // Reset the submission status for this specific user
      setHasSubmitted(prev => ({ ...prev, [participantId]: { submitted: false, name: '' } }));

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
      } else if (game.status === 'finished' || game.status === 'final' || game.winner) {
        stats.finished++;
      } else {
        stats.inProgress++;
      }
    });

    return stats;
  };

  // Check if week has ended and no picks were submitted
  if (process.env.NODE_ENV === 'development') {
    console.log('Early return check 1:', { weekEnded, weekHasPicks, condition: weekEnded && !weekHasPicks });
  }
  
  if (weekEnded && !weekHasPicks) {
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
              <div className="space-y-4">
                {/* Pool Header Row */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-center gap-2">
                    <Users className="h-5 w-5 text-gray-500" />
                    <span className="font-semibold text-xl">{poolName}</span>
                  </div>
                  
                  {/* Week Navigation - Centered horizontal layout */}
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigateToWeek(currentWeek - 1, currentSeasonType)}
                      disabled={currentWeek <= 1 && currentSeasonType <= 1}
                      className="flex items-center gap-1 px-3 py-2 h-9"
                      title={currentWeek <= 1 && currentSeasonType <= 1 ? "Already at earliest week" : "Go to previous week"}
                    >
                      <ChevronLeft className="h-3 w-3" />
                      <span className="hidden xs:inline">Previous Week</span>
                      <span className="xs:hidden">Prev</span>
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={navigateToCurrentWeek}
                      className="flex items-center gap-1 px-3 py-2 h-9"
                      title="Go to current/upcoming week"
                    >
                      <Calendar className="h-3 w-3" />
                      <span className="hidden xs:inline">Current Week</span>
                      <span className="xs:hidden">Current</span>
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigateToWeek(currentWeek + 1, currentSeasonType)}
                      disabled={currentWeek >= 18 && currentSeasonType >= 3}
                      className="flex items-center gap-1 px-3 py-2 h-9"
                      title={currentWeek >= 18 && currentSeasonType >= 3 ? "Already at latest week" : "Go to next week"}
                    >
                      <span className="hidden xs:inline">Next Week</span>
                      <span className="xs:hidden">Next</span>
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                
                {/* Week Info Row */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <Badge variant="outline" className="px-3 py-1">Week {currentWeek}</Badge>
                  </div>
                  <span className="text-sm text-gray-600">
                      {games.length} games
                    </span>
                    {(() => {
                        const seasonType = seasonTypeParam ? parseInt(seasonTypeParam) : 2;
                        const seasonTypeNames = { 1: 'Preseason', 2: 'Regular', 3: 'Postseason' };
                        return (
                      <Badge variant="secondary" className="text-xs px-2 py-1">
                          {seasonTypeNames[seasonType as keyof typeof seasonTypeNames] || 'Unknown'}
                        </Badge>
                      );
                      })()}
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
                <p>This week has already ended, but no participants submitted picks.</p>
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

  // Show week winner when week has ended and there are picks
  debugLog('Early return check 2:', { weekEnded, weekHasPicks, weekWinner: !!weekWinner, condition: weekEnded && weekHasPicks && weekWinner });
  if (weekEnded && weekHasPicks && weekWinner) {
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
              <div className="space-y-4">
                {/* Pool Header Row */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-center gap-2">
                    <Users className="h-5 w-5 text-gray-500" />
                    <span className="font-semibold text-xl">{poolName}</span>
                  </div>
                  
                  {/* Week Navigation - Centered horizontal layout */}
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigateToWeek(currentWeek - 1, currentSeasonType)}
                      disabled={currentWeek <= 1 && currentSeasonType <= 1}
                      className="flex items-center gap-1 px-3 py-2 h-9"
                      title={currentWeek <= 1 && currentSeasonType <= 1 ? "Already at earliest week" : "Go to previous week"}
                    >
                      <ChevronLeft className="h-3 w-3" />
                      <span className="hidden xs:inline">Previous Week</span>
                      <span className="xs:hidden">Prev</span>
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={navigateToCurrentWeek}
                      className="flex items-center gap-1 px-3 py-2 h-9"
                      title="Go to current/upcoming week"
                    >
                      <Calendar className="h-3 w-3" />
                      <span className="hidden xs:inline">Current Week</span>
                      <span className="xs:hidden">Current</span>
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigateToWeek(currentWeek + 1, currentSeasonType)}
                      disabled={currentWeek >= 18 && currentSeasonType >= 3}
                      className="flex items-center gap-1 px-3 py-2 h-9"
                      title={currentWeek >= 18 && currentSeasonType >= 3 ? "Already at latest week" : "Go to next week"}
                    >
                      <span className="hidden xs:inline">Next Week</span>
                      <span className="xs:hidden">Next</span>
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                
                                  {/* Week Info Row */}
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                      <Badge variant="outline" className="px-3 py-1">Week {currentWeek}</Badge>
                    </div>
                    <span className="text-sm text-gray-600">
                      {games.length} games
                    </span>
                    {(() => {
                        const seasonType = seasonTypeParam ? parseInt(seasonTypeParam) : 2;
                        const seasonTypeNames = { 1: 'Preseason', 2: 'Regular', 3: 'Postseason' };
                        return (
                        <Badge variant="secondary" className="text-xs px-2 py-1">
                          {seasonTypeNames[seasonType as keyof typeof seasonTypeNames] || 'Unknown'}
                        </Badge>
                      );
                      })()}
                  </div>
                  
                  {/* Last Updated Timestamp */}
                  <div className="text-center">
                    <span className="text-xs text-gray-500">
                      Last updated: {new Date().toLocaleTimeString()}
                    </span>
                </div>
              </div>
            </div>
          </div>

          {/* Week Winner Announcement */}
          <Card className="max-w-2xl mx-auto bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center">
                <Crown className="h-10 w-10 text-yellow-600" />
              </div>
              <CardTitle className="text-yellow-900 text-2xl">Week {currentWeek} Winner!</CardTitle>
              <CardDescription className="text-yellow-700 text-lg">
                Congratulations to this week&apos;s winner!
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <div className="bg-white rounded-lg p-6 border border-yellow-200">
                <div className="text-3xl font-bold text-yellow-800 mb-2">
                  {weekWinner.participant_name}
                </div>
                <div className="text-lg text-yellow-700 mb-4">
                  {weekWinner.points} points
                </div>
                <div className="text-sm text-gray-600">
                  {weekWinner.correct_picks} correct picks out of {games.length} games
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Full Leaderboard */}
          {showLeaderboard && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-600" />
                  Week {currentWeek} Final Results
                </CardTitle>
                <CardDescription>
                  Complete standings for {poolName} - Week {currentWeek}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Leaderboard poolId={poolId} weekNumber={currentWeek} seasonType={currentSeasonType} season={poolSeason} />
              </CardContent>
            </Card>
          )}

          {/* Quarter Leaderboard - default visible */}
          <Card className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <Trophy className="h-6 w-6 text-blue-600" />
                Current Quarter Standings
              </CardTitle>
              <CardDescription className="text-blue-700">
                Live totals for the current period based on completed games
              </CardDescription>
            </CardHeader>
            <CardContent>
              <QuarterLeaderboard 
                poolId={poolId}
                season={poolSeason}
                currentWeek={currentWeek}
              />
            </CardContent>
          </Card>

          {/* Season Leaderboard - toggled */}
          <div className="mt-4">
            <details>
              <summary className="cursor-pointer text-sm text-blue-800 hover:underline">Show Season Standings</summary>
              <Card className="mt-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-900">
                    <Trophy className="h-6 w-6 text-blue-600" />
                    Season {poolSeason} Overall Standings
                  </CardTitle>
                  <CardDescription className="text-blue-700">
                    Total accumulated scores up to Week {currentWeek} ({currentSeasonType === 1 ? 'Preseason' : currentSeasonType === 2 ? 'Regular Season' : 'Postseason'})
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <SeasonLeaderboard 
                    poolId={poolId} 
                    season={poolSeason} 
                    currentWeek={currentWeek}
                    currentSeasonType={currentSeasonType}
                  />
                </CardContent>
              </Card>
            </details>
          </div>

          {/* Period Leaderboard Link - Show when current week is a tie-breaker week */}
          {PERIOD_WEEKS.includes(currentWeek as typeof PERIOD_WEEKS[number]) && (
            <Card className="mt-6 bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-purple-900">
                  <Crown className="h-6 w-6 text-purple-600" />
                  Quarter Leaderboard
                </CardTitle>
                <CardDescription className="text-purple-700">
                  Week {currentWeek} is a tie-breaker week! View the complete quarter standings and winners.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link 
                    href={`/periods/${poolId}/${poolSeason}/${getPeriodNumber(currentWeek)}`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View {getPeriodName(currentWeek).replace('Period', 'Quarter')} Leaderboard
                  </Link>
                  <div className="text-sm text-purple-600 flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Quarter includes weeks: {getPeriodWeeks(currentWeek).join(', ')}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600">Loading pool picks...</p>
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
          <CardContent className="text-center space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={handleRetry} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
              <Link href="/">
                <Button>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Home
                </Button>
              </Link>
            </div>
            {process.env.NODE_ENV === 'development' && (
              <div className="text-xs text-gray-500 mt-4 p-2 bg-gray-100 rounded">
                <p><strong>Debug Info:</strong></p>
                <p>Pool ID: {poolId || 'undefined'}</p>
                <p>Week: {weekParam || 'undefined'}</p>
                <p>Season Type: {seasonTypeParam || 'undefined'}</p>
              </div>
            )}
          </CardContent>
        </Card>
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

      {/* Floating Leaderboard Button for Mobile - Show when week has ended */}
      {weekEnded && (
        <div className="fixed top-4 right-4 z-50 sm:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowLeaderboard(!showLeaderboard)}
            className="shadow-lg"
          >
            <BarChart3 className="h-4 w-4" />
                  </Button>
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
                      // Default to regular season for display
                        const seasonTypeNames = { 1: 'Preseason', 2: 'Regular', 3: 'Postseason' };
                        return (
                        <Badge variant="secondary" className="text-xs">
                          {seasonTypeNames[(seasonTypeParam ? parseInt(seasonTypeParam) : 2) as keyof typeof seasonTypeNames] || 'Unknown'}
                        </Badge>
                      );
                      })()}
          </div>

                {/* Week Navigation - Always visible for all weeks */}
                <div className="flex items-center justify-center gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigateToWeek(currentWeek - 1, currentSeasonType)}
                    disabled={currentWeek <= 1 && currentSeasonType <= 1}
                    className="flex items-center gap-1 px-3 py-2 h-9"
                    title={currentWeek <= 1 && currentSeasonType <= 1 ? "Already at earliest week" : "Go to previous week"}
                  >
                    <ChevronLeft className="h-3 w-3" />
                    <span className="hidden xs:inline">Previous Week</span>
                    <span className="xs:hidden">Prev</span>
                  </Button>
                  
                  <Button
                    variant={currentWeek === upcomingWeek.week && currentSeasonType === upcomingWeek.seasonType ? "default" : "outline"}
                    size="sm"
                    onClick={navigateToCurrentWeek}
                    className={`flex items-center gap-1 px-3 py-2 h-9 ${
                      currentWeek === upcomingWeek.week && currentSeasonType === upcomingWeek.seasonType 
                        ? "bg-blue-600 text-white hover:bg-blue-700" 
                        : ""
                    }`}
                    title="Go to current/upcoming week"
                  >
                    <Calendar className="h-3 w-3" />
                    <span className="hidden xs:inline">Current Week</span>
                    <span className="xs:hidden">Current</span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigateToWeek(currentWeek + 1, currentSeasonType)}
                    disabled={currentWeek >= 18 && currentSeasonType >= 3}
                    className="flex items-center gap-1 px-3 py-2 h-9"
                    title={currentWeek >= 18 && currentSeasonType >= 3 ? "Already at latest week" : "Go to next week"}
                  >
                    <span className="hidden xs:inline">Next Week</span>
                    <span className="xs:hidden">Next</span>
                    <ChevronRight className="h-3 w-3" />
                  </Button>
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

                  {weekEnded && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowLeaderboard(!showLeaderboard)}
                      className="flex items-center gap-2 min-w-fit px-3 py-2"
                    >
                      <BarChart3 className="h-4 w-4" />
                      <span className="hidden md:inline">{showLeaderboard ? 'Hide' : 'Show'} Leaderboard</span>
                    </Button>
                  )}

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
          {countdown && countdown !== 'Games Started' && (
            <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-center gap-3">
                  <Clock className="h-5 w-5 text-blue-600" />
                  <div className="text-center">
                    <div className="text-lg font-bold text-blue-900">
                      Picks Close In: {countdown}
                    </div>
                    <div className="text-sm text-blue-700">
                      Make sure to submit your picks before kickoff
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Games Started Warning */}
          {countdown === 'Games Started' && (
            <Card className="bg-gradient-to-r from-red-50 to-orange-50 border-red-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <div className="text-center">
                    <div className="text-lg font-bold text-red-900">
                      Games Have Started!
                    </div>
                    <div className="text-sm text-red-700">
                      All picks are now locked
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
                              {isUpcoming && <Badge variant="secondary" className="text-xs text-orange-600">Upcoming</Badge>}
                              {!isLocked && !isUpcoming && <Badge variant="secondary" className="text-xs text-green-600">Available</Badge>}
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

          {/* Debug Info - Only show in development */}
          {process.env.NODE_ENV === 'development' && (
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-blue-900 text-sm">Debug Info</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-blue-800 space-y-1">
                <p><strong>Games Started:</strong> {gamesStarted ? 'Yes' : 'No'}</p>
                <p><strong>Games Count:</strong> {games.length}</p>
                <p><strong>Current Time:</strong> {new Date().toISOString()}</p>
                <p><strong>First Game Time:</strong> {games.length > 0 ? new Date(games[0].kickoff_time).toISOString() : 'N/A'}</p>
                <p><strong>Selected User:</strong> {selectedUser ? `${selectedUser.name} (${selectedUser.id})` : 'None'}</p>
                <p><strong>Has Submitted:</strong> {selectedUser ? (hasSubmitted[selectedUser.id]?.submitted ? 'Yes' : 'No') : 'N/A'}</p>
                <p><strong>Show Leaderboard:</strong> {showLeaderboard ? 'Yes' : 'No'}</p>
                <p><strong>Week Ended:</strong> {weekEnded ? 'Yes' : 'No'}</p>
                <p><strong>Week Has Picks:</strong> {weekHasPicks ? 'Yes' : 'No'}</p>
                <p><strong>Week Winner:</strong> {weekWinner ? `${weekWinner.participant_name} (${weekWinner.points} pts)` : 'None'}</p>
                <p><strong>Is Loading:</strong> {isLoading ? 'Yes' : 'No'}</p>
                <p><strong>Error:</strong> {error || 'None'}</p>
                <p><strong>Pool ID:</strong> {poolId || 'None'}</p>
                <p><strong>Week:</strong> {currentWeek}</p>
                <p><strong>Season Type:</strong> {currentSeasonType}</p>
                <p><strong>All Users Status:</strong> {JSON.stringify(hasSubmitted)}</p>
              </CardContent>
            </Card>
          )}


          {/* Show Leaderboard when games have started, otherwise show picks */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                <strong>Main picks section reached!</strong> Games started: {gamesStarted ? 'Yes' : 'No'}, Week ended: {weekEnded ? 'Yes' : 'No'}
              </p>
            </div>
          )}
          
          {/* Show Leaderboard when week has ended */}
          {weekEnded && (
            <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
              <CardHeader className="text-center">
                <CardTitle className="flex items-center gap-2 text-yellow-900 text-2xl">
                  <Crown className="h-6 w-6" />
                  Week {currentWeek} Final Results
                </CardTitle>
                <CardDescription className="text-yellow-700 text-lg">
                  {weekHasPicks 
                    ? `The week has ended! Here are the final standings for ${poolName}`
                    : `Week ${currentWeek} has ended. No picks were submitted for this week.`
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                {weekHasPicks ? (
                  <Leaderboard poolId={poolId} weekNumber={currentWeek} seasonType={currentSeasonType} season={poolSeason} />
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Calendar className="h-12 w-12 mx-auto mb-2" />
                    <p className="text-lg font-medium">No Results Available</p>
                    <p className="text-sm">This week ended without any submitted picks</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Season Leaderboard - Show accumulated scores across all weeks */}
          {weekEnded && (
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-900">
                  <Trophy className="h-6 w-6 text-blue-600" />
                  Season {poolSeason} Overall Standings
                </CardTitle>
                <CardDescription className="text-blue-700">
                  Total accumulated scores up to Week {currentWeek} ({currentSeasonType === 1 ? 'Preseason' : currentSeasonType === 2 ? 'Regular Season' : 'Postseason'})
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SeasonLeaderboard 
                  poolId={poolId} 
                  season={poolSeason} 
                  currentWeek={currentWeek}
                  currentSeasonType={currentSeasonType}
                />
              </CardContent>
            </Card>
          )}

          {/* Manual Leaderboard Toggle - Show when week has ended and user wants to see it */}
          {weekEnded && showLeaderboard && weekHasPicks && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-600" />
                  Week {currentWeek} Leaderboard
                </CardTitle>
                <CardDescription>
                  Final standings for {poolName} - Week {currentWeek}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Leaderboard poolId={poolId} weekNumber={currentWeek} seasonType={currentSeasonType} season={poolSeason} />
              </CardContent>
            </Card>
          )}

          {/* Period Leaderboard Link - Show when current week is a tie-breaker week */}
          {PERIOD_WEEKS.includes(currentWeek as typeof PERIOD_WEEKS[number]) && (
            <Card className="mt-6 bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-purple-900">
                  <Crown className="h-6 w-6 text-purple-600" />
                  Quarter Leaderboard
                </CardTitle>
                <CardDescription className="text-purple-700">
                  Week {currentWeek} is a tie-breaker week! View the complete quarter standings and winners.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link 
                    href={`/periods/${poolId}/${poolSeason}/${getPeriodNumber(currentWeek)}`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View {getPeriodName(currentWeek).replace('Period', 'Quarter')} Leaderboard
                  </Link>
                  <div className="text-sm text-purple-600 flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Quarter includes weeks: {getPeriodWeeks(currentWeek).join(', ')}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {gamesStarted && !weekEnded ? (
            <>
              {/* Leaderboard Section - Only show when everyone has submitted */}
              {submittedCount >= participantCount ? (
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
                    <Leaderboard
                      poolId={poolId}
                      weekNumber={currentWeek}
                      seasonType={currentSeasonType}
                      season={poolSeason}
                    />
                  </CardContent>
                </Card>
              ) : (
                <Card className="bg-orange-50 border-orange-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-orange-800">
                      <Clock className="h-5 w-5" />
                      Waiting for All Submissions
                    </CardTitle>
                    <CardDescription className="text-orange-700">
                      {submittedCount} of {participantCount} participants have submitted picks
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-4">
                      <p className="text-orange-600 mb-3">
                        The leaderboard will be available once all participants submit their picks
                      </p>
                      <div className="w-full bg-orange-200 rounded-full h-2">
                        <div
                          className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                          style={{
                            width: `${participantCount > 0 ? (submittedCount / participantCount) * 100 : 0}%`,
                          }}
                        ></div>
                      </div>
                      <p className="text-sm text-orange-600 mt-2">
                        {participantCount - submittedCount} participants still need to submit
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : !weekEnded && !gamesStarted ? (
            <>
              {submittedCount >= participantCount ? (
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
                    <Leaderboard
                      poolId={poolId}
                      weekNumber={currentWeek}
                      seasonType={currentSeasonType}
                      season={poolSeason}
                    />
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-blue-600" />
                      Week {currentWeek} Picks
                    </CardTitle>
                    <CardDescription>
                      {selectedUser && hasSubmitted[selectedUser.id]?.submitted
                        ? "You have already submitted your picks for this week. Only admins can unlock your picks to make changes."
                        : "Select the winner for each game and assign confidence points"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {selectedUser ? (
                      hasSubmitted[selectedUser.id]?.submitted ? (
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
                        <div>
                          {process.env.NODE_ENV === "development" && (
                            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                              <div className="text-sm text-blue-800">
                                <span className="font-bold">User Selected:</span>{" "}
                                {selectedUser.name} (ID: {selectedUser.id})
                              </div>
                              <div className="text-sm text-blue-700">
                                Pool: {poolId} | Week: {currentWeek} | Season Type:{" "}
                                {currentSeasonType}
                              </div>
                              <div className="text-sm text-blue-600">
                                <span className="font-bold">Submission Status:</span>{" "}
                                {hasSubmitted[selectedUser.id]?.submitted
                                  ? "Submitted"
                                  : "Not Submitted"}
                              </div>
                              <div className="text-sm text-blue-800">
                                <span className="font-bold">All Users Status:</span>{" "}
                                {JSON.stringify(hasSubmitted)}
                              </div>
                            </div>
                          )}
                          <WeeklyPick
                            poolId={poolId}
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
                        <div className="text-center py-8 text-gray-500">
                          No games found for Week {currentWeek}
                        </div>
                      )
                    ) : (
                      <div>
                        {Object.keys(hasSubmitted).length > 0 && (
                          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                            <div className="text-sm text-green-800 text-center mb-3">
                              <span className="font-bold">Picks submitted successfully!</span>{" "}
                              Best of luck this week!
                            </div>
                            <div className="flex flex-col items-center gap-3">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowLeaderboard(true)}
                                className="text-xs"
                                disabled={submittedCount < participantCount}
                              >
                                <BarChart3 className="h-3 w-3 mr-1" />
                                View Leaderboard
                                {submittedCount < participantCount && (
                                  <span className="ml-1 text-xs">
                                    ({submittedCount}/{participantCount})
                                  </span>
                                )}
                              </Button>
                            </div>
                          </div>
                        )}
                        <PickUserSelection
                          poolId={poolId}
                          weekNumber={currentWeek}
                          seasonType={currentSeasonType}
                          onUserSelected={handleUserSelected}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Your Picks Section - Show when games haven't started and user has picks */}
              {selectedUser && hasSubmitted[selectedUser.id]?.submitted && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="h-5 w-5 text-blue-600" />
                      Your Picks for Week {currentWeek}
                    </CardTitle>
                    <CardDescription>
                      Review your submitted picks for this week (picks are locked until
                      games start)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <RecentPicksViewer
                      poolId={poolId}
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
          ) : null}


          {/* Week Ended Message - Show when week has ended */}
          {weekEnded && (
            <Card className="bg-gray-50 border-gray-200">
              <CardContent className="p-6 text-center">
                <div className="text-gray-500 mb-4">
                  <Calendar className="h-12 w-12 mx-auto mb-2" />
                  <p className="text-lg font-medium">Week {currentWeek} Has Ended</p>
                  <p className="text-sm">Picks are no longer available for this week</p>
                </div>
                <div className="text-sm text-gray-600">
                  <p>The leaderboard above shows the final results for this week.</p>
                  <p>Check back next week for new picks!</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>



      {/* Recent Picks Section - Show when requested */}
      {showRecentPicks && (
        <Dialog open={showRecentPicks} onOpenChange={setShowRecentPicks}>
          <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl flex items-center gap-2">
                <Eye className="h-5 w-5 text-blue-600" />
                {selectedUser && hasSubmitted[selectedUser.id]?.submitted 
                  ? `${selectedUser.name}'s Submitted Picks for Week ${currentWeek}`
                  : `Submitted Picks for Week ${currentWeek}`
                }
              </DialogTitle>
              <DialogDescription>
                {selectedUser && hasSubmitted[selectedUser.id]?.submitted
                  ? `Review ${selectedUser.name}'s picks for this week`
                  : "Review all submitted picks for this week"
                }
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {selectedUser && hasSubmitted[selectedUser.id]?.submitted ? (
                // Show picks for the currently selected user
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold mb-2">User: {selectedUser.name}</h3>
                  <RecentPicksViewer
                    poolId={poolId}
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
                // Show all submitted picks
                Object.entries(hasSubmitted).map(([userId, data]) => {
                  if (!data.submitted) return null;
                  
                  return (
                    <div key={userId} className="p-4 border rounded-lg">
                      <h3 className="font-semibold mb-2">User: {data.name}</h3>
                      <RecentPicksViewer
                        poolId={poolId}
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
            <div className="flex justify-end pt-4">
              <Button onClick={() => setShowRecentPicks(false)}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl flex items-center gap-2">
              <Trophy className="h-5 w-5 text-green-500" />
              Picks Submitted Successfully!
            </DialogTitle>
            <DialogDescription className="text-sm sm:text-base">
              Your picks for Week {currentWeek} have been submitted. Best of luck!
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button onClick={() => setShowSuccessDialog(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function PoolPicksPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600">Loading...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    }>
      <PoolPicksContent />
    </Suspense>
  );
}
