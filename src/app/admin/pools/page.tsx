'use client';

import { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft, Trophy, Users, Plus, LogOut, RefreshCw, Search,
  ChevronRight, ShieldCheck, ShieldOff, Share2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { AuthProvider } from '@/lib/auth';
import { AdminGuard } from '@/components/auth/admin-guard';
import { CreatePoolDialog } from '@/components/pools/create-pool-dialog';
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
const liveRed = 'oklch(62% 0.22 25)';

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

type StatusFilter = 'all' | 'active' | 'inactive';

interface Pool {
  id: string;
  name: string;
  is_active: boolean;
  season: number;
  created_by: string;
  created_at: string;
  participants: { count: number }[];
}

function AdminPoolsContent() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [pools, setPools]               = useState<Pool[]>([]);
  const [isLoading, setIsLoading]       = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm]     = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [createOpen, setCreateOpen]     = useState(false);
  const [currentWeek, setCurrentWeek]   = useState(1);
  const [seasonType, setSeasonType]     = useState(2);

  const loadPools = async () => {
    try {
      const res = await fetch('/api/admin/all-pools');
      const data = await res.json();
      if (data.success) setPools(data.pools || []);
      else toast({ title: 'Error', description: 'Failed to load pools', variant: 'destructive' });
    } catch {
      toast({ title: 'Error', description: 'Failed to load pools', variant: 'destructive' });
    }
  };

  useEffect(() => {
    const init = async () => {
      await loadPools();
      try {
        const res = await fetch('/api/admin/season-games/current');
        const data = await res.json();
        if (data.success) {
          setCurrentWeek(data.week ?? 1);
          setSeasonType(data.seasonType ?? 2);
        }
      } catch { /* use defaults */ }
      setIsLoading(false);
    };
    init();
  }, []);

  const handleShare = async (poolId: string, poolName: string) => {
    const isOffseason = seasonType !== 2;
    const shareWeek = isOffseason ? 1 : currentWeek;
    const shareSeasonType = isOffseason ? 2 : seasonType;
    const shareUrl = `${window.location.origin}/pool/${poolId}/picks?week=${shareWeek}&seasonType=${shareSeasonType}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `Join my pool: ${poolName}`, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast({ title: 'Link Copied', description: 'Pool link copied to clipboard.' });
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        await navigator.clipboard.writeText(shareUrl);
        toast({ title: 'Link Copied', description: 'Pool link copied to clipboard.' });
      }
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadPools();
    setIsRefreshing(false);
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try { await signOut(); router.push('/admin/login'); }
    catch { setIsLoggingOut(false); }
  };

  const filtered = useMemo(() => {
    return pools.filter(p => {
      const matchesStatus =
        statusFilter === 'all' ? true :
        statusFilter === 'active' ? p.is_active :
        !p.is_active;
      const matchesSearch = !searchTerm.trim() ||
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.created_by.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [pools, statusFilter, searchTerm]);

  const stats = useMemo(() => ({
    total:    pools.length,
    active:   pools.filter(p => p.is_active).length,
    inactive: pools.filter(p => !p.is_active).length,
  }), [pools]);

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
        <div className="animate-spin rounded-full h-16 w-16" style={{ borderWidth: '3px', borderStyle: 'solid', borderColor: border, borderTopColor: green }} />
      </div>
    );
  }

  const statItems = [
    { label: 'Total',    value: stats.total,    color: gold,    sub: 'All seasons' },
    { label: 'Active',   value: stats.active,   color: greenHi, sub: 'Accepting picks' },
    { label: 'Inactive', value: stats.inactive,  color: liveRed, sub: 'Closed / locked' },
  ];

  const filterTabs: { key: StatusFilter; label: string }[] = [
    { key: 'all',      label: `All (${stats.total})` },
    { key: 'active',   label: `Active (${stats.active})` },
    { key: 'inactive', label: `Inactive (${stats.inactive})` },
  ];

  return (
    <div style={{ background: bg, minHeight: '100vh' }}>

      {/* ── NAV ── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'oklch(13% 0.025 255 / 0.95)', backdropFilter: 'blur(14px)', borderBottom: `1px solid ${border}` }}>
        <div className="lp-inner" style={{ paddingTop: '0.75rem', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
              <button onClick={() => router.push('/admin/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.6rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}>
                <ArrowLeft style={{ width: 12, height: 12 }} /> Back
              </button>
              <div style={{ width: 1, height: 20, background: border }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: gold, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Trophy style={{ width: 14, height: 14, color: bg }} />
                </div>
                <span className="pools-nav-label" style={{ ...bc, fontWeight: 800, fontSize: '0.92rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Pool Management</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
              <button onClick={handleRefresh} disabled={isRefreshing} title="Refresh" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.65rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 6, ...bc, fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: isRefreshing ? 'not-allowed' : 'pointer', opacity: isRefreshing ? 0.6 : 1 }}>
                <RefreshCw style={{ width: 12, height: 12 }} className={isRefreshing ? 'animate-spin' : ''} />
                <span className="pools-nav-label">Refresh</span>
              </button>
              <button onClick={() => setCreateOpen(true)} title="Create Pool" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.65rem', background: green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
                <Plus style={{ width: 12, height: 12 }} /><span className="pools-nav-label">Create Pool</span>
              </button>
              <button onClick={handleLogout} disabled={isLoggingOut} title="Logout" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.65rem', background: liveRed, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: isLoggingOut ? 'not-allowed' : 'pointer', opacity: isLoggingOut ? 0.6 : 1 }}>
                <LogOut style={{ width: 12, height: 12 }} /><span className="pools-nav-label">Logout</span>
              </button>
            </div>

          </div>
        </div>
      </nav>

      {/* ── STATS ── */}
      <section style={{ background: surface, padding: '2.5rem 0' }}>
        <div className="lp-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <span style={{ display: 'block', width: 3, height: 22, background: green, borderRadius: 2 }} />
            <h2 style={{ ...bc, fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.06em', color: text, textTransform: 'uppercase' }}>Overview</h2>
          </div>
          <div className="admin-3col-grid">
            {statItems.map(({ label, value, color, sub }) => (
              <div key={label} style={{ background: card, border: `1px solid ${border}`, borderLeft: `3px solid ${color}`, borderRadius: 8, padding: '1.25rem' }}>
                <div style={{ ...bc, fontWeight: 900, fontSize: '2.25rem', color, lineHeight: 1, letterSpacing: '0.02em' }}>{value}</div>
                <div style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', color: text, letterSpacing: '0.07em', textTransform: 'uppercase', marginTop: '0.3rem' }}>{label}</div>
                <div style={{ ...b, fontSize: '0.7rem', color: textDim, marginTop: '0.15rem' }}>{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── green rule ── */}
      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${green}, transparent)` }} />

      {/* ── LIST ── */}
      <section style={{ background: bg, padding: '3rem 0' }}>
        <div className="lp-inner">

          {/* toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            <span style={{ display: 'block', width: 3, height: 22, background: green, borderRadius: 2, flexShrink: 0 }} />
            <h3 style={{ ...bc, fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.06em', color: text, textTransform: 'uppercase', marginRight: 'auto' }}>
              Pools ({filtered.length})
            </h3>

            {/* status filter tabs */}
            <div style={{ display: 'flex', gap: '0.25rem', background: surface, border: `1px solid ${border}`, borderRadius: 6, padding: '0.2rem' }}>
              {filterTabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  style={{
                    padding: '0.3rem 0.7rem',
                    background: statusFilter === tab.key ? green : 'transparent',
                    color: statusFilter === tab.key ? text : textMid,
                    border: 'none', borderRadius: 4,
                    ...bc, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.07em', textTransform: 'uppercase',
                    cursor: 'pointer', transition: 'background 0.12s',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* search */}
            <div className="admin-pools-search">
              <Search style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: textDim }} />
              <input
                placeholder="Search pools…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ ...b, display: 'block', width: '100%', boxSizing: 'border-box', background: card, border: `1px solid ${border}`, color: text, fontSize: '0.82rem', paddingLeft: '2rem', paddingRight: '0.65rem', height: 34, borderRadius: 6 }}
              />
            </div>
          </div>

          {/* pool cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', background: surface, border: `1px solid ${border}`, borderRadius: 8 }}>
                <Trophy style={{ width: 40, height: 40, color: textDim, margin: '0 auto 1rem' }} />
                <p style={{ ...b, color: textDim, fontSize: '0.9rem' }}>
                  {searchTerm || statusFilter !== 'all' ? 'No pools match your filters.' : 'No pools created yet.'}
                </p>
              </div>
            ) : (
              filtered.map(pool => {
                const participantCount = pool.participants?.[0]?.count ?? 0;
                return (
                  <div
                    key={pool.id}
                    style={{ background: surface, border: `1px solid ${border}`, borderLeft: `3px solid ${pool.is_active ? green : border}`, borderRadius: 8, padding: '1.25rem' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>

                      {/* icon */}
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: pool.is_active ? `linear-gradient(135deg, ${green}, oklch(59% 0.15 155))` : `linear-gradient(135deg, oklch(26% 0.03 255), oklch(30% 0.03 255))`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Trophy style={{ width: 16, height: 16, color: pool.is_active ? text : textDim }} />
                      </div>

                      {/* info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
                          <span style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text, letterSpacing: '0.02em' }}>{pool.name}</span>
                          {pool.is_active ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.1em', color: greenHi, background: 'oklch(46% 0.14 155 / 0.15)', padding: '0.15rem 0.4rem', borderRadius: 4, textTransform: 'uppercase' }}>
                              <ShieldCheck style={{ width: 9, height: 9 }} /> Active
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.1em', color: textDim, background: 'oklch(26% 0.03 255 / 0.6)', padding: '0.15rem 0.4rem', borderRadius: 4, textTransform: 'uppercase' }}>
                              <ShieldOff style={{ width: 9, height: 9 }} /> Inactive
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', ...b, fontSize: '0.78rem', color: textMid }}>
                            <Users style={{ width: 12, height: 12, color: textDim }} />
                            {participantCount} participant{participantCount !== 1 ? 's' : ''}
                          </span>
                          <span style={{ ...b, fontSize: '0.78rem', color: textDim }}>{pool.season} Season</span>
                          <span style={{ ...b, fontSize: '0.72rem', color: textDim }}>by {pool.created_by}</span>
                          <span style={{ ...b, fontSize: '0.72rem', color: textDim }}>
                            Created {new Date(pool.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {/* actions */}
                      <div className="admin-pool-card-actions">
                        <button
                          onClick={() => handleShare(pool.id, pool.name)}
                          title="Share pool link"
                          style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.45rem 0.7rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer', flexShrink: 0 }}
                        >
                          <Share2 style={{ width: 12, height: 12 }} /> Share
                        </button>
                        <button
                          onClick={() => router.push(`/admin/pool/${pool.id}`)}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.875rem', background: green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer', flexShrink: 0 }}
                        >
                          Manage Pool <ChevronRight style={{ width: 13, height: 13 }} />
                        </button>
                      </div>

                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      <Footer pageName="Pool Management" />

      <CreatePoolDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onPoolCreated={async () => {
          await loadPools();
          toast({ title: 'Pool Created', description: 'New pool is now visible in the list.' });
        }}
      />
    </div>
  );
}

export default function AdminPoolsPage() {
  return (
    <AuthProvider>
      <AdminGuard>
        <AdminPoolsContent />
      </AdminGuard>
    </AuthProvider>
  );
}
