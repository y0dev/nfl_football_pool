'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { AuthProvider, useAuth } from '@/lib/auth';
import { AdminGuard } from '@/components/auth/admin-guard';
import { ArrowLeft, Users, Shield, AlertCircle, CheckCircle, Clock, Save, Trash2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getUpcomingWeek } from '@/actions/loadCurrentWeek';
import { loadPools } from '@/actions/loadPools';
import { getPoolParticipants } from '@/actions/adminActions';
import { MAX_CONFIDENCE_POINTS, DEFAULT_SEASON_TYPE, DEFAULT_WEEK, debugLog } from '@/lib/utils';

interface Pool {
  id: string;
  name: string;
  description: string;
  created_by: string;
  season: number;
  is_active: boolean;
  created_at: string;
}

interface Participant {
  id: string;
  name: string;
  email?: string;
}

interface Pick {
  id: string;
  game_id: string;
  home_team: string;
  away_team: string;
  confidence: number;
  winner: string;
}

function OverridePicksContent() {
  const { user, verifyAdminStatus } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const [currentWeek, setCurrentWeek] = useState(DEFAULT_WEEK);
  const [currentSeasonType, setCurrentSeasonType] = useState(DEFAULT_SEASON_TYPE);
  const [isLoading, setIsLoading] = useState(true);
  const [pools, setPools] = useState<Pool[]>([]);
  const [selectedPool, setSelectedPool] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedParticipant, setSelectedParticipant] = useState('');
  const [participantPicks, setParticipantPicks] = useState<Pick[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);
  const [isLoadingPicks, setIsLoadingPicks] = useState(false);
  const [selectedPicks, setSelectedPicks] = useState<Set<string>>(new Set());
  const [pickUpdates, setPickUpdates] = useState<{[key: string]: {winner: string, confidence: number}}>({});
  const [overrideMode, setOverrideMode] = useState<'picks' | 'erase_all'>('picks');
  const [overrideReason, setOverrideReason] = useState('');
  const [isOverriding, setIsOverriding] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [usedConfidenceNumbers, setUsedConfidenceNumbers] = useState<Set<number>>(new Set());
  const [isWeekCompleted, setIsWeekCompleted] = useState(false);
  const [showEraseSuccessDialog, setShowEraseSuccessDialog] = useState(false);
  const [erasedPicksCount, setErasedPicksCount] = useState(0);

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        // Check admin status first
        if (user) {
          debugLog('Checking admin status for user:', user.email);
          const superAdminStatus = await verifyAdminStatus(true);
          
          // Redirect commissioners to their dashboard
          if (!superAdminStatus) {
            router.push('/dashboard');
            return;
          }
        }
        
        // Only load data for super admins
        await loadData();
      } catch (error) {
        console.error('Error checking admin status:', error);
      }
    };

    const loadData = async () => {
      try {
        setIsLoading(true);
        
        // Load current week
        const weekData = await getUpcomingWeek();
        debugLog('Week data:', weekData);
        setCurrentWeek(weekData?.week || 1);
        setCurrentSeasonType(weekData?.seasonType || 2);
        
        // Load pools - check if user is admin
        const isSuperAdmin = await verifyAdminStatus(true);
        const poolsData = await loadPools(user?.email, isSuperAdmin);
        console.log('Pools loaded:', poolsData);
        setPools(poolsData);

        // Set initial pool from URL parameter
        const poolId = searchParams.get('pool');
        if (poolId) {
          setSelectedPool(poolId);
          loadPoolParticipants(poolId);
        }
      } catch (error) {
        console.error('Error loading data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load initial data',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    checkAdminStatus();
  }, [user, verifyAdminStatus, router]);

  // Check if current week is completed
  useEffect(() => {
    if (currentWeek && currentSeasonType) {
      checkWeekStatus();
    }
  }, [currentWeek, currentSeasonType]);

  const checkWeekStatus = async () => {
    try {
      const response = await fetch(`/api/admin/week-status?week=${currentWeek}&season_type=${currentSeasonType}&season=2025`);
      
      if (!response.ok) {
        console.error('Error checking week status:', response.statusText);
        return;
      }
      
      const data = await response.json();
      setIsWeekCompleted(data.isCompleted);
      
      if (data.isCompleted) {
        toast({
          title: 'Week Already Completed',
          description: `Week ${currentWeek} has already finished. Picks cannot be overridden for completed weeks.`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error checking week status:', error);
    }
  };

  const loadPoolParticipants = async (poolId: string) => {
    setIsLoadingParticipants(true);
    try {
      const participantsData = await getPoolParticipants(poolId);
      console.log('Participants loaded:', participantsData);
      setParticipants(participantsData || []);
    } catch (error) {
      console.error('Error loading participants:', error);
      toast({
        title: 'Error',
        description: 'Failed to load participants',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingParticipants(false);
    }
  };

  const loadParticipantPicks = async (participantId: string) => {
    if (!selectedPool) return;
    
    setIsLoadingPicks(true);
    try {
      const response = await fetch(`/api/admin/participant-picks?participant_id=${participantId}&pool_id=${selectedPool}&week=${currentWeek}&season_type=${currentSeasonType}`);
      
      if (!response.ok) {
        console.error('Error loading participant picks:', response.statusText);
        toast({
          title: 'Error',
          description: 'Failed to load participant picks',
          variant: 'destructive',
        });
        return;
      }

      const data = await response.json();
      
      if (!data.picks || data.picks.length === 0) {
        setParticipantPicks([]);
        setUsedConfidenceNumbers(new Set());
        return;
      }

      setParticipantPicks(data.picks);
      setSelectedPicks(new Set());
      setPickUpdates({});
      
      // Track used confidence numbers (exclude 0 values)
      const usedNumbers = new Set(data.usedConfidenceNumbers as number[]);
      setUsedConfidenceNumbers(usedNumbers);
    } catch (error) {
      console.error('Error loading participant picks:', error);
      toast({
        title: 'Error',
        description: 'Failed to load participant picks',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingPicks(false);
    }
  };

  const handlePickSelection = (pickId: string, selected: boolean) => {
    const newSelected = new Set(selectedPicks);
    if (selected) {
      newSelected.add(pickId);
    } else {
      newSelected.delete(pickId);
    }
    setSelectedPicks(newSelected);
  };

  const handlePickUpdate = (pickId: string, field: 'winner' | 'confidence', value: string | number) => {
    setPickUpdates(prev => {
      const newUpdates = {
        ...prev,
        [pickId]: {
          ...prev[pickId],
          [field]: field === 'confidence' ? Number(value) : value
        }
      };
      
      // Update used confidence numbers
      if (field === 'confidence') {
        // Recalculate all used confidence numbers from scratch
        const allUsedNumbers = new Set<number>();
        
        // Add original pick confidences (excluding the current pick being modified)
        participantPicks.forEach(pick => {
          if (pick.id !== pickId && pick.confidence !== 0) {
            allUsedNumbers.add(pick.confidence);
          }
        });
        
        // Add all updated confidences (excluding the current pick and 0 values)
        Object.entries(newUpdates).forEach(([updatePickId, update]) => {
          if (updatePickId !== pickId && update.confidence && update.confidence !== 0) {
            allUsedNumbers.add(update.confidence);
          }
        });
        
        // Add the new value if it's not 0
        const newValue = Number(value);
        if (newValue !== 0) {
          allUsedNumbers.add(newValue);
        }
        
        setUsedConfidenceNumbers(allUsedNumbers);
      }
      
      return newUpdates;
    });
  };

  const handleOverridePicks = async () => {
    if (!selectedPool || !selectedParticipant || !user) {
      toast({
        title: 'Error',
        description: 'Missing required information',
        variant: 'destructive',
      });
      return;
    }

    if (!overrideReason.trim()) {
      toast({
        title: 'Reason Required',
        description: 'Please provide a reason for overriding picks',
        variant: 'destructive',
      });
      return;
    }

    if (selectedPicks.size === 0) {
      toast({
        title: 'No Picks Selected',
        description: overrideMode === 'picks' 
          ? 'Please select at least one pick to override'
          : 'Please confirm that you want to erase all picks',
        variant: 'destructive',
      });
      return;
    }

    // For picks mode, check for missing or duplicate confidence numbers
    if (overrideMode === 'picks') {
      const confidenceNumbers = new Set<number>();
      const duplicates: string[] = [];
      const missingConfidence: string[] = [];
      
      Object.entries(pickUpdates).forEach(([pickId, update]) => {
        const pick = participantPicks.find(p => p.id === pickId);
        if (pick) {
          // Check for missing confidence
          if (update.confidence === 0) {
            missingConfidence.push(`${pick.away_team} @ ${pick.home_team}`);
          }
          // Check for duplicates (only if confidence is not 0)
          else if (update.confidence) {
            if (confidenceNumbers.has(update.confidence)) {
              duplicates.push(`${pick.away_team} @ ${pick.home_team} (${update.confidence})`);
            } else {
              confidenceNumbers.add(update.confidence);
            }
          }
        }
      });

      if (missingConfidence.length > 0) {
        toast({
          title: 'Missing Confidence Numbers',
          description: `The following picks need confidence numbers assigned: ${missingConfidence.join(', ')}`,
          variant: 'destructive',
        });
        return;
      }

      if (duplicates.length > 0) {
        toast({
          title: 'Duplicate Confidence Numbers',
          description: `The following picks have duplicate confidence numbers: ${duplicates.join(', ')}`,
          variant: 'destructive',
        });
        return;
      }
    }

    setIsOverriding(true);
    try {
      // Call the API route instead of direct database calls
      const response = await fetch('/api/admin/override-picks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          poolId: selectedPool,
          participantId: selectedParticipant,
          week: currentWeek,
          seasonType: currentSeasonType,
          overrideMode,
          overrideReason,
          pickUpdates: overrideMode === 'picks' ? pickUpdates : undefined,
          adminId: user.id
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to override picks');
      }

      if (overrideMode === 'picks') {
        toast({
          title: 'Picks Updated',
          description: result.message,
        });
      } else {
        // For erase all picks, show success dialog instead of just toast
        setErasedPicksCount(result.erasedCount || participantPicks.length);
        setShowEraseSuccessDialog(true);
      }

      // Reset form
      setOverrideReason('');
      setSelectedPicks(new Set());
      setPickUpdates({});
      setShowConfirmDialog(false);

    } catch (error) {
      console.error('Error overriding picks:', error);
      toast({
        title: 'Error',
        description: 'Failed to override picks',
        variant: 'destructive',
      });
    } finally {
      setIsOverriding(false);
    }
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
        <div className="flex items-center gap-2 sm:gap-4 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/admin/dashboard')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Dashboard</span>
            <span className="sm:hidden">Back</span>
          </Button>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold">
          {overrideMode === 'picks' ? 'Override Participant Picks' : 'Erase All Participant Picks'}
        </h1>
        <p className="text-sm sm:text-base text-gray-600">
          {overrideMode === 'picks' 
            ? `Select a pool, participant, and specific picks to override for Week ${currentWeek}`
            : `Select a pool and participant to erase all their picks for Week ${currentWeek}`
          }
        </p>
      </div>

      {/* Week Status Warning */}
      {isWeekCompleted && (
        <div className="col-span-full mb-4">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <div>
                  <h3 className="font-medium text-red-800">Week Already Completed</h3>
                  <p className="text-sm text-red-700">
                    Week {currentWeek} has already finished and all games have results. 
                    Picks cannot be overridden for completed weeks.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Selection Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Selection
            </CardTitle>
            <CardDescription>
              Choose pool, participant, and picks to override
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Pool Selection */}
            <div>
              <Label htmlFor="pool-select">Pool *</Label>
              <Select 
                value={selectedPool} 
                onValueChange={(value) => {
                  console.log('Pool selected:', value);
                  setSelectedPool(value);
                  setSelectedParticipant('');
                  setParticipantPicks([]);
                  if (value) {
                    loadPoolParticipants(value);
                  }
                }}
                disabled={isWeekCompleted}
              >
                <SelectTrigger className="w-full">
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

            {/* Participant Selection */}
            {selectedPool && (
              <div>
                <Label htmlFor="participant-select">Participant *</Label>
                {isLoadingParticipants ? (
                  <div className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-sm text-gray-600">
                    Loading participants...
                  </div>
                ) : (
                  <Select 
                    value={selectedParticipant} 
                    onValueChange={(value) => {
                      setSelectedParticipant(value);
                      setParticipantPicks([]);
                      if (value) {
                        loadParticipantPicks(value);
                      }
                    }}
                    disabled={isWeekCompleted}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a participant" />
                    </SelectTrigger>
                    <SelectContent>
                      {participants.map((participant) => (
                        <SelectItem key={participant.id} value={participant.id}>
                          {participant.name} {participant.email ? `(${participant.email})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {/* Override Mode Selection */}
            <div>
              <Label htmlFor="override-mode">Override Mode *</Label>
              <Select 
                value={overrideMode} 
                onValueChange={(value: 'picks' | 'erase_all') => {
                  setOverrideMode(value);
                  setSelectedPicks(new Set());
                  setPickUpdates({});
                }}
                disabled={isWeekCompleted}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="picks">Override Specific Picks</SelectItem>
                  <SelectItem value="erase_all">Erase All Picks</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-xs text-gray-500 mt-1">
                {overrideMode === 'picks' 
                  ? 'Select and modify specific picks to override'
                  : 'Remove all picks for the selected participant'
                }
              </div>
            </div>

            {/* Reason Input */}
            <div>
              <Label htmlFor="override-reason">Reason for Override *</Label>
              <Textarea
                id="override-reason"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Explain why you are overriding these picks..."
                className="resize-none"
                rows={3}
                maxLength={500}
                disabled={isWeekCompleted}
              />
              <div className="text-xs text-gray-500 mt-1">
                {overrideReason.length}/500 characters
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Picks Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {overrideMode === 'picks' ? 'Picks Selection' : 'Erase All Picks'}
            </CardTitle>
            <CardDescription>
              {overrideMode === 'picks' 
                ? 'Select and modify specific picks to override'
                : 'Remove all picks for the selected participant'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedParticipant ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Select a participant to view their picks</p>
              </div>
            ) : isLoadingPicks ? (
              <div className="text-center py-8 text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p>Loading picks...</p>
              </div>
            ) : participantPicks.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No picks found for this participant</p>
              </div>
            ) : (
              <div>
                {overrideMode === 'picks' ? (
                  <>
                    {/* Confidence Numbers Summary */}
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Confidence Numbers Status</h4>
                      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1">
                        {Array.from({length: MAX_CONFIDENCE_POINTS}, (_, i) => i + 1).map(num => {
                          const isUsed = usedConfidenceNumbers.has(num);
                          return (
                            <div
                              key={num}
                              className={`text-xs p-1 text-center rounded ${
                                isUsed 
                                  ? 'bg-red-100 text-red-700 border border-red-200' 
                                  : 'bg-green-100 text-green-700 border border-green-200'
                              }`}
                            >
                              {num}
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mt-2 text-xs">
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 bg-green-100 border border-green-200 rounded"></div>
                          <span>Available</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 bg-red-100 border border-red-200 rounded"></div>
                          <span>Used</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {participantPicks.map((pick) => {
                        const isSelected = selectedPicks.has(pick.id);
                        const update = pickUpdates[pick.id];
                        const currentWinner = update?.winner || pick.winner;
                        const currentConfidence = update?.confidence !== undefined ? update.confidence : pick.confidence;
                        const isConfidenceChanged = update?.confidence !== undefined && update.confidence !== pick.confidence;
                        const isWinnerChanged = update?.winner !== undefined && update.winner !== pick.winner;
                        const isModified = isConfidenceChanged || isWinnerChanged;
                        
                        return (
                          <div key={pick.id} className={`border rounded-lg p-3 transition-all duration-200 ${
                            isSelected ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                          } ${isModified ? 'ring-2 ring-orange-300' : ''}`}>
                            <div className="flex items-start gap-2 mb-2">
                                                        <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => handlePickSelection(pick.id, checked as boolean)}
                            className="mt-0.5 flex-shrink-0"
                            disabled={isWeekCompleted}
                          />
                              <div className="flex-1 min-w-0">
                                <span className="font-medium text-sm break-words">
                                  {pick.away_team} @ {pick.home_team}
                                </span>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mt-1">
                                  <span className="text-xs text-gray-500">
                                    Current: {pick.winner} ({pick.confidence || 'No Confidence'})
                                  </span>
                                  {isModified && (
                                    <Badge variant="destructive" className="text-xs w-fit">
                                      Modified
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {isSelected && (
                              <div className="space-y-3 ml-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <div>
                                    <Label className="text-xs text-gray-600">Winner</Label>
                                                                    <Select 
                                  value={currentWinner} 
                                  onValueChange={(value) => handlePickUpdate(pick.id, 'winner', value)}
                                  disabled={isWeekCompleted}
                                >
                                      <SelectTrigger className={`w-full h-8 ${isWinnerChanged ? 'border-orange-500 bg-orange-50' : ''}`}>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent position="popper" side="bottom" align="start">
                                        <SelectItem value={pick.home_team}>{pick.home_team}</SelectItem>
                                        <SelectItem value={pick.away_team}>{pick.away_team}</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  
                                  <div>
                                    <Label className="text-xs text-gray-600">Confidence</Label>
                                                                    <Select 
                                  value={currentConfidence.toString()} 
                                  onValueChange={(value) => handlePickUpdate(pick.id, 'confidence', parseInt(value))}
                                  disabled={isWeekCompleted}
                                >
                                      <SelectTrigger className={`w-full h-8 ${isConfidenceChanged ? 'border-orange-500 bg-orange-50' : ''}`}>
                                        <SelectValue placeholder={currentConfidence === 0 ? "No Confidence" : undefined} />
                                      </SelectTrigger>
                                      <SelectContent position="popper" side="bottom" align="start" className="max-h-60">
                                        <SelectItem value="0" className="text-gray-500 border-t">
                                          -- Clear Confidence --
                                        </SelectItem>
                                        {Array.from({length: MAX_CONFIDENCE_POINTS}, (_, i) => i + 1).map(num => {
                                          const isUsed = usedConfidenceNumbers.has(num) && num !== pick.confidence && num !== (pickUpdates[pick.id]?.confidence || 0);
                                          return (
                                            <SelectItem 
                                              key={num} 
                                              value={num.toString()}
                                              className={isUsed ? 'text-gray-400 line-through' : ''}
                                              disabled={isUsed}
                                            >
                                              {num} {isUsed ? '(Used)' : ''}
                                            </SelectItem>
                                          );
                                        })}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                
                                {isModified && (
                                  <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded">
                                    <strong>Changes:</strong>
                                    {isWinnerChanged && <div>• Winner: {pick.winner} → {currentWinner}</div>}
                                    {isConfidenceChanged && <div>• Confidence: {pick.confidence} → {currentConfidence === 0 ? 'No Confidence' : currentConfidence}</div>}</div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  /* Erase All Picks Mode */
                  <div className="text-center py-8">
                    <div className="mb-4">
                      <AlertCircle className="h-16 w-16 mx-auto text-red-500 mb-4" />
                      <h3 className="text-lg font-semibold text-red-700 mb-2">⚠️ Warning: Erase All Picks</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        This will permanently remove <strong>all {participantPicks.length} picks</strong> for this participant <strong>{participants.find(p => p.id === selectedParticipant)?.name}</strong> in Week {currentWeek}.
                      </p>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-left">
                        <h4 className="font-medium text-red-800 mb-2">What will happen:</h4>
                        <ul className="text-sm text-red-700 space-y-1">
                          <li>• All picks for {participantPicks.length} games will be deleted</li>
                          <li>• Confidence points will be reset and available for reuse</li>
                          <li>• Participant will need to resubmit all picks</li>
                          <li>• This action cannot be undone</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div className="flex justify-center">
                      <Checkbox
                        checked={selectedPicks.size > 0}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedPicks(new Set(participantPicks.map(pick => pick.id)));
                          } else {
                            setSelectedPicks(new Set());
                          }
                        }}
                        className="mr-2"
                        disabled={isWeekCompleted}
                      />
                      <Label className="text-sm font-medium text-red-700">
                        I understand the consequences and want to erase all picks
                      </Label>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex flex-col sm:flex-row justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => router.push('/admin/dashboard')}
        >
          Cancel
        </Button>
        
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogTrigger asChild>
            <Button
              disabled={
                !selectedPool || 
                !selectedParticipant || 
                !overrideReason.trim() || 
                selectedPicks.size === 0 ||
                isOverriding ||
                isWeekCompleted
              }
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {isOverriding 
                ? (overrideMode === 'picks' ? 'Updating...' : 'Deleting...') 
                : (overrideMode === 'picks' ? 'Update Selected Picks' : 'Erase All Picks')
              }
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {overrideMode === 'picks' ? 'Confirm Pick Override' : 'Confirm Erase All Picks'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {overrideMode === 'picks' 
                  ? `Are you sure you want to override ${selectedPicks.size} pick${selectedPicks.size !== 1 ? 's' : ''}? This action will update the selected picks with the new values.`
                  : `Are you sure you want to permanently erase ALL ${participantPicks.length} picks for this participant? This action cannot be undone and will require the participant to resubmit all picks.`
                }
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleOverridePicks}
                className="bg-red-600 hover:bg-red-700"
                disabled={isOverriding}
              >
                {isOverriding 
                  ? (overrideMode === 'picks' ? 'Updating...' : 'Deleting...') 
                  : (overrideMode === 'picks' ? 'Confirm Override' : 'Confirm Erase All')
                }
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Erase Success Dialog */}
      <AlertDialog open={showEraseSuccessDialog} onOpenChange={setShowEraseSuccessDialog}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              Picks Successfully Erased
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              All picks have been permanently removed for the selected participant.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg mb-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">Participant:</span>
                <span className="text-green-700">
                  {participants.find(p => p.id === selectedParticipant)?.name || 'Unknown'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Pool:</span>
                <span className="text-green-700">
                  {pools.find(p => p.id === selectedPool)?.name || 'Unknown'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Week:</span>
                <span className="text-green-700">{currentWeek}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Picks Erased:</span>
                <span className="text-green-700 font-bold">{erasedPicksCount}</span>
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setShowEraseSuccessDialog(false)}
              className="bg-green-600 hover:bg-green-700"
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
