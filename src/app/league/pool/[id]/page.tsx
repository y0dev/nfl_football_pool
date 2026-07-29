'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Trophy, LogOut, ShieldOff } from 'lucide-react';
import { useAuth, AuthProvider } from '@/lib/auth';
import { AdminGuard } from '@/components/auth/admin-guard';
import { Footer } from '@/components/layout/Footer';
import { useToast } from '@/hooks/use-toast';
import { loadPool } from '@/actions/loadPools';
import { getUpcomingWeek } from '@/actions/loadCurrentWeek';
import { PoolWorkspace } from '@/components/pools/pool-workspace';
import { debugError } from '@/lib/utils';

// Design tokens (matches app-wide dark theme)
const bg      = 'oklch(13% 0.025 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const gold    = 'oklch(74% 0.16 72)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const liveRed = 'oklch(62% 0.22 25)';

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

interface PoolRecord {
  id: string;
  name: string;
  created_by: string;
  season: number;
  season_scope?: number[];
}

function PoolManageContent() {
  const params = useParams();
  const poolId = params.id as string;
  const { user, signOut, verifyAdminStatus } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [pool, setPool] = useState<PoolRecord | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [currentSeasonType, setCurrentSeasonType] = useState(2);

  useEffect(() => {
    const load = async () => {
      if (!user?.email || !poolId) return;
      try {
        const [poolData, isSuperAdmin, week] = await Promise.all([
          loadPool(poolId),
          verifyAdminStatus(true),
          getUpcomingWeek(),
        ]);

        if (!poolData) {
          setPool(null);
          return;
        }

        setPool(poolData as PoolRecord);
        setAuthorized(isSuperAdmin || poolData.created_by === user.email);
        setCurrentWeek(week.week);
        setCurrentSeasonType(week.seasonType);
      } catch (error) {
        debugError('Failed to load pool:', error);
        toast({ title: 'Error', description: 'Failed to load this pool.', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [poolId, user?.email, verifyAdminStatus, toast]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try { await signOut(); router.push('/login'); }
    catch { setIsLoggingOut(false); }
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
        <div className="animate-spin rounded-full h-16 w-16" style={{ borderWidth: '3px', borderStyle: 'solid', borderColor: border, borderTopColor: green }} />
      </div>
    );
  }

  if (!pool || !authorized) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg, padding: '2rem' }}>
        <div style={{ textAlign: 'center' }}>
          <ShieldOff style={{ width: 32, height: 32, color: textDim, margin: '0 auto 0.75rem' }} />
          <p style={{ ...bc, fontWeight: 700, fontSize: '1rem', color: textMid, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {pool ? "You don't have access to this pool" : 'Pool not found'}
          </p>
          <button
            onClick={() => router.push('/league')}
            style={{ marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 1rem', background: green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
          >
            <ArrowLeft style={{ width: 12, height: 12 }} /> Back to Your League
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: bg, minHeight: '100vh' }}>
      {/* ── NAV ── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'oklch(13% 0.025 255 / 0.95)', backdropFilter: 'blur(14px)', borderBottom: `1px solid ${border}` }}>
        <div className="lp-inner" style={{ paddingTop: '0.75rem', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', rowGap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
              <button onClick={() => router.push('/league')} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.6rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer', flexShrink: 0 }}>
                <ArrowLeft style={{ width: 12, height: 12 }} /> Your League
              </button>
              <div style={{ width: 1, height: 20, background: border, flexShrink: 0 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: gold, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Trophy style={{ width: 14, height: 14, color: bg }} />
                </div>
                <span style={{ ...bc, fontWeight: 800, fontSize: '0.92rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pool.name}</span>
              </div>
            </div>
            <button onClick={handleLogout} disabled={isLoggingOut} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.65rem', background: liveRed, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: isLoggingOut ? 'not-allowed' : 'pointer', opacity: isLoggingOut ? 0.6 : 1 }}>
              <LogOut style={{ width: 12, height: 12 }} /> Logout
            </button>
          </div>
        </div>
      </nav>

      {/* ── POOL WORKSPACE ── */}
      <section style={{ background: bg, padding: '2.5rem 0 3rem' }}>
        <div className="lp-inner">
          <PoolWorkspace
            poolId={pool.id}
            poolName={pool.name}
            season={pool.season}
            seasonScope={pool.season_scope}
            currentWeek={currentWeek}
            currentSeasonType={currentSeasonType}
            onPoolDeleted={() => router.push('/league')}
          />
        </div>
      </section>

      <Footer pageName={pool.name} />
    </div>
  );
}

export default function PoolManagePage() {
  return (
    <AuthProvider>
      <AdminGuard>
        <PoolManageContent />
      </AdminGuard>
    </AuthProvider>
  );
}
