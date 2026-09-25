'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ShieldOff, RefreshCw, Zap, AlertTriangle, Check, X } from 'lucide-react';
import { useAuth, AuthProvider } from '@/lib/auth';
import { AdminGuard } from '@/components/auth/admin-guard';
import { AppNav } from '@/components/layout/AppNav';
import { Footer } from '@/components/layout/Footer';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { loadPool } from '@/actions/loadPools';
import { loadCurrentWeek } from '@/actions/loadCurrentWeek';
import { PERIOD_WEEKS, SEASON_TYPE_OPTIONS, debugError } from '@/lib/utils';
import { normalizeGameStatus } from '@/types/game';
import type { OverrideEligibility } from '@/lib/season-status';

// Design tokens (matches app-wide dark theme / override-picks-panel.tsx)
const bg      = 'oklch(13% 0.025 255)';
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

interface PoolRecord {
  id: string;
  name: string;
  created_by: string;
  season: number;
  season_scope?: number[];
  huddle_id?: string | null;
}

interface ParticipantRecord {
  id: string;
  name: string;
  email: string | null;
}

interface GameRow {
  id: string;
  home_team: string;
  away_team: string;
  week: number;
  season: number;
  season_type: number;
  kickoff_time: string;
  status: string;
  winner?: string | null;
  home_score?: number | null;
  away_score?: number | null;
}

interface ExistingPick {
  id: string;
  participant_id: string;
  game_id: string;
  predicted_winner: string;
  confidence_points: number;
}

interface PickForm {
  winner: string | null;
  points: number | null;
}

function actualWinner(game: GameRow): string | null {
  if (game.winner) return game.winner;
  if (game.home_score != null && game.away_score != null) {
    if (game.home_score > game.away_score) return game.home_team;
    if (game.away_score > game.home_score) return game.away_team;
  }
  return null;
}

function OverridePicksPageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const poolId = params.id as string;
  const participantId = params.participantId as string;
  const { user, signOut, verifyAdminStatus } = useAuth();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [pool, setPool] = useState<PoolRecord | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [isSuperAdminViewer, setIsSuperAdminViewer] = useState(false);
  const [participant, setParticipant] = useState<ParticipantRecord | null>(null);

  const seasonTypes = useMemo(() => {
    const scope = pool?.season_scope && pool.season_scope.length > 0 ? pool.season_scope : [1, 2, 3];
    const allowed = SEASON_TYPE_OPTIONS.filter(t => scope.includes(t.value));
    return allowed.length > 0 ? allowed : SEASON_TYPE_OPTIONS.filter(t => t.value === 2);
  }, [pool?.season_scope]);

  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [selectedSeasonType, setSelectedSeasonType] = useState<number | null>(null);
  const weeks = useMemo(() => {
    const type = seasonTypes.find(t => t.value === selectedSeasonType) ?? seasonTypes[0];
    const count = type?.weeks ?? 18;
    return Array.from({ length: count }, (_, i) => i + 1);
  }, [selectedSeasonType, seasonTypes]);

  const [games, setGames] = useState<GameRow[]>([]);
  const [isLoadingGames, setIsLoadingGames] = useState(false);
  const [eligibility, setEligibility] = useState<OverrideEligibility | null>(null);
  const [form, setForm] = useState<Record<string, PickForm>>({});
  const [initialPickGameIds, setInitialPickGameIds] = useState<Set<string>>(new Set());
  const [reduceConfidence, setReduceConfidence] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [now, setNow] = useState<Date>(new Date());

  // ── Auth + pool + participant load ──
  useEffect(() => {
    const init = async () => {
      if (!user?.email || !poolId || !participantId) return;
      try {
        const [poolData, isSuperAdmin] = await Promise.all([
          loadPool(poolId),
          verifyAdminStatus(true),
        ]);
        setIsSuperAdminViewer(isSuperAdmin);
        if (!poolData) { setPool(null); return; }
        setPool(poolData as PoolRecord);
        setAuthorized(isSuperAdmin || poolData.created_by === user.email);

        const partRes = await fetch(`/api/admin/pool-participants?poolId=${poolId}`);
        const partData = await partRes.json();
        if (partRes.ok && partData.success) {
          const found = (partData.participants ?? []).find((p: ParticipantRecord) => p.id === participantId) ?? null;
          setParticipant(found);
        }

        const weekParam = searchParams.get('week');
        const seasonTypeParam = searchParams.get('seasonType');
        if (weekParam && seasonTypeParam) {
          setSelectedWeek(parseInt(weekParam, 10));
          setSelectedSeasonType(parseInt(seasonTypeParam, 10));
        } else {
          const current = await loadCurrentWeek();
          setSelectedWeek(current.week_number);
          setSelectedSeasonType(current.season_type ?? 2);
        }
      } catch (error) {
        debugError('Failed to load override-picks page:', error);
      } finally {
        setIsLoading(false);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolId, participantId, user?.email]);

  const loadData = useCallback(async (week: number, seasonType: number) => {
    if (!pool) return;
    setIsLoadingGames(true);
    try {
      const [dataRes, eligRes] = await Promise.all([
        fetch(`/api/admin/override-picks/data?poolId=${poolId}&week=${week}&season=${pool.season}&seasonType=${seasonType}`, {
          headers: { 'x-admin-email': user?.email ?? '' },
        }),
        fetch(`/api/admin/override-eligibility?poolId=${poolId}&week=${week}&seasonType=${seasonType}`),
      ]);
      const data = await dataRes.json();
      const elig = await eligRes.json();
      setEligibility(elig.success ? { allowed: elig.allowed, reason: elig.reason } : { allowed: true });

      if (!dataRes.ok || !data.success) throw new Error(data.error || 'Failed to load games');
      const loadedGames: GameRow[] = (data.games ?? []).slice().sort(
        (a: GameRow, b: GameRow) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime()
      );
      setGames(loadedGames);

      const participantPicks: ExistingPick[] = (data.picks ?? []).filter((p: ExistingPick) => p.participant_id === participantId);
      const nextForm: Record<string, PickForm> = {};
      const nextInitial = new Set<string>();
      for (const g of loadedGames) {
        const existing = participantPicks.find(p => p.game_id === g.id);
        if (existing) {
          nextForm[g.id] = { winner: existing.predicted_winner, points: existing.confidence_points };
          nextInitial.add(g.id);
        } else {
          nextForm[g.id] = { winner: null, points: null };
        }
      }
      setForm(nextForm);
      setInitialPickGameIds(nextInitial);
      setNow(new Date());
    } catch (error) {
      debugError('Failed to load override-picks data:', error);
      toast({ title: 'Error', description: 'Failed to load games and picks for this week.', variant: 'destructive' });
    } finally {
      setIsLoadingGames(false);
    }
  }, [poolId, pool, participantId, user?.email, toast]);

  useEffect(() => {
    if (selectedWeek != null && selectedSeasonType != null && pool) {
      loadData(selectedWeek, selectedSeasonType);
      router.replace(`/league/pool/${poolId}/override-picks/${participantId}?week=${selectedWeek}&seasonType=${selectedSeasonType}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeek, selectedSeasonType, pool]);

  const totalGames = games.length;
  const startedGames = useMemo(
    () => games.filter(g => new Date(g.kickoff_time) <= now || normalizeGameStatus(g.status) !== 'scheduled'),
    [games, now]
  );
  const maxConfidence = reduceConfidence
    ? Math.max(1, totalGames - startedGames.length)
    : totalGames;

  // Clamp out-of-range confidence selections when the reduced ceiling shrinks.
  useEffect(() => {
    setForm(prev => {
      let changed = false;
      const next = { ...prev };
      for (const [gid, v] of Object.entries(next)) {
        if (v.points != null && v.points > maxConfidence) {
          next[gid] = { ...v, points: null };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [maxConfidence]);

  const usedPoints = useMemo(() => {
    const s = new Set<number>();
    for (const v of Object.values(form)) {
      if (v.points != null) s.add(v.points);
    }
    return s;
  }, [form]);

  const setWinner = (gameId: string, winner: string | null) => {
    setForm(prev => ({ ...prev, [gameId]: { winner, points: winner ? prev[gameId]?.points ?? null : null } }));
  };
  const setPoints = (gameId: string, points: number | null) => {
    setForm(prev => ({ ...prev, [gameId]: { ...prev[gameId], points } }));
  };

  const handleAutoPick = () => {
    const needsAutoPick = startedGames.filter(g => !form[g.id]?.winner);
    if (needsAutoPick.length === 0) {
      toast({ title: 'Nothing to auto-pick', description: 'Every already-started game already has a pick.' });
      return;
    }
    setForm(prev => {
      const next = { ...prev };
      const used = new Set(Object.values(next).map(v => v.points).filter((p): p is number => p != null));
      let candidate = 1;
      for (const g of needsAutoPick) {
        while (used.has(candidate) && candidate <= maxConfidence) candidate++;
        const points = candidate <= maxConfidence ? candidate : null;
        if (points != null) used.add(points);
        const winner = actualWinner(g) ?? g.home_team;
        next[g.id] = { winner, points };
      }
      return next;
    });
    toast({ title: 'Auto-picked', description: `Filled in ${needsAutoPick.length} started game${needsAutoPick.length !== 1 ? 's' : ''} with the lowest available confidence points. Review before saving.` });
  };

  const handleSubmit = async () => {
    if (!overrideReason.trim()) {
      toast({ title: 'Error', description: 'A reason for this override is required.', variant: 'destructive' });
      return;
    }
    const weekPicks = games
      .filter(g => form[g.id]?.winner && form[g.id]?.points != null)
      .map(g => ({ gameId: g.id, predictedWinner: form[g.id].winner as string, confidencePoints: form[g.id].points as number }));
    const clearGameIds = games
      .filter(g => initialPickGameIds.has(g.id) && !form[g.id]?.winner)
      .map(g => g.id);

    const missingPoints = games.filter(g => form[g.id]?.winner && form[g.id]?.points == null);
    if (missingPoints.length > 0) {
      toast({ title: 'Error', description: 'Every game with a winner selected also needs confidence points.', variant: 'destructive' });
      return;
    }
    const pointValues = weekPicks.map(p => p.confidencePoints);
    if (new Set(pointValues).size !== pointValues.length) {
      toast({ title: 'Error', description: 'Confidence points must be unique.', variant: 'destructive' });
      return;
    }
    if (weekPicks.length === 0 && clearGameIds.length === 0) {
      toast({ title: 'Nothing to save', description: 'No picks were changed.' });
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/override-picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poolId, participantId,
          week: selectedWeek, seasonType: selectedSeasonType,
          overrideMode: 'week',
          overrideReason: overrideReason.trim(),
          weekPicks, clearGameIds, reduceConfidence,
        }),
      });
      const result = await res.json();
      if (!result.success) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Success', description: result.message });
      setOverrideReason('');
      if (selectedWeek != null && selectedSeasonType != null) await loadData(selectedWeek, selectedSeasonType);
    } catch {
      toast({ title: 'Error', description: 'Failed to save picks.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const backTarget = `/league/pool/${poolId}`;

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
        <div className="animate-spin rounded-full h-16 w-16" style={{ borderWidth: '3px', borderStyle: 'solid', borderColor: border, borderTopColor: green }} />
      </div>
    );
  }

  if (!pool || !authorized || !participant) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg, padding: '2rem' }}>
        <div style={{ textAlign: 'center' }}>
          <ShieldOff style={{ width: 32, height: 32, color: textDim, margin: '0 auto 0.75rem' }} />
          <p style={{ ...bc, fontWeight: 700, fontSize: '1rem', color: textMid, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {!pool ? 'Pool not found' : !authorized ? "You don't have access to this pool" : 'Participant not found'}
          </p>
          <button
            onClick={() => router.push(backTarget)}
            style={{ marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 1rem', background: green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
          >
            <ArrowLeft style={{ width: 12, height: 12 }} /> Back to Pool
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: bg, minHeight: '100vh' }}>
      <AppNav
        isAuthenticated
        isSuperAdmin={isSuperAdminViewer}
        onSignOut={async () => { try { await signOut(); router.push('/login'); } catch { /* ignore */ } }}
        poolId={poolId}
        extraSections={[{ label: pool.name, links: [{ label: 'Back to Pool', href: backTarget }] }]}
      />

      <section style={{ background: bg, padding: '2.5rem 0 3rem' }}>
        <div className="lp-inner" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          <button
            onClick={() => router.push(backTarget)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'transparent', border: 'none', color: textMid, cursor: 'pointer', ...bc, fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase', width: 'fit-content' }}
          >
            <ArrowLeft style={{ width: 13, height: 13 }} /> Back to {pool.name}
          </button>

          <div>
            <p style={{ ...bc, fontWeight: 900, fontSize: '1.4rem', color: text, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Override Picks — {participant.name}
            </p>
            <p style={{ ...b, fontSize: '0.85rem', color: textDim, marginTop: '0.2rem' }}>
              {participant.email || 'No email on file'}
            </p>
          </div>

          {/* Week / Season Type selectors */}
          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1.5rem' }}>
            <div className="admin-3col-grid" style={{ marginBottom: 0 }}>
              <div>
                <label style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', color: textMid, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>Week</label>
                <Select value={selectedWeek?.toString() ?? ''} onValueChange={(v) => setSelectedWeek(parseInt(v, 10))}>
                  <SelectTrigger style={{ background: surface, border: `1px solid ${border}`, color: text, ...b }}>
                    <SelectValue placeholder="Select a week" />
                  </SelectTrigger>
                  <SelectContent>
                    {weeks.map((week) => {
                      const isTieBreaker = PERIOD_WEEKS.includes(week as typeof PERIOD_WEEKS[number]);
                      return (
                        <SelectItem key={week} value={week.toString()}>
                          Week {week}{isTieBreaker ? ' (Tie-breaker)' : ''}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', color: textMid, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>Season Type</label>
                <Select value={selectedSeasonType?.toString() ?? ''} onValueChange={(v) => { setSelectedSeasonType(parseInt(v, 10)); setSelectedWeek(1); }}>
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

          {eligibility?.allowed === false && (
            <div style={{ background: card, border: `1px solid oklch(50% 0.18 60 / 0.4)`, borderLeft: `3px solid ${amber}`, borderRadius: 10, padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <AlertTriangle style={{ width: 16, height: 16, color: amber, flexShrink: 0 }} />
              <p style={{ ...b, fontSize: '0.85rem', color: text }}>{eligibility.reason}</p>
            </div>
          )}

          {/* Auto-pick + reduce confidence controls */}
          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <p style={{ ...bc, fontWeight: 800, fontSize: '0.88rem', color: text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Missed-deadline tools
                </p>
                <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginTop: '0.2rem' }}>
                  {startedGames.length} of {totalGames} game{totalGames !== 1 ? 's' : ''} already started this week.
                </p>
              </div>
              <button
                onClick={handleAutoPick}
                disabled={eligibility?.allowed === false || startedGames.length === 0}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem', background: (eligibility?.allowed === false || startedGames.length === 0) ? textDim : greenHi, color: bg, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: (eligibility?.allowed === false || startedGames.length === 0) ? 'not-allowed' : 'pointer' }}
              >
                <Zap style={{ width: 13, height: 13 }} />
                Auto-pick started games
              </button>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={reduceConfidence}
                onChange={(e) => setReduceConfidence(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: green, cursor: 'pointer' }}
              />
              <span style={{ ...b, fontSize: '0.82rem', color: text }}>
                Reduce available confidence points for missed games
              </span>
            </label>
            <p style={{ ...b, fontSize: '0.75rem', color: textDim, paddingLeft: '1.6rem' }}>
              {reduceConfidence
                ? `Max confidence point available is now ${maxConfidence} (${totalGames} games − ${startedGames.length} already started).`
                : `Full range is available (1–${totalGames}), same as picking before any games started.`}
            </p>
          </div>

          {/* Loading */}
          {isLoadingGames && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <RefreshCw style={{ width: 16, height: 16, color: textDim, animation: 'spin 1s linear infinite' }} />
              <p style={{ ...b, fontSize: '0.8rem', color: textDim }}>Loading games…</p>
            </div>
          )}

          {/* Games list */}
          {!isLoadingGames && games.length === 0 && (
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '2rem', textAlign: 'center' }}>
              <p style={{ ...b, fontSize: '0.85rem', color: textDim }}>No games found for this week.</p>
            </div>
          )}

          {!isLoadingGames && games.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {games.map((g) => {
                const started = new Date(g.kickoff_time) <= now || normalizeGameStatus(g.status) !== 'scheduled';
                const entry = form[g.id] ?? { winner: null, points: null };
                const pointOptions = Array.from({ length: maxConfidence }, (_, i) => i + 1)
                  .filter(p => !usedPoints.has(p) || entry.points === p);
                return (
                  <div key={g.id} style={{ background: card, border: `1px solid ${border}`, borderLeft: started ? `3px solid ${amber}` : `3px solid ${border}`, borderRadius: 10, padding: '1.1rem 1.25rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ minWidth: 200, flex: '1 1 200px' }}>
                      <p style={{ ...bc, fontWeight: 800, fontSize: '0.95rem', color: text }}>{g.away_team} @ {g.home_team}</p>
                      <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.2rem' }}>
                        {new Date(g.kickoff_time).toLocaleString()} {started && <span style={{ color: amber }}>· Started</span>}
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {[g.away_team, g.home_team].map(team => (
                        <button
                          key={team}
                          onClick={() => setWinner(g.id, entry.winner === team ? null : team)}
                          disabled={eligibility?.allowed === false}
                          style={{
                            padding: '0.4rem 0.75rem', borderRadius: 6, cursor: eligibility?.allowed === false ? 'not-allowed' : 'pointer',
                            border: `1px solid ${entry.winner === team ? greenHi : border}`,
                            background: entry.winner === team ? 'oklch(59% 0.15 155 / 0.15)' : surface,
                            color: entry.winner === team ? greenHi : textMid,
                            ...bc, fontWeight: 700, fontSize: '0.75rem',
                          }}
                        >
                          {entry.winner === team && <Check style={{ width: 11, height: 11, display: 'inline', marginRight: '0.25rem', verticalAlign: -1 }} />}
                          {team}
                        </button>
                      ))}
                    </div>

                    <div style={{ width: 150 }}>
                      <Select
                        value={entry.points != null ? entry.points.toString() : ''}
                        onValueChange={(v) => setPoints(g.id, parseInt(v, 10))}
                        disabled={!entry.winner || eligibility?.allowed === false}
                      >
                        <SelectTrigger style={{ background: surface, border: `1px solid ${border}`, color: text, ...b, fontSize: '0.8rem' }}>
                          <SelectValue placeholder="Points" />
                        </SelectTrigger>
                        <SelectContent>
                          {pointOptions.map(p => (
                            <SelectItem key={p} value={p.toString()}>{p} pt{p !== 1 ? 's' : ''}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {entry.winner && (
                      <button
                        onClick={() => setWinner(g.id, null)}
                        title="Clear this pick"
                        style={{ background: 'transparent', border: 'none', color: textDim, cursor: 'pointer', padding: '0.25rem' }}
                      >
                        <X style={{ width: 15, height: 15 }} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Reason + submit */}
          {games.length > 0 && (
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <Label style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', color: textMid, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>Reason for Override</Label>
                <Input
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g., Participant missed the deadline, picking on their behalf"
                  style={{ background: surface, border: `1px solid ${border}`, color: text, ...b, fontSize: '0.875rem' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={handleSubmit}
                  disabled={isSaving || eligibility?.allowed === false}
                  style={{ padding: '0.6rem 1.1rem', background: (isSaving || eligibility?.allowed === false) ? textDim : green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: (isSaving || eligibility?.allowed === false) ? 'not-allowed' : 'pointer' }}
                >
                  {isSaving ? 'Saving…' : 'Save Picks'}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <Footer pageName={`${pool.name} — Override Picks`} />
    </div>
  );
}

export default function OverridePicksPage() {
  return (
    <AuthProvider>
      <AdminGuard>
        <OverridePicksPageContent />
      </AdminGuard>
    </AuthProvider>
  );
}
