'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Target, Users, Calendar, Edit, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PERIOD_WEEKS, SUPER_BOWL_SEASON_TYPE, SEASON_TYPE_OPTIONS } from '@/lib/utils';
import { getSupabaseClient, getSupabaseServiceClient } from '@/lib/supabase';
import { getMondayNightGameInfo } from '@/lib/monday-night-utils';
import { loadCurrentWeek } from '@/actions/loadCurrentWeek';

const surface = 'oklch(17% 0.028 255)';
const card    = 'oklch(20% 0.03 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const amber   = 'oklch(72% 0.16 60)';

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

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
  participants?: { name: string; email?: string };
  games?: { home_team: string; away_team: string; week: number; season: number; season_type: number };
}

interface WeekInfo {
  week: number;
  season: number;
  seasonType: number;
  isPeriodWeek: boolean;
  isSuperBowl: boolean;
}

interface OverridePicksPanelProps {
  poolId: string;
  poolName: string;
  currentSeason: number;
  seasonScope?: number[];
}

export function OverridePicksPanel({ poolId, poolName, currentSeason, seasonScope }: OverridePicksPanelProps) {
  const { toast } = useToast();

  // Only offer season types this pool actually covers, and the correct week
  // range for whichever one is selected — a pool scoped to Regular Season
  // only shouldn't let a commissioner override picks for Playoffs weeks.
  const seasonTypes = useMemo(() => {
    const scope = seasonScope && seasonScope.length > 0 ? seasonScope : [1, 2, 3];
    const allowed = SEASON_TYPE_OPTIONS.filter(t => scope.includes(t.value));
    return allowed.length > 0 ? allowed : SEASON_TYPE_OPTIONS.filter(t => t.value === 2);
  }, [seasonScope]);

  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [selectedSeasonType, setSelectedSeasonType] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  const weeks = useMemo(() => {
    const type = seasonTypes.find(t => t.value.toString() === selectedSeasonType) ?? seasonTypes[0];
    const count = type?.weeks ?? 18;
    return Array.from({ length: count }, (_, i) => i + 1);
  }, [selectedSeasonType, seasonTypes]);
  const [weekInfo, setWeekInfo] = useState<WeekInfo | null>(null);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [isLoadingPicks, setIsLoadingPicks] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddPickDialog, setShowAddPickDialog] = useState(false);
  const [showMondayNightDialog, setShowMondayNightDialog] = useState(false);
  const [selectedParticipantForManagement, setSelectedParticipantForManagement] = useState<string>('');
  const [selectedParticipantForNewPick, setSelectedParticipantForNewPick] = useState<string>('');
  const [availableGames, setAvailableGames] = useState<Array<{
    id: string; home_team: string; away_team: string;
    week: number; season: number; season_type: number;
    kickoff_time: string; status: string;
  }>>([]);
  const [allParticipants, setAllParticipants] = useState<Array<{ id: string; name: string; email: string | null }>>([]);
  const [newPickData, setNewPickData] = useState({ gameId: '', predictedWinner: '', confidencePoints: 1 });
  const [mondayNightScore, setMondayNightScore] = useState<string>('');

  const getClient = () => getSupabaseServiceClient() || getSupabaseClient();

  const loadPicks = useCallback(async (week: number, seasonType: number) => {
    setIsLoadingPicks(true);
    try {
      const client = getClient();
      if (!client) return;

      const { data: gamesData } = await client
        .from('games').select('id')
        .eq('week', week).eq('season', currentSeason).eq('season_type', seasonType);

      const gameIds = gamesData?.map(g => g.id) || [];
      if (gameIds.length === 0) { setPicks([]); return; }

      const { data: picksData, error } = await client
        .from('picks')
        .select(`
          id, participant_id, pool_id, game_id, predicted_winner,
          confidence_points, locked, submitted_by, created_at,
          participants(name, email),
          games(home_team, away_team, week, season, season_type)
        `)
        .eq('pool_id', poolId)
        .in('game_id', gameIds)
        .order('created_at', { ascending: false });

      if (error) { toast({ title: 'Error', description: 'Failed to load picks', variant: 'destructive' }); return; }

      setPicks((picksData || []).map(p => ({
        ...p,
        participants: Array.isArray(p.participants) ? p.participants[0] : p.participants,
        games: Array.isArray(p.games) ? p.games[0] : p.games,
      })));
    } catch {
      toast({ title: 'Error', description: 'Failed to load picks', variant: 'destructive' });
    } finally {
      setIsLoadingPicks(false);
    }
  }, [poolId, currentSeason, toast]);

  const loadAvailableGames = useCallback(async (week: number, seasonType: number) => {
    try {
      const client = getClient();
      if (!client) return;
      const { data } = await client
        .from('games')
        .select('id, home_team, away_team, week, season, season_type, kickoff_time, status')
        .eq('week', week).eq('season', currentSeason).eq('season_type', seasonType)
        .order('kickoff_time', { ascending: true });
      setAvailableGames(data || []);
    } catch { /* non-critical */ }
  }, [currentSeason]);

  const loadAllParticipants = useCallback(async () => {
    try {
      const client = getClient();
      if (!client) return;
      const { data } = await client
        .from('participants').select('id, name, email')
        .eq('pool_id', poolId).eq('is_active', true).order('name');
      setAllParticipants(data || []);
    } catch { /* non-critical */ }
  }, [poolId]);

  useEffect(() => {
    const init = async () => {
      const scopeValues = seasonTypes.map(t => t.value);
      const defaultType = seasonTypes.find(t => t.value === 2) ?? seasonTypes[0];
      try {
        // Default to the actual current week (first week if the season
        // hasn't started yet, the in-progress week once it has) rather than
        // just the latest week with games loaded — a commissioner shouldn't
        // land on the season finale by default.
        const current = await loadCurrentWeek();
        if (current.season_type && (scopeValues as number[]).includes(current.season_type)) {
          setSelectedSeasonType(String(current.season_type));
          setSelectedWeek(String(current.week_number));
        } else {
          setSelectedSeasonType(String(defaultType?.value ?? 2));
          setSelectedWeek('1');
        }
      } catch {
        setSelectedSeasonType(String(defaultType?.value ?? 2));
        setSelectedWeek('1');
      } finally {
        setIsLoading(false);
      }
    };
    init();
    loadAllParticipants();
  }, [poolId, loadAllParticipants, seasonTypes]);

  useEffect(() => {
    if (selectedWeek && selectedSeasonType) {
      const week = parseInt(selectedWeek);
      const seasonType = parseInt(selectedSeasonType);
      setWeekInfo({
        week, season: currentSeason, seasonType,
        isPeriodWeek: PERIOD_WEEKS.includes(week as typeof PERIOD_WEEKS[number]),
        isSuperBowl: seasonType === SUPER_BOWL_SEASON_TYPE,
      });
      loadPicks(week, seasonType);
      loadAvailableGames(week, seasonType);
    } else {
      setWeekInfo(null);
      setPicks([]);
      setAvailableGames([]);
    }
  }, [selectedWeek, selectedSeasonType, currentSeason, loadPicks, loadAvailableGames]);

  const submitNewPick = useCallback(async () => {
    const participantId = selectedParticipantForNewPick || selectedParticipantForManagement;
    if (!participantId || !newPickData.gameId || !newPickData.predictedWinner) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const client = getClient();
      if (!client) return;
      const { error } = await client.from('picks').insert({
        participant_id: participantId, pool_id: poolId,
        game_id: newPickData.gameId, predicted_winner: newPickData.predictedWinner,
        confidence_points: newPickData.confidencePoints, submitted_by: 'admin_override',
      });
      if (error) { toast({ title: 'Error', description: 'Failed to submit pick', variant: 'destructive' }); return; }
      if (selectedWeek) await loadPicks(parseInt(selectedWeek), parseInt(selectedSeasonType || '2'));
      setShowAddPickDialog(false);
      setSelectedParticipantForNewPick('');
      setNewPickData({ gameId: '', predictedWinner: '', confidencePoints: 1 });
      toast({ title: 'Success', description: 'Pick submitted successfully' });
    } catch {
      toast({ title: 'Error', description: 'Failed to submit pick', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }, [selectedParticipantForNewPick, selectedParticipantForManagement, newPickData, poolId, selectedWeek, selectedSeasonType, loadPicks, toast]);

  const submitMondayNightScore = useCallback(async () => {
    if (!selectedParticipantForManagement || !mondayNightScore) {
      toast({ title: 'Error', description: 'Please enter a Monday night score', variant: 'destructive' });
      return;
    }
    const score = parseInt(mondayNightScore);
    if (isNaN(score) || score < 0) {
      toast({ title: 'Error', description: 'Score must be a positive number', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/override-monday-night-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poolId, participantId: selectedParticipantForManagement,
          week: parseInt(selectedWeek || '1'), season: currentSeason,
          seasonType: parseInt(selectedSeasonType || '2'), mondayNightScore: score,
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
    } catch {
      toast({ title: 'Error', description: 'An unexpected error occurred', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }, [selectedParticipantForManagement, mondayNightScore, poolId, selectedWeek, currentSeason, selectedSeasonType, toast]);

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <RefreshCw style={{ width: 24, height: 24, color: textDim, margin: '0 auto 0.5rem', animation: 'spin 1s linear infinite' }} />
        <p style={{ ...b, color: textMid, fontSize: '0.85rem' }}>Loading…</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Week / Season Type selectors */}
      <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
          <Target style={{ width: 16, height: 16, color: greenHi }} />
          <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase' }}>
            Select Week
          </p>
        </div>
        <p style={{ ...b, fontSize: '0.8rem', color: textDim, marginBottom: '1.25rem' }}>
          Choose a week and season type to manage picks for {poolName}
        </p>
        <div className="admin-3col-grid" style={{ marginBottom: 0 }}>
          <div>
            <label style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', color: textMid, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>Week</label>
            <Select value={selectedWeek} onValueChange={setSelectedWeek}>
              <SelectTrigger style={{ background: surface, border: `1px solid ${border}`, color: text, ...b }}>
                <SelectValue placeholder="Select a week" />
              </SelectTrigger>
              <SelectContent>
                {weeks.map((week) => {
                  const isTieBreaker = PERIOD_WEEKS.includes(week as typeof PERIOD_WEEKS[number]);
                  return (
                    <SelectItem key={week} value={week.toString()}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Calendar style={{ width: 13, height: 13 }} />
                        <span>Week {week}</span>
                        {isTieBreaker && (
                          <span style={{ ...bc, fontWeight: 700, fontSize: '0.6rem', letterSpacing: '0.07em', padding: '0.1rem 0.35rem', borderRadius: 3, textTransform: 'uppercase', background: `oklch(72% 0.16 60 / 0.15)`, color: amber, border: `1px solid oklch(72% 0.16 60 / 0.35)` }}>
                            Tie-breaker
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', color: textMid, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>Season Type</label>
            <Select value={selectedSeasonType} onValueChange={(v) => { setSelectedSeasonType(v); setSelectedWeek('1'); }}>
              <SelectTrigger style={{ background: surface, border: `1px solid ${border}`, color: text, ...b }}>
                <SelectValue placeholder="Season type" />
              </SelectTrigger>
              <SelectContent>
                {seasonTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value.toString()}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Participant management */}
      {weekInfo && (
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
            <Users style={{ width: 16, height: 16, color: greenHi }} />
            <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase' }}>
              Manage Picks — Week {weekInfo.week}
            </p>
          </div>
          <p style={{ ...b, fontSize: '0.8rem', color: textDim, marginBottom: '1.25rem' }}>
            Select a participant to add or override their picks.
          </p>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', color: textMid, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
              Select Participant
            </label>
            <Select value={selectedParticipantForManagement} onValueChange={setSelectedParticipantForManagement}>
              <SelectTrigger style={{ background: surface, border: `1px solid ${border}`, color: text, ...b }}>
                <SelectValue placeholder="Choose a participant" />
              </SelectTrigger>
              <SelectContent>
                {allParticipants.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name} ({p.email || 'No email'})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedParticipantForManagement && (() => {
            const participantPicks = picks.filter(p => p.participant_id === selectedParticipantForManagement);
            const participant = allParticipants.find(p => p.id === selectedParticipantForManagement);
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ padding: '0.85rem 1rem', background: surface, border: `1px solid ${border}`, borderRadius: 8 }}>
                  <p style={{ ...bc, fontWeight: 800, fontSize: '0.88rem', color: text, marginBottom: '0.3rem' }}>{participant?.name}</p>
                  <p style={{ ...b, fontSize: '0.8rem', color: textMid }}>
                    {participantPicks.length > 0
                      ? `${participantPicks.length} picks submitted for Week ${weekInfo.week}`
                      : `No picks submitted for Week ${weekInfo.week}`}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setShowAddPickDialog(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem', background: green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
                  >
                    <Edit style={{ width: 13, height: 13 }} />
                    {participantPicks.length > 0 ? 'Override Picks' : 'Add Picks'}
                  </button>
                  {(weekInfo.isPeriodWeek || weekInfo.isSuperBowl) && (
                    <button
                      onClick={() => setShowMondayNightDialog(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
                    >
                      <Target style={{ width: 13, height: 13 }} />
                      Monday Night Score
                    </button>
                  )}
                </div>
                {participantPicks.length > 0 && (
                  <div>
                    <p style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', color: textDim, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                      Current Picks
                    </p>
                    <div className="admin-2col-grid" style={{ marginBottom: 0 }}>
                      {participantPicks.map(pick => (
                        <div key={pick.id} style={{ padding: '0.65rem 0.85rem', background: surface, border: `1px solid ${border}`, borderRadius: 6 }}>
                          <p style={{ ...b, fontWeight: 600, fontSize: '0.8rem', color: text }}>{pick.games?.away_team} @ {pick.games?.home_team}</p>
                          <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.2rem' }}>
                            {pick.predicted_winner} · {pick.confidence_points} pts
                          </p>
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

      {/* Loading picks */}
      {isLoadingPicks && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <RefreshCw style={{ width: 16, height: 16, color: textDim, animation: 'spin 1s linear infinite' }} />
          <p style={{ ...b, fontSize: '0.8rem', color: textDim }}>Loading picks…</p>
        </div>
      )}

      {/* Add Pick Dialog */}
      <Dialog open={showAddPickDialog} onOpenChange={setShowAddPickDialog}>
        <DialogContent style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, maxWidth: 480 }}>
          <DialogHeader>
            <DialogTitle style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Add Pick for Participant
            </DialogTitle>
            <DialogDescription style={{ ...b, fontSize: '0.8rem', color: textDim }}>
              Submit a pick on behalf of a participant.
            </DialogDescription>
          </DialogHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '0.5rem' }}>
            <div>
              <Label style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', color: textMid, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>Participant</Label>
              <Select value={selectedParticipantForNewPick || selectedParticipantForManagement} onValueChange={setSelectedParticipantForNewPick}>
                <SelectTrigger style={{ background: surface, border: `1px solid ${border}`, color: text, ...b }}>
                  <SelectValue placeholder="Select a participant" />
                </SelectTrigger>
                <SelectContent>
                  {allParticipants.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name} ({p.email || 'No email'})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', color: textMid, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>Game</Label>
              <Select
                value={newPickData.gameId}
                onValueChange={(value) => {
                  const game = availableGames.find(g => g.id === value);
                  setNewPickData(prev => ({ ...prev, gameId: value, predictedWinner: game ? game.home_team : '' }));
                }}
              >
                <SelectTrigger style={{ background: surface, border: `1px solid ${border}`, color: text, ...b }}>
                  <SelectValue placeholder="Select a game" />
                </SelectTrigger>
                <SelectContent>
                  {availableGames.map(game => (
                    <SelectItem key={game.id} value={game.id}>{game.away_team} @ {game.home_team}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {newPickData.gameId && (
              <div>
                <Label style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', color: textMid, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>Predicted Winner</Label>
                <Select value={newPickData.predictedWinner} onValueChange={(value) => setNewPickData(prev => ({ ...prev, predictedWinner: value }))}>
                  <SelectTrigger style={{ background: surface, border: `1px solid ${border}`, color: text, ...b }}>
                    <SelectValue placeholder="Select winner" />
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const game = availableGames.find(g => g.id === newPickData.gameId);
                      return game ? (
                        <>
                          <SelectItem value={game.home_team}>{game.home_team}</SelectItem>
                          <SelectItem value={game.away_team}>{game.away_team}</SelectItem>
                        </>
                      ) : null;
                    })()}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', color: textMid, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>Confidence Points</Label>
              <input
                type="number" min="1" max="16"
                value={newPickData.confidencePoints}
                onChange={(e) => setNewPickData(prev => ({ ...prev, confidencePoints: parseInt(e.target.value) || 1 }))}
                style={{ background: surface, border: `1px solid ${border}`, color: text, padding: '0.5rem 0.75rem', width: '100%', borderRadius: 6, boxSizing: 'border-box', ...b, fontSize: '0.875rem' }}
              />
            </div>
          </div>
          <DialogFooter style={{ paddingTop: '0.5rem', display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowAddPickDialog(false)} style={{ padding: '0.5rem 0.9rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={submitNewPick} disabled={isSaving} style={{ padding: '0.5rem 0.9rem', background: isSaving ? textDim : green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: isSaving ? 'not-allowed' : 'pointer' }}>
              {isSaving ? 'Submitting…' : 'Submit Pick'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Monday Night Score Dialog */}
      <Dialog open={showMondayNightDialog} onOpenChange={setShowMondayNightDialog}>
        <DialogContent style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, maxWidth: 480 }}>
          <DialogHeader>
            <DialogTitle style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Monday Night Score
            </DialogTitle>
            <DialogDescription style={{ ...b, fontSize: '0.8rem', color: textDim }}>
              Set the Monday night game score prediction for {allParticipants.find(p => p.id === selectedParticipantForManagement)?.name}.
            </DialogDescription>
          </DialogHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '0.5rem' }}>
            {(() => {
              const info = getMondayNightGameInfo(availableGames);
              return info ? (
                <div style={{ padding: '0.85rem 1rem', background: surface, border: `1px solid ${border}`, borderRadius: 8 }}>
                  <p style={{ ...bc, fontWeight: 800, fontSize: '0.95rem', color: text }}>{info.displayText}</p>
                  <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.25rem' }}>
                    Kickoff: {new Date(info.game.kickoff_time).toLocaleString()}
                  </p>
                </div>
              ) : null;
            })()}
            <div>
              <Label style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', color: textMid, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>Score Prediction</Label>
              <input
                type="number" min="0" step="1" placeholder="e.g., 45"
                value={mondayNightScore}
                onChange={(e) => setMondayNightScore(e.target.value)}
                style={{ background: surface, border: `1px solid ${border}`, color: text, padding: '0.5rem 0.75rem', width: '100%', borderRadius: 6, boxSizing: 'border-box', ...b, fontSize: '0.875rem' }}
              />
            </div>
          </div>
          <DialogFooter style={{ paddingTop: '0.5rem', display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowMondayNightDialog(false)} style={{ padding: '0.5rem 0.9rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={submitMondayNightScore} disabled={isSaving} style={{ padding: '0.5rem 0.9rem', background: isSaving ? textDim : green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: isSaving ? 'not-allowed' : 'pointer' }}>
              {isSaving ? 'Saving…' : 'Save Score'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
