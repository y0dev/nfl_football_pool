'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AuthProvider, useAuth } from '@/lib/auth';
import { loadCurrentWeek } from '@/actions/loadCurrentWeek';
import { loadPools } from '@/actions/loadPools';
import { loadLeaderboard } from '@/actions/loadLeaderboard';
import { loadWeekGames } from '@/actions/loadWeekGames';
import { ArrowLeft, Trophy, Users, Calendar, TrendingUp, BarChart3, Eye, EyeOff, Clock, Download, FileSpreadsheet } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Game, LeaderboardEntry } from '@/types/game';

interface Pool {
  id: string;
  name: string;
  description: string;
  created_by: string;
  season: number;
  is_active: boolean;
  created_at: string;
}

function LeaderboardContent() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [currentWeek, setCurrentWeek] = useState(1);
  const [currentSeasonType, setCurrentSeasonType] = useState(2);
  const [selectedPool, setSelectedPool] = useState<string>('');
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedSeasonType, setSelectedSeasonType] = useState(2);
  const [pools, setPools] = useState<Pool[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGamesStarted, setIsGamesStarted] = useState(false);
  const [showDummyData, setShowDummyData] = useState(false);
  const [screenWidth, setScreenWidth] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [allParticipantsSubmitted, setAllParticipantsSubmitted] = useState(false);

  // Dummy data for testing
  const DUMMY_LEADERBOARD_DATA: LeaderboardEntry[] = [
    {
      id: '1',
      participant_id: '1',
      pool_id: selectedPool,
      week: selectedWeek,
      points: 85,
      participants: { name: 'John Smith' },
      game_points: {
        'game1': 12,
        'game2': 8,
        'game3': 15,
        'game4': 10,
        'game5': 6,
        'game6': 14,
        'game7': 8,
        'game8': 12
      }
    },
    {
      id: '2',
      participant_id: '2',
      pool_id: selectedPool,
      week: selectedWeek,
      points: 82,
      participants: { name: 'Sarah Johnson' },
      game_points: {
        'game1': 10,
        'game2': 12,
        'game3': 8,
        'game4': 15,
        'game5': 10,
        'game6': 8,
        'game7': 12,
        'game8': 7
      }
    },
    {
      id: '3',
      participant_id: '3',
      pool_id: selectedPool,
      week: selectedWeek,
      points: 78,
      participants: { name: 'Mike Davis' },
      game_points: {
        'game1': 8,
        'game2': 10,
        'game3': 12,
        'game4': 8,
        'game5': 15,
        'game6': 10,
        'game7': 6,
        'game8': 9
      }
    },
    {
      id: '4',
      participant_id: '4',
      pool_id: selectedPool,
      week: selectedWeek,
      points: 75,
      participants: { name: 'Emily Wilson' },
      game_points: {
        'game1': 15,
        'game2': 6,
        'game3': 10,
        'game4': 12,
        'game5': 8,
        'game6': 6,
        'game7': 10,
        'game8': 8
      }
    },
    {
      id: '5',
      participant_id: '5',
      pool_id: selectedPool,
      week: selectedWeek,
      points: 72,
      participants: { name: 'David Brown' },
      game_points: {
        'game1': 6,
        'game2': 15,
        'game3': 8,
        'game4': 10,
        'game5': 12,
        'game6': 8,
        'game7': 6
      }
    }
  ];

  useEffect(() => {
    const loadData = async () => {
      try {
        const weekData = await loadCurrentWeek();
        setCurrentWeek(weekData?.week_number || 1);
        setCurrentSeasonType(weekData?.season_type || 2);
        setSelectedWeek(weekData?.week_number || 1);
        setSelectedSeasonType(weekData?.season_type || 2);
        
        await loadPoolsData();
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user]);

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (selectedPool && selectedWeek && selectedSeasonType) {
      loadLeaderboardData();
      loadGamesData();
    }
  }, [selectedPool, selectedWeek, selectedSeasonType]);

  useEffect(() => {
    if (games.length > 0 && selectedPool) {
      checkAllParticipantsSubmitted();
    }
  }, [games, selectedPool]);

  const loadPoolsData = async () => {
    try {
      const poolsData = await loadPools(user?.email, user?.is_super_admin);
      setPools(poolsData);
      
      // Auto-select first pool if available
      if (poolsData.length > 0 && !selectedPool) {
        setSelectedPool(poolsData[0].id);
      }
    } catch (error) {
      console.error('Error loading pools:', error);
    }
  };

  const loadLeaderboardData = async () => {
    try {
      const leaderboardData = await loadLeaderboard(selectedPool, selectedWeek);
      setLeaderboard(leaderboardData);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
      setLeaderboard([]);
    }
  };

  const loadGamesData = async () => {
    try {
      const gamesData = await loadWeekGames(selectedWeek, selectedSeasonType);
      setGames(gamesData);
      
      // Check if games have started
      const now = new Date();
      const hasStarted = gamesData.some(game => {
        const gameTime = new Date(game.kickoff_time);
        return gameTime < now;
      });
      setIsGamesStarted(hasStarted);
    } catch (error) {
      console.error('Error loading games:', error);
      setGames([]);
    }
  };

  const checkAllParticipantsSubmitted = async () => {
    try {
      const { getSupabaseClient } = await import('@/lib/supabase');
      const supabase = getSupabaseClient();
      
      // Get total participants in the pool
      const { data: participants, error: participantsError } = await supabase
        .from('participants')
        .select('id')
        .eq('pool_id', selectedPool)
        .eq('is_active', true);

      if (participantsError) {
        console.error('Error fetching participants:', participantsError);
        return;
      }

      // Get participants who have submitted picks for this week
      const { data: submittedPicks, error: picksError } = await supabase
        .from('picks')
        .select('participant_id')
        .eq('pool_id', selectedPool)
        .in('game_id', games.map(game => game.id));

      if (picksError) {
        console.error('Error fetching picks:', picksError);
        return;
      }

      // Count unique participants who have submitted
      const submittedParticipantIds = new Set(submittedPicks.map(pick => pick.participant_id));
      const totalParticipants = participants.length;
      const submittedParticipants = submittedParticipantIds.size;

      setAllParticipantsSubmitted(totalParticipants > 0 && submittedParticipants === totalParticipants);
    } catch (error) {
      console.error('Error checking submission status:', error);
    }
  };

  const exportToExcel = async () => {
    setIsExporting(true);
    try {
      const dataToExport = showDummyData ? DUMMY_LEADERBOARD_DATA : leaderboard;
      const poolName = pools.find(p => p.id === selectedPool)?.name || 'Unknown Pool';
      const seasonTypeName = getSeasonTypeName(selectedSeasonType);
      
      // Create CSV content
      const headers = ['Rank', 'Participant', 'Total Points'];
      games.forEach((game, index) => {
        headers.push(`Game ${index + 1} (${game.away_team} @ ${game.home_team})`);
      });

      const csvContent = [
        headers.join(','),
        ...dataToExport.map((entry, index) => {
          const row = [
            index + 1, // Rank
            `"${entry.participants.name}"`,
            entry.points
          ];
          
          games.forEach(game => {
            row.push(entry.game_points?.[game.id] || 0);
          });
          
          return row.join(',');
        })
      ].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${poolName}_Week${selectedWeek}_${seasonTypeName}_Leaderboard.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: 'Export Successful',
        description: `Leaderboard data exported to Excel format`,
      });
    } catch (error) {
      console.error('Error exporting data:', error);
      toast({
        title: 'Export Failed',
        description: 'Failed to export leaderboard data',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
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

  const getMaxWeeksForSeason = (seasonType: number) => {
    switch (seasonType) {
      case 1: return 4; // Preseason
      case 2: return 18; // Regular Season
      case 3: return 5; // Postseason
      default: return 18;
    }
  };

  const handleSeasonTypeChange = (seasonType: number) => {
    setSelectedSeasonType(seasonType);
    const maxWeeks = getMaxWeeksForSeason(seasonType);
    if (selectedWeek > maxWeeks) {
      setSelectedWeek(1);
    }
  };

  const isScreenTooNarrow = screenWidth < 768;

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Button
                onClick={() => router.push('/admin/dashboard')}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold">Leaderboard Analytics</h1>
            <p className="text-gray-600">
              View detailed leaderboards and performance analytics
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Export Button */}
            {(isGamesStarted || showDummyData || allParticipantsSubmitted) && (
              <Button
                onClick={exportToExcel}
                disabled={isExporting}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
              >
                <FileSpreadsheet className="h-4 w-4" />
                {isExporting ? 'Exporting...' : 'Export to Excel'}
              </Button>
            )}
            {process.env.NEXT_PUBLIC_NODE_ENV === 'development' && (
              <Button
                onClick={() => setShowDummyData(!showDummyData)}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                {showDummyData ? 'Hide' : 'Show'} Test Data
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Export Status Banner */}
      {allParticipantsSubmitted && !isGamesStarted && (
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-5 w-5 text-green-600" />
              <div>
                <h3 className="font-semibold text-green-900">All Participants Submitted</h3>
                <p className="text-green-700 text-sm">
                  All participants have made their picks for this week. You can export the leaderboard data now.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Leaderboard Filters
          </CardTitle>
          <CardDescription>
            Select pool, season type, and week to view leaderboard data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Pool</label>
              <Select value={selectedPool} onValueChange={setSelectedPool}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a pool" />
                </SelectTrigger>
                <SelectContent>
                  {pools.map((pool) => (
                    <SelectItem key={pool.id} value={pool.id}>
                      {pool.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Season Type</label>
              <Select value={selectedSeasonType.toString()} onValueChange={(value) => handleSeasonTypeChange(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select season type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Preseason</SelectItem>
                  <SelectItem value="2">Regular Season</SelectItem>
                  <SelectItem value="3">Postseason</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Week</label>
              <Select value={selectedWeek.toString()} onValueChange={(value) => setSelectedWeek(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select week" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: getMaxWeeksForSeason(selectedSeasonType) }, (_, i) => i + 1).map((week) => (
                    <SelectItem key={week} value={week.toString()}>
                      Week {week}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Selection Info */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">
                {pools.find(p => p.id === selectedPool)?.name || 'No Pool Selected'}
              </h3>
              <p className="text-gray-600">
                {getSeasonTypeName(selectedSeasonType)} - Week {selectedWeek}
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">Games: {games.length}</div>
              <div className="text-sm text-gray-600">Participants: {leaderboard.length}</div>
              {allParticipantsSubmitted && (
                <Badge variant="outline" className="mt-1 border-green-500 text-green-700">
                  All Submitted
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leaderboard Tabs */}
      <Tabs defaultValue="leaderboard" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="leaderboard" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Week {selectedWeek} Leaderboard
              </CardTitle>
              <CardDescription>
                {getSeasonTypeName(selectedSeasonType)} - {pools.find(p => p.id === selectedPool)?.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Show leaderboard hidden message if games haven't started */}
              {!isGamesStarted && !showDummyData && !allParticipantsSubmitted && (
                <div className="text-center py-12">
                  <EyeOff className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Leaderboard Hidden</h3>
                  <p className="text-gray-600 mb-4">
                    Leaderboard will be visible once the first game starts or all participants submit their picks
                  </p>
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                    <Clock className="h-4 w-4" />
                    Games start at {games[0]?.kickoff_time ? new Date(games[0].kickoff_time).toLocaleString() : 'TBD'}
                  </div>
                </div>
              )}

              {/* Show narrow screen message */}
              {isScreenTooNarrow && (isGamesStarted || showDummyData || allParticipantsSubmitted) && (
                <div className="text-center py-8 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
                  <h3 className="text-lg font-semibold text-yellow-900 mb-2">Rotate Your Device</h3>
                  <p className="text-yellow-800">
                    For the best experience viewing the detailed leaderboard, please rotate your device to landscape mode.
                  </p>
                </div>
              )}

              {/* Leaderboard Table */}
              {(isGamesStarted || showDummyData || allParticipantsSubmitted) && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 bg-white z-10">Rank</TableHead>
                        <TableHead className="sticky left-12 bg-white z-10">Participant</TableHead>
                        <TableHead className="text-center">Total</TableHead>
                        <TableHead className="text-center">Correct</TableHead>
                        {games.map((game, index) => (
                          <TableHead key={game.id} className="text-center min-w-[60px]">
                            G{index + 1}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(showDummyData ? DUMMY_LEADERBOARD_DATA : leaderboard).map((entry, index) => (
                        <TableRow key={entry.id}>
                          <TableCell className="sticky left-0 bg-white z-10 font-medium">
                            <div className="flex items-center gap-2">
                              {index === 0 && <Trophy className="h-4 w-4 text-yellow-500" />}
                              {index === 1 && <Trophy className="h-4 w-4 text-gray-400" />}
                              {index === 2 && <Trophy className="h-4 w-4 text-orange-600" />}
                              {index + 1}
                            </div>
                          </TableCell>
                          <TableCell className="sticky left-12 bg-white z-10 font-medium">
                            {entry.participants.name}
                          </TableCell>
                          <TableCell className="text-center font-bold">
                            {entry.points}
                          </TableCell>
                          <TableCell className="text-center">
                            {/* Placeholder for correct/total picks - would need to be calculated */}
                            -
                          </TableCell>
                          {games.map((game, index) => (
                            <TableCell key={game.id} className="text-center">
                              {entry.game_points?.[game.id] || 0}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Analytics Overview
              </CardTitle>
              <CardDescription>
                Statistical analysis of pool performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <Users className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-blue-600">{leaderboard.length}</div>
                    <div className="text-sm text-gray-600">Total Participants</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <Trophy className="h-8 w-8 text-green-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-green-600">
                      {leaderboard.length > 0 ? leaderboard[0].points : 0}
                    </div>
                    <div className="text-sm text-gray-600">Highest Score</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <BarChart3 className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-purple-600">
                      {leaderboard.length > 0 
                        ? Math.round(leaderboard.reduce((sum, entry) => sum + entry.points, 0) / leaderboard.length)
                        : 0
                      }
                    </div>
                    <div className="text-sm text-gray-600">Average Score</div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Performance Trends
              </CardTitle>
              <CardDescription>
                Individual performance tracking and trends
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Performance Graphs</h3>
                <p className="text-gray-600">
                  Detailed performance graphs and trends will be available here.
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  This will include individual participant performance over time, 
                  quarter/season trends, and comparative analytics.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <AuthProvider>
      <LeaderboardContent />
    </AuthProvider>
  );
}
