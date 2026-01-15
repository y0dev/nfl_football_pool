'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, TrendingUp, Users } from 'lucide-react';

interface QuarterEntry {
  participant_id: string;
  name: string;
  total_points: number;
  total_correct: number;
  weeks_won: number;
}

interface QuarterLeaderboardProps {
  poolId: string;
  season: number;
  currentWeek: number;
  seasonType?: number; // 1=Preseason, 2=Regular Season, 3=Postseason/Playoffs
}

export function QuarterLeaderboard({ poolId, season, currentWeek, seasonType = 2 }: QuarterLeaderboardProps) {
  const [entries, setEntries] = useState<QuarterEntry[]>([]);
  const [periodLabel, setPeriodLabel] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const periodName = useMemo(() => {
    // If postseason, use "Playoffs" for all rounds
    if (seasonType === 3) {
      return 'Playoffs';
    }
    // Regular season quarters
    if (currentWeek <= 4) return 'Period 1';
    if (currentWeek <= 9) return 'Period 2';
    if (currentWeek <= 14) return 'Period 3';
    return 'Period 4';
  }, [currentWeek, seasonType]);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch(`/api/periods/leaderboard?poolId=${poolId}&season=${season}&periodName=${encodeURIComponent(periodName)}&seasonType=${seasonType}`);
        if (!res.ok) throw new Error(`Failed to load quarter leaderboard: ${res.status}`);
        const data = await res.json();
        const lb = (data?.data?.leaderboard || []) as any[];
        setEntries(lb.map(e => ({
          participant_id: e.participant_id,
          name: e.name,
          total_points: e.total_points,
          total_correct: e.total_correct,
          weeks_won: e.weeks_won,
        })));
        const weeks = data?.data?.periodInfo?.weeks || [];
        // If postseason, use "Playoffs" label, otherwise use "Quarter"
        const label = seasonType === 3 ? 'Playoffs' : periodName.replace('Period', 'Quarter');
        if (seasonType === 3) {
          // For playoffs, show rounds instead of weeks
          const roundNames: Record<number, string> = {
            1: 'Wild Card Round',
            2: 'Divisional Round',
            3: 'Conference Championships',
            4: 'Super Bowl',
          };
          if (weeks.length > 0) {
            const roundLabels = weeks.map((w: number) => roundNames[w] || `Round ${w}`).join(', ');
            setPeriodLabel(`Playoffs (${roundLabels})`);
          } else {
            setPeriodLabel('Playoffs');
          }
        } else {
          setPeriodLabel(weeks.length > 0 ? `${label} (Weeks ${weeks[0]}-${weeks[weeks.length - 1]})` : label);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load quarter leaderboard');
      } finally {
        setIsLoading(false);
      }
    };
    if (poolId && season) load();
  }, [poolId, season, periodName, seasonType]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading quarter standings...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-500 mb-2">
          <TrendingUp className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">Unable to load quarter leaderboard</p>
        </div>
        <p className="text-xs text-gray-500">{error}</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-8">
        <Users className="h-8 w-8 mx-auto mb-2 text-gray-400" />
        <p className="text-sm text-gray-500">No quarter data available yet</p>
        <p className="text-xs text-gray-400">Complete weeks will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-600" />
              <span className="font-semibold">{periodLabel}</span>
            </div>
            <Badge variant="outline">{entries.length} participants</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {entries.map((e, idx) => (
          <Card key={e.participant_id} className={idx < 3 ? 'border-l-4 border-blue-500' : ''}>
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-sm text-gray-500 w-6 text-right">{idx + 1}</div>
                <div className="font-medium">{e.name}</div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="text-right">
                  <div className="font-semibold">{e.total_points}</div>
                  <div className="text-gray-500 text-xs">points</div>
                </div>
                <div className="text-right hidden sm:block">
                  <div className="font-semibold">{e.total_correct}</div>
                  <div className="text-gray-500 text-xs">correct</div>
                </div>
                <div className="text-right hidden sm:block">
                  <div className="font-semibold">{e.weeks_won}</div>
                  <div className="text-gray-500 text-xs">weeks won</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}


