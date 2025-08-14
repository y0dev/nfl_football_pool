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
        {process.env.NODE_ENV === 'development' && (
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Rank</TableHead>
                  <TableHead>Participant</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {DUMMY_LEADERBOARD_DATA.map((entry, index) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center space-x-2">
                        {getRankIcon(index + 1)}
                      </div>
                    </TableCell>
                    <TableCell>{entry.participants.name}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {entry.points}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Rank</TableHead>
                  <TableHead>Participant</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.map((entry, index) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center space-x-2">
                        {getRankIcon(index + 1)}
                      </div>
                    </TableCell>
                    <TableCell>{entry.participants.name}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {entry.points}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
