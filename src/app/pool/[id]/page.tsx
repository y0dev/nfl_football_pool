'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Users, Trophy, Calendar, Settings, BarChart3, RefreshCw, Shield, LogOut, Download, ExternalLink, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SharePoolButton } from '@/components/pools/share-pool-button';
import { ParticipantManagement } from '@/components/admin/participant-management';
import { EnhancedEmailManagement } from '@/components/admin/enhanced-email-management';
import { TestPicks } from '@/components/admin/test-picks';
import { ParticipantLinks } from '@/components/admin/participant-links';
import { PoolSettings } from '@/components/admin/pool-settings';
import { PlayoffParticipantsList } from '@/components/admin/playoff-participants-list';
import { ExportData } from '@/components/admin/export-data';

import { loadCurrentWeek } from '@/actions/loadCurrentWeek';
import { useAuth } from '@/lib/auth';
import { AuthProvider } from '@/lib/auth';
import { AdminGuard } from '@/components/auth/admin-guard';
import { DEFAULT_WEEK, DEFAULT_SEASON_TYPE, createPageUrl, debugError} from '@/lib/utils';
import { Footer } from '@/components/layout/Footer';
import { OverridePicksPanel } from '@/components/admin/override-picks-panel';
import { SeasonReviewPanel } from '@/components/admin/season-review-panel';

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

interface Pool {
  id: string;
  name: string;
  created_by: string;
  season: number;
  season_scope: number[];
  is_active: boolean;
  created_at: string;
  description?: string;
  pool_type?: 'normal' | 'knockout';
  tie_breaker_method?: string;
}

const TABS = [
  { id: 'participants',    label: 'Participants',    icon: Users },
  { id: 'links',           label: 'Links',           icon: ExternalLink },
  { id: 'emails',          label: 'Emails',          icon: Mail },
  { id: 'playoffs',        label: 'Playoffs',        icon: Trophy },
  { id: 'override-picks',  label: 'Override Picks',  icon: BarChart3 },
  { id: 'season-review',   label: 'Season Review',   icon: Calendar },
  { id: 'export',          label: 'Export',          icon: Download },
  { id: 'settings',        label: 'Settings',        icon: Settings },
  ...(process.env.NODE_ENV === 'development' ? [{ id: 'test-picks', label: 'Test Picks', icon: BarChart3 }] : []),
];

function PoolDetailsContent() {
  const params = useParams();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const poolId = params.id as string;

  const [pool, setPool] = useState<Pool | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(DEFAULT_WEEK);
  const [currentSeasonType, setCurrentSeasonType] = useState(DEFAULT_SEASON_TYPE);
  const [activeTab, setActiveTab] = useState('participants');
  const [pickStats, setPickStats] = useState({ completed: 0, pending: 0, total: 0 });
  const { toast } = useToast();

  useEffect(() => {
    loadPoolData();
    loadCurrentWeekData();
  }, [poolId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadPoolData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/admin/pools/${poolId}`);
      const result = await response.json();
      if (result.success) {
        setPool(result.pool);
      } else {
        toast({ title: 'Error', description: 'Failed to load pool details', variant: 'destructive' });
      }
    } catch (error) {
      debugError('Error loading pool:', error);
      toast({ title: 'Error', description: 'Failed to load pool details', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const loadCurrentWeekData = async () => {
    try {
      const weekData = await loadCurrentWeek();
      const week = weekData?.week_number || 1;
      const seasonType = weekData?.season_type || DEFAULT_SEASON_TYPE;
      setCurrentWeek(week);
      setCurrentSeasonType(seasonType);
      loadPickStats(week, seasonType);
    } catch (error) {
      debugError('Error loading current week:', error);
    }
  };

  const loadPickStats = async (week: number, seasonType: number) => {
    try {
      const [pRes, picksRes] = await Promise.all([
        fetch(`/api/admin/pool-participants?poolId=${poolId}`),
        fetch(`/api/picks?poolId=${poolId}&week=${week}&seasonType=${seasonType}`),
      ]);
      const [pData, picksData] = await Promise.all([pRes.json(), picksRes.json()]);
      const total = pData.participants?.length || 0;
      const picks: { participant_id: string }[] = picksData.picks || [];
      const completed = new Set(picks.map(p => p.participant_id)).size;
      setPickStats({ completed, pending: Math.max(0, total - completed), total });
    } catch {
      // non-critical — leave zeros
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
          <p style={{ ...b, color: textMid, fontSize: '0.9rem' }}>Loading pool…</p>
        </div>
      </div>
    );
  }

  if (!pool) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
        <div style={{ background: card, border: `1px solid ${border}`, borderTop: `3px solid ${green}`, borderRadius: 10, padding: '2rem', maxWidth: 400, width: '100%', textAlign: 'center' }}>
          <Trophy style={{ width: 40, height: 40, color: textDim, margin: '0 auto 0.75rem' }} />
          <h2 style={{ ...bc, fontWeight: 800, fontSize: '1.1rem', color: text, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Pool Not Found</h2>
          <p style={{ ...b, fontSize: '0.875rem', color: textMid, marginBottom: '1.25rem' }}>The pool you&apos;re looking for doesn&apos;t exist.</p>
          <button
            onClick={() => router.push(createPageUrl('adminpools'))}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', width: '100%', padding: '0.6rem 1rem', background: green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
          >
            <ArrowLeft style={{ width: 13, height: 13 }} /> Back to Pools
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: bg, minHeight: '100vh' }}>

      {/* NAV */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'oklch(13% 0.025 255 / 0.95)', backdropFilter: 'blur(14px)', borderBottom: `1px solid ${border}` }}>
        <div className="lp-inner" style={{ paddingTop: '0.75rem', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                onClick={() => router.push(createPageUrl('adminpools'))}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.6rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
              >
                <ArrowLeft style={{ width: 12, height: 12 }} /> Pools
              </button>
              <div style={{ width: 1, height: 20, background: border }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: green, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Shield style={{ width: 14, height: 14, color: text }} />
                </div>
                <span style={{ ...bc, fontWeight: 800, fontSize: '0.92rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase', maxWidth: '20ch', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Sunday Huddle
                </span>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.7rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
            >
              <LogOut style={{ width: 11, height: 11 }} /> Sign Out
            </button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section id='hero' style={{ background: bg, backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 59px, oklch(100% 0 0 / 0.022) 59px, oklch(100% 0 0 / 0.022) 60px)`, padding: 'clamp(2rem, 4vw, 3rem) 0' }}>
        <div className="lp-inner">
          <div className="pool-hero-row">

            {/* ── Left: pool identity ── */}
            <div className="pool-hero-left">
              <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.26em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ display: 'inline-block', width: 18, height: 2, background: greenHi, borderRadius: 1 }} />
                Pool Management
              </p>
              <h1 style={{ ...bc, fontWeight: 900, fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', lineHeight: 0.95, color: text, textTransform: 'uppercase', marginBottom: '0.6rem' }}>
                {pool.name.split(' ').slice(0, -1).join(' ') || pool.name}<br />
                {pool.name.split(' ').length > 1 && <span style={{ color: gold }}>{pool.name.split(' ').slice(-1)[0]}</span>}
              </h1>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                <span style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.08em', padding: '0.15rem 0.5rem', borderRadius: 4, textTransform: 'uppercase', background: pool.is_active ? 'oklch(46% 0.14 155 / 0.2)' : 'oklch(26% 0.03 255)', color: pool.is_active ? greenHi : textDim, border: `1px solid ${pool.is_active ? 'oklch(46% 0.14 155 / 0.4)' : border}` }}>
                  {pool.is_active ? 'Active' : 'Inactive'}
                </span>
                <span style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.08em', padding: '0.15rem 0.5rem', borderRadius: 4, textTransform: 'uppercase', background: 'oklch(26% 0.03 255)', color: textMid, border: `1px solid ${border}` }}>
                  Season {pool.season}
                </span>
                <span style={{ ...b, fontSize: '0.75rem', color: textDim }}>
                  Created by {pool.created_by}
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1rem', alignItems: 'center' }}>
                <SharePoolButton poolId={pool.id} poolName={pool.name} seasonScope={pool.season_scope} />
                <button
                  onClick={() => setActiveTab('settings')}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.75rem', background: activeTab === 'settings' ? 'oklch(26% 0.03 255)' : 'transparent', color: activeTab === 'settings' ? text : textMid, border: `1px solid ${border}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
                >
                  <Settings style={{ width: 12, height: 12 }} /> Settings
                </button>
              </div>
            </div>

            {/* ── Right: pick submission stats ── */}
            <div className="pool-hero-stats-wrap">
              <div
                className="pool-hero-stats"
                style={{ background: surface, border: `1px solid ${border}`, borderRadius: 8, overflow: 'hidden' }}
              >
                {[
                  { label: 'Pending', value: pickStats.pending, sub: 'awaiting picks', color: 'oklch(74% 0.16 72)' },
                  { label: 'Submitted', value: pickStats.completed, sub: 'picks in', color: greenHi },
                  {
                    label: 'Completion',
                    value: pickStats.total > 0 ? `${Math.round((pickStats.completed / pickStats.total) * 100)}%` : '—',
                    sub: `of ${pickStats.total} members`,
                    color: pickStats.total > 0 && pickStats.completed === pickStats.total ? greenHi : text,
                  },
                ].map(({ label, value, sub, color }) => (
                  <div
                    key={label}
                    style={{ padding: '0.875rem 1rem', textAlign: 'center' }}
                  >
                    <div style={{ ...bc, fontWeight: 700, fontSize: '0.58rem', letterSpacing: '0.16em', color: textDim, textTransform: 'uppercase', marginBottom: '0.2rem' }}>{label}</div>
                    <div style={{ ...bc, fontWeight: 900, fontSize: '1.6rem', lineHeight: 1, color, letterSpacing: '0.02em' }}>{value}</div>
                    <div style={{ ...b, fontSize: '0.65rem', color: textDim, marginTop: '0.2rem' }}>{sub}</div>
                  </div>
                ))}
              </div>
              <p style={{ ...b, fontSize: '0.62rem', color: textDim, marginTop: '0.4rem', textAlign: 'center' }}>
                Week {currentWeek} picks
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* green rule */}
      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${green}, transparent)` }} />

      {/* TABS */}
      <section id='tabs' style={{ background: surface, borderBottom: `1px solid ${border}`, position: 'sticky', top: 57, zIndex: 40 }}>
        <div className="lp-inner" style={{ position: 'relative' }}>
          <div className="hide-scrollbar" style={{ display: 'flex', gap: '0.15rem', overflowX: 'auto', paddingTop: '0.5rem' }}>
            {TABS.map(({ id, label, icon: Icon }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  title={label}
                  onClick={() => setActiveTab(id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                    padding: '0.5rem 0.65rem',
                    background: active ? green : 'transparent',
                    color: active ? text : textMid,
                    border: `1px solid ${active ? green : 'transparent'}`,
                    borderRadius: '6px 6px 0 0',
                    ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase',
                    cursor: 'pointer', whiteSpace: 'nowrap', marginBottom: -1, flexShrink: 0,
                  }}
                >
                  <Icon style={{ width: 13, height: 13 }} />
                  <span className="pool-tab-label">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* TAB CONTENT */}
      <section style={{ background: bg, padding: '2.5rem 0', minHeight: '50vh' }}>
        <div className="lp-inner">

          {/* Participants */}
          {activeTab === 'participants' && (
            <ParticipantManagement poolId={pool.id} poolName={pool.name} />
          )}

          {/* Links */}
          {activeTab === 'links' && (
            <ParticipantLinks
              poolId={pool.id}
              poolName={pool.name}
              weekNumber={currentWeek}
              seasonType={currentSeasonType}
              seasonScope={pool.season_scope}
            />
          )}

          {/* Playoffs */}
          {activeTab === 'playoffs' && (
            <div>
              <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '1.25rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <Trophy style={{ width: 14, height: 14, color: greenHi }} />
                  <p style={{ ...bc, fontWeight: 800, fontSize: '0.85rem', color: text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Playoff Confidence Points
                  </p>
                </div>
                <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginBottom: '1rem' }}>
                  Manage playoff confidence points and view participant submission status
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => router.push(`/pool/${pool.id}/playoffs`)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 0.9rem', background: green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
                  >
                    <Trophy style={{ width: 12, height: 12 }} /> Manage Playoff Confidence Points
                  </button>
                </div>
              </div>
              <PlayoffParticipantsList poolId={pool.id} poolSeason={pool.season} />
            </div>
          )}

          {/* Override Picks */}
          {activeTab === 'override-picks' && (
            <OverridePicksPanel poolId={pool.id} poolName={pool.name} currentSeason={pool.season} />
          )}

          {/* Season Review */}
          {activeTab === 'season-review' && (
            <SeasonReviewPanel poolId={pool.id} season={pool.season} />
          )}

          {/* Emails */}
          {activeTab === 'emails' && (
            <EnhancedEmailManagement
              poolId={pool.id}
              weekNumber={currentWeek}
              adminId={user?.id || ''}
              poolName={pool.name}
            />
          )}

          {/* Export */}
          {activeTab === 'export' && (
            <ExportData
              poolId={pool.id}
              poolName={pool.name}
              currentWeek={currentWeek}
              currentSeason={pool.season}
            />
          )}

          {/* Settings */}
          {activeTab === 'settings' && (
            <PoolSettings
              poolId={pool.id}
              poolName={pool.name}
              onPoolDeleted={() => router.push(createPageUrl('adminpools'))}
            />
          )}

          {/* Test Picks (dev only) */}
          {process.env.NODE_ENV === 'development' && activeTab === 'test-picks' && (
            <TestPicks
              poolId={pool.id}
              poolName={pool.name}
              weekNumber={currentWeek}
              seasonType={currentSeasonType}
              seasonScope={pool.season_scope}
            />
          )}

        </div>
      </section>

      <Footer pageName="Pool Management" />
    </div>
  );
}

export default function PoolDetailsPage() {
  return (
    <AuthProvider>
      <AdminGuard requireSuperAdmin>
        <PoolDetailsContent />
      </AdminGuard>
    </AuthProvider>
  );
}
