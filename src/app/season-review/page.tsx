'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft,
  Trophy,
  Medal,
  Award,
  Target,
  TrendingUp,
  Users,
  Calendar,
  BarChart3,
  ChevronRight,
  Star,
  Zap,
  Crown
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { AuthProvider } from '@/lib/auth';
import { getWeekPeriod, getWeekPeriodColor } from '@/lib/utils';

interface Pool {
  id: string;
  name: string;
  season: number;
  created_at: string;
  is_active: boolean;
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
  tie_breaker_question: string | null;
  tie_breaker_answer: number | null;
  winner_tie_breaker_answer: number | null;
  tie_breaker_difference: number | null;
  total_participants: number;
  created_at: string;
}

interface SeasonWinner {
  id: string;
  pool_id: string;
  season: number;
  winner_participant_id: string;
  winner_name: string;
  total_points: number;
  total_correct_picks: number;
  weeks_won: number;
  tie_breaker_used: boolean;
  total_participants: number;
}

interface WeeklyStats {
  week: number;
  total_participants: number;
  total_games: number;
  average_points: number;
  highest_score: number;
  lowest_score: number;
  tie_breakers_used: number;
}

function SeasonReviewContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [pools, setPools] = useState<Pool[]>([]);
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  const [weeklyWinners, setWeeklyWinners] = useState<WeeklyWinner[]>([]);
  const [seasonWinner, setSeasonWinner] = useState<SeasonWinner | null>(null);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        if (user) {
          await loadPools();
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user]);

  const loadPools = async () => {
    try {
      const response = await fetch('/api/test-pools');
      const result = await response.json();
      
      if (result.success) {
        setPools(result.data.activePools || []);
      }
    } catch (error) {
      console.error('Error loading pools:', error);
    }
  };

  const loadPoolData = async (pool: Pool) => {
    setLoadingData(true);
    try {
      // Load weekly winners
      const weeklyResponse = await fetch(`/api/admin/winners/weekly?poolId=${pool.id}&season=${pool.season}`);
      const weeklyResult = await weeklyResponse.json();
      
      // Load season winner
      const seasonResponse = await fetch(`/api/admin/winners/season?poolId=${pool.id}&season=${pool.season}`);
      const seasonResult = await seasonResponse.json();
      
      // Load weekly stats
      const statsResponse = await fetch(`/api/admin/weekly-stats?poolId=${pool.id}&season=${pool.season}`);
      const statsResult = await statsResponse.json();

      if (weeklyResult.success) {
        console.log('weeklyResult', weeklyResult);
        setWeeklyWinners(weeklyResult.weeklyWinners || []);
      }
      
      if (seasonResult.success) {
        console.log('seasonResult', seasonResult);
        setSeasonWinner(seasonResult.seasonWinner);
      }
      
      if (statsResult.success) {
        console.log('statsResult', statsResult);
        setWeeklyStats(statsResult.weeklyStats || []);
      }
      
    } catch (error) {
      console.error('Error loading pool data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const handlePoolChange = (poolId: string) => {
    const pool = pools.find(p => p.id === poolId);
    if (pool) {
      setSelectedPool(pool);
      loadPoolData(pool);
    }
  };


  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push('/pools')}
                  className="p-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Trophy className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-600" />
                <h1 className="text-2xl sm:text-3xl font-bold">Season Review</h1>
              </div>
              <p className="text-sm sm:text-base text-gray-600">
                Review each pool's performance week by week
              </p>
            </div>
          </div>
        </div>

        {/* Pool Selection */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Select Pool to Review
            </CardTitle>
            <CardDescription>
              Choose a pool to view detailed weekly breakdown and statistics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Select onValueChange={handlePoolChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a pool to review..." />
                </SelectTrigger>
                <SelectContent>
                  {pools.map((pool) => (
                    <SelectItem key={pool.id} value={pool.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{pool.name}</span>
                        <Badge variant="outline" className="ml-2">
                          {pool.season}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {selectedPool && (
          <div className="space-y-6">
            {/* Pool Header */}
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-blue-900">{selectedPool.name}</CardTitle>
                    <CardDescription className="text-blue-700">
                      {selectedPool.season} Season Review
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-blue-700 border-blue-300">
                    {selectedPool.season}
                  </Badge>
                </div>
              </CardHeader>
            </Card>

            {loadingData ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading pool data...</p>
                </div>
              </div>
            ) : (
              <Tabs defaultValue="weekly" className="space-y-6">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="weekly">Weekly Breakdown</TabsTrigger>
                  <TabsTrigger value="season">Season Summary</TabsTrigger>
                </TabsList>

                <TabsContent value="weekly" className="space-y-6">
                  {/* Weekly Winners */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Weekly Winners
                      </CardTitle>
                      <CardDescription>
                        Winners for each week of the {selectedPool.season} season
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {weeklyWinners.length > 0 ? (
                        <div className="grid gap-4">
                          {weeklyWinners.map((winner) => (
                            <div key={winner.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                  <Badge className={getWeekPeriodColor(winner.week)}>
                                    {getWeekPeriod(winner.week)}
                                  </Badge>
                                  <span className="font-medium">Week {winner.week}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Crown className="h-4 w-4 text-yellow-600" />
                                  <span className="font-semibold">{winner.winner_name}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-gray-600">
                                <div className="flex items-center gap-1">
                                  <Target className="h-4 w-4" />
                                  <span>
                                    {winner.winner_correct_picks}/
                                    {weeklyStats.find(s => s.week === winner.week)?.total_games || '?'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Star className="h-4 w-4" />
                                  <span>{winner.winner_points} pts</span>
                                </div>
                                {winner.tie_breaker_used && (
                                  <Badge variant="outline" className="text-xs">
                                    Tie Breaker
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          No weekly winners data available
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Weekly Statistics */}
                  {weeklyStats.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <BarChart3 className="h-5 w-5" />
                          Weekly Statistics
                        </CardTitle>
                        <CardDescription>
                          Performance metrics for each week
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-4">
                          {weeklyStats.map((stats) => (
                            <div key={stats.week} className="grid grid-cols-2 md:grid-cols-6 gap-4 p-4 border rounded-lg">
                              <div className="text-center">
                                <div className="font-semibold">Week {stats.week}</div>
                                <div className="text-xs text-muted-foreground">Period</div>
                              </div>
                              <div className="text-center">
                                <div className="font-semibold">{stats.total_participants}</div>
                                <div className="text-xs text-muted-foreground">Participants</div>
                              </div>
                              <div className="text-center">
                                <div className="font-semibold">{stats.total_games}</div>
                                <div className="text-xs text-muted-foreground">Games</div>
                              </div>
                              <div className="text-center">
                                <div className="font-semibold">{stats.average_points.toFixed(1)}</div>
                                <div className="text-xs text-muted-foreground">Avg Points</div>
                              </div>
                              <div className="text-center">
                                <div className="font-semibold text-green-600">{stats.highest_score}</div>
                                <div className="text-xs text-muted-foreground">High Score</div>
                              </div>
                              <div className="text-center">
                                <div className="font-semibold text-red-600">{stats.lowest_score}</div>
                                <div className="text-xs text-muted-foreground">Low Score</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="season" className="space-y-6">
                  {/* Season Winner */}
                  {seasonWinner && (
                    <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-yellow-900">
                          <Trophy className="h-6 w-6" />
                          Season Champion
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-2xl font-bold text-yellow-900">{seasonWinner.winner_name}</h3>
                            <p className="text-yellow-700">Season {seasonWinner.season} Champion</p>
                          </div>
                          <div className="text-right">
                            <div className="text-3xl font-bold text-yellow-600">{seasonWinner.total_points}</div>
                            <div className="text-sm text-yellow-700">Total Points</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 mt-6">
                          <div className="text-center">
                            <div className="text-xl font-semibold text-yellow-800">{seasonWinner.total_correct_picks}</div>
                            <div className="text-sm text-yellow-700">Correct Picks</div>
                          </div>
                          <div className="text-center">
                            <div className="text-xl font-semibold text-yellow-800">{seasonWinner.weeks_won}</div>
                            <div className="text-sm text-yellow-700">Weeks Won</div>
                          </div>
                          <div className="text-center">
                            <div className="text-xl font-semibold text-yellow-800">{seasonWinner.total_participants}</div>
                            <div className="text-sm text-yellow-700">Total Participants</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Season Overview */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Season Overview
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-4 bg-blue-50 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">{weeklyWinners.length}</div>
                          <div className="text-sm text-blue-700">Weeks Completed</div>
                        </div>
                        <div className="text-center p-4 bg-green-50 rounded-lg">
                          <div className="text-2xl font-bold text-green-600">
                            {weeklyWinners.filter(w => w.tie_breaker_used).length}
                          </div>
                          <div className="text-sm text-green-700">Tie Breakers Used</div>
                        </div>
                        <div className="text-center p-4 bg-purple-50 rounded-lg">
                          <div className="text-2xl font-bold text-purple-600">
                            {seasonWinner?.total_participants || 0}
                          </div>
                          <div className="text-sm text-purple-700">Total Participants</div>
                        </div>
                        <div className="text-center p-4 bg-orange-50 rounded-lg">
                          <div className="text-2xl font-bold text-orange-600">
                            {weeklyStats.reduce((sum, stats) => sum + stats.total_games, 0)}
                          </div>
                          <div className="text-sm text-orange-700">Total Games</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            )}
          </div>
        )}

        {!selectedPool && pools.length > 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Select a Pool</h3>
              <p className="text-muted-foreground">
                Choose a pool from the dropdown above to view its season review
              </p>
            </CardContent>
          </Card>
        )}

        {pools.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Pools Available</h3>
              <p className="text-muted-foreground">
                There are no active pools to review at this time
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function SeasonReviewPage() {
  return (
    <AuthProvider>
      <SeasonReviewContent />
    </AuthProvider>
  );
}
