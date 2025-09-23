'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Save, Users, Target } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getSupabaseClient } from '@/lib/supabase';
import { PERIOD_WEEKS, SUPER_BOWL_SEASON_TYPE } from '@/lib/utils';

interface Participant {
  id: string;
  name: string;
  email?: string;
  poolId?: string;
  poolName?: string;
}

interface OverrideMondayNightScoreProps {
  poolId?: string;
  poolName: string;
  week: number;
  season: number;
  seasonType: number;
}

export function OverrideMondayNightScore({
  poolId,
  poolName,
  week,
  season,
  seasonType
}: OverrideMondayNightScoreProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedParticipant, setSelectedParticipant] = useState<string>('');
  const [mondayNightScore, setMondayNightScore] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPoolId, setSelectedPoolId] = useState<string>('');
  const { toast } = useToast();

  // Check if this is a period week or Super Bowl
  const isPeriodWeek = PERIOD_WEEKS.includes(week as typeof PERIOD_WEEKS[number]);
  const isSuperBowl = seasonType === SUPER_BOWL_SEASON_TYPE;
  const shouldShowOverride = isPeriodWeek || isSuperBowl;

  useEffect(() => {
    if (shouldShowOverride) {
      loadParticipants();
    }
  }, [poolId, shouldShowOverride]);

  const loadParticipants = async () => {
    setIsLoading(true);
    try {
      const supabase = getSupabaseClient();
      
      // Get participants who have submitted picks for this week
      let query = supabase
        .from('picks')
        .select(`
          participant_id,
          participants!inner(id, name, email),
          pools!inner(id, name)
        `)
        .eq('week', week)
        .eq('season', season);

      if (poolId) {
        query = query.eq('pool_id', poolId);
      }

      const { data: picksData, error: picksError } = await query;

      if (picksError) {
        console.error('Error loading participants:', picksError);
        toast({
          title: 'Error',
          description: 'Failed to load participants',
          variant: 'destructive'
        });
        return;
      }

      // Get unique participants with pool info
      const uniqueParticipants = picksData?.reduce((acc, pick) => {
        const participant = pick.participants as any;
        const pool = pick.pools as any;
        const existingParticipant = acc.find(p => p.id === participant.id && p.poolId === pool.id);
        
        if (!existingParticipant) {
          acc.push({
            id: participant.id,
            name: participant.name,
            email: participant.email,
            poolId: pool.id,
            poolName: pool.name
          });
        }
        return acc;
      }, [] as Participant[]) || [];

      setParticipants(uniqueParticipants);
    } catch (error) {
      console.error('Error loading participants:', error);
      toast({
        title: 'Error',
        description: 'Failed to load participants',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedParticipant || !mondayNightScore) {
      toast({
        title: 'Error',
        description: 'Please select a participant and enter a Monday night score',
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

    // Get the pool ID for the selected participant
    const participant = participants.find(p => p.id === selectedParticipant);
    const targetPoolId = poolId || participant?.poolId;
    
    if (!targetPoolId) {
      toast({
        title: 'Error',
        description: 'Could not determine pool for selected participant',
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin/override-monday-night-score', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          poolId: targetPoolId,
          participantId: selectedParticipant,
          week,
          season,
          seasonType,
          mondayNightScore: score
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: result.message,
        });
        setSelectedParticipant('');
        setMondayNightScore('');
      } else {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error submitting Monday night score:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit Monday night score',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!shouldShowOverride) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-blue-600" />
          Override Monday Night Score
        </CardTitle>
        <CardDescription>
          Add Monday night game score predictions for participants who submitted picks before the tie breaker update.
          {isPeriodWeek && ` This is a period week (${PERIOD_WEEKS.join(', ')}) where tie breakers are used.`}
          {isSuperBowl && ' This is the Super Bowl where tie breakers are used.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading participants...</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="participant">Participant</Label>
                <Select value={selectedParticipant} onValueChange={setSelectedParticipant}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a participant" />
                  </SelectTrigger>
                  <SelectContent>
                    {participants.map((participant) => (
                      <SelectItem key={`${participant.id}-${participant.poolId}`} value={participant.id}>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          <div className="flex flex-col">
                            <span>{participant.name}</span>
                            {!poolId && participant.poolName && (
                              <span className="text-xs text-gray-500">{participant.poolName}</span>
                            )}
                            {participant.email && (
                              <span className="text-xs text-gray-500">({participant.email})</span>
                            )}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
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
                <p className="text-xs text-gray-500 mt-1">
                  Total points predicted for Monday night game
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={handleSubmit}
                disabled={!selectedParticipant || !mondayNightScore || isSubmitting}
                className="flex items-center gap-2"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {isSubmitting ? 'Adding Score...' : 'Add Monday Night Score'}
              </Button>
            </div>

            {participants.length === 0 && (
              <Alert>
                <AlertDescription>
                  No participants found with submitted picks for this week.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
