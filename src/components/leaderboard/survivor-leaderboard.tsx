'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Trophy, Skull, ShieldCheck } from 'lucide-react';
import { Footer } from '@/components/layout/Footer';
import { AppNav } from '@/components/layout/AppNav';
import { debugError } from '@/lib/utils';
import type { SurvivorPoolState } from '@/lib/survivor';

const bg      = 'oklch(13% 0.025 255)';
const surface = 'oklch(17% 0.028 255)';
const card    = 'oklch(20% 0.03 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const gold    = 'oklch(74% 0.16 72)';
const red     = 'oklch(62% 0.22 25)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

interface PoolInfo { id: string; name: string; season: number; }

/** Fetches and holds Survivor pool state — shared by both the standalone
 * standings page and the embedded panel used inside pool management's
 * Leaderboard tab, so there's exactly one fetch/loading implementation. */
function useSurvivorLeaderboardData(poolId: string) {
  const [pool, setPool] = useState<PoolInfo | null>(null);
  const [state, setState] = useState<SurvivorPoolState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [poolRes, stateRes] = await Promise.all([
        fetch(`/api/pools/${poolId}`),
        fetch(`/api/survivor/state?poolId=${poolId}`),
      ]);
      const poolData = await poolRes.json();
      const stateData = await stateRes.json();
      if (poolData?.pool) setPool({ id: poolData.pool.id, name: poolData.pool.name, season: poolData.pool.season });
      if (stateData?.success) setState(stateData.state);
    } catch (error) {
      debugError('Error loading Survivor leaderboard:', error);
    } finally {
      setIsLoading(false);
    }
  }, [poolId]);

  useEffect(() => { if (poolId) loadData(); }, [poolId, loadData]);

  return { pool, state, isLoading };
}

/** Content-only Survivor standings — no page chrome (nav/hero/footer), so
 * it can be embedded directly inside a tab panel (pool management's
 * Leaderboard tab) as well as wrapped into a full page below. ACTIVE
 * participants sort first (most weeks survived), then ELIMINATED sorted by
 * most-recent elimination first — whoever's still alive should be
 * immediately obvious at a glance. This is also where a commissioner gets
 * elimination visibility (week, team, result) — no separate "Eliminations"
 * view exists, since it would just show the same data computeSurvivorPoolState()
 * already provides here. */
export function SurvivorStandingsPanel({ poolId }: { poolId: string }) {
  const { state, isLoading } = useSurvivorLeaderboardData(poolId);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
        <div className="animate-spin rounded-full h-10 w-10" style={{ borderWidth: '3px', borderStyle: 'solid', borderColor: border, borderTopColor: green }} />
      </div>
    );
  }

  const winners = state?.participants.filter(p => p.status === 'WINNER') ?? [];
  const active = (state?.participants.filter(p => p.status === 'ACTIVE') ?? [])
    .sort((a, b2) => b2.picks.length - a.picks.length);
  const eliminated = (state?.participants.filter(p => p.status === 'ELIMINATED') ?? [])
    .sort((a, b2) => (b2.eliminatedWeek ?? 0) - (a.eliminatedWeek ?? 0));

  return (
    <div>
      {state?.currentWeek && (
        <p style={{ ...b, fontSize: '0.85rem', color: textMid, marginBottom: '1rem' }}>
          Week {state.currentWeek.week} — {active.length} still alive, {eliminated.length} eliminated
        </p>
      )}

      {winners.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: `${gold}18`, border: `1px solid ${gold}55`, borderRadius: 8, padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
          <Trophy style={{ width: 22, height: 22, color: gold, flexShrink: 0 }} />
          <p style={{ ...bc, fontWeight: 800, fontSize: '0.95rem', color: gold, textTransform: 'uppercase' }}>
            {winners.length === 1 ? `Winner: ${winners[0].participantName}` : `Winners: ${winners.map(w => w.participantName).join(', ')}`}
          </p>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
        <ShieldCheck style={{ width: 16, height: 16, color: greenHi }} />
        <p style={{ ...bc, fontWeight: 800, fontSize: '0.85rem', letterSpacing: '0.05em', color: text, textTransform: 'uppercase' }}>Active ({active.length})</p>
      </div>
      {active.length === 0 ? (
        <p style={{ ...b, fontSize: '0.82rem', color: textDim, marginBottom: '1.25rem' }}>No participants are still active.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
          {active.map(p => (
            <div key={p.participantId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'oklch(17% 0.028 255)', border: `1px solid ${border}`, borderLeft: `3px solid ${greenHi}`, borderRadius: 8, padding: '0.75rem 1rem' }}>
              <span style={{ ...b, fontWeight: 600, fontSize: '0.875rem', color: text }}>{p.participantName}</span>
              <span style={{ ...b, fontSize: '0.72rem', color: textDim }}>{p.picks.length} pick{p.picks.length === 1 ? '' : 's'} made</span>
            </div>
          ))}
        </div>
      )}

      {eliminated.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
            <Skull style={{ width: 16, height: 16, color: red }} />
            <p style={{ ...bc, fontWeight: 800, fontSize: '0.85rem', letterSpacing: '0.05em', color: text, textTransform: 'uppercase' }}>Eliminated ({eliminated.length})</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {eliminated.map(p => (
              <div key={p.participantId} style={{ background: 'oklch(17% 0.028 255)', border: `1px solid ${border}`, borderLeft: `3px solid ${red}`, borderRadius: 8, padding: '0.75rem 1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ ...b, fontWeight: 600, fontSize: '0.875rem', color: textMid }}>{p.participantName}</span>
                  <span style={{ ...bc, fontWeight: 700, fontSize: '0.68rem', color: red, textTransform: 'uppercase' }}>Eliminated Week {p.eliminatedWeek}</span>
                </div>
                <p style={{ ...b, fontSize: '0.74rem', color: textDim, marginTop: '0.15rem' }}>
                  {p.eliminatedReason === 'no_pick'
                    ? 'Did not submit a pick'
                    : `Pick: ${p.eliminatedTeam} — ${p.eliminatedReason === 'tie' ? 'tied' : 'lost'}`}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Full-page Survivor standings — used by /pool/[id]/leaderboard when the
// pool's competition_type is SURVIVOR (see that route's own router).
export function SurvivorLeaderboard() {
  const params = useParams();
  const poolId = params.id as string;
  const { pool, state, isLoading } = useSurvivorLeaderboardData(poolId);
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
            Survivor Standings
          </p>
          <h1 style={{ ...bc, fontWeight: 900, fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', lineHeight: 1, color: text, textTransform: 'uppercase' }}>
            {pool?.name ?? 'Loading…'}
          </h1>
        </div>
      </section>

      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${green}, transparent)` }} />

      <section style={{ background: surface, padding: '2rem 0 3rem' }}>
        <div className="lp-inner" style={{ maxWidth: 640 }}>
          <SurvivorStandingsPanel poolId={poolId} />
        </div>
      </section>

      <Footer pageName="Survivor Standings" />
    </div>
  );
}
