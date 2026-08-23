'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Trophy, Skull, ShieldCheck, Lock, CheckCircle2, Clock, Check, X as XIcon, Share2, Users, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AppNav } from '@/components/layout/AppNav';
import { TeamLogo } from '@/components/ui/team-logo';
import { computeWeekUnlockStatus } from '@/lib/week-unlock-status';
import { userSessionManager } from '@/lib/user-session';
import { getTeam, getTeamAbbreviation, debugError, showDebugPanel, getWeekTitle, DAYS_BEFORE_GAME } from '@/lib/utils';
import { normalizeGameStatus } from '@/types/game';
import type { SurvivorPoolState, SurvivorCurrentWeekGame } from '@/lib/survivor';
import { PoolPicksHero, computeHeroWeekState, computeHeroUnlockTime, type HeroWeekState } from '@/components/picks/pool-picks-hero';
import { GameStatusCard, GamesStartedCard, computeGameStatusStats } from '@/components/picks/game-status-cards';
import { DebugPanel } from '@/components/picks/debug-panel';
import { SurvivorStandingsPanel } from '@/components/leaderboard/survivor-leaderboard';

const bg      = 'oklch(13% 0.025 255)';
const surface = 'oklch(17% 0.028 255)';
const card    = 'oklch(20% 0.03 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const gold    = 'oklch(74% 0.16 72)';
const amber   = 'oklch(72% 0.16 60)';
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
  isActive: boolean;
  seasonScope: number[];
  isPrivate: boolean;
  isTestMode: boolean;
}

const seasonTypeNames: Record<number, string> = { 1: 'Preseason', 2: 'Regular', 3: 'Postseason' };

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
  const [isPoolAdmin, setIsPoolAdmin] = useState(false);
  const [selectedParticipantId, setSelectedParticipantId] = useState('');
  const restoredSessionRef = useRef(false);
  // Local-only draft selection, mirroring Confidence's WeeklyPick and
  // Pick'em's own draftPicks — selecting a team no longer submits
  // immediately; a separate "Submit Pick" action writes it to the DB.
  const [draftPick, setDraftPick] = useState<{ gameId: string; team: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [showResults, setShowResults] = useState(false);
  // Dev-only overrides, same pattern/names as Confidence's own seven — every
  // checkbox that flips these only ever renders inside showDebugPanel()'s
  // #debug-panel-controls (shared/debug-panel.tsx), so none of this can
  // affect production regardless of its default.
  const [forceWeekUnlocked, setForceWeekUnlocked] = useState(false);
  const [forcePicks, setForcePicks] = useState(false);
  const [devSimInProgress, setDevSimInProgress] = useState(false);
  const [devSimFinished, setDevSimFinished] = useState(false);
  const [devForceLeaderboard, setDevForceLeaderboard] = useState(false);
  const [devSimSubmitted, setDevSimSubmitted] = useState(false);

  // This component only ever mounts for SURVIVOR pools — the router in
  // src/app/pool/[id]/picks/page.tsx branches to PoolPicksContent /
  // PickemPicksContent for the other competition types before this ever
  // renders — so this is a true constant, not a stub.
  const poolType = 'SURVIVOR';

  // Real production state is whether this participant has a saved pick for
  // the pool's current week — sourced from state.participants[].picks,
  // computed server-side by computeSurvivorPoolState (src/lib/survivor.ts)
  // from the actual survivor_picks table and refetched by loadData() on
  // every load and after every submit, so it can't go stale across a
  // reload or a participant switch. This is the UI-level one-pick lock: once
  // a participant has a saved pick for the current week, the pick buttons
  // are replaced with a locked row (same as Pick'em). Note submitSurvivorPick
  // (src/lib/survivor.ts) itself still allows a delete-then-reinsert change
  // server-side up until the week actually locks — that path stays available
  // for admin tooling / direct API use, only the normal picking UI is gated
  // here. forceWeekUnlocked doubles as the bypass, same as Confidence/Pick'em
  // — there's no separate "unlock to make picks" toggle.
  const isParticipantSubmitted = (participantId: string) => {
    if (showDebugPanel() && forceWeekUnlocked && participantId === selectedParticipantId) return false;
    if (showDebugPanel() && devSimSubmitted && participantId === selectedParticipantId) return true;
    if (!state?.currentWeek) return false;
    const cw = state.currentWeek;
    const participant = state.participants.find(p => p.participantId === participantId);
    return !!participant?.picks.some(pk => pk.week === cw.week && pk.seasonType === cw.seasonType);
  };

  const loadData = useCallback(async () => {
    try {
      const [poolRes, stateRes] = await Promise.all([
        fetch(`/api/pools/${poolId}`),
        fetch(`/api/survivor/state?poolId=${poolId}`),
      ]);
      const poolData = await poolRes.json();
      const stateData = await stateRes.json();
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
      if (stateData?.success) { setState(stateData.state); setLastUpdated(new Date()); }
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

  // Restores "who was I" for this pool from the same session store
  // Confidence's Picks page already uses (userSessionManager), so returning
  // within 24h doesn't require re-selecting a name every time — Survivor
  // previously had no equivalent at all, always starting blank.
  useEffect(() => {
    if (!poolId || !state || restoredSessionRef.current) return;
    restoredSessionRef.current = true;
    try {
      userSessionManager.cleanupExpiredSessions();
      const poolSession = userSessionManager.getAllSessions().find(s => s.poolId === poolId);
      if (poolSession && state.participants.some(p => p.participantId === poolSession.userId)) {
        setSelectedParticipantId(poolSession.userId);
      }
    } catch (error) {
      debugError('Error restoring Survivor participant session:', error);
    }
  }, [poolId, state]);

  const handleSelectParticipant = (id: string) => {
    setSelectedParticipantId(id);
    const participant = state?.participants.find(p => p.participantId === id);
    if (participant && typeof window !== 'undefined') {
      try {
        userSessionManager.createSession(id, participant.participantName, poolId, '');
      } catch (error) {
        debugError('Error saving Survivor participant session:', error);
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
        debugError('Error clearing Survivor participant session:', error);
      }
    }
    setSelectedParticipantId('');
  };

  // This route has no AuthProvider (participant-facing, like the
  // Confidence Picks page it sits alongside) — resolve admin/super-admin
  // status the same way pool-picks-content.tsx does: read the localStorage
  // session record directly and verify it server-side, rather than reading
  // a React auth context that doesn't exist here. isPoolAdmin (this
  // browser's commissioner also owns THIS pool) mirrors Confidence's own
  // check — needed so handleShare only ever includes the password for the
  // pool's actual owner.
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

  const handleShare = async () => {
    const url = window.location.href;
    let text = `Join me in the Survivor pool for ${pool?.name ?? 'this pool'}!`;
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
        await navigator.share({ title: `${pool?.name ?? 'Survivor'} Picks`, text, url });
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        toast({ title: 'Link Copied', description: text.includes('Password:') ? 'Pool link and password copied to clipboard' : 'Pool link copied to clipboard' });
      }
    } catch (e) {
      debugError('Error sharing:', e);
    }
  };

  const myState = state?.participants.find(p => p.participantId === selectedParticipantId) ?? null;
  const currentWeekGames: SurvivorCurrentWeekGame[] = state?.currentWeekGames ?? [];
  const weekUnlocked = forceWeekUnlocked || (currentWeekGames.length > 0 && state?.currentWeek
    ? computeWeekUnlockStatus(
        currentWeekGames.map(g => ({ kickoff_time: g.kickoffTime, status: g.status ?? undefined })),
        state.currentWeek.week,
        state.currentWeek.seasonType,
        null
      )
    : false);

  const myUsedTeams = new Set(myState?.usedTeams ?? []);
  const myCurrentWeekPick = myState?.picks.find(p => state?.currentWeek && p.week === state.currentWeek.week && p.seasonType === state.currentWeek.seasonType);

  // Seeds the local draft from this participant's already-saved current-week
  // pick whenever the selected participant changes — not on every refetch,
  // same pattern as Pick'em's draftPicks-seeding effect.
  useEffect(() => {
    if (myCurrentWeekPick) setDraftPick({ gameId: myCurrentWeekPick.gameId, team: myCurrentWeekPick.selectedTeam });
    else setDraftPick(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myState?.participantId]);

  const handleSelectTeam = (gameId: string, team: string) => {
    if (!selectedParticipantId) {
      toast({ title: 'Select yourself first', description: 'Choose your name before picking a team.', variant: 'destructive' });
      return;
    }
    setDraftPick({ gameId, team });
  };

  // Single "Submit Pick" action, matching Confidence's WeeklyPick /
  // Pick'em's Submit Picks model — the pick is only written to the DB here,
  // not on every team click.
  const handleSubmitPick = async () => {
    if (!selectedParticipantId || !draftPick) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/survivor/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: selectedParticipantId, poolId, gameId: draftPick.gameId, selectedTeam: draftPick.team, devForceUnlock: forceWeekUnlocked }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Pick Submitted', description: `You picked ${draftPick.team} for Week ${state?.currentWeek?.week}.` });
        // Matches Confidence's handlePicksSubmitted: clear the selected
        // participant (in-memory) AND the persisted session on success, so
        // "Who's picking?" reappears immediately for the next person on a
        // shared device — no page reload, and no stale auto-restore next visit.
        try {
          userSessionManager.removeSession(selectedParticipantId, poolId);
        } catch (error) {
          debugError('Error clearing Survivor participant session after submit:', error);
        }
        setSelectedParticipantId('');
        await loadData();
      } else {
        toast({ title: 'Pick Rejected', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      debugError('Error submitting Survivor pick:', error);
      toast({ title: 'Error', description: 'Failed to submit pick. Please try again.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
        <div className="animate-spin rounded-full h-16 w-16" style={{ borderWidth: '3px', borderStyle: 'solid', borderColor: border, borderTopColor: green }} />
      </div>
    );
  }

  // Same lock-state source of truth as Confidence's hero (computeHeroWeekState
  // / computeWeekUnlockStatus under it), applied to Survivor's one actionable
  // week — never a separate calculation. Unlike Confidence/Pick'em, Survivor
  // has no per-week "ended" state to show (computeSurvivorPoolState already
  // advances currentWeek past a resolved week, or clears it entirely once
  // the season is over), so season_complete is detected directly from
  // state.currentWeek being null rather than routed through the weekEnded
  // branch computeHeroWeekState uses for the other two types.
  const isPoolClosed = pool ? !pool.isActive : false;
  const gamesForLock = currentWeekGames.map(g => ({ kickoff_time: g.kickoffTime, status: g.status }));
  const gamesStartedNow = gamesForLock.some(g => new Date(g.kickoff_time) <= new Date() || (g.status != null && normalizeGameStatus(g.status) !== 'scheduled'));
  const heroWeekState: HeroWeekState = isPoolClosed
    ? 'pool_inactive'
    : !state?.currentWeek
    ? 'season_complete'
    : computeHeroWeekState({
        isPoolClosed: false,
        weekEnded: false,
        poolSeasonScope: pool?.seasonScope ?? [2],
        currentSeasonType: state.currentWeek.seasonType,
        currentWeek: state.currentWeek.week,
        games: gamesForLock,
        upcomingWeek: null,
      });
  const heroUnlockTime = computeHeroUnlockTime(heroWeekState, gamesForLock, DAYS_BEFORE_GAME);
  const gameStatusStats = computeGameStatusStats(gamesForLock);
  const heroWeekTitle = state?.currentWeek ? getWeekTitle(state.currentWeek.week, state.currentWeek.seasonType) : 'Season';
  const heroTitleAccent = state?.currentWeek ? 'Picks' : 'Complete';

  const statsTotal = state?.participants.length ?? 0;
  const statsActive = state?.activeCount ?? 0;
  const statsEliminated = state?.eliminatedCount ?? 0;
  const activeWithPick = state?.currentWeek
    ? state.participants.filter(p => p.status === 'ACTIVE' && p.picks.some(pick => pick.week === state.currentWeek!.week && pick.seasonType === state.currentWeek!.seasonType)).length
    : 0;

  // Same devSimInProgress-only override as Confidence's effectiveGamesStarted
  // — real gamesStartedNow (from actual kickoff times) stays untouched; this
  // only widens what counts as "started" for banner/gating display.
  const effectiveGamesStarted = gamesStartedNow || (process.env.NODE_ENV === 'development' && devSimInProgress);
  // Survivor has no per-week "ended" flag the way Confidence/Pick'em do —
  // computeSurvivorPoolState just advances currentWeek past a resolved week
  // — so this is derived directly from the currently-displayed week's own
  // games, same real data gamesForLock/gamesStartedNow above already use.
  const weekEnded = currentWeekGames.length > 0 && currentWeekGames.every(g => normalizeGameStatus(g.status) === 'finished');
  const weekHasPicks = activeWithPick > 0;
  // Auto-show once every ACTIVE participant's real (DB) pick is in: season
  // complete, OR the dev-only force override, OR everyone eligible has
  // picked — not gated on games having started, so standings appear the
  // moment the last active participant picks, even pre-kickoff.
  // devForceLeaderboard is a separate dev-only override, never required for
  // correct production behavior.
  const showResultsSection = heroWeekState === 'season_complete'
    || (showDebugPanel() && devForceLeaderboard)
    || (statsActive > 0 && activeWithPick >= statsActive);

  return (
    <div style={{ background: bg, minHeight: '100vh' }}>
      <AppNav isAuthenticated={isAdmin} isSuperAdmin={isSuperAdmin} onSignOut={handleLogout} poolId={poolId} />

      <PoolPicksHero
        poolName={pool?.name ?? 'Loading…'}
        isTestMode={pool?.isTestMode}
        weekTitle={heroWeekTitle}
        titleAccent={heroTitleAccent}
        // No WeekNav: Survivor has exactly one actionable week at a time —
        // computeSurvivorPoolState (src/lib/survivor.ts) always resolves
        // "the next unresolved week" server-side, with no per-week query
        // param anywhere in /api/survivor/state. Browsing past/future weeks
        // isn't a real capability here the way it is for Confidence/Pick'em
        // (past weeks are Leaderboard's job; a future week can't be picked
        // yet), so there is no equivalent control to adapt.
        itemCountLabel={`${currentWeekGames.length} games`}
        seasonTypeName={seasonTypeNames[state?.currentWeek?.seasonType ?? Math.max(...(pool?.seasonScope ?? [2]))] || 'Regular'}
        weekState={heroWeekState}
        gamesStarted={effectiveGamesStarted}
        unlockTime={heroUnlockTime}
        unlockFallbackMessage="Picks aren't unlocked yet — they open a few days before the first game's kickoff."
        lastUpdated={lastUpdated}
        subtitle="Choose one team to survive this week."
        actions={[
          { label: 'Share', icon: Share2, onClick: handleShare },
          { label: 'Stats', icon: Users, onClick: () => setShowStats(!showStats) },
          // Once results-section auto-shows (season complete, or everyone
          // eligible has picked — matches Confidence's showResultsTabs),
          // nothing left to toggle.
          ...(!showResultsSection ? [{ label: showResults ? 'Hide Standings' : 'Show Standings', icon: Eye, onClick: () => setShowResults(!showResults) }] : []),
        ]}
        learnMoreHref="/how-to/survivor-picks"
        learnMoreText="Survivor picks"
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
                <Users style={{ width: 15, height: 15, color: greenHi }} />
                <span style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', color: text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pool Statistics</span>
              </div>
              <div style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                {[
                  { label: 'Total Participants', value: statsTotal, color: greenHi },
                  { label: 'Active', value: statsActive, color: 'oklch(58% 0.15 250)' },
                  { label: 'Eliminated', value: statsEliminated, color: red },
                  { label: 'Your Pick', value: myCurrentWeekPick ? 'Made' : myState?.status === 'ACTIVE' ? 'Not Made' : 'N/A', color: gold },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div style={{ ...bc, fontWeight: 900, fontSize: '1.75rem', color, lineHeight: 1 }}>{value}</div>
                    <div style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.25rem' }}>{label}</div>
                  </div>
                ))}
              </div>
              {state?.currentWeek && (
                <div style={{ padding: '0 1.25rem 1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...b, fontSize: '0.75rem', color: textDim, marginBottom: '0.4rem' }}>
                    <span>Active Participants Who Have Picked</span>
                    <span style={{ color: textMid }}>{activeWithPick} of {statsActive}</span>
                  </div>
                  <div style={{ height: 6, background: 'oklch(26% 0.03 255)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: `linear-gradient(90deg, ${green}, oklch(58% 0.15 250))`, borderRadius: 3, width: `${statsActive > 0 ? (activeWithPick / statsActive) * 100 : 0}%`, transition: 'width 0.3s ease' }} />
                  </div>
                </div>
              )}
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
              currentWeek={state?.currentWeek?.week ?? null}
              currentSeasonType={state?.currentWeek?.seasonType ?? null}
              gamesCount={currentWeekGames.length}
              gamesStarted={effectiveGamesStarted}
              weekEnded={weekEnded}
              selectedUserLabel={myState ? `${myState.participantName} (${myState.participantId})` : null}
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
              <div style={{ ...b, fontSize: '0.68rem', color: 'oklch(65% 0.1 250)', marginTop: '0.6rem', marginBottom: '0.4rem' }}>
                <strong>Used Teams:</strong> {myState && myUsedTeams.size > 0 ? [...myUsedTeams].join(', ') : 'None'}
              </div>
              {myState && myState.picks.length > 0 && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', ...b, fontSize: '0.68rem' }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid oklch(58% 0.15 250 / 0.25)` }}>
                        {['Week', 'Selected Team', 'Game', 'Locked?', 'Result'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '0.3rem 0.5rem', color: 'oklch(68% 0.12 250)', fontWeight: 700 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {myState.picks.map(pick => {
                        const isCurrentWeek = state?.currentWeek?.week === pick.week && state?.currentWeek?.seasonType === pick.seasonType;
                        const game = isCurrentWeek ? currentWeekGames.find(g => g.id === pick.gameId) : undefined;
                        return (
                          <tr key={`${pick.seasonType}-${pick.week}`} style={{ borderBottom: `1px solid oklch(58% 0.15 250 / 0.15)` }}>
                            <td style={{ padding: '0.3rem 0.5rem', color: 'oklch(65% 0.1 250)' }}>{pick.week}</td>
                            <td style={{ padding: '0.3rem 0.5rem', color: 'oklch(65% 0.1 250)' }}>{pick.selectedTeam}</td>
                            <td style={{ padding: '0.3rem 0.5rem', color: 'oklch(65% 0.1 250)' }}>{game ? `${game.awayTeam} @ ${game.homeTeam}` : `Week ${pick.week}`}</td>
                            <td style={{ padding: '0.3rem 0.5rem', color: 'oklch(65% 0.1 250)' }}>{isCurrentWeek && weekUnlocked ? 'No' : 'Yes'}</td>
                            <td style={{ padding: '0.3rem 0.5rem', color: 'oklch(65% 0.1 250)' }}>{pick.result}</td>
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
                <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase' }}>Survivor Standings</p>
              </div>
              <SurvivorStandingsPanel poolId={poolId} />
            </div>
          </div>
        </section>
      )}

      {/* Same structure as Confidence: once showResultsSection is true
          (matches Confidence's showResultsTabs), the entire picker/picks-form
          section — including "Who's picking?" — disappears, same as
          pool-picks-content.tsx's `{!showResultsTabs && (...)}` wrapper.
          There's nothing left to pick once everyone eligible has picked, so
          it shouldn't keep prompting for a name. forcePicks (dev only)
          bypasses this the same way it does in Confidence — for reviewing a
          participant's own locked/finished pick after standings would
          otherwise take over. Inside that, the participant picker and the
          picks form are mutually exclusive, not stacked — selecting a name
          replaces "Who's picking?" with the picks form. */}
      {(!showResultsSection || (showDebugPanel() && forcePicks)) && (!selectedParticipantId || !myState ? (
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
              {state?.participants.map(p => (
                <option key={p.participantId} value={p.participantId}>
                  {p.participantName}{p.status !== 'ACTIVE' ? ` (${p.status === 'WINNER' ? 'Winner' : 'Eliminated'})` : ''}
                </option>
              ))}
            </select>
          </div>
        </section>
      ) : (
        <section style={{ background: bg, padding: '2rem 0' }}>
          <div className="lp-inner">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <p style={{ ...b, fontSize: '0.82rem', color: textMid }}>
                Picking as <strong style={{ color: text }}>{myState.participantName}</strong>
              </p>
              <button
                type="button"
                onClick={handleChangeParticipant}
                style={{ background: 'transparent', border: 'none', color: textDim, ...b, fontSize: '0.78rem', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
              >
                Not you? Switch
              </button>
            </div>
            <StatusBanner myState={myState} />

            {/* forceWeekUnlocked also bypasses the ACTIVE-only gate here
                (dev only) — an eliminated participant otherwise can't reach
                the picking UI at all, which would make it impossible to
                dev-test submitting for a locked/finished game once
                noPickRule has already auto-eliminated them for it. */}
            {(myState.status === 'ACTIVE' || (showDebugPanel() && forceWeekUnlocked)) && state?.currentWeek && (
              <div style={{ marginTop: '1.5rem' }}>
                <h2 style={{ ...bc, fontWeight: 800, fontSize: '1.1rem', color: text, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                  Choose Your Team
                </h2>
                <p style={{ ...b, fontSize: '0.85rem', color: textMid, marginBottom: '1.25rem' }}>
                  Select one team for Week {state.currentWeek.week}. You can only use each team once during the pool.
                </p>

                {/* Real lock: once this participant has a saved pick for the
                    current week, the pick buttons below are replaced with a
                    locked row (same as Pick'em's one-submission lock) — this
                    banner explains why. */}
                {isParticipantSubmitted(selectedParticipantId) && weekUnlocked && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '0.85rem 1.25rem', marginBottom: '1.25rem' }}>
                    <Lock style={{ width: 18, height: 18, color: textDim, flexShrink: 0 }} />
                    <p style={{ ...b, fontSize: '0.82rem', color: textMid }}>
                      Your pick is submitted for this week{devSimSubmitted ? ' (simulated)' : ''}. Contact your commissioner if you need it changed.
                    </p>
                  </div>
                )}

                {effectiveGamesStarted && !weekEnded && statsActive > 0 && activeWithPick < statsActive && !forcePicks && (
                  <div style={{ background: `${amber}14`, border: `1px solid ${amber}44`, borderRadius: 8, padding: '0.85rem 1.25rem', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                      <Clock style={{ width: 15, height: 15, color: amber, flexShrink: 0 }} />
                      <span style={{ ...bc, fontWeight: 800, fontSize: '0.82rem', color: amber, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Waiting for All Submissions</span>
                    </div>
                    <p style={{ ...b, fontSize: '0.78rem', color: textMid }}>{activeWithPick} of {statsActive} active participants have submitted picks — standings will show automatically once everyone has.</p>
                  </div>
                )}

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

                {/* Locked when the week itself has locked (kickoff), OR this
                    participant already has a saved pick for the week — the
                    real, DB-backed one-submission lock, same reuse-the-locked
                    -row pattern as Pick'em's LockedPickemGameRow. */}
                {!weekUnlocked || isParticipantSubmitted(selectedParticipantId) ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {!weekUnlocked && !myCurrentWeekPick && (
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {/* Same team-logo + city presentation as Confidence's GameCard
                              and this page's own LockedSurvivorGameRow — the open
                              (pickable) state shouldn't look like a visually unrelated
                              plain-text button row. */}
                          {[
                            { team: game.awayTeamId, fullName: game.awayTeam },
                            { team: game.homeTeamId, fullName: game.homeTeam },
                          ].map(({ team, fullName }) => {
                            if (!team) return null;
                            // Draft state (not the last-saved pick) drives what's
                            // shown as selected/used — a currently-drafted team
                            // shouldn't show as "used" just because it matches
                            // the not-yet-overwritten saved pick, same
                            // immediate-feedback model as Pick'em's draftPicks.
                            const isDraftedHere = draftPick?.gameId === game.id && draftPick?.team === team;
                            const used = myUsedTeams.has(team) && !isDraftedHere;
                            const picked = isDraftedHere;
                            const teamInfo = getTeam(getTeamAbbreviation(fullName));
                            return (
                              <button
                                key={team}
                                type="button"
                                disabled={used || submitting}
                                onClick={() => handleSelectTeam(game.id, team)}
                                style={{
                                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem',
                                  padding: '0.75rem 0.5rem', borderRadius: 8,
                                  background: picked ? 'oklch(46% 0.14 155 / 0.1)' : 'transparent',
                                  border: `1px solid ${picked ? 'oklch(46% 0.14 155 / 0.3)' : border}`,
                                  opacity: used ? 0.5 : 1,
                                  cursor: used || submitting ? 'not-allowed' : 'pointer',
                                }}
                              >
                                <TeamLogo team={teamInfo} size="md" colorAccent />
                                <span style={{ ...bc, fontWeight: 700, fontSize: '0.82rem', color: picked ? text : used ? textDim : textMid, textAlign: 'center' }}>
                                  {teamInfo.city}
                                </span>
                                {picked && (
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', ...bc, fontSize: '0.62rem', fontWeight: 700, color: greenHi, textTransform: 'uppercase' }}>
                                    <CheckCircle2 style={{ width: 11, height: 11 }} /> Selected
                                  </span>
                                )}
                                {used && (
                                  <span style={{ ...bc, fontSize: '0.6rem', fontWeight: 700, color: textDim, textTransform: 'uppercase' }}>Used</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={handleSubmitPick}
                      disabled={submitting || !draftPick}
                      style={{
                        width: '100%', padding: '0.85rem 1rem',
                        background: submitting || !draftPick ? border : green,
                        color: submitting || !draftPick ? textDim : text,
                        border: 'none', borderRadius: 8,
                        cursor: submitting || !draftPick ? 'not-allowed' : 'pointer',
                        ...bc, fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.06em', textTransform: 'uppercase',
                      }}
                    >
                      {submitting ? 'Submitting…' : 'Submit Pick'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      ))}
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
                ? `Your pick (${myState.eliminatedTeamName ?? myState.eliminatedTeam}) tied.`
                : `Your pick (${myState.eliminatedTeamName ?? myState.eliminatedTeam}) lost.`}
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

