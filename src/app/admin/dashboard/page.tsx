'use client';

import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  getWeeklySubmissions, 
  exportToExcel, 
  calculateWeeklyScores,
  getQuarterlyStandings,
  getAdminPools
} from '@/actions/adminActions';
import { runPostGameCalculations } from '@/actions/autoScoreCalculation';
import { 
  Download, 
  RefreshCw, 
  Trophy, 
  Users, 
  CheckCircle, 
  XCircle,
  Clock,
  TrendingUp,
  Loader2
} from 'lucide-react';

interface Submission {
  participant_id: string;
  participant_name: string;
  submitted_at: string;
  game_count: number;
  total_confidence: number;
}

interface WeeklyScore {
  participant_id: string;
  participant_name: string;
  points: number;
  correct_picks: number;
  total_picks: number;
  rank: number;
}

interface QuarterlyStanding {
  participant_id: string;
  participant_name: string;
  total_points: number;
  weeks_played: number;
  average_points: number;
  rank: number;
}

function AdminDashboardContent() {
  const { user } = useAuth();
  const [selectedPool, setSelectedPool] = useState<string>('');
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [weeklyScores, setWeeklyScores] = useState<WeeklyScore[]>([]);
  const [quarterlyStandings, setQuarterlyStandings] = useState<QuarterlyStanding[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pools, setPools] = useState<any[]>([]);

  useEffect(() => {
    if (user?.is_super_admin) {
      loadPools();
    }
  }, [user]);

  useEffect(() => {
    if (selectedPool) {
      loadWeeklyData();
    }
  }, [selectedPool, selectedWeek]);

  const loadPools = async () => {
    try {
      const poolsData = await getAdminPools();
      setPools(poolsData);
    } catch (error) {
      console.error('Failed to load pools:', error);
    }
  };

  const loadWeeklyData = async () => {
    if (!selectedPool) return;
    
    setIsLoading(true);
    try {
      const [submissionsData, scoresData] = await Promise.all([
        getWeeklySubmissions(selectedPool, selectedWeek),
        calculateWeeklyScores(selectedPool, selectedWeek)
      ]);
      
      setSubmissions(submissionsData);
      setWeeklyScores(scoresData);
    } catch (error) {
      console.error('Failed to load weekly data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadQuarterlyStandings = async () => {
    if (!selectedPool) return;
    
    setIsLoading(true);
    try {
      const standings = await getQuarterlyStandings(selectedPool);
      setQuarterlyStandings(standings);
    } catch (error) {
      console.error('Failed to load quarterly standings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportExcel = async () => {
    if (!selectedPool) return;
    
    try {
      await exportToExcel(selectedPool, selectedWeek);
    } catch (error) {
      console.error('Failed to export Excel:', error);
    }
  };

  const handleCalculateScores = async () => {
    if (!selectedPool) return;
    
    setIsLoading(true);
    try {
      const scores = await calculateWeeklyScores(selectedPool, selectedWeek);
      setWeeklyScores(scores);
    } catch (error) {
      console.error('Failed to calculate scores:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAutoCalculate = async () => {
    setIsLoading(true);
    try {
      await runPostGameCalculations();
      console.log('Automatic score calculation completed');
      // Refresh the current view
      if (selectedPool) {
        await loadWeeklyData();
      }
    } catch (error) {
      console.error('Failed to run automatic calculation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user?.is_super_admin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-gray-600">You need admin privileges to access this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600">Manage pool submissions and track scores</p>
          </div>
          <div className="flex items-center space-x-4">
            <Badge variant="outline">
              Pool: {pools.find(p => p.id === selectedPool)?.name || 'Select Pool'}
            </Badge>
            <Badge variant="outline">
              Week: {selectedWeek}
            </Badge>
          </div>
        </div>

        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Controls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Select Pool</label>
                <Select value={selectedPool} onValueChange={setSelectedPool}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a pool" />
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
              
              <div>
                <label className="text-sm font-medium mb-2 block">Select Week</label>
                <Select value={selectedWeek.toString()} onValueChange={(value) => setSelectedWeek(parseInt(value))}>
                  <SelectTrigger>
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
              </div>
              
              <div className="flex items-end space-x-2">
                <Button 
                  onClick={handleCalculateScores} 
                  disabled={isLoading || !selectedPool}
                  className="flex-1"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <TrendingUp className="h-4 w-4 mr-2" />
                  )}
                  Calculate Scores
                </Button>
                <Button 
                  onClick={handleAutoCalculate}
                  disabled={isLoading}
                  variant="secondary"
                  size="sm"
                  title="Run automatic score calculation for all pools"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="flex items-end">
                <Button 
                  onClick={handleExportExcel} 
                  disabled={isLoading || !selectedPool}
                  variant="outline"
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Excel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submission Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              Weekly Submissions
            </CardTitle>
            <CardDescription>
              Track who has submitted picks for the current week
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Participant</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted At</TableHead>
                    <TableHead>Games Picked</TableHead>
                    <TableHead>Total Confidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((submission) => (
                    <TableRow key={submission.participant_id}>
                      <TableCell className="font-medium">
                        {submission.participant_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Submitted
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(submission.submitted_at).toLocaleString()}
                      </TableCell>
                      <TableCell>{submission.game_count}</TableCell>
                      <TableCell>{submission.total_confidence}</TableCell>
                    </TableRow>
                  ))}
                  {submissions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                        No submissions yet for this week
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Weekly Scores */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Trophy className="h-5 w-5" />
              Week {selectedWeek} Scores
            </CardTitle>
            <CardDescription>
              Current standings for the selected week
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>Participant</TableHead>
                    <TableHead>Points</TableHead>
                    <TableHead>Correct Picks</TableHead>
                    <TableHead>Total Picks</TableHead>
                    <TableHead>Accuracy</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weeklyScores.map((score) => (
                    <TableRow key={score.participant_id}>
                      <TableCell className="font-bold">
                        #{score.rank}
                      </TableCell>
                      <TableCell className="font-medium">
                        {score.participant_name}
                      </TableCell>
                      <TableCell className="font-bold text-lg">
                        {score.points}
                      </TableCell>
                      <TableCell>{score.correct_picks}</TableCell>
                      <TableCell>{score.total_picks}</TableCell>
                      <TableCell>
                        {score.total_picks > 0 
                          ? `${((score.correct_picks / score.total_picks) * 100).toFixed(1)}%`
                          : '0%'
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                  {weeklyScores.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        No scores calculated yet for this week
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Quarterly Standings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              Quarterly Standings
            </CardTitle>
            <CardDescription>
              Overall standings for the first quarter of the season
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-gray-600">
                Based on the first 4 weeks of the season
              </p>
              <Button 
                onClick={loadQuarterlyStandings}
                disabled={isLoading}
                size="sm"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>Participant</TableHead>
                    <TableHead>Total Points</TableHead>
                    <TableHead>Weeks Played</TableHead>
                    <TableHead>Average Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quarterlyStandings.map((standing) => (
                    <TableRow key={standing.participant_id}>
                      <TableCell className="font-bold">
                        #{standing.rank}
                      </TableCell>
                      <TableCell className="font-medium">
                        {standing.participant_name}
                      </TableCell>
                      <TableCell className="font-bold text-lg">
                        {standing.total_points}
                      </TableCell>
                      <TableCell>{standing.weeks_played}</TableCell>
                      <TableCell>
                        {standing.average_points.toFixed(1)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {quarterlyStandings.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                        No quarterly standings available yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <AuthProvider>
      <AdminDashboardContent />
    </AuthProvider>
  );
} 