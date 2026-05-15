'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { notFound } from 'next/navigation';
import { Leaderboard } from '@/components/leaderboard/leaderboard';
import { SeasonLeaderboard } from '@/components/leaderboard/season-leaderboard';
import { Trophy, Lock, ChevronLeft, ChevronRight, RefreshCw, LogOut, ArrowLeft, Calendar, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DEFAULT_POOL_SEASON, getWeekTitle as getWeekTitleUtil, getMaxWeeksForSeason } from '@/lib/utils';
import { Footer } from '@/components/layout/Footer';
import { Game } from '@/types/game';

const bg      = 'oklch(13% 0.025 255)';
const surface = 'oklch(17% 0.028 255)';
const card    = 'oklch(20% 0.03 255)';
const border  = 'oklch(26% 0.03 255)';
const greenHi = 'oklch(59% 0.15 155)';
const gold    = 'oklch(74% 0.16 72)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const amber   = 'oklch(72% 0.16 60)';
const liveRed = 'oklch(62% 0.22 25)';
const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

const seasonTypeLabels: Record<number, string> = { 1: 'Preseason', 2: 'Regular Season', 3: 'Postseason' };

function PoolHistoryContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const poolId = params.id as string;
  const weekParam = searchParams.get('week');
  const seasonTypeParam = searchParams.get('seasonType');

  const [poolName, setPoolName] = useState('');
  const [poolSeason, setPoolSeason] = useState(DEFAULT_POOL_SEASON);
  const [currentWeek, setCurrentWeek] = useState(parseInt(weekParam || '1'));
  const [currentSeasonType, setCurrentSeasonType] = useState(parseInt(seasonTypeParam || '2'));
  const [games, setGames] = useState<Game[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  const router = useRouter();
  const getWeekTitle = () => getWeekTitleUtil(currentWeek, currentSeasonType);

  const loadGames = async (week: number, seasonType: number, season: number) => {
    setGamesLoading(true);
    try {
      const res = await fetch(`/api/games/week?week=${week}&seasonType=${seasonType}&season=${season}`);
      if (res.ok) {
        const data = await res.json();
        setGames(data.success ? (data.games || []) : []);
      } else {
        setGames([]);
      }
    } catch {
      setGames([]);
    } finally {
      setGamesLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(poolId)) { notFound(); return; }

        const res = await fetch(`/api/pools/${poolId}`);
        if (!res.ok) { setError('Pool not found'); return; }
        const data = await res.json();
        if (!data.success || !data.pool) { notFound(); return; }

        const pool = data.pool;

        // Active pools use the picks page
        if (pool.is_active) {
          router.replace(`/pool/${poolId}/picks?week=${currentWeek}&seasonType=${currentSeasonType}`);
          return;
        }

        const season = pool.season || DEFAULT_POOL_SEASON;
        setPoolName(pool.name);
        setPoolSeason(season);

        const week = parseInt(weekParam || '1');
        const seasonType = parseInt(seasonTypeParam || '2');
        setCurrentWeek(week);
        setCurrentSeasonType(seasonType);

        // Check admin status
        try {
          const { getSupabaseClient } = await import('@/lib/supabase');
          const supabase = getSupabaseClient();
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const { data: admin } = await supabase.from('admins').select('id').eq('id', session.user.id).single();
            if (admin) setIsAdmin(true);
          }
        } catch {}

        await loadGames(week, seasonType, season);
      } catch {
        setError('Failed to load season history. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolId]);

  const navigateToWeek = async (week: number, seasonType: number) => {
    const maxWeeks = getMaxWeeksForSeason(seasonType);
    if (week < 1 || week > maxWeeks) return;
    setCurrentWeek(week);
    setCurrentSeasonType(seasonType);
    router.replace(`/pool/${poolId}/history?week=${week}&seasonType=${seasonType}`, { scroll: false });
    await loadGames(week, seasonType, poolSeason);
  };

  const handlePrev = () => {
    if (currentWeek > 1) {
      navigateToWeek(currentWeek - 1, currentSeasonType);
    } else if (currentSeasonType > 1) {
      const prev = currentSeasonType - 1 as 1 | 2 | 3;
      navigateToWeek(getMaxWeeksForSeason(prev), prev);
    }
  };

  const handleNext = () => {
    const maxWeeks = getMaxWeeksForSeason(currentSeasonType);
    if (currentWeek < maxWeeks) {
      navigateToWeek(currentWeek + 1, currentSeasonType);
    } else if (currentSeasonType < 3) {
      navigateToWeek(1, currentSeasonType + 1);
    }
  };

  const prevDisabled = currentSeasonType === 1 && currentWeek <= 1;
  const nextDisabled = currentSeasonType === 3 && currentWeek >= getMaxWeeksForSeason(3);

  const handleLogout = async () => {
    try {
      const { getSupabaseClient } = await import('@/lib/supabase');
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
      router.push('/admin/login');
    } catch {}
  };

  // ── LOADING ────────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '2rem', textAlign: 'center' }}>
          <RefreshCw style={{ width: 32, height: 32, color: textDim, margin: '0 auto 0.75rem', animation: 'spin 1s linear infinite' }} />
          <p style={{ ...b, color: textMid, fontSize: '0.9rem' }}>Loading season history…</p>
        </div>
      </div>
    );
  }

  // ── ERROR ──────────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <div style={{ background: card, border: `1px solid ${border}`, borderTop: `3px solid ${liveRed}`, borderRadius: 10, padding: '2rem', width: '100%', maxWidth: 440, textAlign: 'center' }}>
          <AlertTriangle style={{ width: 36, height: 36, color: liveRed, margin: '0 auto 0.75rem' }} />
          <h2 style={{ ...bc, fontWeight: 800, fontSize: '1.05rem', color: text, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Error Loading History</h2>
          <p style={{ ...b, fontSize: '0.85rem', color: textMid, marginBottom: '1.25rem' }}>{error}</p>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1rem', background: 'oklch(46% 0.14 155)', color: text, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.07em', textTransform: 'uppercase', textDecoration: 'none' }}>
            <ArrowLeft style={{ width: 13, height: 13 }} /> Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const btnBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '0.3rem',
    padding: '0.4rem 0.85rem', border: `1px solid ${border}`, borderRadius: 5,
    ...bc, fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.07em',
    textTransform: 'uppercase', cursor: 'pointer', background: 'transparent', color: textMid,
  };

  // ── MAIN ───────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: bg }}>

      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'oklch(13% 0.025 255 / 0.95)', backdropFilter: 'blur(14px)', borderBottom: `1px solid ${border}` }}>
        <div className="lp-inner" style={{ paddingTop: '0.75rem', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {isAdmin && (
                <>
                  <Link href="/admin/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.6rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer', textDecoration: 'none' }}>
                    <ArrowLeft style={{ width: 12, height: 12 }} /> Dashboard
                  </Link>
                  <div style={{ width: 1, height: 20, background: border }} />
                </>
              )}
              <span style={{ ...bc, fontWeight: 800, fontSize: '0.92rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase' }}>
                Sunday Huddle
              </span>
            </div>
            {isAdmin && (
              <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.7rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}>
                <LogOut style={{ width: 11, height: 11 }} /> Log Out
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Closed season banner */}
      <div style={{ background: `oklch(72% 0.16 60 / 0.12)`, borderBottom: `1px solid oklch(72% 0.16 60 / 0.35)`, padding: '0.65rem 0' }}>
        <div className="lp-inner" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Lock style={{ width: 13, height: 13, color: amber, flexShrink: 0 }} />
          <span style={{ ...b, fontSize: '0.8rem', color: amber }}>
            {poolName} — Season {poolSeason} is complete. You are viewing final results.
          </span>
        </div>
      </div>

      {/* Hero */}
      <section style={{ background: bg, backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 59px, oklch(100% 0 0 / 0.022) 59px, oklch(100% 0 0 / 0.022) 60px)`, padding: 'clamp(1.5rem, 3vw, 2.5rem) 0' }}>
        <div className="lp-inner">
          <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.26em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ display: 'inline-block', width: 18, height: 2, background: greenHi, borderRadius: 1 }} />
            {poolName}
            <span style={{ ...bc, fontWeight: 700, fontSize: '0.6rem', letterSpacing: '0.08em', padding: '0.1rem 0.45rem', borderRadius: 4, background: `oklch(72% 0.16 60 / 0.18)`, color: amber, border: `1px solid oklch(72% 0.16 60 / 0.4)`, textTransform: 'uppercase' }}>
              {poolSeason} Season
            </span>
          </p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h1 style={{ ...bc, fontWeight: 900, fontSize: 'clamp(1.5rem, 3vw, 2rem)', color: text, textTransform: 'uppercase' }}>
              {getWeekTitle()} <span style={{ color: gold }}>Results</span>
            </h1>

            {/* Week navigation — no "Current" button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                onClick={handlePrev}
                disabled={prevDisabled}
                style={{ ...btnBase, opacity: prevDisabled ? 0.38 : 1, cursor: prevDisabled ? 'not-allowed' : 'pointer' }}
              >
                <ChevronLeft style={{ width: 14, height: 14 }} /> Prev
              </button>

              <span style={{ ...bc, fontWeight: 700, fontSize: '0.75rem', color: textMid, padding: '0.3rem 0.7rem', border: `1px solid ${border}`, borderRadius: 5, minWidth: 100, textAlign: 'center' }}>
                {seasonTypeLabels[currentSeasonType]}
              </span>

              <button
                onClick={handleNext}
                disabled={nextDisabled}
                style={{ ...btnBase, opacity: nextDisabled ? 0.38 : 1, cursor: nextDisabled ? 'not-allowed' : 'pointer' }}
              >
                Next <ChevronRight style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
            <span style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.08em', padding: '0.15rem 0.5rem', borderRadius: 4, textTransform: 'uppercase', background: 'oklch(26% 0.03 255)', color: textMid, border: `1px solid ${border}` }}>
              {games.length} games
            </span>
            <span style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.08em', padding: '0.15rem 0.5rem', borderRadius: 4, textTransform: 'uppercase', background: 'oklch(26% 0.03 255)', color: textMid, border: `1px solid ${border}` }}>
              {seasonTypeLabels[currentSeasonType]}
            </span>
          </div>
        </div>
      </section>
      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${amber}, transparent)` }} />

      {/* Content */}
      <section style={{ background: bg, padding: '1.5rem 0 3rem' }}>
        <div className="lp-inner" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          
          {/* Week leaderboard */}
          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Trophy style={{ width: 15, height: 15, color: gold }} />
              <span style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', color: text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {getWeekTitle()} Final Standings
              </span>
            </div>
            <div style={{ padding: '1.25rem' }}>
              <Leaderboard poolId={poolId} weekNumber={currentWeek} seasonType={currentSeasonType} season={poolSeason} />
            </div>
          </div>

          {/* Season standings */}
          <details style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden' }}>
            <summary style={{ padding: '1rem 1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', ...bc, fontWeight: 700, fontSize: '0.82rem', color: textMid, textTransform: 'uppercase', letterSpacing: '0.06em', listStyle: 'none' }}>
              <Trophy style={{ width: 14, height: 14 }} />
              Show Season {poolSeason} Final Standings
            </summary>
            <div style={{ borderTop: `1px solid ${border}`, padding: '1.25rem' }}>
              <SeasonLeaderboard poolId={poolId} season={poolSeason} currentWeek={currentWeek} currentSeasonType={currentSeasonType} />
            </div>
          </details>

        </div>
      </section>

      <Footer pageName="Season History" />
    </div>
  );
}

export default function PoolHistoryPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: 'oklch(13% 0.025 255)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: 'oklch(20% 0.03 255)', border: '1px solid oklch(26% 0.03 255)', borderRadius: 10, padding: '2rem', textAlign: 'center' }}>
          <RefreshCw style={{ width: 32, height: 32, color: 'oklch(50% 0.018 255)', margin: '0 auto 0.75rem', animation: 'spin 1s linear infinite' }} />
          <p style={{ fontFamily: 'var(--font-barlow)', color: 'oklch(72% 0.015 255)', fontSize: '0.9rem' }}>Loading season history…</p>
        </div>
      </div>
    }>
      <PoolHistoryContent />
    </Suspense>
  );
}
