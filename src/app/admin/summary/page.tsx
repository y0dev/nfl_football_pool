'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Trophy,
  Users,
  BarChart3,
  RefreshCw,
  Printer
} from 'lucide-react';
import { Footer } from '@/components/layout/Footer';
import { debugError } from '@/lib/utils';

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
const liveRed = 'oklch(62% 0.22 25)';

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

interface SummaryResult {
  poolId: string;
  poolName: string;
  period: string;
  winner: string | null;
  points?: number;
  correctPicks?: number;
  weeksWon?: number;
  tieBreakerUsed?: boolean;
  tieBreakerAnswer?: number;
  tieBreakerDifference?: number;
  totalParticipants?: number;
  status: 'generated' | 'no_winner' | 'error';
  reason?: string;
}

interface SummaryData {
  operation: string;
  timestamp: string;
  poolsProcessed: number;
  poolsWithWinners: number;
  generatedWinners: number;
  noWinners: number;
  errors: number;
  results: SummaryResult[];
}

function AdminSummaryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSummaryData = async () => {
      try {
        setIsLoading(true);
        const dataParam = searchParams.get('data');
        let data: SummaryData;

        if (dataParam) {
          data = JSON.parse(decodeURIComponent(dataParam));
        } else {
          const storedData = localStorage.getItem('adminSummaryData');
          if (storedData) {
            data = JSON.parse(storedData);
          } else {
            throw new Error('No summary data available');
          }
        }
        setSummaryData(data);
      } catch (err) {
        debugError('Error loading summary data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load summary data');
      } finally {
        setIsLoading(false);
      }
    };
    loadSummaryData();
  }, [searchParams]);

  const groupResultsByPool = (results: SummaryResult[]) => {
    return results.reduce((acc, item) => {
      if (!acc[item.poolName]) acc[item.poolName] = [];
      acc[item.poolName].push(item);
      return acc;
    }, {} as Record<string, SummaryResult[]>);
  };

  const statusColor = (status: string) => {
    if (status === 'generated') return greenHi;
    if (status === 'no_winner') return amber;
    return liveRed;
  };

  const statusBg = (status: string) => {
    if (status === 'generated') return 'oklch(46% 0.14 155 / 0.12)';
    if (status === 'no_winner') return 'oklch(72% 0.16 60 / 0.12)';
    return 'oklch(62% 0.22 25 / 0.12)';
  };

  const statusBorder = (status: string) => {
    if (status === 'generated') return 'oklch(46% 0.14 155 / 0.35)';
    if (status === 'no_winner') return 'oklch(72% 0.16 60 / 0.35)';
    return 'oklch(62% 0.22 25 / 0.35)';
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw style={{ width: 32, height: 32, color: textDim, margin: '0 auto 0.75rem', animation: 'spin 1s linear infinite' }} />
          <p style={{ ...b, color: textMid, fontSize: '0.9rem' }}>Loading summary…</p>
        </div>
      </div>
    );
  }

  if (error || !summaryData) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
        <div style={{ background: card, border: `1px solid ${border}`, borderTop: `3px solid ${liveRed}`, borderRadius: 10, padding: '2rem', maxWidth: 400, width: '100%', textAlign: 'center' }}>
          <XCircle style={{ width: 40, height: 40, color: liveRed, margin: '0 auto 0.75rem' }} />
          <h2 style={{ ...bc, fontWeight: 800, fontSize: '1.1rem', color: text, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Error</h2>
          <p style={{ ...b, fontSize: '0.875rem', color: textMid, marginBottom: '1.25rem' }}>{error || 'No summary data available'}</p>
          <button
            onClick={() => router.back()}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
              width: '100%', padding: '0.6rem 1rem',
              background: surface, color: textMid,
              border: `1px solid ${border}`, borderRadius: 6,
              ...bc, fontWeight: 700, fontSize: '0.8rem',
              letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer',
            }}
          >
            <ArrowLeft style={{ width: 13, height: 13 }} />
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const poolResults = groupResultsByPool(summaryData.results);

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
                onClick={() => router.back()}
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
                <ArrowLeft style={{ width: 12, height: 12 }} />
                <span className="pools-nav-label">Back</span>
              </button>
              <div style={{ width: 1, height: 20, background: border, flexShrink: 0 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: green, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <BarChart3 style={{ width: 14, height: 14, color: text }} />
                </div>
                <span style={{ ...bc, fontWeight: 800, fontSize: '0.92rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  Operation Summary
                </span>
              </div>
            </div>
            <button
              onClick={() => window.print()}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.35rem',
                padding: '0.35rem 0.7rem',
                background: 'transparent', color: textMid,
                border: `1px solid ${border}`, borderRadius: 5,
                ...bc, fontWeight: 600, fontSize: '0.72rem',
                letterSpacing: '0.07em', textTransform: 'uppercase',
                cursor: 'pointer', flexShrink: 0,
              }}
            >
              <Printer style={{ width: 11, height: 11 }} />
              <span className="pools-nav-label">Print</span>
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{
        background: bg,
        backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 59px, oklch(100% 0 0 / 0.022) 59px, oklch(100% 0 0 / 0.022) 60px)`,
        padding: 'clamp(2.5rem, 5vw, 4rem) 0',
      }}>
        <div className="lp-inner">
          <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.26em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ display: 'inline-block', width: 18, height: 2, background: greenHi, borderRadius: 1 }} />
            {new Date(summaryData.timestamp).toLocaleString()}
          </p>
          <h1 style={{ ...bc, fontWeight: 900, fontSize: 'clamp(2rem, 5vw, 3rem)', lineHeight: 0.95, color: text, textTransform: 'uppercase', marginBottom: '0.75rem' }}>
            {summaryData.operation.split(' ').slice(0, -1).join(' ') || summaryData.operation}<br />
            <span style={{ color: gold }}>{summaryData.operation.split(' ').slice(-1)[0]}</span>
          </h1>
          <p style={{ ...b, fontSize: '0.9rem', color: textMid, maxWidth: '44ch' }}>
            Complete breakdown of all processed pools and periods.
          </p>
        </div>
      </section>

      {/* ── green rule ── */}
      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${green}, transparent)` }} />

      {/* ── STATS ── */}
      <section style={{ background: surface, padding: '2.5rem 0' }}>
        <div className="lp-inner">
          <div className="admin-week-grid">
            {[
              { label: 'Pools Processed', value: summaryData.poolsProcessed, icon: Users, color: textMid },
              { label: 'Pools w/ Winners', value: summaryData.poolsWithWinners, icon: Trophy, color: greenHi },
              { label: 'Winners Generated', value: summaryData.generatedWinners, icon: CheckCircle, color: greenHi },
              { label: 'No Winners', value: summaryData.noWinners, icon: AlertTriangle, color: amber },
              { label: 'Errors', value: summaryData.errors, icon: XCircle, color: liveRed },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} style={{
                background: card, border: `1px solid ${border}`,
                borderRadius: 8, padding: '1.25rem', textAlign: 'center' as const,
              }}>
                <Icon style={{ width: 20, height: 20, color, margin: '0 auto 0.5rem' }} />
                <div style={{ ...bc, fontWeight: 900, fontSize: '1.75rem', color, lineHeight: 1 }}>{value}</div>
                <div style={{ ...bc, fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase' as const, marginTop: '0.25rem' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── RESULTS ── */}
      <section style={{ background: bg, padding: '2.5rem 0' }}>
        <div className="lp-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <BarChart3 style={{ width: 16, height: 16, color: greenHi }} />
            <h2 style={{ ...bc, fontWeight: 700, fontSize: '0.88rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase' }}>
              Detailed Results
            </h2>
          </div>

          {Object.keys(poolResults).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', background: card, border: `1px solid ${border}`, borderRadius: 8 }}>
              <AlertTriangle style={{ width: 40, height: 40, color: textDim, margin: '0 auto 0.75rem' }} />
              <p style={{ ...b, fontSize: '0.875rem', color: textMid }}>No results to display</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {Object.entries(poolResults).map(([poolName, periods]) => {
                const generatedPeriods = periods.filter(p => p.status === 'generated');
                const noWinnerPeriods  = periods.filter(p => p.status === 'no_winner');
                const errorPeriods     = periods.filter(p => p.status === 'error');

                return (
                  <div key={poolName} style={{
                    background: card, border: `1px solid ${border}`,
                    borderLeft: `3px solid ${green}`, borderRadius: 8, overflow: 'hidden',
                  }}>
                    {/* Pool Header */}
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0.85rem 1.25rem', background: surface, borderBottom: `1px solid ${border}`,
                      flexWrap: 'wrap', gap: '0.5rem',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Trophy style={{ width: 15, height: 15, color: gold }} />
                        <span style={{ ...bc, fontWeight: 800, fontSize: '0.92rem', letterSpacing: '0.06em', color: text, textTransform: 'uppercase' }}>
                          {poolName}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {generatedPeriods.length > 0 && (
                          <span style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.07em', padding: '0.12rem 0.45rem', borderRadius: 4, background: 'oklch(46% 0.14 155 / 0.25)', color: greenHi, textTransform: 'uppercase' }}>
                            {generatedPeriods.length} Winners
                          </span>
                        )}
                        {noWinnerPeriods.length > 0 && (
                          <span style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.07em', padding: '0.12rem 0.45rem', borderRadius: 4, background: 'oklch(72% 0.16 60 / 0.2)', color: amber, textTransform: 'uppercase' }}>
                            {noWinnerPeriods.length} No Winner
                          </span>
                        )}
                        {errorPeriods.length > 0 && (
                          <span style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.07em', padding: '0.12rem 0.45rem', borderRadius: 4, background: 'oklch(62% 0.22 25 / 0.2)', color: liveRed, textTransform: 'uppercase' }}>
                            {errorPeriods.length} Error
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Period Rows */}
                    <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {periods.map((period, index) => (
                        <div key={index} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '0.75rem 1rem',
                          background: statusBg(period.status),
                          border: `1px solid ${statusBorder(period.status)}`,
                          borderRadius: 6, flexWrap: 'wrap', gap: '0.5rem',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', flex: 1 }}>
                            {period.status === 'generated'
                              ? <CheckCircle style={{ width: 15, height: 15, color: greenHi, flexShrink: 0, marginTop: 2 }} />
                              : period.status === 'no_winner'
                              ? <AlertTriangle style={{ width: 15, height: 15, color: amber, flexShrink: 0, marginTop: 2 }} />
                              : <XCircle style={{ width: 15, height: 15, color: liveRed, flexShrink: 0, marginTop: 2 }} />
                            }
                            <div>
                              <p style={{ ...b, fontWeight: 600, fontSize: '0.875rem', color: text }}>
                                {period.period}{period.winner ? `: ${period.winner}` : period.status === 'no_winner' ? ': No winner' : ': Error'}
                              </p>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.2rem' }}>
                                {period.points !== undefined && (
                                  <span style={{ ...b, fontSize: '0.75rem', color: textMid }}>{period.points} pts</span>
                                )}
                                {period.correctPicks !== undefined && period.totalParticipants !== undefined && (
                                  <span style={{ ...b, fontSize: '0.75rem', color: textMid }}>{period.correctPicks}/{period.totalParticipants} picks</span>
                                )}
                                {period.weeksWon !== undefined && (
                                  <span style={{ ...b, fontSize: '0.75rem', color: textMid }}>{period.weeksWon} weeks won</span>
                                )}
                                {period.tieBreakerUsed && (
                                  <span style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.07em', padding: '0.1rem 0.35rem', borderRadius: 4, background: 'oklch(65% 0.12 290 / 0.2)', color: 'oklch(65% 0.12 290)', textTransform: 'uppercase' }}>
                                    Tie-breaker used
                                  </span>
                                )}
                                {period.reason && (
                                  <span style={{ ...b, fontSize: '0.75rem', color: textDim }}>{period.reason}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <span style={{
                            ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.07em',
                            padding: '0.12rem 0.45rem', borderRadius: 4, textTransform: 'uppercase',
                            background: statusBg(period.status), color: statusColor(period.status),
                            border: `1px solid ${statusBorder(period.status)}`,
                          }}>
                            {period.status === 'generated' ? 'Success' : period.status === 'no_winner' ? 'No Winner' : 'Error'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginTop: '2rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => router.back()}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.55rem 1.1rem',
                background: 'transparent', color: textMid,
                border: `1px solid ${border}`, borderRadius: 6,
                ...bc, fontWeight: 700, fontSize: '0.8rem',
                letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer',
              }}
            >
              <ArrowLeft style={{ width: 13, height: 13 }} />
              Back to Dashboard
            </button>
            <button
              onClick={() => window.print()}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.55rem 1.1rem',
                background: green, color: text,
                border: 'none', borderRadius: 6,
                ...bc, fontWeight: 700, fontSize: '0.8rem',
                letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer',
              }}
            >
              <Printer style={{ width: 13, height: 13 }} />
              Print Summary
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <Footer pageName="Commissioner HQ" />
    </div>
  );
}

export default function AdminSummaryPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'oklch(13% 0.025 255)' }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw style={{ width: 32, height: 32, color: 'oklch(50% 0.018 255)', margin: '0 auto 0.75rem', animation: 'spin 1s linear infinite' }} />
          <p style={{ fontFamily: 'var(--font-barlow)', color: 'oklch(72% 0.015 255)', fontSize: '0.9rem' }}>Loading summary…</p>
        </div>
      </div>
    }>
      <AdminSummaryContent />
    </Suspense>
  );
}
