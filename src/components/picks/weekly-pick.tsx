'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { loadWeekGames } from '@/actions/loadWeekGames';
import { submitPicks } from '@/actions/submitPicks';
import { PickUserSelection } from './pick-user-selection';
import { userSessionManager } from '@/lib/user-session';

interface WeeklyPickProps {
  poolId: string;
  weekNumber?: number;
}

interface Game {
  id: string;
  home_team: string;
  away_team: string;
  kickoff_time: string;
  status: string;
}

interface Pick {
  game_id: string;
  predicted_winner: string;
  confidence_points: number;
}

export function WeeklyPick({ poolId, weekNumber = 1 }: WeeklyPickProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  
  const { toast } = useToast();

  // Handle SSR - only run on client side
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted) {
      loadGames();
    }
  }, [isMounted, weekNumber]);

  const loadGames = async () => {
    try {
      setIsLoading(true);
      const gamesData = await loadWeekGames(weekNumber);
      setGames(gamesData);
      
      // Initialize picks array
      const initialPicks: Pick[] = gamesData.map(game => ({
        game_id: game.id,
        predicted_winner: '',
        confidence_points: 0
      }));
      setPicks(initialPicks);
    } catch (error) {
      console.error('Error loading games:', error);
      toast({
        title: 'Error',
        description: 'Failed to load games',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserSelected = (userId: string, userName: string) => {
    setSelectedUser({ id: userId, name: userName });
  };

  const handlePickChange = (gameId: string, field: 'predicted_winner' | 'confidence_points', value: string | number) => {
    setPicks(prev => prev.map(pick => 
      pick.game_id === gameId 
        ? { ...pick, [field]: value }
        : pick
    ));
  };

  const validatePicks = (): string[] => {
    const errors: string[] = [];
    
    // Check for empty picks
    const emptyPicks = picks.filter(pick => !pick.predicted_winner);
    if (emptyPicks.length > 0) {
      errors.push(`You have ${emptyPicks.length} incomplete picks`);
    }
    
    // Check for duplicate confidence points
    const confidencePoints = picks.map(p => p.confidence_points).filter(p => p > 0);
    const uniquePoints = new Set(confidencePoints);
    if (uniquePoints.size !== confidencePoints.length) {
      errors.push('Confidence points must be unique');
    }
    
    // Check for sequential confidence points
    const sortedPoints = confidencePoints.sort((a, b) => a - b);
    const expectedPoints = Array.from({ length: confidencePoints.length }, (_, i) => i + 1);
    if (JSON.stringify(sortedPoints) !== JSON.stringify(expectedPoints)) {
      errors.push('Confidence points must be sequential from 1 to number of games');
    }
    
    return errors;
  };

  const handleSubmit = async () => {
    if (!selectedUser) {
      toast({
        title: 'Error',
        description: 'Please select a user first',
        variant: 'destructive',
      });
      return;
    }

    const validationErrors = validatePicks();
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      toast({
        title: 'Validation Error',
        description: validationErrors.join(', '),
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    setErrors([]);

    try {
      const picksToSubmit = picks.map(pick => ({
        participant_id: selectedUser.id,
        pool_id: poolId,
        game_id: pick.game_id,
        predicted_winner: pick.predicted_winner,
        confidence_points: pick.confidence_points
      }));

      await submitPicks(picksToSubmit);
      
      toast({
        title: 'Success',
        description: 'Your picks have been submitted!',
      });
      
      // Clear the form
      setSelectedUser(null);
      setPicks(games.map(game => ({
        game_id: game.id,
        predicted_winner: '',
        confidence_points: 0
      })));
      
    } catch (error: any) {
      console.error('Error submitting picks:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit picks',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangeUser = () => {
    setSelectedUser(null);
    userSessionManager.removeSession(selectedUser?.id || '', poolId);
  };

  // Don't render until mounted to prevent hydration errors
  if (!isMounted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Weekly Picks</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!selectedUser) {
    return <PickUserSelection poolId={poolId} onUserSelected={handleUserSelected} />;
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Weekly Picks - Week {weekNumber}</CardTitle>
          <CardDescription>Loading games...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Weekly Picks - Week {weekNumber}</span>
            <Button variant="outline" size="sm" onClick={handleChangeUser}>
              Change User
            </Button>
          </CardTitle>
          <CardDescription>
            Making picks as <strong>{selectedUser.name}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {errors.length > 0 && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <h4 className="font-medium text-red-800 mb-2">Please fix the following errors:</h4>
              <ul className="text-red-700 text-sm space-y-1">
                {errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-4">
            {games.map((game, index) => {
              const pick = picks.find(p => p.game_id === game.id);
              const isIncomplete = !pick?.predicted_winner || pick?.confidence_points === 0;
              const isLocked = new Date(game.kickoff_time) <= new Date() || game.status !== 'scheduled';
              
              return (
                <div 
                  key={game.id} 
                  className={`p-4 border rounded-lg ${
                    isIncomplete ? 'border-red-300 bg-red-50' : 'border-gray-200'
                  } ${isLocked ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium">
                      {game.away_team} @ {game.home_team}
                    </h3>
                    {isLocked && (
                      <span className="text-sm text-gray-500">🔒 Locked</span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Pick Winner</label>
                      <select
                        value={pick?.predicted_winner || ''}
                        onChange={(e) => handlePickChange(game.id, 'predicted_winner', e.target.value)}
                        disabled={isLocked}
                        className={`w-full p-2 border rounded-md ${
                          isIncomplete ? 'border-red-300' : 'border-gray-300'
                        }`}
                      >
                        <option value="">Select winner...</option>
                        <option value="away">{game.away_team}</option>
                        <option value="home">{game.home_team}</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">Confidence Points</label>
                      <select
                        value={pick?.confidence_points || 0}
                        onChange={(e) => handlePickChange(game.id, 'confidence_points', parseInt(e.target.value))}
                        disabled={isLocked}
                        className={`w-full p-2 border rounded-md ${
                          isIncomplete ? 'border-red-300' : 'border-gray-300'
                        }`}
                      >
                        <option value={0}>Select points...</option>
                        {Array.from({ length: games.length }, (_, i) => i + 1).map(points => (
                          <option key={points} value={points}>
                            {points} point{points !== 1 ? 's' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  {isIncomplete && (
                    <p className="text-red-600 text-sm mt-2">
                      Please select both a winner and confidence points
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex gap-2">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || errors.length > 0}
              className="flex-1"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Picks'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
