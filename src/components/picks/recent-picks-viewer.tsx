'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Eye, Lock, Unlock, Trophy, Target } from 'lucide-react';
import { Game } from '@/types/game';
import { getShortTeamName } from '@/lib/utils';

interface RecentPicksViewerProps {
  poolId: string;
  participantId: string;
  participantName: string;
  weekNumber: number;
  seasonType: number;
  games: Game[];
  canUnlock: boolean;
  onUnlock: (participantId: string) => Promise<void>;
}

interface Pick {
  id: string;
  game_id: string;
  predicted_winner: string;
  confidence_points: number;
  created_at: string;
}

export function RecentPicksViewer({ 
  poolId, 
  participantId, 
  participantName, 
  weekNumber, 
  seasonType, 
  games,
  canUnlock,
  onUnlock 
}: RecentPicksViewerProps) {
  const [picks, setPicks] = useState<Pick[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadRecentPicks();
  }, [poolId, participantId, weekNumber, seasonType]);

  const loadRecentPicks = async () => {
    try {
      setIsLoading(true);
      const { getSupabaseClient } = await import('@/lib/supabase');
      const supabase = getSupabaseClient();
      
      const { data, error } = await supabase
        .from('picks')
        .select(`
          id,
          game_id,
          predicted_winner,
          confidence_points,
          created_at,
          games!inner(week, season_type, home_team, away_team, kickoff_time)
        `)
        .eq('participant_id', participantId)
        .eq('pool_id', poolId)
        .eq('games.week', weekNumber)
        .eq('games.season_type', seasonType)
        .order('confidence_points', { ascending: false });

      if (error) {
        throw error;
      }

      setPicks(data || []);
    } catch (error) {
      console.error('Error loading recent picks:', error);
      toast({
        title: "Error",
        description: "Failed to load recent picks",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlock = async () => {
    setIsUnlocking(true);
    try {
      await onUnlock(participantId);
      setPicks([]); // Clear picks after unlock
    } finally {
      setIsUnlocking(false);
    }
  };

  const getSeasonTypeName = (seasonType: number) => {
    switch (seasonType) {
      case 1: return 'Preseason';
      case 2: return 'Regular Season';
      case 3: return 'Postseason';
      default: return 'Unknown';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (picks.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="text-gray-500">
            <Target className="h-8 w-8 mx-auto mb-2" />
            <p>No picks found for this week</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalPoints = picks.reduce((sum, pick) => sum + pick.confidence_points, 0);
  const submittedAt = new Date(picks[0]?.created_at || '');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Recent Picks - {participantName}
            </CardTitle>
            <CardDescription>
              Week {weekNumber} • {getSeasonTypeName(seasonType)} • Submitted {submittedAt.toLocaleString()}
            </CardDescription>
          </div>
          {canUnlock && (
            <Button
              onClick={handleUnlock}
              disabled={isUnlocking}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              {isUnlocking ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
              ) : (
                <Unlock className="h-4 w-4" />
              )}
              {isUnlocking ? 'Unlocking...' : 'Unlock Picks'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-blue-600">Total Confidence Points</div>
                <div className="text-2xl font-bold text-blue-900">{totalPoints}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-blue-600">Games Picked</div>
                <div className="text-2xl font-bold text-blue-900">{picks.length}</div>
              </div>
            </div>
          </div>

          {/* Picks List */}
          <div className="space-y-3">
            {picks.map((pick) => {
              const game = games.find(g => g.id === pick.game_id);
              if (!game) return null;

              return (
                <div key={pick.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {pick.confidence_points} pts
                      </Badge>
                      <span className="text-sm font-medium">
                        {window.innerWidth < 640 ? getShortTeamName(game.away_team) : game.away_team} @ {window.innerWidth < 640 ? getShortTeamName(game.home_team) : game.home_team}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      Pick: <span className="font-medium">{pick.predicted_winner}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    {game.winner && (
                      <Badge 
                        variant={pick.predicted_winner === game.winner ? "default" : "destructive"}
                        className="text-xs"
                      >
                        {pick.predicted_winner === game.winner ? '✓ Correct' : '✗ Wrong'}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Lock Status */}
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
            <Lock className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-600">
              Picks are locked and cannot be modified
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
