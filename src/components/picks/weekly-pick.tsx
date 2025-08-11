'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// import { Separator } from '@/components/ui/separator';
import { loadCurrentWeek } from '@/actions/loadCurrentWeek';
import { loadWeekGames } from '@/actions/loadWeekGames';
import { submitPicks } from '@/actions/submitPicks';
import { useAuth } from '@/lib/auth';
import { format } from 'date-fns';
import { Calendar, Clock, Trophy } from 'lucide-react';

interface Game {
  id: string;
  home_team: string;
  away_team: string;
  kickoff_time: string;
  home_score: number | null;
  away_score: number | null;
  winner: string | null;
  week: number;
  season: number;
}

interface Pick {
  gameId: string;
  pickedTeam: string | null;
  confidencePoints: number | null;
}

export function WeeklyPicks() {
  const { user } = useAuth();
  const [picks, setPicks] = useState<Pick[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentWeek, setCurrentWeek] = useState<{ week_number: number } | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const weekData = await loadCurrentWeek();
        setCurrentWeek(weekData);
        
        if (weekData) {
          const gamesData = await loadWeekGames(weekData.week_number);
          setGames(gamesData);
          
          // Initialize picks array
          setPicks(gamesData.map(game => ({
            gameId: game.id,
            pickedTeam: null,
            confidencePoints: null,
          })));
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const updatePick = (gameId: string, pickedTeam: string | null) => {
    setPicks(prev => prev.map(pick => 
      pick.gameId === gameId 
        ? { ...pick, pickedTeam }
        : pick
    ));
  };

  const updateConfidence = (gameId: string, confidencePoints: number) => {
    setPicks(prev => {
      // Remove this confidence from other picks first
      const updated = prev.map(pick => 
        pick.confidencePoints === confidencePoints 
          ? { ...pick, confidencePoints: null }
          : pick
      );
      
      // Set new confidence
      return updated.map(pick => 
        pick.gameId === gameId 
          ? { ...pick, confidencePoints }
          : pick
      );
    });
  };

  const getAvailableConfidencePoints = (currentGameId: string) => {
    const usedPoints = picks
      .filter(pick => pick.gameId !== currentGameId && pick.confidencePoints)
      .map(pick => pick.confidencePoints);
    
    return Array.from({ length: games.length }, (_, i) => i + 1)
      .filter(point => !usedPoints.includes(point));
  };

  const isGameLocked = (game: Game) => {
    const gameTime = new Date(game.kickoff_time);
    const now = new Date();
    return now >= gameTime;
  };

  const handleSubmit = async () => {
    if (!user) {
      console.error('User not authenticated');
      return;
    }

    const incompletePicks = picks.filter(pick => !pick.pickedTeam || !pick.confidencePoints);
    if (incompletePicks.length > 0) {
      console.error('Please complete all picks before submitting');
      return;
    }

    setIsSubmitting(true);
    try {
      const picksToSubmit = picks.map(pick => ({
        participant_id: user.id || '',
        pool_id: '1', // Default pool for now
        game_id: pick.gameId,
        predicted_winner: pick.pickedTeam!,
        confidence_points: pick.confidencePoints!,
      }));

      await submitPicks(picksToSubmit);
      console.log('Picks submitted successfully');
    } catch (error) {
      console.error('Error submitting picks:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Weekly Picks</h2>
          <Button disabled>Submit Picks</Button>
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-100 rounded"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-100 rounded"></div>
                  <div className="h-4 bg-gray-100 rounded w-3/4"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!currentWeek) {
    return (
      <div className="text-center py-12">
        <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Active Week</h3>
        <p className="text-gray-600">There is no active week for picks at this time.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Week {currentWeek.week_number} Picks</h2>
          <p className="text-gray-600">Make your picks and assign confidence points (1-{games.length})</p>
        </div>
        <Button 
          onClick={handleSubmit} 
          disabled={isSubmitting || picks.some(pick => !pick.pickedTeam || !pick.confidencePoints)}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Picks'}
        </Button>
      </div>

      <div className="space-y-4">
        {games.map((game) => {
          const pick = picks.find(p => p.gameId === game.id);
          const isLocked = isGameLocked(game);
          const availablePoints = getAvailableConfidencePoints(game.id);

          return (
            <Card key={game.id} className={isLocked ? 'opacity-75' : ''}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">
                      {game.away_team} @ {game.home_team}
                    </CardTitle>
                    <CardDescription className="flex items-center space-x-2 mt-1">
                      <Calendar className="h-4 w-4" />
                      <span>{format(new Date(game.kickoff_time), 'EEEE, MMM d, yyyy')}</span>
                      <Clock className="h-4 w-4" />
                      <span>{format(new Date(game.kickoff_time), 'h:mm a')}</span>
                    </CardDescription>
                  </div>
                  {isLocked && (
                    <div className="text-sm text-red-600 font-medium">LOCKED</div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Pick Winner</label>
                    <Select 
                      value={pick?.pickedTeam || ''} 
                      onValueChange={(value) => updatePick(game.id, value)}
                      disabled={isLocked}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select winner..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={game.away_team}>{game.away_team}</SelectItem>
                        <SelectItem value={game.home_team}>{game.home_team}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">Confidence Points</label>
                    <Select 
                      value={pick?.confidencePoints?.toString() || ''} 
                      onValueChange={(value) => updateConfidence(game.id, parseInt(value))}
                      disabled={isLocked}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select points..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availablePoints.map(point => (
                          <SelectItem key={point} value={point.toString()}>
                            {point}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
