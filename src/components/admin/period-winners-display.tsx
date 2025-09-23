'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Trophy, Calendar, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PERIOD_WEEKS, SUPER_BOWL_SEASON_TYPE } from '@/lib/utils';

interface PeriodWinner {
  id: string;
  pool_id: string;
  season: number;
  period_name: string;
  winner_participant_id: string;
  winner_name: string;
  winner_points: number;
  winner_correct_picks: number;
  tie_breaker_used: boolean;
  tie_breaker_question?: string;
  total_participants: number;
  created_at: string;
}

interface WeeklyWinner {
  id: string;
  pool_id: string;
  week: number;
  season: number;
  winner_participant_id: string;
  winner_name: string;
  winner_points: number;
  winner_correct_picks: number;
  tie_breaker_used: boolean;
  tie_breaker_question?: string;
  total_participants: number;
  created_at: string;
}

interface AvailablePeriod {
  name: string;
  weeks: number[];
  endWeek: number;
  isCalculated: boolean;
  isCurrent: boolean;
}

interface PeriodWinnersDisplayProps {
  poolId?: string;
  poolName?: string;
  week: number;
  season: number;
  seasonType: number;
  isCommissioner?: boolean;
}

export function PeriodWinnersDisplay({
  poolId,
  poolName,
  week,
  season,
  seasonType,
  isCommissioner = false
}: PeriodWinnersDisplayProps) {
  const [availablePeriods, setAvailablePeriods] = useState<AvailablePeriod[]>([]);
  const [currentPeriod, setCurrentPeriod] = useState<AvailablePeriod | null>(null);
  const [periodWinner, setPeriodWinner] = useState<PeriodWinner | null>(null);
  const [weeklyWinners, setWeeklyWinners] = useState<WeeklyWinner[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Check if this is a period week or Super Bowl
  const isPeriodWeek = PERIOD_WEEKS.includes(week as typeof PERIOD_WEEKS[number]);
  const isSuperBowl = seasonType === SUPER_BOWL_SEASON_TYPE;
  const shouldShowDisplay = isPeriodWeek || isSuperBowl;

  useEffect(() => {
    if (shouldShowDisplay) {
      loadAvailablePeriods();
    }
  }, [poolId, week, season, shouldShowDisplay]);

  const loadAvailablePeriods = async () => {
    setIsLoading(true);
    try {
      const url = poolId 
        ? `/api/periods/available?poolId=${poolId}&season=${season}`
        : `/api/periods/available?season=${season}`;
      
      const response = await fetch(url);
      const result = await response.json();
      
      if (result.success) {
        setAvailablePeriods(result.data.periods);
        
        // Find current period
        const current = result.data.periods.find((p: AvailablePeriod) => p.isCurrent);
        setCurrentPeriod(current || null);
        
        if (current && current.isCalculated) {
          loadPeriodData(current.name);
        }
      } else {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error loading available periods:', error);
      toast({
        title: 'Error',
        description: 'Failed to load period information',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadPeriodData = async (periodName: string) => {
    try {
      const url = poolId 
        ? `/api/periods/leaderboard?poolId=${poolId}&season=${season}&periodName=${encodeURIComponent(periodName)}`
        : `/api/periods/leaderboard?season=${season}&periodName=${encodeURIComponent(periodName)}`;
      
      const response = await fetch(url);
      const result = await response.json();
      
      if (result.success) {
        setPeriodWinner(result.data.periodWinner);
        setWeeklyWinners(result.data.weeklyWinners);
      }
    } catch (error) {
      console.error('Error loading period data:', error);
    }
  };

  const getPeriodUrl = (period: AvailablePeriod) => {
    if (poolId) {
      return `/periods/${poolId}/${season}/${encodeURIComponent(period.name)}`;
    }
    return `/periods/all/${season}/${encodeURIComponent(period.name)}`;
  };

  if (!shouldShowDisplay) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-600" />
          Period Winners
        </CardTitle>
        <CardDescription>
          {isPeriodWeek && `This is a period week (${PERIOD_WEEKS.join(', ')}) where period winners are calculated.`}
          {isSuperBowl && ' This is the Super Bowl where period winners are calculated.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-2">Loading period information...</span>
          </div>
        ) : (
          <>
            {/* Current Period Winner */}
            {currentPeriod && periodWinner && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-yellow-900 flex items-center gap-2">
                      <Trophy className="h-5 w-5" />
                      {currentPeriod.name} Winner
                    </h4>
                    <p className="text-yellow-800">
                      {periodWinner.winner_name} • {periodWinner.winner_points} points
                    </p>
                    {periodWinner.tie_breaker_used && (
                      <Badge variant="secondary" className="mt-1">
                        Tie Breaker Used
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(getPeriodUrl(currentPeriod), '_blank')}
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View Details
                  </Button>
                </div>
              </div>
            )}

            {/* Available Periods */}
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Available Periods
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {availablePeriods.map((period) => (
                  <div
                    key={period.name}
                    className="p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-medium">{period.name}</h5>
                        <p className="text-sm text-gray-600">
                          Weeks {period.weeks.join(', ')}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {period.isCalculated && (
                            <Badge variant="default" className="text-xs">
                              Calculated
                            </Badge>
                          )}
                          {period.isCurrent && (
                            <Badge variant="secondary" className="text-xs">
                              Current
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(getPeriodUrl(period), '_blank')}
                        className="flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {availablePeriods.length === 0 && (
              <Alert>
                <AlertDescription>
                  No periods are available yet. Periods become available after they have ended.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
