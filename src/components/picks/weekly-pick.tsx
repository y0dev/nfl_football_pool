'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { submitPicks } from '@/actions/submitPicks';
import { loadWeekGames } from '@/actions/loadWeekGames';
import { loadCurrentWeek, isWeekUnlockedForPicks, getUpcomingWeek } from '@/actions/loadCurrentWeek';
import { PickConfirmationDialog } from './pick-confirmation-dialog';
import { userSessionManager } from '@/lib/user-session';
import { pickStorage } from '@/lib/pick-storage';
import { Clock, Save, AlertTriangle, X } from 'lucide-react';
import { Game, Pick, StoredPick, SelectedUser } from '@/types/game';
import { debugLog, DAYS_BEFORE_GAME, getShortTeamName } from '@/lib/utils';

interface WeeklyPickProps {
  poolId: string;
  weekNumber?: number;
  seasonType?: number;
  selectedUser?: SelectedUser;
  games?: Game[];
  preventGameLoading?: boolean;
  onPicksSubmitted?: () => void;
  onUserChangeRequested?: () => void;
}

export function WeeklyPick({ poolId, weekNumber, seasonType, selectedUser: propSelectedUser, games: propGames, preventGameLoading, onPicksSubmitted, onUserChangeRequested }: WeeklyPickProps) {
  const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(propSelectedUser || null);
  const [games, setGames] = useState<Game[]>(propGames || []);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [currentWeek, setCurrentWeek] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isWeekUnlocked, setIsWeekUnlocked] = useState(false);
  const [unlockTime, setUnlockTime] = useState<string>('');
  const [countdownToUnlock, setCountdownToUnlock] = useState<string>('');
  
  const { toast } = useToast();
  const errorsRef = useRef<HTMLDivElement>(null);

  // Load current week and games (only if not prevented)
  useEffect(() => {
    const loadData = async () => {
      debugLog('WeeklyPick: loadData called with props:', { weekNumber, seasonType, preventGameLoading, propGames: propGames?.length || 0 });
      debugLog('WeeklyPick: current state:', { currentWeek, games: games.length });
      
      if (preventGameLoading && propGames) {
        // Use provided games and set current week
        setGames(propGames);
        setCurrentWeek(weekNumber || 1);
        
        debugLog('WeeklyPick: Using propGames, setting currentWeek to:', weekNumber || 1);
        
        // Check if this week is unlocked for picks
        const weekUnlocked = await isWeekUnlockedForPicks(weekNumber || 1, seasonType || 2);
        setIsWeekUnlocked(weekUnlocked);
        
        // Get unlock time if week is locked
        if (!weekUnlocked && propGames && propGames.length > 0) {
          const firstGameTime = new Date(propGames[0].kickoff_time);
          const daysBeforeFirstGame = new Date(firstGameTime.getTime() - (DAYS_BEFORE_GAME * 24 * 60 * 60 * 1000));
          setUnlockTime(daysBeforeFirstGame.toLocaleString());
        }
        
        // Initialize picks array with the provided games
        const initialPicks: Pick[] = propGames.map((game: Game) => ({
          participant_id: selectedUser?.id || '',
          pool_id: poolId,
          game_id: game.id,
          predicted_winner: '',
          confidence_points: 0
        }));
        setPicks(initialPicks);
        
        debugLog('WeeklyPick: Using propGames with preventGameLoading=true');
        debugLog('Games:', propGames);
        debugLog('Initial picks:', initialPicks);
        return;
      }

      try {
        // Use provided week number or load upcoming week
        let weekToUse = weekNumber;
        let seasonTypeToUse = seasonType;
        
        if (!weekToUse) {
          const upcomingWeek = await getUpcomingWeek();
          weekToUse = upcomingWeek.week;
          seasonTypeToUse = seasonTypeToUse || upcomingWeek.seasonType;
        }
        
        
        setCurrentWeek(weekToUse);
        seasonTypeToUse = seasonTypeToUse || 2; // Default to regular season
        
        const gamesData = await loadWeekGames(weekToUse, seasonTypeToUse);
        setGames(gamesData);
        debugLog('WeeklyPick: Games loaded:', gamesData);
        
        // Check if this week is unlocked for picks
        const weekUnlocked = await isWeekUnlockedForPicks(weekToUse, seasonTypeToUse);
        setIsWeekUnlocked(weekUnlocked);
        
        // Get unlock time if week is locked
        if (!weekUnlocked && gamesData.length > 0) {
          const firstGameTime = new Date(gamesData[0].kickoff_time);
          const daysBeforeFirstGame = new Date(firstGameTime.getTime() - (DAYS_BEFORE_GAME * 24 * 60 * 60 * 1000));
          setUnlockTime(daysBeforeFirstGame.toLocaleString());
        }
        debugLog('Selected user:', selectedUser);
        // Initialize picks array
        const initialPicks: Pick[] = gamesData.map((game: Game) => ({
          participant_id: selectedUser?.id || '',
          pool_id: poolId,
          game_id: game.id,
          predicted_winner: '',
          confidence_points: 0
        }));
        setPicks(initialPicks);
        
        debugLog('WeeklyPick: Loaded games from loadWeekGames');
        debugLog('Week:', weekToUse, 'Season Type:', seasonTypeToUse);
        debugLog('Games:', gamesData);
        debugLog('Initial picks:', initialPicks);
      } catch (error) {
        console.error('Error loading data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load games data',
          variant: 'destructive',
        });
      }
    };

    loadData();
  }, [poolId, weekNumber, seasonType, preventGameLoading, propGames, toast, selectedUser]);

  // Monitor currentWeek changes
  useEffect(() => {
    debugLog('WeeklyPick: currentWeek changed to:', currentWeek);
  }, [currentWeek]);

  // Monitor games changes
  useEffect(() => {
    debugLog('WeeklyPick: games changed to:', games.map(g => ({ id: g.id, home_team: g.home_team, away_team: g.away_team, week: g.week, season_type: g.season_type })));
  }, [games]);

  // Update selectedUser when prop changes
  useEffect(() => {
    debugLog('WeeklyPick: propSelectedUser changed to:', propSelectedUser);
    debugLog('WeeklyPick: selectedUser changed to:', selectedUser);
    if (propSelectedUser && propSelectedUser !== selectedUser) {
      debugLog('WeeklyPick: propSelectedUser changed to:', propSelectedUser);
      setSelectedUser(propSelectedUser);
    } else {
      debugLog('WeeklyPick: propSelectedUser is the same as selectedUser');
    }
  }, [propSelectedUser, selectedUser]);

  // Load saved picks from localStorage when user is selected
  useEffect(() => {
    if (selectedUser && games.length > 0) {
      debugLog('WeeklyPick: Loading picks for user:', selectedUser.id, 'pool:', poolId, 'week:', currentWeek);
      const savedPicks = pickStorage.loadPicks(selectedUser.id, poolId, currentWeek);
      debugLog('WeeklyPick: Saved picks from localStorage:', savedPicks);
      
      if (savedPicks.length > 0) {
        // Map saved picks to the current games array
        const updatedPicks = games.map(game => {
          const savedPick = savedPicks.find(sp => sp.game_id === game.id);
          if (savedPick) {
            return {
              participant_id: selectedUser.id,
              pool_id: poolId,
              game_id: game.id,
              predicted_winner: savedPick.predicted_winner || '',
              confidence_points: savedPick.confidence_points || 0
            };
          }
          return {
            participant_id: selectedUser.id,
            pool_id: poolId,
            game_id: game.id,
            predicted_winner: '',
            confidence_points: 0
          };
        });
        
        debugLog('WeeklyPick: Updated picks with localStorage data:', updatedPicks);
        setPicks(updatedPicks);
        setHasUnsavedChanges(false);
        setLastSaved(new Date(savedPicks[0]?.timestamp || Date.now()));
        
        const validPicks = savedPicks.filter(sp => sp.predicted_winner && sp.confidence_points > 0);
        if (validPicks.length > 0) {
          toast({
            title: 'Picks Restored',
            description: `Loaded ${validPicks.length} saved picks from localStorage`,
          });
        }
      } else {
        // Initialize picks with selected user
        const initialPicks = games.map(game => ({
          participant_id: selectedUser.id,
          pool_id: poolId,
          game_id: game.id,
          predicted_winner: '',
          confidence_points: 0
        }));
        debugLog('WeeklyPick: Initializing new picks for user:', initialPicks);
        setPicks(initialPicks);
      }
    }
  }, [selectedUser, games, poolId, currentWeek, toast]);

  // Check if week is unlocked for picks when games are loaded
  useEffect(() => {
    const checkWeekUnlocked = async () => {
      if (games.length > 0 && currentWeek > 0) {
        try {
          debugLog('WeeklyPick: Checking if week is unlocked for picks:', currentWeek, 'season type:', seasonType);
          const weekUnlocked = await isWeekUnlockedForPicks(currentWeek, seasonType || 2);
          debugLog('WeeklyPick: Week unlock result:', weekUnlocked);
          setIsWeekUnlocked(weekUnlocked);
          
          // If week is locked, get unlock time
          if (!weekUnlocked && games.length > 0) {
            const firstGameTime = new Date(games[0].kickoff_time);
            const daysBeforeFirstGame = new Date(firstGameTime.getTime() - (DAYS_BEFORE_GAME * 24 * 60 * 60 * 1000));
            setUnlockTime(daysBeforeFirstGame.toLocaleString());
            debugLog('WeeklyPick: Week is locked, unlock time:', daysBeforeFirstGame.toLocaleString());
          } else {
            debugLog('WeeklyPick: Week is unlocked for picks');
          }
        } catch (error) {
          console.error('Error checking week unlock status:', error);
          // Default to unlocked if there's an error
          setIsWeekUnlocked(true);
          debugLog('WeeklyPick: Defaulting to unlocked due to error');
        }
      }
    };
    
    checkWeekUnlocked();
  }, [games, currentWeek, seasonType]);

  // Auto-save picks to localStorage when picks change (backup mechanism)
  useEffect(() => {
    if (selectedUser && picks.length > 0 && hasUnsavedChanges) {
      // Only auto-save if we haven&apos;t already saved in the last second
      const now = Date.now();
      const lastSavedTime = lastSaved?.getTime() || 0;
      
      if (now - lastSavedTime > 1000) { // Only save if more than 1 second has passed
        const storedPicks: StoredPick[] = picks.map(pick => ({
          ...pick,
          timestamp: now
        }));
        
        pickStorage.savePicks(storedPicks, selectedUser.id, poolId, currentWeek);
        setLastSaved(new Date(now));
        setHasUnsavedChanges(false);
      }
    }
  }, [picks, selectedUser, poolId, currentWeek, hasUnsavedChanges, lastSaved]);

  // Countdown timer for week unlock
  useEffect(() => {
    if (!isWeekUnlocked && unlockTime) {
      const timer = setInterval(() => {
        const now = new Date();
        const unlockDate = new Date(unlockTime);
        const timeDiff = unlockDate.getTime() - now.getTime();
        
        if (timeDiff <= 0) {
          // Week is now unlocked
          setCountdownToUnlock('');
          setIsWeekUnlocked(true);
        } else {
          // Calculate remaining time
          const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
          const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
          
          let countdownText = '';
          if (days > 0) {
            countdownText = `${days}d ${hours}h ${minutes}m`;
          } else if (hours > 0) {
            countdownText = `${hours}h ${minutes}m ${seconds}s`;
          } else if (minutes > 0) {
            countdownText = `${minutes}m ${seconds}s`;
          } else {
            countdownText = `${seconds}s`;
          }
          
          setCountdownToUnlock(countdownText);
        }
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isWeekUnlocked, unlockTime]);

  // Handle pick changes
  const handlePickChange = (gameId: string, field: 'predicted_winner' | 'confidence_points', value: string | number) => {
    // Check if confidence point is already used
    if (field === 'confidence_points' && typeof value === 'number') {
      const existingPick = picks.find(p => p.confidence_points === value && p.game_id !== gameId);
      if (existingPick) {
        // Show confirmation dialog for override
        if (window.confirm(`Confidence point ${value} is already used by another game. Do you want to override it?`)) {
          // Remove the confidence point from the other game
          const updatedPicks = picks.map(pick => 
            pick.confidence_points === value && pick.game_id !== gameId
              ? { ...pick, confidence_points: 0 }
              : pick
          );
          
          // Set the new confidence point
          const finalPicks = updatedPicks.map(pick => 
            pick.game_id === gameId 
              ? { ...pick, [field]: value }
              : pick
          );
          
          setPicks(finalPicks);
          setHasUnsavedChanges(true);
          
          // Immediately save to localStorage
          if (selectedUser) {
            const storedPicks: StoredPick[] = finalPicks.map(pick => ({
              ...pick,
              timestamp: Date.now()
            }));
            
            pickStorage.savePicks(storedPicks, selectedUser.id, poolId, currentWeek);
            setLastSaved(new Date());
          }
        }
        return;
      }
    }
    
    const updatedPicks = picks.map(pick => 
      pick.game_id === gameId 
        ? { ...pick, [field]: value }
        : pick
    );
    
    setPicks(updatedPicks);
    setHasUnsavedChanges(true);
    
    // Immediately save to localStorage
    if (selectedUser) {
      const storedPicks: StoredPick[] = updatedPicks.map(pick => ({
        ...pick,
        timestamp: Date.now()
      }));
      
      pickStorage.savePicks(storedPicks, selectedUser.id, poolId, currentWeek);
      setLastSaved(new Date());
    }
  };

  // Validate picks
  const validatePicks = (): string[] => {
    const errors: string[] = [];
    const usedConfidencePoints = new Set<number>();
    const validPicks = picks.filter(pick => pick.predicted_winner && pick.confidence_points > 0);

    // Check if participant_id is set
    if (!selectedUser?.id || picks.some(pick => !pick.participant_id || pick.participant_id !== selectedUser.id)) {
      errors.push('Please select a user before submitting picks');
      return errors;
    }

    if (validPicks.length !== games.length) {
      errors.push('Please make a pick for all games');
    }

    validPicks.forEach(pick => {
      if (usedConfidencePoints.has(pick.confidence_points)) {
        errors.push(`Confidence point ${pick.confidence_points} is used multiple times`);
      }
      usedConfidencePoints.add(pick.confidence_points);
    });

    // Check for sequential confidence points
    const confidencePoints = Array.from(usedConfidencePoints).sort((a, b) => a - b);
    for (let i = 0; i < confidencePoints.length; i++) {
      if (confidencePoints[i] !== i + 1) {
        errors.push('Confidence points must be sequential (1, 2, 3, etc.)');
        break;
      }
    }

    return errors;
  };

  // Handle form submission
  const handleSubmit = async () => {
    const validationErrors = validatePicks();
    setErrors(validationErrors);
    if (validationErrors.length > 0) {
      // Scroll to errors
      if (errorsRef.current) {
        errorsRef.current.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }
    
    setShowConfirmation(true);
  };

  // Confirm submission
  const confirmSubmission = async () => {
    setIsLoading(true);
    setShowConfirmation(false);

    try {
      // Ensure all picks have the correct participant_id
      const picksWithParticipantId = picks.map(pick => ({
        ...pick,
        participant_id: selectedUser!.id
      }));
      
      const validPicks = picksWithParticipantId.filter(pick => pick.predicted_winner && pick.confidence_points > 0);
      
      debugLog('WeeklyPick: Submitting picks with game IDs:', validPicks.map(p => ({ game_id: p.game_id, predicted_winner: p.predicted_winner, confidence_points: p.confidence_points })));
      debugLog('WeeklyPick: Current games in state:', games.map(g => ({ id: g.id, home_team: g.home_team, away_team: g.away_team })));
      debugLog('WeeklyPick: Week number:', currentWeek, 'Season type:', seasonType);
      
      const result = await submitPicks(validPicks);

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Picks submitted successfully!',
        });
        
        debugLog('WeeklyPick: Picks submitted successfully, clearing picks and removing user session');
        debugLog('WeeklyPick: Picks:', validPicks);
        debugLog('WeeklyPick: Selected user:', selectedUser);
        debugLog('WeeklyPick: Pool ID:', poolId);
        // Clear localStorage after successful submission and remove user session
        pickStorage.clearPicks();
        userSessionManager.removeSession(selectedUser?.id || '', poolId);
        setPicks([]);
        setSelectedUser(null);
        setHasUnsavedChanges(false);
        setLastSaved(null);
        
        // Call the callback to refresh the parent component
        if (onPicksSubmitted) {
          onPicksSubmitted();
        }
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to submit picks',
          variant: 'destructive',
        });
      }
    } catch (error: unknown) {
      console.error('Error submitting picks:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to submit picks',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle user change
  const handleChangeUser = () => {
    // Clear local state
    setPicks([]);
    setHasUnsavedChanges(false);
    setLastSaved(null);
    pickStorage.clearPicks();
    userSessionManager.removeSession(selectedUser?.id || '', poolId);
    
    // Notify parent component that user change is requested
    if (onUserChangeRequested) {
      onUserChangeRequested();
    }
  };

  if (!selectedUser) {
    // Don't render anything if no user is selected - parent component handles this
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header with user info and timer */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold">Week {currentWeek} Picks</h2>
          <p className="text-gray-600">
            Making picks as: <span className="font-semibold">{selectedUser.name}</span>
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 flex-shrink-0">
          {lastSaved && (
            <div className="flex items-center gap-2 text-sm text-green-600 order-1 sm:order-none whitespace-nowrap">
              <Save className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Last saved: {lastSaved.toLocaleTimeString()}</span>
              <span className="sm:hidden">{lastSaved.toLocaleTimeString()}</span>
            </div>
          )}
          <Button variant="outline" onClick={handleChangeUser} className="order-2 sm:order-none w-full sm:w-auto flex-shrink-0">
            Change User
          </Button>
        </div>
      </div>

      {/* Auto-save warning */}
      {hasUnsavedChanges && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-blue-600" />
            <span className="text-blue-800">
              Your picks are being auto-saved. They will be automatically submitted in 5 minutes if you don&apos;t submit them manually.
            </span>
          </div>
        </div>
      )}

      {/* Week locked warning */}
      {!isWeekUnlocked && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex flex-col sm:flex-row sm:items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-yellow-800 flex-1 min-w-0">
              <div className="font-medium">
                Picks for Week {currentWeek} are not yet available.
              </div>
              <div className="text-sm mt-1 space-y-2">
                <p>Picks unlock within {DAYS_BEFORE_GAME} days of the first game&apos;s kickoff time.</p>
                {unlockTime && (
                  <div className="text-sm">
                    <strong>Unlocks:</strong> {unlockTime}
                  </div>
                )}
                {countdownToUnlock && (
                  <div className="flex items-center gap-2 text-orange-600 text-sm">
                    <Clock className="h-4 w-4 flex-shrink-0" />
                    <span className="font-mono font-medium">Unlocks in: {countdownToUnlock}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error messages */}
      {errors.length > 0 && (
        <div ref={errorsRef} className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="font-semibold text-red-800 mb-2">Please fix the following errors:</h3>
          <ul className="list-disc list-inside text-red-700 space-y-1">
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Confidence Points Summary */}
      {(() => {
        const usedPoints = picks
          .filter(p => p.confidence_points > 0)
          .map(p => p.confidence_points);
        const totalPoints = games.length || 0;
        const availablePoints = totalPoints - usedPoints.length;
        
        return (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-blue-900">Confidence Points Summary</h3>
                <p className="text-sm text-blue-700">
                  {usedPoints.length} of {totalPoints} points assigned
                </p>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-blue-900">{availablePoints}</div>
                <div className="text-xs text-blue-600">Available</div>
              </div>
            </div>
            {usedPoints.length > 0 && (
              <div className="mt-2">
                <div className="text-xs text-blue-600 mb-1">Used points:</div>
                <div className="flex flex-wrap gap-1">
                  {usedPoints.sort((a, b) => a - b).map(points => (
                    <Badge key={points} variant="secondary" className="text-xs">
                      {points}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Games grid */}
      <div className="grid gap-4">
        {games.map((game, index) => {
          const pick = picks.find(p => p.game_id === game.id);
          // const gameStatus = game.status || game.game_status || 'scheduled';
          const isLocked = !isWeekUnlocked;
          
          // Get used confidence points from other picks
          const usedConfidencePoints = picks
            .filter(p => p.game_id !== game.id && p.confidence_points > 0)
            .map(p => p.confidence_points);
          
          // Get available confidence points (excluding used ones and the current pick's value)
          const availableConfidencePoints = games.length > 0 ? Array.from({ length: games.length }, (_, i) => i + 1)
            .filter(points => 
              points === pick?.confidence_points || // Include current pick's value
              !usedConfidencePoints.includes(points) // Exclude used by other picks
            ) : [];
          
          // Use utility function for short team names
          
          return (
            <Card key={game.id} className={isLocked ? 'opacity-75' : ''}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Game {index + 1}</span>
                  {isLocked && <Badge variant="secondary">Locked</Badge>}
                </CardTitle>
                <CardDescription>
                  {window.innerWidth < 640 ? getShortTeamName(game.away_team) : game.away_team} @ {window.innerWidth < 640 ? getShortTeamName(game.home_team) : game.home_team}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Team selection */}
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    variant={pick?.predicted_winner === game.away_team ? 'default' : 'outline'}
                    onClick={() => !isLocked && handlePickChange(game.id, 'predicted_winner', game.away_team)}
                    disabled={isLocked}
                    className="h-12 text-sm sm:text-base"
                  >
                    <span className="hidden sm:inline">{game.away_team}</span>
                    <span className="sm:hidden">{getShortTeamName(game.away_team)}</span>
                  </Button>
                  <Button
                    variant={pick?.predicted_winner === game.home_team ? 'default' : 'outline'}
                    onClick={() => !isLocked && handlePickChange(game.id, 'predicted_winner', game.home_team)}
                    disabled={isLocked}
                    className="h-12 text-sm sm:text-base"
                  >
                    <span className="hidden sm:inline">{game.home_team}</span>
                    <span className="sm:hidden">{getShortTeamName(game.home_team)}</span>
                  </Button>
                </div>

                {/* Confidence points */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium">
                      Confidence Points
                    </label>
                    {usedConfidencePoints.length > 0 && (
                      <span className="text-xs text-gray-500">
                        {usedConfidencePoints.length} used
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Select
                      value={pick?.confidence_points?.toString() || ''}
                      onValueChange={(value) => !isLocked && handlePickChange(game.id, 'confidence_points', parseInt(value))}
                      disabled={isLocked}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select confidence points" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableConfidencePoints && availableConfidencePoints.length > 0 ? (
                          availableConfidencePoints.map(points => (
                            <SelectItem key={points} value={points.toString()}>
                              {points} point{points !== 1 ? 's' : ''}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="" disabled>
                            No confidence points available
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    
                    {/* Clear Confidence Button */}
                    {pick?.confidence_points && pick.confidence_points > 0 && !isLocked && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handlePickChange(game.id, 'confidence_points', 0)}
                        className="shrink-0 px-3 hover:bg-red-50 hover:border-red-200 hover:text-red-700"
                        title="Clear confidence points - makes this value available for other games"
                      >
                        <X className="h-4 w-4" /> 
                      </Button>
                    )}
                  </div>
                  
                  {/* Show used confidence points */}
                  {usedConfidencePoints.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs text-gray-500 mb-1">Used by other games:</div>
                      <div className="flex flex-wrap gap-1">
                        {usedConfidencePoints.sort((a, b) => a - b).map(points => (
                          <Badge key={points} variant="outline" className="text-xs bg-gray-100">
                            {points}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Show message when no confidence points are assigned */}
                  {!pick?.confidence_points && (
                    <div className="mt-2">
                      <div className="text-xs text-gray-500 italic">
                        No confidence points assigned - select a value above
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Submit button */}
      <div className="flex flex-col items-center gap-3">
        {/* Debug information - only show in development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="text-xs text-gray-500 text-center p-2 bg-gray-50 rounded border w-full max-w-md">
            <p>Debug: isLoading={isLoading.toString()}, isWeekUnlocked={isWeekUnlocked.toString()}</p>
            <p>Selected User: {selectedUser?.id || 'None'}</p>
            <p>Picks Count: {picks.length}</p>
            <p>Valid Picks: {picks.filter(p => p.predicted_winner && p.confidence_points > 0).length}</p>
          </div>
        )}
        
        <Button 
          onClick={handleSubmit} 
          disabled={isLoading || !isWeekUnlocked}
          size="lg"
          className="px-8 w-full sm:w-auto"
        >
          {isLoading ? 'Submitting...' : !isWeekUnlocked ? 'Week Locked' : 'Submit Picks'}
        </Button>
        
        {!isWeekUnlocked && unlockTime && (
          <div className="text-sm text-gray-600 text-center space-y-2 max-w-md">
            <p>Picks will unlock on {unlockTime}</p>
            <p className="text-xs">You can make your selections now and submit when the week unlocks</p>
            {countdownToUnlock && (
              <div className="flex items-center justify-center gap-2 text-orange-600 text-sm">
                <Clock className="h-4 w-4 flex-shrink-0" />
                <span className="font-mono font-medium">Unlocks in: {countdownToUnlock}</span>
              </div>
            )}
          </div>
        )}
        
        {isWeekUnlocked && (
          <div className="text-sm text-green-600 text-center">
            <p>✓ Week is unlocked - you can submit your picks</p>
          </div>
        )}
      </div>

      {/* Pick Confirmation Dialog */}
      <PickConfirmationDialog
        open={showConfirmation}
        onOpenChange={setShowConfirmation}
        picks={picks.map(pick => ({
          gameId: pick.game_id,
          pickedTeamId: pick.predicted_winner,
          confidencePoints: pick.confidence_points
        }))}
        games={games}
        weekNumber={currentWeek}
        onConfirm={confirmSubmission}
        isSubmitting={isLoading}
        userName={selectedUser?.name || 'Unknown User'}
        userEmail={selectedUser?.email}
      />
    </div>
  );
}
