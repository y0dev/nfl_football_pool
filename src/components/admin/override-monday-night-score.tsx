'use client';

import { useState, useEffect, useCallback } from 'react';
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
  const { toast } = useToast();

  // Check if this is a period week or Super Bowl
  const isPeriodWeek = PERIOD_WEEKS.includes(week as typeof PERIOD_WEEKS[number]);
  const isSuperBowl = seasonType === SUPER_BOWL_SEASON_TYPE;
  const shouldShowOverride = isPeriodWeek || isSuperBowl;

  const loadParticipants = useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = getSupabaseClient();
      
      if (!poolId) {
        console.error('No poolId provided for loading participants');
        toast({
          title: 'Error',
          description: 'Pool ID is required to load participants',
          variant: 'destructive'
        });
        return;
      }

      // Get all participants from the pool (not just those who submitted picks)
      const { data: participantsData, error: participantsError } = await supabase
        .from('participants')
        .select('id, name, email')
        .eq('pool_id', poolId)
        .eq('is_active', true)
        .order('name');

      if (participantsError) {
        console.error('Error loading participants:', participantsError);
        toast({
          title: 'Error',
          description: 'Failed to load participants',
          variant: 'destructive'
        });
        return;
      }

      // Transform to the expected format
      const participantsList = (participantsData || []).map(participant => ({
        id: participant.id,
        name: participant.name,
        email: participant.email,
        poolId: poolId,
        poolName: poolName
      }));

      setParticipants(participantsList);
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
  }, [poolId, poolName, toast]);

  useEffect(() => {
    if (shouldShowOverride && poolId) {
      loadParticipants();
    }
  }, [shouldShowOverride, poolId, loadParticipants]);

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
          Add Monday night game score predictions for participants in this pool.
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
                      <SelectItem key={participant.id} value={participant.id}>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          <div className="flex flex-col">
                            <span>{participant.name}</span>
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
