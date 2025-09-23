'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Target, Users, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { AuthProvider } from '@/lib/auth';
import { AdminGuard } from '@/components/auth/admin-guard';
import { OverrideMondayNightScore } from '@/components/admin/override-monday-night-score';
import { PERIOD_WEEKS, SUPER_BOWL_SEASON_TYPE } from '@/lib/utils';
import { getSupabaseClient, getSupabaseServiceClient } from '@/lib/supabase';

interface Pool {
  id: string;
  name: string;
  season: number;
  is_active: boolean;
}

interface Pick {
  id: string;
  participant_id: string;
  pool_id: string;
  game_id: string;
  team: string;
  week: number;
  season: number;
  created_at: string;
  participants?: {
    name: string;
    email?: string;
  };
  games?: {
    home_team: string;
    away_team: string;
    week: number;
    season: number;
    season_type: number;
  };
}

interface WeekInfo {
  week: number;
  season: number;
  seasonType: number;
  isPeriodWeek: boolean;
  isSuperBowl: boolean;
}

function OverridePicksContent() {
  const router = useRouter();
  const { toast } = useToast();
  const [pools, setPools] = useState<Pool[]>([]);
  const [selectedPool, setSelectedPool] = useState<string>('');
  const [weeks, setWeeks] = useState<number[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [seasonTypes, setSeasonTypes] = useState<{ value: number; label: string }[]>([]);
  const [selectedSeasonType, setSelectedSeasonType] = useState<string>('2');
  const [currentSeason, setCurrentSeason] = useState<number>(2024);
  const [isLoading, setIsLoading] = useState(true);
  const [weekInfo, setWeekInfo] = useState<WeekInfo | null>(null);
  const [error] = useState<string | null>(null);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [isLoadingPicks, setIsLoadingPicks] = useState(false);

  const loadPools = useCallback(async () => {
    try {
      // Try both client types
      const supabase = getSupabaseClient();
      const serviceSupabase = getSupabaseServiceClient();
      
      if (!supabase && !serviceSupabase) {
        console.error('❌ No Supabase client available');
        toast({
          title: 'Error',
          description: 'Database connection not available',
          variant: 'destructive'
        });
        return;
      }

      // Use service client if available, otherwise use regular client
      const client = serviceSupabase || supabase;
      
      const { data: poolsData, error } = await client
        .from('pools')
        .select('id, name, season, is_active')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('❌ Error loading pools:', error);
        toast({
          title: 'Error',
          description: 'Failed to load pools',
          variant: 'destructive'
        });
        return;
      }

      setPools(poolsData || []);
    } catch (error) {
      console.error('❌ Error loading pools:', error);
      toast({
        title: 'Error',
        description: 'Failed to load pools',
        variant: 'destructive'
      });
    }
  }, [toast]);

  const loadPicks = useCallback(async (poolId: string, week: number, season: number) => {
    setIsLoadingPicks(true);
    try {
      const supabase = getSupabaseClient();
      const serviceSupabase = getSupabaseServiceClient();
      const client = serviceSupabase || supabase;
      
      if (!client) {
        console.error('❌ No Supabase client available for loading picks');
        toast({
          title: 'Error',
          description: 'Database connection not available',
          variant: 'destructive'
        });
        return;
      }

      const { data: picksData, error } = await client
        .from('picks')
        .select(`
          id,
          participant_id,
          pool_id,
          game_id,
          team,
          week,
          season,
          created_at,
          participants!inner(name, email),
          games!inner(home_team, away_team, week, season, season_type)
        `)
        .eq('pool_id', poolId)
        .eq('week', week)
        .eq('season', season)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error loading picks:', error);
        toast({
          title: 'Error',
          description: 'Failed to load picks',
          variant: 'destructive'
        });
        return;
      }

      // Transform the data to match our interface
      const transformedPicks = (picksData || []).map(pick => ({
        ...pick,
        participants: Array.isArray(pick.participants) ? pick.participants[0] : pick.participants,
        games: Array.isArray(pick.games) ? pick.games[0] : pick.games
      }));
      
      setPicks(transformedPicks);
    } catch (error) {
      console.error('❌ Error loading picks:', error);
      toast({
        title: 'Error',
        description: 'Failed to load picks',
        variant: 'destructive'
      });
    } finally {
      setIsLoadingPicks(false);
    }
  }, [toast]);

  const loadCurrentWeek = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        console.error('Supabase client not initialized');
        setIsLoading(false);
        return;
      }

      const { data: game, error } = await supabase
        .from('games')
        .select('week, season, season_type')
        .order('week', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error('Error loading current week:', error);
        // Set default values if we can't load from database
        setCurrentSeason(2024);
        const regularWeeks = Array.from({ length: 18 }, (_, i) => i + 1);
        setWeeks(regularWeeks);
        setSeasonTypes([
          { value: 1, label: 'Preseason' },
          { value: 2, label: 'Regular Season' },
          { value: 3, label: 'Playoffs' }
        ]);
        return;
      }

      if (game) {
        setCurrentSeason(game.season || 2024);
        
        // Generate weeks 1-18 for regular season
        const regularWeeks = Array.from({ length: 18 }, (_, i) => i + 1);
        setWeeks(regularWeeks);
        
        // Set season types
        setSeasonTypes([
          { value: 1, label: 'Preseason' },
          { value: 2, label: 'Regular Season' },
          { value: 3, label: 'Playoffs' }
        ]);
      }
    } catch (error) {
      console.error('Error loading current week:', error);
      // Set default values on error
      setCurrentSeason(2024);
      const regularWeeks = Array.from({ length: 18 }, (_, i) => i + 1);
      setWeeks(regularWeeks);
      setSeasonTypes([
        { value: 1, label: 'Preseason' },
        { value: 2, label: 'Regular Season' },
        { value: 3, label: 'Playoffs' }
      ]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPools();
    loadCurrentWeek();
  }, [loadPools, loadCurrentWeek]);

  useEffect(() => {
    if (selectedPool && selectedWeek && selectedSeasonType) {
      const week = parseInt(selectedWeek);
      const seasonType = parseInt(selectedSeasonType);
      const isPeriodWeek = PERIOD_WEEKS.includes(week as typeof PERIOD_WEEKS[number]);
      const isSuperBowl = seasonType === SUPER_BOWL_SEASON_TYPE;
      
      setWeekInfo({
        week,
        season: currentSeason,
        seasonType,
        isPeriodWeek,
        isSuperBowl
      });

      // Load picks for the selected pool, week, and season
      loadPicks(selectedPool, week, currentSeason);
    } else {
      setWeekInfo(null);
      setPicks([]); // Clear picks when no selection
    }
  }, [selectedPool, selectedWeek, selectedSeasonType, currentSeason, loadPicks]);

  const selectedPoolData = pools.find(p => p.id === selectedPool);

  // Debug logging (can be removed in production)
  console.log('🔍 Current state:', { 
    pools: pools.length, 
    selectedPool, 
    selectedWeek, 
    selectedSeasonType,
    isLoading,
    error,
    picks: picks.length,
    isLoadingPicks
  });

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>
              Reload Page
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p>Loading override picks...</p>
          </div>
        </div>
      </div>
    );
  }

  try {
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
            <h1 className="text-3xl font-bold">Override Picks</h1>
            <p className="text-gray-600">Override participant picks and Monday night scores</p>
              </div>
        </div>

      {/* Selection Controls */}
      <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Select Pool and Week
            </CardTitle>
            <CardDescription>
            Choose the pool and week you want to override picks for
            </CardDescription>
          </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="pool">Pool</Label>
              <Select value={selectedPool} onValueChange={setSelectedPool}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a pool" />
                </SelectTrigger>
                <SelectContent>
                  {pools.map((pool) => (
                    <SelectItem key={pool.id} value={pool.id}>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span>{pool.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {pool.season}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

              <div>
              <Label htmlFor="week">Week</Label>
              <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a week" />
                    </SelectTrigger>
                    <SelectContent>
                  {weeks.map((week) => {
                    const isPeriodWeek = PERIOD_WEEKS.includes(week as typeof PERIOD_WEEKS[number]);
                    return (
                      <SelectItem key={week} value={week.toString()}>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>Week {week}</span>
                          {isPeriodWeek && (
                            <Badge variant="secondary" className="text-xs">
                              Period Week
                            </Badge>
                          )}
                        </div>
                        </SelectItem>
                    );
                  })}
                    </SelectContent>
                  </Select>
              </div>

            <div>
              <Label htmlFor="seasonType">Season Type</Label>
              <Select value={selectedSeasonType} onValueChange={setSelectedSeasonType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select season type" />
                </SelectTrigger>
                <SelectContent>
                  {seasonTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value.toString()}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              </div>
            </div>

          {selectedPool && selectedWeek && selectedSeasonType && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">Selected Configuration</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-blue-700 font-medium">Pool:</span>
                  <p className="text-blue-900">{selectedPoolData?.name}</p>
                </div>
                <div>
                  <span className="text-blue-700 font-medium">Week:</span>
                  <p className="text-blue-900">Week {selectedWeek}</p>
                </div>
            <div>
                  <span className="text-blue-700 font-medium">Season Type:</span>
                  <p className="text-blue-900">
                    {seasonTypes.find(t => t.value.toString() === selectedSeasonType)?.label}
                  </p>
                </div>
              </div>
            </div>
          )}
          </CardContent>
        </Card>

      {/* Picks Display */}
      {weekInfo && selectedPoolData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              Picks for {selectedPoolData.name} - Week {weekInfo.week}
            </CardTitle>
            <CardDescription>
              View all picks submitted for the selected pool and week
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingPicks ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2">Loading picks...</span>
              </div>
            ) : picks.length > 0 ? (
              <div className="space-y-4">
                {/* Group picks by participant */}
                {Array.from(new Set(picks.map(p => p.participant_id))).map(participantId => {
                  const participantPicks = picks.filter(p => p.participant_id === participantId);
                  const participant = participantPicks[0]?.participants;
                  
                  return (
                    <div key={participantId} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-lg">{participant?.name}</h4>
                        <Badge variant="outline">
                          {participantPicks.length} picks
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {participantPicks.map(pick => (
                          <div key={pick.id} className="bg-gray-50 rounded p-3">
                            <div className="text-sm text-gray-600">
                              {pick.games?.away_team} @ {pick.games?.home_team}
                            </div>
                            <div className="font-medium">
                              Picked: {pick.team}
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(pick.created_at).toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Alert>
                <AlertDescription>
                  No picks found for this pool and week combination.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Override Components */}
      {weekInfo && selectedPoolData && (
        <div className="space-y-6">
          {/* Monday Night Score Override */}
          <OverrideMondayNightScore
            poolId={selectedPool}
            poolName={selectedPoolData.name}
            week={weekInfo.week}
            season={weekInfo.season}
            seasonType={weekInfo.seasonType}
          />

          {/* Future: Add other override components here */}
          {!weekInfo.isPeriodWeek && !weekInfo.isSuperBowl && (
            <Alert>
              <AlertDescription>
                Monday night score override is only available for period weeks (4, 9, 14, 18) and Super Bowl.
                Selected week {weekInfo.week} is not a period week.
              </AlertDescription>
            </Alert>
                                )}
                              </div>
                            )}

      {!selectedPool && (
        <Alert>
          <AlertDescription>
            Please select a pool, week, and season type to begin overriding picks.
          </AlertDescription>
        </Alert>
                )}
              </div>
  );
  } catch (error) {
    console.error('Error in OverridePicksContent:', error);
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Unexpected Error</h2>
            <p className="text-red-600 mb-4">An unexpected error occurred. Please try refreshing the page.</p>
            <Button onClick={() => window.location.reload()}>
              Reload Page
            </Button>
              </div>
            </div>
    </div>
  );
  }
}

export default function OverridePicksPage() {
  return (
    <AuthProvider>
      <AdminGuard>
        <OverridePicksContent />
      </AdminGuard>
    </AuthProvider>
  );
}