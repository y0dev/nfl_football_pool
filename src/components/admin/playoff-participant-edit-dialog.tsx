'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Save, Target, Trophy, AlertTriangle, CheckCircle2 } from 'lucide-react';

const card    = 'oklch(20% 0.03 255)';
const surface = 'oklch(17% 0.028 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const red     = 'oklch(60% 0.22 25)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

const labelStyle = { ...bc, fontSize: '0.68rem', fontWeight: 700 as const, color: textDim, textTransform: 'uppercase' as const, letterSpacing: '0.08em', display: 'block', marginBottom: '0.35rem' };
const inputStyle = { ...b, background: surface, border: `1px solid ${border}`, color: text, padding: '0.45rem 0.65rem', borderRadius: 6, boxSizing: 'border-box' as const, fontSize: '0.875rem', width: '6rem' };
const sectionCard = { background: surface, border: `1px solid ${border}`, borderRadius: 8, padding: '1rem' };

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
  4: 'Super Bowl',
};

export function PlayoffParticipantEditDialog({
  open, onOpenChange, participantId, participantName, poolId, poolSeason, onUpdate
}: PlayoffParticipantEditDialogProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'confidence' | 'picks'>('confidence');
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
      setCanDeleteConfidencePoints(true);
      loadParticipantData();
    }
  }, [open, participantId, poolId, poolSeason]);

  const loadParticipantData = async () => {
    setIsLoadingData(true);
    try {
      const teamsResponse = await fetch(`/api/playoffs/${poolId}/teams?season=${poolSeason}`);
      const teamsData = await teamsResponse.json();
      const allTeams = teamsData.success && teamsData.teams ? teamsData.teams.map((t: any) => t.team_name) : [];

      const cpResponse = await fetch(`/api/playoffs/${poolId}/confidence-points?season=${poolSeason}&participantId=${participantId}`);
      const cpData = await cpResponse.json();

      if (cpData.success && cpData.confidencePoints && cpData.confidencePoints.length > 0) {
        setConfidencePoints(cpData.confidencePoints.map((cp: any) => ({ team_name: cp.team_name, confidence_points: cp.confidence_points })));
      } else if (allTeams.length > 0) {
        setConfidencePoints(allTeams.map((teamName: string) => ({ team_name: teamName, confidence_points: 0 })));
      } else {
        setConfidencePoints([]);
      }

      const picksData: RoundPick[] = [];
      for (let round = 1; round <= 4; round++) {
        const picksResponse = await fetch(`/api/picks?poolId=${poolId}&participantId=${participantId}&week=${round}&seasonType=3&season=${poolSeason}`);
        const picksResult = await picksResponse.json();
        if (picksResult.success && picksResult.picks && picksResult.picks.length > 0) {
          const gamesResponse = await fetch(`/api/games/week?week=${round}&seasonType=3&season=${poolSeason}&poolId=${poolId}`);
          const gamesResult = await gamesResponse.json();
          const gameMap = new Map();
          if (gamesResult.success && gamesResult.games) {
            gamesResult.games.forEach((game: any) => gameMap.set(game.id, game));
          }
          const picks = picksResult.picks.map((pick: any) => {
            const game = gameMap.get(pick.game_id);
            return {
              game_id: pick.game_id,
              game_name: game ? `${game.away_team} vs ${game.home_team}` : `Game ${pick.game_id}`,
              predicted_winner: pick.predicted_winner || '',
              confidence_points: pick.confidence_points || 0,
            };
          });
          picksData.push({ round, roundName: roundNames[round], picks });
        } else {
          picksData.push({ round, roundName: roundNames[round], picks: [] });
        }
      }
      setRoundPicks(picksData);

      let hasStartedRounds = false;
      try {
        for (let round = 1; round <= 4; round++) {
          const gamesResponse = await fetch(`/api/games/week?week=${round}&seasonType=3&season=${poolSeason}&poolId=${poolId}`);
          const gamesResult = await gamesResponse.json();
          if (gamesResult.success && gamesResult.games && gamesResult.games.length > 0) {
            const hasStarted = gamesResult.games.some((game: any) => {
              const status = game.status?.toLowerCase();
              return status === 'live' || status === 'final' || status === 'post' || status === 'cancelled';
            });
            if (hasStarted) { hasStartedRounds = true; break; }
          }
        }
        setCanDeleteConfidencePoints(!hasStartedRounds);
      } catch {
        setCanDeleteConfidencePoints(true);
      }
    } catch (error) {
      console.error('Error loading participant data:', error);
      toast({ title: 'Error', description: 'Failed to load participant data', variant: 'destructive' });
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
      const validPoints = confidencePoints.filter(cp => cp.confidence_points > 0);
      if (validPoints.length === 0) {
        toast({ title: 'Error', description: 'At least one team must have a confidence point assigned', variant: 'destructive' });
        return;
      }
      const points = validPoints.map(cp => cp.confidence_points);
      if (new Set(points).size !== points.length) {
        toast({ title: 'Error', description: 'All confidence points must be unique', variant: 'destructive' });
        return;
      }
      const teamsResponse = await fetch(`/api/playoffs/${poolId}/teams?season=${poolSeason}`);
      const teamsData = await teamsResponse.json();
      const allTeams = teamsData.success && teamsData.teams ? teamsData.teams.map((t: any) => t.team_name) : [];
      if (validPoints.length !== allTeams.length) {
        toast({ title: 'Error', description: `Must assign confidence points to all ${allTeams.length} playoff teams`, variant: 'destructive' });
        return;
      }
      const updateResponse = await fetch('/api/admin/playoffs/confidence-points', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poolId, participantId, season: poolSeason, confidence_points: validPoints.map(cp => ({ team_name: cp.team_name, confidence_points: cp.confidence_points })) }),
      });
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
      toast({ title: 'Error', description: error.message || 'Failed to save confidence points', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const confirmDeleteConfidencePoints = async () => {
    setShowDeleteConfidenceDialog(false);
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/playoffs/confidence-points?poolId=${poolId}&participantId=${participantId}&season=${poolSeason}`, { method: 'DELETE' });
      const result = await response.json();
      if (result.success) {
        setSuccessMessage(result.message || 'Confidence points and round picks deleted successfully');
        setShowSuccessDialog(true);
        setConfidencePoints([]);
        setRoundPicks(prev => prev.map(rp => ({ ...rp, picks: [] })));
        onUpdate();
      } else {
        throw new Error(result.error || 'Failed to delete confidence points');
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to delete confidence points', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const confirmDeleteRoundPicks = async () => {
    if (roundToDelete === null) return;
    const round = roundToDelete;
    setShowDeletePicksDialog(false);
    setRoundToDelete(null);
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/playoffs/picks?poolId=${poolId}&participantId=${participantId}&round=${round}&season=${poolSeason}`, { method: 'DELETE' });
      const result = await response.json();
      if (result.success) {
        setSuccessMessage(`${roundNames[round]} picks deleted successfully`);
        setShowSuccessDialog(true);
        setRoundPicks(prev => prev.map(rp => rp.round === round ? { ...rp, picks: [] } : rp));
        onUpdate();
      } else {
        throw new Error(result.error || 'Failed to delete picks');
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to delete picks', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { id: 'confidence' as const, label: 'Confidence Points', icon: Target },
    { id: 'picks' as const, label: 'Round Picks', icon: Trophy },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ maxWidth: '56rem', maxHeight: '90vh', overflowY: 'auto', background: card, border: `1px solid ${border}` }}>
        <DialogHeader>
          <DialogTitle style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Target style={{ width: 16, height: 16, color: textMid }} />
            Edit Playoff Data: {participantName}
          </DialogTitle>
          <DialogDescription style={{ ...b, fontSize: '0.78rem', color: textDim }}>
            Update confidence points and round picks for this participant
          </DialogDescription>
        </DialogHeader>

        {isLoadingData ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
            <div style={{ width: 28, height: 28, border: `2px solid ${border}`, borderTopColor: green, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: '0.25rem', borderBottom: `1px solid ${border}`, marginBottom: '1rem' }}>
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.55rem 1rem', background: activeTab === id ? surface : 'transparent', color: activeTab === id ? text : textDim, border: 'none', borderBottom: `2px solid ${activeTab === id ? green : 'transparent'}`, cursor: 'pointer', ...bc, fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '-1px' }}
                >
                  <Icon style={{ width: 13, height: 13 }} />
                  {label}
                </button>
              ))}
            </div>

            {/* Confidence Points Tab */}
            {activeTab === 'confidence' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={sectionCard}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                    <div>
                      <p style={{ ...bc, fontWeight: 800, fontSize: '0.85rem', color: text, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.15rem' }}>Confidence Points</p>
                      <p style={{ ...b, fontSize: '0.75rem', color: textDim }}>Assign confidence points to each playoff team</p>
                    </div>
                    {confidencePoints.length > 0 && (
                      canDeleteConfidencePoints ? (
                        <button
                          onClick={() => setShowDeleteConfidenceDialog(true)}
                          disabled={isLoading}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.75rem', background: `color-mix(in oklch, ${red} 12%, ${surface})`, color: red, border: `1px solid color-mix(in oklch, ${red} 30%, ${border})`, borderRadius: 6, cursor: isLoading ? 'not-allowed' : 'pointer', ...bc, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}
                        >
                          <Trash2 style={{ width: 12, height: 12 }} />
                          Delete All
                        </button>
                      ) : (
                        <span style={{ ...b, fontSize: '0.72rem', color: textDim }}>Cannot delete: rounds have started</span>
                      )
                    )}
                  </div>

                  {confidencePoints.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '1.5rem' }}>
                      <p style={{ ...b, fontSize: '0.8rem', color: textDim }}>No confidence points submitted</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {confidencePoints.map((cp, index) => (
                        <div key={cp.team_name} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <span style={{ ...b, fontWeight: 600, fontSize: '0.875rem', color: text, minWidth: 120 }}>{cp.team_name}</span>
                          <input
                            type="number"
                            min="1"
                            value={cp.confidence_points}
                            onChange={(e) => handleConfidencePointChange(index, e.target.value)}
                            style={inputStyle}
                          />
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.75rem' }}>
                        <button
                          onClick={handleSaveConfidencePoints}
                          disabled={isLoading}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 1rem', background: isLoading ? border : green, color: isLoading ? textDim : text, border: 'none', borderRadius: 6, cursor: isLoading ? 'not-allowed' : 'pointer', ...bc, fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}
                        >
                          <Save style={{ width: 13, height: 13 }} />
                          Save Changes
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Round Picks Tab */}
            {activeTab === 'picks' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {roundPicks.map((roundPick) => (
                  <div key={roundPick.round} style={sectionCard}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <div>
                        <p style={{ ...bc, fontWeight: 800, fontSize: '0.85rem', color: text, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.15rem' }}>{roundPick.roundName}</p>
                        <p style={{ ...b, fontSize: '0.72rem', color: textDim }}>{roundPick.picks.length} pick{roundPick.picks.length !== 1 ? 's' : ''}</p>
                      </div>
                      {roundPick.picks.length > 0 && (
                        <button
                          onClick={() => { setRoundToDelete(roundPick.round); setShowDeletePicksDialog(true); }}
                          disabled={isLoading}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.75rem', background: `color-mix(in oklch, ${red} 12%, ${surface})`, color: red, border: `1px solid color-mix(in oklch, ${red} 30%, ${border})`, borderRadius: 6, cursor: isLoading ? 'not-allowed' : 'pointer', ...bc, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}
                        >
                          <Trash2 style={{ width: 12, height: 12 }} />
                          Delete Round
                        </button>
                      )}
                    </div>

                    {roundPick.picks.length === 0 ? (
                      <p style={{ ...b, fontSize: '0.8rem', color: textDim, textAlign: 'center', padding: '0.75rem 0' }}>No picks submitted for this round</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {roundPick.picks.map((pick) => (
                          <div key={pick.game_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 0.85rem', background: card, border: `1px solid ${border}`, borderRadius: 6 }}>
                            <p style={{ ...b, fontWeight: 600, fontSize: '0.875rem', color: text }}>{pick.game_name}</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ ...bc, fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0.15rem 0.5rem', border: `1px solid ${border}`, borderRadius: 4, color: textMid }}>{pick.predicted_winner}</span>
                              <span style={{ ...b, fontSize: '0.75rem', color: textDim }}>{pick.confidence_points} pts</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </DialogContent>

      {/* Delete Confidence Points */}
      <AlertDialog open={showDeleteConfidenceDialog} onOpenChange={setShowDeleteConfidenceDialog}>
        <AlertDialogContent style={{ background: card, border: `1px solid ${border}` }}>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: red, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle style={{ width: 16, height: 16 }} />
              Delete All Confidence Points?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div style={{ ...b, fontSize: '0.8rem', color: textDim }}>
                <p style={{ fontWeight: 700, color: textMid, marginBottom: '0.5rem' }}>This action will permanently delete:</p>
                <div style={{ padding: '0.65rem 0.85rem', background: `color-mix(in oklch, ${red} 8%, ${surface})`, border: `1px solid color-mix(in oklch, ${red} 25%, ${border})`, borderRadius: 6, marginBottom: '0.5rem' }}>
                  <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <li style={{ listStyleType: 'disc' }}>All confidence points for <strong>{participantName}</strong></li>
                    <li style={{ listStyleType: 'disc' }}>All round picks for all playoff rounds</li>
                  </ul>
                </div>
                <p style={{ color: textDim }}>The participant will be able to submit new confidence points and picks after deletion.</p>
                <p style={{ color: red, fontWeight: 700, fontSize: '0.72rem', marginTop: '0.35rem' }}>⚠️ This action cannot be undone</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel style={{ ...bc, padding: '0.45rem 0.85rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 6, fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer' }}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteConfidencePoints}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.85rem', background: `color-mix(in oklch, ${red} 20%, ${surface})`, color: red, border: `1px solid color-mix(in oklch, ${red} 35%, ${border})`, borderRadius: 6, cursor: 'pointer', ...bc, fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}
            >
              <Trash2 style={{ width: 12, height: 12 }} />
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Round Picks */}
      <AlertDialog open={showDeletePicksDialog} onOpenChange={setShowDeletePicksDialog}>
        <AlertDialogContent style={{ background: card, border: `1px solid ${border}` }}>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: red, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle style={{ width: 16, height: 16 }} />
              Delete {roundToDelete ? roundNames[roundToDelete] : 'Round'} Picks?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div style={{ ...b, fontSize: '0.8rem', color: textDim }}>
                <p style={{ fontWeight: 700, color: textMid, marginBottom: '0.5rem' }}>This action will permanently delete:</p>
                <div style={{ padding: '0.65rem 0.85rem', background: `color-mix(in oklch, ${red} 8%, ${surface})`, border: `1px solid color-mix(in oklch, ${red} 25%, ${border})`, borderRadius: 6, marginBottom: '0.5rem' }}>
                  <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <li style={{ listStyleType: 'disc' }}>All picks for <strong>{roundToDelete ? roundNames[roundToDelete] : 'this round'}</strong></li>
                    <li style={{ listStyleType: 'disc' }}>For participant: <strong>{participantName}</strong></li>
                  </ul>
                </div>
                <p style={{ color: textDim }}>The participant will be able to submit new picks for this round after deletion.</p>
                <p style={{ color: red, fontWeight: 700, fontSize: '0.72rem', marginTop: '0.35rem' }}>⚠️ This action cannot be undone</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRoundToDelete(null)} style={{ ...bc, padding: '0.45rem 0.85rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 6, fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer' }}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteRoundPicks}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.85rem', background: `color-mix(in oklch, ${red} 20%, ${surface})`, color: red, border: `1px solid color-mix(in oklch, ${red} 35%, ${border})`, borderRadius: 6, cursor: 'pointer', ...bc, fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}
            >
              <Trash2 style={{ width: 12, height: 12 }} />
              Delete Picks
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Success */}
      <AlertDialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <AlertDialogContent style={{ background: card, border: `1px solid ${border}` }}>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: greenHi, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 style={{ width: 16, height: 16 }} />
              Success!
            </AlertDialogTitle>
            <AlertDialogDescription style={{ ...b, fontSize: '0.85rem', color: textMid }}>{successMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setShowSuccessDialog(false)}
              style={{ padding: '0.45rem 0.85rem', background: green, color: text, border: 'none', borderRadius: 6, cursor: 'pointer', ...bc, fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}
            >
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
