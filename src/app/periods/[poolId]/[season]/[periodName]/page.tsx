'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Trophy, Medal, Award, Users, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PeriodWinner {
  id: string;
  pool_id: string;
  season: number;
  period_name: string;
  winner_participant_id: string;
  winner_name: string;
  winner_points: number;
  winner_correct_picks: number;
  tie_breaker_used: boolean;
  tie_breaker_question?: string;
  total_participants: number;
  created_at: string;
}

interface WeeklyWinner {
  id: string;
  pool_id: string;
  week: number;
  season: number;
  winner_participant_id: string;
  winner_name: string;
  winner_points: number;
  winner_correct_picks: number;
  tie_breaker_used: boolean;
  tie_breaker_question?: string;
  total_participants: number;
  created_at: string;
}

interface LeaderboardEntry {
  participant_id: string;
  name: string;
  email: string;
  total_points: number;
  total_correct: number;
  total_picks: number;
  weeks_won: number;
  weekly_scores: Array<{
    week: number;
    points: number;
    correct: number;
    total: number;
  }>;
}

interface PeriodInfo {
  name: string;
  weeks: number[];
  totalWeeks: number;
}

export default function PeriodLeaderboardPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  
  const poolId = params.poolId as string;
  const season = params.season as string;
  const periodName = decodeURIComponent(params.periodName as string);

  const [periodWinner, setPeriodWinner] = useState<PeriodWinner | null>(null);
  const [weeklyWinners, setWeeklyWinners] = useState<WeeklyWinner[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [periodInfo, setPeriodInfo] = useState<PeriodInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPeriodData();
  }, [poolId, season, periodName]);

  const loadPeriodData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/periods/leaderboard?poolId=${poolId}&season=${season}&periodName=${encodeURIComponent(periodName)}`
      );
      
      const result = await response.json();
      
      if (result.success) {
        setPeriodWinner(result.data.periodWinner);
        setWeeklyWinners(result.data.weeklyWinners);
        setLeaderboard(result.data.leaderboard);
        setPeriodInfo(result.data.periodInfo);
      } else {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error loading period data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load period data',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 1:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 2:
        return <Award className="h-5 w-5 text-amber-600" />;
      default:
        return <span className="text-sm font-medium text-gray-500">#{index + 1}</span>;
    }
  };

  const getRankColor = (index: number) => {
    switch (index) {
      case 0:
        return 'bg-yellow-50 border-yellow-200';
      case 1:
        return 'bg-gray-50 border-gray-200';
      case 2:
        return 'bg-amber-50 border-amber-200';
      default:
        return 'bg-white border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p>Loading period leaderboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.back()}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{periodName} Leaderboard</h1>
          <p className="text-gray-600">Season {season} • Pool {poolId.slice(0, 8)}...</p>
        </div>
      </div>

      {/* Period Winner */}
      {periodWinner && (
        <Card className="mb-8 border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-800">
              <Trophy className="h-6 w-6" />
              Period Winner
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-yellow-900">{periodWinner.winner_name}</h3>
                <p className="text-yellow-700">
                  {periodWinner.winner_points} points • {periodWinner.winner_correct_picks} correct picks
                </p>
                {periodWinner.tie_breaker_used && (
                  <Badge variant="secondary" className="mt-2">
                    Tie Breaker Used
                  </Badge>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm text-yellow-600">Total Participants</p>
                <p className="text-2xl font-bold text-yellow-900">{periodWinner.total_participants}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="leaderboard" className="space-y-6">
        <TabsList>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="weekly">Weekly Winners</TabsTrigger>
        </TabsList>

        {/* Leaderboard Tab */}
        <TabsContent value="leaderboard" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Period Leaderboard
              </CardTitle>
              <CardDescription>
                {periodInfo && `Weeks ${periodInfo.weeks.join(', ')} • ${periodInfo.totalWeeks} weeks`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {leaderboard.map((participant, index) => (
                  <div
                    key={participant.participant_id}
                    className={`p-4 rounded-lg border ${getRankColor(index)}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {getRankIcon(index)}
                        <div>
                          <h4 className="font-semibold">{participant.name}</h4>
                          <p className="text-sm text-gray-600">{participant.email}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="text-sm text-gray-600">Points</p>
                            <p className="text-xl font-bold">{participant.total_points}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Weeks Won</p>
                            <p className="text-xl font-bold">{participant.weeks_won}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Record</p>
                            <p className="text-xl font-bold">
                              {participant.total_correct}-{participant.total_picks - participant.total_correct}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Weekly Winners Tab */}
        <TabsContent value="weekly" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Weekly Winners
              </CardTitle>
              <CardDescription>
                Individual week winners during this period
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {weeklyWinners.map((winner) => (
                  <div key={winner.id} className="p-4 bg-gray-50 rounded-lg border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-bold text-blue-600">W{winner.week}</span>
                        </div>
                        <div>
                          <h4 className="font-semibold">{winner.winner_name}</h4>
                          <p className="text-sm text-gray-600">
                            {winner.winner_points} points • {winner.winner_correct_picks} correct
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {winner.tie_breaker_used && (
                          <Badge variant="secondary">Tie Breaker</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
