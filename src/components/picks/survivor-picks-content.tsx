'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Trophy, Skull, ShieldCheck, Lock, CheckCircle2, Check, X as XIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AppNav } from '@/components/layout/AppNav';
import { TeamLogo } from '@/components/ui/team-logo';
import { computeWeekUnlockStatus } from '@/lib/week-unlock-status';
import { getTeam, getTeamAbbreviation, debugError } from '@/lib/utils';
import { normalizeGameStatus } from '@/types/game';
import type { SurvivorPoolState, SurvivorCurrentWeekGame } from '@/lib/survivor';

const bg      = 'oklch(13% 0.025 255)';
const surface = 'oklch(17% 0.028 255)';
const card    = 'oklch(20% 0.03 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const gold    = 'oklch(74% 0.16 72)';
const red     = 'oklch(62% 0.22 25)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

// Locked/finished current-week game: replaces the plain "this week is
// locked" sentence with the actual result once available — teams, logos,
// score, and (for the game this participant picked) survived/eliminated —
// no separate "Game Details" disclosure needed once the result IS the detail.
function LockedSurvivorGameRow({
  game,
  pickedTeam,
}: {
  game: SurvivorCurrentWeekGame;
  pickedTeam: string | undefined;
}) {
  const normalized = normalizeGameStatus(game.status);
  const isFinished = normalized === 'finished';
  const isLive = normalized === 'live';
  const awayTeam = getTeam(getTeamAbbreviation(game.awayTeam));
  const homeTeam = getTeam(getTeamAbbreviation(game.homeTeam));
  const showScores = (isFinished || isLive) && game.homeScore != null && game.awayScore != null;
  const pickedThisGame = pickedTeam === game.homeTeamId || pickedTeam === game.awayTeamId;

  let outcome: 'survived' | 'eliminated' | null = null;
  if (isFinished && pickedThisGame && game.homeScore != null && game.awayScore != null) {
    if (game.homeScore === game.awayScore) outcome = 'eliminated'; // a tie is a loss, same as StatusBanner's "tied" reason
    else {
      const winnerId = game.homeScore > game.awayScore ? game.homeTeamId : game.awayTeamId;
      outcome = winnerId === pickedTeam ? 'survived' : 'eliminated';
    }
  }

  return (
    <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '1rem 1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        {isFinished ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', ...bc, fontSize: '0.65rem', fontWeight: 700, color: gold, textTransform: 'uppercase' }}>
            <Trophy style={{ width: 11, height: 11 }} /> Final
          </span>
        ) : isLive ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', ...bc, fontSize: '0.65rem', fontWeight: 700, color: red, textTransform: 'uppercase' }}>
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: red, animation: 'pulse 1.4s ease-in-out infinite' }} /> Live
          </span>
        ) : (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', ...bc, fontSize: '0.62rem', fontWeight: 700, color: textDim, textTransform: 'uppercase' }}>
            <Lock style={{ width: 10, height: 10 }} /> Locked
          </span>
        )}
        <p style={{ ...b, fontSize: '0.72rem', color: textDim }}>
          {format(new Date(game.kickoffTime), 'EEE, MMM d · h:mm a')}
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {[
          { fullName: game.awayTeam, teamId: game.awayTeamId, team: awayTeam, score: game.awayScore },
          { fullName: game.homeTeam, teamId: game.homeTeamId, team: homeTeam, score: game.homeScore },
        ].map(({ fullName, teamId, team, score }) => {
          const isSelected = pickedTeam != null && pickedTeam === teamId;
          return (
            <div key={fullName} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', padding: '0.5rem', borderRadius: 8, background: isSelected ? 'oklch(46% 0.14 155 / 0.1)' : 'transparent', outline: isSelected ? '1px solid oklch(46% 0.14 155 / 0.3)' : 'none' }}>
              <TeamLogo team={team} size="md" colorAccent />
              <span style={{ ...bc, fontWeight: 700, fontSize: '0.82rem', color: isSelected ? text : textMid, textAlign: 'center' }}>
                {team.city}
              </span>
              {showScores && (
                <span style={{ ...bc, fontWeight: 900, fontSize: '1.1rem', color: text }}>
                  {score}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {pickedThisGame && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', marginTop: '0.75rem', paddingTop: '0.6rem', borderTop: `1px solid ${border}` }}>
          <span style={{ ...b, fontSize: '0.78rem', color: textMid }}>
            Your pick: <strong style={{ color: text }}>{getTeam(pickedTeam!).city}</strong>
          </span>
          {outcome === 'survived' && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', ...bc, fontSize: '0.68rem', fontWeight: 700, color: greenHi, textTransform: 'uppercase' }}>
              <Check style={{ width: 12, height: 12 }} /> Survived
            </span>
          )}
          {outcome === 'eliminated' && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', ...bc, fontSize: '0.68rem', fontWeight: 700, color: red, textTransform: 'uppercase' }}>
              <XIcon style={{ width: 12, height: 12 }} /> Eliminated
            </span>
          )}
        </div>
      )}
    </div>
  );
}

interface PoolInfo {
  id: string;
  name: string;
  season: number;
}

export function SurvivorPicksContent() {
  const params = useParams();
  const poolId = params.id as string;
  const router = useRouter();
  const { toast } = useToast();

  const [pool, setPool] = useState<PoolInfo | null>(null);
  const [state, setState] = useState<SurvivorPoolState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [selectedParticipantId, setSelectedParticipantId] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [poolRes, stateRes] = await Promise.all([
        fetch(`/api/pools/${poolId}`),
        fetch(`/api/survivor/state?poolId=${poolId}`),
      ]);
      const poolData = await poolRes.json();
      const stateData = await stateRes.json();
      if (poolData?.pool) setPool({ id: poolData.pool.id, name: poolData.pool.name, season: poolData.pool.season });
      if (stateData?.success) setState(stateData.state);
      else toast({ title: 'Error', description: stateData?.error ?? 'Failed to load Survivor pool.', variant: 'destructive' });
    } catch (error) {
      debugError('Error loading Survivor picks data:', error);
      toast({ title: 'Error', description: 'Failed to load Survivor pool.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [poolId, toast]);

  useEffect(() => {
    if (poolId) loadData();
  }, [poolId, loadData]);

  // This route has no AuthProvider (participant-facing, like the
  // Confidence Picks page it sits alongside) — resolve admin/super-admin
  // status the same way pool-picks-content.tsx does: read the localStorage
  // session record directly and verify it server-side, rather than reading
  // a React auth context that doesn't exist here.
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

  const myState = state?.participants.find(p => p.participantId === selectedParticipantId) ?? null;
  const currentWeekGames: SurvivorCurrentWeekGame[] = state?.currentWeekGames ?? [];
  const weekUnlocked = currentWeekGames.length > 0 && state?.currentWeek
    ? computeWeekUnlockStatus(
        currentWeekGames.map(g => ({ kickoff_time: g.kickoffTime, status: g.status ?? undefined })),
        state.currentWeek.week,
        state.currentWeek.seasonType,
        null
      )
    : false;

  const myUsedTeams = new Set(myState?.usedTeams ?? []);
  const myCurrentWeekPick = myState?.picks.find(p => state?.currentWeek && p.week === state.currentWeek.week && p.seasonType === state.currentWeek.seasonType);

  const handleSubmit = async (gameId: string, team: string) => {
    if (!selectedParticipantId) {
      toast({ title: 'Select yourself first', description: 'Choose your name before picking a team.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    setSelectedTeam(team);
    try {
      const res = await fetch('/api/survivor/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: selectedParticipantId, poolId, gameId, selectedTeam: team }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Pick Submitted', description: `You picked ${team} for Week ${state?.currentWeek?.week}.` });
        await loadData();
      } else {
        toast({ title: 'Pick Rejected', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      debugError('Error submitting Survivor pick:', error);
      toast({ title: 'Error', description: 'Failed to submit pick. Please try again.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
      setSelectedTeam(null);
    }
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
        <div className="animate-spin rounded-full h-16 w-16" style={{ borderWidth: '3px', borderStyle: 'solid', borderColor: border, borderTopColor: green }} />
      </div>
    );
  }

  return (
    <div style={{ background: bg, minHeight: '100vh' }}>
      <AppNav isAuthenticated={isAdmin} isSuperAdmin={isSuperAdmin} onSignOut={handleLogout} poolId={poolId} />

      <section style={{ background: bg, padding: 'clamp(2rem, 5vw, 3rem) 0 1.5rem' }}>
        <div className="lp-inner">
          <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.26em', color: gold, textTransform: 'uppercase', marginBottom: '0.6rem' }}>
            Survivor Pool
          </p>
          <h1 style={{ ...bc, fontWeight: 900, fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', lineHeight: 1, color: text, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            {pool?.name ?? 'Loading…'}
          </h1>
          {state?.currentWeek ? (
            <p style={{ ...b, fontSize: '0.9rem', color: textMid }}>
              Week {state.currentWeek.week} — {weekUnlocked ? 'picks are open' : 'picks are locked'}
            </p>
          ) : (
            <p style={{ ...b, fontSize: '0.9rem', color: textMid }}>The season is complete.</p>
          )}
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
            {state?.participants.map(p => (
              <option key={p.participantId} value={p.participantId}>
                {p.participantName}{p.status !== 'ACTIVE' ? ` (${p.status === 'WINNER' ? 'Winner' : 'Eliminated'})` : ''}
              </option>
            ))}
          </select>
        </div>
      </section>

      {myState && (
        <section style={{ background: bg, padding: '2rem 0' }}>
          <div className="lp-inner" style={{ maxWidth: 640 }}>
            <StatusBanner myState={myState} />

            {myState.status === 'ACTIVE' && state?.currentWeek && (
              <div style={{ marginTop: '1.5rem' }}>
                <h2 style={{ ...bc, fontWeight: 800, fontSize: '1.1rem', color: text, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                  Choose Your Team
                </h2>
                <p style={{ ...b, fontSize: '0.85rem', color: textMid, marginBottom: '1.25rem' }}>
                  Select one team for Week {state.currentWeek.week}. You can only use each team once during the pool.
                </p>

                {myUsedTeams.size > 0 && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <p style={{ ...bc, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                      Teams You Have Already Used
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {[...myUsedTeams].map(t => (
                        <span key={t} style={{ ...bc, fontSize: '0.75rem', fontWeight: 700, color: textDim, background: card, border: `1px solid ${border}`, borderRadius: 5, padding: '0.3rem 0.6rem' }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {!weekUnlocked ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {!myCurrentWeekPick && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '1rem 1.25rem' }}>
                        <Lock style={{ width: 18, height: 18, color: textDim, flexShrink: 0 }} />
                        <p style={{ ...b, fontSize: '0.85rem', color: textMid }}>
                          This week is locked. You did not submit a pick before it locked.
                        </p>
                      </div>
                    )}
                    {currentWeekGames.map(game => (
                      <LockedSurvivorGameRow key={game.id} game={game} pickedTeam={myCurrentWeekPick?.selectedTeam} />
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {currentWeekGames.map(game => (
                      <div key={game.id} style={{ background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '1rem 1.25rem' }}>
                        <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginBottom: '0.6rem' }}>
                          {format(new Date(game.kickoffTime), 'EEE, MMM d · h:mm a')}
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                          {[
                            { team: game.awayTeamId, name: game.awayTeam },
                            { team: game.homeTeamId, name: game.homeTeam },
                          ].map(({ team, name }) => {
                            if (!team) return null;
                            const used = myUsedTeams.has(team) && myCurrentWeekPick?.selectedTeam !== team;
                            const picked = myCurrentWeekPick?.selectedTeam === team;
                            const isSubmittingThis = submitting && selectedTeam === team;
                            return (
                              <button
                                key={team}
                                type="button"
                                disabled={used || submitting}
                                onClick={() => handleSubmit(game.id, team)}
                                style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                                  padding: '0.75rem 0.5rem', borderRadius: 6,
                                  background: picked ? green : used ? 'transparent' : surface,
                                  border: `1px solid ${picked ? green : used ? border : border}`,
                                  color: picked ? text : used ? textDim : text,
                                  opacity: used ? 0.5 : 1,
                                  cursor: used || submitting ? 'not-allowed' : 'pointer',
                                  ...bc, fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase',
                                }}
                              >
                                {picked && <CheckCircle2 style={{ width: 14, height: 14 }} />}
                                {isSubmittingThis ? 'Saving…' : name}
                                {used && <span style={{ ...b, fontSize: '0.65rem', fontWeight: 400, textTransform: 'none', marginLeft: '0.25rem' }}>(used)</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
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

function StatusBanner({ myState }: { myState: NonNullable<SurvivorPoolState['participants'][number]> }) {
  if (myState.status === 'WINNER') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: `${gold}18`, border: `1px solid ${gold}55`, borderRadius: 8, padding: '1rem 1.25rem' }}>
        <Trophy style={{ width: 22, height: 22, color: gold, flexShrink: 0 }} />
        <p style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: gold, textTransform: 'uppercase' }}>
          You won the Survivor Pool!
        </p>
      </div>
    );
  }
  if (myState.status === 'ELIMINATED') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: `${red}14`, border: `1px solid ${red}44`, borderRadius: 8, padding: '1rem 1.25rem' }}>
        <Skull style={{ width: 22, height: 22, color: red, flexShrink: 0 }} />
        <div>
          <p style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: red, textTransform: 'uppercase' }}>
            You were eliminated in Week {myState.eliminatedWeek}
          </p>
          <p style={{ ...b, fontSize: '0.82rem', color: textMid, marginTop: '0.15rem' }}>
            {myState.eliminatedReason === 'no_pick'
              ? "You didn't submit a pick before that week locked."
              : myState.eliminatedReason === 'tie'
                ? `Your pick (${myState.eliminatedTeam}) tied.`
                : `Your pick (${myState.eliminatedTeam}) lost.`}
          </p>
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: `${greenHi}14`, border: `1px solid ${greenHi}44`, borderRadius: 8, padding: '0.85rem 1.25rem' }}>
      <ShieldCheck style={{ width: 20, height: 20, color: greenHi, flexShrink: 0 }} />
      <p style={{ ...bc, fontWeight: 700, fontSize: '0.9rem', color: greenHi, textTransform: 'uppercase' }}>
        You&apos;re still alive!
      </p>
    </div>
  );
}

