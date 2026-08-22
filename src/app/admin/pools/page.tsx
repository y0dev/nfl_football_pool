'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  Trophy, Users, Plus, RefreshCw, Search,
  ChevronLeft, ChevronRight, ShieldCheck, ShieldOff, Share2, ArrowLeftRight, Copy, AlertTriangle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { AuthProvider } from '@/lib/auth';
import { AdminGuard } from '@/components/auth/admin-guard';
import { CreatePoolDialog } from '@/components/pools/create-pool-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Footer } from '@/components/layout/Footer';
import { AppNav } from '@/components/layout/AppNav';
import { POOL_TYPES } from '@/lib/poolTypes';
import { isSuspiciousFutureSeason } from '@/lib/utils';

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

const PAGE_SIZE = 5;

type StatusFilter = 'all' | 'active' | 'inactive';

interface Pool {
  id: string;
  name: string;
  is_active: boolean;
  season: number;
  created_by: string;
  created_at: string;
  competition_type: string;
  huddle_id: string | null;
  huddles: { name: string } | null;
  participants: { count: number }[];
  cloneEligible?: boolean;
  cloneIneligibleReason?: string;
}

function AdminPoolsContent() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [pools, setPools]               = useState<Pool[]>([]);
  const [isLoading, setIsLoading]       = useState(true);
  const [, setIsLoggingOut] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm]     = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [createOpen, setCreateOpen]     = useState(false);
  const [currentWeek, setCurrentWeek]   = useState(1);
  const [seasonType, setSeasonType]     = useState(2);
  const [transferPool, setTransferPool] = useState<Pool | null>(null);
  const [transferEmail, setTransferEmail] = useState('');
  const [transferRemoveFromSource, setTransferRemoveFromSource] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [page, setPage] = useState(0);
  const [cloningPoolId, setCloningPoolId] = useState<string | null>(null);

  const loadPools = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/all-pools', {
        headers: { 'x-admin-email': user?.email ?? '' },
      });
      const data = await res.json();
      if (data.success) setPools(data.pools || []);
      else toast({ title: 'Error', description: 'Failed to load pools', variant: 'destructive' });
    } catch {
      toast({ title: 'Error', description: 'Failed to load pools', variant: 'destructive' });
    }
  }, [user, toast]);

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
    // Intentionally mount-only ([]): loadPools is stable (useCallback) but
    // depends on `user`, which resolves asynchronously after mount — including
    // it here would re-run this init flow (and its season-games fetch) every
    // time `user` identity changes instead of once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    } catch (err) {
      if (!(err instanceof Error) || err.name !== 'AbortError') {
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

  const closeTransferDialog = () => {
    setTransferPool(null);
    setTransferEmail('');
    setTransferRemoveFromSource(false);
  };

  const handleTransfer = async () => {
    if (!transferPool || !transferEmail.trim()) return;
    setIsTransferring(true);
    try {
      const res = await fetch('/api/admin/transfer-pool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-email': user?.email ?? '' },
        body: JSON.stringify({
          poolId: transferPool.id,
          newCommissionerEmail: transferEmail.trim(),
          removeFromSourceRoster: transferRemoveFromSource,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        toast({ title: 'Transfer Failed', description: data.error ?? 'Failed to transfer pool', variant: 'destructive' });
        return;
      }
      const cleanupNote = transferRemoveFromSource
        ? ` Removed ${data.pool.removedFromSourceRoster} participant(s) from the source League's roster.`
        : '';
      toast({
        title: 'Pool Transferred',
        description: `"${data.pool.name}" moved to ${data.pool.newOwner}.${cleanupNote}`,
      });
      closeTransferDialog();
      await loadPools();
    } catch {
      toast({ title: 'Error', description: 'Failed to transfer pool', variant: 'destructive' });
    } finally {
      setIsTransferring(false);
    }
  };

  const handleClonePool = async (pool: Pool) => {
    setCloningPoolId(pool.id);
    try {
      const res = await fetch('/api/admin/clone-pool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-email': user?.email ?? '' },
        body: JSON.stringify({ poolId: pool.id }),
      });
      const data = await res.json();
      if (!data.success) {
        toast({ title: 'Clone Failed', description: data.error ?? 'Failed to clone pool', variant: 'destructive' });
        return;
      }
      toast({
        title: 'Pool Cloned',
        description: `"${data.poolName}" created with ${data.participantsCloned} participant${data.participantsCloned === 1 ? '' : 's'}.`,
      });
      await loadPools();
    } catch {
      toast({ title: 'Error', description: 'Failed to clone pool', variant: 'destructive' });
    } finally {
      setCloningPoolId(null);
    }
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

  useEffect(() => { setPage(0); }, [searchTerm, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const groupedByLeague = useMemo(() => {
    const groups = new Map<string, { leagueName: string; huddleId: string | null; pools: Pool[] }>();
    for (const pool of paginated) {
      const key = pool.huddle_id ?? 'none';
      const leagueName = pool.huddles?.name ?? 'No League';
      if (!groups.has(key)) groups.set(key, { leagueName, huddleId: pool.huddle_id, pools: [] });
      groups.get(key)!.pools.push(pool);
    }
    return [...groups.values()].sort((a, b2) => a.leagueName.localeCompare(b2.leagueName));
  }, [paginated]);

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
      <AppNav
        isAuthenticated
        isSuperAdmin
        onSignOut={handleLogout}
        rightSlot={
          <>
            <button onClick={handleRefresh} disabled={isRefreshing} title="Refresh" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.65rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 6, ...bc, fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: isRefreshing ? 'not-allowed' : 'pointer', opacity: isRefreshing ? 0.6 : 1 }}>
              <RefreshCw style={{ width: 12, height: 12 }} className={isRefreshing ? 'animate-spin' : ''} />
              <span className="pools-nav-label">Refresh</span>
            </button>
            <button onClick={() => setCreateOpen(true)} title="Create Pool" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.65rem', background: green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
              <Plus style={{ width: 12, height: 12 }} /><span className="pools-nav-label">Create Pool</span>
            </button>
          </>
        }
      />

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

          {filtered.length > 0 && (
            <p style={{ ...b, fontSize: '0.75rem', color: textDim, marginBottom: '1rem', marginTop: '-0.75rem' }}>
              Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
          )}

          {/* pool cards, grouped by League */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', background: surface, border: `1px solid ${border}`, borderRadius: 8 }}>
                <Trophy style={{ width: 40, height: 40, color: textDim, margin: '0 auto 1rem' }} />
                <p style={{ ...b, color: textDim, fontSize: '0.9rem' }}>
                  {searchTerm || statusFilter !== 'all' ? 'No pools match your filters.' : 'No pools created yet.'}
                </p>
              </div>
            ) : (
              groupedByLeague.map(group => (
                <div key={group.leagueName} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <p style={{ ...bc, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.1em', color: gold, textTransform: 'uppercase', wordBreak: 'break-word' }}>
                      {group.leagueName} ({group.pools.length})
                    </p>
                    {group.huddleId && (
                      <button
                        onClick={() => router.push(`/admin/league/${group.huddleId}`)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.15rem 0.5rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 4, ...bc, fontWeight: 700, fontSize: '0.6rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}
                      >
                        View League <ChevronRight style={{ width: 10, height: 10 }} />
                      </button>
                    )}
                  </div>
                  {group.pools.map(pool => {
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
                              <span style={{ display: 'inline-flex', alignItems: 'center', ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.1em', color: textDim, background: 'oklch(26% 0.03 255 / 0.6)', padding: '0.15rem 0.4rem', borderRadius: 4, textTransform: 'uppercase' }}>
                                {POOL_TYPES.find(t => t.id === pool.competition_type)?.label ?? pool.competition_type}
                              </span>
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
                              {isSuspiciousFutureSeason(pool.season) ? (
                                <span title="More than 1 year ahead of the current season — likely test data" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', ...b, fontSize: '0.78rem', color: liveRed }}>
                                  <AlertTriangle style={{ width: 11, height: 11, flexShrink: 0 }} />
                                  {pool.season} Season
                                </span>
                              ) : (
                                <span style={{ ...b, fontSize: '0.78rem', color: textDim }}>{pool.season} Season</span>
                              )}
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
                              onClick={() => setTransferPool(pool)}
                              title="Transfer this pool to another commissioner"
                              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.45rem 0.7rem', background: 'transparent', color: gold, border: `1px solid color-mix(in oklch, ${gold} 40%, ${border})`, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer', flexShrink: 0 }}
                            >
                              <ArrowLeftRight style={{ width: 12, height: 12 }} /> Transfer
                            </button>
                            <button
                              onClick={() => handleClonePool(pool)}
                              disabled={!pool.cloneEligible || cloningPoolId === pool.id}
                              title={pool.cloneEligible ? "Clone this pool's settings and participants into a new pool for the same owner" : (pool.cloneIneligibleReason ?? 'Not eligible to clone')}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.45rem 0.7rem',
                                background: 'transparent',
                                color: pool.cloneEligible ? textMid : textDim,
                                border: `1px solid ${border}`, borderRadius: 6,
                                ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase',
                                cursor: (!pool.cloneEligible || cloningPoolId === pool.id) ? 'not-allowed' : 'pointer',
                                opacity: (!pool.cloneEligible || cloningPoolId === pool.id) ? 0.5 : 1,
                                flexShrink: 0,
                              }}
                            >
                              <Copy style={{ width: 12, height: 12 }} />
                              {cloningPoolId === pool.id ? 'Cloning…' : 'Clone'}
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
                  })}
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                style={{ display: 'flex', alignItems: 'center', padding: '0.4rem 0.6rem', background: 'transparent', border: `1px solid ${border}`, borderRadius: 5, color: page === 0 ? textDim : textMid, cursor: page === 0 ? 'not-allowed' : 'pointer', opacity: page === 0 ? 0.4 : 1 }}
              >
                <ChevronLeft style={{ width: 14, height: 14 }} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  style={{ minWidth: '2rem', padding: '0.4rem 0.5rem', background: page === i ? green : 'transparent', border: `1px solid ${page === i ? green : border}`, borderRadius: 5, color: page === i ? text : textMid, cursor: 'pointer', ...bc, fontWeight: 700, fontSize: '0.75rem' }}
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                style={{ display: 'flex', alignItems: 'center', padding: '0.4rem 0.6rem', background: 'transparent', border: `1px solid ${border}`, borderRadius: 5, color: page === totalPages - 1 ? textDim : textMid, cursor: page === totalPages - 1 ? 'not-allowed' : 'pointer', opacity: page === totalPages - 1 ? 0.4 : 1 }}
              >
                <ChevronRight style={{ width: 14, height: 14 }} />
              </button>
            </div>
          )}
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

      <Dialog open={!!transferPool} onOpenChange={(open) => { if (!open) closeTransferDialog(); }}>
        <DialogContent style={{ maxWidth: '28rem', background: card, border: `1px solid ${border}` }}>
          <DialogHeader>
            <DialogTitle style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: gold, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Transfer Pool
            </DialogTitle>
            <DialogDescription style={{ ...b, fontSize: '0.8rem', color: textDim }}>
              Move &quot;{transferPool?.name}&quot; — and its participants — to a different commissioner&apos;s League. Immediate, no approval needed.
            </DialogDescription>
          </DialogHeader>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: '0.5rem 0' }}>
            <div>
              <label style={{ ...bc, fontSize: '0.65rem', fontWeight: 700, color: textDim, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.35rem' }}>
                Destination Commissioner Email
              </label>
              <input
                autoFocus
                placeholder="commissioner@example.com"
                value={transferEmail}
                onChange={e => setTransferEmail(e.target.value)}
                style={{ ...b, background: surface, border: `1px solid ${border}`, color: text, padding: '0.5rem 0.75rem', width: '100%', borderRadius: 6, boxSizing: 'border-box', fontSize: '0.875rem' }}
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer' }}>
              <Checkbox
                checked={transferRemoveFromSource}
                onCheckedChange={(v) => setTransferRemoveFromSource(v === true)}
                style={{ marginTop: '0.15rem' }}
              />
              <span style={{ ...b, fontSize: '0.8rem', color: textMid, lineHeight: 1.5 }}>
                Also remove these participants from the source commissioner&apos;s League roster — only removes someone if they&apos;re not still in another pool there.
              </span>
            </label>
          </div>

          <DialogFooter style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={closeTransferDialog}
              style={{ ...bc, padding: '0.45rem 0.85rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 6, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleTransfer}
              disabled={isTransferring || !transferEmail.trim()}
              style={{ ...bc, display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.85rem', background: (isTransferring || !transferEmail.trim()) ? surface : gold, color: (isTransferring || !transferEmail.trim()) ? textDim : 'oklch(13% 0.025 255)', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: (isTransferring || !transferEmail.trim()) ? 'not-allowed' : 'pointer' }}
            >
              <ArrowLeftRight style={{ width: 12, height: 12 }} />
              {isTransferring ? 'Transferring…' : 'Transfer Pool'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminPoolsPage() {
  return (
    <AuthProvider>
      <AdminGuard requireSuperAdmin>
        <AdminPoolsContent />
      </AdminGuard>
    </AuthProvider>
  );
}
