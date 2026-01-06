'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Trophy, Calendar, Target, CheckCircle2, ChevronLeft, ChevronRight, Users, Share2, Eye, EyeOff, BarChart3, Clock, AlertTriangle, Crown, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PickUserSelection } from '@/components/picks/pick-user-selection';
import { Leaderboard } from '@/components/leaderboard/leaderboard';
import { SeasonLeaderboard } from '@/components/leaderboard/season-leaderboard';
import { loadUsers } from '@/actions/loadUsers';
import { userSessionManager } from '@/lib/user-session';
import { debugLog, getShortTeamName } from '@/lib/utils';
import { Game, Pick, SelectedUser, StoredPick } from '@/types/game';
import { pickStorage } from '@/lib/pick-storage';
import { getPlayoffConfidencePoints } from '@/lib/playoff-utils';
import { getUpcomingWeek } from '@/actions/loadCurrentWeek';

interface PlayoffRound {
  week: number;
  roundName: string;
  games: Game[];
}

interface RoundScore {
  week: number;
  points: number;
  correctPicks: number;
  totalPicks: number;
}

function PlayoffPicksContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const poolId = params.id as string;
  const { toast } = useToast();
  
  // Get round from URL parameter (1-4, default to round 1 if not specified)
  const roundParam = searchParams?.get('round');
  const selectedRound = roundParam ? parseInt(roundParam, 10) : null;
  
  // Validate round is 1-4, default to 1 if invalid or missing
  const currentRound = (selectedRound && selectedRound >= 1 && selectedRound <= 4) ? selectedRound : 1;

  const [poolName, setPoolName] = useState<string>('');
  const [poolSeason, setPoolSeason] = useState<number>(2025);
  const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null);
  const [teamSeeds, setTeamSeeds] = useState<Record<string, number>>({});
  const [games, setGames] = useState<Game[]>([]);
  const [playoffRounds, setPlayoffRounds] = useState<PlayoffRound[]>([]);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [roundScores, setRoundScores] = useState<RoundScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState<Record<number, boolean>>({});
  const [hasConfidencePoints, setHasConfidencePoints] = useState(false);
  const [allSubmittedRounds, setAllSubmittedRounds] = useState<Record<number, boolean>>({});
  const [showLeaderboard, setShowLeaderboard] = useState<Record<number, boolean>>({});
  const [superBowlTotalScore, setSuperBowlTotalScore] = useState<number | null>(null);
  const [userListKey, setUserListKey] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showGameDetails, setShowGameDetails] = useState(false);
  const [showQuickStats, setShowQuickStats] = useState(false);
  const [countdown, setCountdown] = useState<string>('');
  const [gamesStarted, setGamesStarted] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [submittedCount, setSubmittedCount] = useState(0);
  const [upcomingRound, setUpcomingRound] = useState<number>(1);
  const [roundWinners, setRoundWinners] = useState<Record<number, {
    participant_name: string;
    points: number;
    correct_picks: number;
    total_picks?: number;
  } | null>>({});
  const [showGamePicksPanel, setShowGamePicksPanel] = useState(true);
  const [leaderboardData, setLeaderboardData] = useState<Record<number, any[]>>({});
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);
  const [pendingRound, setPendingRound] = useState<number | null>(null);
  const [userConfirmed, setUserConfirmed] = useState(false);
  const [usersWithConfidencePointsCount, setUsersWithConfidencePointsCount] = useState(0);
  const [usersNeedingConfidencePoints, setUsersNeedingConfidencePoints] = useState(0);

  const roundNames: Record<number, string> = {
    1: 'Wild Card Round',
    2: 'Divisional Round',
    3: 'Conference Championships',
    4: 'Super Bowl',
  };

  const ROUND_GAME_COUNTS: Record<number, number> = {
    1: 6, // Wild Card
    2: 4, // Divisional Round
    3: 2, // Conference Championship
    4: 1  // Super Bowl
  };
  
  // Navigate to a specific round
  const navigateToRound = (round: number) => {
    if (round >= 1 && round <= 4) {
      router.push(`/pool/${poolId}/playoff-picks?round=${round}`);
    }
  };
  
  // Navigate to previous round
  const navigateToPreviousRound = () => {
    if (currentRound > 1) {
      navigateToRound(currentRound - 1);
    } else if (currentRound === 1) {
      // If at Wild Card (round 1), navigate to last week of regular season (week 18)
      router.push(`/pool/${poolId}/picks?week=18&seasonType=2`);
    }
  };
  
  // Navigate to next round
  const navigateToNextRound = () => {
    if (currentRound < 4) {
      navigateToRound(currentRound + 1);
    }
  };
  
  // Navigate to current round (upcoming playoff round)
  const navigateToCurrentRound = async () => {
    try {
      const upcomingWeek = await getUpcomingWeek();
      // If current week is a playoff week, navigate to that round
      if (upcomingWeek.seasonType === 3 && upcomingWeek.week >= 1 && upcomingWeek.week <= 4) {
        navigateToRound(upcomingWeek.week);
      } else {
        // If current week is regular season or preseason, navigate to picks page
        window.location.href = `/pool/${poolId}/picks?week=${upcomingWeek.week}&seasonType=${upcomingWeek.seasonType}`;
      }
    } catch (error) {
      console.error('Error getting current round:', error);
      // Fallback to round 1 (Wild Card)
      navigateToRound(1);
    }
  };

  useEffect(() => {
    // Redirect to round 1 if no round parameter is provided
    if (!roundParam) {
      router.replace(`/pool/${poolId}/playoff-picks?round=1`);
      return;
    }
    loadData();
  }, [poolId, currentRound, roundParam, router]);

  useEffect(() => {
    if (selectedUser && games.length > 0 && poolSeason) {
      checkConfidencePoints();
      loadPicks();
      loadRoundScores();
      // Load tie-breaker score for Super Bowl if viewing round 4
      if (currentRound === 4) {
        loadTieBreakerScore();
      }
    }
  }, [selectedUser, games, currentRound, poolSeason]);

  // Load picks from localStorage after picks are loaded from database
  useEffect(() => {
    if (selectedUser && picks.length > 0 && games.length > 0) {
      // Only load from localStorage if we don't have unsaved changes
      // This prevents overwriting database picks with stale localStorage data
      if (!hasUnsavedChanges) {
        loadPicksFromLocalStorage();
      }
    }
  }, [selectedUser, currentRound]); // Only trigger on user/round change, not picks change

  // Auto-save picks to localStorage when picks change (with debouncing)
  useEffect(() => {
    if (selectedUser && picks.length > 0 && hasUnsavedChanges) {
      // Only auto-save if we haven't already saved in the last second
      const now = Date.now();
      const lastSavedTime = lastSaved?.getTime() || 0;
      
      if (now - lastSavedTime > 1000) { // Only save if more than 1 second has passed
        // Only save picks for current round
        const currentRoundPicks = picks.filter(pick => {
          const game = games.find(g => g.id === pick.game_id);
          return game && game.week === currentRound && pick.predicted_winner && pick.predicted_winner.trim() !== '';
        });
        
        if (currentRoundPicks.length > 0) {
          const storedPicks: StoredPick[] = currentRoundPicks.map(pick => ({
            ...pick,
            timestamp: now
          }));
          
          pickStorage.savePicks(storedPicks, selectedUser.id, poolId, currentRound);
          setLastSaved(new Date(now));
          setHasUnsavedChanges(false);
          debugLog('💾 Auto-saved playoff picks to localStorage:', storedPicks.length, 'picks for round', currentRound);
        }
      }
    }
  }, [picks, selectedUser, poolId, currentRound, hasUnsavedChanges, lastSaved, games]);

  useEffect(() => {
    if (selectedUser && playoffRounds.length > 0) {
      checkAllSubmissions();
    }
  }, [selectedUser, playoffRounds]);

  const loadParticipantStats = async () => {
    try {
      // Get total participant count from pool API
      const poolResponse = await fetch(`/api/pools/${poolId}`);
      const poolData = await poolResponse.json();
      
      if (poolData.success && poolData.pool) {
        setParticipantCount(poolData.pool.participant_count || 0);
      }

      // Get current round games (only valid games with teams)
      const currentRoundGames = games.filter(g => 
        g.week === currentRound && 
        g.home_team && g.home_team.trim() !== '' && 
        g.away_team && g.away_team.trim() !== ''
      );

      if (currentRoundGames.length === 0) {
        setSubmittedCount(0);
        return;
      }

      // Get ALL participants in the pool (not filtered by confidence points or submissions)
      const { getSupabaseServiceClient } = await import('@/lib/supabase');
      const supabase = getSupabaseServiceClient();
      
      const { data: allParticipants, error: participantsError } = await supabase
        .from('participants')
        .select('id')
        .eq('pool_id', poolId)
        .eq('is_active', true);

      if (participantsError || !allParticipants || allParticipants.length === 0) {
        console.error('Error fetching participants:', participantsError);
        setSubmittedCount(0);
        return;
      }

      // Get playoff teams count to check confidence points submissions
      const { data: playoffTeams } = await supabase
        .from('playoff_teams')
        .select('id')
        .eq('season', poolSeason);
      
      const teamsCount = playoffTeams?.length || 0;

      // Get participants who have submitted confidence points
      const { data: confidenceSubmissions } = await supabase
        .from('playoff_confidence_points')
        .select('participant_id')
        .eq('pool_id', poolId)
        .eq('season', poolSeason);

      // Count confidence point submissions per participant
      const participantConfidenceCounts = new Map<string, number>();
      confidenceSubmissions?.forEach(sub => {
        const count = participantConfidenceCounts.get(sub.participant_id) || 0;
        participantConfidenceCounts.set(sub.participant_id, count + 1);
      });

      // Separate participants into those with and without confidence points
      const participantsWithConfidencePoints = allParticipants.filter(p => {
        const submissionCount = participantConfidenceCounts.get(p.id) || 0;
        return submissionCount === teamsCount && teamsCount > 0;
      });

      const participantsNeedingConfidencePoints = allParticipants.filter(p => {
        const submissionCount = participantConfidenceCounts.get(p.id) || 0;
        return submissionCount !== teamsCount || teamsCount === 0;
      });

      setUsersWithConfidencePointsCount(participantsWithConfidencePoints.length);
      setUsersNeedingConfidencePoints(participantsNeedingConfidencePoints.length);

      // Check how many participants have submitted picks for all games in current round
      // Only count participants who have submitted confidence points
      let submitted = 0;
      for (const participant of participantsWithConfidencePoints) {
        try {
          const response = await fetch(`/api/picks?poolId=${poolId}&participantId=${participant.id}&seasonType=3`);
          const data = await response.json();

          if (data.success && data.picks) {
            // Check if user has picks for all valid games in current round
            const roundPicks = data.picks.filter((pick: Pick) => 
              currentRoundGames.some(game => game.id === pick.game_id)
            );
            // User has submitted if they have picks with predicted winners for all games
            const hasAllPicks = roundPicks.length === currentRoundGames.length && 
                                roundPicks.every((pick: Pick) => pick.predicted_winner && pick.predicted_winner.trim() !== '');
            if (hasAllPicks) {
              submitted++;
            }
          }
        } catch (error) {
          console.error(`Error checking picks for participant ${participant.id}:`, error);
        }
      }

      setSubmittedCount(submitted);
    } catch (error) {
      console.error('Error loading participant stats:', error);
    }
  };

  // Load participant stats for current round
  useEffect(() => {
    loadParticipantStats();
  }, [poolId, currentRound, games, poolSeason]);

  const loadData = async () => {
    try {
      setIsLoading(true);

      // Load pool info
      const poolResponse = await fetch(`/api/pools/${poolId}`);
      const poolData = await poolResponse.json();
      
      if (poolData.success) {
        setPoolName(poolData.pool.name);
        setPoolSeason(poolData.pool.season);
        
        // Set participant count from pool data (all participants in pool)
        setParticipantCount(poolData.pool.participant_count || 0);
        
        // Load playoff teams to get seed mapping
        const teamsResponse = await fetch(`/api/playoffs/${poolId}/teams?season=${poolData.pool.season}`);
        const teamsData = await teamsResponse.json();
        
        if (teamsData.success && teamsData.teams) {
          const seeds: Record<string, number> = {};
          teamsData.teams.forEach((team: { team_name: string; seed: number }) => {
            seeds[team.team_name] = team.seed;
          });
          setTeamSeeds(seeds);
        }
      }

      // Load playoff games for the current round (round maps to week)
      // Round 1 = Wild Card (week 1), Round 2 = Divisional (week 2), etc.
      const gamesByRound: PlayoffRound[] = [];
      const weekToLoad = currentRound; // Round number maps directly to week number
      
      const response = await fetch(`/api/games/week?week=${weekToLoad}&seasonType=3&season=${poolData.pool?.season || 2025}`);
      const data = await response.json();
      debugLog('Playoff picks page: Loading games for week:', weekToLoad, 'season type:', 3, 'season:', poolData.pool.season);
      debugLog('Playoff picks page: Data:', data);
      
      if (data.success && data.games) {
        debugLog('Playoff picks page: Games loaded:', data.games.length, 'games');
        debugLog('Playoff picks page: Sample game:', data.games[0]);
        gamesByRound.push({
          week: weekToLoad,
          roundName: roundNames[weekToLoad] || `Round ${weekToLoad}`,
          games: data.games || []
        });
      } else {
        debugLog('Playoff picks page: No games returned or API error', data);
      }

      debugLog('Playoff picks page: Games by round:', gamesByRound);
      setPlayoffRounds(gamesByRound);
      const allGames = gamesByRound.flatMap(round => round.games);
      setGames(allGames);
      setLastUpdated(new Date());

      // Check if games have started for the current round
      const currentRoundGames = allGames.filter(g => g.week === currentRound);
      if (currentRoundGames.length > 0) {
        const now = new Date();
        const hasStarted = currentRoundGames.some((game: Game) => {
          const gameTime = new Date(game.kickoff_time);
          const bufferTime = 60 * 60 * 1000; // 1 hour in milliseconds
          return (gameTime.getTime() + bufferTime) <= now.getTime();
        });
        setGamesStarted(hasStarted);
      } else {
        setGamesStarted(false);
      }

      // Load upcoming round for current round button
      try {
        const upcomingWeek = await getUpcomingWeek();
        if (upcomingWeek.seasonType === 3 && upcomingWeek.week >= 1 && upcomingWeek.week <= 4) {
          setUpcomingRound(upcomingWeek.week);
        } else {
          setUpcomingRound(1); // Default to Wild Card
        }
      } catch (error) {
        console.error('Error getting upcoming round:', error);
        setUpcomingRound(1);
      }

    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load playoff data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${poolName} - ${roundNames[currentRound]} Picks`,
          text: `Join me in making picks for ${poolName} ${roundNames[currentRound]}!`,
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

  const getGameStatusStats = () => {
    const currentRoundGames = games.filter(g => g.week === currentRound);
    // Use expected game count for the round, not just the actual games that exist
    const expectedGameCount = ROUND_GAME_COUNTS[currentRound] || currentRoundGames.length;
    
    const now = new Date();
    const stats = {
      total: expectedGameCount, // Show expected count for the round
      upcoming: 0,
      inProgress: 0,
      finished: 0,
      locked: 0
    };

    currentRoundGames.forEach(game => {
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

  const checkConfidencePoints = async (userId?: string) => {
    // Use provided userId or fall back to selectedUser
    const userToCheck = userId || selectedUser?.id;
    if (!userToCheck) return;

    // Always fetch the pool season fresh to ensure we have the correct value
    // This avoids issues with stale state when navigating between rounds
    let seasonToUse = poolSeason;
    try {
      const poolResponse = await fetch(`/api/pools/${poolId}`);
      const poolData = await poolResponse.json();
      if (poolData.success && poolData.pool?.season) {
        seasonToUse = poolData.pool.season;
        // Update state if it's different
        if (seasonToUse !== poolSeason) {
          setPoolSeason(seasonToUse);
        }
      } else {
        console.error('Could not get pool season from API');
        // Fall back to current poolSeason state if API fails
        if (!seasonToUse) {
          return; // Don't check if we don't have a season
        }
      }
    } catch (error) {
      console.error('Error fetching pool season:', error);
      // Fall back to current poolSeason state if API fails
      if (!seasonToUse) {
        return; // Don't check if we don't have a season
      }
    }

    try {
      const response = await fetch(`/api/playoffs/${poolId}/confidence-points?season=${seasonToUse}&participantId=${userToCheck}`);
      const data = await response.json();
      
      if (data.success) {
        setHasConfidencePoints(data.hasSubmission || false);
        debugLog('Confidence points check result:', { 
          participantId: userToCheck, 
          season: seasonToUse, 
          hasSubmission: data.hasSubmission,
          currentRound
        });
      } else {
        console.error('Error checking confidence points - API returned error:', data.error);
        setHasConfidencePoints(false);
      }
    } catch (error) {
      console.error('Error checking confidence points:', error);
      setHasConfidencePoints(false);
    }
  };

  const loadPicksFromLocalStorage = async () => {
    if (!selectedUser || games.length === 0) return;

    try {
      // Check if there are stored picks for this user, pool, and round (week)
      if (pickStorage.hasValidPicks(selectedUser.id, poolId, currentRound)) {
        const storedPicks = pickStorage.loadPicks(selectedUser.id, poolId, currentRound);
        
        if (storedPicks && storedPicks.length > 0) {
          debugLog('📂 Loaded playoff picks from localStorage for round', currentRound, ':', storedPicks);
          
          // Get current round games
          const currentRoundGames = games.filter(g => g.week === currentRound);
          const validGameIds = new Set(currentRoundGames.map(g => g.id));
          
          // Merge stored picks with current picks state
          setPicks(prevPicks => {
            const picksMap = new Map(prevPicks.map(p => [p.game_id, p]));
            
            // Restore picks from localStorage for current round only
            storedPicks.forEach((storedPick: StoredPick) => {
              // Only restore picks for games that exist and are in the current round
              if (validGameIds.has(storedPick.game_id) && storedPick.predicted_winner) {
                picksMap.set(storedPick.game_id, {
                  participant_id: storedPick.participant_id,
                  pool_id: storedPick.pool_id,
                  game_id: storedPick.game_id,
                  predicted_winner: storedPick.predicted_winner || '',
                  confidence_points: storedPick.confidence_points || 0
                });
              }
            });
            
            // Ensure all current round games have picks
            currentRoundGames.forEach(game => {
              if (!picksMap.has(game.id)) {
                picksMap.set(game.id, {
                  participant_id: selectedUser.id,
                  pool_id: poolId,
                  game_id: game.id,
                  predicted_winner: '',
                  confidence_points: 0
                });
              }
            });
            
            const restoredPicks = Array.from(picksMap.values()).filter(p => {
              const game = currentRoundGames.find(g => g.id === p.game_id);
              return game && p.predicted_winner && p.predicted_winner.trim() !== '';
            });
            
            if (restoredPicks.length > 0) {
              setHasUnsavedChanges(false);
              setLastSaved(new Date(storedPicks[0]?.timestamp || Date.now()));
              
              toast({
                title: 'Picks Restored',
                description: `Loaded ${restoredPicks.length} saved picks from your previous session`,
              });
            }
            
            return Array.from(picksMap.values());
          });
        }
      }
    } catch (error) {
      console.error('Error loading picks from localStorage:', error);
    }
  };

  const loadPicks = async () => {
    if (!selectedUser) return;

    try {
      const response = await fetch(`/api/picks?poolId=${poolId}&participantId=${selectedUser.id}&seasonType=3`);
      const data = await response.json();

      if (data.success && data.picks) {
        // Filter picks for current round only
        const roundPicks = data.picks.filter((p: Pick) => {
          const game = games.find(g => g.id === p.game_id);
          return game && game.week === currentRound;
        });
        
        setPicks(roundPicks);
        
        // Initialize picks for games that don't have picks yet (current round only)
        const existingGameIds = new Set(roundPicks.map((p: Pick) => p.game_id));
        const roundGames = games.filter(g => g.week === currentRound);
        const newPicks: Pick[] = roundGames
          .filter(game => !existingGameIds.has(game.id))
          .map(game => ({
            participant_id: selectedUser.id,
            pool_id: poolId,
            game_id: game.id,
            predicted_winner: '',
            confidence_points: 0
          }));
        
        setPicks([...roundPicks, ...newPicks]);

        // Check which rounds have been submitted
        const submittedWeeks = new Set<number>();
        games.forEach(game => {
          const pick = data.picks.find((p: Pick) => p.game_id === game.id);
          if (pick && pick.predicted_winner && game.week) {
            submittedWeeks.add(game.week);
          }
        });
        
        const submittedMap: Record<number, boolean> = {};
        submittedWeeks.forEach(week => {
          submittedMap[week] = true;
        });
        setHasSubmitted(submittedMap);
      }
    } catch (error) {
      console.error('Error loading picks:', error);
    }
  };

  const loadTieBreakerScore = async () => {
    if (!selectedUser) return;

    try {
      // First try to load from localStorage
      try {
        const storageKey = `playoff_picks_superbowl_${selectedUser.id}_${poolId}`;
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const data = JSON.parse(stored);
          if (data.score !== null && data.score !== undefined) {
            setSuperBowlTotalScore(data.score);
            debugLog('📂 Loaded Super Bowl score from localStorage:', data.score);
            return;
          }
        }
      } catch (error) {
        console.error('Error loading Super Bowl score from localStorage:', error);
      }
      
      // Load tie-breaker for Super Bowl (week 4, season_type 3) from database
      const response = await fetch(`/api/tie-breakers?poolId=${poolId}&participantId=${selectedUser.id}&week=4&seasonType=3&season=${poolSeason}`);
      const data = await response.json();

      if (data.success && data.tieBreakers && data.tieBreakers.length > 0) {
        const tieBreaker = data.tieBreakers[0];
        if (tieBreaker.answer !== null && tieBreaker.answer !== undefined) {
          setSuperBowlTotalScore(parseFloat(tieBreaker.answer));
        }
      }
    } catch (error) {
      console.error('Error loading tie-breaker score:', error);
    }
  };

  const loadRoundScores = async () => {
    if (!selectedUser) return;

    try {
      // Load scores for each playoff week
      const scores: RoundScore[] = [];
      for (let week = 1; week <= 4; week++) {
        try {
          const response = await fetch(`/api/scores?poolId=${poolId}&participantId=${selectedUser.id}&week=${week}&seasonType=3&season=${poolSeason}`);
          const data = await response.json();

          if (data.success && data.scores && data.scores.length > 0) {
            const score = data.scores[0];
            scores.push({
              week,
              points: score.points || 0,
              correctPicks: score.correct_picks || 0,
              totalPicks: score.total_picks || 0
            });
          } else {
            scores.push({
              week,
              points: 0,
              correctPicks: 0,
              totalPicks: 0
            });
          }
        } catch (error) {
          console.error(`Error loading score for week ${week}:`, error);
          scores.push({
            week,
            points: 0,
            correctPicks: 0,
            totalPicks: 0
          });
        }
      }
      setRoundScores(scores);
    } catch (error) {
      console.error('Error loading round scores:', error);
    }
  };

  // Load leaderboard data and extract winners when debug mode is enabled or game picks panel is hidden
  useEffect(() => {
    const loadLeaderboardData = async () => {
      if ((!debugMode && showGamePicksPanel) || !poolId || !poolSeason) return;

      try {
        const winnersMap: Record<number, {
          participant_name: string;
          points: number;
          correct_picks: number;
          total_picks: number;
        }> = {};
        const leaderboardMap: Record<number, any[]> = {};
        
        // Load leaderboard data for each round
        for (let week = 1; week <= 4; week++) {
          try {
            const response = await fetch(`/api/leaderboard?poolId=${poolId}&week=${week}&seasonType=3&season=${poolSeason}`);
            const data = await response.json();
            
            if (data.success && data.leaderboard && data.leaderboard.length > 0) {
              // Store leaderboard data
              leaderboardMap[week] = data.leaderboard;
              
              // Extract winner (first place) from leaderboard
              const winner = data.leaderboard[0];
              if (winner) {
                winnersMap[week] = {
                  participant_name: winner.participant_name || 'Unknown',
                  points: winner.total_points || 0,
                  correct_picks: winner.correct_picks || 0,
                  total_picks: winner.total_picks || 0
                };
              }
            }
          } catch (error) {
            console.error(`Error loading leaderboard for week ${week}:`, error);
          }
        }
        
        setLeaderboardData(leaderboardMap);
        setRoundWinners(winnersMap);
        
        // In debug mode or when panel is hidden, show leaderboard for all rounds
        if (debugMode || !showGamePicksPanel) {
          const showLeaderboardMap: Record<number, boolean> = {};
          for (let week = 1; week <= 4; week++) {
            showLeaderboardMap[week] = true;
          }
          setShowLeaderboard(showLeaderboardMap);
        }
      } catch (error) {
        console.error('Error loading leaderboard data:', error);
      }
    };

    loadLeaderboardData();
  }, [debugMode, showGamePicksPanel, poolId, poolSeason]);

  const checkAllSubmissions = async () => {
    try {
      // Skip if debug mode is enabled (we already set showLeaderboard in the debug effect)
      if (debugMode) return;

      // Get all participants
      const users = await loadUsers(poolId);
      if (!users || users.length === 0) return;

      // Check each round to see if all participants have submitted
      const allSubmittedMap: Record<number, boolean> = {};
      const showLeaderboardMap: Record<number, boolean> = {};

      for (let week = 1; week <= 4; week++) {
        const roundGames = playoffRounds.find(r => r.week === week)?.games || [];
        // Only check games where teams have been determined
        const validGames = roundGames.filter(game => 
          game.home_team && game.home_team.trim() !== '' && 
          game.away_team && game.away_team.trim() !== ''
        );

        if (validGames.length === 0) {
          continue; // Skip rounds with no valid games
        }

        // Check if all participants have submitted picks for this round
        const participantSubmissionStatus = await Promise.all(
          users.map(async (user) => {
            try {
              const response = await fetch(`/api/picks?poolId=${poolId}&participantId=${user.id}&seasonType=3`);
              const data = await response.json();

              if (data.success && data.picks) {
                // Check if user has picks for all valid games in this round
                const roundPicks = data.picks.filter((pick: Pick) => 
                  validGames.some(game => game.id === pick.game_id)
                );
                // All games must have picks with predicted winners
                return roundPicks.length === validGames.length && 
                       roundPicks.every((pick: Pick) => pick.predicted_winner && pick.predicted_winner.trim() !== '');
              }
              return false;
            } catch (error) {
              console.error(`Error checking submissions for user ${user.id}:`, error);
              return false;
            }
          })
        );

        const allSubmitted = participantSubmissionStatus.every(status => status);
        allSubmittedMap[week] = allSubmitted;
        showLeaderboardMap[week] = allSubmitted;
      }

      setAllSubmittedRounds(allSubmittedMap);
      setShowLeaderboard(showLeaderboardMap);
    } catch (error) {
      console.error('Error checking all submissions:', error);
    }
  };

  const handleUserSelected = async (userId: string, userName: string) => {
    setSelectedUser({ id: userId, name: userName });
    userSessionManager.createSession(userId, userName, poolId, '');
    // Clear any previously stored picks when selecting a new user
    pickStorage.clearPicks();
    setHasUnsavedChanges(false);
    setLastSaved(null);
    
    // Reset hasConfidencePoints and check immediately for the new user
    setHasConfidencePoints(false);
    // Check confidence points right away for the newly selected user
    await checkConfidencePoints(userId);
  };

  const handlePickChange = (gameId: string, winner: string) => {
    if (!selectedUser) return;
    

    setPicks(prevPicks => {
      const updatedPicks = prevPicks.map(pick => {
        if (pick.game_id === gameId) {
          return { ...pick, predicted_winner: winner };
        }
        return pick;
      });

      // If this is a new pick, add it
      if (!prevPicks.find(p => p.game_id === gameId)) {
        updatedPicks.push({
          participant_id: selectedUser.id,
          pool_id: poolId,
          game_id: gameId,
          predicted_winner: winner,
          confidence_points: 0 // Will be calculated from playoff confidence points
        });
      }

      setHasUnsavedChanges(true);
      
      // Immediately save to localStorage
      const storedPicks: StoredPick[] = updatedPicks
        .filter(pick => pick.predicted_winner && pick.predicted_winner.trim() !== '')
        .map(pick => ({
          ...pick,
          timestamp: Date.now()
        }));
      
      if (storedPicks.length > 0) {
        pickStorage.savePicks(storedPicks, selectedUser.id, poolId, currentRound);
        setLastSaved(new Date());
        debugLog('💾 Saved playoff pick to localStorage');
      }

      return updatedPicks;
    });
  };

  // Generate random picks for all games in current round (debug only)
  const generateRandomPicks = () => {
    if (!selectedUser) {
      toast({
        title: 'Error',
        description: 'Please select a user first',
        variant: 'destructive',
      });
      return;
    }

    const currentRoundGames = games.filter(g => 
      g.week === currentRound && 
      g.home_team && g.home_team.trim() !== '' && 
      g.away_team && g.away_team.trim() !== ''
    );

    if (currentRoundGames.length === 0) {
      toast({
        title: 'Error',
        description: 'No games available for the current round',
        variant: 'destructive',
      });
      return;
    }

    const randomPicks: Pick[] = currentRoundGames.map(game => {
      // Randomly pick home or away team
      const winner = Math.random() < 0.5 ? game.away_team : game.home_team;
      return {
        participant_id: selectedUser.id,
        pool_id: poolId,
        game_id: game.id,
        predicted_winner: winner,
        confidence_points: 0 // Will be calculated from playoff confidence points
      };
    });

    setPicks(prevPicks => {
      const picksMap = new Map(prevPicks.map(p => [p.game_id, p]));
      randomPicks.forEach(pick => {
        picksMap.set(pick.game_id, pick);
      });
      return Array.from(picksMap.values());
    });

    setHasUnsavedChanges(true);
    
    // Save to localStorage
    const storedPicks: StoredPick[] = randomPicks.map(pick => ({
      ...pick,
      timestamp: Date.now()
    }));
    pickStorage.savePicks(storedPicks, selectedUser.id, poolId, currentRound);
    setLastSaved(new Date());

    // For Super Bowl, also generate random total score
    if (currentRound === 4) {
      const randomScore = Math.floor(Math.random() * 81) + 20; // Random score between 20-100
      setSuperBowlTotalScore(randomScore);
      try {
        const storageKey = `playoff_picks_superbowl_${selectedUser.id}_${poolId}`;
        localStorage.setItem(storageKey, JSON.stringify({
          score: randomScore,
          timestamp: Date.now()
        }));
      } catch (error) {
        console.error('Error saving Super Bowl score to localStorage:', error);
      }
    }

    toast({
      title: 'Random Picks Generated',
      description: `Random picks assigned to all ${currentRoundGames.length} games in ${roundNames[currentRound]}`,
    });
  };

  const handleSubmitRound = async (week: number) => {
    if (!selectedUser) {
      toast({
        title: 'Error',
        description: 'Please select a user first',
        variant: 'destructive',
      });
      return;
    }

    const allRoundGames = playoffRounds.find(r => r.week === week)?.games || [];
    
    // Only include games where teams have been determined (valid games) - TBD games are treated as non-existent
    const roundGames = allRoundGames.filter(game => {
      const hasHomeTeam = game.home_team && game.home_team.trim() !== '' && game.home_team.trim() !== 'TBD';
      const hasAwayTeam = game.away_team && game.away_team.trim() !== '' && game.away_team.trim() !== 'TBD';
      const isPlaceholder = 'isPlaceholder' in game && game.isPlaceholder;
      return hasHomeTeam && hasAwayTeam && !isPlaceholder;
    });
    const roundPicks = picks.filter(pick => roundGames.some(g => g.id === pick.game_id));
    
    // Use only valid games (TBD games are treated as non-existent)
    // No need to validate against expected count - only validate against actual valid games

    // Validate that all games have picks
    const missingPicks = roundGames.filter(game => {
      const pick = roundPicks.find(p => p.game_id === game.id);
      return !pick || !pick.predicted_winner;
    });

    if (missingPicks.length > 0) {
      toast({
        title: 'Validation Error',
        description: `Please select winners for all games in ${roundNames[week]}`,
        variant: 'destructive',
      });
      return;
    }

    // For Super Bowl (round 4), validate tie-breaker score
    if (week === 4) {
      if (superBowlTotalScore === null || superBowlTotalScore === undefined) {
        toast({
          title: 'Validation Error',
          description: 'Please enter your prediction for the total points scored in the Super Bowl for tie-breaking purposes',
          variant: 'destructive',
        });
        return;
      }
      
      if (superBowlTotalScore < 0 || superBowlTotalScore > 100) {
        toast({
          title: 'Validation Error',
          description: 'Total score must be between 0 and 100',
          variant: 'destructive',
        });
        return;
      }
    }

    // Show confirmation dialog instead of submitting directly
    setPendingRound(week);
    setUserConfirmed(false); // Reset confirmation checkbox
    setShowConfirmationDialog(true);
  };

  const confirmSubmitRound = async () => {
    if (!selectedUser || pendingRound === null) {
      return;
    }

    const week = pendingRound;
    setShowConfirmationDialog(false);
    setIsSubmitting(true);

    try {
      const allRoundGames = playoffRounds.find(r => r.week === week)?.games || [];
      
      // Only include games where teams have been determined (valid games) - TBD games are treated as non-existent
      const roundGames = allRoundGames.filter(game => {
        const hasHomeTeam = game.home_team && game.home_team.trim() !== '' && game.home_team.trim() !== 'TBD';
        const hasAwayTeam = game.away_team && game.away_team.trim() !== '' && game.away_team.trim() !== 'TBD';
        const isPlaceholder = 'isPlaceholder' in game && game.isPlaceholder;
        return hasHomeTeam && hasAwayTeam && !isPlaceholder;
      });
      const roundPicks = picks.filter(pick => roundGames.some(g => g.id === pick.game_id));

      // Prepare picks with all required fields
      const picksToSubmit = roundPicks
        .filter((pick: Pick) => pick.predicted_winner && pick.predicted_winner.trim() !== '')
        .map((pick: Pick) => ({
          participant_id: selectedUser.id,
          pool_id: poolId,
          game_id: pick.game_id,
          predicted_winner: pick.predicted_winner,
          // For playoff games, confidence_points is stored but scoring uses playoff_confidence_points table
          // Set a placeholder value that will be ignored during scoring
          confidence_points: 1
        }));

      debugLog('Playoff picks page: Submitting picks:', picksToSubmit);

      // Include tie-breaker score for Super Bowl (round 4)
    const mondayNightScore = week === 4 ? superBowlTotalScore : null;
    
    // Save picks to localStorage before submission as backup
    if (selectedUser) {
      const storedPicks: StoredPick[] = picksToSubmit.map((pick: any) => ({
        ...pick,
        timestamp: Date.now()
      }));
      pickStorage.savePicks(storedPicks, selectedUser.id, poolId, week);
    }

      const response = await fetch('/api/picks/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          picks: picksToSubmit,
          mondayNightScore: mondayNightScore
        }),
      });

      const data = await response.json();
      
      debugLog('Playoff picks page: Submit response:', data);

      if (data.success) {
        // Show success dialog
        setShowSuccessDialog(true);
        
        setHasSubmitted(prev => ({ ...prev, [week]: true }));
        await loadRoundScores();
        await loadPicks(); // Reload picks to get updated state
        
        // Clear localStorage picks for this round after successful submission
        pickStorage.clearPicks();
        setHasUnsavedChanges(false);
        setLastSaved(null);
        
        // Clear Super Bowl score from localStorage if submitted
        if (week === 4) {
          try {
            const storageKey = `playoff_picks_superbowl_${selectedUser.id}_${poolId}`;
            localStorage.removeItem(storageKey);
          } catch (error) {
            console.error('Error clearing Super Bowl score from localStorage:', error);
          }
        }
        
        // Clear selected user so they are removed from the list and can select a different user
        const submittedUserId = selectedUser.id;
        setSelectedUser(null);
        userSessionManager.removeSession(submittedUserId, poolId);
        // Force reload of user list by updating key
        setUserListKey(prev => prev + 1);
        // Recheck all submissions after a successful submission
        if (playoffRounds.length > 0) {
          await checkAllSubmissions();
        }
        // Reload participant stats to update the counts
        await loadParticipantStats();
      } else {
        console.error('Submit error:', data.error);
        toast({
          title: 'Error',
          description: data.error || 'Failed to submit picks',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error submitting picks:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit picks',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
      setPendingRound(null);
    }
  };

  const getRoundScore = (week: number): RoundScore => {
    return roundScores.find(score => score.week === week) || {
      week,
      points: 0,
      correctPicks: 0,
      totalPicks: 0
    };
  };


  // Countdown timer effect
  useEffect(() => {
    const currentRoundGames = games.filter(g => g.week === currentRound);
    if (currentRoundGames.length === 0) {
      setCountdown('');
      return;
    }

    const timer = setInterval(() => {
      // Find the first game for the current round
      const firstGame = currentRoundGames[0];
      if (!firstGame) {
        setCountdown('');
        return;
      }

      const gameTime = new Date(firstGame.kickoff_time);
      const now = new Date();
      const timeDiff = gameTime.getTime() - now.getTime();
      
      if (timeDiff <= 0) {
        setCountdown('Games Started');
        setGamesStarted(true);
        return;
      }
      
      setGamesStarted(false);
      
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
  }, [games, currentRound]);

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!selectedUser) {
    return (
      <div className="container mx-auto p-4 sm:p-6">
        <div className="mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/pool/${poolId}/playoffs`)}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Playoff Confidence Points
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold">{poolName} - Playoff Picks</h1>
          <p className="text-gray-600">Season {poolSeason || '...'}</p>
        </div>
        <PickUserSelection
          key={`${poolId}-${currentRound}-${userListKey}`}
          poolId={poolId}
          weekNumber={currentRound}
          seasonType={3}
          onUserSelected={handleUserSelected}
          usersNeedingConfidencePoints={usersNeedingConfidencePoints}
          poolSeason={poolSeason}
        />
      </div>
    );
  }

  // Only show confidence points required card if a user is selected and they haven't submitted confidence points
  if (selectedUser && !hasConfidencePoints) {
    return (
      <div className="container mx-auto p-4 sm:p-6">
        <div className="mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/pool/${poolId}/playoffs`)}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Playoff Confidence Points
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold">{poolName} - Playoff Picks</h1>
          <p className="text-gray-600">Season {poolSeason || '...'}</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Confidence Points Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              You must submit your playoff confidence points before you can make playoff picks.
            </p>
            <Button
              onClick={() => router.push(`/pool/${poolId}/playoffs`)}
              className="w-full"
            >
              Go to Playoffs Page
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
            <div className="flex items-center gap-4">
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
                  <Badge variant="outline">{roundNames[currentRound]}</Badge>
                  <span className="text-sm text-gray-500">
                    {games.filter(g => g.week === currentRound).length} games
                  </span>
                </div>

                {/* Round Navigation */}
                <div className="flex items-center justify-center gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={navigateToPreviousRound}
                    className="flex items-center gap-1 px-3 py-2 h-9"
                    title={currentRound === 1 ? "Go to last week of regular season" : "Go to previous round"}
                  >
                    <ChevronLeft className="h-3 w-3" />
                    <span className="hidden xs:inline">Previous Round</span>
                    <span className="xs:hidden">Prev</span>
                  </Button>
                  
                  <Button
                    variant={currentRound === upcomingRound ? "default" : "outline"}
                    size="sm"
                    onClick={navigateToCurrentRound}
                    className={`flex items-center gap-1 px-3 py-2 h-9 ${
                      currentRound === upcomingRound 
                        ? "bg-blue-600 text-white hover:bg-blue-700" 
                        : ""
                    }`}
                    title="Go to current/upcoming round"
                  >
                    <Calendar className="h-3 w-3" />
                    <span className="hidden xs:inline">Current Round</span>
                    <span className="xs:hidden">Current</span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={navigateToNextRound}
                    disabled={currentRound === 4}
                    className="flex items-center gap-1 px-3 py-2 h-9"
                    title={currentRound === 4 ? "Already at last round" : "Go to next round"}
                  >
                    <span className="hidden xs:inline">Next Round</span>
                    <span className="xs:hidden">Next</span>
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>

                {/* Round Selector Buttons */}
                <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                  <Button
                    variant={currentRound === 1 ? "default" : "outline"}
                    size="sm"
                    onClick={() => navigateToRound(1)}
                    className="text-xs"
                  >
                    Wild Card
                  </Button>
                  <Button
                    variant={currentRound === 2 ? "default" : "outline"}
                    size="sm"
                    onClick={() => navigateToRound(2)}
                    className="text-xs"
                  >
                    Divisional
                  </Button>
                  <Button
                    variant={currentRound === 3 ? "default" : "outline"}
                    size="sm"
                    onClick={() => navigateToRound(3)}
                    className="text-xs"
                  >
                    Conference
                  </Button>
                  <Button
                    variant={currentRound === 4 ? "default" : "outline"}
                    size="sm"
                    onClick={() => navigateToRound(4)}
                    className="text-xs"
                  >
                    Super Bowl
                  </Button>
                </div>

                {lastUpdated && (
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    Last updated: {lastUpdated.toLocaleTimeString()}
                  </div>
                )}
              </div>
              
              <div className="flex flex-col lg:flex-row items-center gap-4">
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

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/pool/${poolId}/playoffs`)}
                    className="flex items-center gap-2 min-w-fit px-3 py-2"
                  >
                    <Target className="h-4 w-4" />
                    <span className="hidden md:inline">Confidence Points</span>
                    <span className="md:hidden">Points</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Debug Mode Checkboxes - Only visible in development */}
            {process.env.NODE_ENV === 'development' && (
              <div className="flex flex-col gap-3 mt-4 p-3 bg-gray-50 rounded-lg border">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="debug-mode"
                    checked={debugMode}
                    onCheckedChange={(checked) => setDebugMode(checked === true)}
                  />
                  <Label htmlFor="debug-mode" className="text-sm font-medium cursor-pointer">
                    Debug Mode: Show simulated leaderboard (assumes all users submitted and games have winners)
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="show-game-picks"
                    checked={showGamePicksPanel}
                    onCheckedChange={(checked) => {
                      const isChecked = checked === true;
                      setShowGamePicksPanel(isChecked);
                      
                      // When unchecked, automatically show leaderboard with calculated winners
                      if (!isChecked) {
                        // Enable leaderboard for current round
                        setShowLeaderboard(prev => ({
                          ...prev,
                          [currentRound]: true
                        }));
                        
                        // Enable debug mode to calculate and show winners in leaderboard
                        // This will trigger the useEffect to load leaderboard data
                        setDebugMode(true);
                      } else {
                        // When checked again, optionally disable debug mode if needed
                        // For now, keep debug mode as-is to maintain consistency
                      }
                    }}
                  />
                  <Label htmlFor="show-game-picks" className="text-sm font-medium cursor-pointer">
                    Show Game Picks Panel
                    {!showGamePicksPanel && (
                      <span className="text-gray-500 ml-1 text-xs">
                        (Hiding panel shows leaderboard with calculated winners)
                      </span>
                    )}
                  </Label>
                </div>
                {selectedUser && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={generateRandomPicks}
                    className="w-full bg-purple-50 border-purple-300 text-purple-700 hover:bg-purple-100"
                  >
                    🎲 Generate Random Picks for {roundNames[currentRound]}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

      {/* Debug Info - Only show in development */}
      {process.env.NODE_ENV === 'development' && (
        <Card className="bg-blue-50 border-blue-200 mb-6">
          <CardHeader>
            <CardTitle className="text-blue-900 text-sm">Debug Info</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-blue-800 space-y-1">
            <p><strong>Current Round:</strong> {currentRound} - {roundNames[currentRound]}</p>
            <p><strong>Pool ID:</strong> {poolId || 'None'}</p>
            <p><strong>Pool Season:</strong> {poolSeason}</p>
            <p><strong>Games Count:</strong> {games.length}</p>
            <p><strong>Playoff Rounds:</strong> {playoffRounds.length}</p>
            <p><strong>Selected User:</strong> {selectedUser ? `${selectedUser.name} (${selectedUser.id})` : 'None'}</p>
            <p><strong>Has Confidence Points:</strong> {hasConfidencePoints ? 'Yes' : 'No'}</p>
            <p><strong>Has Submitted (by round):</strong> {JSON.stringify(hasSubmitted)}</p>
            <p><strong>Show Leaderboard (by round):</strong> {JSON.stringify(showLeaderboard)}</p>
            <p><strong>Debug Mode:</strong> {debugMode ? 'Yes' : 'No'}</p>
            <p><strong>Super Bowl Total Score:</strong> {superBowlTotalScore !== null ? superBowlTotalScore : 'Not set'}</p>
            <p><strong>Is Loading:</strong> {isLoading ? 'Yes' : 'No'}</p>
            <p><strong>Is Submitting:</strong> {isSubmitting ? 'Yes' : 'No'}</p>
            <p><strong>Current Time:</strong> {new Date().toISOString()}</p>
          </CardContent>
        </Card>
      )}

        {/* Main Content */}
        <div className="space-y-6">
          {/* Quick Stats */}
          {showQuickStats && (
            <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-900">
                  <Users className="h-5 w-5" />
                  Pool Statistics - {roundNames[currentRound]}
                </CardTitle>
                <CardDescription className="text-green-700">
                  Current participation and submission status for {roundNames[currentRound]}
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
          {showGameDetails && games.filter(g => g.week === currentRound).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  {roundNames[currentRound]} Game Details
                </CardTitle>
                <CardDescription>
                  Detailed view of all games and their status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {games.filter(g => g.week === currentRound).map((game, index) => {
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

      {/* Playoff Rounds */}
      {playoffRounds.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Games Available</CardTitle>
            <CardDescription>
              No games have been loaded for round {currentRound}. Please check that games exist for this round in the database.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-6">
            {playoffRounds.map(round => {
              const roundScore = getRoundScore(round.week);
              const roundSubmitted = hasSubmitted[round.week];
              
              debugLog('Playoff picks page: Round', round.week, 'has', round.games?.length || 0, 'total games');
              debugLog('Playoff picks page: Sample game from round:', round.games?.[0]);
              
              // Separate valid games from TBD games
              const existingGames = round.games || [];
              const validGames = existingGames.filter(game => {
                const hasHomeTeam = game.home_team && game.home_team.trim() !== '' && game.home_team.trim() !== 'TBD';
                const hasAwayTeam = game.away_team && game.away_team.trim() !== '' && game.away_team.trim() !== 'TBD';
                const isPlaceholder = 'isPlaceholder' in game && game.isPlaceholder;
                return hasHomeTeam && hasAwayTeam && !isPlaceholder;
              });
              
              const tbdGames = existingGames.filter(game => {
                const hasHomeTeam = game.home_team && game.home_team.trim() !== '' && game.home_team.trim() !== 'TBD';
                const hasAwayTeam = game.away_team && game.away_team.trim() !== '' && game.away_team.trim() !== 'TBD';
                const isPlaceholder = 'isPlaceholder' in game && game.isPlaceholder;
                return (!hasHomeTeam || !hasAwayTeam) || isPlaceholder;
              });
              
              debugLog('Playoff picks page: Round', round.week, '- Valid games:', validGames.length, 'TBD games:', tbdGames.length);
              
              return (
                <React.Fragment key={round.week}>
                  {showGamePicksPanel && (
                    <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {round.roundName}
                          {roundSubmitted && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Submitted
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription>
                          {validGames.length} game{validGames.length !== 1 ? 's' : ''} available
                          {tbdGames.length > 0 && (
                            <span className="text-gray-500 ml-1">
                              ({tbdGames.length} game{tbdGames.length !== 1 ? 's' : ''} TBD)
                            </span>
                          )}
                        </CardDescription>
                      </div>
                      {roundScore.totalPicks > 0 && (
                        <div className="text-right">
                          <div className="text-2xl font-bold text-blue-600">{roundScore.points}</div>
                          <div className="text-sm text-gray-600">
                            {roundScore.correctPicks}/{roundScore.totalPicks} correct
                          </div>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Valid games (with teams assigned) */}
                      {validGames.map((game, index) => {
                        const pick = picks.find(p => p.game_id === game.id);
                        const isLocked = game.status === 'final' || game.status === 'post';
                        
                        return (
                          <Card key={game.id} className={isLocked ? 'opacity-75' : ''}>
                            <CardHeader>
                              <CardTitle className="flex items-center justify-between">
                                <span>Game {index + 1}</span>
                                {isLocked && <Badge variant="secondary">Locked</Badge>}
                              </CardTitle>
                              <CardDescription>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {teamSeeds[game.away_team] && (
                                    <Badge variant="outline" className="text-xs">#{teamSeeds[game.away_team]}</Badge>
                                  )}
                                  <span className="hidden sm:inline">{game.away_team}</span>
                                  <span className="sm:hidden">{getShortTeamName(game.away_team)}</span>
                                  <span className="text-gray-500">@</span>
                                  {teamSeeds[game.home_team] && (
                                    <Badge variant="outline" className="text-xs">#{teamSeeds[game.home_team]}</Badge>
                                  )}
                                  <span className="hidden sm:inline">{game.home_team}</span>
                                  <span className="sm:hidden">{getShortTeamName(game.home_team)}</span>
                                  {game.winner && (
                                    <Badge variant={game.winner === pick?.predicted_winner ? 'default' : 'secondary'} className="ml-2">
                                      Winner: {game.winner}
                                    </Badge>
                                  )}
                                </div>
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              {/* Team selection */}
                              <div className="grid grid-cols-2 gap-4">
                                <Button
                                  variant={pick?.predicted_winner === game.away_team ? 'default' : 'outline'}
                                  onClick={() => !isLocked && handlePickChange(game.id, game.away_team)}
                                  disabled={isLocked}
                                  className="h-12 text-sm sm:text-base"
                                >
                                  <span className="hidden sm:inline">{game.away_team}</span>
                                  <span className="sm:hidden">{getShortTeamName(game.away_team)}</span>
                                </Button>
                                <Button
                                  variant={pick?.predicted_winner === game.home_team ? 'default' : 'outline'}
                                  onClick={() => !isLocked && handlePickChange(game.id, game.home_team)}
                                  disabled={isLocked}
                                  className="h-12 text-sm sm:text-base"
                                >
                                  <span className="hidden sm:inline">{game.home_team}</span>
                                  <span className="sm:hidden">{getShortTeamName(game.home_team)}</span>
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                      
                      {/* TBD games (teams not yet determined) - visible but disabled */}
                      {tbdGames.map((game, index) => {
                        const gameNumber = validGames.length + index + 1;
                        return (
                          <Card key={game.id || `tbd-${round.week}-${index}`} className="opacity-60 border-dashed border-2 border-gray-300">
                            <CardHeader>
                              <CardTitle className="flex items-center justify-between">
                                <span>Game {gameNumber}</span>
                                <Badge variant="secondary">TBD</Badge>
                              </CardTitle>
                              <CardDescription>
                                <div className="flex items-center gap-2 flex-wrap text-gray-400">
                                  <span>TBD</span>
                                  <span className="text-gray-400">@</span>
                                  <span>TBD</span>
                                </div>
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <Button
                                  variant="outline"
                                  disabled
                                  className="h-12 text-sm sm:text-base opacity-50"
                                >
                                  TBD
                                </Button>
                                <Button
                                  variant="outline"
                                  disabled
                                  className="h-12 text-sm sm:text-base opacity-50"
                                >
                                  TBD
                                </Button>
                              </div>
                              <p className="text-xs text-gray-500 text-center">
                                Teams for this game have not been determined yet
                              </p>
                            </CardContent>
                          </Card>
                        );
                      })}
                        
                        {/* Super Bowl Total Score Input - Only for round 4 */}
                        {round.week === 4 && !roundSubmitted && (
                          <Card className="border-blue-200 bg-blue-50">
                            <CardHeader className="pb-3">
                              <CardTitle className="flex items-center gap-2 text-lg">
                                <Target className="h-5 w-5 text-blue-600" />
                                Super Bowl Total Score (Tie-Breaker)
                              </CardTitle>
                              <CardDescription>
                                Enter your prediction for the total points scored in the Super Bowl. This will be used as a tie-breaker if needed.
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-3">
                                <div>
                                  <Label htmlFor="superbowl-total-score" className="text-sm font-medium">
                                    Total Points Scored
                                    <span className="text-red-500 ml-1">*</span>
                                  </Label>
                                  <Input
                                    id="superbowl-total-score"
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="1"
                                    placeholder="e.g., 45"
                                    value={superBowlTotalScore || ''}
                                    onChange={(e) => {
                                      const value = e.target.value === '' ? null : parseInt(e.target.value, 10);
                                      setSuperBowlTotalScore(value);
                                      
                                      // Save Super Bowl score to localStorage
                                      if (selectedUser && value !== null) {
                                        try {
                                          const storageKey = `playoff_picks_superbowl_${selectedUser.id}_${poolId}`;
                                          localStorage.setItem(storageKey, JSON.stringify({
                                            score: value,
                                            timestamp: Date.now()
                                          }));
                                        } catch (error) {
                                          console.error('Error saving Super Bowl score to localStorage:', error);
                                        }
                                      }
                                    }}
                                    className="mt-1"
                                  />
                                  <p className="text-xs text-gray-500 mt-1">
                                    Enter the combined total score of both teams
                                  </p>
                                </div>
                                {superBowlTotalScore !== null && superBowlTotalScore >= 0 && superBowlTotalScore <= 100 && (
                                  <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="text-green-700 bg-green-100">
                                      Total Score: {superBowlTotalScore} points
                                    </Badge>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                        
                        {!roundSubmitted && validGames.length > 0 && (
                          <Button
                            onClick={() => handleSubmitRound(round.week)}
                            disabled={isSubmitting}
                            className="w-full"
                          >
                            {isSubmitting ? 'Submitting...' : `Submit ${round.roundName} Picks`}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                    </Card>
                  )}

                {/* Round Winner Announcement - Show when debug mode is enabled or game picks panel is hidden and winner exists */}
                {(() => {
                  // Get winner from leaderboard data if available, otherwise use roundWinners state
                  const leaderboardForRound = leaderboardData[round.week];
                  const winner = leaderboardForRound && leaderboardForRound.length > 0 
                    ? {
                        participant_name: leaderboardForRound[0].participant_name,
                        points: leaderboardForRound[0].total_points,
                        correct_picks: leaderboardForRound[0].correct_picks,
                        total_picks: leaderboardForRound[0].total_picks
                      }
                    : roundWinners[round.week];
                  
                  return ((debugMode || !showGamePicksPanel) && winner) && (
                    <Card className="mt-6 max-w-2xl mx-auto bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
                      <CardHeader className="text-center">
                        <div className="mx-auto mb-4 w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center">
                          <Crown className="h-10 w-10 text-yellow-600" />
                        </div>
                        <CardTitle className="text-yellow-900 text-2xl">{round.roundName} Winner!</CardTitle>
                        <CardDescription className="text-yellow-700 text-lg">
                          Congratulations to the {round.roundName} winner!
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="text-center space-y-4">
                        <div className="bg-white rounded-lg p-6 border border-yellow-200">
                          <div className="text-3xl font-bold text-yellow-800 mb-2">
                            {winner.participant_name}
                          </div>
                          <div className="text-lg text-yellow-700 mb-4">
                            {winner.points} points
                          </div>
                          <div className="text-sm text-gray-600">
                            {winner.correct_picks} correct picks out of {winner.total_picks || validGames.length} games
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}

                  {/* Message when all users with confidence points have submitted but others need to submit confidence points */}
                  {round.week === currentRound && 
                   submittedCount >= usersWithConfidencePointsCount && 
                   usersWithConfidencePointsCount > 0 && 
                   usersNeedingConfidencePoints > 0 && (
                    <Card className="mt-6 bg-gradient-to-r from-orange-50 to-yellow-50 border-orange-200">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-orange-900">
                          <Target className="h-5 w-5" />
                          Waiting for Confidence Points Submissions
                        </CardTitle>
                        <CardDescription className="text-orange-700">
                          All participants who have submitted confidence points have also submitted their picks for this round.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <p className="text-sm text-orange-800">
                            There are still {usersNeedingConfidencePoints} participant{usersNeedingConfidencePoints !== 1 ? 's' : ''} who need to submit their playoff confidence points before they can make picks.
                          </p>
                          <Button
                            onClick={() => router.push(`/pool/${poolId}/playoffs`)}
                            className="w-full"
                            variant="outline"
                          >
                            <Target className="h-4 w-4 mr-2" />
                            Go to Confidence Points Page
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Leaderboard - Show when all participants with confidence points have submitted, debug mode is enabled, or game picks panel is hidden */}
                {((submittedCount >= usersWithConfidencePointsCount && usersWithConfidencePointsCount > 0 && usersNeedingConfidencePoints === 0) || 
                  showLeaderboard[round.week] || 
                  (debugMode && roundWinners[round.week]) || 
                  (!showGamePicksPanel && round.week === currentRound)) && (
                    <Card className="mt-6">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Trophy className="h-5 w-5 text-yellow-600" />
                          {round.roundName} Final Results
                        </CardTitle>
                        <CardDescription>
                          {!showGamePicksPanel && round.week === currentRound 
                            ? `Leaderboard preview for ${poolName} - ${round.roundName}. Winners are calculated for display purposes.`
                            : `Complete standings for ${poolName} - ${round.roundName}`
                          }
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Leaderboard 
                          poolId={poolId} 
                          weekNumber={round.week} 
                          seasonType={3} 
                          season={poolSeason} 
                        />
                      </CardContent>
                    </Card>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}

      {/* Overall Playoff Standings - toggleable */}
      <div className="mt-4">
        <details>
          <summary className="cursor-pointer text-sm text-blue-800 hover:underline">Show Playoff Standings</summary>
          <Card className="mt-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <Trophy className="h-6 w-6 text-blue-600" />
                Playoff Standings
              </CardTitle>
              <CardDescription className="text-blue-700">
                Live totals across all playoff rounds based on completed games
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SeasonLeaderboard 
                poolId={poolId}
                season={poolSeason}
                currentWeek={currentRound}
                currentSeasonType={3}
              />
            </CardContent>
          </Card>
        </details>
      </div>

        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmationDialog} onOpenChange={setShowConfirmationDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirm Your Picks
            </DialogTitle>
            <DialogDescription>
              Please review your {pendingRound ? roundNames[pendingRound] : 'playoff'} picks before submitting. Once submitted, picks cannot be changed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* User Confirmation */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <User className="h-5 w-5 text-blue-600" />
                <span className="font-semibold text-blue-900">Submitting as:</span>
              </div>
              <div className="text-sm text-gray-600">
                {selectedUser?.name}
              </div>
              <div className="mt-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    id="confirm-identity"
                    checked={userConfirmed}
                    onCheckedChange={(checked) => setUserConfirmed(checked === true)}
                  />
                  <span className="text-sm text-blue-800">
                    I confirm that I am <strong>{selectedUser?.name}</strong> and these are my picks
                  </span>
                </label>
              </div>
            </div>

            {/* Picks Summary */}
            {pendingRound && (() => {
              const allRoundGames = playoffRounds.find(r => r.week === pendingRound)?.games || [];
              const roundGames = allRoundGames.filter(game => {
                const hasHomeTeam = game.home_team && game.home_team.trim() !== '' && game.home_team.trim() !== 'TBD';
                const hasAwayTeam = game.away_team && game.away_team.trim() !== '' && game.away_team.trim() !== 'TBD';
                const isPlaceholder = 'isPlaceholder' in game && game.isPlaceholder;
                return hasHomeTeam && hasAwayTeam && !isPlaceholder;
              });
              const roundPicks = picks.filter(pick => roundGames.some(g => g.id === pick.game_id));

              return (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Your Picks:</h4>
                  <div className="space-y-2">
                    {roundGames.map((game, index) => {
                      const pick = roundPicks.find(p => p.game_id === game.id);
                      return (
                        <div key={game.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium">
                              Game {index + 1}: {pick?.predicted_winner || 'Not selected'}
                            </div>
                            <div className="text-sm text-gray-600">
                              {game.away_team} @ {game.home_team}
                            </div>
                          </div>
                          {pick?.predicted_winner && (
                            <Badge variant="outline" className="ml-2">
                              Selected
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Super Bowl Total Score */}
            {pendingRound === 4 && superBowlTotalScore !== null && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Super Bowl Total Score:</h4>
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-blue-900">
                        Total Points Prediction
                      </div>
                      <div className="text-sm text-blue-700">
                        Used for tie-breaking in Super Bowl
                      </div>
                    </div>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                      {superBowlTotalScore} points
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-800">
                <strong>Important:</strong> After submission, you cannot change your picks. 
                Make sure all selections are correct before confirming.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => {
              setShowConfirmationDialog(false);
              setUserConfirmed(false);
            }} disabled={isSubmitting}>
              Review Picks
            </Button>
            <Button 
              onClick={confirmSubmitRound}
              disabled={!userConfirmed || isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Picks'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl flex items-center gap-2">
              <Trophy className="h-5 w-5 text-green-500" />
              Picks Submitted Successfully!
            </DialogTitle>
            <DialogDescription className="text-sm sm:text-base">
              Your picks for {roundNames[currentRound]} have been submitted. Best of luck!
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

export default function PlayoffPicksPage() {
  return (
    <div>
      <PlayoffPicksContent />
    </div>
  );
}

