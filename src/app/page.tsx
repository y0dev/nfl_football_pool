'use client';

import { useState, useEffect } from 'react';
import { Search, Users, Trophy, Calendar, Shield, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, AuthProvider } from '@/lib/auth';
import { loadCurrentWeek } from '@/actions/loadCurrentWeek';
import { loadWeekGames } from '@/actions/loadWeekGames';
import { createPageUrl, getWeekTitle as getWeekTitleUtil, isOffseason, debugLog, debugError} from '@/lib/utils';
import { isPricingVisible } from '@/lib/billing';
import { Footer } from '@/components/layout/Footer';
import { OffseasonBanner } from '@/components/ui/offseason-banner';
import { BrandLogo } from '@/components/ui/brand-logo';

interface Game {
  id: string;
  home_team: string;
  away_team: string;
  home_team_id?: string | number;
  away_team_id?: string | number;
  home_score: number;
  away_score: number;
  status: string;
  kickoff_time: string;
  winner: string;
}

// Design tokens
const bg      = 'oklch(13% 0.025 255)';
const surface = 'oklch(17% 0.028 255)';
const card    = 'oklch(20% 0.03 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const gold    = 'oklch(74% 0.16 72)';
const goldHi  = 'oklch(82% 0.18 72)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const liveRed = 'oklch(62% 0.22 25)';

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

function LandingPage() {
  const { user, verifyAdminStatus } = useAuth();
  const router = useRouter();
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentWeek, setCurrentWeek] = useState(1);
  const [currentSeasonType, setCurrentSeasonType] = useState(2);
  const [games, setGames] = useState<Game[]>([]);
  const [isLoadingGames, setIsLoadingGames] = useState(true);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (user) {
        setIsCheckingAdmin(true);
        try {
          const superAdminStatus = await verifyAdminStatus(true);
          setIsSuperAdmin(superAdminStatus);
        } catch (error) {
          debugError('Error checking admin status:', error);
          setIsSuperAdmin(false);
        } finally {
          setIsCheckingAdmin(false);
        }
      } else {
        setIsSuperAdmin(null);
      }
    };
    checkAdminStatus();
  }, [user]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const weekData = await loadCurrentWeek();
        const weekNum = weekData?.week_number || 1;
        const seasonType = weekData?.season_type ?? 2;
        const seasonNumber = weekData?.season_year || new Date().getFullYear();
        setCurrentWeek(weekNum);
        setCurrentSeasonType(seasonType);

        // seasonType 0 = offseason signal from getCurrentWeekFromGames
        if (seasonType !== 0) {
          const weekGames = await loadWeekGames(weekNum, seasonType, seasonNumber);
          setGames(weekGames as Game[]);
        }
      } catch (error) {
        debugError('Error loading data:', error);
      } finally {
        setIsLoadingGames(false);
      }
    };
    loadData();
  }, []);

  const handleSearch = () => {
    if (!searchTerm.trim()) return;
    router.push(`/pools?q=${encodeURIComponent(searchTerm.trim())}`);
  };

  const getGameStatus = (game: Game) => {
    if (game.status === 'final') return 'Final';
    if (game.status === 'live') return 'Live';
    const kickoff = new Date(game.kickoff_time);
    const now = new Date();
    if (kickoff > now) {
      return kickoff.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    }
    return 'Starting Soon';
  };

  const getGameScore = (game: Game) => {
    if (game.status === 'scheduled') return '';
    return `${game.away_score} - ${game.home_score}`;
  };

  // Derive title from actual loaded data, not the calendar-based isOffseason() check
  const getDisplayTitle = () => {
    if (currentSeasonType === 0) return 'Offseason';
    if (currentSeasonType === 3) {
      const rounds: Record<number, string> = { 1: 'Wild Card', 2: 'Divisional', 3: 'Championship', 4: 'Super Bowl' };
      return `${rounds[currentWeek] ?? `Playoff Week ${currentWeek}`} Games`;
    }
    if (currentSeasonType === 1) {
      if (currentWeek === 1) return 'Hall of Fame Game';
      return `Preseason Week ${currentWeek} Games`;
    }
    return `Week ${currentWeek} Games`;
  };

  debugLog('Loaded games:', games);
  // Filter out malformed entries (e.g. Hall of Fame Game stored without a real away team)
  const validGames = games.filter(
    g => (g.away_team_id || g.away_team) && (g.home_team_id || g.home_team)
  );

  const features = [
    { icon: Trophy,   label: 'Weekly Competition', body: 'Confidence points separate the bold from the lucky — assign more points to games you are sure about.',   accent: gold },
    { icon: Users,    label: 'Commissioner Tools',  body: 'Create a pool, invite players, manage picks, and track standings. Everything you need to run a great season.', accent: greenHi },
    { icon: Calendar, label: 'All Season Long',     body: 'Q1-Q4 period prizes, playoff pools, and email reminders keep every week on the line through February.',   accent: gold },
  ];

  const commissionerSteps = [
    { n: '01', title: 'Create a Pool',    body: 'Register as a commissioner and set up your pool in minutes' },
    { n: '02', title: 'Invite Players',   body: 'Share your pool link — players join and submit picks each week' },
    { n: '03', title: 'Run the Season',   body: 'Manage picks, unlock weeks, and crown winners all season long' },
  ];

  const playerSteps = [
    { n: '01', title: 'Join a Pool',   body: 'Get an invite from your commissioner and create your account' },
    { n: '02', title: 'Make Picks',    body: 'Pick winners and assign confidence points before kickoff' },
    { n: '03', title: 'Win the Week',  body: 'Earn points for correct picks and climb the leaderboard' },
  ];

  return (
    <div style={{ background: bg, minHeight: '100vh' }}>

      {/* ── NAV ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'oklch(13% 0.025 255 / 0.95)',
        backdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${border}`,
      }}>
        <div className="lp-inner" style={{ paddingTop: '0.75rem', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', rowGap: '0.5rem' }}>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0 }}>
              <BrandLogo variant="icon" size={32} />
              <span style={{
                ...bc, fontWeight: 800, fontSize: '0.95rem',
                letterSpacing: '0.07em', color: text, textTransform: 'uppercase',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                Sunday Huddle
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap', rowGap: '0.5rem' }}>
              <div className="lp-nav-links">
                <Link href="/how-it-works" style={{ ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.06em', color: textMid, textTransform: 'uppercase', textDecoration: 'none' }}>
                  How It Works
                </Link>
                <Link href="/faq" style={{ ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.06em', color: textMid, textTransform: 'uppercase', textDecoration: 'none' }}>
                  FAQ
                </Link>
                {isPricingVisible() && (
                  <Link href="/pricing" style={{ ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.06em', color: textMid, textTransform: 'uppercase', textDecoration: 'none' }}>
                    Pricing
                  </Link>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
              {user ? (
                <button
                  onClick={() => {
                    if (isSuperAdmin === true) router.push('/admin/dashboard');
                    else if (isSuperAdmin === false) router.push('/dashboard');
                  }}
                  disabled={isCheckingAdmin}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.45rem 0.9rem',
                    background: green, color: text, border: 'none', borderRadius: 6,
                    ...bc, fontWeight: 700, fontSize: '0.78rem',
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    cursor: isCheckingAdmin ? 'not-allowed' : 'pointer',
                    opacity: isCheckingAdmin ? 0.55 : 1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Shield className="h-3.5 w-3.5" />
                  {isCheckingAdmin ? 'Loading…' : isSuperAdmin ? 'Admin Dashboard' : 'Commissioner Dashboard'}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => router.push('/login')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.4rem',
                      padding: '0.45rem 0.9rem',
                      background: 'transparent', color: textMid,
                      border: `1px solid ${border}`, borderRadius: 6,
                      ...bc, fontWeight: 700, fontSize: '0.78rem',
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                      cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    <Shield className="h-3.5 w-3.5" />
                    Sign In
                  </button>
                  <button
                    onClick={() => router.push('/register')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.4rem',
                      padding: '0.45rem 0.9rem',
                      background: green, color: text, border: 'none', borderRadius: 6,
                      ...bc, fontWeight: 700, fontSize: '0.78rem',
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                      cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create Pool
                  </button>
                </>
              )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{
        background: bg,
        backgroundImage: `repeating-linear-gradient(
          0deg,
          transparent,
          transparent 59px,
          oklch(100% 0 0 / 0.022) 59px,
          oklch(100% 0 0 / 0.022) 60px
        )`,
        padding: 'clamp(3.5rem, 8vw, 6rem) 0',
      }}>
        <div className="lp-inner">
          {/* .lp-hero-row: flex-col on mobile, flex-row on 768px+ */}
          <div className="lp-hero-row">

            {/* .lp-hero-text: full-width on mobile, flex-1 on desktop */}
            <div className="lp-hero-text">
              <p style={{
                ...bc, fontWeight: 700, fontSize: '0.67rem',
                letterSpacing: '0.28em', color: greenHi,
                textTransform: 'uppercase', marginBottom: '1.1rem',
                display: 'flex', alignItems: 'center', gap: '0.55rem',
              }}>
                <span style={{ display: 'inline-block', width: 20, height: 2, background: greenHi, borderRadius: 1, flexShrink: 0 }} />
                Weekly Confidence Pool
              </p>

              <h1 style={{
                ...bc, fontWeight: 900,
                fontSize: 'clamp(3rem, 8vw, 5.25rem)',
                lineHeight: 0.92, letterSpacing: '-0.01em',
                color: text, textTransform: 'uppercase',
                marginBottom: '1.5rem',
              }}>
                Pick&nbsp;&apos;em.<br />
                Prove&nbsp;&apos;em.<br />
                <span style={{ color: goldHi }}>Win the<br />week.</span>
              </h1>

              <p style={{
                ...b, fontSize: '1rem', lineHeight: 1.72,
                color: textMid, maxWidth: '40ch',
              }}>
                Pick winners, assign confidence points, and compete with friends and family all season long.
              </p>
            </div>

            {/* .lp-hero-card: full-width on mobile, fixed 380px on desktop */}
            <div className="lp-hero-card">
              <div style={{
                background: surface,
                border: `1px solid ${border}`,
                borderRadius: 10,
                overflow: 'hidden',
              }}>
                {/* Join section */}
                <div style={{ padding: '1.5rem', borderBottom: `1px solid ${border}`, borderTop: `3px solid ${green}` }}>
                  <p style={{
                    ...bc, fontWeight: 700, fontSize: '0.63rem',
                    letterSpacing: '0.24em', color: greenHi,
                    textTransform: 'uppercase', marginBottom: '0.25rem',
                  }}>
                    Already have an invite?
                  </p>
                  <h2 style={{
                    ...bc, fontWeight: 800, fontSize: '1.25rem',
                    color: text, marginBottom: '1rem', letterSpacing: '0.02em',
                  }}>
                    Join a Pool
                  </h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                    <input
                      placeholder="Search by pool name"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      style={{
                        background: bg,
                        border: `1px solid ${border}`,
                        color: text,
                        borderRadius: 6,
                        padding: '0.5rem 0.75rem',
                        width: '100%',
                        boxSizing: 'border-box',
                        ...b, fontSize: '0.88rem',
                      }}
                    />
                    <button
                      onClick={handleSearch}
                      disabled={!searchTerm.trim()}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                        padding: '0.6rem 1rem',
                        background: searchTerm.trim() ? green : 'oklch(22% 0.03 255)',
                        color: text, border: 'none', borderRadius: 6,
                        ...bc, fontWeight: 700, fontSize: '0.82rem',
                        letterSpacing: '0.1em', textTransform: 'uppercase',
                        cursor: searchTerm.trim() ? 'pointer' : 'not-allowed',
                        transition: 'background 0.15s',
                      }}
                    >
                      <Search className="h-4 w-4" />
                      Find Pool
                    </button>
                  </div>
                </div>

                {/* Create section */}
                <div style={{ padding: '1.5rem', borderTop: `3px solid ${gold}` }}>
                  <p style={{
                    ...bc, fontWeight: 700, fontSize: '0.63rem',
                    letterSpacing: '0.24em', color: gold,
                    textTransform: 'uppercase', marginBottom: '0.25rem',
                  }}>
                    Want to run one?
                  </p>
                  <h2 style={{
                    ...bc, fontWeight: 800, fontSize: '1.25rem',
                    color: text, marginBottom: '0.4rem', letterSpacing: '0.02em',
                  }}>
                    Start a Pool
                  </h2>
                  <p style={{ ...b, fontSize: '0.82rem', color: textMid, marginBottom: '1rem', lineHeight: 1.55 }}>
                    Set up your own confidence pool in minutes. Invite players, manage picks, and run your season.
                  </p>
                  <button
                    onClick={() => router.push('/register')}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                      width: '100%', padding: '0.6rem 1rem',
                      background: 'oklch(74% 0.16 72 / 0.15)',
                      color: gold,
                      border: `1px solid oklch(74% 0.16 72 / 0.4)`,
                      borderRadius: 6,
                      ...bc, fontWeight: 700, fontSize: '0.82rem',
                      letterSpacing: '0.1em', textTransform: 'uppercase',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Create a Pool — Free
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── green rule ── */}
      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${green}, transparent)` }} />

      {/* ── FEATURES ── */}
      <section style={{ background: surface, padding: '3rem 0' }}>
        <div className="lp-inner">
          {/* .lp-features: 1-col mobile, 3-col 640px+ */}
          <div className="lp-features">
            {features.map(({ icon: Icon, label, body: desc, accent }) => (
              <div key={label} style={{
                background: card,
                border: `1px solid ${border}`,
                borderLeft: `3px solid ${accent}`,
                borderRadius: 8,
                padding: '1.25rem 1.5rem',
              }}>
                <Icon className="h-5 w-5 mb-3" style={{ color: accent }} />
                <h3 style={{
                  ...bc, fontWeight: 700, fontSize: '0.92rem',
                  letterSpacing: '0.07em', color: text,
                  textTransform: 'uppercase', marginBottom: '0.4rem',
                }}>
                  {label}
                </h3>
                <p style={{ ...b, fontSize: '0.875rem', lineHeight: 1.65, color: textMid }}>
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── GAMES TICKER ── */}
      <section style={{ background: bg, padding: '3.5rem 0' }}>
        <div className="lp-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <span style={{ display: 'block', width: 3, height: 24, background: green, borderRadius: 2, flexShrink: 0 }} />
            <h3 style={{
              ...bc, fontWeight: 800, fontSize: '1.25rem',
              letterSpacing: '0.06em', color: text, textTransform: 'uppercase',
            }}>
              {getDisplayTitle()}
            </h3>
          </div>

          <div style={{
            background: surface,
            border: `1px solid ${border}`,
            borderRadius: 10,
            overflow: 'hidden',
          }}>
            {isLoadingGames ? (
              <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse" style={{ height: 44, background: card, borderRadius: 6 }} />
                ))}
              </div>
            ) : validGames.length > 0 ? (
              <div>
                {/* .lp-sb-header: hidden on mobile, flex on 640px+ */}
                <div
                  className="lp-sb-header"
                  style={{ background: card, borderBottom: `1px solid ${border}` }}
                >
                  <div className="lp-game-status">
                    <span style={{ ...bc, fontWeight: 700, fontSize: '0.6rem', letterSpacing: '0.2em', color: textDim, textTransform: 'uppercase' }}>Status</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ ...bc, fontWeight: 700, fontSize: '0.6rem', letterSpacing: '0.2em', color: textDim, textTransform: 'uppercase' }}>Game</span>
                  </div>
                  <div className="lp-game-score">
                    <span style={{ ...bc, fontWeight: 700, fontSize: '0.6rem', letterSpacing: '0.2em', color: textDim, textTransform: 'uppercase' }}>Score</span>
                  </div>
                </div>

                {validGames.map((game, idx) => (
                  <div
                    key={game.id}
                    className="lp-game-row"
                    style={{ borderBottom: idx < validGames.length - 1 ? `1px solid ${border}` : 'none' }}
                  >
                    {/* Status */}
                    <div className="lp-game-status">
                      {game.status === 'live' ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                          ...bc, fontWeight: 700, fontSize: '0.68rem',
                          letterSpacing: '0.13em', color: liveRed, textTransform: 'uppercase',
                        }}>
                          <span className="animate-pulse" style={{
                            width: 5, height: 5, borderRadius: '50%',
                            background: liveRed, display: 'inline-block', flexShrink: 0,
                          }} />
                          Live
                        </span>
                      ) : game.status === 'final' ? (
                        <span style={{
                          ...bc, fontWeight: 700, fontSize: '0.68rem',
                          letterSpacing: '0.13em', color: greenHi, textTransform: 'uppercase',
                        }}>
                          Final
                        </span>
                      ) : (
                        <span style={{ ...b, fontSize: '0.75rem', color: textDim }}>
                          {getGameStatus(game)}
                        </span>
                      )}
                    </div>

                    {/* Matchup */}
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '0.35rem', overflow: 'hidden' }}>
                      <span
                        title={game.away_team}
                        style={{
                          ...bc, fontWeight: 700, fontSize: '0.93rem',
                          letterSpacing: '0.03em', color: text, textTransform: 'uppercase',
                          whiteSpace: 'nowrap', flexShrink: 0,
                        }}
                      >
                        {game.away_team_id || game.away_team}
                      </span>
                      <span style={{ ...b, fontSize: '0.75rem', color: textDim, flexShrink: 0 }}>@</span>
                      <span
                        title={game.home_team}
                        style={{
                          ...bc, fontWeight: 700, fontSize: '0.93rem',
                          letterSpacing: '0.03em', color: text, textTransform: 'uppercase',
                          whiteSpace: 'nowrap', flexShrink: 0,
                        }}
                      >
                        {game.home_team_id || game.home_team}
                      </span>
                    </div>

                    {/* Score */}
                    <div className="lp-game-score">
                      {getGameScore(game) && (
                        <span style={{
                          ...bc, fontWeight: 800, fontSize: '0.93rem',
                          color: text, fontVariantNumeric: 'tabular-nums',
                        }}>
                          {getGameScore(game)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : currentSeasonType === 0 || games.length === 0 ? (
              <OffseasonBanner />
            ) : (
              <div style={{ padding: '3rem', textAlign: 'center' }}>
                <p style={{ ...b, color: textDim, fontSize: '0.9rem' }}>
                  No games scheduled for this week
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ background: surface, padding: '4rem 0' }}>
        <div className="lp-inner">
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <p style={{
              ...bc, fontWeight: 700, fontSize: '0.67rem',
              letterSpacing: '0.26em', color: greenHi,
              textTransform: 'uppercase', marginBottom: '0.5rem',
            }}>
              Get Started
            </p>
            <h3 style={{
              ...bc, fontWeight: 900,
              fontSize: 'clamp(1.6rem, 4vw, 2.25rem)',
              letterSpacing: '0.03em', color: text, textTransform: 'uppercase',
            }}>
              How It Works
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>

            {/* Commissioner track */}
            <div style={{ background: card, border: `1px solid ${border}`, borderTop: `3px solid ${gold}`, borderRadius: 10, padding: '1.75rem' }}>
              <p style={{ ...bc, fontWeight: 700, fontSize: '0.63rem', letterSpacing: '0.22em', color: gold, textTransform: 'uppercase', marginBottom: '0.3rem' }}>Commissioner</p>
              <h4 style={{ ...bc, fontWeight: 800, fontSize: '1.05rem', color: text, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1.5rem' }}>
                Running a Pool
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {commissionerSteps.map(({ n, title, body: desc }) => (
                  <div key={n} style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ ...bc, fontWeight: 900, fontSize: '1.5rem', lineHeight: 1, color: gold, opacity: 0.5, letterSpacing: '-0.02em', flexShrink: 0, width: 32 }}>{n}</div>
                    <div>
                      <h5 style={{ ...bc, fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase', marginBottom: '0.2rem' }}>{title}</h5>
                      <p style={{ ...b, fontSize: '0.82rem', lineHeight: 1.6, color: textMid }}>{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => router.push('/register')}
                style={{
                  marginTop: '1.5rem', width: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                  padding: '0.55rem 1rem',
                  background: 'oklch(74% 0.16 72 / 0.12)', color: gold,
                  border: `1px solid oklch(74% 0.16 72 / 0.35)`, borderRadius: 6,
                  ...bc, fontWeight: 700, fontSize: '0.78rem',
                  letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer',
                }}
              >
                <Plus className="h-3.5 w-3.5" /> Create a Pool
              </button>
            </div>

            {/* Player track */}
            <div style={{ background: card, border: `1px solid ${border}`, borderTop: `3px solid ${green}`, borderRadius: 10, padding: '1.75rem' }}>
              <p style={{ ...bc, fontWeight: 700, fontSize: '0.63rem', letterSpacing: '0.22em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.3rem' }}>Player</p>
              <h4 style={{ ...bc, fontWeight: 800, fontSize: '1.05rem', color: text, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1.5rem' }}>
                Joining a Pool
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {playerSteps.map(({ n, title, body: desc }) => (
                  <div key={n} style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ ...bc, fontWeight: 900, fontSize: '1.5rem', lineHeight: 1, color: greenHi, opacity: 0.5, letterSpacing: '-0.02em', flexShrink: 0, width: 32 }}>{n}</div>
                    <div>
                      <h5 style={{ ...bc, fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase', marginBottom: '0.2rem' }}>{title}</h5>
                      <p style={{ ...b, fontSize: '0.82rem', lineHeight: 1.6, color: textMid }}>{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={handleSearch}
                style={{
                  marginTop: '1.5rem', width: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                  padding: '0.55rem 1rem',
                  background: 'oklch(46% 0.14 155 / 0.12)', color: greenHi,
                  border: `1px solid oklch(46% 0.14 155 / 0.35)`, borderRadius: 6,
                  ...bc, fontWeight: 700, fontSize: '0.78rem',
                  letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer',
                }}
              >
                <Search className="h-3.5 w-3.5" /> Find a Pool
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}

      <Footer />
    </div>
  );
}

export default function HomePage() {
  return (
    <AuthProvider>
      <LandingPage />
    </AuthProvider>
  );
}
