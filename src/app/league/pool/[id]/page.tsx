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
import { AppNav } from '@/components/layout/AppNav';
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
  huddle_id?: string | null;
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
  const [isSuperAdminViewer, setIsSuperAdminViewer] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [currentSeasonType, setCurrentSeasonType] = useState(2);

  useEffect(() => {
    const load = async () => {
      if (!user?.email || !poolId) return;
      try {
        const [poolData, isSuperAdmin] = await Promise.all([
          loadPool(poolId),
          verifyAdminStatus(true),
        ]);

        setIsSuperAdminViewer(isSuperAdmin);

        if (!poolData) {
          setPool(null);
          return;
        }

        setPool(poolData as PoolRecord);
        setAuthorized(isSuperAdmin || poolData.created_by === user.email);

        // Scoped to this pool's own season — without it, a past/completed
        // season's pool would pick up whatever's upcoming in the NFL right
        // now globally (e.g. next season's preseason), breaking Overview's
        // Missing Picks tracking and stats for any closed or prior-season pool.
        const week = await getUpcomingWeek(poolData.season);
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

  // A commissioner viewing their own pool goes back to that pool's own
  // Huddle. A super admin browsing someone else's pool (the common case
  // when they got here via /admin/pools) goes back to that Huddle's admin
  // view instead — not the admin's own League, which is unrelated to
  // whatever pool they were just looking at.
  const isOwner = !!pool && user?.email === pool.created_by;
  const backTarget = pool
    ? (isOwner
        ? (pool.huddle_id ? `/league/${pool.huddle_id}` : '/league')
        : (pool.huddle_id ? `/admin/league/${pool.huddle_id}` : '/admin/pools'))
    : (isSuperAdminViewer ? '/admin/pools' : '/league');
  const backLabel = isOwner ? 'Your League' : 'All Pools';

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
            onClick={() => router.push(backTarget)}
            style={{ marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 1rem', background: green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
          >
            <ArrowLeft style={{ width: 12, height: 12 }} /> Back to {backLabel}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: bg, minHeight: '100vh' }}>
      {/* ── NAV ── */}
      <AppNav
        isAuthenticated
        isSuperAdmin={isSuperAdminViewer}
        onSignOut={handleLogout}
        poolId={poolId}
        extraSections={[{ label: pool.name, links: [{ label: backLabel, href: backTarget }] }]}
      />

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
            onPoolDeleted={() => router.push(backTarget)}
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
