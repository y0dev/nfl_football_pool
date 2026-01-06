'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, CheckCircle2, XCircle, Target } from 'lucide-react';
import { loadUsers } from '@/actions/loadUsers';
import { PlayoffParticipantEditDialog } from './playoff-participant-edit-dialog';

interface PlayoffParticipantsListProps {
  poolId: string;
  poolSeason: number;
}

interface ParticipantStatus {
  id: string;
  name: string;
  hasSubmitted: boolean;
  submissionCount: number;
  totalTeams: number;
}

export function PlayoffParticipantsList({ poolId, poolSeason }: PlayoffParticipantsListProps) {
  const [participants, setParticipants] = useState<ParticipantStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantStatus | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    loadParticipantStatus();
  }, [poolId, poolSeason]);

  const loadParticipantStatus = async () => {
    try {
      setIsLoading(true);
      
      // Get all participants in the pool
      const allParticipants = await loadUsers(poolId);
      
      if (!allParticipants || allParticipants.length === 0) {
        setParticipants([]);
        return;
      }

      // Get playoff teams count
      const { getSupabaseServiceClient } = await import('@/lib/supabase');
      const supabase = getSupabaseServiceClient();
      
      const { data: playoffTeams } = await supabase
        .from('playoff_teams')
        .select('id')
        .eq('season', poolSeason);
      
      const teamsCount = playoffTeams?.length || 0;

      // Get participants who have submitted confidence points
      const { data: confidenceSubmissions } = await supabase
        .from('playoff_confidence_points')
        .select('participant_id')
        .eq('pool_id', poolId)
        .eq('season', poolSeason);

      // Count confidence point submissions per participant
      const participantConfidenceCounts = new Map<string, number>();
      confidenceSubmissions?.forEach(sub => {
        const count = participantConfidenceCounts.get(sub.participant_id) || 0;
        participantConfidenceCounts.set(sub.participant_id, count + 1);
      });

      // Create participant status list
      const participantStatusList: ParticipantStatus[] = allParticipants.map(participant => {
        const submissionCount = participantConfidenceCounts.get(participant.id) || 0;
        const hasSubmitted = submissionCount === teamsCount && teamsCount > 0;
        
        return {
          id: participant.id,
          name: participant.name,
          hasSubmitted,
          submissionCount,
          totalTeams: teamsCount
        };
      });

      // Sort: submitted first, then by name
      participantStatusList.sort((a, b) => {
        if (a.hasSubmitted !== b.hasSubmitted) {
          return a.hasSubmitted ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      setParticipants(participantStatusList);
    } catch (error) {
      console.error('Error loading participant status:', error);
      setParticipants([]);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (participants.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No participants found in this pool</p>
      </div>
    );
  }

  const submittedCount = participants.filter(p => p.hasSubmitted).length;
  const pendingCount = participants.length - submittedCount;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Participants</p>
                <p className="text-2xl font-bold">{participants.length}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Submitted</p>
                <p className="text-2xl font-bold text-green-600">{submittedCount}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Participants List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Participant Status
          </CardTitle>
          <CardDescription>
            View which participants have submitted their playoff confidence points
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {participants.map((participant) => (
              <div
                key={participant.id}
                onClick={() => {
                  setSelectedParticipant(participant);
                  setDialogOpen(true);
                }}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    {participant.hasSubmitted ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-orange-600" />
                    )}
                  </div>
                  <span className="font-medium">{participant.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {participant.hasSubmitted ? (
                    <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Submitted
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-orange-600 border-orange-200">
                      <XCircle className="h-3 w-3 mr-1" />
                      Pending ({participant.submissionCount}/{participant.totalTeams})
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {selectedParticipant && (
        <PlayoffParticipantEditDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          participantId={selectedParticipant.id}
          participantName={selectedParticipant.name}
          poolId={poolId}
          poolSeason={poolSeason}
          onUpdate={() => {
            loadParticipantStatus();
          }}
        />
      )}
    </div>
  );
}

