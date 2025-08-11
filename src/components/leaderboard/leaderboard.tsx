'use client';

import { useState } from 'react';
import { useLoadAction } from '@uibakery/data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import loadPoolsAction from '@/actions/loadPools';
import loadLeaderboardAction from '@/actions/loadLeaderboard';
import { Trophy, Medal, Award } from 'lucide-react';

interface LeaderboardEntry {
  id: number;
  participant_id: number;
  pool_id: number;
  total_points: number;
  total_correct_picks: number;
  total_possible_points: number;
  current_rank: number;
  display_name: string;
  pool_name: string;
}

export function Leaderboard() {
  const [selectedPoolId, setSelectedPoolId] = useState<string>('');
  
  const [pools, loadingPools] = useLoadAction(loadPoolsAction, []);
  const [leaderboard, loadingLeaderboard] = useLoadAction(loadLeaderboardAction, [], {
    poolId: selectedPoolId ? parseInt(selectedPoolId) : null,
  });

  const poolsData = pools || [];
  const leaderboardData: LeaderboardEntry[] = leaderboard || [];

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

  const getAccuracyPercentage = (correct: number, total: number) => {
    if (total === 0) return 0;
    return ((correct / total) * 100).toFixed(1);
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
              {poolsData.map((pool: any) => (
                <SelectItem key={pool.id} value={pool.id.toString()}>
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

      {selectedPoolId && !loadingLeaderboard && leaderboardData.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Standings Yet</h3>
            <p className="text-gray-600">
              Standings will appear once participants start making picks and games are completed.
            </p>
          </CardContent>
        </Card>
      )}

      {selectedPoolId && !loadingLeaderboard && leaderboardData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{leaderboardData[0]?.pool_name} - Season Standings</CardTitle>
            <CardDescription>
              Current standings for all participants in this confidence pool
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Rank</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead className="text-center">Points</TableHead>
                  <TableHead className="text-center">Correct Picks</TableHead>
                  <TableHead className="text-center">Accuracy</TableHead>
                  <TableHead className="text-center">Total Possible</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboardData.map((entry) => (
                  <TableRow key={entry.id} className={entry.current_rank <= 3 ? 'bg-yellow-50' : ''}>
                    <TableCell className="font-medium">
                      <div className="flex items-center justify-center">
                        {getRankIcon(entry.current_rank)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{entry.display_name}</span>
                        {entry.current_rank === 1 && (
                          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                            Leader
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-semibold">
                      {entry.total_points}
                    </TableCell>
                    <TableCell className="text-center">
                      {entry.total_correct_picks}
                    </TableCell>
                    <TableCell className="text-center">
                      {getAccuracyPercentage(entry.total_correct_picks, entry.total_possible_points / 16)}%
                    </TableCell>
                    <TableCell className="text-center text-gray-500">
                      {entry.total_possible_points}
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
