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

// Survivor's own standings view — deliberately not a tab bolted onto the
// Confidence leaderboard (no weekly points, no periods, no season-champion
// concept apply here). ACTIVE participants sort first (most weeks
// survived, i.e. deepest into an active pick history, first), then
// ELIMINATED sorted by most-recent elimination first — whoever's still
// alive should be immediately obvious at a glance.
export function SurvivorLeaderboard() {
  const params = useParams();
  const poolId = params.id as string;
  const [pool, setPool] = useState<PoolInfo | null>(null);
  const [state, setState] = useState<SurvivorPoolState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

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

  const winners = state?.participants.filter(p => p.status === 'WINNER') ?? [];
  const active = (state?.participants.filter(p => p.status === 'ACTIVE') ?? [])
    .sort((a, b2) => b2.picks.length - a.picks.length);
  const eliminated = (state?.participants.filter(p => p.status === 'ELIMINATED') ?? [])
    .sort((a, b2) => (b2.eliminatedWeek ?? 0) - (a.eliminatedWeek ?? 0));

  return (
    <div style={{ background: bg, minHeight: '100vh' }}>
      <AppNav isAuthenticated={isAdmin} isSuperAdmin={isSuperAdmin} onSignOut={() => {}} poolId={poolId} />

      <section style={{ background: bg, padding: 'clamp(2rem, 5vw, 3rem) 0 1.5rem' }}>
        <div className="lp-inner">
          <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.26em', color: gold, textTransform: 'uppercase', marginBottom: '0.6rem' }}>
            Survivor Standings
          </p>
          <h1 style={{ ...bc, fontWeight: 900, fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', lineHeight: 1, color: text, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            {pool?.name ?? 'Loading…'}
          </h1>
          {state?.currentWeek && (
            <p style={{ ...b, fontSize: '0.9rem', color: textMid }}>
              Week {state.currentWeek.week} — {active.length} still alive, {eliminated.length} eliminated
            </p>
          )}
        </div>
      </section>

      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${green}, transparent)` }} />

      {winners.length > 0 && (
        <section style={{ background: surface, padding: '1.75rem 0' }}>
          <div className="lp-inner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: `${gold}18`, border: `1px solid ${gold}55`, borderRadius: 8, padding: '1rem 1.25rem' }}>
              <Trophy style={{ width: 24, height: 24, color: gold, flexShrink: 0 }} />
              <p style={{ ...bc, fontWeight: 800, fontSize: '1.05rem', color: gold, textTransform: 'uppercase' }}>
                {winners.length === 1 ? `Winner: ${winners[0].participantName}` : `Winners: ${winners.map(w => w.participantName).join(', ')}`}
              </p>
            </div>
          </div>
        </section>
      )}

      <section style={{ background: bg, padding: '2rem 0' }}>
        <div className="lp-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <ShieldCheck style={{ width: 18, height: 18, color: greenHi }} />
            <h2 style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase' }}>Active ({active.length})</h2>
          </div>
          {active.length === 0 ? (
            <p style={{ ...b, fontSize: '0.85rem', color: textDim }}>No participants are still active.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {active.map(p => (
                <div key={p.participantId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: card, border: `1px solid ${border}`, borderLeft: `3px solid ${greenHi}`, borderRadius: 8, padding: '0.75rem 1.25rem' }}>
                  <span style={{ ...bc, fontWeight: 700, fontSize: '0.95rem', color: text }}>{p.participantName}</span>
                  <span style={{ ...b, fontSize: '0.78rem', color: textDim }}>{p.picks.length} pick{p.picks.length === 1 ? '' : 's'} made</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {eliminated.length > 0 && (
        <section style={{ background: surface, padding: '2rem 0 3rem' }}>
          <div className="lp-inner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <Skull style={{ width: 18, height: 18, color: red }} />
              <h2 style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase' }}>Eliminated ({eliminated.length})</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {eliminated.map(p => (
                <div key={p.participantId} style={{ background: card, border: `1px solid ${border}`, borderLeft: `3px solid ${red}`, borderRadius: 8, padding: '0.75rem 1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ ...bc, fontWeight: 700, fontSize: '0.95rem', color: textMid }}>{p.participantName}</span>
                    <span style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', color: red, textTransform: 'uppercase' }}>Eliminated Week {p.eliminatedWeek}</span>
                  </div>
                  <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginTop: '0.2rem' }}>
                    {p.eliminatedReason === 'no_pick'
                      ? 'Did not submit a pick'
                      : `Pick: ${p.eliminatedTeam} — ${p.eliminatedReason === 'tie' ? 'tied' : 'lost'}`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <Footer pageName="Survivor Standings" />
    </div>
  );
}
