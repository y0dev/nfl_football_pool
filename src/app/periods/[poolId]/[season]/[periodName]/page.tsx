'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Trophy, Medal, Award, Users, Calendar, BarChart3 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { debugLog, getRankColor } from '@/lib/utils';
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
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);

  useEffect(() => {
    loadPeriodData();
  }, [poolId, season, periodNumber, periodName]);

  // Initialize selected participants when leaderboard data loads
  useEffect(() => {
    if (leaderboard && leaderboard.length > 0 && selectedParticipants.length === 0) {
      // Select all participants by default
      setSelectedParticipants(leaderboard.map(p => p.name));
    }
  }, [leaderboard, selectedParticipants.length]);

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
      debugLog('Period winner data:', periodResult.data?.periodWinner);
      debugLog('Leaderboard data:', periodResult.data?.leaderboard);
      debugLog('Weekly winners data:', periodResult.data?.weeklyWinners);
      
      if (periodResult.success) {
        // Check if we actually have data, or if it's empty
        const hasData = periodResult.data && (
          periodResult.data.periodWinner || 
          (periodResult.data.leaderboard && periodResult.data.leaderboard.length > 0) ||
          (periodResult.data.weeklyWinners && periodResult.data.weeklyWinners.length > 0)
        );

        debugLog('Has data check:', {
          hasData,
          hasPeriodWinner: !!periodResult.data?.periodWinner,
          leaderboardLength: periodResult.data?.leaderboard?.length || 0,
          weeklyWinnersLength: periodResult.data?.weeklyWinners?.length || 0
        });
        
        if (hasData) {
          // Map API data to expected interface format
          const mappedPeriodWinner = periodResult.data.periodWinner ? {
            id: periodResult.data.periodWinner.id || '',
            pool_id: periodResult.data.periodWinner.pool_id || poolId,
            season: periodResult.data.periodWinner.season || parseInt(season),
            period_name: periodResult.data.periodWinner.period_name || periodName,
            winner_participant_id: periodResult.data.periodWinner.winner_participant_id || '',
            winner_name: periodResult.data.periodWinner.winner_name || 'Unknown',
            winner_points: periodResult.data.periodWinner.winner_points || 0,
            winner_correct_picks: periodResult.data.periodWinner.winner_correct_picks || 0,
            tie_breaker_used: periodResult.data.periodWinner.tie_breaker_used || false,
            tie_breaker_question: periodResult.data.periodWinner.tie_breaker_question || undefined,
            total_participants: periodResult.data.periodWinner.total_participants || 0,
            created_at: periodResult.data.periodWinner.created_at || new Date().toISOString()
          } : null;

          const mappedWeeklyWinners = (periodResult.data.weeklyWinners || []).map((winner: Record<string, unknown>) => ({
            week: winner.week || 0,
            winner_name: winner.winner_name || 'Unknown',
            winner_points: winner.winner_points || 0,
            winner_correct_picks: winner.winner_correct_picks || 0,
            tie_breaker_used: winner.tie_breaker_used || false,
            total_participants: winner.total_participants || 0
          }));

          
          const mappedLeaderboard = (periodResult.data.leaderboard || []).map((entry: Record<string, unknown>) => ({
            participant_id: entry.participant_id || '',
            name: entry.name || 'Unknown',
            email: entry.email || '',
            total_points: entry.total_points || 0,
            total_correct: entry.total_correct || 0,
            total_picks: entry.total_picks || 0,
            weeks_won: entry.weeks_won || 0,
            weekly_scores: entry.weekly_scores || []
          }));

          const mappedPeriodInfo = periodResult.data.periodInfo ? {
            name: periodResult.data.periodInfo.name || '',
            weeks: periodResult.data.periodInfo.weeks || [],
            totalWeeks: periodResult.data.periodInfo.totalWeeks || 0
          } : null;

          debugLog('Mapped period winner:', mappedPeriodWinner);
          debugLog('Mapped weekly winners:', mappedWeeklyWinners);
          debugLog('Mapped leaderboard:', mappedLeaderboard);
          debugLog('Mapped period info:', mappedPeriodInfo);

          setPeriodWinner(mappedPeriodWinner);
          setWeeklyWinners(mappedWeeklyWinners);
          setLeaderboard(mappedLeaderboard);
          setPeriodInfo(mappedPeriodInfo);
        } else {
          // In development, show dummy data if no real data is available
          if (process.env.NODE_ENV === 'development') {
            debugLog('API succeeded but no data found, loading dummy data for development');
            loadDummyData();
          } else {
            toast({
              title: 'No Data',
              description: 'No period data available for this period',
              variant: 'destructive'
            });
          }
        }
      } else {
        // In development, show dummy data if no real data is available
        if (process.env.NODE_ENV === 'development') {
          debugLog('API failed, loading dummy data for development');
          loadDummyData();
        } else {
          toast({
            title: 'Error',
            description: periodResult.error,
            variant: 'destructive'
          });
        }
      }

      if (poolResult.success && poolResult.pool) {
        setPoolName(poolResult.pool.name);
      } else {
        console.warn('Failed to load pool name:', poolResult.error);
        setPoolName(`Pool ${poolId.slice(0, 8)}...`);
      }
    } catch (error) {
      console.error('Error loading period data:', error);
      // In development, show dummy data if there's an error
      if (process.env.NODE_ENV === 'development') {
        debugLog('Error loading period data, loading dummy data for development');
        loadDummyData();
      } else {
        toast({
          title: 'Error',
          description: 'Failed to load period data',
          variant: 'destructive'
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadDummyData = () => {
    debugLog('Loading dummy data for development');
    
    // Generate dummy period weeks based on period number
    const getPeriodWeeks = (periodNum: number): number[] => {
      switch (periodNum) {
        case 1: return [1, 2, 3, 4];
        case 2: return [5, 6, 7, 8, 9];
        case 3: return [10, 11, 12, 13, 14];
        case 4: return [15, 16, 17, 18];
        default: return [1, 2, 3, 4];
      }
    };

    const dummyWeeks = getPeriodWeeks(periodNumber);
    
    // Dummy period winner
    const dummyPeriodWinner: PeriodWinner = {
      id: 'dummy-winner-1',
      pool_id: poolId,
      season: parseInt(season),
      period_name: periodName,
      winner_participant_id: 'dummy-participant-1',
      winner_name: 'John Doe',
      winner_points: 255,
      winner_correct_picks: 32,
      tie_breaker_used: false,
      total_participants: 8,
      created_at: new Date().toISOString()
    };

    // Dummy weekly winners
    const dummyWeeklyWinners: WeeklyWinner[] = dummyWeeks.map((week, index) => ({
      week: week,
      winner_name: ['John Doe', 'Jane Smith', 'Mike Johnson', 'Sarah Wilson', 'Tom Brown'][index % 5],
      winner_points: 15 + Math.floor(Math.random() * 10),
      winner_correct_picks: 3 + Math.floor(Math.random() * 3),
      tie_breaker_used: Math.random() > 0.7,
      total_participants: 8
    }));

    // Dummy leaderboard
    const dummyLeaderboard: LeaderboardEntry[] = [
      {
        participant_id: 'dummy-participant-1',
        name: 'John Doe',
        email: 'john@example.com',
        total_points: 255,
        total_correct: 32,
        total_picks: 64,
        weeks_won: 2,
        weekly_scores: dummyWeeks.map(week => ({
          week: week,
          points: 8 + Math.floor(Math.random() * 8),
          correct: 2 + Math.floor(Math.random() * 3),
          total: 4
        }))
      },
      {
        participant_id: 'dummy-participant-2',
        name: 'Jane Smith',
        email: 'jane@example.com',
        total_points: 252,
        total_correct: 31,
        total_picks: 64,
        weeks_won: 1,
        weekly_scores: dummyWeeks.map(week => ({
          week: week,
          points: 7 + Math.floor(Math.random() * 8),
          correct: 2 + Math.floor(Math.random() * 3),
          total: 4
        }))
      },
      {
        participant_id: 'dummy-participant-3',
        name: 'Mike Johnson',
        email: 'mike@example.com',
        total_points: 248,
        total_correct: 28,
        total_picks: 64,
        weeks_won: 1,
        weekly_scores: dummyWeeks.map(week => ({
          week: week,
          points: 6 + Math.floor(Math.random() * 8),
          correct: 2 + Math.floor(Math.random() * 3),
          total: 4
        }))
      },
      {
        participant_id: 'dummy-participant-4',
        name: 'Sarah Wilson',
        email: 'sarah@example.com',
        total_points: 205,
        total_correct: 27,
        total_picks: 64,
        weeks_won: 0,
        weekly_scores: dummyWeeks.map(week => ({
          week: week,
          points: 5 + Math.floor(Math.random() * 8),
          correct: 1 + Math.floor(Math.random() * 3),
          total: 4
        }))
      },
      {
        participant_id: 'dummy-participant-5',
        name: 'Tom Brown',
        email: 'tom@example.com',
        total_points: 202,
        total_correct: 26,
        total_picks: 64,
        weeks_won: 0,
        weekly_scores: dummyWeeks.map(week => ({
          week: week,
          points: 4 + Math.floor(Math.random() * 8),
          correct: 1 + Math.floor(Math.random() * 3),
          total: 4
        }))
      }
    ];

    // Dummy period info
    const dummyPeriodInfo: PeriodInfo = {
      name: periodName,
      weeks: dummyWeeks,
      totalWeeks: dummyWeeks.length
    };

    debugLog('Setting dummy period winner:', dummyPeriodWinner);
    debugLog('Setting dummy weekly winners:', dummyWeeklyWinners);
    debugLog('Setting dummy leaderboard:', dummyLeaderboard);
    debugLog('Setting dummy period info:', dummyPeriodInfo);
    
    setPeriodWinner(dummyPeriodWinner);
    setWeeklyWinners(dummyWeeklyWinners);
    setLeaderboard(dummyLeaderboard);
    setPeriodInfo(dummyPeriodInfo);
    setPoolName(`Development Pool (${poolId.slice(0, 8)}...)`);
    
    debugLog('Dummy data set successfully');
  };

  const renderRankIcon = (index: number) => {
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

  // Prepare chart data for points per week using selected participants
  const prepareChartData = (): Array<{ week: string; [key: string]: number | string }> => {
    debugLog('Chart data preparation - leaderboard:', leaderboard);
    debugLog('Chart data preparation - selectedParticipants:', selectedParticipants);
    debugLog('Chart data preparation - periodInfo:', periodInfo);

    // Use leaderboard data as primary source (contains all participants)
    if (leaderboard && leaderboard.length > 0 && selectedParticipants.length > 0) {
      debugLog('Using leaderboard data for chart (selected participants)');
      
      // Get weeks from periodInfo or create fallback
      let weeks: number[] = [];
      if (periodInfo && periodInfo.weeks && periodInfo.weeks.length > 0) {
        weeks = periodInfo.weeks;
      } else {
        // Collect weeks from leaderboard weekly_scores
        const weeksFromScores = new Set<number>();
        leaderboard.forEach(participant => {
          participant.weekly_scores?.forEach(score => {
            weeksFromScores.add(score.week);
          });
        });
        weeks = Array.from(weeksFromScores).sort((a, b) => a - b);
      }
      
      // If still no weeks, use default
      if (weeks.length === 0) {
        weeks = [1, 2, 3, 4];
      }
      
      debugLog('Weeks for chart:', weeks);
      debugLog('Selected participants for chart:', selectedParticipants);
      
      const chartData: Array<{ week: string; [key: string]: number | string }> = [];
      
      weeks.forEach(week => {
        const weekData: { week: string; [key: string]: number | string } = { week: `Week ${week}` };
        
        // Only include selected participants
        leaderboard
          .filter(participant => selectedParticipants.includes(participant.name))
          .forEach(participant => {
            const weeklyScore = participant.weekly_scores?.find(score => score.week === week);
            const points = weeklyScore ? weeklyScore.points || 0 : 0;
            weekData[participant.name] = points;
            
            debugLog(`Week ${week} - ${participant.name}: ${points} points`);
          });
        
        chartData.push(weekData);
      });
      
      debugLog('Chart data from leaderboard:', chartData);
      return chartData;
    }
    
    debugLog('No leaderboard data or selected participants available for chart');
    return [];
  };

  const chartData = prepareChartData();
  debugLog('Chart data prepared:', chartData);
  debugLog('Current leaderboard state:', leaderboard);
  debugLog('Current periodInfo state:', periodInfo);

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
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
      {/* Development Dummy Data Banner */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <p className="text-blue-800 font-medium">Development Mode</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadDummyData}
              className="text-blue-700 border-blue-300 hover:bg-blue-100 w-full sm:w-auto"
            >
              Load Dummy Data
            </Button>
          </div>
          <p className="text-blue-700 text-sm mt-1">
            {(!periodWinner || periodWinner.id.startsWith('dummy-')) 
              ? 'Showing dummy data for development. No real period data is available.'
              : 'Click "Load Dummy Data" to test with sample data.'
            }
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6 sm:mb-8">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.back()}
          className="flex items-center gap-2 w-fit"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold truncate">{periodName} Leaderboard</h1>
          <p className="text-gray-600 text-sm sm:text-base truncate">Season {season} • {poolName || `Pool ${poolId.slice(0, 8)}...`}</p>
        </div>
      </div>

      {/* Period Winner */}
      {periodWinner && (
        <Card className="mb-6 sm:mb-8 border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-800">
              <Trophy className="h-6 w-6" />
              Quarter Winner
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="text-xl sm:text-2xl font-bold text-yellow-900 truncate">{periodWinner.winner_name}</h3>
                <p className="text-yellow-700 text-sm sm:text-base">
                  {periodWinner.winner_points} points • {periodWinner.winner_correct_picks} correct picks
                </p>
                {periodWinner.tie_breaker_used && (
                  <Badge variant="secondary" className="mt-2">
                    Tie Breaker Used
                  </Badge>
                )}
              </div>
              <div className="text-center sm:text-right">
                <p className="text-sm text-yellow-600">Total Participants</p>
                <p className="text-xl sm:text-2xl font-bold text-yellow-900">{periodWinner.total_participants}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="leaderboard" className="space-y-4 sm:space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-3">
          <TabsTrigger value="leaderboard" className="text-xs sm:text-sm">Leaderboard</TabsTrigger>
          <TabsTrigger value="weekly" className="text-xs sm:text-sm">Weekly Winners</TabsTrigger>
          <TabsTrigger value="chart" className="hidden md:flex text-xs sm:text-sm">Points Chart</TabsTrigger>
        </TabsList>

        {/* Leaderboard Tab */}
        <TabsContent value="leaderboard" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Quarter Leaderboard
              </CardTitle>
              <CardDescription>
                {periodInfo && `Weeks ${periodInfo.weeks.join(', ')} • ${periodInfo.totalWeeks} weeks`}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-6">
              <div className="space-y-3">
                {leaderboard.map((participant, index) => (
                  <div
                    key={participant.participant_id}
                    className={`p-3 sm:p-4 rounded-lg border ${getRankColor(index)}`}
                  >
                    {/* Mobile-first layout */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      {/* Participant info */}
                      <div className="flex items-center gap-4">
                        {renderRankIcon(index)}
                        <div className="min-w-0 flex-1">
                          <h4 className="font-semibold truncate">{participant.name}</h4>
                          {/* <p className="text-sm text-gray-600 truncate">{participant.email}</p> */}
                        </div>
                      </div>
                      
                      {/* Stats - responsive grid layout */}
                      <div className="grid grid-cols-3 gap-4 sm:flex sm:items-center sm:gap-6">
                        <div className="text-center sm:text-right">
                          <p className="text-xs sm:text-sm text-gray-600">Points</p>
                          <p className="text-lg sm:text-xl font-bold">{participant.total_points}</p>
                        </div>
                        <div className="text-center sm:text-right">
                          <p className="text-xs sm:text-sm text-gray-600">Weeks Won</p>
                          <p className="text-lg sm:text-xl font-bold">{participant.weeks_won}</p>
                        </div>
                        <div className="text-center sm:text-right">
                          <p className="text-xs sm:text-sm text-gray-600">Record</p>
                          <p className="text-lg sm:text-xl font-bold">
                            {participant.total_correct}-{participant.total_picks}
                          </p>
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
            <CardContent className="p-3 sm:p-6">
              <div className="space-y-3">
                {periodInfo && periodInfo.weeks.map((week) => {
                  const winner = weeklyWinners.find(w => w.week === week);
                  debugLog(`Week ${week} winner:`, winner);
                  return (
                    <div key={week} className="p-3 sm:p-4 bg-gray-50 rounded-lg border">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                        {/* Week indicator and winner info */}
                        <div className="flex items-start gap-3 sm:gap-4">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-sm font-bold text-blue-600">W{week}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            {winner ? (
                              <>
                                <h4 className="font-semibold text-base sm:text-lg truncate">{winner.winner_name}</h4>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mt-1">
                                  <span className="text-sm text-gray-600">
                                    <span className="font-medium text-blue-600">{winner.winner_points}</span> points
                                  </span>
                                  <span className="hidden sm:inline text-gray-400">•</span>
                                  <span className="text-sm text-gray-600">
                                    <span className="font-medium text-green-600">{winner.winner_correct_picks}</span> correct picks
                                  </span>
                                </div>
                              </>
                            ) : (
                              <>
                                <h4 className="font-semibold text-gray-500 text-base sm:text-lg">No Winner</h4>
                                <p className="text-sm text-gray-500 mt-1">
                                  No picks submitted or all participants had 0 points
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                        
                        {/* Tie breaker badge */}
                        {winner?.tie_breaker_used && (
                          <div className="flex justify-start sm:justify-end">
                            <Badge variant="secondary" className="text-xs sm:text-sm">
                              Tie Breaker Used
                            </Badge>
                          </div>
                        )}
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
                Visual representation of each participant&apos;s points throughout {periodName}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-6">
              {/* Participant Selection */}
              <div className="mb-6">
                <h4 className="text-sm font-medium mb-3">Select Participants to Display:</h4>
                <div className="flex flex-wrap gap-2">
                  {leaderboard.map((participant) => (
                    <label
                      key={participant.participant_id}
                      className="flex items-center space-x-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedParticipants.includes(participant.name)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedParticipants(prev => [...prev, participant.name]);
                          } else {
                            setSelectedParticipants(prev => prev.filter(name => name !== participant.name));
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{participant.name}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setSelectedParticipants(leaderboard.map(p => p.name))}
                    className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setSelectedParticipants([])}
                    className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    Clear All
                  </button>
                </div>
              </div>
              
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
                        formatter={(value: number, name: string) => [value, name]}
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
              ) : selectedParticipants.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No participants selected</p>
                  <p className="text-sm">Select participants above to display their points on the chart</p>
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
