'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { submitPicks } from '@/actions/submitPicks';
import { loadWeekGames } from '@/actions/loadWeekGames';
import { loadCurrentWeek } from '@/actions/loadCurrentWeek';
import { PickUserSelection } from './pick-user-selection';
import { PickConfirmationDialog } from './pick-confirmation-dialog';
import { userSessionManager } from '@/lib/user-session';
import { pickStorage, StoredPick } from '@/lib/pick-storage';
import { Clock, Save, AlertTriangle } from 'lucide-react';

interface WeeklyPickProps {
  poolId: string;
}

interface Game {
  id: string;
  home_team: string;
  away_team: string;
  kickoff_time: string;
  game_status: string;
  winner?: string;
}

interface Pick {
  participant_id: string;
  pool_id: string;
  game_id: string;
  predicted_winner: string;
  confidence_points: number;
}

export function WeeklyPick({ poolId }: WeeklyPickProps) {
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
  
  const { toast } = useToast();
  const errorsRef = useRef<HTMLDivElement>(null);

  // Load current week and games
  useEffect(() => {
    const loadData = async () => {
      try {
        const weekData = await loadCurrentWeek();
        setCurrentWeek(weekData.week_number);
        
        const gamesData = await loadWeekGames(weekData.week_number);
        setGames(gamesData);
        
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
  }, [poolId, toast]);

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
    userSessionManager.createSession(user.id, user.name, poolId, currentWeek);
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
    return <PickUserSelection poolId={poolId} onUserSelected={handleUserSelected} />;
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

      {/* Games grid */}
      <div className="grid gap-4">
        {games.map((game, index) => {
          const pick = picks.find(p => p.game_id === game.id);
          const isLocked = game.game_status !== 'scheduled';
          
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
                  <label className="block text-sm font-medium mb-2">
                    Confidence Points: {pick?.confidence_points || 0}
                  </label>
                  <div className="grid grid-cols-8 gap-2">
                    {Array.from({ length: games.length }, (_, i) => i + 1).map(points => (
                      <Button
                        key={points}
                        variant={pick?.confidence_points === points ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => !isLocked && handlePickChange(game.id, 'confidence_points', points)}
                        disabled={isLocked}
                      >
                        {points}
                      </Button>
                    ))}
                  </div>
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
          disabled={isLoading}
          size="lg"
          className="px-8"
        >
          {isLoading ? 'Submitting...' : 'Submit Picks'}
        </Button>
      </div>
    </div>
  );
}
