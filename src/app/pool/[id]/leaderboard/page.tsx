'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Trophy, Target, BarChart3, RefreshCw,
  AlertTriangle, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Leaderboard } from '@/components/leaderboard/leaderboard';
import { SeasonLeaderboard } from '@/components/leaderboard/season-leaderboard';
import { QuarterLeaderboard } from '@/components/leaderboard/quarter-leaderboard';
import { BrandLogo } from '@/components/ui/brand-logo';
import { Footer } from '@/components/layout/Footer';
import { loadCurrentWeek } from '@/actions/loadCurrentWeek';
import { DEFAULT_POOL_SEASON, getWeekTitle as getWeekTitleUtil, getMaxWeeksForSeason } from '@/lib/utils';

// Design tokens (matches landing page / app-wide dark theme)
const bg      = 'oklch(13% 0.025 255)';
const card    = 'oklch(20% 0.03 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const gold    = 'oklch(74% 0.16 72)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const liveRed = 'oklch(62% 0.22 25)';

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

const seasonTypeLabels: Record<number, string> = { 1: 'Preseason', 2: 'Regular Season', 3: 'Postseason' };

const TABS = [
  { id: 'weekly',  label: 'Weekly',  icon: Trophy },
  { id: 'season',  label: 'Season',  icon: BarChart3 },
  { id: 'periods', label: 'Periods', icon: Target },
] as const;

type TabId = typeof TABS[number]['id'];

function PoolLeaderboardContent() {
  const params = useParams();
  const router = useRouter();
  const poolId = params.id as string;

  const [poolName, setPoolName] = useState('');
  const [poolSeason, setPoolSeason] = useState(DEFAULT_POOL_SEASON);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [currentSeasonType, setCurrentSeasonType] = useState(2);
  const [activeTab, setActiveTab] = useState<TabId>('weekly');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const getWeekTitle = () => getWeekTitleUtil(currentWeek, currentSeasonType);

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
        setPoolName(pool.name);
        setPoolSeason(pool.season || DEFAULT_POOL_SEASON);

        if (pool.is_active) {
          const week = await loadCurrentWeek();
          setCurrentWeek(week?.week_number || 1);
          setCurrentSeasonType(week?.season_type || 2);
        } else {
          // Closed pool — land on the season tab for final standings
          setActiveTab('season');
        }
      } catch {
        setError('Failed to load leaderboard. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolId]);

  const navigateToWeek = (week: number, seasonType: number) => {
    const maxWeeks = getMaxWeeksForSeason(seasonType);
    if (week < 1 || week > maxWeeks) return;
    setCurrentWeek(week);
    setCurrentSeasonType(seasonType);
  };

  const handlePrev = () => {
    if (currentWeek > 1) {
      navigateToWeek(currentWeek - 1, currentSeasonType);
    } else if (currentSeasonType > 1) {
      const prev = currentSeasonType - 1;
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

  const btnBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '0.3rem',
    padding: '0.4rem 0.85rem', border: `1px solid ${border}`, borderRadius: 5,
    ...bc, fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.07em',
    textTransform: 'uppercase', cursor: 'pointer', background: 'transparent', color: textMid,
  };

  // ── LOADING ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '2rem', textAlign: 'center' }}>
          <RefreshCw style={{ width: 32, height: 32, color: textDim, margin: '0 auto 0.75rem', animation: 'spin 1s linear infinite' }} />
          <p style={{ ...b, color: textMid, fontSize: '0.9rem' }}>Loading leaderboard…</p>
        </div>
      </div>
    );
  }

  // ── ERROR ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <div style={{ background: card, border: `1px solid ${border}`, borderTop: `3px solid ${liveRed}`, borderRadius: 10, padding: '2rem', width: '100%', maxWidth: 440, textAlign: 'center' }}>
          <AlertTriangle style={{ width: 36, height: 36, color: liveRed, margin: '0 auto 0.75rem' }} />
          <h2 style={{ ...bc, fontWeight: 800, fontSize: '1.05rem', color: text, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Error Loading Leaderboard</h2>
          <p style={{ ...b, fontSize: '0.85rem', color: textMid, marginBottom: '1.25rem' }}>{error}</p>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1rem', background: green, color: text, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.07em', textTransform: 'uppercase', textDecoration: 'none' }}>
            <ArrowLeft style={{ width: 13, height: 13 }} /> Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // ── MAIN ─────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: bg }}>

      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'oklch(13% 0.025 255 / 0.95)', backdropFilter: 'blur(14px)', borderBottom: `1px solid ${border}` }}>
        <div className="lp-inner" style={{ paddingTop: '0.75rem', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', rowGap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0 }}>
              <BrandLogo variant="icon" size={28} />
              <span style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                Sunday Huddle
              </span>
            </div>
            <button
              onClick={() => router.push(`/pool/${poolId}/picks`)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'transparent', border: `1px solid ${border}`, color: textMid, borderRadius: 6, padding: '0.4rem 0.8rem', ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer', flexShrink: 0 }}
            >
              <ArrowLeft style={{ width: 12, height: 12 }} /> <span className="pools-nav-label">Back to Picks</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ background: bg, backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 59px, oklch(100% 0 0 / 0.022) 59px, oklch(100% 0 0 / 0.022) 60px)`, padding: 'clamp(1.5rem, 3vw, 2.5rem) 0' }}>
        <div className="lp-inner">
          <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.26em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ display: 'inline-block', width: 18, height: 2, background: greenHi, borderRadius: 1 }} />
            {poolName}
            <span style={{ ...bc, fontWeight: 700, fontSize: '0.6rem', letterSpacing: '0.08em', padding: '0.1rem 0.45rem', borderRadius: 4, background: `${gold}18`, color: gold, border: `1px solid ${gold}55`, textTransform: 'uppercase' }}>
              {poolSeason} Season
            </span>
          </p>
          <h1 style={{ ...bc, fontWeight: 900, fontSize: 'clamp(1.5rem, 3vw, 2rem)', color: text, textTransform: 'uppercase', marginBottom: '0.85rem' }}>
            Leader<span style={{ color: gold }}>board</span>
          </h1>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  padding: '0.4rem 0.8rem', borderRadius: 6,
                  background: activeTab === id ? green : 'transparent',
                  color: activeTab === id ? text : textMid,
                  border: `1px solid ${activeTab === id ? green : border}`,
                  ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.06em',
                  textTransform: 'uppercase', cursor: 'pointer',
                }}
              >
                <Icon style={{ width: 12, height: 12 }} /> {label}
              </button>
            ))}
          </div>
        </div>
      </section>
      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${green}, transparent)` }} />

      {/* Content */}
      <section style={{ background: bg, padding: '1.5rem 0 3rem' }}>
        <div className="lp-inner">
          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Trophy style={{ width: 15, height: 15, color: gold }} />
                <span style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', color: text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {activeTab === 'weekly' ? `${getWeekTitle()} Standings` : activeTab === 'season' ? `Season ${poolSeason} Standings` : 'Period Standings'}
                </span>
              </div>

              {activeTab === 'weekly' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button onClick={handlePrev} disabled={prevDisabled} style={{ ...btnBase, opacity: prevDisabled ? 0.38 : 1, cursor: prevDisabled ? 'not-allowed' : 'pointer' }}>
                    <ChevronLeft style={{ width: 14, height: 14 }} /> Prev
                  </button>
                  <span style={{ ...bc, fontWeight: 700, fontSize: '0.75rem', color: textMid, padding: '0.3rem 0.7rem', border: `1px solid ${border}`, borderRadius: 5, minWidth: 100, textAlign: 'center' }}>
                    {seasonTypeLabels[currentSeasonType]}
                  </span>
                  <button onClick={handleNext} disabled={nextDisabled} style={{ ...btnBase, opacity: nextDisabled ? 0.38 : 1, cursor: nextDisabled ? 'not-allowed' : 'pointer' }}>
                    Next <ChevronRight style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              )}
            </div>

            <div style={{ padding: '1.25rem' }}>
              {activeTab === 'weekly' && (
                <Leaderboard poolId={poolId} weekNumber={currentWeek} seasonType={currentSeasonType} season={poolSeason} />
              )}
              {activeTab === 'season' && (
                <SeasonLeaderboard poolId={poolId} season={poolSeason} currentWeek={currentWeek} currentSeasonType={currentSeasonType} />
              )}
              {activeTab === 'periods' && (
                <QuarterLeaderboard poolId={poolId} season={poolSeason} currentWeek={currentWeek} seasonType={currentSeasonType} />
              )}
            </div>
          </div>
        </div>
      </section>

      <Footer pageName="Leaderboard" />
    </div>
  );
}

export default function PoolLeaderboardPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: 'oklch(13% 0.025 255)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: 'oklch(20% 0.03 255)', border: '1px solid oklch(26% 0.03 255)', borderRadius: 10, padding: '2rem', textAlign: 'center' }}>
          <RefreshCw style={{ width: 32, height: 32, color: 'oklch(50% 0.018 255)', margin: '0 auto 0.75rem', animation: 'spin 1s linear infinite' }} />
          <p style={{ fontFamily: 'var(--font-barlow)', color: 'oklch(72% 0.015 255)', fontSize: '0.9rem' }}>Loading leaderboard…</p>
        </div>
      </div>
    }>
      <PoolLeaderboardContent />
    </Suspense>
  );
}
