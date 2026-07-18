'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { notFound } from 'next/navigation';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { WeeklyPick } from '@/components/picks/weekly-pick';
import { GameCard } from '@/components/picks/game-card';
import { PickUserSelection } from '@/components/picks/pick-user-selection';
import { RecentPicksViewer } from '@/components/picks/recent-picks-viewer';
import { Leaderboard } from '@/components/leaderboard/leaderboard';
import { SeasonLeaderboard } from '@/components/leaderboard/season-leaderboard';
import { QuarterLeaderboard } from '@/components/leaderboard/quarter-leaderboard';
import { ArrowLeft, Trophy, Users, Calendar, Clock, AlertTriangle, Info, Share2, BarChart3, Eye, EyeOff, Target, Zap, Lock, Unlock, LogOut, RefreshCw, Crown, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { pickStorage } from '@/lib/pick-storage';
import { getUpcomingWeek } from '@/actions/loadCurrentWeek';
import { loadWeekGames } from '@/actions/loadWeekGames';
import { Game, SelectedUser } from '@/types/game';
import { useRouter } from 'next/navigation';
import { userSessionManager } from '@/lib/user-session';
import { debugLog, DEFAULT_POOL_SEASON, SESSION_CLEANUP_INTERVAL, PERIOD_WEEKS, getWeekTitle as getWeekTitleUtil, getMaxWeeksForSeason, SEASON_TYPE_OPTIONS, debugError} from '@/lib/utils';
import { OffseasonBanner } from '@/components/ui/offseason-banner';

// Design tokens
const bg      = 'oklch(13% 0.025 255)';
const surface = 'oklch(17% 0.028 255)';
const card    = 'oklch(20% 0.03 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const gold    = 'oklch(74% 0.16 72)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const amber   = 'oklch(72% 0.16 60)';
const purple  = 'oklch(65% 0.12 290)';
const liveRed = 'oklch(62% 0.22 25)';
const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

function getPeriodName(seasonType: number, week: number): string {
  if (seasonType === 2 && week <= 4) return 'Period 1';
  if (seasonType === 2 && week <= 9) return 'Period 2';
  if (seasonType === 2 && week <= 14) return 'Period 3';
  if (seasonType === 2 && week <= 18) return 'Period 4';
  if (seasonType === 3 && week <= 4) return 'Playoffs';
  return 'Unknown Period';
}

function getPeriodNumber(seasonType: number, week: number): number {
  if (seasonType === 2 && week <= 4) return 1;
  if (seasonType === 2 && week <= 9) return 2;
  if (seasonType === 2 && week <= 14) return 3;
  if (seasonType === 2 && week <= 18) return 4;
  if (seasonType === 3 && week <= 4) return 5;
  return 0;
}

function getPeriodWeeks(seasonType: number, week: number): number[] {
  if (seasonType === 1 && week <= 4) return [1, 2, 3, 4];
  if (seasonType === 1 && week <= 9) return [5, 6, 7, 8, 9];
  if (seasonType === 1 && week <= 14) return [10, 11, 12, 13, 14];
  if (seasonType === 1 && week <= 18) return [15, 16, 17, 18];
  if (seasonType === 3 && week <= 4) return [1, 2, 3, 4];
  return [];
}

function PicksNav({ isAdmin, onLogout, router }: { isAdmin: boolean; onLogout: () => void; router: ReturnType<typeof useRouter> }) {
  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'oklch(13% 0.025 255 / 0.95)',
      backdropFilter: 'blur(14px)',
      borderBottom: `1px solid ${border}`,
    }}>
      <div className="lp-inner" style={{ paddingTop: '0.75rem', paddingBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', rowGap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
            {isAdmin && (
              <Link href="/admin/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.6rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer', textDecoration: 'none', flexShrink: 0 }}>
                <ArrowLeft style={{ width: 12, height: 12 }} />
                <span className="pools-nav-label">Dashboard</span>
              </Link>
            )}
            {isAdmin && <div style={{ width: 1, height: 20, background: border, flexShrink: 0 }} />}
            <span style={{ ...bc, fontWeight: 800, fontSize: '0.92rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              Sunday Huddle
            </span>
          </div>
          {isAdmin && (
            <button
              onClick={onLogout}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.7rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
            >
              <LogOut style={{ width: 11, height: 11 }} />
              <span className="pools-nav-label">Log Out</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

function WeekNav({
  currentWeek,
  currentSeasonType,
  upcomingWeek,
  seasonScope,
  onPrev,
  onCurrent,
  onNext,
  onJumpToWeek,
}: {
  currentWeek: number;
  currentSeasonType: number;
  upcomingWeek: { week: number; seasonType: number };
  seasonScope: number[];
  onPrev: () => void;
  onCurrent: () => void;
  onNext: () => void;
  onJumpToWeek: (week: number, seasonType: number) => void;
}) {
  const isCurrentWeek = currentWeek === upcomingWeek.week && currentSeasonType === upcomingWeek.seasonType;
  const scopeSorted = [...seasonScope].sort((a, b) => a - b);
  const minScope = scopeSorted[0] ?? 2;
  const maxScope = scopeSorted[scopeSorted.length - 1] ?? 2;
  const prevDisabled = currentSeasonType <= minScope && currentWeek <= 1;
  const nextDisabled = currentSeasonType >= maxScope && currentWeek >= getMaxWeeksForSeason(maxScope);
  const btnBase: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.75rem', border: `1px solid ${border}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.12s' };
  // When a pool spans more than one season type (e.g. regular season +
  // playoffs), list every week across all of them in one dropdown — marking
  // where a new season type begins — instead of only the current type.
  const weekOptions = scopeSorted.flatMap((seasonType, groupIndex) =>
    Array.from({ length: getMaxWeeksForSeason(seasonType) }, (_, i) => ({
      week: i + 1,
      seasonType,
      isSeasonStart: i === 0 && groupIndex > 0,
      seasonLabel: SEASON_TYPE_OPTIONS.find((o) => o.value === seasonType)?.label ?? '',
    }))
  );
  return (
    <div className="week-nav" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
      <button className='week-nav-prev' onClick={onPrev} disabled={prevDisabled} style={{ ...btnBase, background: 'transparent', color: prevDisabled ? textDim : textMid, opacity: prevDisabled ? 0.4 : 1, cursor: prevDisabled ? 'not-allowed' : 'pointer' }}>
        <ChevronLeft style={{ width: 13, height: 13 }} /> Prev
      </button>
      <button className='week-nav-current' onClick={onCurrent} style={{ ...btnBase, background: isCurrentWeek ? green : 'transparent', color: isCurrentWeek ? text : textMid, borderColor: isCurrentWeek ? green : border }}>
        <Calendar style={{ width: 12, height: 12 }} /> Current
      </button>
      <button className='week-nav-next' onClick={onNext} disabled={nextDisabled} style={{ ...btnBase, background: 'transparent', color: nextDisabled ? textDim : textMid, opacity: nextDisabled ? 0.4 : 1, cursor: nextDisabled ? 'not-allowed' : 'pointer' }}>
        Next <ChevronRight style={{ width: 13, height: 13 }} />
      </button>
      <Select
        value={`${currentSeasonType}-${currentWeek}`}
        onValueChange={(v) => {
          const [seasonType, week] = v.split('-').map(Number);
          onJumpToWeek(week, seasonType);
        }}
      >
        <SelectTrigger aria-label="Jump to week" className="week-nav-select-trigger">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {weekOptions.map(({ week, seasonType, isSeasonStart, seasonLabel }) => (
            <SelectItem key={`${seasonType}-${week}`} value={`${seasonType}-${week}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>Week {week}</span>
                {isSeasonStart && (
                  <span
                    title={`Start of ${seasonLabel}`}
                    style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: amber, flexShrink: 0 }}
                  />
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function PoolPicksContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const poolId = params.id as string;
  const weekParam = searchParams.get('week');
  const seasonTypeParam = searchParams.get('seasonType');

  const [poolName, setPoolName] = useState<string>('');
  const [currentWeek, setCurrentWeek] = useState<number>(1);
  const [currentSeasonType, setCurrentSeasonType] = useState<number>(2);
  const [poolSeason, setPoolSeason] = useState<number>(DEFAULT_POOL_SEASON);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [games, setGames] = useState<Game[]>([]);
  const [isTestMode, setIsTestMode] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showGameDetails, setShowGameDetails] = useState(true);
  const [countdown, setCountdown] = useState<string>('');
  const [showQuickStats, setShowQuickStats] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [submittedCount, setSubmittedCount] = useState(0);
  const [showRecentPicks, setShowRecentPicks] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState<Record<string, { submitted: boolean; name: string }>>({});
  const [isPoolAdmin, setIsPoolAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [gamesStarted, setGamesStarted] = useState(false);
  // const [hasPicks, setHasPicks] = useState(false); // retained for future use
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [weekWinner, setWeekWinner] = useState<{
    participant_name: string;
    points: number;
    correct_picks: number;
  } | null>(null);
  const [weekHasPicks, setWeekHasPicks] = useState(false);
  const [weekEnded, setWeekEnded] = useState(false);
  const [upcomingWeek, setUpcomingWeek] = useState<{week: number, seasonType: number}>({week: 1, seasonType: 2});
  const [isOffseasonState, setIsOffseasonState] = useState(false);
  const [isPoolClosed, setIsPoolClosed] = useState(false);
  const [poolSeasonScope, setPoolSeasonScope] = useState<number[]>([2]);
  const [forcePicks, setForcePicks] = useState(process.env.NEXT_PUBLIC_DUMMY_DATA === 'true');
  const [forceWeekUnlocked, setForceWeekUnlocked] = useState(false);
  const [devSimInProgress, setDevSimInProgress] = useState(false);
  const [devSimFinished, setDevSimFinished] = useState(false);
  const [devForceLeaderboard, setDevForceLeaderboard] = useState(false);
  const [activeResultsTab, setActiveResultsTab] = useState<'leaderboard' | 'results'>('leaderboard');

  const { toast } = useToast();
  const router = useRouter();

  const getWeekTitle = () => getWeekTitleUtil(currentWeek, currentSeasonType);

  useEffect(() => {
    if (!poolName) return;
    document.title = `${poolName} - ${getWeekTitle()} | Sunday Huddle`;
  }, [poolName, currentWeek, currentSeasonType]);

  const checkPlayoffConfidencePointsSubmission = async (season?: number): Promise<boolean> => {
    if (!poolId) return false;

    let seasonToUse = season || poolSeason;

    if (!seasonToUse) {
      try {
        const response = await fetch(`/api/pools/${poolId}`);
        const data = await response.json();
        if (data.success && data.pool?.season) {
          seasonToUse = data.pool.season;
        } else {
          return false;
        }
      } catch (error) {
        debugError('Error fetching pool season:', error);
        return false;
      }
    }

    try {
      const response = await fetch(`/api/playoffs/${poolId}/confidence-points?season=${seasonToUse}`);
      const data = await response.json();

      if (data.success) {
        return data.allSubmitted || false;
      }
      return false;
    } catch (error) {
      debugError('Error checking playoff confidence points submission:', error);
      return false;
    }
  };

  const navigateToWeek = async (week: number, seasonType: number) => {
    let targetWeek = week;
    let targetSeasonType = seasonType;
    const maxWeeks = getMaxWeeksForSeason(seasonType);

    const scopeSorted = [...poolSeasonScope].sort((a, b) => a - b);
    const minScope = scopeSorted[0];
    const maxScope = scopeSorted[scopeSorted.length - 1];

    debugLog('Navigate to week:', { week, seasonType, targetWeek, targetSeasonType, maxWeeks, scope: scopeSorted });

    if (week < 1) {
      if (seasonType <= minScope) return;
      const prevScope = scopeSorted.filter(s => s < seasonType).pop();
      if (!prevScope) return;
      targetSeasonType = prevScope;
      targetWeek = getMaxWeeksForSeason(prevScope);
    } else if (week > maxWeeks) {
      if (seasonType >= maxScope) return;
      const nextScope = scopeSorted.find(s => s > seasonType);
      if (!nextScope) return;
      if (seasonType === 2) {
        const allSubmitted = await checkPlayoffConfidencePointsSubmission();
        if (!allSubmitted) {
          window.location.href = `/pool/${poolId}/playoffs`;
          return;
        }
      }
      targetSeasonType = nextScope;
      targetWeek = 1;
    } else if (targetSeasonType === 3) {
      const allSubmitted = await checkPlayoffConfidencePointsSubmission();
      if (!allSubmitted) {
        window.location.href = `/pool/${poolId}/playoffs`;
        return;
      }
    }

    const newUrl = `/pool/${poolId}/picks?week=${targetWeek}&seasonType=${targetSeasonType}`;
    window.location.href = newUrl;
  };

  const navigateToCurrentWeek = async () => {
    try {
      const upcomingWeek = await getUpcomingWeek();
      if (upcomingWeek.seasonType === 3) {
        const allSubmitted = await checkPlayoffConfidencePointsSubmission();
        if (!allSubmitted) {
          window.location.href = `/pool/${poolId}/playoffs`;
          return;
        }
        const newUrl = `/pool/${poolId}/picks?week=${upcomingWeek.week}&seasonType=3`;
        window.location.href = newUrl;
        return;
      }
      const newUrl = `/pool/${poolId}/picks?week=${upcomingWeek.week}&seasonType=${upcomingWeek.seasonType}`;
      window.location.href = newUrl;
    } catch (error) {
      debugError('Error getting current week:', error);
      const newUrl = `/pool/${poolId}/picks?week=1&seasonType=2&season=${poolSeason}`;
      window.location.href = newUrl;
    }
  };

  const checkWeekStatus = async () => {
    if (games.length === 0) return;

    const allGamesEnded = games.every(game => {
      const status = game.status?.toLowerCase();
      const hasWinner = game.winner && game.winner.trim() !== '';
      const isFinished = status === 'final' || status === 'post' || status === 'cancelled';
      const isTieGame = game.home_score !== null && game.away_score !== null &&
                       game.home_score === game.away_score;
      const gameEnded = isFinished && (hasWinner || isTieGame);

      debugLog('Week status check for game:', {
        game: `${game.away_team} @ ${game.home_team}`,
        status: game.status, winner: game.winner,
        home_score: game.home_score, away_score: game.away_score,
        isFinished, hasWinner, isTieGame, gameEnded
      });

      return gameEnded;
    });

    debugLog('Week status result:', {
      allGamesEnded, gamesCount: games.length,
      gamesStatus: games.map(g => ({ game: `${g.away_team} @ ${g.home_team}`, status: g.status, winner: g.winner }))
    });

    setWeekEnded(allGamesEnded);
    if (allGamesEnded) {
      debugLog('Week status result setWeekEnded if allGamesEnded:', {
        poolId, weekNumber: currentWeek, seasonType: currentSeasonType, season: poolSeason
      });
      try {
        const winnerCheckResponse = await fetch(`/api/admin/week-winner?poolId=${poolId}&week=${currentWeek}&seasonType=${currentSeasonType}&season=${poolSeason}`);

        if (winnerCheckResponse.ok) {
          const winnerCheck = await winnerCheckResponse.json();

          if (winnerCheck.winnerExists && winnerCheck.winner) {
            debugLog('Using existing winner from database:', winnerCheck.winner);
            setWeekWinner({
              participant_name: winnerCheck.winner.winner_name,
              points: winnerCheck.winner.winner_points,
              correct_picks: winnerCheck.winner.winner_correct_picks
            });
            setWeekHasPicks(true);
            setShowLeaderboard(true);
            return;
          }
        }

        debugLog('No existing winner found, calculating from leaderboard');
        const response = await fetch(`/api/leaderboard?poolId=${poolId}&week=${currentWeek}&seasonType=${currentSeasonType}&season=${poolSeason}`);
        debugLog('Week status result setWeekEnded if allGamesEnded:', response);
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.leaderboard && result.leaderboard.length > 0) {
            debugLog('Leaderboard result:', result);
            const winner = result.leaderboard[0];
            debugLog('Winner from leaderboard:', winner);
            setWeekWinner({
              participant_name: winner.participant_name,
              points: winner.total_points,
              correct_picks: winner.correct_picks
            });
            setWeekHasPicks(true);
            setShowLeaderboard(true);

            if (winner.total_points > 0 && winner.correct_picks > 0) {
              try {
                const addWinnerResponse = await fetch('/api/admin/week-winner', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    poolId, week: currentWeek, season: poolSeason, seasonType: currentSeasonType,
                    winnerParticipantId: winner.participant_id,
                    winnerName: winner.participant_name,
                    winnerPoints: winner.total_points,
                    winnerCorrectPicks: winner.correct_picks,
                    totalParticipants: result.totalParticipants || 0
                  }),
                });

                if (addWinnerResponse.ok) {
                  const addResult = await addWinnerResponse.json();
                  debugLog('Winner added to database:', addResult);
                } else {
                  const errorData = await addWinnerResponse.json().catch(() => ({}));
                  debugError('Failed to add winner to database:', {
                    status: addWinnerResponse.status,
                    statusText: addWinnerResponse.statusText,
                    error: errorData.error || 'Unknown error',
                    details: errorData.details || '',
                    code: errorData.code || ''
                  });
                }
              } catch (error) {
                debugError('Error adding winner to database:', error);
              }
            }
          } else {
            setWeekHasPicks(false);
            setShowLeaderboard(true);
          }
        }
      } catch (error) {
        debugError('Error loading week winner:', error);
        setWeekHasPicks(false);
      }
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

  useEffect(() => {
    if (games.length === 0) return;

    const timer = setInterval(() => {
      const firstGame = games[0];
      const gameTime = new Date(firstGame.kickoff_time);
      const now = new Date();
      const timeDiff = gameTime.getTime() - now.getTime();

      if (timeDiff <= 0) {
        setCountdown('Games Started');
        return;
      }

      const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

      if (days > 0) {
        setCountdown(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setCountdown(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setCountdown(`${minutes}m ${seconds}s`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [games]);

  useEffect(() => {
    checkWeekStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [games, poolId, currentWeek, currentSeasonType, poolSeason]);

  useEffect(() => {
    if (weekEnded) {
      setShowLeaderboard(true);
    }
  }, [weekEnded]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    userSessionManager.cleanupExpiredSessions();

    const cleanupInterval = setInterval(() => {
      userSessionManager.cleanupExpiredSessions();
    }, SESSION_CLEANUP_INTERVAL);

    return () => clearInterval(cleanupInterval);
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);

      if (!poolId) {
        notFound();
        return;
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(poolId)) {
        notFound();
        return;
      }

      debugLog('Pool picks page: Starting data load with:', { poolId, weekParam, seasonTypeParam, currentWeek, currentSeasonType });

      let weekToUse: number;
      let seasonTypeToUse: number;
      const validSeasonTypes = [1, 2, 3] as const;
      const parsedSeasonType = seasonTypeParam ? parseInt(seasonTypeParam, 10) : 2;
      const isSeasonTypeValid = validSeasonTypes.includes(parsedSeasonType as 1 | 2 | 3);

      if (!isSeasonTypeValid) {
        try {
          const upcomingWeek = await getUpcomingWeek();
          debugLog('Upcoming week data:', upcomingWeek);
          if (upcomingWeek.seasonType === 0) {
            let resolvedWeek = 0;
            let resolvedSeasonType = 0;
            for (const [w, st] of [[1, 1], [1, 2]] as [number, number][]) {
              try {
                const games = await loadWeekGames(w, st);
                if (games.length > 0) { resolvedWeek = w; resolvedSeasonType = st; break; }
              } catch {}
            }
            if (!resolvedWeek) { setIsOffseasonState(true); setIsLoading(false); return; }
            weekToUse = resolvedWeek;
            seasonTypeToUse = resolvedSeasonType;
          } else {
            weekToUse = upcomingWeek.week;
            seasonTypeToUse = upcomingWeek.seasonType;
          }
          setCurrentWeek(weekToUse);
          setCurrentSeasonType(seasonTypeToUse);
          setUpcomingWeek({ week: weekToUse, seasonType: seasonTypeToUse });
          const newUrl = `/pool/${poolId}/picks?week=${weekToUse}&seasonType=${seasonTypeToUse}`;
          router.replace(newUrl, { scroll: false });
          debugLog('Pool picks page: Invalid season type, using current week - week:', weekToUse, 'season type:', seasonTypeToUse);
        } catch (error) {
          debugError('Error getting upcoming week:', error);
          weekToUse = 1;
          seasonTypeToUse = 2;
          setCurrentWeek(1);
          setCurrentSeasonType(2);
          setUpcomingWeek({ week: 1, seasonType: 2 });
        }
      } else if (weekParam && !isNaN(parseInt(weekParam, 10)) && parseInt(weekParam, 10) >= 1) {
        weekToUse = parseInt(weekParam, 10);
        seasonTypeToUse = parsedSeasonType;
        const maxWeeks = getMaxWeeksForSeason(seasonTypeToUse);

        if (weekToUse > maxWeeks) {
          weekToUse = maxWeeks;
          const newUrl = `/pool/${poolId}/picks?week=${weekToUse}&seasonType=${seasonTypeToUse}`;
          router.replace(newUrl, { scroll: false });
        }

        setCurrentWeek(weekToUse);
        setCurrentSeasonType(seasonTypeToUse);

        try {
          const upcomingWeek = await getUpcomingWeek();
          setUpcomingWeek({ week: upcomingWeek.week, seasonType: upcomingWeek.seasonType });
        } catch (error) {
          debugError('Error getting upcoming week:', error);
          setUpcomingWeek({ week: 1, seasonType: 2 });
        }

        debugLog('Pool picks page: Using URL parameters - week:', weekToUse, 'season type:', seasonTypeToUse);
      } else {
        const upcomingWeek = await getUpcomingWeek();
        if (upcomingWeek.seasonType === 0) {
          let resolvedWeek = 0;
          let resolvedSeasonType = 0;
          for (const [w, st] of [[1, 1], [1, 2]] as [number, number][]) {
            try {
              const games = await loadWeekGames(w, st);
              if (games.length > 0) { resolvedWeek = w; resolvedSeasonType = st; break; }
            } catch {}
          }
          if (!resolvedWeek) { setIsOffseasonState(true); setIsLoading(false); return; }
          weekToUse = resolvedWeek;
          seasonTypeToUse = resolvedSeasonType;
        } else {
          weekToUse = upcomingWeek.week;
          seasonTypeToUse = upcomingWeek.seasonType;
        }
        setCurrentWeek(weekToUse);
        setCurrentSeasonType(seasonTypeToUse);
        setUpcomingWeek({ week: weekToUse, seasonType: seasonTypeToUse });

        debugLog('Pool picks page: Using upcoming week - week:', weekToUse, 'season type:', seasonTypeToUse);

        toast({
          title: "Week not specified",
          description: `Showing upcoming week (Week ${weekToUse})`,
          duration: 3000,
        });
      }

      let localPoolSeason = DEFAULT_POOL_SEASON;

      try {
        const apiUrl = `/api/pools/${poolId}?week=${weekToUse}&seasonType=${seasonTypeToUse}`;
        debugLog('Pool picks page: Fetching from API:', apiUrl);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        debugLog('Fetching pool information with URL:', apiUrl);
        const response = await fetch(apiUrl, {
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
        });
        debugLog('API response for pool information:', response);

        clearTimeout(timeoutId);

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.pool) {
            const pool = result.pool;
            debugLog('Pool data:', pool);

            if (!pool.name || pool.name.trim() === '') {
              notFound();
              return;
            }

            const seasonValue = pool.season || DEFAULT_POOL_SEASON;
            localPoolSeason = seasonValue;
            setPoolName(pool.name);
            setPoolSeason(seasonValue);

            const scope: number[] = (Array.isArray(pool.season_scope) && pool.season_scope.length > 0)
              ? pool.season_scope
              : [2];
            setPoolSeasonScope(scope);

            if (!scope.includes(seasonTypeToUse)) {
              const scopeSorted = [...scope].sort((a, b) => a - b);
              seasonTypeToUse = scopeSorted[0];
              weekToUse = 1;
              setCurrentWeek(1);
              setCurrentSeasonType(seasonTypeToUse);
              router.replace(`/pool/${poolId}/picks?week=1&seasonType=${seasonTypeToUse}`, { scroll: false });
              debugLog('Pool picks page: Season type clamped to scope', { scope, seasonTypeToUse });
            }

            if (!pool.is_active) {
              setIsPoolClosed(true);
              return;
            }

            if (seasonTypeToUse === 3) {
              try {
                const confidenceResponse = await fetch(`/api/playoffs/${poolId}/confidence-points?season=${seasonValue}`);
                const confidenceData = await confidenceResponse.json();

                if (confidenceData.success && !confidenceData.allSubmitted) {
                  window.location.href = `/pool/${poolId}/playoffs`;
                  return;
                }
              } catch (error) {
                debugError('Error checking playoff confidence points:', error);
              }
            }

            setParticipantCount(pool.participant_count || 0);
            setIsTestMode(pool.is_test_mode || false);

            if (pool.picks_status) {
              setSubmittedCount(pool.picks_status.submittedCount || 0);
            }
          } else {
            notFound();
          }
        } else {
          const errorText = await response.text();
          debugError('API response error:', response.status, errorText);

          if (response.status === 404) {
            notFound();
          } else {
            setError(`Failed to load pool information (${response.status}). Please try again.`);
          }
        }
      } catch (error) {
        debugError('Error loading pool:', error);
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            setError('Request timed out. Please try again.');
          } else if (error.message.includes('fetch failed')) {
            setError('Network error: Unable to connect to the server. Please check your internet connection and try again.');
          } else {
            setError(`Failed to load pool information: ${error.message}`);
          }
        } else {
          setError('Failed to load pool information. Please try again.');
        }
        return;
      }

      try {
        const { getSupabaseClient } = await import('@/lib/supabase');
        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          const { data: admin } = await supabase
            .from('admins')
            .select('id, is_super_admin')
            .eq('id', session.user.id)
            .single();

          if (admin) {
            setIsAdmin(true);
            setIsSuperAdmin(admin.is_super_admin);

            if (poolId) {
              const { data: poolData } = await supabase
                .from('pools')
                .select('created_by')
                .eq('id', poolId)
                .single();

              if (poolData && poolData.created_by === session.user.email) {
                setIsPoolAdmin(true);
              }
            }
          }
        }
      } catch (error) {
        debugError('Error checking admin status:', error);
      }

      try {
        debugLog('Pool picks page: Loading games for week:', weekToUse, 'season type:', seasonTypeToUse, 'season:', localPoolSeason);

        let gamesData = await loadWeekGames(weekToUse, seasonTypeToUse, localPoolSeason);
        debugLog('Games data before filtering:', gamesData);

        if (gamesData.length > 0) {
          try {
            const recordsResponse = await fetch(`/api/team-records?season=${localPoolSeason}`, {
              headers: { 'Content-Type': 'application/json' },
            });

            if (recordsResponse.ok) {
              const recordsResult = await recordsResponse.json();
              if (recordsResult.success && recordsResult.records) {
                const recordsMapById = new Map<string, any>();
                const recordsMapByAbbr = new Map<string, any>();

                recordsResult.records.forEach((record: any) => {
                  const recordData = {
                    wins: record.wins || 0, losses: record.losses || 0, ties: record.ties || 0,
                    home_wins: record.home_wins, home_losses: record.home_losses, home_ties: record.home_ties,
                    road_wins: record.road_wins, road_losses: record.road_losses, road_ties: record.road_ties
                  };
                  if (record.team_id) recordsMapById.set(record.team_id, recordData);
                  if (record.team_abbreviation) recordsMapByAbbr.set(record.team_abbreviation.toLowerCase(), recordData);
                });

                gamesData = gamesData.map((game: Game) => {
                  let homeRecord = game.home_team_id ? recordsMapById.get(game.home_team_id.toString()) : undefined;
                  let awayRecord = game.away_team_id ? recordsMapById.get(game.away_team_id.toString()) : undefined;

                  if (!homeRecord && game.home_team_id) homeRecord = recordsMapByAbbr.get(game.home_team_id.toString().toLowerCase());
                  if (!homeRecord && game.home_team) homeRecord = recordsMapByAbbr.get(game.home_team.toLowerCase());
                  if (!awayRecord && game.away_team_id) awayRecord = recordsMapByAbbr.get(game.away_team_id.toString().toLowerCase());
                  if (!awayRecord && game.away_team) awayRecord = recordsMapByAbbr.get(game.away_team.toLowerCase());

                  return { ...game, home_team_record: homeRecord, away_team_record: awayRecord };
                });

                debugLog('Attached team records to games');
              }
            }
          } catch (recordsError) {
            debugError('Error fetching team records:', recordsError);
          }
        }

        const now = new Date();
        const currentYear = now.getFullYear();

        const validGames = gamesData.filter((game: Game) => {
          const gameTime = new Date(game.kickoff_time);
          const gameYear = gameTime.getFullYear();

          if (gameYear < 2020 || gameYear > currentYear + 1) {
            debugLog('Skipping game with test/invalid date:', { game: `${game.away_team} @ ${game.home_team}`, gameYear, currentYear, kickoff: gameTime.toISOString(), isTestData: true });
            return false;
          }
          return true;
        });

        debugLog('Valid games count:', validGames.length, 'out of', gamesData.length);

        let hasStarted = false;
        if (validGames.length > 0) {
          hasStarted = validGames.some((game: Game) => {
            const gameTime = new Date(game.kickoff_time);
            const bufferTime = 60 * 60 * 1000;
            const gameStarted = (gameTime.getTime() + bufferTime) <= now.getTime();
            debugLog('Game status check:', { game: `${game.away_team} @ ${game.home_team}`, kickoff: gameTime.toISOString(), now: now.toISOString(), bufferTime: bufferTime / (1000 * 60 * 60), gameStarted });
            return gameStarted;
          });
        } else {
          hasStarted = false;
          debugLog('All games are test data, setting gamesStarted to false');
        }

        setGames(validGames);
        setGamesStarted(hasStarted);
        debugLog('Overall games started status:', hasStarted);

        if (hasStarted) {
          setShowLeaderboard(true);
        }
      } catch (e) {
        debugError('Error loading games:', e);
        toast({ title: "Warning", description: "Could not load games data", variant: "destructive" });
      }

      if (poolId) {
        try {
          userSessionManager.cleanupExpiredSessions();

          const allSessions = userSessionManager.getAllSessions();
          const poolSession = allSessions.find(session => session.poolId === poolId);

          if (poolSession && poolSession.userId) {
            debugLog('Restoring user session:', poolSession);
            setSelectedUser({ id: poolSession.userId, name: poolSession.userName });
          }
        } catch {
          debugLog('No saved user session found for pool:', poolId);
        }
      }

      setLastUpdated(new Date());
    } catch (error) {
      debugError('Error loading pool picks data:', error);
      setError('Failed to load pool information. Please try again or contact the pool commissioner.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolId, weekParam]);

  useEffect(() => {
    if (isPoolClosed && poolId) {
      router.replace(`/pool/${poolId}/history?week=${currentWeek || 1}&seasonType=${currentSeasonType || 2}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPoolClosed]);

  useEffect(() => {
    loadParticipantStats();
    checkAdminPermissions();
    checkWeekPicksStatus();
  }, [poolId, currentWeek, currentSeasonType]);

  useEffect(() => {
    checkUserSubmissionStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser, poolId, currentWeek, currentSeasonType]);

  const handleRefresh = async () => {
    setIsLoading(true);
    setError('');
    await loadData();
  };

  const handleRetry = async () => {
    debugLog('Retrying data load...');
    await handleRefresh();
  };

  const handleUserSelected = (userId: string, userName: string) => {
    const user = { id: userId, name: userName };
    setSelectedUser(user);
    loadPicksFromLocalStorage(userId, poolId!, currentWeek);
  };

  const loadPicksFromLocalStorage = async (participantId: string, poolId: string, week: number) => {
    try {
      const { pickStorage } = await import('@/lib/pick-storage');

      if (pickStorage.hasValidPicks(participantId, poolId, week)) {
        const storedPicks = pickStorage.loadPicks(participantId, poolId, week);

        if (storedPicks && storedPicks.length > 0) {
          toast({
            title: "Picks Restored",
            description: `Found ${storedPicks.length} saved picks from your previous session. You can review and submit them.`,
            duration: 5000,
          });
          debugLog('Loaded picks from localStorage:', storedPicks);
        }
      } else {
        debugLog('No valid picks found in localStorage for:', { participantId, poolId, week });
      }
    } catch (err) {
      debugError('Error loading picks from localStorage:', err);
      toast({ title: "Warning", description: "Could not load saved picks from previous session", variant: "destructive" });
    }
  };

  const handlePicksSubmitted = async () => {
    setShowSuccessDialog(true);

    if (selectedUser) {
      setHasSubmitted(prev => ({ ...prev, [selectedUser.id]: { submitted: true, name: selectedUser.name } }));
    }

    await loadData();
    await loadParticipantStats();
    await checkUserSubmissionStatus();

    setSelectedUser(null);
    debugLog('Picks submitted successfully, clearing user selection to allow new user selection');
  };

  const handleUserChangeRequested = () => {
    debugLog('User change requested. Current user:', selectedUser);

    setSelectedUser(null);

    if (selectedUser) {
      const clearStoredPicks = async () => {
        try {
          pickStorage.clearPicks();
          debugLog('Cleared stored picks for user:', selectedUser.id);
        } catch (error) {
          debugError('Error clearing stored picks:', error);
        }
      };
      clearStoredPicks();
    }

    setHasSubmitted({});
    userSessionManager.cleanupExpiredSessions();
    debugLog('User selection interface should now be visible');

    toast({ title: "User Changed", description: "Please select a new user to make picks" });
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${poolName} - Week ${currentWeek} Picks`, text: `Join me in making picks for ${poolName} Week ${currentWeek}!`, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast({ title: "Link Copied", description: "Pool link copied to clipboard" });
      }
    } catch (e) {
      debugError('Error sharing:', e);
    }
  };

  const loadParticipantStats = async () => {
    debugLog('Participant stats loaded from API endpoint');
  };

  const checkUserSubmissionStatus = async () => {
    if (!poolId || !selectedUser) return;
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(poolId)) return;

    try {
      debugLog('Checking submission status for:', { participantId: selectedUser.id, poolId, currentWeek, currentSeasonType });

      const { getSupabaseServiceClient } = await import('@/lib/supabase');
      const supabase = getSupabaseServiceClient();

      const { data: gamesForWeek, error: gamesError } = await supabase
        .from('games')
        .select('id')
        .eq('week', currentWeek)
        .eq('season_type', currentSeasonType);

      if (gamesError) {
        debugError('Error fetching games for week:', gamesError);
        return;
      }

      debugLog('Games for week:', { gamesForWeek, count: gamesForWeek?.length || 0 });

      if (!gamesForWeek || gamesForWeek.length === 0) {
        debugLog('No games found for week, cannot check picks');
        return;
      }

      const gameIds = gamesForWeek.map(g => g.id);

      const { data: picks, error: picksError } = await supabase
        .from('picks')
        .select('id, game_id')
        .eq('participant_id', selectedUser.id)
        .eq('pool_id', poolId)
        .in('game_id', gameIds);

      if (picksError) {
        debugError('Error checking picks:', picksError.message ?? picksError.code ?? String(picksError));
        setHasSubmitted(prev => ({ ...prev, [selectedUser.id]: { submitted: false, name: selectedUser.name } }));
        return;
      }

      debugLog('Picks found for current user:', { picks, count: picks?.length || 0 });

      const hasSubmittedPicks = (picks?.length ?? 0) >= gameIds.length;
      setHasSubmitted(prev => ({ ...prev, [selectedUser.id]: { submitted: hasSubmittedPicks, name: selectedUser.name } }));

      debugLog('Submission status updated for current user:', { hasSubmitted: hasSubmittedPicks, picksCount: picks?.length || 0, gamesCount: gameIds.length });
    } catch (error) {
      debugError('Error checking submission status:', error);
    }
  };

  const checkWeekPicksStatus = async () => {
    debugLog('Week picks status loaded from API endpoint');
  };

  const checkAdminPermissions = async () => {
    debugLog('Admin permissions loaded from API endpoint');
  };

  const unlockParticipantPicks = async (participantId: string) => {
    if (!isPoolAdmin && !isSuperAdmin) {
      toast({ title: "Permission Denied", description: "Only pool commissioners or admins can unlock picks", variant: "destructive" });
      return;
    }

    try {
      const { getSupabaseServiceClient } = await import('@/lib/supabase');
      const supabase = getSupabaseServiceClient();

      const { error } = await supabase
        .from('picks')
        .delete()
        .eq('participant_id', participantId)
        .eq('pool_id', poolId)
        .in('game_id', games.map(g => g.id));

      if (error) throw error;

      await supabase
        .from('audit_logs')
        .insert({
          action: 'unlock_participant_picks',
          admin_id: null,
          entity: 'participant_picks',
          entity_id: participantId,
          details: {
            participant_id: participantId, pool_id: poolId,
            week: currentWeek, season_type: currentSeasonType,
            unlocked_by: isSuperAdmin ? 'admin' : 'pool_commissioner'
          }
        });

      toast({ title: "Picks Unlocked", description: "Participant can now make new picks" });
      setHasSubmitted(prev => ({ ...prev, [participantId]: { submitted: false, name: '' } }));
      await checkUserSubmissionStatus();
      await loadParticipantStats();
    } catch (error) {
      debugError('Error unlocking picks:', error);
      toast({ title: "Error", description: "Failed to unlock picks", variant: "destructive" });
    }
  };

  const getGameStatusStats = () => {
    if (games.length === 0) return null;

    const now = new Date();
    const stats = { total: games.length, upcoming: 0, inProgress: 0, finished: 0, locked: 0 };

    games.forEach(game => {
      const gameTime = new Date(game.kickoff_time);
      const timeDiff = gameTime.getTime() - now.getTime();

      if (timeDiff > 0) {
        stats.upcoming++;
        if (timeDiff <= 24 * 60 * 60 * 1000) stats.locked++;
      } else if (game.status === 'finished' || game.status === 'final' || game.winner) {
        stats.finished++;
      } else {
        stats.inProgress++;
      }
    });

    return stats;
  };

  const seasonTypeNames: Record<number, string> = { 1: 'Preseason', 2: 'Regular', 3: 'Postseason' };

  const devDisplayGames = (() => {
    if (process.env.NODE_ENV !== 'development') return games;
    const liveScores:  [number, number][] = [[7,3],[14,14],[21,10],[0,7],[17,21],[28,24],[3,10],[35,14]];
    const finalScores: [number, number][] = [[24,17],[31,28],[14,21],[38,35],[17,10],[21,7],[27,24],[13,10]];
    if (devSimFinished) {
      return games.map((g, i) => {
        const [hs, as_] = finalScores[i % finalScores.length];
        return { ...g, status: 'final', winner: hs >= as_ ? g.home_team : g.away_team, home_score: hs, away_score: as_ };
      });
    }
    if (devSimInProgress) {
      return games.map((g, i) => {
        if (i % 2 === 0) {
          const [hs, as_] = liveScores[i % liveScores.length];
          return { ...g, status: 'in_progress', home_score: hs, away_score: as_ };
        }
        return g;
      });
    }
    return games;
  })();
  const effectiveGamesStarted = gamesStarted || (process.env.NODE_ENV === 'development' && devSimInProgress);
  const showResultsTabs = weekEnded || (process.env.NODE_ENV === 'development' && devForceLeaderboard) || (effectiveGamesStarted && !weekEnded && submittedCount >= participantCount);

  // ── LOADING ──────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '2rem', width: '100%', maxWidth: 400, textAlign: 'center' }}>
          <RefreshCw style={{ width: 32, height: 32, color: textDim, margin: '0 auto 0.75rem', animation: 'spin 1s linear infinite' }} />
          <p style={{ ...b, color: textMid, fontSize: '0.9rem' }}>Loading pool picks…</p>
        </div>
      </div>
    );
  }

  // ── OFFSEASON ─────────────────────────────────────────────────────────────────
  if (isOffseasonState) {
    return (
      <div id='offseason-banner' style={{ minHeight: '100vh', background: bg }}>
        <PicksNav isAdmin={isAdmin} onLogout={handleLogout} router={router} />
        <section
          id="offseason-banner"
          style={{ background: bg, padding: 'clamp(2rem, 4vw, 3rem) 0' }}>
          <div className="lp-inner">
            <OffseasonBanner />
          </div>
        </section>
      </div>
    );
  }

  // ── ERROR ─────────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <div style={{ background: card, border: `1px solid ${border}`, borderTop: `3px solid ${liveRed}`, borderRadius: 10, padding: '2rem', width: '100%', maxWidth: 440, textAlign: 'center' }}>
          <AlertTriangle style={{ width: 36, height: 36, color: liveRed, margin: '0 auto 0.75rem' }} />
          <h2 style={{ ...bc, fontWeight: 800, fontSize: '1.05rem', color: text, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Error Loading Pool</h2>
          <p style={{ ...b, fontSize: '0.85rem', color: textMid, marginBottom: '1.25rem' }}>{error}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <button onClick={handleRetry} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.6rem 1rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}>
              <RefreshCw style={{ width: 13, height: 13 }} /> Retry
            </button>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.6rem 1rem', background: green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer', textDecoration: 'none' }}>
              <ArrowLeft style={{ width: 13, height: 13 }} /> Back to Home
            </Link>
          </div>
          {process.env.NODE_ENV === 'development' && (
            <div style={{ ...b, fontSize: '0.68rem', color: textDim, marginTop: '1rem', padding: '0.5rem 0.75rem', background: surface, border: `1px solid ${border}`, borderRadius: 5, textAlign: 'left' }}>
              <p><strong>Pool ID:</strong> {poolId || 'undefined'}</p>
              <p><strong>Week:</strong> {weekParam || 'undefined'}</p>
              <p><strong>Season Type:</strong> {seasonTypeParam || 'undefined'}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── HISTORICAL POOL — redirect to /history ────────────────────────────────────
  if (isPoolClosed) {
    return (
      <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '2rem', textAlign: 'center' }}>
          <RefreshCw style={{ width: 32, height: 32, color: textDim, margin: '0 auto 0.75rem', animation: 'spin 1s linear infinite' }} />
          <p style={{ ...b, color: textMid, fontSize: '0.9rem' }}>Redirecting to season history…</p>
        </div>
      </div>
    );
  }

  // ── WEEK ENDED — NO PICKS ─────────────────────────────────────────────────────
  debugLog('Early return check 1:', { weekEnded, weekHasPicks, condition: weekEnded && !weekHasPicks });

  if (weekEnded && !weekHasPicks) {
    return (
      <div style={{ minHeight: '100vh', background: bg }}>
        <PicksNav isAdmin={isAdmin} onLogout={handleLogout} router={router} />

        <section id='hero' style={{ background: bg, backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 59px, oklch(100% 0 0 / 0.022) 59px, oklch(100% 0 0 / 0.022) 60px)`, padding: 'clamp(1.5rem, 3vw, 2.5rem) 0' }}>
          <div className="lp-inner">
            <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.26em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ display: 'inline-block', width: 18, height: 2, background: greenHi, borderRadius: 1 }} />
              {poolName}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
              <h1 style={{ ...bc, fontWeight: 900, fontSize: 'clamp(1.5rem, 3vw, 2rem)', color: text, textTransform: 'uppercase' }}>
                {getWeekTitle()} <span style={{ color: gold }}>Picks</span>
              </h1>
              <WeekNav
                currentWeek={currentWeek} currentSeasonType={currentSeasonType} upcomingWeek={upcomingWeek}
                seasonScope={poolSeasonScope}
                onPrev={() => navigateToWeek(currentWeek - 1, currentSeasonType)}
                onCurrent={navigateToCurrentWeek}
                onNext={() => navigateToWeek(currentWeek + 1, currentSeasonType)}
                onJumpToWeek={(week, seasonType) => navigateToWeek(week, seasonType)}
              />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
              <span style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.08em', padding: '0.15rem 0.5rem', borderRadius: 4, textTransform: 'uppercase', background: 'oklch(26% 0.03 255)', color: textMid, border: `1px solid ${border}` }}>{games.length} games</span>
              <span style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.08em', padding: '0.15rem 0.5rem', borderRadius: 4, textTransform: 'uppercase', background: 'oklch(26% 0.03 255)', color: textMid, border: `1px solid ${border}` }}>{seasonTypeNames[seasonTypeParam ? parseInt(seasonTypeParam) : 2] || 'Regular'}</span>
            </div>
          </div>
        </section>
        <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${green}, transparent)` }} />

        <section
          id="no-picks-banner"
          style={{ background: bg, padding: '2rem 0' }}>
          <div className="lp-inner">
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '2.5rem', maxWidth: 520, margin: '0 auto', textAlign: 'center' }}>
              <Calendar style={{ width: 40, height: 40, color: textDim, margin: '0 auto 0.75rem' }} />
              <h2 style={{ ...bc, fontWeight: 800, fontSize: '1.15rem', color: text, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Week {currentWeek} Not Available</h2>
              <p style={{ ...b, fontSize: '0.85rem', color: textMid, marginBottom: '1.5rem' }}>No picks were submitted for this week in {poolName}.</p>
              <div style={{ ...b, fontSize: '0.82rem', color: textDim, textAlign: 'left', marginBottom: '1.5rem' }}>
                <p style={{ marginBottom: '0.5rem' }}>This week has already ended, but no participants submitted picks. This could happen if:</p>
                <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', listStyle: 'disc' }}>
                  <li>The pool was created after this week</li>
                  <li>No participants joined the pool for this week</li>
                  <li>All picks were deleted by an admin</li>
                </ul>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <Link href="/" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.6rem 1rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer', textDecoration: 'none' }}>
                  <ArrowLeft style={{ width: 13, height: 13 }} /> Back to Home
                </Link>
                {isAdmin && (
                  <Link href="/admin/dashboard" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.6rem 1rem', background: green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer', textDecoration: 'none' }}>
                    <Trophy style={{ width: 13, height: 13 }} /> Go to Dashboard
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // ── WEEK ENDED — WITH WINNER ──────────────────────────────────────────────────
  debugLog('Early return check 2:', { weekEnded, weekHasPicks, weekWinner: !!weekWinner, condition: weekEnded && weekHasPicks && weekWinner });
  if (weekEnded && weekHasPicks && weekWinner) {
    return (
      <div style={{ minHeight: '100vh', background: bg }}>
        <PicksNav isAdmin={isAdmin} onLogout={handleLogout} router={router} />

        <section
          id="final-results-banner"
          style={{ background: bg, backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 59px, oklch(100% 0 0 / 0.022) 59px, oklch(100% 0 0 / 0.022) 60px)`, padding: 'clamp(1.5rem, 3vw, 2.5rem) 0' }}>
          <div className="lp-inner">
            <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.26em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ display: 'inline-block', width: 18, height: 2, background: greenHi, borderRadius: 1 }} />
              {poolName}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
              <h1 style={{ ...bc, fontWeight: 900, fontSize: 'clamp(1.5rem, 3vw, 2rem)', color: text, textTransform: 'uppercase' }}>
                {getWeekTitle()} <span style={{ color: gold }}>Final Results</span>
              </h1>
              <WeekNav
                currentWeek={currentWeek} currentSeasonType={currentSeasonType} upcomingWeek={upcomingWeek}
                seasonScope={poolSeasonScope}
                onPrev={() => navigateToWeek(currentWeek - 1, currentSeasonType)}
                onCurrent={navigateToCurrentWeek}
                onNext={() => navigateToWeek(currentWeek + 1, currentSeasonType)}
                onJumpToWeek={(week, seasonType) => navigateToWeek(week, seasonType)}
              />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
              <span style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.08em', padding: '0.15rem 0.5rem', borderRadius: 4, textTransform: 'uppercase', background: 'oklch(26% 0.03 255)', color: textMid, border: `1px solid ${border}` }}>{games.length} games</span>
              {lastUpdated && <span style={{ ...b, fontSize: '0.68rem', color: textDim }}>Updated {lastUpdated.toLocaleTimeString()}</span>}
            </div>
          </div>
        </section>
        <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${gold}, transparent)` }} />

        <section
          id="final-results-banner"
          style={{ background: bg, padding: '2rem 0' }}
        >
          <div className="lp-inner" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            <div style={{ background: `linear-gradient(135deg, oklch(20% 0.04 72 / 0.6), oklch(18% 0.03 255))`, border: `1px solid oklch(74% 0.16 72 / 0.35)`, borderTop: `3px solid ${gold}`, borderRadius: 12, padding: '2rem', textAlign: 'center' }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: `oklch(74% 0.16 72 / 0.15)`, border: `2px solid oklch(74% 0.16 72 / 0.4)`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <Crown style={{ width: 32, height: 32, color: gold }} />
              </div>
              <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.26em', color: gold, textTransform: 'uppercase', marginBottom: '0.35rem' }}>Week {currentWeek} Winner</p>
              <h2 style={{ ...bc, fontWeight: 900, fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: text, textTransform: 'uppercase', lineHeight: 0.95, marginBottom: '0.75rem' }}>
                {weekWinner.participant_name}
              </h2>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ ...bc, fontWeight: 900, fontSize: '2rem', color: greenHi, lineHeight: 1 }}>{weekWinner.points}</div>
                  <div style={{ ...b, fontSize: '0.72rem', color: textDim }}>Points</div>
                </div>
                <div style={{ width: 1, background: border, alignSelf: 'stretch' }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ ...bc, fontWeight: 900, fontSize: '2rem', color: greenHi, lineHeight: 1 }}>{weekWinner.correct_picks}</div>
                  <div style={{ ...b, fontSize: '0.72rem', color: textDim }}>Correct Picks / {games.length}</div>
                </div>
              </div>
            </div>

            {showLeaderboard && (
              <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Trophy style={{ width: 16, height: 16, color: gold }} />
                  <span style={{ ...bc, fontWeight: 800, fontSize: '0.95rem', color: text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{getWeekTitle()} Final Results</span>
                </div>
                <div style={{ padding: '1.25rem' }}>
                  <Leaderboard poolId={poolId} weekNumber={currentWeek} seasonType={currentSeasonType} season={poolSeason} />
                </div>
              </div>
            )}

            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Trophy style={{ width: 16, height: 16, color: greenHi }} />
                <span style={{ ...bc, fontWeight: 800, fontSize: '0.95rem', color: text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Quarter Standings</span>
              </div>
              <div style={{ padding: '1.25rem' }}>
                <QuarterLeaderboard poolId={poolId} season={poolSeason} currentWeek={currentWeek} seasonType={currentSeasonType} />
              </div>
            </div>

            <details style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden' }}>
              <summary style={{ padding: '1rem 1.25rem', cursor: 'pointer', ...bc, fontWeight: 700, fontSize: '0.82rem', color: textMid, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Trophy style={{ width: 14, height: 14 }} /> Show Season {poolSeason} Standings
              </summary>
              <div style={{ borderTop: `1px solid ${border}`, padding: '1.25rem' }}>
                <SeasonLeaderboard poolId={poolId} season={poolSeason} currentWeek={currentWeek} currentSeasonType={currentSeasonType} />
              </div>
            </details>

            {currentSeasonType !== 1 && PERIOD_WEEKS.includes(currentWeek as typeof PERIOD_WEEKS[number]) && (
              <div style={{ background: `oklch(65% 0.12 290 / 0.08)`, border: `1px solid oklch(65% 0.12 290 / 0.3)`, borderRadius: 10, padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <Crown style={{ width: 16, height: 16, color: purple }} />
                  <span style={{ ...bc, fontWeight: 800, fontSize: '0.95rem', color: text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quarter Leaderboard</span>
                </div>
                <p style={{ ...b, fontSize: '0.82rem', color: textMid, marginBottom: '0.75rem' }}>
                  {getWeekTitle()} is a tie-breaker week! View the complete {currentSeasonType === 2 ? 'quarter' : 'playoffs'} standings.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <Link
                    href={`/periods/${poolId}/${poolSeason}/${getPeriodNumber(currentSeasonType, currentWeek)}?seasonType=${currentSeasonType}`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 1rem', background: purple, color: text, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.06em', textTransform: 'uppercase', textDecoration: 'none' }}
                  >
                    <ExternalLink style={{ width: 13, height: 13 }} />
                    View {currentSeasonType === 2 ? 'Quarter' : 'Playoffs'} Leaderboard
                  </Link>
                  <span style={{ ...b, fontSize: '0.75rem', color: textDim, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Info style={{ width: 12, height: 12 }} />
                    Includes weeks: {getPeriodWeeks(currentSeasonType, currentWeek).join(', ')}
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

  // ── MAIN PICKS PAGE ───────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: bg }}>
      <PicksNav isAdmin={isAdmin} onLogout={handleLogout} router={router} />

      <section
        id="hero"
        style={{ background: bg, backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 59px, oklch(100% 0 0 / 0.022) 59px, oklch(100% 0 0 / 0.022) 60px)`, padding: 'clamp(1.5rem, 3vw, 2.5rem) 0' }}>
        <div className="lp-inner">
          <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.26em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ display: 'inline-block', width: 18, height: 2, background: greenHi, borderRadius: 1 }} />
            {poolName}
            {isTestMode && <span style={{ ...bc, fontWeight: 700, fontSize: '0.6rem', letterSpacing: '0.08em', padding: '0.1rem 0.4rem', borderRadius: 4, background: `oklch(72% 0.16 60 / 0.2)`, color: amber, border: `1px solid oklch(72% 0.16 60 / 0.4)`, textTransform: 'uppercase' }}>Test Mode</span>}
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <h1 style={{ ...bc, fontWeight: 900, fontSize: 'clamp(1.5rem, 3vw, 2rem)', color: text, textTransform: 'uppercase' }}>
              {getWeekTitle()} <span style={{ color: gold }}>Picks</span>
            </h1>
            <WeekNav
              currentWeek={currentWeek} currentSeasonType={currentSeasonType} upcomingWeek={upcomingWeek}
              seasonScope={poolSeasonScope}
              onPrev={() => navigateToWeek(currentWeek - 1, currentSeasonType)}
              onCurrent={navigateToCurrentWeek}
              onNext={() => navigateToWeek(currentWeek + 1, currentSeasonType)}
              onJumpToWeek={(week, seasonType) => navigateToWeek(week, seasonType)}
            />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.08em', padding: '0.15rem 0.5rem', borderRadius: 4, textTransform: 'uppercase', background: 'oklch(26% 0.03 255)', color: textMid, border: `1px solid ${border}` }}>{games.length} games</span>
            <span style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.08em', padding: '0.15rem 0.5rem', borderRadius: 4, textTransform: 'uppercase', background: 'oklch(26% 0.03 255)', color: textMid, border: `1px solid ${border}` }}>{seasonTypeNames[seasonTypeParam ? parseInt(seasonTypeParam) : 2] || 'Regular'}</span>
            {lastUpdated && <span style={{ ...b, fontSize: '0.68rem', color: textDim }}>Updated {lastUpdated.toLocaleTimeString()}</span>}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.85rem' }}>
            {[
              { label: 'Share', icon: Share2, onClick: handleShare },
              { label: showGameDetails ? 'Unlock Week' : 'Game Details', icon: showGameDetails ? Unlock : Eye, onClick: () => setShowGameDetails(!showGameDetails) },
              { label: 'Stats', icon: Users, onClick: () => setShowQuickStats(!showQuickStats) },
              { label: 'Leaderboard', icon: BarChart3, onClick: () => router.push(`/pool/${poolId}/leaderboard`) },
              ...(currentSeasonType === 3 ? [{ label: 'Confidence Pts', icon: Target, onClick: () => router.push(`/pool/${poolId}/playoffs`) }] : []),
              ...(weekEnded ? [{ label: showLeaderboard ? 'Hide Results' : 'Show Results', icon: Eye, onClick: () => setShowLeaderboard(!showLeaderboard) }] : []),
            ].map(({ label, icon: Icon, onClick }) => (
              <button key={label} onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.7rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}>
                <Icon style={{ width: 12, height: 12 }} /> {label}
              </button>
            ))}
          </div>
        </div>
      </section>
      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${green}, transparent)` }} />

      <section
        id="picks-content"
        style={{ background: bg, padding: '1.5rem 0 3rem' }}>
        <div className="lp-inner" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {showQuickStats && (
            <div
              id="quick-stats-card"
              style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users style={{ width: 15, height: 15, color: greenHi }} />
                <span style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', color: text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pool Statistics</span>
              </div>
              <div
                id="quick-stats-grid"
                style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                {[
                  { label: 'Total Participants', value: participantCount, color: greenHi },
                  { label: 'Submitted', value: submittedCount, color: 'oklch(58% 0.15 250)' },
                  { label: 'Pending', value: participantCount - submittedCount, color: amber },
                  { label: 'Completion', value: `${participantCount > 0 ? Math.round((submittedCount / participantCount) * 100) : 0}%`, color: purple },
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
                  <span style={{ color: textMid }}>{submittedCount} of {participantCount}</span>
                </div>
                <div style={{ height: 6, background: 'oklch(26% 0.03 255)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: `linear-gradient(90deg, ${green}, oklch(58% 0.15 250))`, borderRadius: 3, width: `${participantCount > 0 ? (submittedCount / participantCount) * 100 : 0}%`, transition: 'width 0.3s ease' }} />
                </div>
              </div>
            </div>
          )}

          {(() => {
            const stats = getGameStatusStats();
            if (!stats) return null;
            return (
              <div id="game-status-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                {[
                  { label: 'Total', value: stats.total, color: 'oklch(58% 0.15 250)' },
                  { label: 'Upcoming', value: stats.upcoming, color: greenHi },
                  { label: 'In Progress', value: stats.inProgress, color: amber },
                  { label: 'Finished', value: stats.finished, color: textMid },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '0.85rem', textAlign: 'center' }}>
                    <div style={{ ...bc, fontWeight: 900, fontSize: '1.5rem', color, lineHeight: 1 }}>{value}</div>
                    <div style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.25rem' }}>{label}</div>
                  </div>
                ))}
              </div>
            );
          })()}

          {countdown && countdown !== 'Games Started' && (
            <div style={{ background: `oklch(58% 0.15 250 / 0.08)`, border: `1px solid oklch(58% 0.15 250 / 0.3)`, borderRadius: 8, padding: '1rem 1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                <Clock style={{ width: 18, height: 18, color: 'oklch(68% 0.12 250)', flexShrink: 0 }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ ...bc, fontWeight: 800, fontSize: '1.05rem', color: 'oklch(75% 0.12 250)' }}>Picks Close In: {countdown}</div>
                  <div style={{ ...b, fontSize: '0.78rem', color: textMid }}>Make sure to submit your picks before kickoff</div>
                </div>
              </div>
            </div>
          )}

          {(countdown === 'Games Started' || effectiveGamesStarted) && (
            <div style={{ background: `oklch(62% 0.22 25 / 0.1)`, border: `1px solid oklch(62% 0.22 25 / 0.35)`, borderRadius: 8, padding: '1rem 1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                <AlertTriangle style={{ width: 18, height: 18, color: liveRed, flexShrink: 0 }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ ...bc, fontWeight: 800, fontSize: '1.05rem', color: liveRed }}>
                    {devSimInProgress ? '[DEV] Simulating In-Progress' : 'Games Have Started!'}
                  </div>
                  <div style={{ ...b, fontSize: '0.78rem', color: textMid }}>All picks are now locked</div>
                </div>
              </div>
            </div>
          )}

          {showGameDetails && games.length > 0 && (
            <div
              id="game-details-card"
              style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Target style={{ width: 15, height: 15, color: textMid }} />
                <span style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', color: text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Week {currentWeek} Game Details</span>
              </div>
              <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {games.map((game, index) => {
                  const gameTime = new Date(game.kickoff_time);
                  const now = new Date();
                  const timeDiff = gameTime.getTime() - now.getTime();
                  const isLocked = timeDiff <= 0;
                  const isUpcoming = timeDiff > 0 && timeDiff <= 24 * 60 * 60 * 1000;

                  return (
                    <div key={game.id} style={{ background: surface, border: `1px solid ${isLocked ? border : isUpcoming ? 'oklch(72% 0.16 60 / 0.35)' : 'oklch(46% 0.14 155 / 0.35)'}`, borderRadius: 6, padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                          <span style={{ ...bc, fontWeight: 700, fontSize: '0.7rem', color: textDim }}>Game {index + 1}</span>
                          {isLocked && <span style={{ ...bc, fontWeight: 700, fontSize: '0.6rem', padding: '0.08rem 0.35rem', borderRadius: 3, background: 'oklch(26% 0.03 255)', color: textDim, border: `1px solid ${border}`, textTransform: 'uppercase' }}>Locked</span>}
                          {isUpcoming && <span style={{ ...bc, fontWeight: 700, fontSize: '0.6rem', padding: '0.08rem 0.35rem', borderRadius: 3, background: `oklch(72% 0.16 60 / 0.15)`, color: amber, border: `1px solid oklch(72% 0.16 60 / 0.35)`, textTransform: 'uppercase' }}>Upcoming</span>}
                          {!isLocked && !isUpcoming && <span style={{ ...bc, fontWeight: 700, fontSize: '0.6rem', padding: '0.08rem 0.35rem', borderRadius: 3, background: `oklch(46% 0.14 155 / 0.15)`, color: greenHi, border: `1px solid oklch(46% 0.14 155 / 0.35)`, textTransform: 'uppercase' }}>Available</span>}
                        </div>
                        <div style={{ ...b, fontWeight: 600, fontSize: '0.85rem', color: text }}>{game.away_team} @ {game.home_team}</div>
                        <div style={{ ...b, fontSize: '0.72rem', color: textDim }}>{gameTime.toLocaleDateString()} at {gameTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                      {game.winner && (
                        <span style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', padding: '0.15rem 0.5rem', borderRadius: 4, background: `oklch(46% 0.14 155 / 0.2)`, color: greenHi, border: `1px solid oklch(46% 0.14 155 / 0.4)`, textTransform: 'uppercase', flexShrink: 0 }}>
                          Winner: {game.winner}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DUMMY_DATA === 'true') && (
            <div style={{ background: `oklch(58% 0.15 250 / 0.08)`, border: `1px solid oklch(58% 0.15 250 / 0.25)`, borderRadius: 8, padding: '1rem 1.25rem' }}>
              <div style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', color: 'oklch(68% 0.12 250)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Debug Info</div>
              <div style={{ ...b, fontSize: '0.68rem', color: 'oklch(65% 0.1 250)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <p><strong>Games Started:</strong> {gamesStarted ? 'Yes' : 'No'} | <strong>Week Ended:</strong> {weekEnded ? 'Yes' : 'No'} | <strong>Games:</strong> {games.length}</p>
                <p><strong>Selected User:</strong> {selectedUser ? `${selectedUser.name} (${selectedUser.id})` : 'None'} | <strong>Has Submitted:</strong> {selectedUser ? (hasSubmitted[selectedUser.id]?.submitted ? 'Yes' : 'No') : 'N/A'}</p>
                <p><strong>Leaderboard:</strong> {showLeaderboard ? 'Shown' : 'Hidden'} | <strong>Week Has Picks:</strong> {weekHasPicks ? 'Yes' : 'No'}</p>
                <p><strong>Pool ID:</strong> {poolId} | <strong>Week:</strong> {currentWeek} | <strong>Season Type:</strong> {currentSeasonType}</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.75rem', borderTop: `1px solid oklch(58% 0.15 250 / 0.2)`, paddingTop: '0.75rem' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={forceWeekUnlocked}
                    onChange={(e) => setForceWeekUnlocked(e.target.checked)}
                    style={{ accentColor: 'oklch(58% 0.15 250)', width: 14, height: 14 }}
                  />
                  <span style={{ ...b, fontSize: '0.72rem', color: 'oklch(68% 0.12 250)' }}>Force week unlocked (ignore kickoff gate)</span>
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={forcePicks}
                    onChange={(e) => setForcePicks(e.target.checked)}
                    style={{ accentColor: 'oklch(58% 0.15 250)', width: 14, height: 14 }}
                  />
                  <span style={{ ...b, fontSize: '0.72rem', color: 'oklch(68% 0.12 250)' }}>Force show picks form (ignore games started / week ended)</span>
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={devSimInProgress}
                    onChange={(e) => setDevSimInProgress(e.target.checked)}
                    style={{ accentColor: 'oklch(72% 0.16 60)', width: 14, height: 14 }}
                  />
                  <span style={{ ...b, fontSize: '0.72rem', color: 'oklch(68% 0.12 250)' }}>Simulate in-progress (shows "Games Started" banner, locks picks)</span>
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={devSimFinished}
                    onChange={(e) => setDevSimFinished(e.target.checked)}
                    style={{ accentColor: 'oklch(46% 0.14 155)', width: 14, height: 14 }}
                  />
                  <span style={{ ...b, fontSize: '0.72rem', color: 'oklch(68% 0.12 250)' }}>Simulate finished — varied scores, home wins (pair with "Force show picks form")</span>
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={devForceLeaderboard}
                    onChange={(e) => setDevForceLeaderboard(e.target.checked)}
                    style={{ accentColor: 'oklch(74% 0.16 72)', width: 14, height: 14 }}
                  />
                  <span style={{ ...b, fontSize: '0.72rem', color: 'oklch(68% 0.12 250)' }}>Force show week leaderboard</span>
                </label>
              </div>
            </div>
          )}

          {process.env.NODE_ENV === 'development' && (
            <div style={{ background: `oklch(46% 0.14 155 / 0.08)`, border: `1px solid oklch(46% 0.14 155 / 0.25)`, borderRadius: 6, padding: '0.75rem 1rem' }}>
              <p style={{ ...b, fontSize: '0.78rem', color: greenHi }}>
                <strong>Main picks section reached!</strong> Games started: {gamesStarted ? 'Yes' : 'No'}, Week ended: {weekEnded ? 'Yes' : 'No'}
              </p>
            </div>
          )}

          {showResultsTabs && (
            <div
              id="results-section"
              style={{ background: card, border: `1px solid ${border}`, borderTop: weekEnded ? `3px solid ${gold}` : `1px solid ${border}`, borderRadius: 10, overflow: 'hidden' }}>
              {weekEnded && (
                <div style={{ padding: '1.25rem', textAlign: 'center', borderBottom: `1px solid oklch(74% 0.16 72 / 0.2)`, background: 'linear-gradient(135deg, oklch(20% 0.04 72 / 0.4), oklch(18% 0.03 255))' }}>
                  <Crown style={{ width: 28, height: 28, color: gold, margin: '0 auto 0.5rem' }} />
                  <h2 style={{ ...bc, fontWeight: 900, fontSize: '1.25rem', color: text, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Week {currentWeek} Final Results</h2>
                  <p style={{ ...b, fontSize: '0.82rem', color: textMid }}>
                    {weekHasPicks
                      ? `The week has ended! Here are the final standings for ${poolName}`
                      : `Week ${currentWeek} has ended. No picks were submitted for this week.`}
                  </p>
                </div>
              )}
              <div
                id="results-tabs"
                style={{ display: 'flex', alignItems: 'stretch', borderBottom: `1px solid ${border}`, background: surface }}>
                <button
                  onClick={() => setActiveResultsTab('leaderboard')}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.75rem 1.25rem', background: 'transparent', border: 'none', outline: 'none', borderBottom: activeResultsTab === 'leaderboard' ? `2px solid ${greenHi}` : '2px solid transparent', cursor: 'pointer', ...bc, fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: activeResultsTab === 'leaderboard' ? greenHi : textDim, transition: 'color 0.12s ease, border-color 0.12s ease' }}
                >
                  <Trophy style={{ width: 14, height: 14 }} />
                  Leaderboard
                </button>
                <button
                  onClick={() => setActiveResultsTab('results')}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.75rem 1.25rem', background: 'transparent', border: 'none', outline: 'none', borderBottom: activeResultsTab === 'results' ? `2px solid ${greenHi}` : '2px solid transparent', cursor: 'pointer', ...bc, fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: activeResultsTab === 'results' ? greenHi : textDim, transition: 'color 0.12s ease, border-color 0.12s ease' }}
                >
                  <BarChart3 style={{ width: 14, height: 14 }} />
                  Game Results
                </button>
                {effectiveGamesStarted && !weekEnded && submittedCount >= participantCount && (
                  <span style={{ ...b, fontSize: '0.73rem', color: textDim, marginLeft: 'auto', display: 'flex', alignItems: 'center', padding: '0 1rem' }}>Games in progress</span>
                )}
                {process.env.NODE_ENV === 'development' && devForceLeaderboard && !weekEnded && !(effectiveGamesStarted && submittedCount >= participantCount) && (
                  <span style={{ alignSelf: 'center', marginLeft: 'auto', marginRight: '1rem', ...bc, fontWeight: 700, fontSize: '0.6rem', letterSpacing: '0.08em', color: amber, background: 'oklch(72% 0.16 60 / 0.12)', border: '1px solid oklch(72% 0.16 60 / 0.3)', borderRadius: 4, padding: '0.1rem 0.4rem', textTransform: 'uppercase' }}>Dev</span>
                )}
              </div>
              {activeResultsTab === 'leaderboard' && (
                <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {weekHasPicks || !weekEnded ? (
                    <Leaderboard poolId={poolId} weekNumber={currentWeek} seasonType={currentSeasonType} season={poolSeason} />
                  ) : (
                      <div
                        id="no-results"
                        style={{ textAlign: 'center', padding: '2rem', color: textDim }}>
                        <Calendar style={{ width: 40, height: 40, margin: '0 auto 0.5rem', color: textDim }} />
                        <p style={{ ...bc, fontWeight: 700, fontSize: '0.95rem', color: textMid, textTransform: 'uppercase' }}>No Results Available</p>
                        <p style={{ ...b, fontSize: '0.8rem', color: textDim }}>This week ended without any submitted picks</p>
                      </div>
                  )}
                  {weekEnded && (
                    <div
                      id="season-standings"
                      style={{ borderTop: `1px solid ${border}`, paddingTop: '1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                        <Trophy style={{ width: 15, height: 15, color: greenHi }} />
                        <span style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', color: text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Season {poolSeason} Overall Standings</span>
                        <span style={{ ...b, fontSize: '0.75rem', color: textDim, marginLeft: 'auto' }}>Up to Week {currentWeek}</span>
                      </div>
                      <SeasonLeaderboard poolId={poolId} season={poolSeason} currentWeek={currentWeek} currentSeasonType={currentSeasonType} />
                    </div>
                  )}
                  <div style={{ borderTop: `1px solid ${border}`, paddingTop: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                      <Crown style={{ width: 15, height: 15, color: purple }} />
                      <span style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', color: text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{getPeriodName(currentSeasonType, currentWeek)}</span>
                    </div>
                    <QuarterLeaderboard poolId={poolId} season={poolSeason} currentWeek={currentWeek} seasonType={currentSeasonType} />
                  </div>
                </div>
              )}
              {activeResultsTab === 'results' && (
                <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {devDisplayGames.map(game => (
                    <GameCard
                      key={game.id}
                      game={game}
                      pick={undefined}
                      onSelectTeam={() => {}}
                      onSetConfidence={() => {}}
                      totalGames={devDisplayGames.length}
                      usedPoints={[]}
                      locked={true}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {currentSeasonType !== 1 && PERIOD_WEEKS.includes(currentWeek as typeof PERIOD_WEEKS[number]) && (
            <div style={{ background: `oklch(65% 0.12 290 / 0.08)`, border: `1px solid oklch(65% 0.12 290 / 0.3)`, borderRadius: 10, padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
                <Crown style={{ width: 15, height: 15, color: purple }} />
                <span style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', color: text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quarter Leaderboard</span>
              </div>
              <p style={{ ...b, fontSize: '0.8rem', color: textMid, marginBottom: '0.75rem' }}>
                {currentSeasonType === 3 ? 'Super Bowl' : `Week ${currentWeek}`} is a tie-breaker week! View the complete {currentSeasonType === 2 ? 'quarter' : 'playoffs'} standings and winners.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <Link
                  href={`/periods/${poolId}/${poolSeason}/${getPeriodNumber(currentSeasonType, currentWeek)}?seasonType=${currentSeasonType}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.9rem', background: purple, color: text, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase', textDecoration: 'none' }}
                >
                  <ExternalLink style={{ width: 12, height: 12 }} />
                  View {currentSeasonType === 2 ? 'Quarter' : 'Playoffs'} Leaderboard
                </Link>
                <span style={{ ...b, fontSize: '0.73rem', color: textDim, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Info style={{ width: 12, height: 12 }} />
                  Includes weeks: {getPeriodWeeks(currentSeasonType, currentWeek).join(', ')}
                </span>
              </div>
            </div>
          )}

          {!showResultsTabs && (effectiveGamesStarted && !weekEnded && !forcePicks ? (
            <>
              {submittedCount < participantCount && (
                <div style={{ background: `oklch(72% 0.16 60 / 0.08)`, border: `1px solid oklch(72% 0.16 60 / 0.3)`, borderRadius: 10, padding: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <Clock style={{ width: 15, height: 15, color: amber }} />
                    <span style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', color: amber, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Waiting for All Submissions</span>
                  </div>
                  <p style={{ ...b, fontSize: '0.82rem', color: textMid, marginBottom: '0.85rem' }}>{submittedCount} of {participantCount} participants have submitted picks</p>
                  <div style={{ height: 6, background: 'oklch(26% 0.03 255)', borderRadius: 3, overflow: 'hidden', marginBottom: '0.4rem' }}>
                    <div style={{ height: '100%', background: amber, borderRadius: 3, width: `${participantCount > 0 ? (submittedCount / participantCount) * 100 : 0}%`, transition: 'width 0.3s ease' }} />
                  </div>
                  <p style={{ ...b, fontSize: '0.75rem', color: textDim }}>
                    The leaderboard will be available once all participants submit. {participantCount - submittedCount} still pending.
                  </p>
                </div>
              )}
            </>

          ) : (!weekEnded && !gamesStarted) || forcePicks ? (
            <>
              {submittedCount >= participantCount ? (
                <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Trophy style={{ width: 15, height: 15, color: gold }} />
                    <span style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', color: text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Week {currentWeek} Leaderboard</span>
                    <span style={{ ...b, fontSize: '0.73rem', color: textDim, marginLeft: 'auto' }}>Games in progress</span>
                  </div>
                  <div style={{ padding: '1.25rem' }}>
                    <Leaderboard poolId={poolId} weekNumber={currentWeek} seasonType={currentSeasonType} season={poolSeason} />
                  </div>
                </div>
              ) : (!showGameDetails || games.length === 0) ? (
                    <div
                      id="picks-content"
                      style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Zap style={{ width: 15, height: 15, color: greenHi }} />
                    <div>
                      <span style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', color: text, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>Week {currentWeek} Picks</span>
                      <span style={{ ...b, fontSize: '0.75rem', color: textDim }}>
                        {selectedUser && hasSubmitted[selectedUser.id]?.submitted
                          ? 'You have already submitted your picks for this week. Only admins can unlock your picks to make changes.'
                          : 'Select the winner for each game and assign confidence points'}
                      </span>
                    </div>
                  </div>
                  <div style={{ padding: '1.25rem' }}>
                    {selectedUser ? (
                      hasSubmitted[selectedUser.id]?.submitted ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                          <Lock style={{ width: 40, height: 40, color: textDim, margin: '0 auto 0.75rem' }} />
                          <p style={{ ...bc, fontWeight: 700, fontSize: '1rem', color: textMid, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Picks Submitted</p>
                          <p style={{ ...b, fontSize: '0.82rem', color: textDim, marginBottom: '1.25rem' }}>Your picks are locked for this week</p>
                          {(isPoolAdmin || isSuperAdmin) && (
                            <button
                              onClick={() => unlockParticipantPicks(selectedUser.id)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
                            >
                              <Unlock style={{ width: 13, height: 13 }} /> Unlock Picks
                            </button>
                          )}
                        </div>
                      ) : games.length > 0 ? (
                        <div>
                          {process.env.NODE_ENV === 'development' && (
                            <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: `oklch(58% 0.15 250 / 0.08)`, border: `1px solid oklch(58% 0.15 250 / 0.25)`, borderRadius: 6 }}>
                              <div style={{ ...b, fontSize: '0.72rem', color: 'oklch(68% 0.12 250)', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                                <p><strong>User:</strong> {selectedUser.name} (ID: {selectedUser.id})</p>
                                <p><strong>Pool:</strong> {poolId} | <strong>Week:</strong> {currentWeek} | <strong>Season Type:</strong> {currentSeasonType}</p>
                                <p><strong>Submission Status:</strong> {hasSubmitted[selectedUser.id]?.submitted ? 'Submitted' : 'Not Submitted'}</p>
                                <p><strong>All Users Status:</strong> {JSON.stringify(hasSubmitted)}</p>
                              </div>
                            </div>
                          )}
                          <WeeklyPick
                            poolId={poolId}
                            weekNumber={currentWeek}
                            seasonType={currentSeasonType}
                            selectedUser={selectedUser}
                            games={devDisplayGames}
                            preventGameLoading={true}
                            forceWeekUnlocked={forceWeekUnlocked}
                            onPicksSubmitted={handlePicksSubmitted}
                            onUserChangeRequested={handleUserChangeRequested}
                          />
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '2rem', color: textDim }}>
                          <p style={{ ...b, fontSize: '0.85rem' }}>No games found for Week {currentWeek}</p>
                        </div>
                      )
                    ) : (
                      <div>
                        {Object.keys(hasSubmitted).length > 0 && (
                          <div style={{ marginBottom: '1.25rem', padding: '0.85rem 1rem', background: `oklch(46% 0.14 155 / 0.08)`, border: `1px solid oklch(46% 0.14 155 / 0.3)`, borderRadius: 8 }}>
                            <p style={{ ...bc, fontWeight: 700, fontSize: '0.82rem', color: greenHi, textAlign: 'center', marginBottom: '0.6rem' }}>
                              Picks submitted successfully! Best of luck this week!
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                              <button
                                onClick={() => setShowLeaderboard(true)}
                                disabled={submittedCount < participantCount}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.75rem', background: 'transparent', color: submittedCount < participantCount ? textDim : textMid, border: `1px solid ${border}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: submittedCount < participantCount ? 'not-allowed' : 'pointer', opacity: submittedCount < participantCount ? 0.5 : 1 }}
                              >
                                <BarChart3 style={{ width: 12, height: 12 }} />
                                View Leaderboard
                                {submittedCount < participantCount && ` (${submittedCount}/${participantCount})`}
                              </button>
                            </div>
                          </div>
                        )}
                        <PickUserSelection
                          poolId={poolId}
                          weekNumber={currentWeek}
                          seasonType={currentSeasonType}
                          onUserSelected={handleUserSelected}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {selectedUser && hasSubmitted[selectedUser.id]?.submitted && (!showGameDetails || games.length === 0) && (
                <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Eye style={{ width: 15, height: 15, color: 'oklch(58% 0.15 250)' }} />
                    <div>
                      <span style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', color: text, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>Your Picks for Week {currentWeek}</span>
                      <span style={{ ...b, fontSize: '0.73rem', color: textDim }}>Review your submitted picks (locked until games start)</span>
                    </div>
                  </div>
                  <div style={{ padding: '1.25rem' }}>
                    <RecentPicksViewer
                      poolId={poolId}
                      participantId={selectedUser.id}
                      participantName={selectedUser.name}
                      weekNumber={currentWeek}
                      seasonType={currentSeasonType}
                      games={devDisplayGames}
                      canUnlock={isPoolAdmin || isSuperAdmin}
                      onUnlock={unlockParticipantPicks}
                    />
                  </div>
                </div>
              )}
            </>
          ) : null)}

        </div>
      </section>

      {showRecentPicks && (
        <Dialog open={showRecentPicks} onOpenChange={setShowRecentPicks}>
          <DialogContent style={{ background: card, border: `1px solid ${border}`, maxWidth: '56rem', maxHeight: '80vh', overflowY: 'auto' }}>
            <DialogHeader>
              <DialogTitle style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Eye style={{ width: 16, height: 16, color: 'oklch(58% 0.15 250)' }} />
                {selectedUser && hasSubmitted[selectedUser.id]?.submitted
                  ? `${selectedUser.name}'s Submitted Picks for Week ${currentWeek}`
                  : `Submitted Picks for Week ${currentWeek}`}
              </DialogTitle>
              <DialogDescription style={{ ...b, fontSize: '0.82rem', color: textDim }}>
                {selectedUser && hasSubmitted[selectedUser.id]?.submitted
                  ? `Review ${selectedUser.name}'s picks for this week`
                  : 'Review all submitted picks for this week'}
              </DialogDescription>
            </DialogHeader>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {selectedUser && hasSubmitted[selectedUser.id]?.submitted ? (
                <div style={{ padding: '1rem', background: surface, border: `1px solid ${border}`, borderRadius: 8 }}>
                  <h3 style={{ ...bc, fontWeight: 700, fontSize: '0.82rem', color: textMid, textTransform: 'uppercase', marginBottom: '0.75rem' }}>User: {selectedUser.name}</h3>
                  <RecentPicksViewer
                    poolId={poolId} participantId={selectedUser.id} participantName={selectedUser.name}
                    weekNumber={currentWeek} seasonType={currentSeasonType} games={devDisplayGames}
                    canUnlock={isPoolAdmin || isSuperAdmin} onUnlock={unlockParticipantPicks}
                  />
                </div>
              ) : (
                Object.entries(hasSubmitted).map(([userId, data]) => {
                  if (!data.submitted) return null;
                  return (
                    <div key={userId} style={{ padding: '1rem', background: surface, border: `1px solid ${border}`, borderRadius: 8 }}>
                      <h3 style={{ ...bc, fontWeight: 700, fontSize: '0.82rem', color: textMid, textTransform: 'uppercase', marginBottom: '0.75rem' }}>User: {data.name}</h3>
                      <RecentPicksViewer
                        poolId={poolId} participantId={userId} participantName={data.name}
                        weekNumber={currentWeek} seasonType={currentSeasonType} games={devDisplayGames}
                        canUnlock={isPoolAdmin || isSuperAdmin} onUnlock={unlockParticipantPicks}
                      />
                    </div>
                  );
                })
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '1rem' }}>
              <button
                onClick={() => setShowRecentPicks(false)}
                style={{ padding: '0.5rem 1rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent style={{ background: card, border: `1px solid ${border}`, borderTop: `3px solid ${green}`, maxWidth: '28rem' }}>
          <DialogHeader>
            <DialogTitle style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Trophy style={{ width: 16, height: 16, color: greenHi }} />
              Picks Submitted Successfully!
            </DialogTitle>
            <DialogDescription style={{ ...b, fontSize: '0.85rem', color: textMid }}>
              Your picks for Week {currentWeek} have been submitted. Best of luck!
            </DialogDescription>
          </DialogHeader>
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
            <button
              onClick={() => setShowSuccessDialog(false)}
              style={{ padding: '0.5rem 1.25rem', background: green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
