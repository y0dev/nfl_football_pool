'use client';

import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trophy } from 'lucide-react';
import { Game } from '@/types/game';
import { LeaderboardEntryWithPicks } from '@/actions/loadPicksForLeaderboard';
import { debugError, debugLog, getTeamAbbreviation, PERIOD_WEEKS } from '@/lib/utils';
import { getSupabaseServiceClient } from '@/lib/supabase';

interface LeaderboardProps {
  poolId?: string;
  weekNumber?: number;
  seasonType?: number;
  season?: number;
}



export function Leaderboard({ poolId, weekNumber = 1, seasonType = 2, season }: LeaderboardProps) {
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntryWithPicks[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [mondayNightScores, setMondayNightScores] = useState<Map<string, number>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  // Function to load Monday night scores for tie-breaker weeks
  const loadMondayNightScores = async (poolId: string, weekNumber: number, season: number) => {
    if (!PERIOD_WEEKS.includes(weekNumber as typeof PERIOD_WEEKS[number])) {
      return new Map();
    }

    try {
      const supabase = getSupabaseServiceClient();
      const { data, error } = await supabase
        .from('tie_breakers')
        .select('participant_id, answer')
        .eq('pool_id', poolId)
        .eq('week', weekNumber)
        .eq('season', season);

      if (error) {
        debugError('Error loading Monday night scores:', error);
        return new Map();
      }

      const scoresMap = new Map<string, number>();
      data?.forEach(score => {
        scoresMap.set(score.participant_id, score.answer);
      });

      return scoresMap;
    } catch (err) {
      debugError('Error loading Monday night scores:', err);
      return new Map();
    }
  };

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
          
          // Load Monday night scores for tie-breaker weeks
          const mondayNightScoresData = await loadMondayNightScores(poolId, weekNumber, season || new Date().getFullYear());
          setMondayNightScores(mondayNightScoresData);
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
      {/* Responsive Table View */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky top-0 bg-white z-20 w-12 text-xs sm:text-sm">Rank</TableHead>
              <TableHead className="sticky top-0 bg-white z-20 text-xs sm:text-sm">Participant</TableHead>
              <TableHead className="sticky top-0 bg-white z-20 text-center text-xs sm:text-sm">Points</TableHead>
              <TableHead className="sticky top-0 bg-white z-20 text-center text-xs sm:text-sm">Correct</TableHead>
              {PERIOD_WEEKS.includes(weekNumber as typeof PERIOD_WEEKS[number]) && (
                <TableHead className="sticky top-0 bg-white z-20 text-center text-xs sm:text-sm">Mon Night</TableHead>
              )}
              {games.map((game, index) => (
                <TableHead key={game.id || index} className="sticky top-0 bg-white z-20 text-center text-xs">
                  <div className="text-xs">{getTeamAbbreviation(game.away_team || '')}</div>
                  <div className="text-gray-500 text-xs">@</div>
                  <div className="text-xs">{getTeamAbbreviation(game.home_team || '')}</div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaderboardData.map((entry, index) => (
              <TableRow key={entry.participant_id || index}>
                <TableCell className="font-medium text-xs sm:text-sm">
                  {index + 1}
                  {index === 0 && <Trophy className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-500 inline ml-1" />}
                  {index === 1 && <Trophy className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400 inline ml-1" />}
                  {index === 2 && <Trophy className="h-3 w-3 sm:h-4 sm:w-4 text-orange-500 inline ml-1" />}
                </TableCell>
                <TableCell className="sticky left-0 bg-white z-10 font-medium text-xs sm:text-sm truncate max-w-24 sm:max-w-none">{entry.participant_name || 'Unknown'}</TableCell>
                <TableCell className="text-center font-bold text-xs sm:text-sm">{entry.total_points || 0}</TableCell>
                <TableCell className="text-center text-xs sm:text-sm">
                  {entry.correct_picks || 0}/{entry.total_picks || 0}
                </TableCell>
                {PERIOD_WEEKS.includes(weekNumber as typeof PERIOD_WEEKS[number]) && (
                  <TableCell className="text-center text-xs sm:text-sm">
                    {mondayNightScores.get(entry.participant_id) || '-'}
                  </TableCell>
                )}
                {games.map((game, gameIndex) => {
                  const status = game.status?.toLowerCase() || '';
                  const pick = entry.picks?.find(p => p.game_id === game.id);
                  const isGameFinal = status === 'final' || status === 'post';
                  const isGameInProgress = status === 'live' || status === 'in progress' || status === 'in_progress' || status === 'halftime';
                  const isCorrect = pick && isGameFinal && game.winner?.toLowerCase() && pick.predicted_winner?.toLowerCase() === game.winner?.toLowerCase();
                  const confidence = pick?.confidence_points || 0;
                  
                  return (
                    <TableCell key={game.id || gameIndex} className="text-center">
                      <div className="text-xs">
                        <div className={`font-medium ${
                          isGameInProgress ? 'text-blue-800' :
                          !isGameFinal ? 'text-yellow-800' :
                          isCorrect ? 'text-green-800' : 'text-red-800'
                        }`}>
                          {pick?.predicted_winner ? getTeamAbbreviation(pick.predicted_winner) : '-'}
                        </div>
                        <div className={`inline-block px-1 py-0.5 rounded text-xs font-mono min-w-[1.5rem] text-center ${
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
    </div>
  );
}
