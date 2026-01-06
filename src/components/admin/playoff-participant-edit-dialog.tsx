'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Save, X, Target, Trophy, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { getNFLSeasonYear } from '@/lib/utils';

interface PlayoffParticipantEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participantId: string;
  participantName: string;
  poolId: string;
  poolSeason: number;
  onUpdate: () => void;
}

interface ConfidencePoint {
  team_name: string;
  confidence_points: number;
}

interface RoundPick {
  round: number;
  roundName: string;
  picks: Array<{
    game_id: string;
    game_name: string;
    predicted_winner: string;
    confidence_points: number;
  }>;
}

const roundNames: Record<number, string> = {
  1: 'Wild Card Round',
  2: 'Divisional Round',
  3: 'Conference Championships',
  4: 'Super Bowl'
};

export function PlayoffParticipantEditDialog({
  open,
  onOpenChange,
  participantId,
  participantName,
  poolId,
  poolSeason,
  onUpdate
}: PlayoffParticipantEditDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [confidencePoints, setConfidencePoints] = useState<ConfidencePoint[]>([]);
  const [roundPicks, setRoundPicks] = useState<RoundPick[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [canDeleteConfidencePoints, setCanDeleteConfidencePoints] = useState(true);
  const [showDeleteConfidenceDialog, setShowDeleteConfidenceDialog] = useState(false);
  const [showDeletePicksDialog, setShowDeletePicksDialog] = useState(false);
  const [roundToDelete, setRoundToDelete] = useState<number | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (open && participantId) {
      // Reset state when dialog opens
      setCanDeleteConfidencePoints(true);
      loadParticipantData();
    }
  }, [open, participantId, poolId, poolSeason]);

  const loadParticipantData = async () => {
    setIsLoadingData(true);
    try {
      // Load all playoff teams first
      const teamsResponse = await fetch(
        `/api/playoffs/${poolId}/teams?season=${poolSeason}`
      );
      const teamsData = await teamsResponse.json();
      
      const allTeams = teamsData.success && teamsData.teams 
        ? teamsData.teams.map((t: any) => t.team_name)
        : [];

      // Load confidence points
      const cpResponse = await fetch(
        `/api/playoffs/${poolId}/confidence-points?season=${poolSeason}&participantId=${participantId}`
      );
      const cpData = await cpResponse.json();
      
      if (cpData.success && cpData.confidencePoints && cpData.confidencePoints.length > 0) {
        // Use submitted confidence points
        setConfidencePoints(
          cpData.confidencePoints.map((cp: any) => ({
            team_name: cp.team_name,
            confidence_points: cp.confidence_points
          }))
        );
      } else if (allTeams.length > 0) {
        // Initialize with all teams, no confidence points assigned
        setConfidencePoints(
          allTeams.map((teamName: string) => ({
            team_name: teamName,
            confidence_points: 0
          }))
        );
      } else {
        setConfidencePoints([]);
      }

      // Load picks for each round
      const picksData: RoundPick[] = [];
      for (let round = 1; round <= 4; round++) {
        const picksResponse = await fetch(
          `/api/picks?poolId=${poolId}&participantId=${participantId}&week=${round}&seasonType=3&season=${poolSeason}`
        );
        const picksResult = await picksResponse.json();
        
        if (picksResult.success && picksResult.picks && picksResult.picks.length > 0) {
          // Get game details
          const gamesResponse = await fetch(
            `/api/games/week?week=${round}&seasonType=3&season=${poolSeason}&poolId=${poolId}`
          );
          const gamesResult = await gamesResponse.json();
          
          const gameMap = new Map();
          if (gamesResult.success && gamesResult.games) {
            gamesResult.games.forEach((game: any) => {
              gameMap.set(game.id, game);
            });
          }

          const picks = picksResult.picks.map((pick: any) => {
            const game = gameMap.get(pick.game_id);
            return {
              game_id: pick.game_id,
              game_name: game 
                ? `${game.away_team} vs ${game.home_team}`
                : `Game ${pick.game_id}`,
              predicted_winner: pick.predicted_winner || '',
              confidence_points: pick.confidence_points || 0
            };
          });

          picksData.push({
            round,
            roundName: roundNames[round],
            picks
          });
        } else {
          picksData.push({
            round,
            roundName: roundNames[round],
            picks: []
          });
        }
      }
      setRoundPicks(picksData);

      // Check if any rounds have started or passed
      // For playoff games, only rely on game status - don't use kickoff time comparison
      // A round has started if any game in that round has a status of 'live', 'final', 'post', or 'cancelled'
      let hasStartedRounds = false;
      try {
        for (let round = 1; round <= 4; round++) {
          const gamesResponse = await fetch(
            `/api/games/week?week=${round}&seasonType=3&season=${poolSeason}&poolId=${poolId}`
          );
          const gamesResult = await gamesResponse.json();
          
          if (gamesResult.success && gamesResult.games && gamesResult.games.length > 0) {
            const hasStarted = gamesResult.games.some((game: any) => {
              // Only check game status - this is the source of truth for playoff games
              const status = game.status?.toLowerCase();
              const isStarted = status === 'live' || status === 'final' || status === 'post' || status === 'cancelled';
              
              if (isStarted) {
                console.log(`Game ${game.away_team} @ ${game.home_team} has status: ${status} (round ${round})`);
              }
              else {
                console.log(`Game ${game.away_team} @ ${game.home_team} has status: ${status || 'unknown'} (round ${round}) - not started`);
              }
              
              return isStarted;
            });
            
            if (hasStarted) {
              hasStartedRounds = true;
              console.log(`Round ${round} has started games, blocking deletion`);
              break;
            }
          } else {
            console.log(`Round ${round}: No games found or API error`);
          }
        }
        const canDelete = !hasStartedRounds;
        console.log('Final check - Can delete confidence points:', canDelete, 'hasStartedRounds:', hasStartedRounds);
        setCanDeleteConfidencePoints(canDelete);
      } catch (checkError) {
        console.error('Error checking if rounds have started:', checkError);
        // If we can't check, default to allowing deletion (safer for admin)
        setCanDeleteConfidencePoints(true);
      }
    } catch (error) {
      console.error('Error loading participant data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load participant data',
        variant: 'destructive'
      });
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleConfidencePointChange = (index: number, value: string) => {
    const newPoints = [...confidencePoints];
    newPoints[index].confidence_points = parseInt(value) || 0;
    setConfidencePoints(newPoints);
  };

  const handleSaveConfidencePoints = async () => {
    setIsLoading(true);
    try {
      // Filter out teams with 0 or invalid confidence points
      const validPoints = confidencePoints.filter(cp => cp.confidence_points > 0);
      
      if (validPoints.length === 0) {
        toast({
          title: 'Error',
          description: 'At least one team must have a confidence point assigned',
          variant: 'destructive'
        });
        return;
      }

      // Validate all points are unique and > 0
      const points = validPoints.map(cp => cp.confidence_points);
      const uniquePoints = new Set(points);
      
      if (uniquePoints.size !== points.length) {
        toast({
          title: 'Error',
          description: 'All confidence points must be unique',
          variant: 'destructive'
        });
        return;
      }

      // Check if all playoff teams are included
      const teamsResponse = await fetch(
        `/api/playoffs/${poolId}/teams?season=${poolSeason}`
      );
      const teamsData = await teamsResponse.json();
      const allTeams = teamsData.success && teamsData.teams 
        ? teamsData.teams.map((t: any) => t.team_name)
        : [];

      if (validPoints.length !== allTeams.length) {
        toast({
          title: 'Error',
          description: `Must assign confidence points to all ${allTeams.length} playoff teams`,
          variant: 'destructive'
        });
        return;
      }

      // Update confidence points using admin endpoint (bypasses normal restrictions)
      const updateResponse = await fetch(
        `/api/admin/playoffs/confidence-points`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            poolId,
            participantId,
            season: poolSeason,
            confidence_points: validPoints.map(cp => ({
              team_name: cp.team_name,
              confidence_points: cp.confidence_points
            }))
          })
        }
      );

      const result = await updateResponse.json();
      if (result.success) {
        setSuccessMessage('Confidence points updated successfully');
        setShowSuccessDialog(true);
        onUpdate();
      } else {
        throw new Error(result.error || 'Failed to update confidence points');
      }
    } catch (error: any) {
      console.error('Error saving confidence points:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save confidence points',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteConfidencePoints = () => {
    setShowDeleteConfidenceDialog(true);
  };

  const confirmDeleteConfidencePoints = async () => {
    setShowDeleteConfidenceDialog(false);
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/admin/playoffs/confidence-points?poolId=${poolId}&participantId=${participantId}&season=${poolSeason}`,
        { method: 'DELETE' }
      );

      const result = await response.json();
      if (result.success) {
        setSuccessMessage(result.message || 'Confidence points and round picks deleted successfully');
        setShowSuccessDialog(true);
        setConfidencePoints([]);
        // Clear round picks from state since they were also deleted
        setRoundPicks(prev => prev.map(rp => ({ ...rp, picks: [] })));
        onUpdate();
      } else {
        throw new Error(result.error || 'Failed to delete confidence points');
      }
    } catch (error: any) {
      console.error('Error deleting confidence points:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete confidence points',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteRoundPicks = (round: number) => {
    setRoundToDelete(round);
    setShowDeletePicksDialog(true);
  };

  const confirmDeleteRoundPicks = async () => {
    if (roundToDelete === null) return;
    const round = roundToDelete;
    setShowDeletePicksDialog(false);
    setRoundToDelete(null);
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/admin/playoffs/picks?poolId=${poolId}&participantId=${participantId}&round=${round}&season=${poolSeason}`,
        { method: 'DELETE' }
      );

      const result = await response.json();
      if (result.success) {
        setSuccessMessage(`${roundNames[round]} picks deleted successfully`);
        setShowSuccessDialog(true);
        // Remove picks from state
        setRoundPicks(prev => prev.map(rp => 
          rp.round === round ? { ...rp, picks: [] } : rp
        ));
        onUpdate();
      } else {
        throw new Error(result.error || 'Failed to delete picks');
      }
    } catch (error: any) {
      console.error('Error deleting picks:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete picks',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Edit Playoff Data: {participantName}
          </DialogTitle>
          <DialogDescription>
            Update confidence points and round picks for this participant
          </DialogDescription>
        </DialogHeader>

        {isLoadingData ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <Tabs defaultValue="confidence" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="confidence">
                <Target className="h-4 w-4 mr-2" />
                Confidence Points
              </TabsTrigger>
              <TabsTrigger value="picks">
                <Trophy className="h-4 w-4 mr-2" />
                Round Picks
              </TabsTrigger>
            </TabsList>

            <TabsContent value="confidence" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Confidence Points</CardTitle>
                      <CardDescription>
                        Assign confidence points to each playoff team
                      </CardDescription>
                    </div>
                    {confidencePoints.length > 0 && canDeleteConfidencePoints && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleDeleteConfidencePoints}
                        disabled={isLoading}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete All
                      </Button>
                    )}
                    {confidencePoints.length > 0 && !canDeleteConfidencePoints && (
                      <div className="text-xs text-muted-foreground">
                        Cannot delete: rounds have started
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {confidencePoints.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No confidence points submitted</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {confidencePoints.map((cp, index) => (
                        <div key={cp.team_name} className="flex items-center gap-4">
                          <Label className="w-32 font-medium">{cp.team_name}</Label>
                          <Input
                            type="number"
                            min="1"
                            value={cp.confidence_points}
                            onChange={(e) => handleConfidencePointChange(index, e.target.value)}
                            className="w-24"
                          />
                        </div>
                      ))}
                      <div className="flex justify-end pt-4">
                        <Button
                          onClick={handleSaveConfidencePoints}
                          disabled={isLoading}
                        >
                          <Save className="h-4 w-4 mr-2" />
                          Save Changes
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="picks" className="space-y-4 mt-4">
              <div className="space-y-4">
                {roundPicks.map((roundPick) => (
                  <Card key={roundPick.round}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>{roundPick.roundName}</CardTitle>
                          <CardDescription>
                            {roundPick.picks.length} pick{roundPick.picks.length !== 1 ? 's' : ''}
                          </CardDescription>
                        </div>
                        {roundPick.picks.length > 0 && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteRoundPicks(roundPick.round)}
                            disabled={isLoading}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Round
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {roundPick.picks.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground">
                          <p>No picks submitted for this round</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {roundPick.picks.map((pick) => (
                            <div
                              key={pick.game_id}
                              className="flex items-center justify-between p-3 border rounded-lg"
                            >
                              <div className="flex-1">
                                <p className="font-medium">{pick.game_name}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline">
                                    {pick.predicted_winner}
                                  </Badge>
                                  <span className="text-sm text-muted-foreground">
                                    {pick.confidence_points} pts
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>

      {/* Delete Confidence Points Confirmation Dialog */}
      <AlertDialog open={showDeleteConfidenceDialog} onOpenChange={setShowDeleteConfidenceDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete All Confidence Points?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <div className="font-medium">This action will permanently delete:</div>
                <ul className="list-disc list-inside space-y-1 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
                  <li>All confidence points for <strong>{participantName}</strong></li>
                  <li>All round picks for all playoff rounds</li>
                </ul>
                <div className="text-sm text-muted-foreground mt-3">
                  The participant will be able to submit new confidence points and picks after deletion.
                </div>
                <div className="text-xs font-semibold text-red-600 mt-2">
                  ⚠️ This action cannot be undone
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteConfidencePoints}
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Round Picks Confirmation Dialog */}
      <AlertDialog open={showDeletePicksDialog} onOpenChange={setShowDeletePicksDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete {roundToDelete ? roundNames[roundToDelete] : 'Round'} Picks?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <div className="font-medium">This action will permanently delete:</div>
                <ul className="list-disc list-inside space-y-1 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
                  <li>All picks for <strong>{roundToDelete ? roundNames[roundToDelete] : 'this round'}</strong></li>
                  <li>For participant: <strong>{participantName}</strong></li>
                </ul>
                <div className="text-sm text-muted-foreground mt-3">
                  The participant will be able to submit new picks for this round after deletion.
                </div>
                <div className="text-xs font-semibold text-red-600 mt-2">
                  ⚠️ This action cannot be undone
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRoundToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteRoundPicks}
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Picks
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Success Dialog */}
      <AlertDialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              Success!
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              {successMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowSuccessDialog(false)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

