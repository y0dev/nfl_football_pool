'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AuthProvider, useAuth } from '@/lib/auth';
import { AdminGuard } from '@/components/auth/admin-guard';
import { loadCurrentWeek } from '@/actions/loadCurrentWeek';
import { loadPools } from '@/actions/loadPools';
import { loadLeaderboard } from '@/actions/loadLeaderboard';
import { loadWeekGames } from '@/actions/loadWeekGames';
import { loadLeaderboardWithPicks, LeaderboardEntryWithPicks } from '@/actions/loadPicksForLeaderboard';
import { ArrowLeft, Trophy, Users, Calendar, TrendingUp, BarChart3, Eye, EyeOff, Clock, Download, FileSpreadsheet, Target, Filter, Search, AlertTriangle, Crown, Star, TrendingDown, Award, Zap, Shield, Settings, RefreshCw, Copy, Share2, Bookmark, Flag, CheckCircle, XCircle, Minus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Game, LeaderboardEntry } from '@/types/game';
import { DEFAULT_POOL_SEASON, getMaxWeeksForSeason, getSeasonTypeName } from '@/lib/utils';

interface Pool {
  id: string;
  name: string;
  created_by: string;
  season: number;
  is_active: boolean;
  created_at: string;
}

function LeaderboardContent() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [currentWeek, setCurrentWeek] = useState(1);
  const [currentSeasonType, setCurrentSeasonType] = useState(2);
  const [selectedPool, setSelectedPool] = useState<string>('');
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedSeasonType, setSelectedSeasonType] = useState(2);
  const [selectedPoolSeason, setSelectedPoolSeason] = useState<number>(DEFAULT_POOL_SEASON);
  const [pools, setPools] = useState<Pool[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardWithPicks, setLeaderboardWithPicks] = useState<LeaderboardEntryWithPicks[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGamesStarted, setIsGamesStarted] = useState(false);
  const [allParticipantsSubmitted, setAllParticipantsSubmitted] = useState(false);
  const [allGamesFinished, setAllGamesFinished] = useState(false);
  
  // Admin-specific features
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'points' | 'accuracy' | 'name' | 'correct_picks'>('points');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showOnlySubmitted, setShowOnlySubmitted] = useState(false);
  const [highlightedParticipant, setHighlightedParticipant] = useState<string | null>(null);
  const [favoriteParticipants, setFavoriteParticipants] = useState<Set<string>>(new Set());
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [performanceThreshold, setPerformanceThreshold] = useState(50);
  const [showPerformanceAlerts, setShowPerformanceAlerts] = useState(true);

  // Helper functions for safe data access
  const getParticipantName = (entry: LeaderboardEntry | LeaderboardEntryWithPicks, isDummy: boolean) => {
    if (isDummy) {
      return (entry as LeaderboardEntry).participants?.name || 'Unknown';
    }
    return (entry as LeaderboardEntryWithPicks).participant_name || 'Unknown';
  };

  const getTotalPoints = (entry: LeaderboardEntry | LeaderboardEntryWithPicks, isDummy: boolean) => {
    if (isDummy) {
      return (entry as LeaderboardEntry).points || 0;
    }
    return (entry as LeaderboardEntryWithPicks).total_points || 0;
  };

  const getParticipantId = (entry: LeaderboardEntry | LeaderboardEntryWithPicks, isDummy: boolean) => {
    if (isDummy) {
      return (entry as LeaderboardEntry).id || 'unknown';
    }
    return (entry as LeaderboardEntryWithPicks).participant_id || 'unknown';
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const weekData = await loadCurrentWeek();
        setCurrentWeek(weekData?.week_number || 1);
        setCurrentSeasonType(weekData?.season_type || 2);
        setSelectedWeek(weekData?.week_number || 1);
        setSelectedSeasonType(weekData?.season_type || 2);
        
        await loadPoolsData();
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user]);

  useEffect(() => {
    if (selectedPool && selectedWeek && selectedSeasonType) {
      loadLeaderboardData();
      loadGamesData();
    }
  }, [selectedPool, selectedWeek, selectedSeasonType]);

  const loadPoolsData = async () => {
    try {
      const poolsData = await loadPools(user?.email, user?.is_super_admin);
      setPools(poolsData);
      
      if (poolsData.length > 0 && !selectedPool) {
        setSelectedPool(poolsData[0].id);
      }
    } catch (error) {
      console.error('Error loading pools:', error);
    }
  };

  const loadLeaderboardData = async () => {
    try {
      if (selectedPool) {
        const selectedPoolData = pools.find(p => p.id === selectedPool);
          if (selectedPoolData) {
          setSelectedPoolSeason(selectedPoolData.season || DEFAULT_POOL_SEASON);
        }
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log('Loading leaderboard data for:', {
          pool: selectedPool,
          week: selectedWeek,
          seasonType: selectedSeasonType,
          season: selectedPoolSeason
        });
      }
      
      const [leaderboardData, leaderboardWithPicksData] = await Promise.all([
        loadLeaderboard(selectedPool, selectedWeek),
        loadLeaderboardWithPicks(selectedPool, selectedWeek, selectedSeasonType, selectedPoolSeason)
      ]);

      if (process.env.NODE_ENV === 'development') {
        console.log('Leaderboard data loaded:', {
          oldLeaderboard: leaderboardData?.length || 0,
          newLeaderboard: leaderboardWithPicksData?.length || 0,
          data: leaderboardWithPicksData
        });
      }

      setLeaderboard(leaderboardData);
      setLeaderboardWithPicks(leaderboardWithPicksData);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
      setLeaderboard([]);
      setLeaderboardWithPicks([]);
    }
  };

  const loadGamesData = async () => {
    try {
      const gamesData = await loadWeekGames(selectedWeek, selectedSeasonType);
      setGames(gamesData);
      
      const now = new Date();
      const hasStarted = gamesData.some(game => {
        const gameTime = new Date(game.kickoff_time);
        return gameTime < now;
      });
      setIsGamesStarted(hasStarted);
      
      const allFinished = gamesData.every(game => 
        game.status === 'final' || game.status === 'post'
      );
      setAllGamesFinished(allFinished);
    } catch (error) {
      console.error('Error loading games:', error);
      setGames([]);
    }
  };

  const getTeamAbbreviation = (teamName: string) => {
    const abbreviations: { [key: string]: string } = {
      'New England Patriots': 'NE',
      'Buffalo Bills': 'BUF',
      'Miami Dolphins': 'MIA',
      'New York Jets': 'NYJ',
      'Baltimore Ravens': 'BAL',
      'Cincinnati Bengals': 'CIN',
      'Cleveland Browns': 'CLE',
      'Pittsburgh Steelers': 'PIT',
      'Houston Texans': 'HOU',
      'Indianapolis Colts': 'IND',
      'Jacksonville Jaguars': 'JAX',
      'Tennessee Titans': 'TEN',
      'Kansas City Chiefs': 'KC',
      'Las Vegas Raiders': 'LV',
      'Los Angeles Chargers': 'LAC',
      'Denver Broncos': 'DEN',
      'Dallas Cowboys': 'DAL',
      'New York Giants': 'NYG',
      'Philadelphia Eagles': 'PHI',
      'Washington Commanders': 'WAS',
      'Chicago Bears': 'CHI',
      'Detroit Lions': 'DET',
      'Green Bay Packers': 'GB',
      'Minnesota Vikings': 'MIN',
      'Atlanta Falcons': 'ATL',
      'Carolina Panthers': 'CAR',
      'New Orleans Saints': 'NO',
      'Tampa Bay Buccaneers': 'TB',
      'Arizona Cardinals': 'ARI',
      'Los Angeles Rams': 'LAR',
      'San Francisco 49ers': 'SF',
      'Seattle Seahawks': 'SEA'
    };
    return abbreviations[teamName] || teamName.split(' ').map(word => word[0]).join('').toUpperCase();
  };

  const filteredAndSortedLeaderboard = () => {
    let data = leaderboardWithPicks;
    
    if (searchTerm) {
      data = data.filter(entry => 
        entry.participant_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (showOnlySubmitted) {
      data = data.filter(entry => entry.total_picks > 0);
    }
    
    data.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;
      
      switch (sortBy) {
        case 'points':
          aValue = a.total_points;
          bValue = b.total_points;
          break;
        case 'accuracy':
          aValue = a.total_picks > 0 ? (a.correct_picks / a.total_picks) * 100 : 0;
          bValue = b.total_picks > 0 ? (b.correct_picks / b.total_picks) * 100 : 0;
          break;
        case 'name':
          aValue = a.participant_name.toLowerCase();
          bValue = b.participant_name.toLowerCase();
          break;
        case 'correct_picks':
          aValue = a.correct_picks;
          bValue = b.correct_picks;
          break;
        default:
          aValue = a.total_points;
          bValue = b.total_points;
      }
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      } else {
        return sortOrder === 'asc' ? (aValue as number) - (bValue as number) : (bValue as number) - (aValue as number);
      }
    });
    
    return data;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Button
                onClick={() => router.push('/admin/dashboard')}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold">Leaderboard Analytics</h1>
            <p className="text-gray-600">
              View detailed leaderboards and performance analytics
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Leaderboard Filters
          </CardTitle>
          <CardDescription>
            Select pool, season type, and week to view leaderboard data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Pool</label>
              <Select value={selectedPool} onValueChange={setSelectedPool}>
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
            
            <div>
              <label className="text-sm font-medium mb-2 block">Season Type</label>
              <Select value={selectedSeasonType.toString()} onValueChange={(value) => setSelectedSeasonType(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select season type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Preseason</SelectItem>
                  <SelectItem value="2">Regular Season</SelectItem>
                  <SelectItem value="3">Postseason</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Week</label>
              <Select value={selectedWeek.toString()} onValueChange={(value) => setSelectedWeek(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select week" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: getMaxWeeksForSeason(selectedSeasonType) }, (_, i) => i + 1).map((week) => (
                    <SelectItem key={week} value={week.toString()}>
                      Week {week}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Admin Controls */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Admin Controls
          </CardTitle>
          <CardDescription>
            Advanced filtering, sorting, and management tools
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search participants..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Filter className="h-4 w-4" />
                  {showAdvancedFilters ? 'Hide' : 'Show'} Filters
                </Button>
              </div>
            </div>

            {showAdvancedFilters && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="text-sm font-medium mb-2 block">Sort By</label>
                  <Select value={sortBy} onValueChange={(value: 'points' | 'accuracy' | 'name' | 'correct_picks') => setSortBy(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="points">Total Points</SelectItem>
                      <SelectItem value="accuracy">Accuracy %</SelectItem>
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="correct_picks">Correct Picks</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Sort Order</label>
                  <Select value={sortOrder} onValueChange={(value: 'asc' | 'desc') => setSortOrder(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="desc">Descending</SelectItem>
                      <SelectItem value="asc">Ascending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-end">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showOnlySubmitted}
                      onChange={(e) => setShowOnlySubmitted(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">Show only submitted</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Current Selection Info */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">
                {pools.find(p => p.id === selectedPool)?.name || 'No Pool Selected'}
              </h3>
              <p className="text-gray-600">
                {getSeasonTypeName(selectedSeasonType)} - Week {selectedWeek}
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">Games: {games.length}</div>
              <div className="text-sm text-gray-600">Participants: {leaderboardWithPicks.length}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Debug Info */}
      {process.env.NODE_ENV === 'development' && (
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Debug Info</h3>
            <div className="text-sm text-blue-800 space-y-1">
              <p>Leaderboard entries: {leaderboardWithPicks.length}</p>
              <p>Games: {games.length}</p>
              <p>Selected pool: {selectedPool}</p>
              <p>Selected week: {selectedWeek}</p>
              <p>Season type: {selectedSeasonType}</p>
              {leaderboardWithPicks.length > 0 && (
                <div>
                  <p>Sample entry:</p>
                  <pre className="text-xs bg-white p-2 rounded mt-1 overflow-auto">
                    {JSON.stringify(leaderboardWithPicks[0], null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Week {selectedWeek} Leaderboard
          </CardTitle>
          <CardDescription>
            {getSeasonTypeName(selectedSeasonType)} - {pools.find(p => p.id === selectedPool)?.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {leaderboardWithPicks.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>Participant</TableHead>
                    <TableHead className="text-center">Total Points</TableHead>
                    <TableHead className="text-center">Correct Picks</TableHead>
                    <TableHead className="text-center">Total Picks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedLeaderboard().map((entry, index) => (
                    <TableRow key={entry.participant_id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {index === 0 && <Trophy className="h-4 w-4 text-yellow-500" />}
                          {index === 1 && <Trophy className="h-4 w-4 text-gray-400" />}
                          {index === 2 && <Trophy className="h-4 w-4 text-orange-600" />}
                          {index + 1}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {entry.participant_name}
                      </TableCell>
                      <TableCell className="text-center font-bold">
                        {entry.total_points}
                      </TableCell>
                      <TableCell className="text-center">
                        {entry.correct_picks}
                      </TableCell>
                      <TableCell className="text-center">
                        {entry.total_picks}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Leaderboard Data</h3>
              <p className="text-gray-600">
                No participants have submitted picks for this week yet.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminLeaderboardPage() {
  return (
    <AuthProvider>
      <AdminGuard>
        <LeaderboardContent />
      </AdminGuard>
    </AuthProvider>
  );
}
