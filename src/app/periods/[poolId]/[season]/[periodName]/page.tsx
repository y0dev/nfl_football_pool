'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Trophy, Medal, Award, Users, Calendar, BarChart3, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { debugLog, getRankColor, debugError, debugWarn} from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

interface PeriodWinner {
  id: string;
  pool_id: string;
  season: number;
  period_name: string;
  winner_participant_id: string;
  winner_name: string;
  winner_points: number;
  winner_correct_picks: number;
  tie_breaker_used: boolean;
  tie_breaker_question?: string;
  total_participants: number;
  created_at: string;
}

interface WeeklyWinner {
  week: number;
  winner_name: string;
  winner_points: number;
  winner_correct_picks: number;
  tie_breaker_used: boolean;
  total_participants: number;
}

interface LeaderboardEntry {
  participant_id: string;
  name: string;
  email: string;
  total_points: number;
  total_correct: number;
  total_picks: number;
  weeks_won: number;
  weekly_scores: Array<{
    week: number;
    points: number;
    correct: number;
    total: number;
  }>;
}

interface PeriodInfo {
  name: string;
  weeks: number[];
  totalWeeks: number;
}

export default function PeriodLeaderboardPage() {
  const searchParams = useSearchParams();
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const poolId = params.poolId as string;
  const season = params.season as string;
  const periodNumber = parseInt(params.periodName as string);
  const seasonType = parseInt(searchParams.get('seasonType') ?? '2', 10);

  // Convert period number to period name
  const getPeriodNameFromNumber = (num: number): string => {
    switch (num) {
      case 1: return 'Period 1';
      case 2: return 'Period 2';
      case 3: return 'Period 3';
      case 4: return 'Period 4';
      case 5: return 'Playoffs';
      default: return 'Unknown Period';
    }
  };

  const periodName = getPeriodNameFromNumber(periodNumber);

  const [periodWinner, setPeriodWinner] = useState<PeriodWinner | null>(null);
  const [weeklyWinners, setWeeklyWinners] = useState<WeeklyWinner[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [periodInfo, setPeriodInfo] = useState<PeriodInfo | null>(null);
  const [poolName, setPoolName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [allWeeksCompleted, setAllWeeksCompleted] = useState(false);
  const [games, setGames] = useState<any[]>([]);
  const [tieBreakerInfo, setTieBreakerInfo] = useState<any>(null);
  const [showTieBreakerInfo, setShowTieBreakerInfo] = useState(false);
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'weekly' | 'chart'>('leaderboard');

  useEffect(() => {
    loadPeriodData();
  }, [poolId, season, periodNumber, periodName]);

  // Initialize selected participants when leaderboard data loads
  useEffect(() => {
    if (leaderboard && leaderboard.length > 0 && selectedParticipants.length === 0) {
      setSelectedParticipants(leaderboard.map(p => p.name));
    }
  }, [leaderboard, selectedParticipants.length]);

  // Determine if all weeks are completed
  useEffect(() => {
    if (periodInfo && games.length > 0) {
      const completedWeeks = periodInfo.weeks.filter(week => {
        const weekGames = games.filter(game => game.week === week);
        if (weekGames.length === 0) return false;

        const allGamesFinished = weekGames.every(game => {
          const status = game.status?.toLowerCase() || '';
          return status === 'final' || status === 'post';
        });

        debugLog(`Week ${week}: ${weekGames.length} games, all finished: ${allGamesFinished}`);
        return allGamesFinished;
      });

      const allCompleted = completedWeeks.length === periodInfo.weeks.length;
      setAllWeeksCompleted(allCompleted);
      debugLog('Completed weekss:', completedWeeks, 'All weeks:', periodInfo.weeks, 'All completed:', allCompleted);
    }
  }, [periodInfo, games]);

  const loadPeriodData = async () => {
    setIsLoading(true);
    try {
      const [periodResponse, poolResponse] = await Promise.all([
        fetch(`/api/periods/leaderboard?poolId=${poolId}&season=${season}&seasonType=${seasonType}&periodName=${encodeURIComponent(periodName)}`),
        fetch(`/api/pools/${poolId}`)
      ]);

      const periodResult = await periodResponse.json();
      const poolResult = await poolResponse.json();

      debugLog('Period data loaded:', periodResult);
      debugLog('Pool data loaded:', poolResult);
      debugLog('Weekly winners count:', periodResult.data?.weeklyWinners?.length || 0);
      debugLog('Period weeks:', periodResult.data?.periodInfo?.weeks || []);
      debugLog('Period winner data:', periodResult.data?.periodWinner);
      debugLog('Leaderboard data:', periodResult.data?.leaderboard);
      debugLog('Weekly winners data:', periodResult.data?.weeklyWinners);

      if (periodResult.success) {
        const hasData = periodResult.data && (
          periodResult.data.periodWinner ||
          (periodResult.data.leaderboard && periodResult.data.leaderboard.length > 0) ||
          (periodResult.data.weeklyWinners && periodResult.data.weeklyWinners.length > 0)
        );

        debugLog('Has data check:', {
          hasData,
          hasPeriodWinner: !!periodResult.data?.periodWinner,
          leaderboardLength: periodResult.data?.leaderboard?.length || 0,
          weeklyWinnersLength: periodResult.data?.weeklyWinners?.length || 0
        });

        if (hasData) {
          const mappedPeriodWinner = periodResult.data.periodWinner ? {
            id: periodResult.data.periodWinner.id || '',
            pool_id: periodResult.data.periodWinner.pool_id || poolId,
            season: periodResult.data.periodWinner.season || parseInt(season),
            period_name: periodResult.data.periodWinner.period_name || periodName,
            winner_participant_id: periodResult.data.periodWinner.winner_participant_id || '',
            winner_name: periodResult.data.periodWinner.winner_name || 'Unknown',
            winner_points: periodResult.data.periodWinner.winner_points || 0,
            winner_correct_picks: periodResult.data.periodWinner.winner_correct_picks || 0,
            tie_breaker_used: periodResult.data.periodWinner.tie_breaker_used || false,
            tie_breaker_question: periodResult.data.periodWinner.tie_breaker_question || undefined,
            total_participants: periodResult.data.periodWinner.total_participants || 0,
            created_at: periodResult.data.periodWinner.created_at || new Date().toISOString()
          } : null;

          const mappedWeeklyWinners = (periodResult.data.weeklyWinners || []).map((winner: Record<string, unknown>) => ({
            week: winner.week || 0,
            winner_name: winner.winner_name || 'Unknown',
            winner_points: winner.winner_points || 0,
            winner_correct_picks: winner.winner_correct_picks || 0,
            tie_breaker_used: winner.tie_breaker_used || false,
            total_participants: winner.total_participants || 0
          }));

          const mappedLeaderboard = (periodResult.data.leaderboard || []).map((entry: Record<string, unknown>) => ({
            participant_id: entry.participant_id || '',
            name: entry.name || 'Unknown',
            email: entry.email || '',
            total_points: entry.total_points || 0,
            total_correct: entry.total_correct || 0,
            total_picks: entry.total_picks || 0,
            weeks_won: entry.weeks_won || 0,
            weekly_scores: entry.weekly_scores || []
          }));

          const mappedPeriodInfo = periodResult.data.periodInfo ? {
            name: periodResult.data.periodInfo.name || '',
            weeks: periodResult.data.periodInfo.weeks || [],
            totalWeeks: periodResult.data.periodInfo.totalWeeks || 0
          } : null;

          debugLog('Mapped period winner:', mappedPeriodWinner);
          debugLog('Mapped weekly winners:', mappedWeeklyWinners);
          debugLog('Mapped leaderboard:', mappedLeaderboard);
          debugLog('Mapped period info:', mappedPeriodInfo);

          setPeriodWinner(mappedPeriodWinner);
          setWeeklyWinners(mappedWeeklyWinners);
          setLeaderboard(mappedLeaderboard);
          setPeriodInfo(mappedPeriodInfo);
          setGames(periodResult.data.games || []);
          setTieBreakerInfo(periodResult.data.tieBreakerInfo || null);
        } else {
          if (process.env.NODE_ENV === 'development') {
            debugLog('API succeeded but no data found, loading dummy data for development');
            loadDummyData();
          } else {
            toast({
              title: 'No Data',
              description: 'No period data available for this period',
              variant: 'destructive'
            });
          }
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          debugLog('API failed, loading dummy data for development');
          loadDummyData();
        } else {
          toast({
            title: 'Error',
            description: periodResult.error,
            variant: 'destructive'
          });
        }
      }

      if (poolResult.success && poolResult.pool) {
        setPoolName(poolResult.pool.name);
      } else {
        debugWarn('Failed to load pool name:', poolResult.error);
        setPoolName(`Pool ${poolId.slice(0, 8)}...`);
      }
    } catch (error) {
      debugError('Error loading period data:', error);
      if (process.env.NODE_ENV === 'development') {
        debugLog('Error loading period data, loading dummy data for development');
        loadDummyData();
      } else {
        toast({
          title: 'Error',
          description: 'Failed to load period data',
          variant: 'destructive'
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadDummyData = () => {
    debugLog('Loading dummy data for development');

    const getPeriodWeeks = (periodNum: number): number[] => {
      switch (periodNum) {
        case 1: return [1, 2, 3, 4];
        case 2: return [5, 6, 7, 8, 9];
        case 3: return [10, 11, 12, 13, 14];
        case 4: return [15, 16, 17, 18];
        default: return [1, 2, 3, 4];
      }
    };

    const dummyWeeks = getPeriodWeeks(periodNumber);

    const dummyPeriodWinner: PeriodWinner = {
      id: 'dummy-winner-1',
      pool_id: poolId,
      season: parseInt(season),
      period_name: periodName,
      winner_participant_id: 'dummy-participant-1',
      winner_name: 'John Doe',
      winner_points: 255,
      winner_correct_picks: 32,
      tie_breaker_used: false,
      total_participants: 8,
      created_at: new Date().toISOString()
    };

    const dummyWeeklyWinners: WeeklyWinner[] = dummyWeeks.map((week, index) => ({
      week: week,
      winner_name: ['John Doe', 'Jane Smith', 'Mike Johnson', 'Sarah Wilson', 'Tom Brown'][index % 5],
      winner_points: 15 + Math.floor(Math.random() * 10),
      winner_correct_picks: 3 + Math.floor(Math.random() * 3),
      tie_breaker_used: Math.random() > 0.7,
      total_participants: 8
    }));

    const dummyLeaderboard: LeaderboardEntry[] = [
      {
        participant_id: 'dummy-participant-1',
        name: 'John Doe',
        email: 'john@example.com',
        total_points: 255,
        total_correct: 32,
        total_picks: 64,
        weeks_won: 2,
        weekly_scores: dummyWeeks.map(week => ({
          week: week,
          points: 8 + Math.floor(Math.random() * 8),
          correct: 2 + Math.floor(Math.random() * 3),
          total: 4
        }))
      },
      {
        participant_id: 'dummy-participant-2',
        name: 'Jane Smith',
        email: 'jane@example.com',
        total_points: 252,
        total_correct: 31,
        total_picks: 64,
        weeks_won: 1,
        weekly_scores: dummyWeeks.map(week => ({
          week: week,
          points: 7 + Math.floor(Math.random() * 8),
          correct: 2 + Math.floor(Math.random() * 3),
          total: 4
        }))
      },
      {
        participant_id: 'dummy-participant-3',
        name: 'Mike Johnson',
        email: 'mike@example.com',
        total_points: 248,
        total_correct: 28,
        total_picks: 64,
        weeks_won: 1,
        weekly_scores: dummyWeeks.map(week => ({
          week: week,
          points: 6 + Math.floor(Math.random() * 8),
          correct: 2 + Math.floor(Math.random() * 3),
          total: 4
        }))
      },
      {
        participant_id: 'dummy-participant-4',
        name: 'Sarah Wilson',
        email: 'sarah@example.com',
        total_points: 205,
        total_correct: 27,
        total_picks: 64,
        weeks_won: 0,
        weekly_scores: dummyWeeks.map(week => ({
          week: week,
          points: 5 + Math.floor(Math.random() * 8),
          correct: 1 + Math.floor(Math.random() * 3),
          total: 4
        }))
      },
      {
        participant_id: 'dummy-participant-5',
        name: 'Tom Brown',
        email: 'tom@example.com',
        total_points: 202,
        total_correct: 26,
        total_picks: 64,
        weeks_won: 0,
        weekly_scores: dummyWeeks.map(week => ({
          week: week,
          points: 4 + Math.floor(Math.random() * 8),
          correct: 1 + Math.floor(Math.random() * 3),
          total: 4
        }))
      }
    ];

    const dummyPeriodInfo: PeriodInfo = {
      name: periodName,
      weeks: dummyWeeks,
      totalWeeks: dummyWeeks.length
    };

    debugLog('Setting dummy period winner:', dummyPeriodWinner);
    debugLog('Setting dummy weekly winners:', dummyWeeklyWinners);
    debugLog('Setting dummy leaderboard:', dummyLeaderboard);
    debugLog('Setting dummy period info:', dummyPeriodInfo);

    setPeriodWinner(dummyPeriodWinner);
    setWeeklyWinners(dummyWeeklyWinners);
    setLeaderboard(dummyLeaderboard);
    setPeriodInfo(dummyPeriodInfo);
    setPoolName(`Development Pool (${poolId.slice(0, 8)}...)`);

    debugLog('Dummy data set successfully');
  };

  const renderRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy style={{ width: 20, height: 20, color: gold }} />;
      case 1:
        return <Medal style={{ width: 20, height: 20, color: textMid }} />;
      case 2:
        return <Award style={{ width: 20, height: 20, color: amber }} />;
      default:
        return <span style={{ ...bc, fontWeight: 700, fontSize: '0.85rem', color: textDim }}>#{index + 1}</span>;
    }
  };

  const handleParticipantSelection = (action: 'select-all' | 'clear-all') => {
    if (action === 'select-all') {
      setSelectedParticipants(leaderboard.map(p => p.name));
    } else if (action === 'clear-all') {
      setSelectedParticipants([]);
    }
  };

  const prepareChartData = (): Array<{ week: string; [key: string]: number | string }> => {
    debugLog('Chart data preparation - leaderboard:', leaderboard);
    debugLog('Chart data preparation - selectedParticipants:', selectedParticipants);
    debugLog('Chart data preparation - periodInfo:', periodInfo);

    if (leaderboard && leaderboard.length > 0 && selectedParticipants.length > 0) {
      debugLog('Using leaderboard data for chart (selected participants)');

      let weeks: number[] = [];
      if (periodInfo && periodInfo.weeks && periodInfo.weeks.length > 0) {
        weeks = periodInfo.weeks;
      } else {
        const weeksFromScores = new Set<number>();
        leaderboard.forEach(participant => {
          participant.weekly_scores?.forEach(score => {
            weeksFromScores.add(score.week);
          });
        });
        weeks = Array.from(weeksFromScores).sort((a, b) => a - b);
      }

      if (weeks.length === 0) {
        weeks = [1, 2, 3, 4];
      }

      debugLog('Weeks for chart:', weeks);
      debugLog('Selected participants for chart:', selectedParticipants);

      const chartData: Array<{ week: string; [key: string]: number | string }> = [];

      weeks.forEach(week => {
        const weekData: { week: string; [key: string]: number | string } = { week: `Week ${week}` };

        leaderboard
          .filter(participant => selectedParticipants.includes(participant.name))
          .forEach(participant => {
            const weeklyScore = participant.weekly_scores?.find(score => score.week === week);
            const points = weeklyScore ? weeklyScore.points || 0 : 0;
            weekData[participant.name] = points;

            debugLog(`Week ${week} - ${participant.name}: ${points} points`);
          });

        chartData.push(weekData);
      });

      debugLog('Chart data from leaderboard:', chartData);
      return chartData;
    }

    debugLog('No leaderboard data or selected participants available for chart');
    return [];
  };

  const chartData = prepareChartData();
  debugLog('Chart data prepared:', chartData);
  debugLog('Current leaderboard state:', leaderboard);
  debugLog('Current periodInfo state:', periodInfo);

  // ── Loading state ──
  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, border: `3px solid ${border}`, borderTopColor: greenHi, borderRadius: '50%', margin: '0 auto 0.75rem', animation: 'spin 1s linear infinite' }} />
          <p style={{ ...b, color: textMid, fontSize: '0.9rem' }}>Loading period leaderboard...</p>
        </div>
      </div>
    );
  }

  // Periods (Q1-Q4, Playoffs) don't apply to preseason weeks — reaching here with
  // an unmapped period number means whatever linked here didn't account for that.
  if (periodName === 'Unknown Period') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg, padding: '1rem' }}>
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <AlertTriangle style={{ width: 28, height: 28, color: amber, margin: '0 auto 0.75rem' }} />
          <p style={{ ...bc, fontWeight: 800, fontSize: '1.1rem', color: text, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem' }}>
            Period Not Available
          </p>
          <p style={{ ...b, color: textMid, fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            This pool doesn't have a quarter or playoffs period for that week.
          </p>
          <button
            onClick={() => router.push(`/pool/${poolId}/picks`)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}
          >
            <ArrowLeft style={{ width: 13, height: 13 }} /> Back to Picks
          </button>
        </div>
      </div>
    );
  }

  const TABS = [
    { id: 'leaderboard' as const, label: 'Leaderboard', icon: Users },
    { id: 'weekly' as const, label: 'Weekly Winners', icon: Calendar },
    { id: 'chart' as const, label: 'Points Chart', icon: BarChart3 },
  ];

  const chartColors = [
    'oklch(59% 0.15 155)',  // greenHi
    'oklch(62% 0.22 25)',   // liveRed
    'oklch(74% 0.16 72)',   // gold
    'oklch(72% 0.16 60)',   // amber
    'oklch(65% 0.12 290)',  // purple
    'oklch(72% 0.015 255)', // textMid
    'oklch(59% 0.18 200)',  // cyan-ish
    'oklch(66% 0.18 30)',   // orange-ish
    'oklch(64% 0.14 330)',  // pink-ish
    'oklch(50% 0.018 255)', // textDim
  ];

  return (
    <div style={{ background: bg, minHeight: '100vh' }}>

      {/* ── NAV ── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'oklch(13% 0.025 255 / 0.95)', backdropFilter: 'blur(14px)', borderBottom: `1px solid ${border}` }}>
        <div className="lp-inner" style={{ paddingTop: '0.75rem', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                onClick={() => router.back()}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.6rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
              >
                <ArrowLeft style={{ width: 12, height: 12 }} /> Back
              </button>
              <div style={{ width: 1, height: 20, background: border }} />
              <span style={{ ...bc, fontWeight: 800, fontSize: '0.92rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase' }}>Sunday Huddle</span>
            </div>
            {tieBreakerInfo && tieBreakerInfo.wasUsed && (
              <button
                onClick={() => setShowTieBreakerInfo(!showTieBreakerInfo)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.7rem', background: showTieBreakerInfo ? green : 'transparent', color: showTieBreakerInfo ? text : textMid, border: `1px solid ${showTieBreakerInfo ? green : border}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
              >
                <Trophy style={{ width: 11, height: 11 }} />
                {showTieBreakerInfo ? 'Hide' : 'Show'} Tie-Breaker
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ background: bg, backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 59px, oklch(100% 0 0 / 0.022) 59px, oklch(100% 0 0 / 0.022) 60px)`, padding: 'clamp(2rem, 4vw, 3rem) 0' }}>
        <div className="lp-inner">
          <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.26em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ display: 'inline-block', width: 18, height: 2, background: greenHi, borderRadius: 1 }} />
            Season {season} {periodName !== 'Playoffs' ? 'Quarter' : 'Playoffs'}
          </p>
          <h1 style={{ ...bc, fontWeight: 900, fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', lineHeight: 0.95, color: text, textTransform: 'uppercase', marginBottom: '0.6rem' }}>
            {periodName.split(' ')[0]}{' '}
            <span style={{ color: gold }}>{periodName.split(' ').slice(1).join(' ') || 'Standings'}</span>
          </h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
            <span style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.08em', padding: '0.15rem 0.5rem', borderRadius: 4, textTransform: 'uppercase', background: 'oklch(26% 0.03 255)', color: textMid, border: `1px solid ${border}` }}>
              {poolName || `Pool ${poolId.slice(0, 8)}...`}
            </span>
            {periodInfo && (
              <span style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.08em', padding: '0.15rem 0.5rem', borderRadius: 4, textTransform: 'uppercase', background: 'oklch(26% 0.03 255)', color: textMid, border: `1px solid ${border}` }}>
                {periodInfo.totalWeeks} weeks
              </span>
            )}
            {allWeeksCompleted && (
              <span style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.08em', padding: '0.15rem 0.5rem', borderRadius: 4, textTransform: 'uppercase', background: 'oklch(46% 0.14 155 / 0.2)', color: greenHi, border: `1px solid oklch(46% 0.14 155 / 0.4)` }}>
                Final
              </span>
            )}
          </div>
        </div>
      </section>
      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${green}, transparent)` }} />

      {/* ── MAIN CONTENT ── */}
      <section style={{ background: bg, padding: '2rem 0', minHeight: '50vh' }}>
        <div className="lp-inner" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Development banner */}
          {process.env.NODE_ENV === 'development' && (
            <div style={{ padding: '0.85rem 1rem', background: 'oklch(46% 0.14 155 / 0.08)', border: `1px solid oklch(46% 0.14 155 / 0.3)`, borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: 8, height: 8, background: greenHi, borderRadius: '50%' }} />
                  <p style={{ ...b, fontWeight: 600, fontSize: '0.8rem', color: greenHi }}>Development Mode</p>
                </div>
                <button
                  onClick={loadDummyData}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.3rem 0.7rem', background: 'transparent', color: greenHi, border: `1px solid oklch(46% 0.14 155 / 0.4)`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}
                >
                  Load Dummy Data
                </button>
              </div>
              <p style={{ ...b, fontSize: '0.75rem', color: textDim, marginTop: '0.35rem' }}>
                {(!periodWinner || periodWinner.id.startsWith('dummy-'))
                  ? 'Showing dummy data for development. No real period data is available.'
                  : 'Click "Load Dummy Data" to test with sample data.'
                }
              </p>
            </div>
          )}

          {/* Period Winner card */}
          {periodWinner && (
            <div style={{ background: 'oklch(74% 0.16 72 / 0.07)', border: `1px solid oklch(74% 0.16 72 / 0.35)`, borderRadius: 10, padding: '1.25rem 1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
                <Trophy style={{ width: 20, height: 20, color: gold }} />
                <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', color: gold, textTransform: 'uppercase' }}>
                  {allWeeksCompleted ? `${periodName === 'Playoffs' ? 'Playoffs' : 'Quarter'} Winner` : `Current Leader — ${periodName}`}
                </p>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h3 style={{ ...bc, fontWeight: 900, fontSize: 'clamp(1.25rem, 3vw, 1.75rem)', color: text, textTransform: 'uppercase', marginBottom: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {periodWinner.winner_name}
                  </h3>
                  <p style={{ ...b, fontSize: '0.875rem', color: textMid }}>
                    <span style={{ color: greenHi, fontWeight: 700 }}>{periodWinner.winner_points}</span> pts &nbsp;•&nbsp; <span style={{ color: textMid }}>{periodWinner.winner_correct_picks}</span> correct picks
                  </p>
                  {periodWinner.tie_breaker_used && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <span style={{ ...bc, fontWeight: 700, fontSize: '0.6rem', letterSpacing: '0.07em', padding: '0.12rem 0.45rem', borderRadius: 4, textTransform: 'uppercase', background: 'oklch(65% 0.12 290 / 0.15)', color: purple, border: `1px solid oklch(65% 0.12 290 / 0.4)` }}>
                        Tie Breaker Used
                      </span>
                      {!showTieBreakerInfo && (
                        <button
                          onClick={() => setShowTieBreakerInfo(true)}
                          style={{ background: 'none', border: 'none', padding: 0, ...b, fontSize: '0.72rem', color: textMid, textDecoration: 'underline', cursor: 'pointer' }}
                        >
                          View Details
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginBottom: '0.2rem' }}>Total Participants</p>
                  <p style={{ ...bc, fontWeight: 900, fontSize: '1.75rem', color: gold, lineHeight: 1.1 }}>{periodWinner.total_participants}</p>
                </div>
              </div>
            </div>
          )}

          {/* Tie-Breaker Details */}
          {tieBreakerInfo && tieBreakerInfo.wasUsed && showTieBreakerInfo && (
            <div style={{ background: 'oklch(65% 0.12 290 / 0.07)', border: `1px solid oklch(65% 0.12 290 / 0.35)`, borderRadius: 10, padding: '1.25rem 1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <Trophy style={{ width: 18, height: 18, color: purple }} />
                <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', color: purple, textTransform: 'uppercase' }}>Tie-Breaker Applied</p>
              </div>
              <p style={{ ...b, fontSize: '0.8rem', color: textMid, marginBottom: '1rem' }}>
                Monday Night Score Tie-Breaker used for Week {tieBreakerInfo.tieBreakerWeek}
                {' '}(Actual Score: {tieBreakerInfo.poolAnswer})
              </p>
              <p style={{ ...bc, fontWeight: 700, fontSize: '0.75rem', color: textDim, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>Participants Involved:</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {tieBreakerInfo.participantsInvolved.map((participant: any) => (
                  <div key={participant.participant_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: surface, border: `1px solid ${border}`, borderRadius: 8, gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: 32, height: 32, background: 'oklch(65% 0.12 290 / 0.15)', border: `1px solid oklch(65% 0.12 290 / 0.4)`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ ...bc, fontWeight: 800, fontSize: '0.72rem', color: purple }}>#{participant.finalPosition}</span>
                      </div>
                      <div>
                        <p style={{ ...b, fontWeight: 600, fontSize: '0.875rem', color: text }}>{participant.name}</p>
                        <p style={{ ...b, fontSize: '0.72rem', color: textMid }}>{participant.points} pts</p>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ ...b, fontSize: '0.72rem', color: textDim }}>Monday Night Score</p>
                      <p style={{ ...b, fontWeight: 600, fontSize: '0.875rem', color: text }}>
                        {participant.mondayNightAnswer !== null ? participant.mondayNightAnswer : 'N/A'}
                      </p>
                      <p style={{ ...b, fontSize: '0.68rem', color: textDim }}>
                        Diff: {participant.mondayNightDifference !== Infinity ? participant.mondayNightDifference : 'N/A'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TABS ── */}
          <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 8, overflow: 'hidden' }}>
            {/* Tab bar */}
            <div style={{ display: 'flex', borderBottom: `1px solid ${border}`, background: surface }}>
              {TABS.map(({ id, label, icon: Icon }) => {
                const active = activeTab === id;
                return (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    style={{
                      flex: 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
                      padding: '0.65rem 0.5rem',
                      background: active ? card : 'transparent',
                      color: active ? text : textDim,
                      border: 'none',
                      borderBottom: active ? `2px solid ${green}` : '2px solid transparent',
                      ...bc, fontWeight: 700, fontSize: '0.72rem',
                      letterSpacing: '0.07em', textTransform: 'uppercase',
                      cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    <Icon style={{ width: 12, height: 12 }} />
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <div style={{ background: bg, padding: '1.5rem' }}>

              {/* ── LEADERBOARD TAB ── */}
              {activeTab === 'leaderboard' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <Users style={{ width: 16, height: 16, color: greenHi }} />
                    <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', color: text, textTransform: 'uppercase' }}>
                      {periodName === 'Playoffs' ? 'Playoffs' : 'Quarter'} Leaderboard
                    </p>
                  </div>
                  <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginBottom: '1.25rem' }}>
                    {periodInfo && (
                      periodName === 'Playoffs'
                        ? `Playoff Rounds: ${periodInfo.weeks.join(', ')} • ${periodInfo.totalWeeks} weeks`
                        : `Weeks ${periodInfo.weeks.join(', ')} • ${periodInfo.totalWeeks} weeks`
                    )}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {leaderboard.map((participant, index) => {
                      const isFirst = index === 0;
                      const isSecond = index === 1;
                      const isThird = index === 2;
                      const rowBg = isFirst
                        ? 'oklch(74% 0.16 72 / 0.07)'
                        : isSecond
                          ? 'oklch(72% 0.015 255 / 0.06)'
                          : isThird
                            ? 'oklch(72% 0.16 60 / 0.06)'
                            : surface;
                      const rowBorder = isFirst
                        ? 'oklch(74% 0.16 72 / 0.35)'
                        : isSecond
                          ? 'oklch(72% 0.015 255 / 0.25)'
                          : isThird
                            ? 'oklch(72% 0.16 60 / 0.25)'
                            : border;

                      return (
                        <div key={participant.participant_id} style={{ background: rowBg, border: `1px solid ${rowBorder}`, borderRadius: 8, padding: '0.85rem 1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                            {/* Name + rank */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
                              <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {renderRankIcon(index)}
                              </div>
                              <p style={{ ...b, fontWeight: 600, fontSize: '0.95rem', color: text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {participant.name}
                              </p>
                            </div>
                            {/* Stats */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexShrink: 0 }}>
                              <div style={{ textAlign: 'right' }}>
                                <p style={{ ...b, fontSize: '0.68rem', color: textDim, marginBottom: '0.1rem' }}>Points</p>
                                <p style={{ ...bc, fontWeight: 900, fontSize: '1.2rem', color: isFirst ? gold : greenHi, lineHeight: 1 }}>{participant.total_points}</p>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <p style={{ ...b, fontSize: '0.68rem', color: textDim, marginBottom: '0.1rem' }}>Weeks Won</p>
                                <p style={{ ...bc, fontWeight: 900, fontSize: '1.2rem', color: textMid, lineHeight: 1 }}>{participant.weeks_won}</p>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <p style={{ ...b, fontSize: '0.68rem', color: textDim, marginBottom: '0.1rem' }}>Record</p>
                                <p style={{ ...bc, fontWeight: 900, fontSize: '1.2rem', color: textMid, lineHeight: 1 }}>
                                  {participant.total_correct}-{participant.total_picks}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── WEEKLY WINNERS TAB ── */}
              {activeTab === 'weekly' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <Calendar style={{ width: 16, height: 16, color: greenHi }} />
                    <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', color: text, textTransform: 'uppercase' }}>Weekly Winners</p>
                  </div>
                  <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginBottom: '1.25rem' }}>
                    Winners for each week in {periodName}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {periodInfo && periodInfo.weeks.map((week) => {
                      const winner = weeklyWinners.find(w => w.week === week);
                      const weekGames = games.filter(game => game.week === week);

                      let weekStatus = 'not-started';
                      let statusText = 'Not Started';
                      let statusBg = 'oklch(26% 0.03 255)';
                      let statusColor = textDim;
                      let statusBorder = border;

                      if (weekGames.length > 0) {
                        const finishedGames = weekGames.filter(game => {
                          const status = game.status?.toLowerCase() || '';
                          return status === 'final' || status === 'post';
                        });

                        if (finishedGames.length === weekGames.length) {
                          weekStatus = 'completed';
                          statusText = 'Completed';
                          statusBg = 'oklch(46% 0.14 155 / 0.15)';
                          statusColor = greenHi;
                          statusBorder = 'oklch(46% 0.14 155 / 0.4)';
                        } else if (finishedGames.length > 0) {
                          weekStatus = 'in-progress';
                          statusText = 'In Progress';
                          statusBg = 'oklch(72% 0.16 60 / 0.1)';
                          statusColor = amber;
                          statusBorder = 'oklch(72% 0.16 60 / 0.35)';
                        }
                      }

                      debugLog(`Week ${week} status: ${weekStatus}, games: ${weekGames.length}, winner:`, winner);

                      return (
                        <div key={week} style={{ background: surface, border: `1px solid ${border}`, borderRadius: 8, padding: '0.85rem 1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                              {/* Week badge */}
                              <div style={{ width: 36, height: 36, background: 'oklch(46% 0.14 155 / 0.12)', border: `1px solid oklch(46% 0.14 155 / 0.3)`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <span style={{ ...bc, fontWeight: 800, fontSize: '0.72rem', color: greenHi }}>W{week}</span>
                              </div>
                              <div style={{ minWidth: 0 }}>
                                {weekStatus === 'completed' && winner ? (
                                  <>
                                    <p style={{ ...b, fontWeight: 600, fontSize: '0.95rem', color: text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{winner.winner_name}</p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                                      <span style={{ ...b, fontSize: '0.78rem', color: textMid }}>
                                        <span style={{ color: greenHi, fontWeight: 700 }}>{winner.winner_points}</span> pts
                                      </span>
                                      <span style={{ color: textDim, fontSize: '0.7rem' }}>•</span>
                                      <span style={{ ...b, fontSize: '0.78rem', color: textMid }}>
                                        <span style={{ fontWeight: 700 }}>{winner.winner_correct_picks}</span> correct
                                      </span>
                                    </div>
                                  </>
                                ) : weekStatus === 'in-progress' ? (
                                  <>
                                    <p style={{ ...b, fontWeight: 600, fontSize: '0.95rem', color: amber }}>Games In Progress</p>
                                    <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginTop: '0.2rem' }}>
                                      {weekGames.filter(game => {
                                        const status = game.status?.toLowerCase() || '';
                                        return status === 'final' || status === 'post';
                                      }).length} of {weekGames.length} games finished
                                    </p>
                                  </>
                                ) : (
                                  <>
                                    <p style={{ ...b, fontWeight: 600, fontSize: '0.95rem', color: textDim }}>Week Not Started</p>
                                    <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginTop: '0.2rem' }}>
                                      {weekGames.length} games scheduled
                                    </p>
                                  </>
                                )}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                              <span style={{ ...bc, fontWeight: 700, fontSize: '0.6rem', letterSpacing: '0.07em', padding: '0.12rem 0.45rem', borderRadius: 4, textTransform: 'uppercase', background: statusBg, color: statusColor, border: `1px solid ${statusBorder}` }}>
                                {statusText}
                              </span>
                              {winner?.tie_breaker_used && (
                                <span style={{ ...bc, fontWeight: 700, fontSize: '0.6rem', letterSpacing: '0.07em', padding: '0.12rem 0.45rem', borderRadius: 4, textTransform: 'uppercase', background: 'oklch(65% 0.12 290 / 0.1)', color: purple, border: `1px solid oklch(65% 0.12 290 / 0.35)` }}>
                                  Tie Breaker
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── CHART TAB ── */}
              {activeTab === 'chart' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <BarChart3 style={{ width: 16, height: 16, color: greenHi }} />
                    <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', color: text, textTransform: 'uppercase' }}>Points Per Week</p>
                  </div>
                  <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginBottom: '1.25rem' }}>
                    Visual representation of each participant&apos;s points throughout {periodName}
                  </p>

                  {/* Participant selection */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    <p style={{ ...bc, fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase', marginBottom: '0.6rem' }}>Select Participants to Display:</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      {leaderboard.map((participant) => {
                        const checked = selectedParticipants.includes(participant.name);
                        return (
                          <label
                            key={participant.participant_id}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', padding: '0.25rem 0.6rem', background: checked ? 'oklch(46% 0.14 155 / 0.12)' : surface, border: `1px solid ${checked ? 'oklch(46% 0.14 155 / 0.4)' : border}`, borderRadius: 5 }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedParticipants(prev => [...prev, participant.name]);
                                } else {
                                  setSelectedParticipants(prev => prev.filter(name => name !== participant.name));
                                }
                              }}
                              style={{ accentColor: green, width: 13, height: 13 }}
                            />
                            <span style={{ ...b, fontSize: '0.8rem', color: checked ? text : textMid }}>{participant.name}</span>
                          </label>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => handleParticipantSelection('select-all')}
                        style={{ padding: '0.25rem 0.65rem', background: 'oklch(46% 0.14 155 / 0.12)', color: greenHi, border: `1px solid oklch(46% 0.14 155 / 0.35)`, borderRadius: 4, ...bc, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}
                      >
                        Select All
                      </button>
                      <button
                        onClick={() => handleParticipantSelection('clear-all')}
                        style={{ padding: '0.25rem 0.65rem', background: surface, color: textMid, border: `1px solid ${border}`, borderRadius: 4, ...bc, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  {chartData.length > 0 ? (
                    <div style={{ height: 384, width: '100%' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={chartData}
                          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke={border} />
                          <XAxis
                            dataKey="week"
                            tick={{ fontSize: 12, fill: textMid, fontFamily: 'var(--font-barlow-condensed)' }}
                            angle={-45}
                            textAnchor="end"
                            height={60}
                            axisLine={{ stroke: border }}
                            tickLine={{ stroke: border }}
                          />
                          <YAxis
                            tick={{ fontSize: 12, fill: textMid, fontFamily: 'var(--font-barlow-condensed)' }}
                            label={{ value: 'Points', angle: -90, position: 'insideLeft', fill: textDim, fontFamily: 'var(--font-barlow-condensed)', fontSize: 12 }}
                            axisLine={{ stroke: border }}
                            tickLine={{ stroke: border }}
                          />
                          <Tooltip
                            contentStyle={{ backgroundColor: card, border: `1px solid ${border}`, borderRadius: 8, fontFamily: 'var(--font-barlow)', fontSize: 13, color: text }}
                            labelStyle={{ color: textMid, fontFamily: 'var(--font-barlow-condensed)', fontWeight: 700, textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.06em' }}
                            formatter={(value: number, name: string) => [value, name]}
                            labelFormatter={(label: string) => label}
                          />
                          <Legend
                            wrapperStyle={{ fontFamily: 'var(--font-barlow)', fontSize: 13, color: textMid }}
                          />
                          {leaderboard.map((participant, index) => (
                            <Line
                              key={participant.participant_id}
                              type="monotone"
                              dataKey={participant.name}
                              stroke={chartColors[index % chartColors.length]}
                              strokeWidth={2}
                              dot={{ r: 4, fill: chartColors[index % chartColors.length] }}
                              activeDot={{ r: 6 }}
                              connectNulls={false}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : selectedParticipants.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                      <BarChart3 style={{ width: 48, height: 48, color: textDim, margin: '0 auto 0.75rem' }} />
                      <p style={{ ...bc, fontWeight: 700, fontSize: '0.9rem', color: textMid, textTransform: 'uppercase', marginBottom: '0.25rem' }}>No Participants Selected</p>
                      <p style={{ ...b, fontSize: '0.8rem', color: textDim }}>Select participants above to display their points on the chart</p>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                      <BarChart3 style={{ width: 48, height: 48, color: textDim, margin: '0 auto 0.75rem' }} />
                      <p style={{ ...bc, fontWeight: 700, fontSize: '0.9rem', color: textMid, textTransform: 'uppercase', marginBottom: '0.25rem' }}>No Chart Data Available</p>
                      <p style={{ ...b, fontSize: '0.8rem', color: textDim }}>Chart will appear when leaderboard data is loaded</p>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>

        </div>
      </section>
    </div>
  );
}
