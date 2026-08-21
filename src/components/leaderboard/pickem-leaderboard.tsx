'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Trophy } from 'lucide-react';
import { Footer } from '@/components/layout/Footer';
import { AppNav } from '@/components/layout/AppNav';
import { debugError } from '@/lib/utils';
import type { PickemSeasonSummary } from '@/lib/pickem';

const bg      = 'oklch(13% 0.025 255)';
const surface = 'oklch(17% 0.028 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const gold    = 'oklch(74% 0.16 72)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

interface PoolInfo { id: string; name: string; season: number; }

/** This hook has no AuthProvider guarantee in every context it's used from
 * (the standalone standings page is participant-facing) — read the session
 * record directly rather than a React auth context that doesn't exist here.
 * Sent as x-admin-email so the embedded admin-panel use of this hook isn't
 * asked to satisfy the *participant* password gate on a private pool it
 * already has commissioner/admin access to (see isAdminForPool in
 * src/lib/pool-access.ts) — harmless no-op for the public standings page,
 * where no stored session (or a non-admin one) just falls through to the
 * normal cookie check. */
function getStoredAdminEmail(): string | null {
  if (typeof window === 'undefined') return null;
  const storedUser = localStorage.getItem('nfl-pool-user');
  const localUser: { email?: string } | null = storedUser ? JSON.parse(storedUser) : null;
  return localUser?.email ?? null;
}

/** Fetches and holds Pick'em season state — shared by the standalone
 * standings page and the embedded panel used inside pool management's
 * Leaderboard tab, so there's exactly one fetch/loading implementation. */
function usePickemLeaderboardData(poolId: string) {
  const [pool, setPool] = useState<PoolInfo | null>(null);
  const [summary, setSummary] = useState<PickemSeasonSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const adminEmail = getStoredAdminEmail();
      const adminHeaders = adminEmail ? { 'x-admin-email': adminEmail } : undefined;
      const [poolRes, summaryRes] = await Promise.all([
        fetch(`/api/pools/${poolId}`, { headers: adminHeaders }),
        fetch(`/api/pickem/season?poolId=${poolId}`, { headers: adminHeaders }),
      ]);
      const poolData = await poolRes.json();
      const summaryData = await summaryRes.json();
      if (poolData?.pool) setPool({ id: poolData.pool.id, name: poolData.pool.name, season: poolData.pool.season });
      if (summaryData?.success) setSummary(summaryData.summary);
    } catch (error) {
      debugError("Error loading Pick'em leaderboard:", error);
    } finally {
      setIsLoading(false);
    }
  }, [poolId]);

  useEffect(() => { if (poolId) loadData(); }, [poolId, loadData]);

  return { pool, summary, isLoading };
}

/** Content-only Pick'em standings — no page chrome, so it can be embedded
 * directly inside a tab panel (pool management's Leaderboard tab) as well
 * as wrapped into a full page below. Shows current-week score and season
 * total per participant, sorted by season total — never confidence points,
 * Q1-Q4 periods, or Survivor elimination status. */
export function PickemStandingsPanel({ poolId }: { poolId: string }) {
  const { summary, isLoading } = usePickemLeaderboardData(poolId);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
        <div className="animate-spin rounded-full h-10 w-10" style={{ borderWidth: '3px', borderStyle: 'solid', borderColor: border, borderTopColor: green }} />
      </div>
    );
  }

  const winners = (summary?.participants ?? []).filter(p => summary?.seasonWinnerParticipantIds.includes(p.participantId));
  const currentWeekEntry = (week: number, seasonType: number, p: PickemSeasonSummary['participants'][number]) =>
    p.weeklyResults.find(w => w.week === week && w.seasonType === seasonType);

  const ranked = [...(summary?.participants ?? [])].sort((a, b2) => b2.seasonCorrectCount - a.seasonCorrectCount);

  return (
    <div>
      {summary?.currentWeek && (
        <p style={{ ...b, fontSize: '0.85rem', color: textMid, marginBottom: '1rem' }}>
          Week {summary.currentWeek.week}{summary.isSeasonComplete ? ' — season complete' : ''}
        </p>
      )}

      {winners.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: `${gold}18`, border: `1px solid ${gold}55`, borderRadius: 8, padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
          <Trophy style={{ width: 22, height: 22, color: gold, flexShrink: 0 }} />
          <p style={{ ...bc, fontWeight: 800, fontSize: '0.95rem', color: gold, textTransform: 'uppercase' }}>
            {winners.length === 1 ? `Season Winner: ${winners[0].participantName}` : `Season Winners: ${winners.map(w => w.participantName).join(', ')}`}
          </p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.75rem', padding: '0 1rem 0.35rem' }}>
          <span style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase' }}>Participant</span>
          <span style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase', textAlign: 'right' }}>This Week</span>
          <span style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase', textAlign: 'right' }}>Season</span>
        </div>
        {ranked.length === 0 ? (
          <p style={{ ...b, fontSize: '0.82rem', color: textDim, padding: '0 1rem' }}>No participants yet.</p>
        ) : ranked.map(p => {
          const thisWeek = summary?.currentWeek ? currentWeekEntry(summary.currentWeek.week, summary.currentWeek.seasonType, p) : undefined;
          const isWinner = summary?.seasonWinnerParticipantIds.includes(p.participantId);
          return (
            <div key={p.participantId} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.75rem', alignItems: 'center', background: 'oklch(17% 0.028 255)', border: `1px solid ${border}`, borderLeft: `3px solid ${isWinner ? gold : green}`, borderRadius: 8, padding: '0.75rem 1rem' }}>
              <span style={{ ...b, fontWeight: 600, fontSize: '0.875rem', color: text }}>{p.participantName}</span>
              <span style={{ ...bc, fontWeight: 700, fontSize: '0.85rem', color: textMid, textAlign: 'right' }}>
                {thisWeek ? `${thisWeek.correctCount}/${thisWeek.eligibleGameCount}` : '—'}
              </span>
              <span style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text, textAlign: 'right' }}>{p.seasonCorrectCount}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Full-page Pick'em standings — used by /pool/[id]/leaderboard when the
// pool's competition_type is PICKEM (see that route's own router).
export function PickemLeaderboard() {
  const params = useParams();
  const poolId = params.id as string;
  const { pool, isLoading } = usePickemLeaderboardData(poolId);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const storedUser = typeof window !== 'undefined' ? localStorage.getItem('nfl-pool-user') : null;
        const localUser: { id?: string } | null = storedUser ? JSON.parse(storedUser) : null;
        if (!localUser?.id) return;
        const res = await fetch(`/api/admin/verify-status?adminId=${localUser.id}`);
        const data = await res.json();
        if (data.success && data.isAdmin) { setIsAdmin(true); setIsSuperAdmin(!!data.isSuperAdmin); }
      } catch (error) {
        debugError('Error checking admin status:', error);
      }
    };
    checkAdminStatus();
  }, []);

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
        <div className="animate-spin rounded-full h-16 w-16" style={{ borderWidth: '3px', borderStyle: 'solid', borderColor: border, borderTopColor: green }} />
      </div>
    );
  }

  return (
    <div style={{ background: bg, minHeight: '100vh' }}>
      <AppNav isAuthenticated={isAdmin} isSuperAdmin={isSuperAdmin} onSignOut={() => {}} poolId={poolId} />

      <section style={{ background: bg, padding: 'clamp(2rem, 5vw, 3rem) 0 1.5rem' }}>
        <div className="lp-inner">
          <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.26em', color: gold, textTransform: 'uppercase', marginBottom: '0.6rem' }}>
            Pick&apos;em Standings
          </p>
          <h1 style={{ ...bc, fontWeight: 900, fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', lineHeight: 1, color: text, textTransform: 'uppercase' }}>
            {pool?.name ?? 'Loading…'}
          </h1>
        </div>
      </section>

      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${green}, transparent)` }} />

      <section style={{ background: surface, padding: '2rem 0 3rem' }}>
        <div className="lp-inner" style={{ maxWidth: 640 }}>
          <PickemStandingsPanel poolId={poolId} />
        </div>
      </section>

      <Footer pageName="Pick'em Standings" />
    </div>
  );
}
