'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { loadPools } from '@/actions/loadPools';
import { loadLeaderboard } from '@/actions/loadLeaderboard';
import { Trophy, Medal, Award } from 'lucide-react';

interface LeaderboardEntry {
  id: string;
  participant_id: string;
  pool_id: string;
  week: number;
  points: number;
  participants: {
    name: string;
  };
}

interface Pool {
  id: string;
  name: string;
}

export function Leaderboard() {
  const [selectedPoolId, setSelectedPoolId] = useState<string>('');
  const [pools, setPools] = useState<Pool[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [, setLoadingPools] = useState(true);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

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

  useEffect(() => {
    async function fetchLeaderboard() {
      if (!selectedPoolId) {
        setLeaderboard([]);
        return;
      }

      try {
        setLoadingLeaderboard(true);
        const leaderboardData = await loadLeaderboard(selectedPoolId, 1);
        setLeaderboard(leaderboardData);
      } catch (error) {
        console.error('Error loading leaderboard:', error);
      } finally {
        setLoadingLeaderboard(false);
      }
    }
    fetchLeaderboard();
  }, [selectedPoolId]);

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

  return (
    <div className="space-y-6">
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

      {!selectedPoolId && (
        <Card>
          <CardContent className="p-8 text-center">
            <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a Pool</h3>
            <p className="text-gray-600">Choose a confidence pool to view the leaderboard standings.</p>
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

      {selectedPoolId && !loadingLeaderboard && leaderboard.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Results Yet</h3>
            <p className="text-gray-600">No picks have been submitted for this pool yet.</p>
          </CardContent>
        </Card>
      )}

      {selectedPoolId && !loadingLeaderboard && leaderboard.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Week 1 Standings</CardTitle>
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
