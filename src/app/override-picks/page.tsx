'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Target, Users, Calendar, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { AuthProvider } from '@/lib/auth';
import { AdminGuard } from '@/components/auth/admin-guard';
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
  predicted_winner: string;
  confidence_points: number;
  locked: boolean;
  submitted_by?: string;
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
  const [isSaving, setIsSaving] = useState(false);
  const [showAddPickDialog, setShowAddPickDialog] = useState(false);
  const [showMondayNightDialog, setShowMondayNightDialog] = useState(false);
  const [selectedParticipantForManagement, setSelectedParticipantForManagement] = useState<string>('');
  const [selectedParticipantForNewPick, setSelectedParticipantForNewPick] = useState<string>('');
  const [availableGames, setAvailableGames] = useState<Array<{
    id: string;
    home_team: string;
    away_team: string;
    week: number;
    season: number;
    season_type: number;
  }>>([]);
  const [allParticipants, setAllParticipants] = useState<Array<{
    id: string;
    name: string;
    email: string | null;
  }>>([]);
  const [newPickData, setNewPickData] = useState<{
    gameId: string;
    predictedWinner: string;
    confidencePoints: number;
  }>({
    gameId: '',
    predictedWinner: '',
    confidencePoints: 1
  });
  const [mondayNightScore, setMondayNightScore] = useState<string>('');

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

  const loadPicks = useCallback(async (poolId: string, week: number, season: number, seasonType: number) => {
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

      // First get games for this week/season/season_type
      const { data: gamesData, error: gamesError } = await client
        .from('games')
        .select('id, week, season, season_type')
        .eq('week', week)
        .eq('season', season)
        .eq('season_type', seasonType);

      if (gamesError) {
        console.error('❌ Error loading games:', gamesError);
        toast({
          title: 'Error',
          description: 'Failed to load games for this week',
          variant: 'destructive'
        });
        return;
      }

      const gameIds = gamesData?.map(game => game.id) || [];
      
      console.log(`🔍 Loading picks for Week ${week}, Season ${season}, Season Type ${seasonType}`);
      console.log(`🎮 Found ${gameIds.length} games:`, gamesData?.map(g => ({ id: g.id, week: g.week, season: g.season, season_type: g.season_type })));
      
      if (gameIds.length === 0) {
        console.log('❌ No games found for this week/season/season_type combination');
        setPicks([]);
        return;
      }

      const { data: picksData, error } = await client
        .from('picks')
        .select(`
          id,
          participant_id,
          pool_id,
          game_id,
          predicted_winner,
          confidence_points,
          locked,
          submitted_by,
          created_at,
          participants(name, email),
          games(home_team, away_team, week, season, season_type)
        `)
        .eq('pool_id', poolId)
        .in('game_id', gameIds)
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
      
      console.log(`📝 Found ${transformedPicks.length} picks:`, transformedPicks.map(p => ({
        id: p.id,
        participant: p.participants?.name,
        game: p.games ? `${p.games.away_team} @ ${p.games.home_team}` : 'Unknown',
        week: p.games?.week,
        season: p.games?.season,
        season_type: p.games?.season_type
      })));
      
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


  const loadAvailableGames = useCallback(async (week: number, season: number, seasonType: number) => {
    try {
      const supabase = getSupabaseClient();
      const serviceSupabase = getSupabaseServiceClient();
      const client = serviceSupabase || supabase;
      
      if (!client) {
        console.error('❌ No Supabase client available for loading games');
        return;
      }

      const { data: gamesData, error } = await client
        .from('games')
        .select('id, home_team, away_team, week, season, season_type')
        .eq('week', week)
        .eq('season', season)
        .eq('season_type', seasonType)
        .order('kickoff_time', { ascending: true });

      if (error) {
        console.error('❌ Error loading games:', error);
        toast({
          title: 'Error',
          description: 'Failed to load games',
          variant: 'destructive'
        });
        return;
      }

      setAvailableGames(gamesData || []);
    } catch (error) {
      console.error('❌ Error loading games:', error);
      toast({
        title: 'Error',
        description: 'Failed to load games',
        variant: 'destructive'
      });
    }
  }, [toast]);

  const loadAllParticipants = useCallback(async (poolId: string) => {
    try {
      const supabase = getSupabaseClient();
      const serviceSupabase = getSupabaseServiceClient();
      const client = serviceSupabase || supabase;
      
      if (!client) {
        console.error('❌ No Supabase client available for loading participants');
        return;
      }

      const { data: participantsData, error } = await client
        .from('participants')
        .select('id, name, email')
        .eq('pool_id', poolId)
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('❌ Error loading participants:', error);
        toast({
          title: 'Error',
          description: 'Failed to load participants',
          variant: 'destructive'
        });
        return;
      }

      setAllParticipants(participantsData || []);
    } catch (error) {
      console.error('❌ Error loading participants:', error);
      toast({
        title: 'Error',
        description: 'Failed to load participants',
        variant: 'destructive'
      });
    }
  }, [toast]);

  const submitNewPick = useCallback(async () => {
    const participantId = selectedParticipantForNewPick || selectedParticipantForManagement;
    if (!participantId || !newPickData.gameId || !newPickData.predictedWinner) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      });
      return;
    }

    setIsSaving(true);
    try {
      const supabase = getSupabaseClient();
      const serviceSupabase = getSupabaseServiceClient();
      const client = serviceSupabase || supabase;
      
      if (!client) {
        toast({
          title: 'Error',
          description: 'Database connection not available',
          variant: 'destructive'
        });
        return;
      }

        const { error } = await client
          .from('picks')
          .insert({
            participant_id: participantId,
            pool_id: selectedPool,
            game_id: newPickData.gameId,
            predicted_winner: newPickData.predictedWinner,
            confidence_points: newPickData.confidencePoints,
            submitted_by: 'admin_override'
          });

      if (error) {
        console.error('❌ Error submitting new pick:', error);
        toast({
          title: 'Error',
          description: 'Failed to submit pick',
          variant: 'destructive'
        });
        return;
      }

      // Refresh picks
      if (selectedPool && selectedWeek && currentSeason) {
        await loadPicks(selectedPool, parseInt(selectedWeek), currentSeason, parseInt(selectedSeasonType || '2'));
      }

      // Reset form
      setShowAddPickDialog(false);
      setSelectedParticipantForNewPick('');
      setNewPickData({
        gameId: '',
        predictedWinner: '',
        confidencePoints: 1
      });

      toast({
        title: 'Success',
        description: 'Pick submitted successfully'
      });
    } catch (error) {
      console.error('❌ Error submitting new pick:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit pick',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  }, [selectedParticipantForNewPick, selectedParticipantForManagement, newPickData, selectedPool, selectedWeek, currentSeason, selectedSeasonType, loadPicks, toast]);

  const submitMondayNightScore = useCallback(async () => {
    if (!selectedParticipantForManagement || !mondayNightScore) {
      toast({
        title: 'Error',
        description: 'Please enter a Monday night score',
        variant: 'destructive'
      });
      return;
    }

    const score = parseInt(mondayNightScore);
    if (isNaN(score) || score < 0) {
      toast({
        title: 'Error',
        description: 'Monday night score must be a positive number',
        variant: 'destructive'
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/override-monday-night-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poolId: selectedPool,
          participantId: selectedParticipantForManagement,
          week: parseInt(selectedWeek || '1'),
          season: currentSeason,
          seasonType: parseInt(selectedSeasonType || '2'),
          mondayNightScore: score
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({ title: 'Success', description: result.message });
        setShowMondayNightDialog(false);
        setMondayNightScore('');
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error submitting Monday night score:', error);
      toast({ title: 'Error', description: 'An unexpected error occurred', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }, [selectedParticipantForManagement, mondayNightScore, selectedPool, selectedWeek, currentSeason, selectedSeasonType, toast]);

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
      loadPicks(selectedPool, week, currentSeason, seasonType);
      // Load available games for the week
      loadAvailableGames(week, currentSeason, seasonType);
      // Load all participants for the pool
      loadAllParticipants(selectedPool);
    } else {
      setWeekInfo(null);
      setPicks([]); // Clear picks when no selection
      setAvailableGames([]); // Clear games
      setAllParticipants([]); // Clear participants
    }
  }, [selectedPool, selectedWeek, selectedSeasonType, currentSeason, loadPicks, loadAvailableGames, loadAllParticipants]);

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

      {/* Participant Selection and Management */}
      {weekInfo && selectedPoolData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              Manage Participant Picks - Week {weekInfo.week}
            </CardTitle>
            <CardDescription>
              Select a participant to add picks, override existing picks, or update Monday night scores.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Participant Selection */}
            <div className="space-y-2">
              <Label htmlFor="participant-select">Select Participant</Label>
              <Select value={selectedParticipantForManagement} onValueChange={setSelectedParticipantForManagement}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a participant to manage" />
                </SelectTrigger>
                <SelectContent>
                  {allParticipants.map(participant => (
                    <SelectItem key={participant.id} value={participant.id}>
                      {participant.name} ({participant.email || 'No email'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Participant Actions */}
            {selectedParticipantForManagement && (
              <div className="space-y-4">
                {/* Show participant's current picks for this week */}
                {(() => {
                  const participantPicks = picks.filter(p => p.participant_id === selectedParticipantForManagement);
                  const participant = allParticipants.find(p => p.id === selectedParticipantForManagement);
                  
                  return (
                    <div className="space-y-3">
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <h4 className="font-semibold mb-2">{participant?.name}</h4>
                        <div className="text-sm text-gray-600">
                          {participantPicks.length > 0 ? (
                            <span>{participantPicks.length} picks submitted for Week {weekInfo.week}</span>
                          ) : (
                            <span>No picks submitted for Week {weekInfo.week}</span>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 flex-wrap">
                        <Button 
                          variant="default" 
                          size="sm" 
                          onClick={() => setShowAddPickDialog(true)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          {participantPicks.length > 0 ? 'Override Picks' : 'Add Picks'}
                        </Button>
                        
                        {(weekInfo.isPeriodWeek || weekInfo.isSuperBowl) && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setShowMondayNightDialog(true)}
                          >
                            <Target className="h-4 w-4 mr-2" />
                            Update Monday Night Score
                          </Button>
                        )}
                      </div>

                      {/* Show existing picks in compact format */}
                      {participantPicks.length > 0 && (
                        <div className="space-y-2">
                          <h5 className="font-medium text-sm">Current Picks:</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {participantPicks.map(pick => (
                              <div key={pick.id} className="p-2 border rounded text-xs">
                                <div className="font-medium">{pick.games?.away_team} @ {pick.games?.home_team}</div>
                                <div className="text-gray-600">Pick: {pick.predicted_winner} ({pick.confidence_points} pts)</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Additional Actions - Compact */}
      {weekInfo && selectedPoolData && picks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-green-600" />
              Additional Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  toast({
                    title: 'Info',
                    description: 'Bulk edit functionality coming soon'
                  });
                }}
              >
                <Edit className="h-4 w-4 mr-2" />
                Bulk Edit
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  toast({
                    title: 'Info',
                    description: 'Export functionality coming soon'
                  });
                }}
              >
                <Users className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!selectedPool && (
        <Alert>
          <AlertDescription>
            Please select a pool, week, and season type to begin overriding picks.
          </AlertDescription>
        </Alert>
      )}

        {/* Add Pick Dialog */}
        <Dialog open={showAddPickDialog} onOpenChange={setShowAddPickDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Pick for Participant</DialogTitle>
              <DialogDescription>
                Submit a pick on behalf of a participant who hasn&apos;t submitted yet.
              </DialogDescription>
            </DialogHeader>
            
        <div className="space-y-4">
          {/* Participant Selection - Pre-filled if coming from management */}
          <div className="space-y-2">
            <Label htmlFor="participant">Participant</Label>
            <Select 
              value={selectedParticipantForNewPick || selectedParticipantForManagement} 
              onValueChange={setSelectedParticipantForNewPick}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a participant" />
              </SelectTrigger>
              <SelectContent>
                {allParticipants.map(participant => (
                  <SelectItem key={participant.id} value={participant.id}>
                    {participant.name} ({participant.email || 'No email'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

              {/* Game Selection */}
              <div className="space-y-2">
                <Label htmlFor="game">Game</Label>
                <Select 
                  value={newPickData.gameId} 
                  onValueChange={(value) => {
                    const game = availableGames.find(g => g.id === value);
                    setNewPickData(prev => ({
                      ...prev,
                      gameId: value,
                      predictedWinner: game ? game.home_team : ''
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a game" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableGames.map(game => (
                      <SelectItem key={game.id} value={game.id}>
                        {game.away_team} @ {game.home_team}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Predicted Winner */}
              {newPickData.gameId && (
                <div className="space-y-2">
                  <Label htmlFor="predictedWinner">Predicted Winner</Label>
                  <Select 
                    value={newPickData.predictedWinner} 
                    onValueChange={(value) => setNewPickData(prev => ({ ...prev, predictedWinner: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select winner" />
                    </SelectTrigger>
                    <SelectContent>
                      {(() => {
                        const game = availableGames.find(g => g.id === newPickData.gameId);
                        return game ? (
                          <>
                            <SelectItem value={game.home_team}>
                              {game.home_team}
                            </SelectItem>
                            <SelectItem value={game.away_team}>
                              {game.away_team}
                            </SelectItem>
                          </>
                        ) : null;
                      })()}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Confidence Points */}
              <div className="space-y-2">
                <Label htmlFor="confidencePoints">Confidence Points</Label>
                <Input
                  id="confidencePoints"
                  type="number"
                  min="1"
                  max="16"
                  value={newPickData.confidencePoints}
                  onChange={(e) => setNewPickData(prev => ({ ...prev, confidencePoints: parseInt(e.target.value) || 1 }))}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddPickDialog(false)}>
                Cancel
              </Button>
              <Button onClick={submitNewPick} disabled={isSaving}>
                {isSaving ? 'Submitting...' : 'Submit Pick'}
              </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Monday Night Score Dialog */}
    <Dialog open={showMondayNightDialog} onOpenChange={setShowMondayNightDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update Monday Night Score</DialogTitle>
          <DialogDescription>
            Set the Monday night game score prediction for {allParticipants.find(p => p.id === selectedParticipantForManagement)?.name}.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mondayNightScore">Monday Night Score</Label>
            <Input
              id="mondayNightScore"
              type="number"
              min="0"
              step="1"
              placeholder="e.g., 45"
              value={mondayNightScore}
              onChange={(e) => setMondayNightScore(e.target.value)}
            />
            <p className="text-xs text-gray-500">
              Enter the predicted total points scored in the Monday night game.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setShowMondayNightDialog(false)}>
            Cancel
          </Button>
          <Button onClick={submitMondayNightScore} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Score'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </div>
  );
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