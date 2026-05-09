'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ArrowLeft,
  Search,
  Plus,
  Trophy,
  Eye,
  Settings,
  Mail,
  BarChart3,
  Share2,
  Copy,
  Check,
  LogOut,
  RefreshCw,
  Users,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { adminService, Pool, Participant } from '@/lib/admin-service';
import { debugLog, createPageUrl, getMaxWeeksForSeason, MAX_WEEKS_POSTSEASON, MAX_WEEKS_PRESEASON, MAX_WEEKS_REGULAR_SEASON } from '@/lib/utils';
import { AuthProvider } from '@/lib/auth';
import { SharedAdminGuard } from '@/components/auth/shared-admin-guard';
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
const amber   = 'oklch(72% 0.16 60)';
const purple  = 'oklch(65% 0.12 290)';

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

interface PoolWithParticipants extends Pool {
  participantCount: number;
  activeParticipantCount: number;
  lastActivity?: string;
}

function PoolsManagementContent() {
  const { user, signOut, verifyAdminStatus } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [pools, setPools] = useState<PoolWithParticipants[]>([]);
  const [filteredPools, setFilteredPools] = useState<PoolWithParticipants[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [overridePool, setOverridePool] = useState<PoolWithParticipants | null>(null);
  const [overrideType, setOverrideType] = useState<'week' | 'quarter'>('week');
  const [overrideWeek, setOverrideWeek] = useState<string>('');
  const [overrideQuarter, setOverrideQuarter] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4' | 'Playoffs'>('Q1');
  const [overrideSeason, setOverrideSeason] = useState<string>('');
  const [overrideSeasonType, setOverrideSeasonType] = useState<'Preseason' | 'Regular' | 'Postseason'>('Regular');
  const [overrideParticipantId, setOverrideParticipantId] = useState<string>('');
  const [overrideParticipantName, setOverrideParticipantName] = useState<string>('');
  const [overridePoints, setOverridePoints] = useState<string>('');
  const [overrideCorrect, setOverrideCorrect] = useState<string>('');
  const [isSubmittingOverride, setIsSubmittingOverride] = useState(false);
  const [overrideParticipants, setOverrideParticipants] = useState<Array<{ id: string; name: string }>>([]);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedPoolForShare, setSelectedPoolForShare] = useState<PoolWithParticipants | null>(null);
  const [shareLink, setShareLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [createPoolDialogOpen, setCreatePoolDialogOpen] = useState(false);
  const [transferPoolDialogOpen, setTransferPoolDialogOpen] = useState(false);
  const [selectedPoolForTransfer, setSelectedPoolForTransfer] = useState<PoolWithParticipants | null>(null);
  const [newCommissionerEmail, setNewCommissionerEmail] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [stats, setStats] = useState({
    totalPools: 0,
    activePools: 0,
    totalParticipants: 0,
    totalGames: 0
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        if (user) {
          debugLog('Checking admin status for user:', user.email);
          const superAdminStatus = await verifyAdminStatus(true);
          setIsSuperAdmin(superAdminStatus);
          debugLog('Super admin status:', superAdminStatus);
          await loadPools(superAdminStatus);
          await loadStats(superAdminStatus);
          await loadCurrentWeek();
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [user, verifyAdminStatus, router]);

  useEffect(() => {
    const handleOpenCreatePool = () => setCreatePoolDialogOpen(true);
    document.addEventListener('openCreatePoolDialog', handleOpenCreatePool);
    return () => document.removeEventListener('openCreatePoolDialog', handleOpenCreatePool);
  }, []);

  const loadPools = async (superAdminStatus: boolean) => {
    try {
      if (!user?.email) return;
      const { getSupabaseServiceClient } = await import('@/lib/supabase');
      const supabase = getSupabaseServiceClient();
      let poolsQuery = supabase.from('pools').select('*').order('created_at', { ascending: false });
      if (!superAdminStatus) poolsQuery = poolsQuery.eq('created_by', user.email);
      const { data: poolsData, error: poolsError } = await poolsQuery;
      if (poolsError) throw poolsError;
      const poolsWithParticipants: PoolWithParticipants[] = await Promise.all(
        (poolsData || []).map(async (pool) => {
          const { data: participants, error: participantsError } = await supabase
            .from('participants').select('id, is_active, created_at')
            .eq('pool_id', pool.id).eq('is_active', true);
          if (participantsError) throw participantsError;
          const participantCount = participants?.length || 0;
          const activeParticipantCount = participantCount;
          const lastActivity = participants && participants.length > 0
            ? Math.max(...participants.map(p => new Date(p.created_at).getTime()), new Date(pool.created_at).getTime())
            : new Date(pool.created_at).getTime();
          return { ...pool, participantCount, activeParticipantCount, lastActivity: new Date(lastActivity).toLocaleDateString() };
        })
      );
      setPools(poolsWithParticipants);
      setFilteredPools(poolsWithParticipants);
      if (process.env.NODE_ENV === 'development') {
        console.log('Pools loaded:', {
          userRole: superAdminStatus ? 'admin' : 'commissioner',
          userEmail: user.email,
          totalPools: poolsWithParticipants.length,
          poolsData: poolsWithParticipants.map(p => ({ id: p.id, name: p.name, created_by: p.created_by, participantCount: p.participantCount, activeParticipantCount: p.activeParticipantCount }))
        });
      }
    } catch (error) {
      console.error('Error loading pools:', error);
      toast({ title: 'Error', description: 'Failed to load pools data', variant: 'destructive' });
    }
  };

  const loadCurrentWeek = async () => {
    try {
      const { getUpcomingWeek } = await import('@/actions/loadCurrentWeek');
      const weekData = await getUpcomingWeek();
      setCurrentWeek(weekData?.week || 1);
    } catch (error) {
      console.error('Error loading current week:', error);
    }
  };

  const handlePoolCreated = async () => {
    await loadPools(isSuperAdmin);
    await loadStats(isSuperAdmin);
    toast({ title: 'Pool Created', description: 'New pool has been created successfully' });
  };

  const loadStats = async (superAdminStatus: boolean) => {
    try {
      if (!user?.email) return;
      const { getSupabaseServiceClient } = await import('@/lib/supabase');
      const supabase = getSupabaseServiceClient();
      let poolsQuery = supabase.from('pools').select('*', { count: 'exact', head: true });
      let activePoolsQuery = supabase.from('pools').select('*', { count: 'exact', head: true }).eq('is_active', true);
      if (!superAdminStatus) {
        poolsQuery = poolsQuery.eq('created_by', user.email);
        activePoolsQuery = activePoolsQuery.eq('created_by', user.email);
      }
      const { count: totalPools } = await poolsQuery;
      const { count: activePools } = await activePoolsQuery;
      let participantsQuery = supabase.from('participants').select('*', { count: 'exact', head: true }).eq('is_active', true);
      if (!superAdminStatus) {
        const { data: userPools } = await supabase.from('pools').select('id').eq('created_by', user.email);
        if (userPools && userPools.length > 0) {
          participantsQuery = participantsQuery.in('pool_id', userPools.map(p => p.id));
        } else {
          setStats({ totalPools: totalPools || 0, activePools: activePools || 0, totalParticipants: 0, totalGames: 0 });
          return;
        }
      }
      const { count: totalParticipants } = await participantsQuery;
      const { count: totalGames } = await supabase.from('games').select('*', { count: 'exact', head: true });
      setStats({ totalPools: totalPools || 0, activePools: activePools || 0, totalParticipants: totalParticipants || 0, totalGames: totalGames || 0 });
      if (process.env.NODE_ENV === 'development') {
        console.log('Stats loaded:', { userRole: superAdminStatus ? 'admin' : 'commissioner', userEmail: user.email, totalPools, activePools, totalParticipants, totalGames });
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    if (!term.trim()) {
      setFilteredPools(pools);
    } else {
      setFilteredPools(pools.filter(pool =>
        pool.name.toLowerCase().includes(term.toLowerCase()) ||
        pool.created_by.toLowerCase().includes(term.toLowerCase()) ||
        pool.id.toLowerCase().includes(term.toLowerCase())
      ));
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const { getSupabaseClient } = await import('@/lib/supabase');
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
      await signOut();
      router.push(createPageUrl('adminlogin'));
    } catch (error) {
      console.error('Error logging out:', error);
      setIsLoggingOut(false);
    }
  };

  const handleViewPool = (poolId: string) => router.push(createPageUrl(`adminpool?poolId=${poolId}`));
  const handleViewLeaderboard = (poolId: string) => router.push(createPageUrl(`leaderboard?pool=${poolId}`));

  const handleSendInvite = (pool: PoolWithParticipants) => {
    setSelectedPoolForShare(pool);
    const baseUrl = window.location.origin;
    setShareLink(`${baseUrl}/invite?pool=${pool.id}&week=${currentWeek}`);
    setShareModalOpen(true);
    setCopied(false);
  };

  const handleSharePool = (pool: PoolWithParticipants) => {
    router.push(`/pool/${pool.id}/picks?week=${currentWeek}&seasonType=2`);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: 'Link Copied!', description: 'Pool invitation link copied to clipboard' });
    } catch (error) {
      console.error('Failed to copy link:', error);
      toast({ title: 'Copy Failed', description: 'Failed to copy link to clipboard', variant: 'destructive' });
    }
  };

  const handleTransferPool = async () => {
    if (!selectedPoolForTransfer || !newCommissionerEmail.trim()) {
      toast({ title: 'Error', description: 'Please select a pool and enter the new commissioner email', variant: 'destructive' });
      return;
    }
    setIsTransferring(true);
    try {
      const { getSupabaseClient } = await import('@/lib/supabase');
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('No active session');
      const response = await fetch('/api/admin/transfer-pool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ poolId: selectedPoolForTransfer.id, newCommissionerEmail: newCommissionerEmail.trim() }),
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Pool Transferred', description: result.message });
        setTransferPoolDialogOpen(false);
        setSelectedPoolForTransfer(null);
        setNewCommissionerEmail('');
        await loadPools(isSuperAdmin);
        await loadStats(isSuperAdmin);
      } else {
        throw new Error(result.error || 'Failed to transfer pool');
      }
    } catch (error) {
      console.error('Transfer pool error:', error);
      toast({ title: 'Error', description: 'Failed to transfer pool. Please try again.', variant: 'destructive' });
    } finally {
      setIsTransferring(false);
    }
  };

  // Reusable inline button styles
  const btnBase = (variant: 'primary' | 'outline' | 'ghost' = 'outline') => ({
    display: 'flex', alignItems: 'center', gap: '0.3rem',
    padding: '0.35rem 0.65rem',
    background: variant === 'primary' ? green : 'transparent',
    color: variant === 'primary' ? text : textMid,
    border: `1px solid ${variant === 'primary' ? green : border}`,
    borderRadius: 5,
    ...bc, fontWeight: 700, fontSize: '0.68rem',
    letterSpacing: '0.07em', textTransform: 'uppercase' as const,
    cursor: 'pointer', whiteSpace: 'nowrap' as const,
  });

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw style={{ width: 32, height: 32, color: textDim, margin: '0 auto 0.75rem', animation: 'spin 1s linear infinite' }} />
          <p style={{ ...b, color: textMid, fontSize: '0.9rem' }}>Loading pools…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: bg, minHeight: '100vh' }}>

      {/* NAV */}
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
                onClick={() => router.push(createPageUrl('admindashboard'))}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.6rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
              >
                <ArrowLeft style={{ width: 12, height: 12 }} /> Back
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: green, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trophy style={{ width: 14, height: 14, color: text }} />
                </div>
                <span style={{ ...bc, fontWeight: 800, fontSize: '0.92rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase' }}>Sunday Huddle</span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.7rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
            >
              <LogOut style={{ width: 11, height: 11 }} /> {isLoggingOut ? 'Signing Out…' : 'Sign Out'}
            </button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{
        background: bg,
        backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 59px, oklch(100% 0 0 / 0.022) 59px, oklch(100% 0 0 / 0.022) 60px)`,
        padding: 'clamp(2rem, 4vw, 3rem) 0',
      }}>
        <div className="lp-inner">
          <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.26em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ display: 'inline-block', width: 18, height: 2, background: greenHi, borderRadius: 1 }} />
            Pool Management
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ ...bc, fontWeight: 900, fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', lineHeight: 0.95, color: text, textTransform: 'uppercase', marginBottom: '0.6rem' }}>
                {isSuperAdmin ? 'All' : 'My'} NFL<br />
                <span style={{ color: gold }}>Confidence Pools</span>
              </h1>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.75rem' }}>
                <span style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.08em', padding: '0.15rem 0.5rem', borderRadius: 4, textTransform: 'uppercase', background: 'oklch(26% 0.03 255)', color: textMid, border: `1px solid ${border}` }}>
                  {isSuperAdmin ? 'System Admin' : 'Commissioner'}
                </span>
              </div>
              <p style={{ ...b, fontSize: '0.875rem', color: textMid, marginTop: '0.5rem' }}>
                {isSuperAdmin ? 'Manage all Confidence Pools in the system' : 'Manage your Confidence Pools'}
              </p>
            </div>
            <button
              onClick={() => { const event = new CustomEvent('openCreatePoolDialog'); document.dispatchEvent(event); }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.1rem', background: green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
            >
              <Plus style={{ width: 14, height: 14 }} />
              Create Pool
            </button>
          </div>
        </div>
      </section>

      {/* green rule */}
      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${green}, transparent)` }} />

      {/* MAIN CONTENT */}
      <section style={{ background: bg, padding: '2rem 0' }}>
        <div className="lp-inner">

          {/* Stats grid */}
          <div className="admin-actions-grid" style={{ marginBottom: '1.5rem' }}>
            {[
              { label: 'Total Pools', value: stats.totalPools, sub: `${stats.activePools} active` },
              { label: 'Total Participants', value: stats.totalParticipants, sub: 'Across all pools' },
              { label: 'Total Games', value: stats.totalGames, sub: 'Available for pools' },
              { label: 'Average Size', value: stats.totalPools > 0 ? Math.round(stats.totalParticipants / stats.totalPools) : 0, sub: 'Participants per pool' },
            ].map(({ label, value, sub }) => (
              <div key={label} style={{ background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '1.1rem 1.25rem' }}>
                <p style={{ ...bc, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase', marginBottom: '0.4rem' }}>{label}</p>
                <p style={{ ...bc, fontWeight: 900, fontSize: '2rem', color: greenHi, lineHeight: 1.1 }}>{value}</p>
                <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.25rem' }}>{sub}</p>
              </div>
            ))}
          </div>

          {/* Search */}
          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <Search style={{ width: 16, height: 16, color: greenHi }} />
              <span style={{ ...bc, fontWeight: 800, fontSize: '0.85rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase' }}>Search Pools</span>
            </div>
            <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginBottom: '0.75rem' }}>Find pools by name, creator, or pool ID</p>
            <div style={{ position: 'relative', maxWidth: 420 }}>
              <Search style={{ width: 14, height: 14, color: textDim, position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search pools..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                style={{
                  width: '100%', paddingLeft: '2.25rem', paddingRight: '1rem',
                  paddingTop: '0.5rem', paddingBottom: '0.5rem',
                  background: surface, border: `1px solid ${border}`, borderRadius: 6,
                  ...b, fontSize: '0.85rem', color: text, outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Pools list */}
          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem', borderBottom: `1px solid ${border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <Trophy style={{ width: 16, height: 16, color: gold }} />
                <span style={{ ...bc, fontWeight: 800, fontSize: '0.85rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase' }}>
                  {isSuperAdmin ? 'All Pools' : 'My Pools'} ({filteredPools.length})
                </span>
              </div>
              <p style={{ ...b, fontSize: '0.78rem', color: textDim }}>
                {isSuperAdmin ? 'Manage all pools, view participants, and monitor activity' : 'Manage your pools, view participants, and monitor activity'}
              </p>
            </div>

            {filteredPools.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                <Trophy style={{ width: 40, height: 40, color: textDim, margin: '0 auto 0.75rem' }} />
                <p style={{ ...b, fontSize: '0.875rem', color: textMid }}>
                  {searchTerm ? 'No pools found matching your search.' : 'No pools created yet.'}
                </p>
              </div>
            ) : (
              <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {filteredPools.map((pool) => (
                  <div key={pool.id} style={{ background: surface, border: `1px solid ${border}`, borderRadius: 8, padding: '1rem', transition: 'border-color 0.15s' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>

                      {/* Pool info */}
                      <div style={{ display: 'flex', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: green, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Trophy style={{ width: 16, height: 16, color: text }} />
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <h3 style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '0.2rem' }}>
                            {pool.name}
                          </h3>
                          <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginBottom: '0.4rem' }}>Created by: {pool.created_by}</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                            <span style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.08em', padding: '0.12rem 0.4rem', borderRadius: 4, textTransform: 'uppercase', background: pool.is_active ? 'oklch(46% 0.14 155 / 0.2)' : 'oklch(26% 0.03 255)', color: pool.is_active ? greenHi : textDim, border: `1px solid ${pool.is_active ? 'oklch(46% 0.14 155 / 0.4)' : border}` }}>
                              {pool.is_active ? 'Active' : 'Inactive'}
                            </span>
                            <span style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.08em', padding: '0.12rem 0.4rem', borderRadius: 4, textTransform: 'uppercase', background: 'oklch(26% 0.03 255)', color: textMid, border: `1px solid ${border}` }}>
                              Season {pool.season}
                            </span>
                            <span style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.08em', padding: '0.12rem 0.4rem', borderRadius: 4, textTransform: 'uppercase', background: 'oklch(26% 0.03 255)', color: textMid, border: `1px solid ${border}` }}>
                              {pool.participantCount} participants
                            </span>
                            {pool.tie_breaker_method && (
                              <span style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.08em', padding: '0.12rem 0.4rem', borderRadius: 4, textTransform: 'uppercase', background: 'oklch(26% 0.03 255)', color: textMid, border: `1px solid ${border}` }}>
                                TB: {pool.tie_breaker_method}
                              </span>
                            )}
                          </div>
                          <p style={{ ...b, fontSize: '0.7rem', color: textDim, marginTop: '0.35rem' }}>
                            Created: {new Date(pool.created_at).toLocaleDateString()} | Last Activity: {pool.lastActivity}
                          </p>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        <button onClick={() => handleViewPool(pool.id)} style={btnBase()}>
                          <Eye style={{ width: 11, height: 11 }} /> View
                        </button>
                        <button onClick={() => handleViewLeaderboard(pool.id)} style={btnBase()}>
                          <BarChart3 style={{ width: 11, height: 11 }} /> Leaderboard
                        </button>
                        {(isSuperAdmin || pool.created_by === user?.email) && (
                          <button
                            onClick={() => {
                              setOverridePool(pool);
                              setOverrideSeason(String(pool.season));
                              setOverrideWeek(String(currentWeek));
                              setOverrideSeasonType('Regular');
                              (async () => {
                                try {
                                  const { getSupabaseServiceClient } = await import('@/lib/supabase');
                                  const supabase = getSupabaseServiceClient();
                                  const { data: participants } = await supabase
                                    .from('participants').select('id, name')
                                    .eq('pool_id', pool.id).eq('is_active', true).order('name', { ascending: true });
                                  setOverrideParticipants((participants || []).map(p => ({ id: p.id, name: p.name || 'Unknown' })));
                                } catch (e) {
                                  console.error('Failed to load participants for override', e);
                                  setOverrideParticipants([]);
                                } finally {
                                  setOverrideDialogOpen(true);
                                }
                              })();
                            }}
                            style={{ ...btnBase(), color: amber, borderColor: `${amber}60` }}
                          >
                            <Trophy style={{ width: 11, height: 11 }} /> Override Winner
                          </button>
                        )}
                        <button onClick={() => handleSharePool(pool)} style={btnBase()}>
                          <Share2 style={{ width: 11, height: 11 }} /> Share
                        </button>
                        <button onClick={() => handleSendInvite(pool)} style={btnBase()}>
                          <Mail style={{ width: 11, height: 11 }} /> Invite
                        </button>
                        <button onClick={() => router.push(`/admin/pool/${pool.id}`)} style={{ ...btnBase(), color: greenHi, borderColor: `${green}80` }}>
                          <Settings style={{ width: 11, height: 11 }} /> Admin
                        </button>
                        {isSuperAdmin && (
                          <button
                            onClick={() => { setSelectedPoolForTransfer(pool); setTransferPoolDialogOpen(true); }}
                            style={btnBase()}
                          >
                            <Settings style={{ width: 11, height: 11 }} /> Transfer
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </section>

      {/* FOOTER */}
      <Footer pageName="Pools" />

      {/* Pool Invitation Modal */}
      <Dialog open={shareModalOpen} onOpenChange={setShareModalOpen}>
        <DialogContent style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, color: text }}>
          <DialogHeader>
            <DialogTitle style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Mail style={{ width: 16, height: 16, color: greenHi }} />
              Pool Invitation
            </DialogTitle>
            <DialogDescription style={{ ...b, fontSize: '0.82rem', color: textDim }}>
              Invite participants to join this pool for Week {currentWeek}
            </DialogDescription>
          </DialogHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ ...bc, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.07em', color: textDim, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>Pool Invitation Link</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  value={shareLink}
                  readOnly
                  style={{ flex: 1, padding: '0.5rem 0.75rem', background: surface, border: `1px solid ${border}`, borderRadius: 6, ...b, fontSize: '0.82rem', color: textMid, outline: 'none' }}
                  placeholder="Generating link..."
                />
                <button
                  onClick={handleCopyLink}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 0.85rem', background: copied ? green : 'transparent', color: copied ? text : textMid, border: `1px solid ${copied ? green : border}`, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
                >
                  {copied ? <><Check style={{ width: 12, height: 12 }} /> Copied!</> : <><Copy style={{ width: 12, height: 12 }} /> Copy</>}
                </button>
              </div>
            </div>
            {selectedPoolForShare && (
              <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 8, padding: '0.75rem' }}>
                <h4 style={{ ...bc, fontWeight: 800, fontSize: '0.78rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Pool Details</h4>
                <div style={{ ...b, fontSize: '0.82rem', color: textMid, display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  <p><strong style={{ color: text }}>Name:</strong> {selectedPoolForShare.name}</p>
                  <p><strong style={{ color: text }}>Season:</strong> {selectedPoolForShare.season}</p>
                  <p><strong style={{ color: text }}>Week:</strong> {currentWeek}</p>
                  <p><strong style={{ color: text }}>Participants:</strong> {selectedPoolForShare.participantCount || 0}</p>
                </div>
              </div>
            )}
            <div style={{ ...b, fontSize: '0.75rem', color: textDim, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <p>• This link will take participants to the pool selection page for Week {currentWeek}</p>
              <p>• Participants can join the pool and submit their picks</p>
              <p>• The link includes the current week for easy access</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Override Winner Dialog */}
      <Dialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
        <DialogContent style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, color: text }}>
          <DialogHeader>
            <DialogTitle style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Trophy style={{ width: 16, height: 16, color: gold }} />
              {overrideType === 'week' ? 'Override Weekly Winner' : 'Override Quarter Winner'}
            </DialogTitle>
            <DialogDescription style={{ ...b, fontSize: '0.82rem', color: textDim }}>
              Manually set the {overrideType === 'week' ? 'weekly' : 'quarter'} winner for a pool
            </DialogDescription>
          </DialogHeader>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Type toggle */}
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {(['week', 'quarter'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setOverrideType(t)}
                  style={{ padding: '0.35rem 0.75rem', background: overrideType === t ? green : 'transparent', color: overrideType === t ? text : textMid, border: `1px solid ${overrideType === t ? green : border}`, borderRadius: 5, ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
                >
                  {t === 'week' ? 'Weekly' : 'Quarter'}
                </button>
              ))}
            </div>

            {overridePool && (
              <div style={{ ...b, fontSize: '0.82rem', color: textMid }}>
                <div style={{ color: text, fontWeight: 600 }}>Pool: {overridePool.name}</div>
                <div>Season: {overrideSeason || overridePool.season}</div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {overrideType === 'week' ? (
                <>
                  <div>
                    <label style={{ ...bc, fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.07em', color: textDim, textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>Week</label>
                    <input type="number" value={overrideWeek} onChange={(e) => setOverrideWeek(e.target.value)} placeholder="e.g. 7" min={1} max={(overrideSeasonType === 'Preseason' ? MAX_WEEKS_PRESEASON : overrideSeasonType === 'Regular' ? MAX_WEEKS_REGULAR_SEASON : MAX_WEEKS_POSTSEASON)} style={{ width: '100%', padding: '0.5rem 0.75rem', background: surface, border: `1px solid ${border}`, borderRadius: 6, ...b, fontSize: '0.85rem', color: text, outline: 'none', boxSizing: 'border-box' as const }} />
                  </div>
                  <div>
                    <label style={{ ...bc, fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.07em', color: textDim, textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>Season Type</label>
                    <select value={overrideSeasonType} onChange={(e) => setOverrideSeasonType(e.target.value as any)} style={{ width: '100%', padding: '0.5rem 0.75rem', background: surface, border: `1px solid ${border}`, borderRadius: 6, ...b, fontSize: '0.85rem', color: text, outline: 'none' }}>
                      <option value="Preseason">Preseason</option>
                      <option value="Regular">Regular</option>
                      <option value="Postseason">Postseason</option>
                    </select>
                  </div>
                </>
              ) : (
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ ...bc, fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.07em', color: textDim, textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>Quarter</label>
                  <select value={overrideQuarter} onChange={(e) => setOverrideQuarter(e.target.value as any)} style={{ width: '100%', padding: '0.5rem 0.75rem', background: surface, border: `1px solid ${border}`, borderRadius: 6, ...b, fontSize: '0.85rem', color: text, outline: 'none' }}>
                    <option value="Q1">Q1 (Weeks 1-4)</option>
                    <option value="Q2">Q2 (Weeks 5-8)</option>
                    <option value="Q3">Q3 (Weeks 9-12)</option>
                    <option value="Q4">Q4 (Weeks 13-16)</option>
                    <option value="Playoffs">Playoffs</option>
                  </select>
                </div>
              )}

              <div>
                <label style={{ ...bc, fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.07em', color: textDim, textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>Season</label>
                <input value={overrideSeason} onChange={(e) => setOverrideSeason(e.target.value)} placeholder="e.g. 2025" style={{ width: '100%', padding: '0.5rem 0.75rem', background: surface, border: `1px solid ${border}`, borderRadius: 6, ...b, fontSize: '0.85rem', color: text, outline: 'none', boxSizing: 'border-box' as const }} />
              </div>
              <div>
                <label style={{ ...bc, fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.07em', color: textDim, textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>Winner Participant</label>
                <select value={overrideParticipantId} onChange={(e) => { const pid = e.target.value; setOverrideParticipantId(pid); const p = overrideParticipants.find(x => x.id === pid); setOverrideParticipantName(p?.name || ''); }} style={{ width: '100%', padding: '0.5rem 0.75rem', background: surface, border: `1px solid ${border}`, borderRadius: 6, ...b, fontSize: '0.85rem', color: text, outline: 'none' }}>
                  <option value="">Select participant…</option>
                  {overrideParticipants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ ...bc, fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.07em', color: textDim, textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>Winner Name</label>
                <input value={overrideParticipantName} onChange={(e) => setOverrideParticipantName(e.target.value)} placeholder="Full name" style={{ width: '100%', padding: '0.5rem 0.75rem', background: surface, border: `1px solid ${border}`, borderRadius: 6, ...b, fontSize: '0.85rem', color: text, outline: 'none', boxSizing: 'border-box' as const }} />
              </div>
              <div>
                <label style={{ ...bc, fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.07em', color: textDim, textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>Points (optional)</label>
                <input value={overridePoints} onChange={(e) => setOverridePoints(e.target.value)} placeholder="leave blank to use current" style={{ width: '100%', padding: '0.5rem 0.75rem', background: surface, border: `1px solid ${border}`, borderRadius: 6, ...b, fontSize: '0.85rem', color: text, outline: 'none', boxSizing: 'border-box' as const }} />
              </div>
              <div>
                <label style={{ ...bc, fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.07em', color: textDim, textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>Correct Picks (optional)</label>
                <input value={overrideCorrect} onChange={(e) => setOverrideCorrect(e.target.value)} placeholder="leave blank to use current" style={{ width: '100%', padding: '0.5rem 0.75rem', background: surface, border: `1px solid ${border}`, borderRadius: 6, ...b, fontSize: '0.85rem', color: text, outline: 'none', boxSizing: 'border-box' as const }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '0.5rem' }}>
              <button
                onClick={async () => {
                  if (!overridePool) return;
                  setIsSubmittingOverride(true);
                  try {
                    if (!overrideParticipantName.trim()) {
                      toast({ title: 'Missing fields', description: 'Winner name is required', variant: 'destructive' });
                      setIsSubmittingOverride(false);
                      return;
                    }
                    const { getSupabaseClient } = await import('@/lib/supabase');
                    const supabase = getSupabaseClient();
                    const { data: { session } } = await supabase.auth.getSession();
                    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                    if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
                    if (overrideType === 'week') {
                      const seasonTypeNum = overrideSeasonType === 'Preseason' ? 1 : overrideSeasonType === 'Regular' ? 2 : 3;
                      let pointsToUse = overridePoints.trim();
                      let correctToUse = overrideCorrect.trim();
                      if (!pointsToUse || !correctToUse) {
                        const lbRes = await fetch(`/api/leaderboard?poolId=${overridePool.id}&week=${Number(overrideWeek)}&seasonType=${seasonTypeNum}&season=${Number(overrideSeason || overridePool.season)}`);
                        if (lbRes.ok) {
                          const lb = await lbRes.json();
                          const entry = (lb.leaderboard || []).find((e: any) => e.participant_id === overrideParticipantId || e.participant_name === overrideParticipantName);
                          if (entry) {
                            if (!pointsToUse) pointsToUse = String(entry.total_points || 0);
                            if (!correctToUse) correctToUse = String(entry.correct_picks || 0);
                          }
                        }
                      }
                      const res = await fetch('/api/admin/week-winner', {
                        method: 'POST', headers,
                        body: JSON.stringify({ poolId: overridePool.id, week: Number(overrideWeek), season: Number(overrideSeason || overridePool.season), seasonType: seasonTypeNum, winnerParticipantId: overrideParticipantId || null, winnerName: overrideParticipantName.trim(), winnerPoints: Number(pointsToUse || 0), winnerCorrectPicks: Number(correctToUse || 0), totalParticipants: overridePool.participantCount || 0 })
                      });
                      if (!res.ok) throw new Error('Failed to save weekly winner');
                      toast({ title: 'Weekly winner saved', description: `Week ${overrideWeek} winner overridden.` });
                    } else {
                      let pointsToUse = overridePoints.trim();
                      let correctToUse = overrideCorrect.trim();
                      if (!pointsToUse || !correctToUse) {
                        const periodNameMap: Record<string, string> = { Q1: 'Period 1', Q2: 'Period 2', Q3: 'Period 3', Q4: 'Period 4', Playoffs: 'Playoffs' };
                        const plRes = await fetch(`/api/periods/leaderboard?poolId=${overridePool.id}&season=${Number(overrideSeason || overridePool.season)}&periodName=${encodeURIComponent(periodNameMap[overrideQuarter])}`);
                        if (plRes.ok) {
                          const data = await plRes.json();
                          const leaderboard = data?.data?.leaderboard || [];
                          const entry = leaderboard.find((e: any) => e.participant_id === overrideParticipantId || e.name === overrideParticipantName);
                          if (entry) {
                            if (!pointsToUse) pointsToUse = String(entry.total_points || 0);
                            if (!correctToUse) correctToUse = String(entry.total_correct || 0);
                          }
                        }
                      }
                      const res = await fetch('/api/admin/period-winner', {
                        method: 'POST', headers,
                        body: JSON.stringify({ poolId: overridePool.id, season: Number(overrideSeason || overridePool.season), periodName: overrideQuarter, winnerParticipantId: overrideParticipantId || null, winnerName: overrideParticipantName.trim(), periodPoints: Number(pointsToUse || 0), periodCorrectPicks: Number(correctToUse || 0), totalParticipants: overridePool.participantCount || 0 })
                      });
                      if (!res.ok) throw new Error('Failed to save period winner');
                      toast({ title: 'Quarter winner saved', description: `${overrideQuarter} winner overridden.` });
                    }
                    setOverrideDialogOpen(false);
                    setOverrideParticipantId('');
                    setOverrideParticipantName('');
                    setOverridePoints('');
                    setOverrideCorrect('');
                  } catch (e) {
                    console.error(e);
                    toast({ title: 'Save failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
                  } finally {
                    setIsSubmittingOverride(false);
                  }
                }}
                disabled={isSubmittingOverride}
                style={{ padding: '0.5rem 1rem', background: green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: isSubmittingOverride ? 'not-allowed' : 'pointer', opacity: isSubmittingOverride ? 0.6 : 1 }}
              >
                {isSubmittingOverride ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => setOverrideDialogOpen(false)}
                disabled={isSubmittingOverride}
                style={{ padding: '0.5rem 1rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Pool Dialog */}
      <CreatePoolDialog open={createPoolDialogOpen} onOpenChange={setCreatePoolDialogOpen} onPoolCreated={handlePoolCreated} />

      {/* Transfer Pool Dialog */}
      <Dialog open={transferPoolDialogOpen} onOpenChange={setTransferPoolDialogOpen}>
        <DialogContent style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, color: text }}>
          <DialogHeader>
            <DialogTitle style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Settings style={{ width: 16, height: 16, color: greenHi }} />
              Transfer Pool
            </DialogTitle>
            <DialogDescription style={{ ...b, fontSize: '0.82rem', color: textDim }}>
              Transfer pool ownership to another commissioner
            </DialogDescription>
          </DialogHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {selectedPoolForTransfer && (
              <div style={{ background: 'oklch(20% 0.05 255)', border: `1px solid oklch(35% 0.08 255)`, borderRadius: 8, padding: '0.75rem' }}>
                <h4 style={{ ...bc, fontWeight: 800, fontSize: '0.78rem', letterSpacing: '0.07em', color: purple, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Pool Details</h4>
                <div style={{ ...b, fontSize: '0.82rem', color: textMid, display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  <p><strong style={{ color: text }}>Name:</strong> {selectedPoolForTransfer.name}</p>
                  <p><strong style={{ color: text }}>Current Owner:</strong> {selectedPoolForTransfer.created_by}</p>
                  <p><strong style={{ color: text }}>Participants:</strong> {selectedPoolForTransfer.participantCount || 0}</p>
                </div>
              </div>
            )}
            <div>
              <label style={{ ...bc, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.07em', color: textDim, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>New Commissioner Email</label>
              <input
                type="email"
                value={newCommissionerEmail}
                onChange={(e) => setNewCommissionerEmail(e.target.value)}
                placeholder="commissioner@example.com"
                style={{ width: '100%', padding: '0.5rem 0.75rem', background: surface, border: `1px solid ${border}`, borderRadius: 6, ...b, fontSize: '0.85rem', color: text, outline: 'none', boxSizing: 'border-box' as const }}
              />
              <p style={{ ...b, fontSize: '0.75rem', color: textDim, marginTop: '0.4rem' }}>Enter the email address of the commissioner who will receive this pool</p>
            </div>
            <div style={{ background: `${amber}12`, border: `1px solid ${amber}30`, borderRadius: 8, padding: '0.75rem' }}>
              <h4 style={{ ...bc, fontWeight: 800, fontSize: '0.75rem', letterSpacing: '0.07em', color: amber, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Important</h4>
              <div style={{ ...b, fontSize: '0.78rem', color: textMid, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <p>• This action will transfer complete ownership of the pool</p>
                <p>• The new commissioner will have full control over the pool</p>
                <p>• This action cannot be undone</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '0.25rem' }}>
              <button
                onClick={handleTransferPool}
                disabled={isTransferring || !newCommissionerEmail.trim()}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: (isTransferring || !newCommissionerEmail.trim()) ? 'not-allowed' : 'pointer', opacity: (isTransferring || !newCommissionerEmail.trim()) ? 0.6 : 1 }}
              >
                {isTransferring ? (
                  <><RefreshCw style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} /> Transferring...</>
                ) : (
                  <><Settings style={{ width: 13, height: 13 }} /> Transfer Pool</>
                )}
              </button>
              <button
                onClick={() => { setTransferPoolDialogOpen(false); setSelectedPoolForTransfer(null); setNewCommissionerEmail(''); }}
                disabled={isTransferring}
                style={{ padding: '0.5rem 1rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function PoolsManagementPage() {
  return (
    <AuthProvider>
      <SharedAdminGuard>
        <PoolsManagementContent />
      </SharedAdminGuard>
    </AuthProvider>
  );
}
