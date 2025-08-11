'use client';

import { useState, useEffect } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { PickConfirmationDialog } from './PickConfirmationDialog';
import loadCurrentWeekAction from '@/actions/loadCurrentWeek';
import loadWeekGamesAction from '@/actions/loadWeekGames';
import submitPicksAction from '@/actions/submitPicks';
import { useAuth } from '@/lib/auth.tsx';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Calendar, Clock, Trophy } from 'lucide-react';

interface Game {
  id: number;
  home_team_id: number;
  away_team_id: number;
  home_team_name: string;
  home_team_abbr: string;
  home_team_city: string;
  away_team_name: string;
  away_team_abbr: string;
  away_team_city: string;
  game_time: string;
  home_score: number | null;
  away_score: number | null;
  is_completed: boolean;
}

interface Pick {
  gameId: number;
  pickedTeamId: number | null;
  confidencePoints: number | null;
}

export function WeeklyPicks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [picks, setPicks] = useState<Pick[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const [currentWeek, loadingWeek] = useLoadAction(loadCurrentWeekAction, []);
  const [games, loadingGames] = useLoadAction(loadWeekGamesAction, [], {
    weekId: currentWeek?.[0]?.id || null,
  });
  
  const [submitPicks] = useMutateAction(submitPicksAction);

  const weekData = currentWeek?.[0];
  const gamesData: Game[] = games || [];

  useEffect(() => {
    // Initialize picks array when games load
    if (gamesData.length > 0) {
      setPicks(gamesData.map(game => ({
        gameId: game.id,
        pickedTeamId: null,
        confidencePoints: null,
      })));
    }
  }, [gamesData]);

  const updatePick = (gameId: number, pickedTeamId: number | null) => {
    setPicks(prev => prev.map(pick => 
      pick.gameId === gameId 
        ? { ...pick, pickedTeamId }
        : pick
    ));
  };

  const updateConfidence = (gameId: number, confidencePoints: number) => {
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

  const getAvailableConfidencePoints = (currentGameId: number) => {
    const usedPoints = picks
      .filter(pick => pick.gameId !== currentGameId && pick.confidencePoints)
      .map(pick => pick.confidencePoints);
    
    return Array.from({ length: gamesData.length }, (_, i) => i + 1)
      .filter(points => !usedPoints.includes(points));
  };

  const canSubmit = picks.every(pick => pick.pickedTeamId && pick.confidencePoints) && picks.length > 0;

  const handleSubmitClick = () => {
    setShowConfirmation(true);
  };

  const handleConfirmSubmit = async () => {
    if (!user || !weekData || !canSubmit) return;

    setIsSubmitting(true);
    try {
      for (const pick of picks) {
        if (pick.pickedTeamId && pick.confidencePoints) {
          await submitPicks({
            participantId: 1, // This should be the actual participant ID from pool membership
            weekId: weekData.id,
            gameId: pick.gameId,
            pickedTeamId: pick.pickedTeamId,
            confidencePoints: pick.confidencePoints,
          });
        }
      }

      toast({
        title: 'Picks Submitted!',
        description: `Your Week ${weekData.week_number} picks have been submitted successfully.`,
      });
      
      setShowConfirmation(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to submit picks. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingWeek || loadingGames) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="h-6 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-100 rounded w-3/4"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!weekData) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Active Week</h3>
          <p className="text-gray-600">There's no active week for picks right now.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Week {weekData.week_number} Picks</h2>
          <p className="text-gray-600">{weekData.season_year} NFL Season</p>
        </div>
        <div className="text-right">
          <div className="flex items-center text-sm text-gray-600 mb-1">
            <Calendar className="h-4 w-4 mr-1" />
            {format(new Date(weekData.start_date), 'MMM d')} - {format(new Date(weekData.end_date), 'MMM d, yyyy')}
          </div>
          <Badge variant={weekData.is_active ? 'default' : 'secondary'}>
            {weekData.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">How Confidence Pool Works</h3>
        <p className="text-blue-800 text-sm">
          Pick the winner of each game and assign confidence points (1-{gamesData.length}). 
          Higher points = more confident. Each point value can only be used once!
        </p>
      </div>

      <div className="space-y-4">
        {gamesData.map((game) => {
          const pick = picks.find(p => p.gameId === game.id);
          const availablePoints = getAvailableConfidencePoints(game.id);
          
          return (
            <Card key={game.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600 flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    {format(new Date(game.game_time), 'EEE, MMM d @ h:mm a')}
                  </div>
                  {game.is_completed && (
                    <Badge variant="secondary">Final</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                  {/* Game Matchup */}
                  <div className="md:col-span-2">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className="font-semibold">{game.away_team_city} {game.away_team_name}</span>
                          <span className="text-gray-500">@</span>
                          <span className="font-semibold">{game.home_team_city} {game.home_team_name}</span>
                        </div>
                        
                        {!game.is_completed && (
                          <div className="flex items-center space-x-4">
                            <Select
                              value={pick?.pickedTeamId?.toString() || ''}
                              onValueChange={(value) => updatePick(game.id, parseInt(value))}
                            >
                              <SelectTrigger className="w-48">
                                <SelectValue placeholder="Pick winner" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={game.away_team_id.toString()}>
                                  {game.away_team_city} {game.away_team_name}
                                </SelectItem>
                                <SelectItem value={game.home_team_id.toString()}>
                                  {game.home_team_city} {game.home_team_name}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        
                        {game.is_completed && (
                          <div className="text-lg font-semibold">
                            {game.away_team_abbr} {game.away_score} - {game.home_score} {game.home_team_abbr}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Confidence Points */}
                  {!game.is_completed && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Confidence Points
                      </label>
                      <Select
                        value={pick?.confidencePoints?.toString() || ''}
                        onValueChange={(value) => updateConfidence(game.id, parseInt(value))}
                        disabled={!pick?.pickedTeamId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {availablePoints.map((points) => (
                            <SelectItem key={points} value={points.toString()}>
                              {points} point{points !== 1 ? 's' : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {gamesData.length > 0 && !gamesData.every(g => g.is_completed) && (
        <div className="flex justify-center pt-6">
          <Button 
            size="lg" 
            onClick={handleSubmitClick}
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit All Picks'}
          </Button>
        </div>
      )}

      <PickConfirmationDialog
        open={showConfirmation}
        onOpenChange={setShowConfirmation}
        picks={picks}
        games={gamesData}
        weekNumber={weekData?.week_number || 0}
        onConfirm={handleConfirmSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
