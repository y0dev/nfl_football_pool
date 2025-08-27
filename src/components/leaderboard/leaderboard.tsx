'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { loadPools } from '@/actions/loadPools';
import { Trophy, Medal, Award, Clock, EyeOff } from 'lucide-react';
import { LeaderboardEntry, Pool, Game } from '@/types/game';
import { LeaderboardEntryWithPicks } from '@/actions/loadPicksForLeaderboard';
import { debugError, debugLog, getTeamAbbreviation } from '@/lib/utils';

interface LeaderboardProps {
  poolId?: string;
  weekNumber?: number;
  seasonType?: number;
  season?: number;
}



export function Leaderboard({ poolId, weekNumber = 1, seasonType = 2, season }: LeaderboardProps) {
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntryWithPicks[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const loadData = async () => {
      if (!poolId) return;
      
      try {
        setIsLoading(true);
        debugLog('Loading leaderboard data for poolId:', poolId, 'week:', weekNumber, 'seasonType:', seasonType, 'season:', season);
        // Load leaderboard data from the API
        const response = await fetch(`/api/leaderboard?poolId=${poolId}&week=${weekNumber}&seasonType=${seasonType}${season ? `&season=${season}` : ''}`);
        
        if (!response.ok) {
          throw new Error('Failed to load leaderboard data');
        }
        
        const result = await response.json();
        debugLog('Leaderboard data loaded:', result);
        if (result.success) {
          setLeaderboardData(result.leaderboard);
          setGames(result.games);
        } else {
          throw new Error(result.error || 'Failed to load leaderboard data');
        }
          
      } catch (error) {
        debugError('Error loading leaderboard data:', error);
        setError('Failed to load leaderboard data');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [poolId, weekNumber, seasonType, season]);

  if (isLoading) {
  return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-8 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (leaderboardData.length === 0) {
    return (
              <div className="text-center py-8">
        <p className="text-gray-500">No leaderboard data available for this week.</p>
                  </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Desktop Table View */}
      <div className="hidden lg:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Rank</TableHead>
              <TableHead>Participant</TableHead>
              <TableHead className="text-center">Points</TableHead>
              <TableHead className="text-center">Correct</TableHead>
              {games.map((game, index) => (
                <TableHead key={game.id} className="text-center text-xs">
                  {getTeamAbbreviation(game.away_team)} @ {getTeamAbbreviation(game.home_team)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaderboardData.map((entry, index) => (
              <TableRow key={entry.participant_id}>
                <TableCell className="font-medium">
                  {index + 1}
                  {index === 0 && <Trophy className="h-4 w-4 text-yellow-500 inline ml-1" />}
                  {index === 1 && <Trophy className="h-4 w-4 text-gray-400 inline ml-1" />}
                  {index === 2 && <Trophy className="h-4 w-4 text-orange-500 inline ml-1" />}
                </TableCell>
                <TableCell className="font-medium">{entry.participant_name}</TableCell>
                <TableCell className="text-center font-bold">{entry.total_points}</TableCell>
                <TableCell className="text-center">
                  {entry.correct_picks}/{entry.total_picks}
                </TableCell>
                {games.map(game => {
                  const pick = entry.picks.find(p => p.game_id === game.id);
                  const isGameFinal = game.status === 'final' || game.status === 'post';
                  const isGameInProgress = game.status === 'live' || game.status === 'in_progress';
                  const isCorrect = pick && isGameFinal && game.winner && pick.predicted_winner === game.winner;
                  const confidence = pick?.confidence_points || 0;
                  
                  return (
                    <TableCell key={game.id} className="text-center">
                      <div className="text-xs">
                        <div className={`font-medium ${
                          isGameInProgress ? 'text-blue-800' :
                          !isGameFinal ? 'text-yellow-800' :
                          isCorrect ? 'text-green-800' : 'text-red-800'
                        }`}>
                          {pick?.predicted_winner ? getTeamAbbreviation(pick.predicted_winner) : '-'}
                        </div>
                        <div className={`inline-block px-1 py-0.5 rounded text-xs font-mono ${
                          confidence === 0 ? 'bg-gray-100 text-gray-500' :
                          isGameInProgress ? 'bg-blue-100 text-blue-800' :
                          !isGameFinal ? 'bg-yellow-100 text-yellow-800' :
                          isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {confidence}
                        </div>
                        {pick && pick.home_score !== null && pick.away_score !== null && (
                          <div className="text-xs text-gray-500 mt-1">
                            {pick.away_score}-{pick.home_score}
                          </div>
                        )}
                      </div>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-3">
        {leaderboardData.map((entry, index) => (
          <Card key={entry.participant_id} className="p-4 hover:shadow-md transition-shadow">
            {/* Header with Rank and Name */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-gray-700">#{index + 1}</span>
                  {index === 0 && <Trophy className="h-5 w-5 text-yellow-500" />}
                  {index === 1 && <Trophy className="h-5 w-5 text-gray-400" />}
                  {index === 2 && <Trophy className="h-5 w-5 text-orange-500" />}
                </div>
                <div className="font-semibold text-gray-900 text-lg">
                  {entry.participant_name}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600">
                  {entry.total_points}
                </div>
                <div className="text-xs text-gray-500">Points</div>
              </div>
            </div>
            
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-lg font-bold text-green-600">
                  {entry.correct_picks}
                </div>
                <div className="text-xs text-gray-600 font-medium">Correct Picks</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-lg font-bold text-blue-600">
                  {entry.total_picks}
                </div>
                <div className="text-xs text-gray-600 font-medium">Total Picks</div>
              </div>
            </div>
            
            {/* Game Picks */}
            <div className="space-y-2">
              <div className="text-sm font-semibold text-gray-700 mb-2">Game Picks:</div>
              <div className="grid grid-cols-2 gap-2">
                {games.map(game => {
                  const pick = entry.picks.find(p => p.game_id === game.id);
                  const isGameFinal = game.status === 'final' || game.status === 'post';
                  const isGameInProgress = game.status === 'live' || game.status === 'in_progress';
                  const isCorrect = pick && isGameFinal && game.winner && pick.predicted_winner === game.winner;
                  const confidence = pick?.confidence_points || 0;
                  
                  return (
                    <div key={game.id} className="p-2 border rounded-lg text-center">
                      <div className="text-xs text-gray-500 mb-1">
                        {getTeamAbbreviation(game.away_team)} @ {getTeamAbbreviation(game.home_team)}
                      </div>
                      <div className={`font-medium text-sm mb-1 ${
                        isGameInProgress ? 'text-blue-800' :
                        !isGameFinal ? 'text-yellow-800' :
                        isCorrect ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {pick?.predicted_winner ? getTeamAbbreviation(pick.predicted_winner) : '-'}
                      </div>
                      <div className={`inline-block px-2 py-1 rounded text-xs font-mono ${
                        confidence === 0 ? 'bg-gray-100 text-gray-500' :
                        isGameInProgress ? 'bg-blue-100 text-blue-800' :
                        !isGameFinal ? 'bg-yellow-100 text-yellow-800' :
                        isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {confidence}
                      </div>
                      {pick && pick.home_score !== null && pick.away_score !== null && (
                        <div className="text-xs text-gray-500 mt-1">
                          {pick.away_score}-{pick.home_score}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
