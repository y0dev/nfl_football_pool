'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AuthProvider, useAuth } from '@/lib/auth';
import { SharedAdminGuard } from '@/components/auth/shared-admin-guard';
import { loadCurrentWeek } from '@/actions/loadCurrentWeek';
import { loadPools } from '@/actions/loadPools';
import { loadLeaderboard } from '@/actions/loadLeaderboard';
import { LeaderboardEntryWithPicks } from '@/actions/loadPicksForLeaderboard';
import { debugLog, createPageUrl } from '@/lib/utils';
import { 
  ArrowLeft, 
  Trophy, 
  Users, 
  Calendar, 
  TrendingUp, 
  BarChart3, 
  Eye, 
  EyeOff, 
  Clock, 
  Download, 
  FileSpreadsheet, 
  Target, 
  Filter, 
  Search, 
  AlertTriangle, 
  Crown, 
  Star, 
  TrendingDown, 
  Award, 
  Zap, 
  Shield, 
  Settings, 
  RefreshCw, 
  Copy, 
  Share2, 
  Bookmark, 
  Flag, 
  CheckCircle, 
  XCircle, 
  Minus,
  CalendarDays,
  Medal
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Game, LeaderboardEntry } from '@/types/game';
import { WeeklyWinner, SeasonWinner, PeriodWinner } from '@/types/winners';
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
  const { user, verifyAdminStatus } = useAuth();
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
  
  // Winner data
  const [weeklyWinners, setWeeklyWinners] = useState<WeeklyWinner[]>([]);
  const [seasonWinner, setSeasonWinner] = useState<SeasonWinner | null>(null);
  const [periodWinners, setPeriodWinners] = useState<PeriodWinner[]>([]);
  const [isLoadingWinners, setIsLoadingWinners] = useState(false);
  
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
  const [activeTab, setActiveTab] = useState('weekly');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

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
    const checkAdminStatus = async () => {
      try {
        // Check admin status first
        if (user) {
          debugLog('Checking admin status for user:', user.email);
          const superAdminStatus = await verifyAdminStatus(true);
          setIsSuperAdmin(superAdminStatus);
          
          // Both commissioners and admins can access this page
          // Commissioners will only see their own pools, admins will see all pools
          await loadData(superAdminStatus);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
      }
    };

    const loadData = async (superAdminStatus: boolean) => {
      try {
        const weekData = await loadCurrentWeek();
        setCurrentWeek(weekData?.week_number || 1);
        setCurrentSeasonType(weekData?.season_type || 2);
        setSelectedWeek(weekData?.week_number || 1);
        setSelectedSeasonType(weekData?.season_type || 2);
        
        await loadPoolsData(superAdminStatus);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAdminStatus();
  }, [user, verifyAdminStatus, router]);

  useEffect(() => {
    if (selectedPool && selectedWeek && selectedSeasonType) {
      loadLeaderboardData();
      loadGamesData();
      loadWinnerData();
    }
  }, [selectedPool, selectedWeek, selectedSeasonType]);

  const loadPoolsData = async (superAdminStatus: boolean) => {
    try {
      // Get pools based on user role
      const { getSupabaseServiceClient } = await import('@/lib/supabase');
      const supabase = getSupabaseServiceClient();
      
      let poolsQuery = supabase
        .from('pools')
        .select('*')
        .order('created_at', { ascending: false });
      
      // If user is not a super admin, only show pools they created
      if (!superAdminStatus) {
        poolsQuery = poolsQuery.eq('created_by', user?.email);
      }
      
      const { data: poolsData, error: poolsError } = await poolsQuery;
      
      if (poolsError) throw poolsError;
      
      setPools(poolsData || []);
      
      if (poolsData && poolsData.length > 0 && !selectedPool) {
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
      
      // Load leaderboard data from the API
      const response = await fetch(`/api/leaderboard?poolId=${selectedPool}&week=${selectedWeek}&seasonType=${selectedSeasonType}${selectedPoolSeason ? `&season=${selectedPoolSeason}` : ''}`);
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setLeaderboardWithPicks(result.leaderboard);
          setGames(result.games);
          
          if (process.env.NODE_ENV === 'development') {
            console.log('Leaderboard data loaded:', {
              leaderboard: result.leaderboard?.length || 0,
              games: result.games?.length || 0,
              data: result.leaderboard
            });
          }
        } else {
          console.error('API returned error:', result.error);
          setLeaderboardWithPicks([]);
        }
      } else {
        console.error('Failed to load leaderboard data');
        setLeaderboardWithPicks([]);
      }

      // Keep the old leaderboard for compatibility
      setLeaderboard([]);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
      setLeaderboard([]);
      setLeaderboardWithPicks([]);
    }
  };

  const loadGamesData = async () => {
    try {
      const response = await fetch(`/api/games/week?week=${selectedWeek}&seasonType=${selectedSeasonType}`);
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          const gamesData = result.games;
          setGames(gamesData);
          
          const now = new Date();
          const hasStarted = gamesData.some((game: Game) => {
            const gameTime = new Date(game.kickoff_time);
            return gameTime < now;
          });
          setIsGamesStarted(hasStarted);
          
          const allFinished = gamesData.every((game: Game) => 
            game.status === 'final' || game.status === 'post'
          );
          setAllGamesFinished(allFinished);
        } else {
          console.error('API returned error:', result.error);
          setGames([]);
        }
      } else {
        console.error('Failed to load games');
        setGames([]);
      }
    } catch (error) {
      console.error('Error loading games:', error);
      setGames([]);
    }
  };

  const loadWinnerData = async () => {
    if (!selectedPool || !selectedPoolSeason) return;
    
    setIsLoadingWinners(true);
    try {
      // Load weekly winners
      const weeklyResponse = await fetch(`/api/admin/winners/weekly?poolId=${selectedPool}&season=${selectedPoolSeason}`);
      if (weeklyResponse.ok) {
        const result = await weeklyResponse.json();
        if (result.success) {
          setWeeklyWinners(result.weeklyWinners);
        }
      }

      // Load season winner
      const seasonResponse = await fetch(`/api/admin/winners/season?poolId=${selectedPool}&season=${selectedPoolSeason}`);
      if (seasonResponse.ok) {
        const result = await seasonResponse.json();
        if (result.success) {
          setSeasonWinner(result.seasonWinner);
        }
      }

      // Load period winners
      const periodResponse = await fetch(`/api/admin/winners/period?poolId=${selectedPool}&season=${selectedPoolSeason}`);
      if (periodResponse.ok) {
        const result = await periodResponse.json();
        if (result.success) {
          setPeriodWinners(result.periodWinners);
        }
      }
    } catch (error) {
      console.error('Error loading winner data:', error);
    } finally {
      setIsLoadingWinners(false);
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

  const getPeriodDisplayName = (periodName: string) => {
    const periodNames: { [key: string]: string } = {
      'Q1': 'First Quarter (Weeks 1-4)',
      'Q2': 'Second Quarter (Weeks 5-8)',
      'Q3': 'Third Quarter (Weeks 9-12)',
      'Q4': 'Fourth Quarter (Weeks 13-16)',
      'Playoffs': 'Playoffs'
    };
    return periodNames[periodName] || periodName;
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
                onClick={() => router.push(isSuperAdmin ? '/admin/dashboard' : '/dashboard')}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold">
              {isSuperAdmin ? 'Pool Analytics & Winners' : 'My Pool Analytics & Winners'}
            </h1>
            <p className="text-gray-600">
              {isSuperAdmin 
                ? 'Comprehensive view of all pool performance, weekly leaderboards, and season winners'
                : 'View performance, leaderboards, and winners for your pools'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Pool Selection
          </CardTitle>
          <CardDescription>
            Select pool to view analytics data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
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
                Season {selectedPoolSeason}
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">Games: {games.length}</div>
              <div className="text-sm text-gray-600">Participants: {leaderboardWithPicks.length}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="weekly" className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Weekly
          </TabsTrigger>
          <TabsTrigger value="season" className="flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            Season
          </TabsTrigger>
          <TabsTrigger value="periods" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Periods
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* Weekly Leaderboard Tab */}
        <TabsContent value="weekly" className="space-y-6">
          {/* Week & Season Type Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Week & Season Selection
              </CardTitle>
              <CardDescription>
                Select the specific week and season type for the leaderboard
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Commissioner Controls
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

          {/* Weekly Leaderboard */}
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
        </TabsContent>

        {/* Season Winners Tab */}
        <TabsContent value="season" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5" />
                Season {selectedPoolSeason} Champion
              </CardTitle>
              <CardDescription>
                Overall season winner and performance statistics
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingWinners ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading season data...</p>
                </div>
              ) : seasonWinner ? (
                <div className="space-y-6">
                  {/* Champion Card */}
                  <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-lg p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="bg-yellow-500 text-white rounded-full p-3">
                          <Crown className="h-8 w-8" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-yellow-800">
                            {seasonWinner.winner_name}
                          </h3>
                          <p className="text-yellow-700">Season {selectedPoolSeason} Champion</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-yellow-800">
                          {seasonWinner.total_points}
                        </div>
                        <div className="text-yellow-700">Total Points</div>
                      </div>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-blue-600">{seasonWinner.total_correct_picks}</div>
                        <div className="text-sm text-gray-600">Correct Picks</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-green-600">{seasonWinner.weeks_won}</div>
                        <div className="text-sm text-gray-600">Weeks Won</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-purple-600">{seasonWinner.total_participants}</div>
                        <div className="text-sm text-gray-600">Total Participants</div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Tie Breaker Info */}
                  {seasonWinner.tie_breaker_used && (
                    <Card className="border-orange-200 bg-orange-50">
                      <CardContent className="p-4">
                        <h4 className="font-semibold text-orange-900 mb-2 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          Tie Breaker Used
                        </h4>
                        <div className="text-sm text-orange-800 space-y-1">
                          <p><strong>Question:</strong> {seasonWinner.tie_breaker_question}</p>
                          <p><strong>Correct Answer:</strong> {seasonWinner.tie_breaker_answer}</p>
                          <p><strong>Winner&apos;s Answer:</strong> {seasonWinner.winner_tie_breaker_answer}</p>
                          <p><strong>Difference:</strong> {seasonWinner.tie_breaker_difference}</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Season Winner Yet</h3>
                  <p className="text-gray-600">
                    The season is still in progress. Check back after all weeks are completed.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Period Winners Tab */}
        <TabsContent value="periods" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Quarter Winners
              </CardTitle>
              <CardDescription>
                Winners for different periods of the season (quarters, playoffs, etc.)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingWinners ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading quarter data...</p>
                </div>
              ) : periodWinners.length > 0 ? (
                <div className="space-y-4">
                  {periodWinners.map((period) => (
                    <Card key={period.id} className="border-l-4 border-blue-500">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold text-lg">{getPeriodDisplayName(period.period_name).replace('Period', 'Quarter')}</h4>
                            <p className="text-gray-600">Weeks {period.start_week} - {period.end_week}</p>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-bold text-blue-600">{period.winner_name}</div>
                            <div className="text-sm text-gray-600">{period.period_points} points</div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4 mt-4">
                          <div className="text-center">
                            <div className="text-lg font-semibold">{period.period_correct_picks}</div>
                            <div className="text-xs text-gray-600">Correct Picks</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-semibold">{period.weeks_won}</div>
                            <div className="text-xs text-gray-600">Weeks Won</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-semibold">{period.total_participants}</div>
                            <div className="text-xs text-gray-600">Participants</div>
                          </div>
                        </div>

                        {period.tie_breaker_used && (
                          <div className="mt-3 p-2 bg-orange-50 rounded text-xs text-orange-800">
                            <strong>Tie Breaker Used:</strong> Difference of {period.tie_breaker_difference}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Quarter Winners Yet</h3>
                  <p className="text-gray-600">
                    Quarter winners will be calculated as the season progresses.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Performance Analytics
              </CardTitle>
              <CardDescription>
                Detailed analytics and insights for the selected pool
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingWinners ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading analytics...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Weekly Winners Summary */}
                  <div>
                    <h4 className="font-semibold text-lg mb-3">Weekly Winners Summary</h4>
                    {weeklyWinners.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {weeklyWinners.map((winner) => (
                          <Card key={winner.id} className="border-l-4 border-green-500">
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-semibold">Week {winner.week}</div>
                                  <div className="text-sm text-gray-600">{winner.winner_name}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-lg font-bold">{winner.winner_points}</div>
                                  <div className="text-xs text-gray-600">points</div>
                                </div>
                              </div>
                              {winner.tie_breaker_used && (
                                <div className="mt-2 text-xs text-orange-600 bg-orange-50 p-1 rounded">
                                  Tie breaker used
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-600">No weekly winners data available yet.</p>
                    )}
                  </div>

                  {/* Performance Metrics */}
                  <div>
                    <h4 className="font-semibold text-lg mb-3">Performance Metrics</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <Card>
                        <CardContent className="p-4 text-center">
                          <div className="text-2xl font-bold text-blue-600">{weeklyWinners.length}</div>
                          <div className="text-sm text-gray-600">Weeks Completed</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {weeklyWinners.filter(w => w.tie_breaker_used).length}
                          </div>
                          <div className="text-sm text-gray-600">Tie Breakers Used</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 text-center">
                          <div className="text-2xl font-bold text-purple-600">
                            {leaderboardWithPicks.length}
                          </div>
                          <div className="text-sm text-gray-600">Active Participants</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 text-center">
                          <div className="text-2xl font-bold text-orange-600">
                            {games.length}
                          </div>
                          <div className="text-sm text-gray-600">Total Games</div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Debug Info */}
      {process.env.NODE_ENV === 'development' && (
        <Card className="mt-6 border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Debug Info</h3>
            <div className="text-sm text-blue-800 space-y-1">
              <p>Leaderboard entries: {leaderboardWithPicks.length}</p>
              <p>Games: {games.length}</p>
              <p>Weekly winners: {weeklyWinners.length}</p>
              <p>Quarter winners: {periodWinners.length}</p>
              <p>Season winner: {seasonWinner ? 'Yes' : 'No'}</p>
              <p>Selected pool: {selectedPool}</p>
              <p>Selected week: {selectedWeek}</p>
              <p>Season type: {selectedSeasonType}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <AuthProvider>
      <SharedAdminGuard>
        <LeaderboardContent />
      </SharedAdminGuard>
    </AuthProvider>
  );
}
