'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Trophy, Medal, Award, Users, Calendar, BarChart3 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { debugLog } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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
  week: number;
  winner_name: string;
  winner_points: number;
  winner_correct_picks: number;
  tie_breaker_used: boolean;
  total_participants: number;
}

interface LeaderboardEntry {
  participant_id: string;
  name: string;
  email: string;
  total_points: number;
  total_correct: number;
  total_picks: number;
  weeks_won: number;
  weekly_scores: Array<{
    week: number;
    points: number;
    correct: number;
    total: number;
  }>;
}

interface PeriodInfo {
  name: string;
  weeks: number[];
  totalWeeks: number;
}

export default function PeriodLeaderboardPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  
  const poolId = params.poolId as string;
  const season = params.season as string;
  const periodNumber = parseInt(params.periodName as string);
  
  // Convert period number to period name
  const getPeriodNameFromNumber = (num: number): string => {
    switch (num) {
      case 1: return 'Period 1';
      case 2: return 'Period 2';
      case 3: return 'Period 3';
      case 4: return 'Period 4';
      default: return 'Unknown Period';
    }
  };
  
  const periodName = getPeriodNameFromNumber(periodNumber);

  const [periodWinner, setPeriodWinner] = useState<PeriodWinner | null>(null);
  const [weeklyWinners, setWeeklyWinners] = useState<WeeklyWinner[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [periodInfo, setPeriodInfo] = useState<PeriodInfo | null>(null);
  const [poolName, setPoolName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPeriodData();
  }, [poolId, season, periodNumber]);

  const loadPeriodData = async () => {
    setIsLoading(true);
    try {
      // Fetch period data and pool name in parallel
      const [periodResponse, poolResponse] = await Promise.all([
        fetch(`/api/periods/leaderboard?poolId=${poolId}&season=${season}&periodName=${encodeURIComponent(periodName)}`),
        fetch(`/api/pools/${poolId}`)
      ]);
      
      const periodResult = await periodResponse.json();
      const poolResult = await poolResponse.json();
      
      debugLog('Period data loaded:', periodResult);
      debugLog('Pool data loaded:', poolResult);
      debugLog('Weekly winners count:', periodResult.data?.weeklyWinners?.length || 0);
      debugLog('Period weeks:', periodResult.data?.periodInfo?.weeks || []);
      
      if (periodResult.success) {
        setPeriodWinner(periodResult.data.periodWinner);
        setWeeklyWinners(periodResult.data.weeklyWinners);
        setLeaderboard(periodResult.data.leaderboard);
        setPeriodInfo(periodResult.data.periodInfo);
      } else {
        toast({
          title: 'Error',
          description: periodResult.error,
          variant: 'destructive'
        });
      }

      if (poolResult.success && poolResult.pool) {
        setPoolName(poolResult.pool.name);
      } else {
        console.warn('Failed to load pool name:', poolResult.error);
        setPoolName(`Pool ${poolId.slice(0, 8)}...`);
      }
    } catch (error) {
      console.error('Error loading period data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load period data',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 1:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 2:
        return <Award className="h-5 w-5 text-amber-600" />;
      default:
        return <span className="text-sm font-medium text-gray-500">#{index + 1}</span>;
    }
  };

  const getRankColor = (index: number) => {
    switch (index) {
      case 0:
        return 'bg-yellow-50 border-yellow-200';
      case 1:
        return 'bg-gray-50 border-gray-200';
      case 2:
        return 'bg-amber-50 border-amber-200';
      default:
        return 'bg-white border-gray-200';
    }
  };

  // Prepare chart data for points per week
  const prepareChartData = () => {
    if (!leaderboard || !periodInfo) {
      debugLog('Chart data preparation - missing data:', { leaderboard: !!leaderboard, periodInfo: !!periodInfo });
      return [];
    }

    debugLog('Chart data preparation - leaderboard:', leaderboard);
    debugLog('Chart data preparation - periodInfo:', periodInfo);

    const chartData = [];
    const weeks = periodInfo.weeks;

    // Create data structure for each week
    weeks.forEach(week => {
      const weekData: any = { week: `Week ${week}` };
      
      // Add each participant's points for this week
      leaderboard.forEach(participant => {
        const weeklyScore = participant.weekly_scores.find(score => score.week === week);
        weekData[participant.name] = weeklyScore ? weeklyScore.points : 0;
        debugLog(`Week ${week} - ${participant.name}:`, weeklyScore ? weeklyScore.points : 0);
      });
      
      chartData.push(weekData);
    });

    debugLog('Final chart data:', chartData);
    return chartData;
  };

  const chartData = prepareChartData();

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p>Loading period leaderboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.back()}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{periodName} Leaderboard</h1>
          <p className="text-gray-600">Season {season} • {poolName || `Pool ${poolId.slice(0, 8)}...`}</p>
        </div>
      </div>

      {/* Period Winner */}
      {periodWinner && (
        <Card className="mb-8 border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-800">
              <Trophy className="h-6 w-6" />
              Period Winner
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-yellow-900">{periodWinner.winner_name}</h3>
                <p className="text-yellow-700">
                  {periodWinner.winner_points} points • {periodWinner.winner_correct_picks} correct picks
                </p>
                {periodWinner.tie_breaker_used && (
                  <Badge variant="secondary" className="mt-2">
                    Tie Breaker Used
                  </Badge>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm text-yellow-600">Total Participants</p>
                <p className="text-2xl font-bold text-yellow-900">{periodWinner.total_participants}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="leaderboard" className="space-y-6">
        <TabsList>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="weekly">Weekly Winners</TabsTrigger>
          <TabsTrigger value="chart" className="hidden md:flex">Points Chart</TabsTrigger>
        </TabsList>

        {/* Leaderboard Tab */}
        <TabsContent value="leaderboard" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Period Leaderboard
              </CardTitle>
              <CardDescription>
                {periodInfo && `Weeks ${periodInfo.weeks.join(', ')} • ${periodInfo.totalWeeks} weeks`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {leaderboard.map((participant, index) => (
                  <div
                    key={participant.participant_id}
                    className={`p-4 rounded-lg border ${getRankColor(index)}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {getRankIcon(index)}
                        <div>
                          <h4 className="font-semibold">{participant.name}</h4>
                          <p className="text-sm text-gray-600">{participant.email}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="text-sm text-gray-600">Points</p>
                            <p className="text-xl font-bold">{participant.total_points}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Weeks Won</p>
                            <p className="text-xl font-bold">{participant.weeks_won}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Record</p>
                            <p className="text-xl font-bold">
                              {participant.total_correct}-{participant.total_picks - participant.total_correct}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Weekly Winners Tab */}
        <TabsContent value="weekly" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Weekly Winners
              </CardTitle>
              <CardDescription>
                Winners for each week in {periodName}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {periodInfo && periodInfo.weeks.map((week) => {
                  const winner = weeklyWinners.find(w => w.week === week);
                  debugLog(`Week ${week} winner:`, winner);
                  return (
                    <div key={week} className="p-4 bg-gray-50 rounded-lg border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-bold text-blue-600">W{week}</span>
                          </div>
                          <div>
                            {winner ? (
                              <>
                                <h4 className="font-semibold">{winner.winner_name}</h4>
                                <p className="text-sm text-gray-600">
                                  {winner.winner_points} points • {winner.winner_correct_picks} correct picks
                                </p>
                              </>
                            ) : (
                              <>
                                <h4 className="font-semibold text-gray-500">No Winner</h4>
                                <p className="text-sm text-gray-500">
                                  No picks submitted or all participants had 0 points
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          {winner?.tie_breaker_used && (
                            <Badge variant="secondary">Tie Breaker</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Points Chart Tab - Only visible on iPad and larger screens */}
        <TabsContent value="chart" className="space-y-4 hidden md:block">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Points Per Week Chart
              </CardTitle>
              <CardDescription>
                Visual representation of each participant's points throughout {periodName}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <div className="h-96 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData}
                      margin={{
                        top: 20,
                        right: 30,
                        left: 20,
                        bottom: 20,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="week" 
                        tick={{ fontSize: 12 }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }}
                        label={{ value: 'Points', angle: -90, position: 'insideLeft' }}
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                        formatter={(value: any, name: string) => [value, name]}
                        labelFormatter={(label: string) => label}
                      />
                      <Legend />
                      {leaderboard.map((participant, index) => {
                        // Generate colors for each participant
                        const colors = [
                          '#3b82f6', // blue
                          '#ef4444', // red
                          '#10b981', // green
                          '#f59e0b', // yellow
                          '#8b5cf6', // purple
                          '#06b6d4', // cyan
                          '#84cc16', // lime
                          '#f97316', // orange
                          '#ec4899', // pink
                          '#6b7280', // gray
                        ];
                        const color = colors[index % colors.length];
                        
                        return (
                          <Line
                            key={participant.participant_id}
                            type="monotone"
                            dataKey={participant.name}
                            stroke={color}
                            strokeWidth={2}
                            dot={{ r: 4 }}
                            activeDot={{ r: 6 }}
                            connectNulls={false}
                          />
                        );
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No chart data available</p>
                  <p className="text-sm">Chart will appear when leaderboard data is loaded</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
