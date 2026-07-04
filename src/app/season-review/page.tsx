'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft,
  Trophy,
  Target,
  TrendingUp,
  Calendar,
  Crown,
  Star,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { AuthProvider } from '@/lib/auth';
import { getWeekPeriod, getWeekPeriodColor, debugError} from '@/lib/utils';
import { Footer } from '@/components/layout/Footer';

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

interface Pool {
  id: string;
  name: string;
  season: number;
  created_at: string;
  is_active: boolean;
}

interface WeeklyWinner {
  id: string;
  pool_id: string;
  week: number;
  season: number;
  winner_participant_id: string;
  winner_name: string;
  winner_points: number;
  winner_correct_picks: number;
  tie_breaker_used: boolean;
  tie_breaker_question: string | null;
  tie_breaker_answer: number | null;
  winner_tie_breaker_answer: number | null;
  tie_breaker_difference: number | null;
  total_participants: number;
  created_at: string;
}

interface SeasonWinner {
  id: string;
  pool_id: string;
  season: number;
  winner_participant_id: string;
  winner_name: string;
  total_points: number;
  total_correct_picks: number;
  weeks_won: number;
  tie_breaker_used: boolean;
  total_participants: number;
}

function SeasonReviewContent() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [pools, setPools] = useState<Pool[]>([]);
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  const [weeklyWinners, setWeeklyWinners] = useState<WeeklyWinner[]>([]);
  const [seasonWinner, setSeasonWinner] = useState<SeasonWinner | null>(null);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        if (user) {
          await loadPools();
        }
      } catch (error) {
        debugError('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user]);

  const loadPools = async () => {
    try {
      const response = await fetch('/api/test-pools');
      const result = await response.json();

      if (result.success) {
        setPools(result.data.activePools || []);
      }
    } catch (error) {
      debugError('Error loading pools:', error);
    }
  };

  const loadPoolData = async (pool: Pool) => {
    setLoadingData(true);
    try {
      const weeklyResponse = await fetch(`/api/admin/winners/weekly?poolId=${pool.id}&season=${pool.season}`);
      const weeklyResult = await weeklyResponse.json();

      const seasonResponse = await fetch(`/api/admin/winners/season?poolId=${pool.id}&season=${pool.season}`);
      const seasonResult = await seasonResponse.json();

      if (weeklyResult.success) {
        setWeeklyWinners(weeklyResult.weeklyWinners || []);
      }

      if (seasonResult.success) {
        setSeasonWinner(seasonResult.seasonWinner);
      }
    } catch (error) {
      debugError('Error loading pool data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const handlePoolChange = (poolId: string) => {
    const pool = pools.find(p => p.id === poolId);
    if (pool) {
      setSelectedPool(pool);
      loadPoolData(pool);
    }
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw style={{ width: 32, height: 32, color: textDim, margin: '0 auto 0.75rem', animation: 'spin 1s linear infinite' }} />
          <p style={{ ...b, color: textMid, fontSize: '0.9rem' }}>Loading season data…</p>
        </div>
      </div>
    );
  }

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
              <button
                onClick={() => router.push('/pools')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  padding: '0.35rem 0.6rem',
                  background: 'transparent', color: textMid,
                  border: `1px solid ${border}`, borderRadius: 5,
                  ...bc, fontWeight: 600, fontSize: '0.72rem',
                  letterSpacing: '0.07em', textTransform: 'uppercase',
                  cursor: 'pointer', flexShrink: 0,
                }}
              >
                <ArrowLeft style={{ width: 12, height: 12 }} /> <span className="pools-nav-label">Back</span>
              </button>
              <span style={{ ...bc, fontWeight: 800, fontSize: '0.92rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                Sunday Huddle
              </span>
            </div>
            <button
              onClick={() => signOut()}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.35rem',
                padding: '0.35rem 0.7rem',
                background: 'transparent', color: textMid,
                border: `1px solid ${border}`, borderRadius: 5,
                ...bc, fontWeight: 600, fontSize: '0.72rem',
                letterSpacing: '0.07em', textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              <LogOut style={{ width: 11, height: 11 }} /> <span className="pools-nav-label">Sign Out</span>
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{
        background: bg,
        backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 59px, oklch(100% 0 0 / 0.022) 59px, oklch(100% 0 0 / 0.022) 60px)`,
        padding: 'clamp(2rem, 4vw, 3rem) 0',
      }}>
        <div className="lp-inner">
          <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.26em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ display: 'inline-block', width: 18, height: 2, background: greenHi, borderRadius: 1 }} />
            Season History
          </p>
          <h1 style={{ ...bc, fontWeight: 900, fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', lineHeight: 0.95, color: text, textTransform: 'uppercase', marginBottom: '0.6rem' }}>
            Season <span style={{ color: gold }}>Review</span>
          </h1>
          <p style={{ ...b, fontSize: '0.9rem', color: textMid, marginTop: '0.75rem' }}>
            Review each pool&apos;s performance week by week
          </p>
        </div>
      </section>

      {/* ── green rule ── */}
      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${green}, transparent)` }} />

      {/* ── CONTENT ── */}
      <section style={{ background: bg, padding: '2.5rem 0', minHeight: '50vh' }}>
        <div className="lp-inner">

          {/* Pool Selection Card */}
          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
              <Target style={{ width: 16, height: 16, color: greenHi }} />
              <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase' }}>
                Select Pool to Review
              </p>
            </div>
            <p style={{ ...b, fontSize: '0.8rem', color: textDim, marginBottom: '1rem' }}>
              Choose a pool to view season winners and statistics
            </p>
            <Select onValueChange={handlePoolChange}>
              <SelectTrigger style={{ background: surface, border: `1px solid ${border}`, color: text, ...b }}>
                <SelectValue placeholder="Select a pool to review..." />
              </SelectTrigger>
              <SelectContent>
                {pools.map((pool) => (
                  <SelectItem key={pool.id} value={pool.id}>
                    <span>{pool.name}</span>
                    <span style={{ ...bc, fontSize: '0.72rem', color: textDim, marginLeft: '0.5rem' }}>{pool.season}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Selected Pool Content */}
          {selectedPool && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* Pool Header Card */}
              <div style={{ background: card, border: `1px solid ${border}`, borderTop: `3px solid ${green}`, borderRadius: 10, padding: '1.25rem 1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <p style={{ ...bc, fontWeight: 900, fontSize: '1.2rem', color: text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {selectedPool.name}
                    </p>
                    <p style={{ ...b, fontSize: '0.8rem', color: textMid, marginTop: '0.2rem' }}>
                      {selectedPool.season} Season Review
                    </p>
                  </div>
                  <span style={{
                    ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.08em',
                    padding: '0.25rem 0.65rem', borderRadius: 4, textTransform: 'uppercase',
                    background: 'oklch(26% 0.03 255)', color: textMid, border: `1px solid ${border}`,
                  }}>{selectedPool.season}</span>
                </div>
              </div>

              {loadingData ? (
                <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                  <RefreshCw style={{ width: 28, height: 28, color: textDim, margin: '0 auto 0.75rem', animation: 'spin 1s linear infinite' }} />
                  <p style={{ ...b, color: textMid, fontSize: '0.875rem' }}>Loading pool data…</p>
                </div>
              ) : (
                <>
                  {/* Season Champion */}
                  {seasonWinner && (
                    <div style={{ background: card, border: `1px solid oklch(74% 0.16 72 / 0.35)`, borderTop: `3px solid ${gold}`, borderRadius: 10, padding: '1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                        <Trophy style={{ width: 18, height: 18, color: gold }} />
                        <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.08em', color: gold, textTransform: 'uppercase' }}>
                          Season Champion
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                        <div>
                          <p style={{ ...bc, fontWeight: 900, fontSize: '1.6rem', color: text, lineHeight: 1.1 }}>{seasonWinner.winner_name}</p>
                          <p style={{ ...b, fontSize: '0.8rem', color: textMid, marginTop: '0.25rem' }}>Season {seasonWinner.season} Champion</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ ...bc, fontWeight: 900, fontSize: '2.5rem', color: gold, lineHeight: 1 }}>{seasonWinner.total_points}</p>
                          <p style={{ ...b, fontSize: '0.75rem', color: textDim }}>Total Points</p>
                        </div>
                      </div>
                      <div className="admin-3col-grid">
                        {[
                          { label: 'Correct Picks', value: seasonWinner.total_correct_picks },
                          { label: 'Weeks Won', value: seasonWinner.weeks_won },
                          { label: 'Participants', value: seasonWinner.total_participants },
                        ].map(({ label, value }) => (
                          <div key={label} style={{ background: surface, border: `1px solid ${border}`, borderRadius: 8, padding: '0.85rem 1rem', textAlign: 'center' }}>
                            <p style={{ ...bc, fontWeight: 900, fontSize: '1.4rem', color: greenHi }}>{value}</p>
                            <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.2rem' }}>{label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Season Overview Stats */}
                  <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                      <TrendingUp style={{ width: 16, height: 16, color: greenHi }} />
                      <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.08em', color: text, textTransform: 'uppercase' }}>
                        Season Overview
                      </p>
                    </div>
                    <div className="admin-stats-grid">
                      {[
                        { label: 'Weeks Completed', value: weeklyWinners.length, color: greenHi },
                        { label: 'Tie Breakers Used', value: weeklyWinners.filter(w => w.tie_breaker_used).length, color: amber },
                        { label: 'Total Participants', value: seasonWinner?.total_participants || 0, color: purple },
                        { label: 'Estimated Games', value: weeklyWinners.length > 0 ? weeklyWinners.length * 16 : 0, color: gold },
                      ].map(({ label, value, color }) => (
                        <div key={label} style={{ background: surface, border: `1px solid ${border}`, borderRadius: 8, padding: '1rem', textAlign: 'center' }}>
                          <p style={{ ...bc, fontWeight: 900, fontSize: '1.75rem', color, lineHeight: 1 }}>{value}</p>
                          <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.3rem' }}>{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Weekly Winners */}
                  <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                      <Calendar style={{ width: 16, height: 16, color: greenHi }} />
                      <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.08em', color: text, textTransform: 'uppercase' }}>
                        Weekly Winners
                      </p>
                    </div>
                    <p style={{ ...b, fontSize: '0.8rem', color: textDim, marginBottom: '1rem' }}>
                      Winners for each week of the {selectedPool.season} season
                    </p>

                    {weeklyWinners.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        {weeklyWinners.map((winner) => (
                          <div
                            key={winner.id}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              flexWrap: 'wrap', gap: '0.75rem',
                              padding: '0.85rem 1rem',
                              background: surface, border: `1px solid ${border}`, borderRadius: 8,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span style={{
                                  ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.08em',
                                  padding: '0.15rem 0.45rem', borderRadius: 4, textTransform: 'uppercase',
                                  background: 'oklch(26% 0.03 255)', color: textMid, border: `1px solid ${border}`,
                                }}>{getWeekPeriod(winner.week)}</span>
                                <span style={{ ...bc, fontWeight: 700, fontSize: '0.82rem', color: textMid }}>Week {winner.week}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <Crown style={{ width: 13, height: 13, color: gold }} />
                                <span style={{ ...b, fontWeight: 600, fontSize: '0.875rem', color: text }}>{winner.winner_name}</span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                <Target style={{ width: 12, height: 12, color: textDim }} />
                                <span style={{ ...b, fontSize: '0.78rem', color: textMid }}>{winner.winner_correct_picks} correct</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                <Star style={{ width: 12, height: 12, color: textDim }} />
                                <span style={{ ...b, fontSize: '0.78rem', color: textMid }}>{winner.winner_points} pts</span>
                              </div>
                              {winner.tie_breaker_used && (
                                <span style={{
                                  ...bc, fontWeight: 700, fontSize: '0.6rem', letterSpacing: '0.07em',
                                  padding: '0.12rem 0.4rem', borderRadius: 4, textTransform: 'uppercase',
                                  background: 'oklch(65% 0.12 290 / 0.15)', color: purple,
                                  border: `1px solid oklch(65% 0.12 290 / 0.35)`,
                                }}>Tie Breaker</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '2.5rem 0' }}>
                        <Trophy style={{ width: 32, height: 32, color: textDim, margin: '0 auto 0.75rem' }} />
                        <p style={{ ...b, fontSize: '0.875rem', color: textDim }}>No weekly winners data available</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Empty states */}
          {!selectedPool && pools.length > 0 && (
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '3rem', textAlign: 'center' }}>
              <Trophy style={{ width: 40, height: 40, color: textDim, margin: '0 auto 0.75rem' }} />
              <p style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Select a Pool</p>
              <p style={{ ...b, fontSize: '0.875rem', color: textDim }}>Choose a pool from the dropdown above to view its season review</p>
            </div>
          )}

          {pools.length === 0 && (
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '3rem', textAlign: 'center' }}>
              <Trophy style={{ width: 40, height: 40, color: textDim, margin: '0 auto 0.75rem' }} />
              <p style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase', marginBottom: '0.4rem' }}>No Pools Available</p>
              <p style={{ ...b, fontSize: '0.875rem', color: textDim }}>There are no active pools to review at this time</p>
            </div>
          )}

        </div>
      </section>

      {/* ── FOOTER ── */}
      <Footer pageName="Season Review" />
    </div>
  );
}

export default function SeasonReviewPage() {
  return (
    <AuthProvider>
      <SeasonReviewContent />
    </AuthProvider>
  );
}
