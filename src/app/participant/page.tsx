'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { WeeklyPick } from '@/components/picks/weekly-pick';
import { Leaderboard } from '@/components/leaderboard/leaderboard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Trophy, Users, Calendar, Clock, AlertTriangle, Info, Share2, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { loadPools } from '@/actions/loadPools';
import { loadCurrentWeek } from '@/actions/loadCurrentWeek';
import { loadWeekGames, getSeasonTypeFromWeek } from '@/actions/loadWeekGames';

function ParticipantContent() {
  const searchParams = useSearchParams();
  const poolId = searchParams.get('pool');
  const weekParam = searchParams.get('week');
  const seasonTypeParam = searchParams.get('seasonType'); // New parameter for testing
  
  const [poolName, setPoolName] = useState<string>('');
  const [currentWeek, setCurrentWeek] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [games, setGames] = useState<any[]>([]);
  const [isTestMode, setIsTestMode] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const { toast } = useToast();

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Load current week if not provided in URL or if week parameter is empty
      if (!weekParam || weekParam === '') {
        const weekData = await loadCurrentWeek();
        setCurrentWeek(weekData.week_number);
        // Show a helpful message for empty week parameter
        toast({
          title: "Week not specified",
          description: `Showing current week (Week ${weekData.week_number})`,
          duration: 3000,
        });
      } else {
        const weekNumber = parseInt(weekParam);
        if (isNaN(weekNumber) || weekNumber < 1) {
          // Invalid week number, use current week
          const weekData = await loadCurrentWeek();
          setCurrentWeek(weekData.week_number);
          toast({
            title: "Invalid week number",
            description: `Showing current week (Week ${weekData.week_number}) instead`,
            duration: 3000,
          });
        } else {
          setCurrentWeek(weekNumber);
        }
      }

      // Load pool information
      if (poolId) {
        const pools = await loadPools();
        const pool = pools.find(p => p.id === poolId);
        if (pool) {
          setPoolName(pool.name);
        } else {
          setError('Pool not found. Please check the pool link.');
        }
      } else {
        setError('Pool ID is required. Please use a valid pool link.');
      }

      // Load games for the week
      try {
        const gamesData = await loadWeekGames(currentWeek);
        setGames(gamesData);
      } catch (error) {
        console.error('Error loading games:', error);
        toast({
          title: "Warning",
          description: "Could not load games data",
          variant: "destructive",
        });
      }

      // Check if this is test mode (no participants in pool)
      if (poolId) {
        try {
          const { getSupabaseClient } = await import('@/lib/supabase');
          const supabase = getSupabaseClient();
          const { data: participants } = await supabase
            .from('participants')
            .select('id')
            .eq('pool_id', poolId)
            .eq('is_active', true);
          
          if (!participants || participants.length === 0) {
            setIsTestMode(true);
          }
        } catch (error) {
          console.error('Error checking participants:', error);
        }
      }

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error loading participant data:', error);
      setError('Failed to load pool information. Please try again or contact the pool administrator.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        
        // Load current week if not provided in URL or if week parameter is empty
        if (!weekParam || weekParam === '') {
          const weekData = await loadCurrentWeek();
          setCurrentWeek(weekData.week_number);
          // Show a helpful message for empty week parameter
          toast({
            title: "Week not specified",
            description: `Showing current week (Week ${weekData.week_number})`,
            duration: 3000,
          });
        } else {
          const weekNumber = parseInt(weekParam);
          if (isNaN(weekNumber) || weekNumber < 1) {
            // Invalid week number, use current week
            const weekData = await loadCurrentWeek();
            setCurrentWeek(weekData.week_number);
            toast({
              title: "Invalid week number",
              description: `Showing current week (Week ${weekData.week_number}) instead`,
              duration: 3000,
            });
          } else {
            setCurrentWeek(weekNumber);
          }
        }

        // Load pool information
        if (poolId) {
          const pools = await loadPools();
          const pool = pools.find(p => p.id === poolId);
          if (pool) {
            setPoolName(pool.name);
          } else {
            setError('Pool not found. Please check the pool link.');
          }
        } else {
          setError('Pool ID is required. Please use a valid pool link.');
        }

        // Load games for the week
        try {
          const seasonType = getSeasonTypeFromWeek(currentWeek);
          console.log(`Loading games for Week ${currentWeek}, Season Type: ${seasonType}`);
          const gamesData = await loadWeekGames(currentWeek, seasonType);
          setGames(gamesData);
          console.log(`Found ${gamesData.length} games for Week ${currentWeek}`);
        } catch (error) {
          console.error('Error loading games:', error);
          toast({
            title: "Warning",
            description: "Could not load games data",
            variant: "destructive",
          });
        }

        // Check if this is test mode (no participants in pool)
        if (poolId) {
          try {
            const { getSupabaseClient } = await import('@/lib/supabase');
            const supabase = getSupabaseClient();
            const { data: participants } = await supabase
              .from('participants')
              .select('id')
              .eq('pool_id', poolId)
              .eq('is_active', true);
            
            if (!participants || participants.length === 0) {
              setIsTestMode(true);
            }
          } catch (error) {
            console.error('Error checking participants:', error);
          }
        }

        setLastUpdated(new Date());
      } catch (error) {
        console.error('Error loading participant data:', error);
        setError('Failed to load pool information. Please try again or contact the pool administrator.');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [poolId, weekParam]);

  const handleRefresh = async () => {
    setIsLoading(true);
    await loadData();
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${poolName} - Week ${currentWeek} Picks`,
          text: `Join me in making picks for ${poolName} Week ${currentWeek}!`,
          url: url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast({
          title: "Link Copied",
          description: "Pool link copied to clipboard",
        });
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const getDeadlineInfo = () => {
    if (games.length === 0) return null;
    
    const firstGame = games[0];
    const gameTime = new Date(firstGame.kickoff_time);
    const now = new Date();
    const timeDiff = gameTime.getTime() - now.getTime();
    
    if (timeDiff <= 0) {
      return { status: 'locked', message: 'Picks are locked - games have started' };
    }
    
    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours < 1) {
      return { status: 'urgent', message: `Picks close in ${minutes} minutes` };
    } else if (hours < 24) {
      return { status: 'warning', message: `Picks close in ${hours} hours` };
    } else {
      const days = Math.floor(hours / 24);
      return { status: 'info', message: `Picks close in ${days} days` };
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-8 bg-gray-200 rounded"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-red-600">Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href="/">
              <Button>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Floating Back Button for Mobile */}
      <div className="fixed top-4 left-4 z-50 sm:hidden">
        <Link href="/">
          <Button variant="outline" size="sm" className="shadow-lg">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      </div>
      
      <div className="container mx-auto p-4">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Back to Home</span>
                  <span className="sm:hidden">Back</span>
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <Trophy className="h-6 w-6 text-blue-600" />
                <h1 className="text-xl sm:text-2xl font-bold">NFL Confidence Pool</h1>
              </div>
            </div>
          </div>
          
          {/* Pool Info */}
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-gray-500" />
                  <span className="font-semibold text-lg">{poolName}</span>
                  {isTestMode && (
                    <Badge variant="secondary" className="text-xs">Test Mode</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <Badge variant="outline">Week {currentWeek}</Badge>
                  <span className="text-sm text-gray-500">
                    {games.length} games
                  </span>
                </div>
                {lastUpdated && (
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <RefreshCw className="h-3 w-3" />
                    Last updated: {lastUpdated.toLocaleTimeString()}
                  </div>
                )}
              </div>
              
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <div className="text-sm text-gray-600 text-center sm:text-right">
                  <p>Welcome to the pool!</p>
                  <p>Make your picks below to participate.</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span className="hidden sm:inline">Refresh</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleShare}
                    className="flex items-center gap-2"
                  >
                    <Share2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Share</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Deadline Warning */}
          {(() => {
            const deadlineInfo = getDeadlineInfo();
            if (!deadlineInfo) return null;
            
            const getStatusColor = (status: string) => {
              switch (status) {
                case 'urgent': return 'bg-red-50 border-red-200 text-red-800';
                case 'warning': return 'bg-orange-50 border-orange-200 text-orange-800';
                case 'locked': return 'bg-gray-50 border-gray-200 text-gray-800';
                default: return 'bg-blue-50 border-blue-200 text-blue-800';
              }
            };
            
            const getStatusIcon = (status: string) => {
              switch (status) {
                case 'urgent': return <AlertTriangle className="h-4 w-4" />;
                case 'warning': return <Clock className="h-4 w-4" />;
                case 'locked': return <AlertTriangle className="h-4 w-4" />;
                default: return <Info className="h-4 w-4" />;
              }
            };
            
            return (
              <div className={`p-3 rounded-lg border ${getStatusColor(deadlineInfo.status)}`}>
                <div className="flex items-center gap-2">
                  {getStatusIcon(deadlineInfo.status)}
                  <span className="text-sm font-medium">{deadlineInfo.message}</span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Main Content */}
        <Tabs defaultValue="picks" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="picks">Make Picks</TabsTrigger>
            <TabsTrigger value="games">Games ({games.length})</TabsTrigger>
            <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          </TabsList>

          <TabsContent value="picks" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Week {currentWeek} Picks</CardTitle>
                <CardDescription>
                  Select the winner for each game and assign confidence points
                </CardDescription>
              </CardHeader>
              <CardContent>
                <WeeklyPick poolId={poolId!} weekNumber={currentWeek} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="games" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Week {currentWeek} Games</CardTitle>
                <CardDescription>
                  All NFL games for this week
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {games.map((game, index) => {
                    const gameTime = new Date(game.kickoff_time);
                    const isLocked = gameTime < new Date();
                    
                    return (
                      <div key={game.id} className={`p-4 border rounded-lg ${isLocked ? 'bg-gray-50' : 'bg-white'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-semibold text-sm text-gray-600">Game {index + 1}</span>
                              {isLocked && (
                                <Badge variant="secondary" className="text-xs">Locked</Badge>
                              )}
                            </div>
                            <div className="text-lg font-semibold">
                              {game.away_team} @ {game.home_team}
                            </div>
                            <div className="text-sm text-gray-600">
                              {gameTime.toLocaleDateString()} at {gameTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            {game.status && game.status !== 'scheduled' && (
                              <div className="text-sm text-gray-500 mt-1">
                                Status: {game.status}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            {game.winner && (
                              <Badge variant="default" className="bg-green-100 text-green-800">
                                Winner: {game.winner}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {games.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No games found for Week {currentWeek}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leaderboard" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Leaderboard</CardTitle>
                <CardDescription>
                  Current standings for Week {currentWeek}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Leaderboard />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function ParticipantPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-8 bg-gray-200 rounded"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    }>
      <ParticipantContent />
    </Suspense>
  );
}
