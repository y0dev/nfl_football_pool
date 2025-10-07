'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Medal, Award, Target, TrendingUp, Users, Calendar, BarChart3 } from 'lucide-react';

interface SeasonReviewData {
  seasonWinner: any;
  quarterlyWinners: any[];
  weeklyWinners: any[];
  participantStats: {
    participant_id: string;
    name: string;
    total_points: number;
    total_correct_picks: number;
    total_picks: number;
    weeks_won: number;
    best_week: {
      week: number;
      points: number;
      correct_picks: number;
    };
    worst_week: {
      week: number;
      points: number;
      correct_picks: number;
    };
    average_points_per_week: number;
    consistency_score: number;
  }[];
  seasonStats: {
    total_weeks: number;
    total_participants: number;
    total_games: number;
    average_points_per_week: number;
    highest_weekly_score: number;
    lowest_weekly_score: number;
    tie_breakers_used: number;
    most_wins_by_participant: string;
    most_wins_count: number;
    closest_weekly_margin: number;
    biggest_weekly_blowout: number;
  };
}

export default function SeasonReviewPage() {
  const params = useParams();
  const router = useRouter();
  const poolId = params.poolId as string;
  const season = params.season as string;

  const [data, setData] = useState<SeasonReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSeasonData();
  }, [poolId, season]);

  const loadSeasonData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/season-review?poolId=${poolId}&season=${season}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to load season data');
      }
    } catch (err) {
      setError('Failed to load season data');
      console.error('Error loading season data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading season review...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Season Review</h1>
          <p className="text-muted-foreground mb-4">
            {error || 'No season data available'}
          </p>
          <Button onClick={() => router.back()}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const { seasonWinner, quarterlyWinners, weeklyWinners, participantStats, seasonStats } = data;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <Button variant="outline" onClick={() => router.back()}>
          ← Back
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold truncate">
            {season} Season Review
          </h1>
          <p className="text-muted-foreground">
            Complete season statistics and achievements
          </p>
        </div>
      </div>

      {/* Season Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{seasonStats.total_weeks}</p>
                <p className="text-xs text-muted-foreground">Weeks</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{seasonStats.total_participants}</p>
                <p className="text-xs text-muted-foreground">Participants</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{seasonStats.total_games}</p>
                <p className="text-xs text-muted-foreground">Games</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{seasonStats.average_points_per_week}</p>
                <p className="text-xs text-muted-foreground">Avg Points/Week</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="winners">Winners</TabsTrigger>
          <TabsTrigger value="participants">Participants</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* Season Winner */}
          {seasonWinner && (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-600" />
                  Season Champion
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold">{seasonWinner.winner_name}</h3>
                    <p className="text-muted-foreground">
                      {seasonWinner.total_points} points • {seasonWinner.weeks_won} weeks won
                    </p>
                    {seasonWinner.tie_breaker_used && (
                      <Badge variant="secondary" className="mt-2">
                        Won via tie-breaker
                      </Badge>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Correct Picks</p>
                    <p className="text-lg font-semibold">
                      {seasonWinner.total_correct_picks}/{seasonWinner.total_participants * seasonStats.total_weeks}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quarterly Winners */}
          {quarterlyWinners.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Medal className="h-5 w-5 text-blue-600" />
                  Quarterly Champions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {quarterlyWinners.map((quarter) => (
                    <div key={quarter.period_name} className="text-center p-4 border rounded-lg">
                      <h4 className="font-semibold text-lg">{quarter.period_name}</h4>
                      <p className="font-bold text-primary">{quarter.winner_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {quarter.period_points} points
                      </p>
                      {quarter.tie_breaker_used && (
                        <Badge variant="outline" className="mt-1 text-xs">
                          Tie-breaker
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Season Highlights */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-green-600" />
                Season Highlights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-sm">
                    <span className="font-medium">Highest Weekly Score:</span> {seasonStats.highest_weekly_score} points
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Most Weekly Wins:</span> {seasonStats.most_wins_by_participant} ({seasonStats.most_wins_count} wins)
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Closest Weekly Margin:</span> {seasonStats.closest_weekly_margin} points
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm">
                    <span className="font-medium">Tie-breakers Used:</span> {seasonStats.tie_breakers_used} weeks
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Lowest Weekly Score:</span> {seasonStats.lowest_weekly_score} points
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Biggest Weekly Blowout:</span> {seasonStats.biggest_weekly_blowout} points
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Special Awards */}
          {participantStats.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-purple-600" />
                  Special Awards
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <h4 className="font-semibold text-lg text-green-600">Most Consistent</h4>
                    <p className="font-bold">
                      {participantStats.reduce((most, current) => 
                        current.consistency_score < most.consistency_score ? current : most
                      ).name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Consistency Score: {Math.min(...participantStats.map(p => p.consistency_score))}
                    </p>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <h4 className="font-semibold text-lg text-blue-600">Highest Average</h4>
                    <p className="font-bold">
                      {participantStats.reduce((highest, current) => 
                        current.average_points_per_week > highest.average_points_per_week ? current : highest
                      ).name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {Math.max(...participantStats.map(p => p.average_points_per_week))} pts/week
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Winners Tab */}
        <TabsContent value="winners" className="space-y-4">
          {/* Weekly Winners */}
          <Card>
            <CardHeader>
              <CardTitle>Weekly Winners</CardTitle>
              <CardDescription>All weekly champions for the {season} season</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {weeklyWinners.map((winner) => (
                  <div key={winner.week} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">Week {winner.week}</Badge>
                      <div>
                        <p className="font-medium">{winner.winner_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {winner.winner_points} points • {winner.winner_correct_picks} correct
                        </p>
                      </div>
                    </div>
                    {winner.tie_breaker_used && (
                      <Badge variant="secondary">Tie-breaker</Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Participants Tab */}
        <TabsContent value="participants" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Participant Statistics</CardTitle>
              <CardDescription>Detailed stats for all participants</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {participantStats.map((participant, index) => (
                  <div key={participant.participant_id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Badge variant={index < 3 ? "default" : "outline"}>
                          #{index + 1}
                        </Badge>
                        <h3 className="font-semibold">{participant.name}</h3>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{participant.total_points} points</p>
                        <p className="text-sm text-muted-foreground">
                          {participant.weeks_won} weeks won
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Best Week</p>
                        <p className="font-medium">Week {participant.best_week.week}: {participant.best_week.points} pts</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Worst Week</p>
                        <p className="font-medium">Week {participant.worst_week.week}: {participant.worst_week.points} pts</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Avg Points/Week</p>
                        <p className="font-medium">{participant.average_points_per_week}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Consistency</p>
                        <p className="font-medium">{participant.consistency_score}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Weekly Tab */}
        <TabsContent value="weekly" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Breakdown</CardTitle>
              <CardDescription>Week-by-week performance analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {weeklyWinners.map((winner) => (
                  <div key={winner.week} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold">Week {winner.week}</h4>
                      <Badge variant="outline">{winner.total_participants} participants</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{winner.winner_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {winner.winner_points} points • {winner.winner_correct_picks} correct picks
                        </p>
                      </div>
                      {winner.tie_breaker_used && (
                        <Badge variant="secondary">Tie-breaker used</Badge>
                      )}
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
