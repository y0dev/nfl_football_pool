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
import { loadLeaderboardWithPicks, LeaderboardEntryWithPicks, PickData } from '@/actions/loadPicksForLeaderboard';
import { ArrowLeft, Trophy, Users, Calendar, TrendingUp, BarChart3, Eye, EyeOff, Clock, Download, FileSpreadsheet, Target } from 'lucide-react';
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
  const [leaderboardWithPicks, setLeaderboardWithPicks] = useState<LeaderboardEntryWithPicks[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [seasonPerformanceData, setSeasonPerformanceData] = useState<{[week: number]: LeaderboardEntryWithPicks[]}>({});
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
      // Load both old and new leaderboard data
      const [leaderboardData, leaderboardWithPicksData] = await Promise.all([
        loadLeaderboard(selectedPool, selectedWeek),
        loadLeaderboardWithPicks(selectedPool, selectedWeek, selectedSeasonType)
      ]);
      
      setLeaderboard(leaderboardData);
      setLeaderboardWithPicks(leaderboardWithPicksData);
      
      // Load season performance data for trends
      await loadSeasonPerformanceData();
    } catch (error) {
      console.error('Error loading leaderboard:', error);
      setLeaderboard([]);
      setLeaderboardWithPicks([]);
    }
  };

  const loadSeasonPerformanceData = async () => {
    try {
      const maxWeeks = getMaxWeeksForSeason(selectedSeasonType);
      const seasonData: {[week: number]: LeaderboardEntryWithPicks[]} = {};
      
      // Load data for all weeks in the season type
      for (let week = 1; week <= maxWeeks; week++) {
        try {
          const weekData = await loadLeaderboardWithPicks(selectedPool, week, selectedSeasonType);
          if (weekData.length > 0) {
            seasonData[week] = weekData;
          }
        } catch (error) {
          console.error(`Error loading week ${week} data:`, error);
        }
      }
      
      setSeasonPerformanceData(seasonData);
    } catch (error) {
      console.error('Error loading season performance data:', error);
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
      const dataToExport = showDummyData ? DUMMY_LEADERBOARD_DATA : leaderboardWithPicks;
      const isDummyData = showDummyData;
      const poolName = pools.find(p => p.id === selectedPool)?.name || 'Unknown Pool';
      const seasonTypeName = getSeasonTypeName(selectedSeasonType);
      
      // Create CSV content
      const headers = ['Rank', 'Participant', 'Total Points', 'Correct Picks', 'Total Picks'];
      games.forEach((game, index) => {
        headers.push(`${getTeamAbbreviation(game.away_team)} @ ${getTeamAbbreviation(game.home_team)} (Pick)`);
        headers.push(`${getTeamAbbreviation(game.away_team)} @ ${getTeamAbbreviation(game.home_team)} (Confidence)`);
      });

      const csvContent = [
        headers.join(','),
        ...dataToExport.map((entry, index) => {
          let row: (string | number)[] = [];
          
          if (isDummyData) {
            // Handle dummy data
            const dummyEntry = entry as LeaderboardEntry;
            row = [
              index + 1, // Rank
              `"${dummyEntry.participants.name}"`,
              dummyEntry.points,
              '-', // Correct picks not available in dummy data
              '-', // Total picks not available in dummy data
            ];
          } else {
            // Handle real data
            const realEntry = entry as LeaderboardEntryWithPicks;
            row = [
              index + 1, // Rank
              `"${realEntry.participant_name}"`,
              realEntry.total_points,
              realEntry.correct_picks,
              realEntry.total_picks
            ];
          }
          
          games.forEach(game => {
            if (isDummyData) {
              // For dummy data, use game points as before
              const gamePoints = (entry as LeaderboardEntry).game_points?.[game.id] || 0;
              row.push(gamePoints);
              row.push('-'); // No confidence data for dummy
            } else {
              // For real data, show both pick and confidence
              const realEntry = entry as LeaderboardEntryWithPicks;
              const pick = realEntry.picks.find(p => p.game_id === game.id);
              const confidence = pick?.confidence_points || 0;
              const predictedWinner = pick?.predicted_winner || '';
              row.push(predictedWinner ? getTeamAbbreviation(predictedWinner) : '-');
              row.push(confidence);
            }
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

  const getTeamAbbreviation = (teamName: string) => {
    const abbreviations: { [key: string]: string } = {
      'New England Patriots': 'NE',
      'Buffalo Bills': 'BUF',
      'Miami Dolphins': 'MIA',
      'New York Jets': 'NYJ',
      'Baltimore Ravens': 'BAL',
      'Cincinnati Bengals': 'CIN',
      'Cleveland Browns': 'CLE',
      'Pittsburgh Steelers': 'PIT',
      'Houston Texans': 'HOU',
      'Indianapolis Colts': 'IND',
      'Jacksonville Jaguars': 'JAX',
      'Tennessee Titans': 'TEN',
      'Kansas City Chiefs': 'KC',
      'Las Vegas Raiders': 'LV',
      'Los Angeles Chargers': 'LAC',
      'Denver Broncos': 'DEN',
      'Dallas Cowboys': 'DAL',
      'New York Giants': 'NYG',
      'Philadelphia Eagles': 'PHI',
      'Washington Commanders': 'WAS',
      'Chicago Bears': 'CHI',
      'Detroit Lions': 'DET',
      'Green Bay Packers': 'GB',
      'Minnesota Vikings': 'MIN',
      'Atlanta Falcons': 'ATL',
      'Carolina Panthers': 'CAR',
      'New Orleans Saints': 'NO',
      'Tampa Bay Buccaneers': 'TB',
      'Arizona Cardinals': 'ARI',
      'Los Angeles Rams': 'LAR',
      'San Francisco 49ers': 'SF',
      'Seattle Seahawks': 'SEA'
    };
    return abbreviations[teamName] || teamName.split(' ').map(word => word[0]).join('').toUpperCase();
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
              <div className="text-sm text-gray-600">Participants: {leaderboardWithPicks.length}</div>
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
                          <TableHead key={game.id} className="text-center min-w-[100px]">
                            <div className="text-xs font-medium">
                              {getTeamAbbreviation(game.away_team)} @ {getTeamAbbreviation(game.home_team)}
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(showDummyData ? DUMMY_LEADERBOARD_DATA : leaderboardWithPicks).map((entry, index) => {
                        const isDummy = showDummyData;
                        const participantName = isDummy 
                          ? (entry as LeaderboardEntry).participants.name 
                          : (entry as LeaderboardEntryWithPicks).participant_name;
                        const totalPoints = isDummy 
                          ? (entry as LeaderboardEntry).points 
                          : (entry as LeaderboardEntryWithPicks).total_points;
                        const correctPicks = isDummy 
                          ? '-' 
                          : (entry as LeaderboardEntryWithPicks).correct_picks;
                        const totalPicks = isDummy 
                          ? '-' 
                          : (entry as LeaderboardEntryWithPicks).total_picks;
                        
                        return (
                          <TableRow key={isDummy ? (entry as LeaderboardEntry).id : (entry as LeaderboardEntryWithPicks).participant_id}>
                            <TableCell className="sticky left-0 bg-white z-10 font-medium">
                              <div className="flex items-center gap-2">
                                {index === 0 && <Trophy className="h-4 w-4 text-yellow-500" />}
                                {index === 1 && <Trophy className="h-4 w-4 text-gray-400" />}
                                {index === 2 && <Trophy className="h-4 w-4 text-orange-600" />}
                                {index + 1}
                              </div>
                            </TableCell>
                            <TableCell className="sticky left-12 bg-white z-10 font-medium">
                              {participantName}
                            </TableCell>
                            <TableCell className="text-center font-bold">
                              {totalPoints}
                            </TableCell>
                            <TableCell className="text-center">
                              {isDummy ? '-' : `${correctPicks}/${totalPicks}`}
                            </TableCell>
                                                      {games.map((game, gameIndex) => {
                            if (isDummy) {
                              return (
                                <TableCell key={game.id} className="text-center">
                                  {(entry as LeaderboardEntry).game_points?.[game.id] || 0}
                                </TableCell>
                              );
                            } else {
                              const realEntry = entry as LeaderboardEntryWithPicks;
                              const pick = realEntry.picks.find(p => p.game_id === game.id);
                              const isCorrect = pick && game.winner && pick.predicted_winner === game.winner;
                              const confidence = pick?.confidence_points || 0;
                              
                              return (
                                <TableCell key={game.id} className="text-center">
                                  <div className="text-xs">
                                    <div className={`font-medium ${
                                      game.status !== 'final' ? 'text-yellow-800' :
                                      isCorrect ? 'text-green-800' : 'text-red-800'
                                    }`}>
                                      {pick?.predicted_winner ? getTeamAbbreviation(pick.predicted_winner) : '-'}
                                    </div>
                                    <div className={`inline-block px-1 py-0.5 rounded text-xs font-mono ${
                                      confidence === 0 ? 'bg-gray-100 text-gray-500' :
                                      game.status !== 'final' ? 'bg-yellow-100 text-yellow-800' :
                                      isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                    }`}>
                                      {confidence}
                                    </div>
                                  </div>
                                </TableCell>
                              );
                            }
                          })}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <div className="space-y-6">
            {/* Key Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Key Metrics - {getSeasonTypeName(selectedSeasonType)} Week {selectedWeek}
                </CardTitle>
                <CardDescription>
                  Statistical analysis of pool performance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <Users className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-blue-600">{leaderboardWithPicks.length}</div>
                      <div className="text-sm text-gray-600">Participants</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <Trophy className="h-8 w-8 text-green-600 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-green-600">
                        {leaderboardWithPicks.length > 0 ? leaderboardWithPicks[0].total_points : 0}
                      </div>
                      <div className="text-sm text-gray-600">Best Score</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <BarChart3 className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-purple-600">
                        {leaderboardWithPicks.length > 0 
                          ? Math.round(leaderboardWithPicks.reduce((sum, entry) => sum + entry.total_points, 0) / leaderboardWithPicks.length)
                          : 0
                        }
                      </div>
                      <div className="text-sm text-gray-600">Avg Score</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <Target className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-orange-600">
                        {leaderboardWithPicks.length > 0 
                          ? Math.round((leaderboardWithPicks.reduce((sum, entry) => sum + entry.correct_picks, 0) / 
                                       leaderboardWithPicks.reduce((sum, entry) => sum + entry.total_picks, 0)) * 100)
                          : 0
                        }%
                      </div>
                      <div className="text-sm text-gray-600">Pick Accuracy</div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>

            {/* Performance Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Performance Distribution
                </CardTitle>
                <CardDescription>
                  How participants performed across different score ranges
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-3">Score Ranges</h4>
                    <div className="space-y-2">
                      {(() => {
                        const ranges = [
                          { min: 0, max: 50, label: '0-50', color: 'bg-red-100 text-red-800' },
                          { min: 51, max: 80, label: '51-80', color: 'bg-yellow-100 text-yellow-800' },
                          { min: 81, max: 110, label: '81-110', color: 'bg-blue-100 text-blue-800' },
                          { min: 111, max: 136, label: '111-136', color: 'bg-green-100 text-green-800' }
                        ];
                        
                        return ranges.map(range => {
                          const count = leaderboardWithPicks.filter(entry => 
                            entry.total_points >= range.min && entry.total_points <= range.max
                          ).length;
                          const percentage = leaderboardWithPicks.length > 0 
                            ? Math.round((count / leaderboardWithPicks.length) * 100)
                            : 0;
                          
                          return (
                            <div key={range.label} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${range.color.split(' ')[0]}`}></div>
                                <span className="text-sm font-medium">{range.label}</span>
                              </div>
                              <div className="text-sm text-gray-600">
                                {count} ({percentage}%)
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-3">Pick Accuracy Ranges</h4>
                    <div className="space-y-2">
                      {(() => {
                        const accuracyRanges = [
                          { min: 0, max: 25, label: '0-25%', color: 'bg-red-100 text-red-800' },
                          { min: 26, max: 50, label: '26-50%', color: 'bg-orange-100 text-orange-800' },
                          { min: 51, max: 75, label: '51-75%', color: 'bg-yellow-100 text-yellow-800' },
                          { min: 76, max: 100, label: '76-100%', color: 'bg-green-100 text-green-800' }
                        ];
                        
                        return accuracyRanges.map(range => {
                          const count = leaderboardWithPicks.filter(entry => {
                            const accuracy = entry.total_picks > 0 
                              ? Math.round((entry.correct_picks / entry.total_picks) * 100)
                              : 0;
                            return accuracy >= range.min && accuracy <= range.max;
                          }).length;
                          const percentage = leaderboardWithPicks.length > 0 
                            ? Math.round((count / leaderboardWithPicks.length) * 100)
                            : 0;
                          
                          return (
                            <div key={range.label} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${range.color.split(' ')[0]}`}></div>
                                <span className="text-sm font-medium">{range.label}</span>
                              </div>
                              <div className="text-sm text-gray-600">
                                {count} ({percentage}%)
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Game Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Game Analysis
                </CardTitle>
                <CardDescription>
                  Performance breakdown by individual games
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-3">Most Challenging Games</h4>
                    <div className="space-y-2">
                      {games
                        .map(game => {
                          const gamePicks = leaderboardWithPicks.flatMap(entry => 
                            entry.picks.filter(pick => pick.game_id === game.id)
                          );
                          const correctPicks = gamePicks.filter(pick => 
                            pick.predicted_winner === game.winner
                          ).length;
                          const accuracy = gamePicks.length > 0 
                            ? Math.round((correctPicks / gamePicks.length) * 100)
                            : 0;
                          
                          return { game, accuracy, correctPicks, totalPicks: gamePicks.length };
                        })
                        .sort((a, b) => a.accuracy - b.accuracy)
                        .slice(0, 5)
                        .map((gameData, index) => (
                          <div key={gameData.game.id} className="flex items-center justify-between p-2 bg-red-50 rounded border border-red-200">
                            <div className="text-sm">
                              <div className="font-medium text-red-800">
                                {getTeamAbbreviation(gameData.game.away_team)} @ {getTeamAbbreviation(gameData.game.home_team)}
                              </div>
                              <div className="text-xs text-red-600">{gameData.correctPicks}/{gameData.totalPicks} correct</div>
                            </div>
                            <Badge variant={gameData.accuracy >= 70 ? "default" : gameData.accuracy >= 50 ? "secondary" : "destructive"}>
                              {gameData.accuracy}%
                            </Badge>
                          </div>
                        ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-3">Easiest Games</h4>
                    <div className="space-y-2">
                      {games
                        .map(game => {
                          const gamePicks = leaderboardWithPicks.flatMap(entry => 
                            entry.picks.filter(pick => pick.game_id === game.id)
                          );
                          const correctPicks = gamePicks.filter(pick => 
                            pick.predicted_winner === game.winner
                          ).length;
                          const accuracy = gamePicks.length > 0 
                            ? Math.round((correctPicks / gamePicks.length) * 100)
                            : 0;
                          
                          return { game, accuracy, correctPicks, totalPicks: gamePicks.length };
                        })
                        .sort((a, b) => b.accuracy - a.accuracy)
                        .slice(0, 5)
                        .map((gameData, index) => (
                          <div key={gameData.game.id} className="flex items-center justify-between p-2 bg-green-50 rounded border border-green-200">
                            <div className="text-sm">
                              <div className="font-medium text-green-800">
                                {getTeamAbbreviation(gameData.game.away_team)} @ {getTeamAbbreviation(gameData.game.home_team)}
                              </div>
                              <div className="text-xs text-green-600">{gameData.correctPicks}/{gameData.totalPicks} correct</div>
                            </div>
                            <Badge variant={gameData.accuracy >= 70 ? "default" : gameData.accuracy >= 50 ? "secondary" : "destructive"}>
                              {gameData.accuracy}%
                            </Badge>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Confidence Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Confidence Analysis
                </CardTitle>
                <CardDescription>
                  How confidence points were distributed and their success rates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-3">Confidence Point Distribution</h4>
                    <div className="space-y-2">
                      {[16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(confidence => {
                        const confidencePicks = leaderboardWithPicks.flatMap(entry => 
                          entry.picks.filter(pick => pick.confidence_points === confidence)
                        );
                        const correctPicks = confidencePicks.filter(pick => 
                          pick.predicted_winner === games.find(g => g.id === pick.game_id)?.winner
                        ).length;
                        const accuracy = confidencePicks.length > 0 
                          ? Math.round((correctPicks / confidencePicks.length) * 100)
                          : 0;
                        
                        return (
                          <div key={confidence} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-sm font-bold">
                                {confidence}
                              </div>
                              <div className="text-sm">
                                <div className="font-medium">{confidencePicks.length} picks</div>
                                <div className="text-xs text-gray-500">{correctPicks} correct</div>
                              </div>
                            </div>
                            <Badge variant={accuracy >= 70 ? "default" : accuracy >= 50 ? "secondary" : "destructive"}>
                              {accuracy}%
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-3">Confidence vs Success</h4>
                    <div className="space-y-4">
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <h5 className="font-semibold text-blue-800 mb-2">High Confidence (13-16)</h5>
                        <div className="text-sm text-blue-600">
                          {(() => {
                            const highConfidencePicks = leaderboardWithPicks.flatMap(entry => 
                              entry.picks.filter(pick => pick.confidence_points >= 13)
                            );
                            const correct = highConfidencePicks.filter(pick => 
                              pick.predicted_winner === games.find(g => g.id === pick.game_id)?.winner
                            ).length;
                            const accuracy = highConfidencePicks.length > 0 
                              ? Math.round((correct / highConfidencePicks.length) * 100)
                              : 0;
                            return `${correct}/${highConfidencePicks.length} correct (${accuracy}%)`;
                          })()}
                        </div>
                      </div>
                      
                      <div className="p-4 bg-yellow-50 rounded-lg">
                        <h5 className="font-semibold text-yellow-800 mb-2">Medium Confidence (7-12)</h5>
                        <div className="text-sm text-yellow-600">
                          {(() => {
                            const mediumConfidencePicks = leaderboardWithPicks.flatMap(entry => 
                              entry.picks.filter(pick => pick.confidence_points >= 7 && pick.confidence_points <= 12)
                            );
                            const correct = mediumConfidencePicks.filter(pick => 
                              pick.predicted_winner === games.find(g => g.id === pick.game_id)?.winner
                            ).length;
                            const accuracy = mediumConfidencePicks.length > 0 
                              ? Math.round((correct / mediumConfidencePicks.length) * 100)
                              : 0;
                            return `${correct}/${mediumConfidencePicks.length} correct (${accuracy}%)`;
                          })()}
                        </div>
                      </div>
                      
                      <div className="p-4 bg-red-50 rounded-lg">
                        <h5 className="font-semibold text-red-800 mb-2">Low Confidence (1-6)</h5>
                        <div className="text-sm text-red-600">
                          {(() => {
                            const lowConfidencePicks = leaderboardWithPicks.flatMap(entry => 
                              entry.picks.filter(pick => pick.confidence_points >= 1 && pick.confidence_points <= 6)
                            );
                            const correct = lowConfidencePicks.filter(pick => 
                              pick.predicted_winner === games.find(g => g.id === pick.game_id)?.winner
                            ).length;
                            const accuracy = lowConfidencePicks.length > 0 
                              ? Math.round((correct / lowConfidencePicks.length) * 100)
                              : 0;
                            return `${correct}/${lowConfidencePicks.length} correct (${accuracy}%)`;
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="mt-6">
          <Card>
            <CardHeader>
                          <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Performance Trends
            </CardTitle>
            <CardDescription>
              Individual performance tracking and trends for {getSeasonTypeName(selectedSeasonType)} Week {selectedWeek}
            </CardDescription>
            </CardHeader>
            <CardContent>
              {leaderboardWithPicks.length > 0 ? (
                <div className="space-y-6">
                  {/* Performance Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="p-4 text-center">
                        <TrendingUp className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                        <div className="text-lg font-bold text-blue-600">
                          {leaderboardWithPicks.length > 0 
                            ? Math.max(...leaderboardWithPicks.map(entry => entry.total_points))
                            : 0
                          }
                        </div>
                        <div className="text-sm text-gray-600">Best Week Score</div>
                        <div className="text-xs text-gray-500">{getSeasonTypeName(selectedSeasonType)}</div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4 text-center">
                        <Users className="h-6 w-6 text-green-600 mx-auto mb-2" />
                        <div className="text-lg font-bold text-green-600">
                          {leaderboardWithPicks.length > 0 
                            ? Math.round(leaderboardWithPicks.reduce((sum, entry) => sum + entry.correct_picks, 0) / leaderboardWithPicks.length)
                            : 0
                          }
                        </div>
                        <div className="text-sm text-gray-600">Avg Correct Picks</div>
                        <div className="text-xs text-gray-500">{getSeasonTypeName(selectedSeasonType)}</div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4 text-center">
                        <Trophy className="h-6 w-6 text-yellow-600 mx-auto mb-2" />
                        <div className="text-lg font-bold text-yellow-600">
                          {leaderboardWithPicks.length > 0 
                            ? Math.round(leaderboardWithPicks.reduce((sum, entry) => sum + entry.total_points, 0) / leaderboardWithPicks.length)
                            : 0
                          }
                        </div>
                        <div className="text-sm text-gray-600">Avg Points</div>
                        <div className="text-xs text-gray-500">{getSeasonTypeName(selectedSeasonType)}</div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4 text-center">
                        <BarChart3 className="h-6 w-6 text-purple-600 mx-auto mb-2" />
                        <div className="text-lg font-bold text-purple-600">
                          {leaderboardWithPicks.length > 0 
                            ? Math.round((leaderboardWithPicks.reduce((sum, entry) => sum + entry.correct_picks, 0) / 
                                         leaderboardWithPicks.reduce((sum, entry) => sum + entry.total_picks, 0)) * 100)
                            : 0
                          }%
                        </div>
                        <div className="text-sm text-gray-600">Pick Accuracy</div>
                        <div className="text-xs text-gray-500">{getSeasonTypeName(selectedSeasonType)}</div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Participant Performance Table */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">
                      Participant Performance Breakdown - {getSeasonTypeName(selectedSeasonType)} Week {selectedWeek}
                    </h3>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Participant</TableHead>
                            <TableHead className="text-center">Total Points</TableHead>
                            <TableHead className="text-center">Correct Picks</TableHead>
                            <TableHead className="text-center">Accuracy</TableHead>
                            <TableHead className="text-center">Avg Points/Game</TableHead>
                            <TableHead className="text-center">Best Game</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {leaderboardWithPicks.map((entry, index) => {
                            const accuracy = entry.total_picks > 0 
                              ? Math.round((entry.correct_picks / entry.total_picks) * 100)
                              : 0;
                            const avgPointsPerGame = entry.total_picks > 0 
                              ? Math.round(entry.total_points / entry.total_picks)
                              : 0;
                            const bestGame = Math.max(...Object.values(entry.game_points));
                            
                            return (
                              <TableRow key={entry.participant_id}>
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    {index === 0 && <Trophy className="h-4 w-4 text-yellow-500" />}
                                    {index === 1 && <Trophy className="h-4 w-4 text-gray-400" />}
                                    {index === 2 && <Trophy className="h-4 w-4 text-orange-600" />}
                                    {entry.participant_name}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center font-bold">
                                  {entry.total_points}
                                </TableCell>
                                <TableCell className="text-center">
                                  {entry.correct_picks}/{entry.total_picks}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant={accuracy >= 70 ? "default" : accuracy >= 50 ? "secondary" : "destructive"}>
                                    {accuracy}%
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  {avgPointsPerGame}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="outline" className="font-mono">
                                    {bestGame}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Game Performance Analysis */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">
                      Game Performance Analysis - {getSeasonTypeName(selectedSeasonType)} Week {selectedWeek}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Most Challenging Games</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {games.slice(0, 5).map((game, index) => {
                              const gamePicks = leaderboardWithPicks.flatMap(entry => 
                                entry.picks.filter(pick => pick.game_id === game.id)
                              );
                              const correctPicks = gamePicks.filter(pick => 
                                pick.predicted_winner === game.winner
                              ).length;
                              const accuracy = gamePicks.length > 0 
                                ? Math.round((correctPicks / gamePicks.length) * 100)
                                : 0;
                              
                              return (
                                <div key={game.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                  <div className="text-sm">
                                    <div className="font-medium">G{index + 1}: {game.away_team} @ {game.home_team}</div>
                                    <div className="text-gray-500">{correctPicks}/{gamePicks.length} correct</div>
                                  </div>
                                  <Badge variant={accuracy >= 70 ? "default" : accuracy >= 50 ? "secondary" : "destructive"}>
                                    {accuracy}%
                                  </Badge>
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                      
                                             <Card>
                         <CardHeader>
                           <CardTitle className="text-sm">Game Confidence Analysis</CardTitle>
                         </CardHeader>
                         <CardContent>
                           <div className="space-y-3">
                             {/* Games with Highest Confidence */}
                             <div>
                               <h4 className="text-sm font-medium text-green-700 mb-2">Highest Confidence Games</h4>
                               <div className="space-y-2">
                                 {games
                                   .map(game => {
                                     const gamePicks = leaderboardWithPicks.flatMap(entry => 
                                       entry.picks.filter(pick => pick.game_id === game.id)
                                     );
                                     const avgConfidence = gamePicks.length > 0 
                                       ? Math.round(gamePicks.reduce((sum, pick) => sum + pick.confidence_points, 0) / gamePicks.length)
                                       : 0;
                                     const maxConfidence = gamePicks.length > 0 
                                       ? Math.max(...gamePicks.map(pick => pick.confidence_points))
                                       : 0;
                                     const confidence16Count = gamePicks.filter(pick => pick.confidence_points === 16).length;
                                     
                                     return { game, avgConfidence, maxConfidence, confidence16Count, totalPicks: gamePicks.length };
                                   })
                                   .sort((a, b) => b.avgConfidence - a.avgConfidence)
                                   .slice(0, 5)
                                   .map((gameData, index) => (
                                     <div key={gameData.game.id} className="flex items-center justify-between p-2 bg-green-50 rounded border border-green-200">
                                       <div className="text-sm">
                                         <div className="font-medium text-green-800">G{index + 1}: {gameData.game.away_team} @ {gameData.game.home_team}</div>
                                         <div className="text-xs text-green-600">{gameData.confidence16Count}/{gameData.totalPicks} picked with 16 confidence</div>
                                       </div>
                                       <div className="text-right">
                                         <div className="text-sm font-bold text-green-800">{gameData.avgConfidence}</div>
                                         <div className="text-xs text-green-600">avg</div>
                                       </div>
                                     </div>
                                   ))}
                               </div>
                             </div>

                             {/* Games with Lowest Confidence */}
                             <div>
                               <h4 className="text-sm font-medium text-red-700 mb-2">Lowest Confidence Games</h4>
                               <div className="space-y-2">
                                 {games
                                   .map(game => {
                                     const gamePicks = leaderboardWithPicks.flatMap(entry => 
                                       entry.picks.filter(pick => pick.game_id === game.id)
                                     );
                                     const avgConfidence = gamePicks.length > 0 
                                       ? Math.round(gamePicks.reduce((sum, pick) => sum + pick.confidence_points, 0) / gamePicks.length)
                                       : 0;
                                     const minConfidence = gamePicks.length > 0 
                                       ? Math.min(...gamePicks.map(pick => pick.confidence_points))
                                       : 0;
                                     const confidence1Count = gamePicks.filter(pick => pick.confidence_points === 1).length;
                                     
                                     return { game, avgConfidence, minConfidence, confidence1Count, totalPicks: gamePicks.length };
                                   })
                                   .sort((a, b) => a.avgConfidence - b.avgConfidence)
                                   .slice(0, 5)
                                   .map((gameData, index) => (
                                     <div key={gameData.game.id} className="flex items-center justify-between p-2 bg-red-50 rounded border border-red-200">
                                       <div className="text-sm">
                                         <div className="font-medium text-red-800">G{index + 1}: {gameData.game.away_team} @ {gameData.game.home_team}</div>
                                         <div className="text-xs text-red-600">{gameData.confidence1Count}/{gameData.totalPicks} picked with 1 confidence</div>
                                       </div>
                                       <div className="text-right">
                                         <div className="text-sm font-bold text-red-800">{gameData.avgConfidence}</div>
                                         <div className="text-xs text-red-600">avg</div>
                                       </div>
                                     </div>
                                   ))}
                               </div>
                             </div>
                           </div>
                         </CardContent>
                       </Card>
                                         </div>
                   </div>

                   {/* Season Trends */}
                   {Object.keys(seasonPerformanceData).length > 1 && (
                     <div>
                       <h3 className="text-lg font-semibold mb-4">
                         Season Trends - {getSeasonTypeName(selectedSeasonType)}
                       </h3>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <Card>
                           <CardHeader>
                             <CardTitle className="text-sm">Weekly Average Points</CardTitle>
                           </CardHeader>
                           <CardContent>
                             <div className="space-y-2">
                               {Object.keys(seasonPerformanceData)
                                 .map(Number)
                                 .sort((a, b) => a - b)
                                 .map(week => {
                                   const weekData = seasonPerformanceData[week];
                                   const avgPoints = Math.round(
                                     weekData.reduce((sum, entry) => sum + entry.total_points, 0) / weekData.length
                                   );
                                   
                                   return (
                                     <div key={week} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                       <div className="text-sm font-medium">Week {week}</div>
                                       <div className="text-sm text-gray-600">{weekData.length} participants</div>
                                       <Badge variant="outline" className="font-mono">
                                         {avgPoints} pts
                                       </Badge>
                                     </div>
                                   );
                                 })}
                             </div>
                           </CardContent>
                         </Card>
                         
                         <Card>
                           <CardHeader>
                             <CardTitle className="text-sm">Weekly Accuracy Trends</CardTitle>
                           </CardHeader>
                           <CardContent>
                             <div className="space-y-2">
                               {Object.keys(seasonPerformanceData)
                                 .map(Number)
                                 .sort((a, b) => a - b)
                                 .map(week => {
                                   const weekData = seasonPerformanceData[week];
                                   const totalCorrect = weekData.reduce((sum, entry) => sum + entry.correct_picks, 0);
                                   const totalPicks = weekData.reduce((sum, entry) => sum + entry.total_picks, 0);
                                   const accuracy = totalPicks > 0 ? Math.round((totalCorrect / totalPicks) * 100) : 0;
                                   
                                   return (
                                     <div key={week} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                       <div className="text-sm font-medium">Week {week}</div>
                                       <div className="text-sm text-gray-600">{totalCorrect}/{totalPicks} correct</div>
                                       <Badge variant={accuracy >= 70 ? "default" : accuracy >= 50 ? "secondary" : "destructive"}>
                                         {accuracy}%
                                       </Badge>
                                     </div>
                                   );
                                 })}
                             </div>
                           </CardContent>
                         </Card>
                       </div>
                     </div>
                   )}
                 </div>
               ) : (
                <div className="text-center py-12">
                  <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Performance Data</h3>
                  <p className="text-gray-600">
                    Performance data will be available once participants submit their picks.
                  </p>
                </div>
              )}
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
