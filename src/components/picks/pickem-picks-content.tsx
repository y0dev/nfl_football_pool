'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { CheckCircle2, Lock, Target, Trophy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AppNav } from '@/components/layout/AppNav';
import { getUpcomingWeek } from '@/actions/loadCurrentWeek';
import { isGameLocked } from '@/lib/pickem-settings';
import { debugError } from '@/lib/utils';
import type { PickemWeekResult } from '@/lib/pickem';

const bg      = 'oklch(13% 0.025 255)';
const surface = 'oklch(17% 0.028 255)';
const card    = 'oklch(20% 0.03 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const gold    = 'oklch(74% 0.16 72)';
const amber   = 'oklch(72% 0.16 60)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

interface PoolInfo { id: string; name: string; season: number; }

export function PickemPicksContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const poolId = params.id as string;
  const router = useRouter();
  const { toast } = useToast();

  const [pool, setPool] = useState<PoolInfo | null>(null);
  const [week, setWeek] = useState<number | null>(null);
  const [seasonType, setSeasonType] = useState<number | null>(null);
  const [result, setResult] = useState<PickemWeekResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [selectedParticipantId, setSelectedParticipantId] = useState('');
  const [submittingGameId, setSubmittingGameId] = useState<string | null>(null);
  const [tiebreakerInput, setTiebreakerInput] = useState('');
  const [submittingTiebreaker, setSubmittingTiebreaker] = useState(false);

  // Resolve which week to show: explicit ?week=/?seasonType= params, else
  // the same "what's the NFL's current/upcoming week" logic every other
  // Picks page already uses — never a Pick'em-specific notion of "current".
  useEffect(() => {
    const resolveWeek = async () => {
      const weekParam = searchParams.get('week');
      const seasonTypeParam = searchParams.get('seasonType');
      if (weekParam && seasonTypeParam) {
        setWeek(parseInt(weekParam, 10));
        setSeasonType(parseInt(seasonTypeParam, 10));
        return;
      }
      try {
        const upcoming = await getUpcomingWeek();
        setWeek(upcoming.week);
        setSeasonType(upcoming.seasonType || 2);
      } catch (error) {
        debugError('Error resolving current week for Pick’em:', error);
        setWeek(1);
        setSeasonType(2);
      }
    };
    resolveWeek();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = useCallback(async () => {
    if (week == null || seasonType == null) return;
    try {
      const [poolRes, resultRes] = await Promise.all([
        fetch(`/api/pools/${poolId}`),
        fetch(`/api/pickem/week?poolId=${poolId}&week=${week}&seasonType=${seasonType}`),
      ]);
      const poolData = await poolRes.json();
      const resultData = await resultRes.json();
      if (poolData?.pool) setPool({ id: poolData.pool.id, name: poolData.pool.name, season: poolData.pool.season });
      if (resultData?.success) setResult(resultData.result);
      else toast({ title: 'Error', description: resultData?.error ?? "Failed to load Pick'em pool.", variant: 'destructive' });
    } catch (error) {
      debugError("Error loading Pick'em picks data:", error);
      toast({ title: 'Error', description: "Failed to load Pick'em pool.", variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [poolId, week, seasonType, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  // No AuthProvider on this route (participant-facing, like the Survivor and
  // Confidence Picks pages it sits alongside) — resolve admin status the
  // same way those do: read localStorage directly, verify server-side.
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const storedUser = typeof window !== 'undefined' ? localStorage.getItem('nfl-pool-user') : null;
        const localUser: { id?: string } | null = storedUser ? JSON.parse(storedUser) : null;
        if (!localUser?.id) return;
        const res = await fetch(`/api/admin/verify-status?adminId=${localUser.id}`);
        const data = await res.json();
        if (data.success && data.isAdmin) {
          setIsAdmin(true);
          setIsSuperAdmin(!!data.isSuperAdmin);
        }
      } catch (error) {
        debugError('Error checking admin status:', error);
      }
    };
    checkAdminStatus();
  }, []);

  const handleLogout = async () => {
    try {
      const { getSupabaseClient } = await import('@/lib/supabase');
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
      router.push('/admin/login');
    } catch (error) {
      debugError('Error logging out:', error);
    }
  };

  const myWeek = result?.participants.find(p => p.participantId === selectedParticipantId) ?? null;
  const now = new Date();

  useEffect(() => {
    if (myWeek) setTiebreakerInput(myWeek.tiebreakerPrediction != null ? String(myWeek.tiebreakerPrediction) : '');
  }, [myWeek?.participantId, myWeek?.tiebreakerPrediction]);

  const handlePick = async (gameId: string, team: string) => {
    if (!selectedParticipantId) {
      toast({ title: 'Select yourself first', description: 'Choose your name before picking a team.', variant: 'destructive' });
      return;
    }
    setSubmittingGameId(gameId);
    try {
      const res = await fetch('/api/pickem/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: selectedParticipantId, poolId, gameId, selectedTeam: team }),
      });
      const data = await res.json();
      if (data.success) {
        await loadData();
      } else {
        toast({ title: 'Pick Rejected', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      debugError("Error submitting Pick'em pick:", error);
      toast({ title: 'Error', description: 'Failed to submit pick. Please try again.', variant: 'destructive' });
    } finally {
      setSubmittingGameId(null);
    }
  };

  const handleTiebreakerSubmit = async () => {
    if (!selectedParticipantId || !week || !seasonType) return;
    const predictedTotal = parseInt(tiebreakerInput, 10);
    if (!Number.isFinite(predictedTotal) || predictedTotal < 0) {
      toast({ title: 'Invalid prediction', description: 'Enter a valid combined score.', variant: 'destructive' });
      return;
    }
    setSubmittingTiebreaker(true);
    try {
      const res = await fetch('/api/pickem/submit-tiebreaker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: selectedParticipantId, poolId, week, seasonType, predictedTotal }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Tiebreaker Saved' });
        await loadData();
      } else {
        toast({ title: 'Tiebreaker Rejected', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      debugError("Error submitting Pick'em tiebreaker:", error);
      toast({ title: 'Error', description: 'Failed to submit tiebreaker. Please try again.', variant: 'destructive' });
    } finally {
      setSubmittingTiebreaker(false);
    }
  };

  if (isLoading || week == null) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
        <div className="animate-spin rounded-full h-16 w-16" style={{ borderWidth: '3px', borderStyle: 'solid', borderColor: border, borderTopColor: green }} />
      </div>
    );
  }

  const tiebreakerGame = result?.tiebreakerGame;

  return (
    <div style={{ background: bg, minHeight: '100vh' }}>
      <AppNav isAuthenticated={isAdmin} isSuperAdmin={isSuperAdmin} onSignOut={handleLogout} poolId={poolId} />

      <section style={{ background: bg, padding: 'clamp(2rem, 5vw, 3rem) 0 1.5rem' }}>
        <div className="lp-inner">
          <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.26em', color: gold, textTransform: 'uppercase', marginBottom: '0.6rem' }}>
            Pick&apos;em Pool
          </p>
          <h1 style={{ ...bc, fontWeight: 900, fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', lineHeight: 1, color: text, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            {pool?.name ?? 'Loading…'}
          </h1>
          <p style={{ ...b, fontSize: '0.9rem', color: textMid }}>
            Week {week} — Pick the winner of every game.
          </p>
        </div>
      </section>

      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${green}, transparent)` }} />

      <section style={{ background: surface, padding: '2rem 0' }}>
        <div className="lp-inner" style={{ maxWidth: 640 }}>
          <label style={{ ...bc, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>
            Who&apos;s picking?
          </label>
          <select
            value={selectedParticipantId}
            onChange={(e) => setSelectedParticipantId(e.target.value)}
            style={{ width: '100%', padding: '0.65rem 0.85rem', background: card, border: `1px solid ${border}`, borderRadius: 6, color: text, ...b, fontSize: '0.95rem' }}
          >
            <option value="">Select your name…</option>
            {result?.participants.map(p => (
              <option key={p.participantId} value={p.participantId}>{p.participantName}</option>
            ))}
          </select>
        </div>
      </section>

      {myWeek && result && (
        <section style={{ background: bg, padding: '2rem 0' }}>
          <div className="lp-inner" style={{ maxWidth: 640 }}>
            {!myWeek.isComplete && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: `${amber}14`, border: `1px solid ${amber}44`, borderRadius: 8, padding: '0.85rem 1.25rem', marginBottom: '1.25rem' }}>
                <Target style={{ width: 18, height: 18, color: amber, flexShrink: 0 }} />
                <p style={{ ...b, fontSize: '0.85rem', color: amber }}>Please make a pick for all games.</p>
              </div>
            )}

            <h2 style={{ ...bc, fontWeight: 800, fontSize: '1.1rem', color: text, textTransform: 'uppercase', marginBottom: '1.25rem' }}>
              Weekly Picks
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: tiebreakerGame ? '2rem' : 0 }}>
              {result.eligibleGames.map(game => {
                const locked = isGameLocked({ kickoff_time: game.kickoffTime, status: game.status }, now);
                const pickForGame = myWeek.picks.find(p => p.gameId === game.id);
                const selectedTeam = pickForGame?.selectedTeam || null;
                const isSubmittingThis = submittingGameId === game.id;
                return (
                  <div key={game.id} style={{ background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '1rem 1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                      <p style={{ ...b, fontSize: '0.72rem', color: textDim }}>
                        {format(new Date(game.kickoffTime), 'EEE, MMM d · h:mm a')}
                      </p>
                      {locked && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', ...bc, fontSize: '0.62rem', fontWeight: 700, color: textDim, textTransform: 'uppercase' }}>
                          <Lock style={{ width: 10, height: 10 }} /> Locked
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                      {[
                        { team: game.awayTeamId, name: game.awayTeam },
                        { team: game.homeTeamId, name: game.homeTeam },
                      ].map(({ team, name }) => {
                        if (!team) return null;
                        const picked = selectedTeam === team;
                        const disabled = locked || (submittingGameId != null);
                        return (
                          <button
                            key={team}
                            type="button"
                            disabled={disabled}
                            onClick={() => handlePick(game.id, team)}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                              padding: '0.85rem 0.5rem', borderRadius: 6, minHeight: 44,
                              background: picked ? green : surface,
                              border: `1px solid ${picked ? green : border}`,
                              color: picked ? text : locked ? textDim : text,
                              opacity: locked && !picked ? 0.55 : 1,
                              cursor: disabled ? 'not-allowed' : 'pointer',
                              ...bc, fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase',
                            }}
                          >
                            {picked && <CheckCircle2 style={{ width: 14, height: 14 }} />}
                            {isSubmittingThis ? 'Saving…' : name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {tiebreakerGame && (
              <div style={{ background: card, border: `1px solid ${gold}44`, borderRadius: 8, padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <Trophy style={{ width: 15, height: 15, color: gold }} />
                  <p style={{ ...bc, fontWeight: 800, fontSize: '0.85rem', color: gold, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Weekly Tiebreaker
                  </p>
                </div>
                <p style={{ ...b, fontSize: '0.82rem', color: textMid, marginBottom: '0.15rem' }}>
                  {tiebreakerGame.awayTeam} @ {tiebreakerGame.homeTeam}
                </p>
                <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginBottom: '1rem' }}>
                  Used only to break ties between participants with the same number of correct picks.
                </p>
                <label style={{ ...bc, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
                  Predict total combined score
                </label>
                {isGameLocked({ kickoff_time: tiebreakerGame.kickoffTime, status: null }, now) ? (
                  <p style={{ ...b, fontSize: '0.85rem', color: textMid }}>
                    {myWeek.tiebreakerPrediction != null ? `Your prediction: ${myWeek.tiebreakerPrediction}` : 'This game has started — no prediction was submitted.'}
                  </p>
                ) : (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="number"
                      min={0}
                      value={tiebreakerInput}
                      onChange={(e) => setTiebreakerInput(e.target.value)}
                      placeholder="47"
                      style={{ flex: 1, padding: '0.6rem 0.75rem', background: surface, border: `1px solid ${border}`, borderRadius: 6, color: text, ...b, fontSize: '0.95rem' }}
                    />
                    <button
                      type="button"
                      disabled={submittingTiebreaker || !selectedParticipantId}
                      onClick={handleTiebreakerSubmit}
                      style={{ padding: '0.6rem 1.1rem', background: gold, color: 'oklch(15% 0.02 72)', border: 'none', borderRadius: 6, cursor: submittingTiebreaker ? 'not-allowed' : 'pointer', ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}
                    >
                      {submittingTiebreaker ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
