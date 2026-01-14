'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Users, Trophy, CheckCircle2, Calendar, Target } from 'lucide-react';
import { loadUsers } from '@/actions/loadUsers';
import { createPageUrl, debugLog, getTeamAbbreviation } from '@/lib/utils';
import { getUpcomingWeek } from '@/actions/loadCurrentWeek';

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
  const [isCompleteSubmission, setIsCompleteSubmission] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [allParticipantsForDisplay, setAllParticipantsForDisplay] = useState<Participant[]>([]);

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

      // Load participants (will be filtered by submission status after loadSubmissionStatus)
      const users = await loadUsers(poolId);
      setParticipants(users || []);
      // Keep a copy of all participants for display purposes
      setAllParticipantsForDisplay(users || []);

      // Load playoff teams
      const teamsResponse = await fetch(`/api/playoffs/${poolId}/teams?season=${seasonToUse}`);
      const teamsData = await teamsResponse.json();
      
      if (teamsData.success) {
        const teams = teamsData.teams || [];
        setPlayoffTeams(teams);
        
        // Create sorted array with placeholders for missing seeds (max 14 teams: 7 per conference)
        const conferences = ['AFC', 'NFC'];
        const sorted: PlayoffTeam[] = [];
        
        conferences.forEach(conference => {
          // Get existing teams for this conference
          const conferenceTeams = teams.filter((t: PlayoffTeam) => (t.conference || '').toUpperCase() === conference);
          
          // Create array of 7 slots for this conference
          for (let seed = 1; seed <= 7; seed++) {
            const existingTeam = conferenceTeams.find((t: PlayoffTeam) => t.seed === seed);
            if (existingTeam) {
              sorted.push(existingTeam);
            } else {
              // Create placeholder team for missing seed
              sorted.push({
                id: `placeholder-${conference}-${seed}`,
                pool_id: poolId,
                season: seasonToUse,
                team_name: '',
                team_abbreviation: null,
                conference: conference,
                seed: seed
              });
            }
          }
        });
        
        setSortedPlayoffTeams(sorted);
      }

      // Load submission status (this will also filter participants)
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
        debugLog('PLAYOFFS: loadSubmissionStatus', data);
        setSubmissionStatus(data.submissions || []);
        setAllSubmitted(data.allSubmitted || false);
        setAllConfidencePoints(data.allConfidencePoints || null);
        
        // Filter participants to exclude those who have submitted
        const submittedParticipantIds = new Set(
          (data.submissions || [])
            .filter((s: SubmissionStatus) => s.submitted)
            .map((s: SubmissionStatus) => s.participant_id)
        );
        
        // Reload participants and filter out submitted ones
        const allUsers = await loadUsers(poolId);
        debugLog('PLAYOFFS: allUsers', allUsers);
        // Keep all participants for display
        setAllParticipantsForDisplay(allUsers || []);
        // Filter participants for the submission form (exclude those who have submitted)
        const availableUsers = (allUsers || []).filter(
          user => !submittedParticipantIds.has(user.id)
        );
        setParticipants(availableUsers);
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
      setIsCompleteSubmission(false);
      return;
    }

    try {
      const response = await fetch(
        `/api/playoffs/${poolId}/confidence-points?season=${poolSeason}&participantId=${participantId}`
      );
      const data = await response.json();

      if (data.success) {
        debugLog('PLAYOFFS: handleParticipantChange', data);
        setHasSubmission(data.hasSubmission || false);
        setIsCompleteSubmission(data.isCompleteSubmission || false);
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
    // Handle clear action
    if (value === 'CLEAR') {
      setConfidencePoints(prev => {
        const updated = { ...prev };
        delete updated[teamName];
        return updated;
      });
      return;
    }
    
    const numValue = parseInt(value);
    if (isNaN(numValue) || numValue < 1) {
      // If invalid, remove the confidence point
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
    // Only count teams that have actual names (not placeholders)
    const actualTeams = sortedPlayoffTeams.filter(t => t.team_name && t.team_name.trim() !== '');
    const usedPoints = Object.entries(confidencePoints)
      .filter(([teamName]) => teamName !== currentTeamName && teamName.trim() !== '')
      .map(([, points]) => points);
    
    const maxPoints = actualTeams.length;
    return Array.from({ length: maxPoints }, (_, i) => i + 1)
      .filter(points => !usedPoints.includes(points));
  };

  const validateConfidencePoints = (): string | null => {
    // Only validate for teams that actually have names (not placeholders)
    const actualTeams = sortedPlayoffTeams.filter(t => t.team_name && t.team_name.trim() !== '');
    const values = Object.values(confidencePoints);
    const uniqueValues = new Set(values);
    
    if (values.length !== actualTeams.length) {
      return 'Please assign confidence points to all teams';
    }

    if (uniqueValues.size !== values.length) {
      return 'Confidence points must be unique';
    }

    const sortedValues = [...values].sort((a, b) => a - b);
    const expectedValues = Array.from({ length: actualTeams.length }, (_, i) => i + 1);
    
    if (JSON.stringify(sortedValues) !== JSON.stringify(expectedValues)) {
      return 'Confidence points must be sequential (1, 2, 3, etc.)';
    }

    return null;
  };

  // Generate random confidence points for all teams (debug only)
  const generateRandomConfidencePoints = () => {
    if (!selectedParticipantId) {
      toast({
        title: 'Error',
        description: 'Please select a participant first',
        variant: 'destructive',
      });
      return;
    }

    const actualTeams = sortedPlayoffTeams.filter(t => t.team_name && t.team_name.trim() !== '');
    const teamCount = actualTeams.length;
    
    // Generate array of sequential numbers (1 to teamCount) and shuffle
    const points = Array.from({ length: teamCount }, (_, i) => i + 1);
    for (let i = points.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [points[i], points[j]] = [points[j], points[i]];
    }
    
    // Assign shuffled points to teams
    const randomPoints: Record<string, number> = {};
    actualTeams.forEach((team, index) => {
      randomPoints[team.team_name] = points[index];
    });
    
    setConfidencePoints(randomPoints);
    toast({
      title: 'Random Points Generated',
      description: `Random confidence points assigned to all ${teamCount} teams`,
    });
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

    // Skip validation in debug mode, otherwise validate
    if (!debugMode) {
      const validationError = validateConfidencePoints();
      if (validationError) {
        toast({
          title: 'Validation Error',
          description: validationError,
          variant: 'destructive',
        });
        return;
      }
    }

    if (isCompleteSubmission && !debugMode) {
      toast({
        title: 'Error',
        description: 'You have already submitted all confidence points for playoffs. Complete submissions cannot be changed.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Only submit confidence points for teams that actually have names (not placeholders)
      const actualTeams = sortedPlayoffTeams.filter(t => t.team_name && t.team_name.trim() !== '');
      const submissionData = actualTeams.map(team => ({
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
        
        // Clear selected participant so they are removed from the list
        const submittedParticipantId = selectedParticipantId;
        setSelectedParticipantId('');
        setConfidencePoints({});
        setHasSubmission(false);
        setIsCompleteSubmission(false);
        
        // Reload submission status (which will also update the participants list)
        await loadSubmissionStatus();
        
        // Navigate to playoff picks page after successful submission
        router.push(`/pool/${poolId}/picks?week=1&seasonType=3`);
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
            onClick={async () => {
              try {
                const upcomingWeek = await getUpcomingWeek();
                // Navigate to current week based on season type
                router.push(`/pool/${poolId}/picks?week=${upcomingWeek.week}&seasonType=${upcomingWeek.seasonType}`);
              } catch (error) {
                console.error('Error getting current week:', error);
                // Fallback to week 1 regular season
                router.push(`/pool/${poolId}/picks?week=1&seasonType=2`);
              }
            }}
            className="flex items-center gap-2"
          >
            <Calendar className="h-4 w-4" />
            Go to Current Week
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
            {/* Table View - Separated by Conference */}
            <div className="space-y-6">
              {(() => {
                // Extract unique participants from submissionStatus or allConfidencePoints
                const participantMap = new Map<string, { id: string; name: string }>();
                
                // First, try to get from submissionStatus
                submissionStatus.forEach(status => {
                  if (!participantMap.has(status.participant_id)) {
                    participantMap.set(status.participant_id, {
                      id: status.participant_id,
                      name: status.participant_name
                    });
                  }
                });
                
                // Also check allConfidencePoints for any missing participants
                allConfidencePoints.forEach(cp => {
                  if (!participantMap.has(cp.participant_id)) {
                    const participantName = (cp.participants as any)?.name || 'Unknown';
                    participantMap.set(cp.participant_id, {
                      id: cp.participant_id,
                      name: participantName
                    });
                  }
                });
                
                // Fallback to allParticipantsForDisplay if available
                if (participantMap.size === 0 && allParticipantsForDisplay.length > 0) {
                  allParticipantsForDisplay.forEach(p => {
                    participantMap.set(p.id, p);
                  });
                }
                
                const participantsList = Array.from(participantMap.values());
                const afcTeams = sortedPlayoffTeams.filter(
                  team => team.team_name && team.team_name.trim() !== '' && team.conference?.toUpperCase() === 'AFC'
                );
                const nfcTeams = sortedPlayoffTeams.filter(
                  team => team.team_name && team.team_name.trim() !== '' && team.conference?.toUpperCase() === 'NFC'
                );

                return (
                  <>
                    {/* AFC Table */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b-2 border-red-300">
                        <div className="w-3 h-3 rounded-full bg-red-600"></div>
                        <h3 className="text-base sm:text-lg font-bold text-red-600">AFC</h3>
                      </div>
                      <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                        <table className="w-full caption-bottom text-sm border-collapse min-w-full">
                          <thead>
                            <tr className="bg-gray-50 border-b">
                              <th className="sticky left-0 bg-gray-50 z-30 font-semibold min-w-[120px] sm:min-w-[150px] border-r text-xs sm:text-sm shadow-[2px_0_4px_rgba(0,0,0,0.1)] h-10 px-2 text-left align-middle">
                                Participant
                              </th>
                              {afcTeams.map(team => (
                                <th key={team.id} className="text-center font-semibold min-w-[90px] sm:min-w-[110px] px-1 sm:px-2 h-10 align-middle">
                                  <div className="flex flex-col items-center gap-1 sm:gap-1.5">
                                    <span className="text-xs font-medium leading-tight">
                                      <span className="sm:hidden">{getTeamAbbreviation(team.team_name)}</span>
                                      <span className="hidden sm:inline">{team.team_name}</span>
                                    </span>
                                    {team.seed && (
                                      <Badge 
                                        variant="outline" 
                                        className="text-xs border-red-300 text-red-700 w-12 flex items-center justify-center"
                                      >
                                        AFC #{team.seed}
                                      </Badge>
                                    )}
                                  </div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {participantsList.map((participant, index) => {
                              const participantPoints = allConfidencePoints.filter(
                                cp => cp.participant_id === participant.id
                              );
                              const pointsMap: Record<string, number> = {};
                              participantPoints.forEach(cp => {
                                pointsMap[cp.team_name] = cp.confidence_points;
                              });

                              const rowBgColor = index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50';
                              return (
                                <tr 
                                  key={participant.id} 
                                  className={`border-b transition-colors hover:bg-gray-50 ${rowBgColor}`}
                                >
                                  <td className={`sticky left-0 ${rowBgColor} z-20 font-medium border-r text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none shadow-[2px_0_4px_rgba(0,0,0,0.1)] p-2 align-middle`}>
                                    {participant.name}
                                  </td>
                                  {afcTeams.map(team => {
                                    const points = pointsMap[team.team_name];
                                    return (
                                      <td key={team.id} className="text-center px-1 sm:px-2 py-2 sm:py-3 align-middle">
                                        <div className="flex flex-col items-center justify-center gap-0.5">
                                          <span className={`text-lg sm:text-xl font-bold ${
                                            points ? 'text-blue-600' : 'text-gray-400'
                                          }`}>
                                            {points || '-'}
                                          </span>
                                        </div>
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* NFC Table */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b-2 border-blue-300">
                        <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                        <h3 className="text-base sm:text-lg font-bold text-blue-600">NFC</h3>
                      </div>
                      <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                        <table className="w-full caption-bottom text-sm border-collapse min-w-full">
                          <thead>
                            <tr className="bg-gray-50 border-b">
                              <th className="sticky left-0 bg-gray-50 z-30 font-semibold min-w-[120px] sm:min-w-[150px] border-r text-xs sm:text-sm shadow-[2px_0_4px_rgba(0,0,0,0.1)] h-10 px-2 text-left align-middle">
                                Participant
                              </th>
                              {nfcTeams.map(team => (
                                <th key={team.id} className="text-center font-semibold min-w-[90px] sm:min-w-[110px] px-1 sm:px-2 h-10 align-middle">
                                  <div className="flex flex-col items-center gap-1 sm:gap-1.5">
                                    <span className="text-xs font-medium leading-tight">
                                      <span className="sm:hidden">{getTeamAbbreviation(team.team_name)}</span>
                                      <span className="hidden sm:inline">{team.team_name}</span>
                                    </span>
                                    {team.seed && (
                                      <Badge 
                                        variant="outline" 
                                        className="text-xs border-blue-300 text-blue-700 w-12 flex items-center justify-center"
                                      >
                                        NFC #{team.seed}
                                      </Badge>
                                    )}
                                  </div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {participantsList.map((participant, index) => {
                              const participantPoints = allConfidencePoints.filter(
                                cp => cp.participant_id === participant.id
                              );
                              const pointsMap: Record<string, number> = {};
                              participantPoints.forEach(cp => {
                                pointsMap[cp.team_name] = cp.confidence_points;
                              });

                              const rowBgColor = index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50';
                              return (
                                <tr 
                                  key={participant.id} 
                                  className={`border-b transition-colors hover:bg-gray-50 ${rowBgColor}`}
                                >
                                  <td className={`sticky left-0 ${rowBgColor} z-20 font-medium border-r text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none shadow-[2px_0_4px_rgba(0,0,0,0.1)] p-2 align-middle`}>
                                    {participant.name}
                                  </td>
                                  {nfcTeams.map(team => {
                                    const points = pointsMap[team.team_name];
                                    return (
                                      <td key={team.id} className="text-center px-1 sm:px-2 py-2 sm:py-3 align-middle">
                                        <div className="flex flex-col items-center justify-center gap-0.5">
                                          <span className={`text-lg sm:text-xl font-bold ${
                                            points ? 'text-blue-600' : 'text-gray-400'
                                          }`}>
                                            {points || '-'}
                                          </span>
                                        </div>
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                );
              })()}
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
              >
                <option value="">Select a participant...</option>
                {participants.map(participant => (
                  <option key={participant.id} value={participant.id}>
                    {participant.name}
                  </option>
                ))}
              </select>
              {hasSubmission && selectedParticipantId && (
                <p className={`text-sm mt-1 flex items-center gap-1 ${isCompleteSubmission ? 'text-green-600' : 'text-orange-600'}`}>
                  <CheckCircle2 className="h-4 w-4" />
                  {isCompleteSubmission 
                    ? `${participants.find(p => p.id === selectedParticipantId)?.name || 'This participant'} has already submitted all confidence points`
                    : `${participants.find(p => p.id === selectedParticipantId)?.name || 'This participant'} has a partial submission. You can complete or update it.`
                  }
                </p>
              )}
            </div>

            {/* Confidence Points Input - Bracket Style */}
            {selectedParticipantId && !isCompleteSubmission && sortedPlayoffTeams.length > 0 && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* AFC Conference */}
                  <div className="space-y-2">
                    <div className="text-lg font-bold text-red-600 mb-4 pb-2 border-b-2 border-red-600">
                      AFC
                    </div>
                    {sortedPlayoffTeams
                      .filter(team => team.conference?.toUpperCase() === 'AFC')
                      .map(team => {
                        const isPlaceholder = !team.team_name || team.team_name.trim() === '';
                        const availablePoints = isPlaceholder ? [] : getAvailableConfidencePoints(team.team_name);
                        const currentValue = confidencePoints[team.team_name];
                        
                        return (
                          <div key={team.id} className="flex items-center gap-3 py-2 border-b border-gray-200 last:border-b-0">
                            <div className="w-8 text-center font-semibold text-gray-600">
                              {team.seed || '-'}
                            </div>
                            <div className="flex-1 font-medium">
                              {isPlaceholder ? (
                                <span className="text-gray-400 italic">Seed hasn't been determined yet</span>
                              ) : (
                                team.team_name
                              )}
                            </div>
                            <div className="w-32">
                              {isPlaceholder ? (
                                <div className="text-sm text-gray-400 italic">N/A</div>
                              ) : (
                                <Select
                                  value={currentValue?.toString() || ''}
                                  onValueChange={(value) => handleConfidencePointChange(team.team_name, value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Points" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {currentValue && (
                                      <SelectItem value="CLEAR" className="text-red-600">
                                        Clear
                                      </SelectItem>
                                    )}
                                    {availablePoints.length > 0 ? (
                                      availablePoints.map(points => (
                                        <SelectItem key={points} value={points.toString()}>
                                          {points} point{points !== 1 ? 's' : ''}
                                        </SelectItem>
                                      ))
                                    ) : (
                                      <SelectItem value="NONE" disabled>
                                        No points available
                                      </SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  {/* NFC Conference */}
                  <div className="space-y-2">
                    <div className="text-lg font-bold text-blue-600 mb-4 pb-2 border-b-2 border-blue-600">
                      NFC
                    </div>
                    {sortedPlayoffTeams
                      .filter(team => team.conference?.toUpperCase() === 'NFC')
                      .map(team => {
                        const isPlaceholder = !team.team_name || team.team_name.trim() === '';
                        const availablePoints = isPlaceholder ? [] : getAvailableConfidencePoints(team.team_name);
                        const currentValue = confidencePoints[team.team_name];
                        
                        return (
                          <div key={team.id} className="flex items-center gap-3 py-2 border-b border-gray-200 last:border-b-0">
                            <div className="w-8 text-center font-semibold text-gray-600">
                              {team.seed || '-'}
                            </div>
                            <div className="flex-1 font-medium">
                              {isPlaceholder ? (
                                <span className="text-gray-400 italic">Seed hasn't been determined yet</span>
                              ) : (
                                team.team_name
                              )}
                            </div>
                            <div className="w-32">
                              {isPlaceholder ? (
                                <div className="text-sm text-gray-400 italic">N/A</div>
                              ) : (
                                <Select
                                  value={currentValue?.toString() || ''}
                                  onValueChange={(value) => handleConfidencePointChange(team.team_name, value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Points" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {currentValue && (
                                      <SelectItem value="CLEAR" className="text-red-600">
                                        Clear
                                      </SelectItem>
                                    )}
                                    {availablePoints.length > 0 ? (
                                      availablePoints.map(points => (
                                        <SelectItem key={points} value={points.toString()}>
                                          {points} point{points !== 1 ? 's' : ''}
                                        </SelectItem>
                                      ))
                                    ) : (
                                      <SelectItem value="NONE" disabled>
                                        No points available
                                      </SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
                      
                {/* Debug Mode Checkbox - Only visible in development */}
                {process.env.NODE_ENV === 'development' && (
                  <div className="space-y-3 mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="debug-mode"
                        checked={debugMode}
                        onCheckedChange={(checked) => setDebugMode(checked === true)}
                      />
                      <Label
                        htmlFor="debug-mode"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        Debug Mode: Submit to DB and navigate to playoff picks page
                      </Label>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={generateRandomConfidencePoints}
                      className="w-full bg-purple-50 border-purple-300 text-purple-700 hover:bg-purple-100"
                    >
                      🎲 Generate Random Confidence Points
                    </Button>
                  </div>
                )}

                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="w-full mt-6"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Confidence Points'}
                </Button>
              </>
            )}

            {selectedParticipantId && isCompleteSubmission && (
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

