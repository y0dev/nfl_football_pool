'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Users, Trophy, CheckCircle2, Calendar, Target } from 'lucide-react';
import { loadUsers } from '@/actions/loadUsers';
import { createPageUrl } from '@/lib/utils';

interface PlayoffTeam {
  id: string;
  pool_id: string;
  season: number;
  team_name: string;
  team_abbreviation: string | null;
  conference: string | null;
  seed: number | null;
}

interface Participant {
  id: string;
  name: string;
}

interface SubmissionStatus {
  participant_id: string;
  participant_name: string;
  submitted: boolean;
  submission_count: number;
  total_teams: number;
}

interface ConfidencePointData {
  id: string;
  participant_id: string;
  pool_id: string;
  season: number;
  team_name: string;
  confidence_points: number;
  participants?: {
    name: string;
  };
}

function PlayoffsPageContent() {
  const params = useParams();
  const router = useRouter();
  const poolId = params.id as string;
  const { toast } = useToast();

  const [poolName, setPoolName] = useState<string>('');
  const [poolSeason, setPoolSeason] = useState<number>(2025);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>('');
  const [playoffTeams, setPlayoffTeams] = useState<PlayoffTeam[]>([]);
  const [sortedPlayoffTeams, setSortedPlayoffTeams] = useState<PlayoffTeam[]>([]);
  const [confidencePoints, setConfidencePoints] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus[]>([]);
  const [allSubmitted, setAllSubmitted] = useState(false);
  const [allConfidencePoints, setAllConfidencePoints] = useState<ConfidencePointData[] | null>(null);
  const [hasSubmission, setHasSubmission] = useState(false);

  useEffect(() => {
    loadData();
  }, [poolId]);

  const loadData = async () => {
    try {
      setIsLoading(true);

      // Load pool info
      const poolResponse = await fetch(`/api/pools/${poolId}`);
      const poolData = await poolResponse.json();
      
      let seasonToUse = poolSeason;
      if (poolData.success) {
        setPoolName(poolData.pool.name);
        seasonToUse = poolData.pool.season;
        setPoolSeason(seasonToUse);
      }

      // Load participants
      const users = await loadUsers(poolId);
      setParticipants(users || []);

      // Load playoff teams
      const teamsResponse = await fetch(`/api/playoffs/${poolId}/teams?season=${seasonToUse}`);
      const teamsData = await teamsResponse.json();
      
      if (teamsData.success) {
        const teams = teamsData.teams || [];
        setPlayoffTeams(teams);
        // Sort teams by conference (AFC first) and then by seed
        const sorted = [...teams].sort((a, b) => {
          const conferenceA = (a.conference || '').toUpperCase();
          const conferenceB = (b.conference || '').toUpperCase();
          
          // AFC comes before NFC
          if (conferenceA !== conferenceB) {
            if (conferenceA === 'AFC') return -1;
            if (conferenceB === 'AFC') return 1;
            return conferenceA.localeCompare(conferenceB);
          }
          
          // Within same conference, sort by seed
          const seedA = a.seed || 999;
          const seedB = b.seed || 999;
          return seedA - seedB;
        });
        setSortedPlayoffTeams(sorted);
      }

      // Load submission status
      await loadSubmissionStatus();

    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load playoff data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadSubmissionStatus = async () => {
    try {
      const response = await fetch(`/api/playoffs/${poolId}/confidence-points?season=${poolSeason || 2025}`);
      const data = await response.json();
      
      if (data.success) {
        setSubmissionStatus(data.submissions || []);
        setAllSubmitted(data.allSubmitted || false);
        setAllConfidencePoints(data.allConfidencePoints || null);
      }
    } catch (error) {
      console.error('Error loading submission status:', error);
    }
  };

  const handleParticipantChange = async (participantId: string) => {
    setSelectedParticipantId(participantId);
    setConfidencePoints({});

    if (!participantId) {
      setHasSubmission(false);
      return;
    }

    try {
      const response = await fetch(
        `/api/playoffs/${poolId}/confidence-points?season=${poolSeason}&participantId=${participantId}`
      );
      const data = await response.json();

      if (data.success) {
        setHasSubmission(data.hasSubmission || false);
        if (data.confidencePoints && data.confidencePoints.length > 0) {
          const pointsMap: Record<string, number> = {};
          data.confidencePoints.forEach((cp: ConfidencePointData) => {
            pointsMap[cp.team_name] = cp.confidence_points;
          });
          setConfidencePoints(pointsMap);
        }
      }
    } catch (error) {
      console.error('Error loading participant confidence points:', error);
    }
  };

  const handleConfidencePointChange = (teamName: string, value: string) => {
    const numValue = parseInt(value);
    if (isNaN(numValue) || numValue < 1) {
      // If empty or invalid, remove the confidence point
      setConfidencePoints(prev => {
        const updated = { ...prev };
        delete updated[teamName];
        return updated;
      });
      return;
    }
    
    setConfidencePoints(prev => ({
      ...prev,
      [teamName]: numValue
    }));
  };

  // Calculate available confidence points for a team (exclude already used ones)
  const getAvailableConfidencePoints = (currentTeamName: string): number[] => {
    const usedPoints = Object.entries(confidencePoints)
      .filter(([teamName]) => teamName !== currentTeamName)
      .map(([, points]) => points);
    
    const maxPoints = sortedPlayoffTeams.length;
    return Array.from({ length: maxPoints }, (_, i) => i + 1)
      .filter(points => !usedPoints.includes(points));
  };

  const validateConfidencePoints = (): string | null => {
    const values = Object.values(confidencePoints);
    const uniqueValues = new Set(values);
    
    if (values.length !== sortedPlayoffTeams.length) {
      return 'Please assign confidence points to all teams';
    }

    if (uniqueValues.size !== values.length) {
      return 'Confidence points must be unique';
    }

    const sortedValues = [...values].sort((a, b) => a - b);
    const expectedValues = Array.from({ length: sortedPlayoffTeams.length }, (_, i) => i + 1);
    
    if (JSON.stringify(sortedValues) !== JSON.stringify(expectedValues)) {
      return 'Confidence points must be sequential (1, 2, 3, etc.)';
    }

    return null;
  };

  const handleSubmit = async () => {
    if (!selectedParticipantId) {
      toast({
        title: 'Error',
        description: 'Please select a participant',
        variant: 'destructive',
      });
      return;
    }

    const validationError = validateConfidencePoints();
    if (validationError) {
      toast({
        title: 'Validation Error',
        description: validationError,
        variant: 'destructive',
      });
      return;
    }

    if (hasSubmission) {
      toast({
        title: 'Error',
        description: 'You have already submitted confidence points for playoffs',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const submissionData = sortedPlayoffTeams.map(team => ({
        participant_id: selectedParticipantId,
        team_name: team.team_name,
        confidence_points: confidencePoints[team.team_name]
      }));

      const response = await fetch(`/api/playoffs/${poolId}/confidence-points`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          participant_id: selectedParticipantId,
          season: poolSeason,
          confidence_points: submissionData
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: 'Playoff confidence points submitted successfully',
        });
        setHasSubmission(true);
        await loadSubmissionStatus();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to submit confidence points',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error submitting confidence points:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit confidence points',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const submissionPercentage = submissionStatus.length > 0
    ? Math.round((submissionStatus.filter(s => s.submitted).length / submissionStatus.length) * 100)
    : 0;

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col gap-2 mb-4">
          <h1 className="text-2xl sm:text-3xl font-bold">{poolName} - Playoff Confidence Points</h1>
          <p className="text-gray-600">Season {poolSeason}</p>
        </div>

        {/* Navigation Buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/pool/${poolId}/picks?week=18&seasonType=2`)}
            className="flex items-center gap-2"
          >
            <Calendar className="h-4 w-4" />
            View Regular Season
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/pool/${poolId}/picks?week=1&seasonType=3`)}
            className="flex items-center gap-2"
          >
            <Target className="h-4 w-4" />
            View Playoff Picks
          </Button>
        </div>

        {/* Submission Status */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Submission Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="text-3xl font-bold">{submissionPercentage}%</div>
              <div className="flex-1">
                <div className="text-sm text-gray-600 mb-1">
                  {submissionStatus.filter(s => s.submitted).length} of {submissionStatus.length} participants submitted
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${submissionPercentage}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* All Submissions View */}
      {allSubmitted && allConfidencePoints && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              All Playoff Confidence Points
            </CardTitle>
            <CardDescription>
              Everyone has submitted their confidence points
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-semibold">Participant</th>
                    {sortedPlayoffTeams.map(team => (
                      <th key={team.id} className="text-center p-2 font-semibold">
                        <div className="flex flex-col items-center gap-1">
                          <span>{team.team_name}</span>
                          {team.seed && (
                            <Badge variant="outline" className="text-xs">
                              {team.conference} #{team.seed}
                            </Badge>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {participants.map(participant => {
                    const participantPoints = allConfidencePoints.filter(
                      cp => cp.participant_id === participant.id
                    );
                    const pointsMap: Record<string, number> = {};
                    participantPoints.forEach(cp => {
                      pointsMap[cp.team_name] = cp.confidence_points;
                    });

                    return (
                      <tr key={participant.id} className="border-b hover:bg-gray-50">
                        <td className="p-2 font-medium">{participant.name}</td>
                        {sortedPlayoffTeams.map(team => (
                          <td key={team.id} className="text-center p-2">
                            {pointsMap[team.team_name] || '-'}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submission Form */}
      {!allSubmitted && (
        <Card>
          <CardHeader>
            <CardTitle>Submit Playoff Confidence Points</CardTitle>
            <CardDescription>
              Assign confidence points (1-{sortedPlayoffTeams.length}) to each playoff team. 
              Points cannot be changed after submission. Each number can only be used once.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Participant Selection */}
            <div>
              <Label htmlFor="participant">Select Participant</Label>
              <select
                id="participant"
                value={selectedParticipantId}
                onChange={(e) => handleParticipantChange(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md mt-1"
                disabled={hasSubmission}
              >
                <option value="">Select a participant...</option>
                {participants.map(participant => (
                  <option key={participant.id} value={participant.id}>
                    {participant.name}
                  </option>
                ))}
              </select>
              {hasSubmission && (
                <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" />
                  Already submitted
                </p>
              )}
            </div>

            {/* Confidence Points Input */}
            {selectedParticipantId && !hasSubmission && sortedPlayoffTeams.length > 0 && (
              <>
                <div className="space-y-4">
                  {sortedPlayoffTeams.map(team => {
                    const availablePoints = getAvailableConfidencePoints(team.team_name);
                    const currentValue = confidencePoints[team.team_name];
                    
                    return (
                      <div key={team.id} className="flex items-center gap-4">
                        <div className="flex-1">
                          <Label htmlFor={`team-${team.id}`}>
                            {team.team_name}
                            {team.conference && (
                              <Badge variant="outline" className="ml-2">
                                {team.conference}
                              </Badge>
                            )}
                            {team.seed && (
                              <Badge variant="outline" className="ml-2">
                                Seed {team.seed}
                              </Badge>
                            )}
                          </Label>
                        </div>
                        <div className="w-32">
                          <Select
                            value={currentValue?.toString() || ''}
                            onValueChange={(value) => handleConfidencePointChange(team.team_name, value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select points" />
                            </SelectTrigger>
                            <SelectContent>
                              {availablePoints.length > 0 ? (
                                availablePoints.map(points => (
                                  <SelectItem key={points} value={points.toString()}>
                                    {points} point{points !== 1 ? 's' : ''}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="" disabled>
                                  No points available
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="w-full"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Confidence Points'}
                </Button>
              </>
            )}

            {selectedParticipantId && hasSubmission && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 font-medium">
                  You have already submitted your playoff confidence points. 
                  They cannot be changed after submission.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function PlayoffsPage() {
  return <PlayoffsPageContent />;
}

