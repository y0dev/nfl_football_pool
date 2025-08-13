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
import { PickUserSelection } from './pick-user-selection';
import { PickConfirmationDialog } from './pick-confirmation-dialog';
import { userSessionManager } from '@/lib/user-session';
import { pickStorage, StoredPick } from '@/lib/pick-storage';
import { Clock, Save, AlertTriangle } from 'lucide-react';

interface WeeklyPickProps {
  poolId: string;
  weekNumber?: number;
  seasonType?: number;
}

interface Game {
  id: string;
  home_team: string;
  away_team: string;
  kickoff_time: string;
  game_status?: string;
  status?: string;
  winner?: string;
}

interface Pick {
  participant_id: string;
  pool_id: string;
  game_id: string;
  predicted_winner: string;
  confidence_points: number;
}

export function WeeklyPick({ poolId, weekNumber, seasonType }: WeeklyPickProps) {
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [currentWeek, setCurrentWeek] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isWeekUnlocked, setIsWeekUnlocked] = useState(false);
  
  const { toast } = useToast();
  const errorsRef = useRef<HTMLDivElement>(null);

  // Load current week and games
  useEffect(() => {
    const loadData = async () => {
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
        
        // Check if this week is unlocked for picks
        const weekUnlocked = isWeekUnlockedForPicks(weekToUse, seasonTypeToUse);
        setIsWeekUnlocked(weekUnlocked);
        
        // Initialize picks array
        const initialPicks: Pick[] = gamesData.map(game => ({
          participant_id: '',
          pool_id: poolId,
          game_id: game.id,
          predicted_winner: '',
          confidence_points: 0
        }));
        setPicks(initialPicks);
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
  }, [poolId, weekNumber, seasonType, toast]);

  // Load saved picks from localStorage when user is selected
  useEffect(() => {
    if (selectedUser && games.length > 0) {
      const savedPicks = pickStorage.loadPicks(selectedUser.id, poolId, currentWeek);
      
      if (savedPicks.length > 0) {
        // Map saved picks to the current picks array
        const updatedPicks = picks.map(pick => {
          const savedPick = savedPicks.find(sp => sp.game_id === pick.game_id);
          if (savedPick) {
            return {
              ...pick,
              participant_id: selectedUser.id,
              predicted_winner: savedPick.predicted_winner,
              confidence_points: savedPick.confidence_points
            };
          }
          return { ...pick, participant_id: selectedUser.id };
        });
        
        setPicks(updatedPicks);
        setHasUnsavedChanges(false);
        setLastSaved(new Date(savedPicks[0]?.timestamp || Date.now()));
        
        toast({
          title: 'Picks Restored',
          description: `Loaded ${savedPicks.length} saved picks from localStorage`,
        });
      } else {
        // Initialize picks with selected user
        setPicks(picks.map(pick => ({ ...pick, participant_id: selectedUser.id })));
      }
    }
  }, [selectedUser, games, poolId, currentWeek, toast]);

  // Auto-save picks to localStorage when picks change
  useEffect(() => {
    if (selectedUser && picks.length > 0 && hasUnsavedChanges) {
      const validPicks = picks.filter(pick => 
        pick.predicted_winner && pick.confidence_points > 0
      );
      
      if (validPicks.length > 0) {
        const storedPicks: StoredPick[] = validPicks.map(pick => ({
          ...pick,
          timestamp: Date.now()
        }));
        
        pickStorage.savePicks(storedPicks, selectedUser.id, poolId, currentWeek);
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
      }
    }
  }, [picks, selectedUser, poolId, currentWeek, hasUnsavedChanges]);

  // Countdown timer for auto-submit
  useEffect(() => {
    const timer = setInterval(() => {
      if (selectedUser && pickStorage.hasValidPicks(selectedUser.id, poolId, currentWeek)) {
        const remaining = pickStorage.getFormattedTimeRemaining();
        setTimeRemaining(remaining);
        
        if (remaining === 'Expired') {
          // Auto-submit will be handled by the storage class
          setTimeRemaining('');
        }
      } else {
        setTimeRemaining('');
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [selectedUser, poolId, currentWeek]);

  // Handle pick changes
  const handlePickChange = (gameId: string, field: 'predicted_winner' | 'confidence_points', value: string | number) => {
    setPicks(prevPicks => 
      prevPicks.map(pick => 
        pick.game_id === gameId 
          ? { ...pick, [field]: value }
          : pick
      )
    );
    setHasUnsavedChanges(true);
    pickStorage.updateExpiration(); // Reset the 5-minute timer
  };

  // Validate picks
  const validatePicks = (): string[] => {
    const errors: string[] = [];
    const usedConfidencePoints = new Set<number>();
    const validPicks = picks.filter(pick => pick.predicted_winner && pick.confidence_points > 0);

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
      const validPicks = picks.filter(pick => pick.predicted_winner && pick.confidence_points > 0);
      const result = await submitPicks(validPicks);

      if (result) {
        toast({
          title: 'Success',
          description: 'Picks submitted successfully!',
        });
        
        // Clear localStorage after successful submission
        pickStorage.clearPicks();
        setPicks([]);
        setSelectedUser(null);
        setHasUnsavedChanges(false);
        setLastSaved(null);
      }
    } catch (error: any) {
      console.error('Error submitting picks:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit picks',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle user selection
  const handleUserSelected = (user: any) => {
    setSelectedUser(user);
    // Note: We'll need to get the pool name and access code from the user selection
    // For now, we'll use a default pool name and access code
    userSessionManager.createSession(user.id, user.name, poolId, 'NFL Pool', 'DEFAULT');
  };

  // Handle user change
  const handleChangeUser = () => {
    setSelectedUser(null);
    setPicks([]);
    setHasUnsavedChanges(false);
    setLastSaved(null);
    pickStorage.clearPicks();
    userSessionManager.removeSession(selectedUser?.id || '', poolId);
  };

  if (!selectedUser) {
    return <PickUserSelection poolId={poolId} weekNumber={currentWeek} onUserSelected={handleUserSelected} />;
  }

  return (
    <div className="space-y-6">
      {/* Header with user info and timer */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Week {currentWeek} Picks</h2>
          <p className="text-gray-600">
            Making picks as: <span className="font-semibold">{selectedUser.name}</span>
          </p>
        </div>
        <div className="flex items-center gap-4">
          {timeRemaining && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-orange-500" />
              <span className="font-mono">Auto-submit: {timeRemaining}</span>
            </div>
          )}
          {lastSaved && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <Save className="h-4 w-4" />
              <span>Last saved: {lastSaved.toLocaleTimeString()}</span>
            </div>
          )}
          <Button variant="outline" onClick={handleChangeUser}>
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
              Your picks are being auto-saved. They will be automatically submitted in 5 minutes if you don't submit them manually.
            </span>
          </div>
        </div>
      )}

      {/* Week locked warning */}
      {!isWeekUnlocked && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <span className="text-yellow-800">
              Picks for Week {currentWeek} are not yet available. Picks typically unlock on Tuesday for the upcoming week's games.
            </span>
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
        const totalPoints = games.length;
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
          const gameStatus = game.status || game.game_status || 'scheduled';
          const isLocked = !isWeekUnlocked || gameStatus !== 'scheduled';
          
          // Get used confidence points from other picks
          const usedConfidencePoints = picks
            .filter(p => p.game_id !== game.id && p.confidence_points > 0)
            .map(p => p.confidence_points);
          
          // Get available confidence points (excluding used ones and the current pick's value)
          const availableConfidencePoints = Array.from({ length: games.length }, (_, i) => i + 1)
            .filter(points => 
              points === pick?.confidence_points || // Include current pick's value
              !usedConfidencePoints.includes(points) // Exclude used by other picks
            );
          
          return (
            <Card key={game.id} className={isLocked ? 'opacity-75' : ''}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Game {index + 1}</span>
                  {isLocked && <Badge variant="secondary">Locked</Badge>}
                </CardTitle>
                <CardDescription>
                  {game.away_team} @ {game.home_team}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Team selection */}
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    variant={pick?.predicted_winner === game.away_team ? 'default' : 'outline'}
                    onClick={() => !isLocked && handlePickChange(game.id, 'predicted_winner', game.away_team)}
                    disabled={isLocked}
                    className="h-12"
                  >
                    {game.away_team}
                  </Button>
                  <Button
                    variant={pick?.predicted_winner === game.home_team ? 'default' : 'outline'}
                    onClick={() => !isLocked && handlePickChange(game.id, 'predicted_winner', game.home_team)}
                    disabled={isLocked}
                    className="h-12"
                  >
                    {game.home_team}
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
                  <Select
                    value={pick?.confidence_points?.toString() || ''}
                    onValueChange={(value) => !isLocked && handlePickChange(game.id, 'confidence_points', parseInt(value))}
                    disabled={isLocked}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select confidence points" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableConfidencePoints.length > 0 ? (
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
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Submit button */}
      <div className="flex justify-center">
        <Button 
          onClick={handleSubmit} 
          disabled={isLoading || !isWeekUnlocked}
          size="lg"
          className="px-8"
        >
          {isLoading ? 'Submitting...' : !isWeekUnlocked ? 'Week Locked' : 'Submit Picks'}
        </Button>
      </div>
    </div>
  );
}
