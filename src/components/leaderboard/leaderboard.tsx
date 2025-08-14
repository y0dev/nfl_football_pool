'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { loadPools } from '@/actions/loadPools';
import { loadLeaderboard } from '@/actions/loadLeaderboard';
import { loadWeekGames } from '@/actions/loadWeekGames';
import { Trophy, Medal, Award, Clock, EyeOff } from 'lucide-react';
import { LeaderboardEntry, Pool, Game } from '@/types/game';

interface LeaderboardProps {
  poolId?: string;
  weekNumber?: number;
}

// Dummy data for testing
const DUMMY_LEADERBOARD_DATA: LeaderboardEntry[] = [
  {
    id: '1',
    pool_id: 'dummy-pool-1',
    participant_id: 'participant-1',
    week: 1,
    points: 156,
    participants: {
      name: 'John Smith'
    },
    game_points: {
      'game-1': 16,
      'game-2': 14,
      'game-3': 12,
      'game-4': 10,
      'game-5': 8,
      'game-6': 6,
      'game-7': 4,
      'game-8': 2
    }
  },
  {
    id: '2',
    pool_id: 'dummy-pool-1',
    participant_id: 'participant-2',
    week: 1,
    points: 142,
    participants: {
      name: 'Sarah Johnson'
    },
    game_points: {
      'game-1': 14,
      'game-2': 16,
      'game-3': 10,
      'game-4': 12,
      'game-5': 8,
      'game-6': 6,
      'game-7': 4,
      'game-8': 2
    }
  },
  {
    id: '3',
    pool_id: 'dummy-pool-1',
    participant_id: 'participant-3',
    week: 1,
    points: 138,
    participants: {
      name: 'Mike Davis'
    },
    game_points: {
      'game-1': 12,
      'game-2': 14,
      'game-3': 16,
      'game-4': 8,
      'game-5': 10,
      'game-6': 6,
      'game-7': 4,
      'game-8': 2
    }
  },
  {
    id: '4',
    pool_id: 'dummy-pool-1',
    participant_id: 'participant-4',
    week: 1,
    points: 125,
    participants: {
      name: 'Emily Wilson'
    },
    game_points: {
      'game-1': 10,
      'game-2': 12,
      'game-3': 14,
      'game-4': 16,
      'game-5': 6,
      'game-6': 8,
      'game-7': 4,
      'game-8': 2
    }
  },
  {
    id: '5',
    pool_id: 'dummy-pool-1',
    participant_id: 'participant-5',
    week: 1,
    points: 118,
    participants: {
      name: 'David Brown'
    },
    game_points: {
      'game-1': 8,
      'game-2': 10,
      'game-3': 12,
      'game-4': 14,
      'game-5': 16,
      'game-6': 4,
      'game-7': 6,
      'game-8': 2
    }
  },
  {
    id: '6',
    pool_id: 'dummy-pool-1',
    participant_id: 'participant-6',
    week: 1,
    points: 112,
    participants: {
      name: 'Lisa Anderson'
    },
    game_points: {
      'game-1': 6,
      'game-2': 8,
      'game-3': 10,
      'game-4': 12,
      'game-5': 14,
      'game-6': 16,
      'game-7': 2,
      'game-8': 4
    }
  },
  {
    id: '7',
    pool_id: 'dummy-pool-1',
    participant_id: 'participant-7',
    week: 1,
    points: 108,
    participants: {
      name: 'Tom Wilson'
    },
    game_points: {
      'game-1': 4,
      'game-2': 6,
      'game-3': 8,
      'game-4': 10,
      'game-5': 12,
      'game-6': 14,
      'game-7': 16,
      'game-8': 2
    }
  },
  {
    id: '8',
    pool_id: 'dummy-pool-1',
    participant_id: 'participant-8',
    week: 1,
    points: 102,
    participants: {
      name: 'Karen Martinez'
    },
    game_points: {
      'game-1': 2,
      'game-2': 4,
      'game-3': 6,
      'game-4': 8,
      'game-5': 10,
      'game-6': 12,
      'game-7': 14,
      'game-8': 16
    }
  }
];

export function Leaderboard({ poolId, weekNumber }: LeaderboardProps) {
  const [selectedPoolId, setSelectedPoolId] = useState<string>(poolId || '');
  const [selectedWeek, setSelectedWeek] = useState<number>(weekNumber || 1);
  const [pools, setPools] = useState<Pool[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [, setLoadingPools] = useState(true);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [games, setGames] = useState<Game[]>([]);
  const [isGamesStarted, setIsGamesStarted] = useState(false);
  const [showDummyData, setShowDummyData] = useState(false);
  const [screenWidth, setScreenWidth] = useState<number>(0);

  // Track screen width
  useEffect(() => {
    const updateScreenWidth = () => {
      setScreenWidth(window.innerWidth);
    };

    updateScreenWidth();
    window.addEventListener('resize', updateScreenWidth);
    return () => window.removeEventListener('resize', updateScreenWidth);
  }, []);

  // Check if screen is too narrow for detailed leaderboard
  const isScreenTooNarrow = screenWidth < 768; // md breakpoint

  useEffect(() => {
    async function fetchPools() {
      try {
        // Show all active pools for leaderboard (participant context)
        const poolsData = await loadPools(undefined, true);
        setPools(poolsData);
      } catch (error) {
        console.error('Error loading pools:', error);
      } finally {
        setLoadingPools(false);
      }
    }
    fetchPools();
  }, []);

  // Load games to check if they've started
  useEffect(() => {
    async function fetchGames() {
      if (!selectedPoolId || !selectedWeek) return;
      
      try {
        const gamesData = await loadWeekGames(selectedWeek, 2); // Default to regular season
        setGames(gamesData);
        
        // Check if any games have started
        const now = new Date();
        const hasStarted = gamesData.some(game => {
          const gameTime = new Date(game.kickoff_time);
          return gameTime <= now;
        });
        setIsGamesStarted(hasStarted);
      } catch (error) {
        console.error('Error loading games:', error);
      }
    }
    
    fetchGames();
  }, [selectedPoolId, selectedWeek]);

  // Update selected pool and week when props change
  useEffect(() => {
    if (poolId) {
      setSelectedPoolId(poolId);
    }
    if (weekNumber) {
      setSelectedWeek(weekNumber);
    }
  }, [poolId, weekNumber]);

  useEffect(() => {
    async function fetchLeaderboard() {
      if (!selectedPoolId) {
        setLeaderboard([]);
        return;
      }

      try {
        setLoadingLeaderboard(true);
        
        // For testing: show dummy data if games haven't started
        if (!isGamesStarted) {
          setLeaderboard([]);
          return;
        }
        
        const leaderboardData = await loadLeaderboard(selectedPoolId, selectedWeek);
        setLeaderboard(leaderboardData);
      } catch (error) {
        console.error('Error loading leaderboard:', error);
      } finally {
        setLoadingLeaderboard(false);
      }
    }
    fetchLeaderboard();
  }, [selectedPoolId, selectedWeek, isGamesStarted]);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 3:
        return <Award className="h-5 w-5 text-amber-600" />;
      default:
        return <span className="text-sm font-medium text-gray-500">#{rank}</span>;
    }
  };

  // If poolId is provided, don't show pool selector
  const showPoolSelector = !poolId;

  // Show dummy data for testing (only in development)
  const handleShowDummyData = () => {
    setShowDummyData(!showDummyData);
  };

  return (
    <div className="space-y-6">
      {showPoolSelector && (
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Leaderboard</h2>
        <div className="w-64">
          <Select value={selectedPoolId} onValueChange={setSelectedPoolId}>
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
      </div>
      )}

      {/* Week selector */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium">Week:</span>
        <Select value={selectedWeek.toString()} onValueChange={(value) => setSelectedWeek(parseInt(value))}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 18 }, (_, i) => i + 1).map((week) => (
              <SelectItem key={week} value={week.toString()}>
                Week {week}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {/* Development: Show dummy data button */}
        {process.env.NEXT_PUBLIC_NODE_ENV === 'development' && (
          <button
            onClick={handleShowDummyData}
            className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
          >
            {showDummyData ? 'Hide' : 'Show'} Dummy Data
          </button>
        )}
      </div>

      {!selectedPoolId && showPoolSelector && (
        <Card>
          <CardContent className="p-8 text-center">
            <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a Pool</h3>
            <p className="text-gray-600">Choose a confidence pool to view the leaderboard standings.</p>
          </CardContent>
        </Card>
      )}

      {/* Show message when games haven't started */}
      {selectedPoolId && !isGamesStarted && !showDummyData && (
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
          <CardContent className="p-8 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <EyeOff className="h-12 w-12 text-blue-600" />
              <Clock className="h-12 w-12 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-blue-900 mb-2">Leaderboard Hidden</h3>
            <p className="text-blue-700 mb-4">
              The leaderboard will be revealed once the first game of Week {selectedWeek} begins.
            </p>
            <div className="text-sm text-blue-600">
              This prevents participants from seeing others' picks before games start.
            </div>
          </CardContent>
        </Card>
      )}

      {selectedPoolId && loadingLeaderboard && (
        <Card>
          <CardContent className="p-8">
            <div className="animate-pulse space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center space-x-4">
                  <div className="w-8 h-8 bg-gray-200 rounded"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                    <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                  </div>
                  <div className="w-16 h-4 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedPoolId && !loadingLeaderboard && leaderboard.length === 0 && isGamesStarted && !showDummyData && (
        <Card>
          <CardContent className="p-8 text-center">
            <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Results Yet</h3>
            <p className="text-gray-600">No picks have been submitted for this pool yet.</p>
          </CardContent>
        </Card>
      )}

      {/* Show dummy data for testing */}
      {selectedPoolId && showDummyData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Week {selectedWeek} Standings (Dummy Data)
            </CardTitle>
            <CardDescription>
              Sample leaderboard data for testing purposes
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isScreenTooNarrow ? (
              <div className="text-center py-8">
                <div className="mb-4">
                  <svg className="w-16 h-16 mx-auto text-blue-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Rotate Your Device</h3>
                  <p className="text-gray-600 mb-4">
                    The detailed leaderboard requires a wider screen. Please rotate your device to landscape mode for the best experience.
                  </p>
                  <div className="text-sm text-gray-500">
                    Current screen width: {screenWidth}px (minimum: 768px)
                  </div>
                </div>
                
                {/* Show simplified mobile version */}
                <div className="space-y-3">
                  {DUMMY_LEADERBOARD_DATA.slice(0, 5).map((entry, index) => (
                    <div key={entry.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        {getRankIcon(index + 1)}
                        <span className="font-medium truncate max-w-[120px]">{entry.participants.name}</span>
                      </div>
                      <span className="font-bold text-green-600">{entry.points} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16 sticky left-0 bg-white z-10">Rank</TableHead>
                      <TableHead className="min-w-[150px] sticky left-16 bg-white z-10">Participant</TableHead>
                      <TableHead className="text-center min-w-[60px]">G1</TableHead>
                      <TableHead className="text-center min-w-[60px]">G2</TableHead>
                      <TableHead className="text-center min-w-[60px]">G3</TableHead>
                      <TableHead className="text-center min-w-[60px]">G4</TableHead>
                      <TableHead className="text-center min-w-[60px]">G5</TableHead>
                      <TableHead className="text-center min-w-[60px]">G6</TableHead>
                      <TableHead className="text-center min-w-[60px]">G7</TableHead>
                      <TableHead className="text-center min-w-[60px]">G8</TableHead>
                      <TableHead className="text-right font-bold min-w-[80px] sticky right-0 bg-white z-10">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {DUMMY_LEADERBOARD_DATA.map((entry, index) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium sticky left-0 bg-white z-10">
                          <div className="flex items-center space-x-2">
                            {getRankIcon(index + 1)}
                          </div>
                        </TableCell>
                        <TableCell className="sticky left-16 bg-white z-10 font-medium">
                          <div className="truncate max-w-[120px] sm:max-w-none">
                            {entry.participants.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-block w-8 h-8 rounded-full bg-blue-100 text-blue-800 text-sm font-semibold flex items-center justify-center">
                            {entry.game_points?.['game-1'] || 0}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-block w-8 h-8 rounded-full bg-blue-100 text-blue-800 text-sm font-semibold flex items-center justify-center">
                            {entry.game_points?.['game-2'] || 0}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-block w-8 h-8 rounded-full bg-blue-100 text-blue-800 text-sm font-semibold flex items-center justify-center">
                            {entry.game_points?.['game-3'] || 0}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-block w-8 h-8 rounded-full bg-blue-100 text-blue-800 text-sm font-semibold flex items-center justify-center">
                            {entry.game_points?.['game-4'] || 0}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-block w-8 h-8 rounded-full bg-blue-100 text-blue-800 text-sm font-semibold flex items-center justify-center">
                            {entry.game_points?.['game-5'] || 0}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-block w-8 h-8 rounded-full bg-blue-100 text-blue-800 text-sm font-semibold flex items-center justify-center">
                            {entry.game_points?.['game-6'] || 0}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-block w-8 h-8 rounded-full bg-blue-100 text-blue-800 text-sm font-semibold flex items-center justify-center">
                            {entry.game_points?.['game-7'] || 0}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-block w-8 h-8 rounded-full bg-blue-100 text-blue-800 text-sm font-semibold flex items-center justify-center">
                            {entry.game_points?.['game-8'] || 0}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-bold sticky right-0 bg-white z-10">
                          <span className="inline-block px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm font-bold">
                            {entry.points}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selectedPoolId && !loadingLeaderboard && leaderboard.length > 0 && isGamesStarted && !showDummyData && (
        <Card>
          <CardHeader>
            <CardTitle>Week {selectedWeek} Standings</CardTitle>
            <CardDescription>
              Current rankings for the selected pool
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isScreenTooNarrow ? (
              <div className="text-center py-8">
                <div className="mb-4">
                  <svg className="w-16 h-16 mx-auto text-blue-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Rotate Your Device</h3>
                  <p className="text-gray-600 mb-4">
                    The detailed leaderboard requires a wider screen. Please rotate your device to landscape mode for the best experience.
                  </p>
                  <div className="text-sm text-gray-500">
                    Current screen width: {screenWidth}px (minimum: 768px)
                  </div>
                </div>
                
                {/* Show simplified mobile version */}
                <div className="space-y-3">
                  {leaderboard.slice(0, 5).map((entry, index) => (
                    <div key={entry.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        {getRankIcon(index + 1)}
                        <span className="font-medium truncate max-w-[120px]">{entry.participants.name}</span>
                      </div>
                      <span className="font-bold text-green-600">{entry.points} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                      <TableHead className="w-16 sticky left-0 bg-white z-10">Rank</TableHead>
                      <TableHead className="min-w-[150px] sticky left-16 bg-white z-10">Participant</TableHead>
                      <TableHead className="text-right font-bold min-w-[80px] sticky right-0 bg-white z-10">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.map((entry, index) => (
                  <TableRow key={entry.id}>
                        <TableCell className="font-medium sticky left-0 bg-white z-10">
                      <div className="flex items-center space-x-2">
                        {getRankIcon(index + 1)}
                      </div>
                    </TableCell>
                        <TableCell className="sticky left-16 bg-white z-10 font-medium">
                          <div className="truncate max-w-[120px] sm:max-w-none">
                            {entry.participants.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold sticky right-0 bg-white z-10">
                          <span className="inline-block px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm font-bold">
                      {entry.points}
                          </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
