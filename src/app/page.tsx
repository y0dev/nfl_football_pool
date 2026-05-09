'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Search, Users, Trophy, Calendar, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth, AuthProvider } from '@/lib/auth';
import { loadCurrentWeek } from '@/actions/loadCurrentWeek';
import { createPageUrl, getWeekTitle as getWeekTitleUtil } from '@/lib/utils';
import { Footer } from '@/components/layout/Footer';

interface Game {
  id: string;
  home_team: string;
  away_team: string;
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
          console.error('Error checking admin status:', error);
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
        setCurrentWeek(weekData?.week_number || 1);
        setCurrentSeasonType(weekData?.season_type || 2);

        const { getSupabaseClient } = await import('@/lib/supabase');
        const supabase = getSupabaseClient();

        const { data: gamesData, error } = await supabase
          .from('games')
          .select('*')
          .eq('week', weekData?.week_number || 1)
          .eq('season_type', weekData?.season_type || 2)
          .order('kickoff_time');

        if (error) {
          console.error('Error loading games:', error);
        } else {
          setGames(gamesData || []);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoadingGames(false);
      }
    };
    loadData();
  }, []);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    try {
      const { getSupabaseClient } = await import('@/lib/supabase');
      const supabase = getSupabaseClient();
      const { data: pools, error } = await supabase
        .from('pools')
        .select('id, name, created_by')
        .or(`name.ilike.%${searchTerm}%,created_by.ilike.%${searchTerm}%`)
        .eq('is_active', true)
        .limit(1);

      if (error) { console.error('Error searching pools:', error); return; }
      if (pools && pools.length > 0) {
        router.push(createPageUrl(`poolpicks?poolId=${pools[0].id}`));
      } else {
        console.log('No pools found');
      }
    } catch (error) {
      console.error('Error searching for pool:', error);
    }
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
    return `${game.away_score} – ${game.home_score}`;
  };

  const getWeekTitle = () => getWeekTitleUtil(currentWeek, currentSeasonType);

  const features = [
    { icon: Trophy,   label: 'Weekly Competition', body: 'Compete weekly with friends and family in confidence pools',        accent: gold },
    { icon: Users,    label: 'Social Experience',   body: 'Join pools, invite friends, and track your performance all season', accent: greenHi },
    { icon: Calendar, label: 'Season Long',          body: 'Follow your progress through every week of the NFL season',         accent: gold },
  ];

  const steps = [
    { n: '01', title: 'Join a Pool',  body: 'Find and join a confidence pool with friends or family' },
    { n: '02', title: 'Make Picks',   body: 'Pick the winner of each game and assign confidence points' },
    { n: '03', title: 'Watch Games',  body: 'Follow the games and see how your picks perform' },
    { n: '04', title: 'Win Points',   body: 'Earn points for correct picks based on your confidence level' },
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: green, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Trophy className="h-4 w-4" style={{ color: text }} />
              </div>
              <span style={{
                ...bc, fontWeight: 800, fontSize: '0.95rem',
                letterSpacing: '0.07em', color: text, textTransform: 'uppercase',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                NFL Confidence Pool
              </span>
            </div>

            <div style={{ flexShrink: 0 }}>
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
                <button
                  onClick={() => router.push('/admin/login')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.45rem 0.9rem',
                    background: 'transparent', color: text,
                    border: `1px solid ${border}`, borderRadius: 6,
                    ...bc, fontWeight: 700, fontSize: '0.78rem',
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  <Shield className="h-3.5 w-3.5" />
                  Commissioner Login
                </button>
              )}
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
                Weekly NFL Confidence Pool
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
                borderTop: `3px solid ${green}`,
                borderRadius: 10,
                padding: '1.75rem',
              }}>
                <p style={{
                  ...bc, fontWeight: 700, fontSize: '0.63rem',
                  letterSpacing: '0.24em', color: greenHi,
                  textTransform: 'uppercase', marginBottom: '0.3rem',
                }}>
                  Find Your Pool
                </p>
                <h2 style={{
                  ...bc, fontWeight: 800, fontSize: '1.4rem',
                  color: text, marginBottom: '1.25rem', letterSpacing: '0.02em',
                }}>
                  Join The Game
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <Input
                    placeholder="Pool Name"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    style={{
                      background: bg,
                      border: `1px solid ${border}`,
                      color: text,
                      ...b, fontSize: '0.88rem',
                    }}
                  />
                  <button
                    onClick={handleSearch}
                    disabled={!searchTerm.trim()}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                      padding: '0.65rem 1rem',
                      background: searchTerm.trim() ? green : 'oklch(22% 0.03 255)',
                      color: text, border: 'none', borderRadius: 6,
                      ...bc, fontWeight: 700, fontSize: '0.84rem',
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
              {getWeekTitle()} Games
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
            ) : games.length > 0 ? (
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
                    <span style={{ ...bc, fontWeight: 700, fontSize: '0.6rem', letterSpacing: '0.2em', color: textDim, textTransform: 'uppercase' }}>Matchup</span>
                  </div>
                  <div className="lp-game-score">
                    <span style={{ ...bc, fontWeight: 700, fontSize: '0.6rem', letterSpacing: '0.2em', color: textDim, textTransform: 'uppercase' }}>Score</span>
                  </div>
                </div>

                {games.map((game, idx) => (
                  <div
                    key={game.id}
                    className="lp-game-row"
                    style={{ borderBottom: idx < games.length - 1 ? `1px solid ${border}` : 'none' }}
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
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{
                        ...bc, fontWeight: 700, fontSize: '0.93rem',
                        letterSpacing: '0.03em', color: text, textTransform: 'uppercase',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {game.away_team}
                      </span>
                      <span style={{ ...b, fontSize: '0.75rem', color: textDim, flexShrink: 0 }}>@</span>
                      <span style={{
                        ...bc, fontWeight: 700, fontSize: '0.93rem',
                        letterSpacing: '0.03em', color: text, textTransform: 'uppercase',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {game.home_team}
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

          {/* .lp-steps: 2-col mobile, 4-col 768px+ */}
          <div className="lp-steps">
            {steps.map(({ n, title, body: desc }) => (
              <div key={n}>
                <div style={{
                  ...bc, fontWeight: 900, fontSize: '3rem',
                  lineHeight: 1, color: gold, opacity: 0.6,
                  marginBottom: '0.6rem', letterSpacing: '-0.02em',
                }}>
                  {n}
                </div>
                <h4 style={{
                  ...bc, fontWeight: 700, fontSize: '0.9rem',
                  letterSpacing: '0.07em', color: text,
                  textTransform: 'uppercase', marginBottom: '0.35rem',
                }}>
                  {title}
                </h4>
                <p style={{ ...b, fontSize: '0.85rem', lineHeight: 1.65, color: textMid }}>
                  {desc}
                </p>
              </div>
            ))}
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
