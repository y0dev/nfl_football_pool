'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  Users,
  Trophy,
  Settings,
  BarChart3,
  Activity,
  Clock,
  Shield,
  RefreshCw,
  LogOut
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { adminService } from '@/lib/admin-service';
import { createPageUrl } from '@/lib/utils';
import { AuthProvider } from '@/lib/auth';
import { AdminGuard } from '@/components/auth/admin-guard';
import { ExportData } from '@/components/admin/export-data';
import { PoolSettings } from '@/components/admin/pool-settings';
import { ParticipantManagement } from '@/components/admin/participant-management';
import { TieBreakerSettings } from '@/components/admin/tie-breaker-settings';
import { OverrideMondayNightScore } from '@/components/admin/override-monday-night-score';

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

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

const TABS = [
  { id: 'overview',      label: 'Overview',      icon: BarChart3 },
  { id: 'participants',  label: 'Participants',   icon: Users },
  { id: 'settings',      label: 'Settings',       icon: Settings },
  { id: 'export',        label: 'Export Data',    icon: Activity },
  { id: 'tiebreakers',   label: 'Tie Breakers',   icon: Trophy },
  { id: 'mondaynight',   label: 'Monday Night',   icon: Clock },
];

function PoolAdminContent() {
  const params = useParams();
  const poolId = params.id as string;
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [pool, setPool] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [currentWeek, setCurrentWeek] = useState(1);
  const [currentSeason, setCurrentSeason] = useState(new Date().getFullYear());

  useEffect(() => {
    if (poolId) loadPoolData();
  }, [poolId]);

  const loadPoolData = async () => {
    try {
      setIsLoading(true);
      const poolData = await adminService.getPoolById(poolId);
      setPool(poolData);
      const participantsData = await adminService.getPoolParticipants(poolId);
      setParticipants(participantsData);
      setCurrentWeek(1);
    } catch (error) {
      console.error('Error loading pool data:', error);
      toast({ title: 'Error', description: 'Failed to load pool data', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/admin/login');
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw style={{ width: 32, height: 32, color: textDim, margin: '0 auto 0.75rem', animation: 'spin 1s linear infinite' }} />
          <p style={{ ...b, color: textMid, fontSize: '0.9rem' }}>Loading pool data…</p>
        </div>
      </div>
    );
  }

  if (!pool) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
        <div style={{ background: card, border: `1px solid ${border}`, borderTop: `3px solid ${green}`, borderRadius: 10, padding: '2rem', maxWidth: 400, width: '100%', textAlign: 'center' }}>
          <Shield style={{ width: 40, height: 40, color: textDim, margin: '0 auto 0.75rem' }} />
          <h2 style={{ ...bc, fontWeight: 800, fontSize: '1.1rem', color: text, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Pool Not Found</h2>
          <p style={{ ...b, fontSize: '0.875rem', color: textMid, marginBottom: '1.25rem' }}>The requested pool could not be found.</p>
          <button
            onClick={() => router.push(createPageUrl('admin/dashboard'))}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
              width: '100%', padding: '0.6rem 1rem',
              background: green, color: text,
              border: 'none', borderRadius: 6,
              ...bc, fontWeight: 700, fontSize: '0.8rem',
              letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer',
            }}
          >
            <ArrowLeft style={{ width: 13, height: 13 }} />
            Back to Dashboard
          </button>
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                onClick={() => router.push(createPageUrl('admin/dashboard'))}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  padding: '0.35rem 0.6rem',
                  background: 'transparent', color: textMid,
                  border: `1px solid ${border}`, borderRadius: 5,
                  ...bc, fontWeight: 600, fontSize: '0.72rem',
                  letterSpacing: '0.07em', textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
              >
                <ArrowLeft style={{ width: 12, height: 12 }} />
                Dashboard
              </button>
              <div style={{ width: 1, height: 20, background: border }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: green, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Shield style={{ width: 14, height: 14, color: text }} />
                </div>
                <span style={{ ...bc, fontWeight: 800, fontSize: '0.92rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase', maxWidth: '20ch', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {pool.name}
                </span>
              </div>
            </div>
            <button
              onClick={handleSignOut}
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
              <LogOut style={{ width: 11, height: 11 }} />
              Sign Out
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
            Pool Administration
          </p>
          <h1 style={{ ...bc, fontWeight: 900, fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', lineHeight: 0.95, color: text, textTransform: 'uppercase', marginBottom: '0.6rem' }}>
            {pool.name.split(' ').slice(0, -1).join(' ') || pool.name}<br />
            {pool.name.split(' ').length > 1 && <span style={{ color: gold }}>{pool.name.split(' ').slice(-1)[0]}</span>}
          </h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
            <span style={{
              ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.08em',
              padding: '0.15rem 0.5rem', borderRadius: 4, textTransform: 'uppercase',
              background: 'oklch(26% 0.03 255)', color: textMid, border: `1px solid ${border}`,
            }}>Pool Admin</span>
            <span style={{
              ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.08em',
              padding: '0.15rem 0.5rem', borderRadius: 4, textTransform: 'uppercase',
              background: pool.is_active ? 'oklch(46% 0.14 155 / 0.2)' : 'oklch(26% 0.03 255)',
              color: pool.is_active ? greenHi : textDim,
              border: `1px solid ${pool.is_active ? 'oklch(46% 0.14 155 / 0.4)' : border}`,
            }}>{pool.is_active ? 'Active' : 'Inactive'}</span>
            <span style={{
              ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.08em',
              padding: '0.15rem 0.5rem', borderRadius: 4, textTransform: 'uppercase',
              background: 'oklch(26% 0.03 255)', color: textMid, border: `1px solid ${border}`,
            }}>{participants.length} Participants</span>
          </div>
        </div>
      </section>

      {/* ── green rule ── */}
      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${green}, transparent)` }} />

      {/* ── TABS ── */}
      <section style={{ background: surface, borderBottom: `1px solid ${border}`, position: 'sticky', top: 57, zIndex: 40 }}>
        <div className="lp-inner">
          <div style={{ display: 'flex', gap: '0.25rem', overflowX: 'auto', paddingBottom: '0', paddingTop: '0.5rem' }}>
            {TABS.map(({ id, label, icon: Icon }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                    padding: '0.5rem 0.85rem',
                    background: active ? green : 'transparent',
                    color: active ? text : textMid,
                    border: `1px solid ${active ? green : 'transparent'}`,
                    borderBottom: active ? `1px solid ${green}` : `1px solid transparent`,
                    borderRadius: '6px 6px 0 0',
                    ...bc, fontWeight: 700, fontSize: '0.72rem',
                    letterSpacing: '0.07em', textTransform: 'uppercase',
                    cursor: 'pointer', whiteSpace: 'nowrap',
                    marginBottom: -1,
                  }}
                >
                  <Icon style={{ width: 12, height: 12 }} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── TAB CONTENT ── */}
      <section style={{ background: bg, padding: '2.5rem 0', minHeight: '50vh' }}>
        <div className="lp-inner">

          {/* Overview */}
          {activeTab === 'overview' && (
            <div>
              <div className="admin-actions-grid" style={{ marginBottom: 0 }}>
                {[
                  { label: 'Participants', value: participants.length, sub: 'Active participants', big: true },
                  { label: 'Pool Type', value: pool.pool_type || 'Normal', sub: 'Competition style', big: false },
                  { label: 'Status', value: pool.is_active ? 'Active' : 'Inactive', sub: 'Pool status', big: false },
                  { label: 'Current Week', value: currentWeek, sub: `Week ${currentWeek} of season`, big: true },
                  { label: 'Season', value: currentSeason, sub: 'Current season', big: true },
                  { label: 'Created', value: new Date(pool.created_at).toLocaleDateString(), sub: 'Pool creation date', big: false },
                ].map(({ label, value, sub, big }) => (
                  <div key={label} style={{
                    background: card, border: `1px solid ${border}`,
                    borderRadius: 8, padding: '1.1rem 1.25rem',
                  }}>
                    <p style={{ ...bc, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                      {label}
                    </p>
                    <p style={{ ...bc, fontWeight: 900, fontSize: big ? '2rem' : '1.25rem', color: greenHi, lineHeight: 1.1 }}>
                      {String(value)}
                    </p>
                    <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.25rem' }}>{sub}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sub-components (keep as-is — they inherit admin-theme dark CSS variables) */}
          {activeTab === 'participants' && (
            <ParticipantManagement poolId={poolId} poolName={pool.name} />
          )}

          {activeTab === 'settings' && (
            <PoolSettings poolId={poolId} poolName={pool.name} />
          )}

          {activeTab === 'export' && (
            <ExportData
              poolId={poolId}
              poolName={pool.name}
              currentWeek={currentWeek}
              currentSeason={currentSeason}
            />
          )}

          {activeTab === 'tiebreakers' && (
            <TieBreakerSettings poolId={poolId} poolName={pool.name} />
          )}

          {activeTab === 'mondaynight' && (
            <OverrideMondayNightScore
              poolId={poolId}
              poolName={pool.name}
              week={currentWeek}
              season={currentSeason}
              seasonType={2}
            />
          )}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: bg, borderTop: `1px solid ${border}`, padding: '1.5rem 0' }}>
        <div className="lp-inner" style={{ textAlign: 'center' }}>
          <p style={{ ...b, fontSize: '0.8rem', color: textDim }}>&copy; {new Date().getFullYear()} NFL Confidence Pool · Commissioner HQ</p>
        </div>
      </footer>
    </div>
  );
}

export default function PoolAdminPage() {
  return (
    <AuthProvider>
      <AdminGuard>
        <PoolAdminContent />
      </AdminGuard>
    </AuthProvider>
  );
}
