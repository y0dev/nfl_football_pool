'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { CheckCircle2, Lock, Unlock, Target, Trophy, Clock, Check, X as XIcon, Share2, Users, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AppNav } from '@/components/layout/AppNav';
import { TeamLogo } from '@/components/ui/team-logo';
import { getUpcomingWeek } from '@/actions/loadCurrentWeek';
import { userSessionManager } from '@/lib/user-session';
import { isGameLocked } from '@/lib/pickem-settings';
import { getTeam, getTeamAbbreviation, debugError, showDebugPanel, getWeekTitle, getMaxWeeksForSeason, DAYS_BEFORE_GAME } from '@/lib/utils';
import { normalizeGameStatus } from '@/types/game';
import type { PickemWeekResult, PickemGamePick } from '@/lib/pickem';
import { PoolPicksHero, WeekNav, computeHeroWeekState, computeHeroUnlockTime } from '@/components/picks/pool-picks-hero';
import { GameStatusCard, GamesStartedCard, computeGameStatusStats } from '@/components/picks/game-status-cards';
import { DebugPanel } from '@/components/picks/debug-panel';
import { PickemStandingsPanel } from '@/components/leaderboard/pickem-leaderboard';

const bg      = 'oklch(13% 0.025 255)';
const surface = 'oklch(17% 0.028 255)';
const card    = 'oklch(20% 0.03 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const gold    = 'oklch(74% 0.16 72)';
const amber   = 'oklch(72% 0.16 60)';
const liveRed = 'oklch(62% 0.22 25)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

// Locked/finished game row: replaces the pick buttons once a game can no
// longer be picked. Shows the result itself (teams, logos, score, your pick
// + correct/incorrect) instead of a separate "Game Details" disclosure —
// the game and its result already are the detail.
function LockedPickemGameRow({
  game,
  pick,
}: {
  game: PickemWeekResult['eligibleGames'][number];
  pick: PickemGamePick | undefined;
}) {
  const normalized = normalizeGameStatus(game.status);
  const isFinished = normalized === 'finished';
  const isLive = normalized === 'live';
  const awayTeam = getTeam(getTeamAbbreviation(game.awayTeam));
  const homeTeam = getTeam(getTeamAbbreviation(game.homeTeam));
  const showScores = (isFinished || isLive) && game.homeScore != null && game.awayScore != null;

  return (
    <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '1rem 1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        {isFinished ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', ...bc, fontSize: '0.65rem', fontWeight: 700, color: amber, textTransform: 'uppercase' }}>
            <Trophy style={{ width: 11, height: 11 }} /> Final
          </span>
        ) : isLive ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', ...bc, fontSize: '0.65rem', fontWeight: 700, color: liveRed, textTransform: 'uppercase' }}>
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: liveRed, animation: 'pulse 1.4s ease-in-out infinite' }} /> Live
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
          // pick.selectedTeam is stored as the team id (home_team_id /
          // away_team_id), same as game.awayTeamId/homeTeamId — never the
          // full team name, which only comes from game.awayTeam/homeTeam.
          const isSelected = pick != null && pick.selectedTeam === teamId;
          return (
            <div key={fullName} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', padding: '0.5rem', borderRadius: 8, background: isSelected ? 'oklch(46% 0.14 155 / 0.1)' : 'transparent', outline: isSelected ? '1px solid oklch(46% 0.14 155 / 0.3)' : 'none' }}>
              <TeamLogo team={team} size="md" colorAccent />
              <span style={{ ...bc, fontWeight: 700, fontSize: '0.82rem', color: isSelected ? text : textMid, textAlign: 'center' }}>
                {team.city}
              </span>
              {showScores && (
                <span style={{ ...bc, fontWeight: 900, fontSize: '1.1rem', color: isFinished && game.awayScore !== game.homeScore ? (score === Math.max(game.homeScore ?? 0, game.awayScore ?? 0) ? text : textDim) : text }}>
                  {score}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', marginTop: '0.75rem', paddingTop: '0.6rem', borderTop: `1px solid ${border}` }}>
        {pick?.selectedTeam ? (
          <>
            <span style={{ ...b, fontSize: '0.78rem', color: textMid }}>Your pick: <strong style={{ color: text }}>{getTeam(pick.selectedTeam).city}</strong></span>
            {pick.result === 'correct' && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', ...bc, fontSize: '0.68rem', fontWeight: 700, color: greenHi, textTransform: 'uppercase' }}>
                <Check style={{ width: 12, height: 12 }} /> Correct
              </span>
            )}
            {pick.result === 'incorrect' && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', ...bc, fontSize: '0.68rem', fontWeight: 700, color: liveRed, textTransform: 'uppercase' }}>
                <XIcon style={{ width: 12, height: 12 }} /> Missed
              </span>
            )}
          </>
        ) : (
          <span style={{ ...b, fontSize: '0.78rem', color: textDim }}>No pick submitted</span>
        )}
      </div>
    </div>
  );
}

interface PoolInfo {
  id: string; name: string; season: number;
  isActive: boolean; seasonScope: number[]; isPrivate: boolean; isTestMode: boolean;
}

const seasonTypeNames: Record<number, string> = { 1: 'Preseason', 2: 'Regular', 3: 'Postseason' };

export function PickemPicksContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const poolId = params.id as string;
  const router = useRouter();
  const { toast } = useToast();

  const [pool, setPool] = useState<PoolInfo | null>(null);
  const [week, setWeek] = useState<number | null>(null);
  const [seasonType, setSeasonType] = useState<number | null>(null);
  const [upcomingWeek, setUpcomingWeek] = useState<{ week: number; seasonType: number }>({ week: 1, seasonType: 2 });
  const [result, setResult] = useState<PickemWeekResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isPoolAdmin, setIsPoolAdmin] = useState(false);
  const [selectedParticipantId, setSelectedParticipantId] = useState('');
  const restoredSessionRef = useRef(false);
  const [tiebreakerInput, setTiebreakerInput] = useState('');
  const [submittingTiebreaker, setSubmittingTiebreaker] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [showResults, setShowResults] = useState(false);
  // Local-only draft state, mirroring Confidence's WeeklyPick — picks are
  // selected here first and only written to the DB when "Submit Picks" is
  // pressed, instead of the previous per-click auto-save-per-game model.
  const [draftPicks, setDraftPicks] = useState<Record<string, string>>({});
  const [submittingAll, setSubmittingAll] = useState(false);
  // Dev-only overrides, same pattern/names as Confidence's own seven —
  // every checkbox that flips these only ever renders inside
  // showDebugPanel()'s #debug-panel-controls (shared/debug-panel.tsx), so
  // none of this can affect production regardless of its default.
  const [forceWeekUnlocked, setForceWeekUnlocked] = useState(false);
  const [forcePicks, setForcePicks] = useState(false);
  const [devSimInProgress, setDevSimInProgress] = useState(false);
  const [devSimFinished, setDevSimFinished] = useState(false);
  const [devForceLeaderboard, setDevForceLeaderboard] = useState(false);
  const [devSimSubmitted, setDevSimSubmitted] = useState(false);

  // This component only ever mounts for PICKEM pools — the router in
  // src/app/pool/[id]/picks/page.tsx branches to PoolPicksContent /
  // SurvivorPicksContent for the other competition types before this ever
  // renders — so this is a true constant, not a stub.
  const poolType = 'PICKEM';

  // Debug-panel-only override: treat the selected participant as submitted
  // (or force them back open) without touching the database. Real
  // production state comes from result.participants[].isComplete, computed
  // server-side in computePickemWeekResult (src/lib/pickem.ts) from actual
  // saved picks — refetched by loadData() on every poolId/week/seasonType
  // change and after every submit/unlock, so it can't go stale across a
  // reload or a participant switch. forceWeekUnlocked doubles as the
  // already-submitted bypass — there's no separate "unlock to make picks"
  // toggle, since forcing the week unlocked already means every gate on
  // picking (kickoff lock and the submitted lock alike) should lift.
  const isParticipantSubmitted = (participantId: string) => {
    if (showDebugPanel() && forceWeekUnlocked && participantId === selectedParticipantId) return false;
    if (showDebugPanel() && devSimSubmitted && participantId === selectedParticipantId) return true;
    const participant = result?.participants.find(p => p.participantId === participantId);
    return !!participant?.isComplete;
  };

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
      } else {
        try {
          const upcoming = await getUpcomingWeek();
          setWeek(upcoming.week);
          setSeasonType(upcoming.seasonType || 2);
        } catch (error) {
          debugError('Error resolving current week for Pick’em:', error);
          setWeek(1);
          setSeasonType(2);
        }
      }
    };
    resolveWeek();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Independent of the ?week=/?seasonType= params above — WeekNav needs to
  // know what's actually current/upcoming (to highlight it and label it)
  // regardless of which week the user has navigated to, same distinction
  // pool-picks-content.tsx's own `upcomingWeek` state makes.
  useEffect(() => {
    getUpcomingWeek()
      .then(u => setUpcomingWeek({ week: u.week, seasonType: u.seasonType || 2 }))
      .catch(error => debugError('Error resolving upcoming week for Pick’em WeekNav:', error));
  }, []);

  // Restores "who was I" for this pool from the same session store
  // Confidence's Picks page already uses (userSessionManager), so returning
  // within 24h doesn't require re-selecting a name every time — Pick'em
  // previously had no equivalent at all, always starting blank.
  useEffect(() => {
    if (!poolId || !result || restoredSessionRef.current) return;
    restoredSessionRef.current = true;
    try {
      userSessionManager.cleanupExpiredSessions();
      const poolSession = userSessionManager.getAllSessions().find(s => s.poolId === poolId);
      if (poolSession && result.participants.some(p => p.participantId === poolSession.userId)) {
        setSelectedParticipantId(poolSession.userId);
      }
    } catch (error) {
      debugError('Error restoring Pick’em participant session:', error);
    }
  }, [poolId, result]);

  const handleSelectParticipant = (id: string) => {
    setSelectedParticipantId(id);
    const participant = result?.participants.find(p => p.participantId === id);
    if (participant && typeof window !== 'undefined') {
      try {
        userSessionManager.createSession(id, participant.participantName, poolId, '');
      } catch (error) {
        debugError('Error saving Pick’em participant session:', error);
      }
    }
  };

  // Manual "not you?" escape hatch, matching Confidence's
  // handleUserChangeRequested — clears both the in-memory selection and the
  // persisted session so a shared device can hand off to the next
  // participant without waiting for a submission.
  const handleChangeParticipant = () => {
    if (selectedParticipantId) {
      try {
        userSessionManager.removeSession(selectedParticipantId, poolId);
      } catch (error) {
        debugError('Error clearing Pick’em participant session:', error);
      }
    }
    setSelectedParticipantId('');
  };

  const loadData = useCallback(async () => {
    if (week == null || seasonType == null) return;
    try {
      const [poolRes, resultRes] = await Promise.all([
        fetch(`/api/pools/${poolId}?week=${week}&seasonType=${seasonType}`),
        fetch(`/api/pickem/week?poolId=${poolId}&week=${week}&seasonType=${seasonType}`),
      ]);
      const poolData = await poolRes.json();
      const resultData = await resultRes.json();
      if (poolData?.pool) {
        setPool({
          id: poolData.pool.id,
          name: poolData.pool.name,
          season: poolData.pool.season,
          isActive: !!poolData.pool.is_active,
          seasonScope: Array.isArray(poolData.pool.season_scope) && poolData.pool.season_scope.length > 0 ? poolData.pool.season_scope : [2],
          isPrivate: !!poolData.pool.is_private,
          isTestMode: !!poolData.pool.is_test_mode,
        });
      }
      if (resultData?.success) { setResult(resultData.result); setLastUpdated(new Date()); }
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
  // isPoolAdmin (this browser's commissioner also owns THIS pool, not just
  // any pool) mirrors pool-picks-content.tsx's own check — needed so
  // handleShare only ever includes the password for the pool's actual
  // owner, same privacy guarantee Confidence already has.
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const storedUser = typeof window !== 'undefined' ? localStorage.getItem('nfl-pool-user') : null;
        const localUser: { id?: string; email?: string } | null = storedUser ? JSON.parse(storedUser) : null;
        if (!localUser?.id) return;
        const res = await fetch(`/api/admin/verify-status?adminId=${localUser.id}`);
        const data = await res.json();
        if (data.success && data.isAdmin) {
          setIsAdmin(true);
          setIsSuperAdmin(!!data.isSuperAdmin);
          if (poolId && localUser.email) {
            const { getSupabaseClient } = await import('@/lib/supabase');
            const supabase = getSupabaseClient();
            const { data: poolRow } = await supabase.from('pools').select('created_by').eq('id', poolId).single();
            if (poolRow && poolRow.created_by === localUser.email) setIsPoolAdmin(true);
          }
        }
      } catch (error) {
        debugError('Error checking admin status:', error);
      }
    };
    checkAdminStatus();
  }, [poolId]);

  const handleShare = async () => {
    const url = window.location.href;
    let text = `Join me in making picks for ${pool?.name ?? 'this pool'} — Week ${week}!`;
    if (pool?.isPrivate && isPoolAdmin) {
      try {
        const storedUser = typeof window !== 'undefined' ? localStorage.getItem('nfl-pool-user') : null;
        const localUser: { email?: string } | null = storedUser ? JSON.parse(storedUser) : null;
        if (localUser?.email) {
          const { revealPoolPasswordForCommissioner } = await import('@/actions/poolPassword');
          const result = await revealPoolPasswordForCommissioner(poolId, localUser.email);
          if (result.success) text += `\n\nPassword: ${result.password}`;
        }
      } catch (e) {
        debugError('Error including pool password in share message:', e);
      }
    }
    try {
      if (navigator.share) {
        await navigator.share({ title: `${pool?.name ?? "Pick'em"} - Week ${week} Picks`, text, url });
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        toast({ title: 'Link Copied', description: text.includes('Password:') ? 'Pool link and password copied to clipboard' : 'Pool link copied to clipboard' });
      }
    } catch (e) {
      debugError('Error sharing:', e);
    }
  };

  // No playoff-confidence-points gate (Confidence-only concept) — otherwise
  // the same bounds-checking + full-page navigation pattern as
  // pool-picks-content.tsx's navigateToWeek, so a week jump always reflects
  // real server state on load rather than a client-side transition.
  const navigateToWeek = (targetWeek: number, targetSeasonType: number) => {
    const scopeSorted = [...(pool?.seasonScope ?? [2])].sort((a, b) => a - b);
    const minScope = scopeSorted[0] ?? 2;
    const maxScope = scopeSorted[scopeSorted.length - 1] ?? 2;
    const maxWeeks = getMaxWeeksForSeason(targetSeasonType);
    let w = targetWeek;
    let st = targetSeasonType;
    if (w < 1) {
      if (st <= minScope) return;
      const prevScope = scopeSorted.filter(s => s < st).pop();
      if (!prevScope) return;
      st = prevScope;
      w = getMaxWeeksForSeason(prevScope);
    } else if (w > maxWeeks) {
      if (st >= maxScope) return;
      const nextScope = scopeSorted.find(s => s > st);
      if (!nextScope) return;
      st = nextScope;
      w = 1;
    }
    window.location.href = `/pool/${poolId}/picks?week=${w}&seasonType=${st}`;
  };

  const navigateToCurrentWeek = async () => {
    try {
      const upcoming = await getUpcomingWeek();
      window.location.href = `/pool/${poolId}/picks?week=${upcoming.week}&seasonType=${upcoming.seasonType || 2}`;
    } catch (error) {
      debugError('Error getting current week:', error);
      window.location.href = `/pool/${poolId}/picks?week=1&seasonType=2`;
    }
  };

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
    // Deliberately depending on the two primitive fields instead of `myWeek`
    // itself — `myWeek` is a fresh object from .find() every render, so
    // tracking the object would reset the tiebreaker input on every render
    // instead of only when the participant or their prediction changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myWeek?.participantId, myWeek?.tiebreakerPrediction]);

  // Seeds the local draft from this participant's already-saved picks
  // whenever the selected participant changes (or data first loads) — not
  // on every refetch, so a mid-review "Submit Picks" refetch doesn't stomp
  // picks the user just changed but hasn't resubmitted yet. Same dependency
  // pattern as the tiebreaker-input effect above.
  useEffect(() => {
    if (!myWeek) { setDraftPicks({}); return; }
    const seeded: Record<string, string> = {};
    for (const pick of myWeek.picks) {
      if (pick.selectedTeam) seeded[pick.gameId] = pick.selectedTeam;
    }
    setDraftPicks(seeded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myWeek?.participantId]);

  const handleSelectTeam = (gameId: string, team: string) => {
    if (!selectedParticipantId) {
      toast({ title: 'Select yourself first', description: 'Choose your name before picking a team.', variant: 'destructive' });
      return;
    }
    setDraftPicks(prev => ({ ...prev, [gameId]: team }));
  };

  // Same devSimInProgress/devSimFinished score-simulation as Confidence's
  // own devDisplayGames — cosmetic only (real result.eligibleGames, and
  // therefore the real week/game status this pool actually has, is never
  // touched), scoped to rendering + this-week's editability, same as
  // Confidence scopes its devDisplayGames to WeeklyPick's games prop only.
  const liveScores:  [number, number][] = [[7,3],[14,14],[21,10],[0,7],[17,21],[28,24],[3,10],[35,14]];
  const finalScores: [number, number][] = [[24,17],[31,28],[14,21],[38,35],[17,10],[21,7],[27,24],[13,10]];
  const devDisplayGames = (() => {
    const base = result?.eligibleGames ?? [];
    if (process.env.NODE_ENV !== 'development') return base;
    if (devSimFinished) {
      return base.map((g, i) => {
        const [hs, as_] = finalScores[i % finalScores.length];
        return { ...g, status: 'final', homeScore: hs, awayScore: as_ };
      });
    }
    if (devSimInProgress) {
      return base.map((g, i) => (i % 2 === 0 ? { ...g, status: 'in_progress', homeScore: liveScores[i % liveScores.length][0], awayScore: liveScores[i % liveScores.length][1] } : g));
    }
    return base;
  })();

  // Every currently-editable (not yet locked) game a participant must pick
  // this week — locked games are excluded since they're neither shown as a
  // pickable control nor part of what gets submitted, same as Confidence's
  // week-wide submit only ever covering games that are still open.
  const editableGames = devDisplayGames.filter(
    game => forceWeekUnlocked || !isGameLocked({ kickoff_time: game.kickoffTime, status: game.status }, now)
  );
  const allEditablePicked = editableGames.length > 0 && editableGames.every(g => !!draftPicks[g.id]);

  // Single "Submit Picks" action, matching Confidence's WeeklyPick model —
  // picks are only written to the DB here, not on every team click. Each
  // pick still POSTs individually (Pick'em's own /api/pickem/submit route is
  // deliberately per-game, since games lock independently — see that
  // route's header comment), but from the user's perspective there is one
  // button, one validate → submit → save → refetch → success flow.
  const handleSubmitPicks = async () => {
    if (!selectedParticipantId) {
      toast({ title: 'Select yourself first', description: 'Choose your name before submitting picks.', variant: 'destructive' });
      return;
    }
    if (isParticipantSubmitted(selectedParticipantId)) {
      toast({ title: 'Already Submitted', description: 'You have already submitted your picks for this week. Ask an admin to unlock them to make changes.', variant: 'destructive' });
      return;
    }
    if (!allEditablePicked) {
      toast({ title: 'Incomplete Picks', description: 'Please make a pick for all games before submitting.', variant: 'destructive' });
      return;
    }
    setSubmittingAll(true);
    try {
      const responses = await Promise.all(
        editableGames.map(game =>
          fetch('/api/pickem/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ participantId: selectedParticipantId, poolId, gameId: game.id, selectedTeam: draftPicks[game.id], devForceUnlock: forceWeekUnlocked }),
          }).then(res => res.json())
        )
      );
      const failed = responses.find(r => !r.success);
      if (failed) {
        toast({ title: 'Some Picks Rejected', description: failed.error ?? 'One or more picks could not be saved.', variant: 'destructive' });
      } else {
        toast({ title: 'Picks Submitted', description: 'Your picks have been saved.' });
        // Matches Confidence's handlePicksSubmitted: clear the selected
        // participant (in-memory) AND the persisted session on success, so
        // "Who's picking?" reappears immediately for the next person on a
        // shared device — no page reload, and no stale auto-restore next visit.
        try {
          userSessionManager.removeSession(selectedParticipantId, poolId);
        } catch (error) {
          debugError('Error clearing Pick’em participant session after submit:', error);
        }
        setSelectedParticipantId('');
      }
      await loadData();
    } catch (error) {
      debugError("Error submitting Pick'em picks:", error);
      toast({ title: 'Error', description: 'Failed to submit picks. Please try again.', variant: 'destructive' });
    } finally {
      setSubmittingAll(false);
    }
  };

  // Same server-verified unlock as Confidence's unlockParticipantPicks —
  // reuses /api/pools/[id]/unlock-picks, which checks pool ownership /
  // super-admin from the DB itself (not client-held state) and deletes the
  // participant's picks rows for the given games, same table Confidence's
  // own picks live in.
  const handleUnlockParticipant = async (participantId: string) => {
    if (!isPoolAdmin && !isSuperAdmin) {
      toast({ title: 'Permission Denied', description: 'Only pool commissioners or admins can unlock picks', variant: 'destructive' });
      return;
    }
    try {
      const storedUser = typeof window !== 'undefined' ? localStorage.getItem('nfl-pool-user') : null;
      const localUser: { email?: string } | null = storedUser ? JSON.parse(storedUser) : null;
      if (!localUser?.email) {
        toast({ title: 'Error', description: 'Could not verify your account', variant: 'destructive' });
        return;
      }
      const res = await fetch(`/api/pools/${poolId}/unlock-picks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-email': localUser.email },
        body: JSON.stringify({ participantId, gameIds: (result?.eligibleGames ?? []).map(g => g.id) }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to unlock picks');
      toast({ title: 'Picks Unlocked', description: 'Participant can now make new picks' });
      await loadData();
    } catch (error) {
      debugError("Error unlocking Pick'em picks:", error);
      toast({ title: 'Error', description: 'Failed to unlock picks. Please try again.', variant: 'destructive' });
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

  // Same lock-state source of truth as Confidence's hero (computeHeroWeekState
  // / computeWeekUnlockStatus under it) — never a separate calculation. Pick'em
  // games are per-game-locking but the week as a whole is "unlocked" exactly
  // when Confidence's would be: before any of this week's games have started.
  const gamesForLock = (result?.eligibleGames ?? []).map(g => ({ kickoff_time: g.kickoffTime, status: g.status }));
  const gamesStartedNow = gamesForLock.some(g => new Date(g.kickoff_time) <= now || (g.status != null && normalizeGameStatus(g.status) !== 'scheduled'));
  const isPoolClosed = pool ? !pool.isActive : false;
  const weekEnded = result?.isWeekFinal ?? false;
  const heroWeekState = computeHeroWeekState({
    isPoolClosed,
    weekEnded,
    poolSeasonScope: pool?.seasonScope ?? [2],
    currentSeasonType: seasonType ?? 2,
    currentWeek: week ?? 1,
    games: gamesForLock,
    upcomingWeek,
  });
  const heroUnlockTime = computeHeroUnlockTime(heroWeekState, gamesForLock, DAYS_BEFORE_GAME);
  const gameStatusStats = computeGameStatusStats(gamesForLock);

  const statsTotal = result?.participants.length ?? 0;
  const statsComplete = result?.participants.filter(p => p.isComplete).length ?? 0;
  const statsPending = statsTotal - statsComplete;
  const statsCompletionRate = statsTotal > 0 ? Math.round((statsComplete / statsTotal) * 100) : 0;

  // Same devSimInProgress-only override as Confidence's effectiveGamesStarted
  // — real gamesStartedNow (from actual kickoff times) stays untouched;
  // this only widens what counts as "started" for banner/gating display.
  const effectiveGamesStarted = gamesStartedNow || (process.env.NODE_ENV === 'development' && devSimInProgress);
  // Real DB-backed "has anyone picked this week" — same shape as
  // Confidence's anyPicksSubmitted check (some(entry => picks > 0)).
  const weekHasPicks = (result?.participants ?? []).some(p => p.picks.some(pk => !!pk.selectedTeam));
  // Auto-show once everyone has submitted: real week-ended, OR the dev-only
  // force override, OR every participant's real (DB) picks are complete —
  // not gated on games having started, so the standings appear the moment
  // the last participant submits, even pre-kickoff. devForceLeaderboard is
  // a separate dev-only override, never required for correct production
  // behavior.
  const showResultsSection = weekEnded
    || (showDebugPanel() && devForceLeaderboard)
    || (statsTotal > 0 && statsComplete >= statsTotal);

  return (
    <div style={{ background: bg, minHeight: '100vh' }}>
      <AppNav isAuthenticated={isAdmin} isSuperAdmin={isSuperAdmin} onSignOut={handleLogout} poolId={poolId} />

      <PoolPicksHero
        poolName={pool?.name ?? 'Loading…'}
        isTestMode={pool?.isTestMode}
        weekTitle={getWeekTitle(week ?? 1, seasonType ?? 2)}
        weekNav={
          <WeekNav
            currentWeek={week ?? 1} currentSeasonType={seasonType ?? 2} upcomingWeek={upcomingWeek}
            seasonScope={pool?.seasonScope ?? [2]}
            onPrev={() => navigateToWeek((week ?? 1) - 1, seasonType ?? 2)}
            onCurrent={navigateToCurrentWeek}
            onNext={() => navigateToWeek((week ?? 1) + 1, seasonType ?? 2)}
            onJumpToWeek={(w, st) => navigateToWeek(w, st)}
          />
        }
        itemCountLabel={`${result?.eligibleGames.length ?? 0} games`}
        seasonTypeName={seasonTypeNames[seasonType ?? 2] || 'Regular'}
        weekState={heroWeekState}
        gamesStarted={effectiveGamesStarted}
        unlockTime={heroUnlockTime}
        unlockFallbackMessage="Picks aren't unlocked yet — they open a few days before the first game's kickoff."
        lastUpdated={lastUpdated}
        subtitle="Pick the winner of each game."
        actions={[
          { label: 'Share', icon: Share2, onClick: handleShare },
          { label: 'Stats', icon: Users, onClick: () => setShowStats(!showStats) },
          // Once results-section auto-shows (week ended, or everyone has
          // submitted — matches Confidence's showResultsTabs), nothing left
          // to toggle. Before then, this is a manual peek at in-progress standings.
          ...(!showResultsSection ? [{ label: showResults ? 'Hide Results' : 'Show Results', icon: Eye, onClick: () => setShowResults(!showResults) }] : []),
        ]}
        learnMoreHref="/how-to/pickem-picks"
        learnMoreText="Pick'em picks"
      />
      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${green}, transparent)` }} />

      {(gameStatusStats || effectiveGamesStarted) && (
        <section style={{ background: bg, padding: '1.5rem 0 0' }}>
          <div className="lp-inner" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {gameStatusStats && <GameStatusCard stats={gameStatusStats} />}
            {effectiveGamesStarted && <GamesStartedCard sublabel="Locked games can no longer be changed" />}
          </div>
        </section>
      )}

      {showStats && (
        <section style={{ background: bg, padding: '1.5rem 0 0' }}>
          <div className="lp-inner">
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users style={{ width: 15, height: 15, color: green }} />
                <span style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', color: text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pool Statistics</span>
              </div>
              <div style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                {[
                  { label: 'Total Participants', value: statsTotal, color: green },
                  { label: 'Complete', value: statsComplete, color: 'oklch(58% 0.15 250)' },
                  { label: 'Pending', value: statsPending, color: amber },
                  { label: 'Completion', value: `${statsCompletionRate}%`, color: gold },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div style={{ ...bc, fontWeight: 900, fontSize: '1.75rem', color, lineHeight: 1 }}>{value}</div>
                    <div style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.25rem' }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ padding: '0 1.25rem 1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...b, fontSize: '0.75rem', color: textDim, marginBottom: '0.4rem' }}>
                  <span>Submission Progress</span>
                  <span style={{ color: textMid }}>{statsComplete} of {statsTotal}</span>
                </div>
                <div style={{ height: 6, background: 'oklch(26% 0.03 255)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: `linear-gradient(90deg, ${green}, oklch(58% 0.15 250))`, borderRadius: 3, width: `${statsTotal > 0 ? (statsComplete / statsTotal) * 100 : 0}%`, transition: 'width 0.3s ease' }} />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {showDebugPanel() && (
        <section style={{ background: bg, margin: '1rem 0', padding: '0 0 2rem' }}>
          <div className="lp-inner">
            <DebugPanel
              poolType={poolType}
              poolId={poolId}
              currentWeek={week}
              currentSeasonType={seasonType}
              gamesCount={result?.eligibleGames.length ?? 0}
              gamesStarted={effectiveGamesStarted}
              weekEnded={weekEnded}
              selectedUserLabel={myWeek ? `${myWeek.participantName} (${myWeek.participantId})` : null}
              hasSubmittedSelected={selectedParticipantId ? isParticipantSubmitted(selectedParticipantId) : null}
              simulatedSubmitted={devSimSubmitted}
              showLeaderboard={showResultsSection}
              weekHasPicks={weekHasPicks}
              forceWeekUnlocked={forceWeekUnlocked} onForceWeekUnlockedChange={setForceWeekUnlocked}
              forcePicks={forcePicks} onForcePicksChange={setForcePicks}
              devSimInProgress={devSimInProgress} onDevSimInProgressChange={setDevSimInProgress}
              devSimFinished={devSimFinished} onDevSimFinishedChange={setDevSimFinished}
              devForceLeaderboard={devForceLeaderboard} onDevForceLeaderboardChange={setDevForceLeaderboard}
              devSimSubmitted={devSimSubmitted} onDevSimSubmittedChange={setDevSimSubmitted}
            >
              {myWeek && result && result.eligibleGames.length > 0 && (
                <div style={{ overflowX: 'auto', marginTop: '0.75rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', ...b, fontSize: '0.68rem' }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid oklch(58% 0.15 250 / 0.25)` }}>
                        {['Game', 'Selected Team', 'Locked?', 'Result'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '0.3rem 0.5rem', color: 'oklch(68% 0.12 250)', fontWeight: 700 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.eligibleGames.map(game => {
                        const pick = myWeek.picks.find(p => p.gameId === game.id);
                        const locked = !forceWeekUnlocked && isGameLocked({ kickoff_time: game.kickoffTime, status: game.status }, now);
                        return (
                          <tr key={game.id} style={{ borderBottom: `1px solid oklch(58% 0.15 250 / 0.15)` }}>
                            <td style={{ padding: '0.3rem 0.5rem', color: 'oklch(65% 0.1 250)' }}>{game.awayTeam} @ {game.homeTeam}</td>
                            <td style={{ padding: '0.3rem 0.5rem', color: 'oklch(65% 0.1 250)' }}>{pick?.selectedTeam || 'None'}</td>
                            <td style={{ padding: '0.3rem 0.5rem', color: 'oklch(65% 0.1 250)' }}>{locked ? 'Yes' : 'No'}</td>
                            <td style={{ padding: '0.3rem 0.5rem', color: 'oklch(65% 0.1 250)' }}>{pick?.result ?? 'pending'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </DebugPanel>
          </div>
        </section>
      )}

      {(showResults || showResultsSection) && (
        <section id="results-section" style={{ background: bg, padding: '1.5rem 0 0' }}>
          <div className="lp-inner">
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                <Trophy style={{ width: 16, height: 16, color: gold }} />
                <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase' }}>Pick&apos;em Standings</p>
              </div>
              <PickemStandingsPanel poolId={poolId} />
            </div>
          </div>
        </section>
      )}

      {/* Same structure as Confidence: once showResultsSection is true
          (matches Confidence's showResultsTabs), the entire picker/picks-form
          section — including "Who's picking?" — disappears, same as
          pool-picks-content.tsx's `{!showResultsTabs && (...)}` wrapper.
          There's nothing left to pick once everyone has submitted, so it
          shouldn't keep prompting for a name. forcePicks (dev only) bypasses
          this the same way it does in Confidence — for reviewing a
          participant's own locked/finished picks after standings would
          otherwise take over. Inside that, the participant picker and the
          picks form are mutually exclusive, not stacked — selecting a name
          replaces "Who's picking?" with the picks form. selectedParticipantId
          (not myWeek) is what decides which one shows, so a still-resolving
          myWeek doesn't briefly flash the picker. */}
      {(!showResultsSection || (showDebugPanel() && forcePicks)) && (!selectedParticipantId || !myWeek || !result ? (
        <section style={{ background: surface, padding: '2rem 0' }}>
          <div className="lp-inner">
            <label style={{ ...bc, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>
              Who&apos;s picking?
            </label>
            <select
              value={selectedParticipantId}
              onChange={(e) => handleSelectParticipant(e.target.value)}
              style={{ width: '100%', padding: '0.65rem 0.85rem', background: card, border: `1px solid ${border}`, borderRadius: 6, color: text, ...b, fontSize: '0.95rem' }}
            >
              <option value="">Select your name…</option>
              {result?.participants.map(p => (
                <option key={p.participantId} value={p.participantId}>{p.participantName}</option>
              ))}
            </select>
          </div>
        </section>
      ) : (
        <section style={{ background: bg, padding: '2rem 0' }}>
          <div className="lp-inner">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <p style={{ ...b, fontSize: '0.82rem', color: textMid }}>
                Picking as <strong style={{ color: text }}>{myWeek.participantName}</strong>
              </p>
              <button
                type="button"
                onClick={handleChangeParticipant}
                style={{ background: 'transparent', border: 'none', color: textDim, ...b, fontSize: '0.78rem', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
              >
                Not you? Switch
              </button>
            </div>

            {/* Production requirement: once this participant has real,
                complete DB-stored picks for this week, they can no longer
                submit again — same source of truth as Confidence's
                isSubmittedForUser (result.participants[].isComplete, not
                client-only state), unbypassable by switching participants,
                switching weeks, or reloading. Individual finished/started
                games still render their real result via LockedPickemGameRow
                either way — this only locks the still-open games from
                further edits, it doesn't hide anything already reviewable. */}
            {isParticipantSubmitted(selectedParticipantId) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '0.85rem 1.25rem', marginBottom: '1.25rem' }}>
                <Lock style={{ width: 18, height: 18, color: textDim, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ ...bc, fontWeight: 700, fontSize: '0.85rem', color: textMid, textTransform: 'uppercase' }}>Picks Submitted</p>
                  <p style={{ ...b, fontSize: '0.78rem', color: textDim }}>Your picks are locked for this week. Only admins can unlock your picks to make changes.</p>
                </div>
                {(isPoolAdmin || isSuperAdmin) && (
                  <button
                    type="button"
                    onClick={() => handleUnlockParticipant(selectedParticipantId)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', flexShrink: 0 }}
                  >
                    <Unlock style={{ width: 13, height: 13 }} /> Unlock Picks
                  </button>
                )}
              </div>
            )}

            {!isParticipantSubmitted(selectedParticipantId) && effectiveGamesStarted && !weekEnded && statsTotal > 0 && statsComplete < statsTotal && !forcePicks && (
              <div style={{ background: `${amber}14`, border: `1px solid ${amber}44`, borderRadius: 8, padding: '0.85rem 1.25rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                  <Clock style={{ width: 15, height: 15, color: amber, flexShrink: 0 }} />
                  <span style={{ ...bc, fontWeight: 800, fontSize: '0.82rem', color: amber, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Waiting for All Submissions</span>
                </div>
                <p style={{ ...b, fontSize: '0.78rem', color: textMid }}>{statsComplete} of {statsTotal} participants have submitted picks — standings will show automatically once everyone has.</p>
              </div>
            )}

            {!allEditablePicked && !isParticipantSubmitted(selectedParticipantId) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: `${amber}14`, border: `1px solid ${amber}44`, borderRadius: 8, padding: '0.85rem 1.25rem', marginBottom: '1.25rem' }}>
                <Target style={{ width: 18, height: 18, color: amber, flexShrink: 0 }} />
                <p style={{ ...b, fontSize: '0.85rem', color: amber }}>Please make a pick for all games.</p>
              </div>
            )}

            <h2 style={{ ...bc, fontWeight: 800, fontSize: '1.1rem', color: text, textTransform: 'uppercase', marginBottom: '1.25rem' }}>
              Weekly Picks
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: tiebreakerGame ? '2rem' : 0 }}>
              {devDisplayGames.map(game => {
                const locked = !forceWeekUnlocked && isGameLocked({ kickoff_time: game.kickoffTime, status: game.status }, now);
                const pickForGame = myWeek.picks.find(p => p.gameId === game.id);

                // Once a game is locked, OR this participant has already
                // submitted a complete set of picks for the week, its result
                // (teams, score, your pick, correct/incorrect) is the primary
                // information — no live pick buttons left to show, and no
                // separate "Game Details" disclosure needed to see the same
                // thing. This is the real, DB-backed one-submission lock:
                // once submitted, every still-open game row shows this way
                // instead of a clickable pick, matching Confidence's locked/
                // submitted view.
                if (locked || isParticipantSubmitted(selectedParticipantId)) {
                  return <LockedPickemGameRow key={game.id} game={game} pick={pickForGame} />;
                }

                // Draft state (not the last-saved pick) drives what's shown
                // as selected — the user should see their in-progress choice
                // immediately, without waiting on a round trip, matching
                // Confidence's WeeklyPick local-state-until-Submit model.
                const selectedTeam = draftPicks[game.id] ?? null;
                // Same team-logo + city/mascot presentation as Confidence's
                // GameCard and Pick'em's own LockedPickemGameRow — the open
                // (pickable) state shouldn't look like a visually unrelated
                // plain-text button row.
                return (
                  <div key={game.id} style={{ background: card, border: `1px solid ${selectedTeam ? 'oklch(46% 0.14 155 / 0.4)' : border}`, borderRadius: 8, padding: '1rem 1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                      <p style={{ ...b, fontSize: '0.72rem', color: textDim }}>
                        {format(new Date(game.kickoffTime), 'EEE, MMM d · h:mm a')}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {[
                        { team: game.awayTeamId, fullName: game.awayTeam },
                        { team: game.homeTeamId, fullName: game.homeTeam },
                      ].map(({ team, fullName }) => {
                        if (!team) return null;
                        const picked = selectedTeam === team;
                        const disabled = submittingAll || isParticipantSubmitted(selectedParticipantId);
                        const teamInfo = getTeam(getTeamAbbreviation(fullName));
                        return (
                          <button
                            key={team}
                            type="button"
                            disabled={disabled}
                            onClick={() => handleSelectTeam(game.id, team)}
                            style={{
                              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem',
                              padding: '0.75rem 0.5rem', borderRadius: 8,
                              background: picked ? 'oklch(46% 0.14 155 / 0.1)' : 'transparent',
                              border: `1px solid ${picked ? 'oklch(46% 0.14 155 / 0.3)' : border}`,
                              cursor: disabled ? 'not-allowed' : 'pointer',
                            }}
                          >
                            <TeamLogo team={teamInfo} size="md" colorAccent />
                            <span style={{ ...bc, fontWeight: 700, fontSize: '0.82rem', color: picked ? text : textMid, textAlign: 'center' }}>
                              {teamInfo.city}
                            </span>
                            {picked && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', ...bc, fontSize: '0.62rem', fontWeight: 700, color: greenHi, textTransform: 'uppercase' }}>
                                <CheckCircle2 style={{ width: 11, height: 11 }} /> Selected
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {tiebreakerGame && (
              <div style={{ background: card, border: `1px solid ${gold}44`, borderRadius: 8, margin: '1rem 0', padding: '1.25rem' }}>
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
                {(!forceWeekUnlocked && isGameLocked({ kickoff_time: tiebreakerGame.kickoffTime, status: null }, now)) || isParticipantSubmitted(selectedParticipantId) ? (
                  <p style={{ ...b, fontSize: '0.85rem', color: textMid }}>
                    {myWeek.tiebreakerPrediction != null
                      ? `Your prediction: ${myWeek.tiebreakerPrediction}`
                      : isParticipantSubmitted(selectedParticipantId)
                        ? 'Your picks are submitted — no separate tiebreaker prediction was made.'
                        : 'This game has started — no prediction was submitted.'}
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

            {editableGames.length > 0 && !isParticipantSubmitted(selectedParticipantId) && (
              <button
                type="button"
                onClick={handleSubmitPicks}
                disabled={submittingAll || !allEditablePicked}
                style={{
                  width: '100%', padding: '0.85rem 1rem', marginBottom: tiebreakerGame ? '1.5rem' : 0,
                  background: submittingAll || !allEditablePicked ? border : green,
                  color: submittingAll || !allEditablePicked ? textDim : text,
                  border: 'none', borderRadius: 8,
                  cursor: submittingAll || !allEditablePicked ? 'not-allowed' : 'pointer',
                  ...bc, fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.06em', textTransform: 'uppercase',
                }}
              >
                {submittingAll ? 'Submitting…' : 'Submit Picks'}
              </button>
            )}
          </div>
        </section>
      ))}

    </div>
  );
}
