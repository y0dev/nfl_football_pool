'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, TrendingUp, Users } from 'lucide-react';

interface SeasonLeaderboardEntry {
  participant_name: string;
  total_points: number;
  weeks_played: number;
  average_points: number;
  best_week: number;
  best_week_score: number;
}

interface SeasonLeaderboardProps {
  poolId: string;
  season: number;
  currentWeek?: number;
  currentSeasonType?: number;
}

export function SeasonLeaderboard({ poolId, season, currentWeek, currentSeasonType }: SeasonLeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<SeasonLeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSeasonLeaderboard = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`/api/leaderboard/season?poolId=${poolId}&season=${season}&currentWeek=${currentWeek || ''}&currentSeasonType=${currentSeasonType || ''}`);
        
        if (!response.ok) {
          throw new Error(`Failed to load season leaderboard: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.success) {
          setLeaderboard(result.leaderboard || []);
        } else {
          throw new Error(result.error || 'Failed to load season leaderboard');
        }
      } catch (err) {
        console.error('Error loading season leaderboard:', err);
        setError(err instanceof Error ? err.message : 'Failed to load season leaderboard');
      } finally {
        setIsLoading(false);
      }
    };

    if (poolId && season) {
      loadSeasonLeaderboard();
    }
  }, [poolId, season, currentWeek, currentSeasonType]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading season standings...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-500 mb-2">
          <TrendingUp className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">Unable to load season leaderboard</p>
        </div>
        <p className="text-xs text-gray-500">{error}</p>
      </div>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <div className="text-center py-8">
        <Users className="h-8 w-8 mx-auto mb-2 text-gray-400" />
        <p className="text-sm text-gray-500">No season data available yet</p>
        <p className="text-xs text-gray-400">Complete weeks will appear here</p>
      </div>
    );
  }

  const getPositionIcon = (position: number) => {
    switch (position) {
      case 0:
        return <Trophy className="h-4 w-4 text-yellow-500" />;
      case 1:
        return <Trophy className="h-4 w-4 text-gray-400" />;
      case 2:
        return <Trophy className="h-4 w-4 text-amber-600" />;
      default:
        return '';
    }
  };

  const getPositionBadge = (position: number) => {
    switch (position) {
      case 0:
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">1st</Badge>;
      case 1:
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">2nd</Badge>;
      case 2:
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200">3rd</Badge>;
      default:
        return <Badge variant="outline" className="text-gray-600">#{position + 1}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <Card className="text-center">
          <CardContent className="p-2 md:p-3">
            <div className="text-base md:text-lg font-bold text-blue-600">{leaderboard.length}</div>
            <div className="text-xs text-gray-600">Participants</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="p-2 md:p-3">
            <div className="text-base md:text-lg font-bold text-green-600">
              {leaderboard[0]?.total_points || 0}
            </div>
            <div className="text-xs text-gray-600">Leader Score</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="p-2 md:p-3">
            <div className="text-base md:text-lg font-bold text-purple-600">
              {Math.round(leaderboard.reduce((sum, entry) => sum + entry.average_points, 0) / leaderboard.length) || 0}
            </div>
            <div className="text-xs text-gray-600">Avg Score</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="p-2 md:p-3">
            <div className="text-base md:text-lg font-bold text-orange-600">
              {Math.max(...leaderboard.map(entry => entry.weeks_played)) || 0}
            </div>
            <div className="text-xs text-gray-600">Weeks Played</div>
          </CardContent>
        </Card>
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Participant</th>
              <th className="text-center py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Total Points</th>
              <th className="text-center py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Weeks</th>
              <th className="text-center py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Average</th>
              <th className="text-center py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Best Week</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {leaderboard.map((entry, index) => (
              <tr key={entry.participant_name} className="hover:bg-gray-50">
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    {getPositionIcon(index)}
                    {getPositionBadge(index)}
                  </div>
                </td>
                <td className="py-3 px-3">
                  <div className="font-medium text-gray-900">{entry.participant_name}</div>
                </td>
                <td className="py-3 px-3 text-center">
                  <div className="font-bold text-lg text-blue-600">{entry.total_points}</div>
                </td>
                <td className="py-3 px-3 text-center">
                  <Badge variant="outline" className="text-xs">
                    {entry.weeks_played} weeks
                  </Badge>
                </td>
                <td className="py-3 px-3 text-center">
                  <div className="text-sm font-medium text-gray-700">
                    {entry.average_points.toFixed(1)}
                  </div>
                </td>
                <td className="py-3 px-3 text-center">
                  <div className="text-xs text-gray-600">
                    Week {entry.best_week}
                  </div>
                  <div className="text-sm font-medium text-green-600">
                    {entry.best_week_score} pts
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-3">
        {leaderboard.map((entry, index) => (
          <Card key={entry.participant_name} className="p-4 hover:shadow-md transition-shadow">
            {/* Header with Rank and Name */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0">
                {getPositionIcon(index)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-gray-900 text-lg truncate">
                  {entry.participant_name}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {getPositionBadge(index)}
                  <span className="text-xs text-gray-500">
                    {entry.weeks_played} week{entry.weeks_played !== 1 ? 's' : ''} played
                  </span>
                </div>
              </div>
            </div>
            
            {/* Main Stats */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {entry.total_points}
                </div>
                <div className="text-xs text-gray-600 font-medium">Total Points</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-xl font-bold text-green-600">
                  {entry.average_points.toFixed(1)}
                </div>
                <div className="text-xs text-gray-600 font-medium">Avg/Week</div>
              </div>
            </div>
            
            {/* Best Week Performance */}
            {entry.best_week > 0 && (
              <div className="text-center p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="text-sm font-semibold text-yellow-800 mb-1">
                  🏆 Best Week Performance
                </div>
                <div className="text-lg font-bold text-yellow-700">
                  Week {entry.best_week}: {entry.best_week_score} pts
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Legend */}
      <div className="text-xs text-gray-500 text-center pt-4 border-t border-gray-200">
        <p>Season leaderboard shows accumulated scores from all completed weeks</p>
        <p>Best week indicates the participant&apos;s highest-scoring individual week</p>
      </div>
    </div>
  );
}
