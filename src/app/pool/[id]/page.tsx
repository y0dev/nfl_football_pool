'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Edit, Save, X, Users, Trophy, Calendar, Settings, BarChart3, RefreshCw, Shield, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SharePoolButton } from '@/components/pools/share-pool-button';
import { ParticipantManagement } from '@/components/admin/participant-management';
import { EnhancedEmailManagement } from '@/components/admin/enhanced-email-management';
import { TestPicks } from '@/components/admin/test-picks';
import { ParticipantLinks } from '@/components/admin/participant-links';
import { PoolSettings } from '@/components/admin/pool-settings';
import { PlayoffParticipantsList } from '@/components/admin/playoff-participants-list';

import { loadCurrentWeek } from '@/actions/loadCurrentWeek';
import { useAuth } from '@/lib/auth';
import { AuthProvider } from '@/lib/auth';
import { AdminGuard } from '@/components/auth/admin-guard';
import { DEFAULT_POOL_SEASON, DEFAULT_WEEK, DEFAULT_SEASON_TYPE, createPageUrl, PERIOD_WEEKS } from '@/lib/utils';
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

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

interface Pool {
  id: string;
  name: string;
  created_by: string;
  season: number;
  is_active: boolean;
  created_at: string;
  description?: string;
  pool_type?: 'normal' | 'knockout';
  tie_breaker_method?: string;
  tie_breaker_question?: string;
  tie_breaker_answer?: number;
}

const TABS = [
  { id: 'overview',       label: 'Overview',       icon: BarChart3 },
  { id: 'participants',   label: 'Participants',    icon: Users },
  { id: 'links',          label: 'Links',           icon: ArrowLeft },
  { id: 'playoffs',       label: 'Playoffs',        icon: Trophy },
  { id: 'season-review',  label: 'Season Review',   icon: Calendar },
  { id: 'emails',         label: 'Emails',          icon: Settings },
  { id: 'settings',       label: 'Settings',        icon: Settings },
  ...(process.env.NODE_ENV === 'development' ? [{ id: 'test-picks', label: 'Test Picks', icon: BarChart3 }] : []),
];

function PoolDetailsContent() {
  const params = useParams();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const poolId = params.id as string;

  const [pool, setPool] = useState<Pool | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(DEFAULT_WEEK);
  const [currentSeasonType, setCurrentSeasonType] = useState(DEFAULT_SEASON_TYPE);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const { toast } = useToast();

  const [editForm, setEditForm] = useState({
    name: '',
    season: DEFAULT_POOL_SEASON,
    is_active: true,
    description: '',
    pool_type: 'normal' as 'normal' | 'knockout',
    tie_breaker_method: '',
    tie_breaker_question: '',
    tie_breaker_answer: 0
  });

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
        setEditForm({
          name: result.pool.name,
          season: result.pool.season,
          is_active: result.pool.is_active,
          description: result.pool.description || '',
          pool_type: result.pool.pool_type || 'normal',
          tie_breaker_method: result.pool.tie_breaker_method || '',
          tie_breaker_question: result.pool.tie_breaker_question || '',
          tie_breaker_answer: result.pool.tie_breaker_answer || 0
        });
      } else {
        toast({ title: 'Error', description: 'Failed to load pool details', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error loading pool:', error);
      toast({ title: 'Error', description: 'Failed to load pool details', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const loadCurrentWeekData = async () => {
    try {
      const weekData = await loadCurrentWeek();
      setCurrentWeek(weekData?.week_number || 1);
      setCurrentSeasonType(weekData?.season_type || DEFAULT_SEASON_TYPE);
    } catch (error) {
      console.error('Error loading current week:', error);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      if (!editForm.name.trim()) {
        toast({ title: 'Error', description: 'Pool name is required', variant: 'destructive' });
        return;
      }

      if (editForm.season < 2020 || editForm.season > 2030) {
        toast({ title: 'Error', description: 'Season must be between 2020 and 2030', variant: 'destructive' });
        return;
      }

      console.log('Saving pool data:', editForm);

      const response = await fetch(`/api/admin/pools/${poolId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      const result = await response.json();
      console.log('Save response:', result);

      if (result.success) {
        toast({ title: 'Success', description: 'Pool updated successfully' });
        setPool(result.pool);
        setIsEditing(false);
        await loadPoolData();
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to update pool', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error updating pool:', error);
      toast({ title: 'Error', description: 'Failed to update pool', variant: 'destructive' });
    } finally {
      setIsSaving(false);
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
            Back to Pools
          </button>
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
                onClick={() => router.push(createPageUrl('adminpools'))}
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
                Pools
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
          <h1 style={{ ...bc, fontWeight: 900, fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', lineHeight: 0.95, color: text, textTransform: 'uppercase', marginBottom: '0.6rem' }}>
            {pool.name.split(' ').slice(0, -1).join(' ') || pool.name}<br />
            {pool.name.split(' ').length > 1 && <span style={{ color: gold }}>{pool.name.split(' ').slice(-1)[0]}</span>}
          </h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
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
            }}>Season {pool.season}</span>
            <span style={{
              ...b, fontSize: '0.75rem', color: textDim,
            }}>
              Created by {pool.created_by}
            </span>
          </div>

          {/* Header action row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1rem', alignItems: 'center' }}>
            <SharePoolButton poolId={pool.id} poolName={pool.name} />
            <button
              onClick={() => setIsEditing(!isEditing)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.35rem',
                padding: '0.4rem 0.75rem',
                background: isEditing ? 'oklch(26% 0.03 255)' : 'transparent',
                color: isEditing ? text : textMid,
                border: `1px solid ${border}`, borderRadius: 5,
                ...bc, fontWeight: 600, fontSize: '0.72rem',
                letterSpacing: '0.07em', textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              {isEditing ? <X style={{ width: 12, height: 12 }} /> : <Edit style={{ width: 12, height: 12 }} />}
              {isEditing ? 'Cancel' : 'Edit Pool'}
            </button>
            {isEditing && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  padding: '0.4rem 0.75rem',
                  background: green, color: text,
                  border: `1px solid ${green}`, borderRadius: 5,
                  ...bc, fontWeight: 700, fontSize: '0.72rem',
                  letterSpacing: '0.07em', textTransform: 'uppercase',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  opacity: isSaving ? 0.6 : 1,
                }}
              >
                <Save style={{ width: 12, height: 12 }} />
                {isSaving ? 'Saving…' : 'Save'}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* green rule */}
      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${green}, transparent)` }} />

      {/* EDIT FORM */}
      {isEditing && (
        <section style={{ background: surface, borderBottom: `1px solid ${border}`, padding: '2rem 0' }}>
          <div className="lp-inner">
            <p style={{ ...bc, fontWeight: 800, fontSize: '0.8rem', color: text, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Settings style={{ width: 13, height: 13, color: greenHi }} />
              Edit Pool Details
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

              {/* Name + Season row */}
              <div className="admin-2col-grid">
                <div>
                  <Label htmlFor="name" style={{ ...bc, fontSize: '0.7rem', fontWeight: 700, color: textDim, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Pool Name</Label>
                  <Input
                    id="name"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    style={{ background: card, border: `1px solid ${border}`, color: text, marginTop: '0.35rem' }}
                  />
                </div>
                <div>
                  <Label htmlFor="season" style={{ ...bc, fontSize: '0.7rem', fontWeight: 700, color: textDim, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Season</Label>
                  <Input
                    id="season"
                    type="number"
                    value={editForm.season}
                    onChange={(e) => setEditForm({ ...editForm, season: parseInt(e.target.value) })}
                    style={{ background: card, border: `1px solid ${border}`, color: text, marginTop: '0.35rem' }}
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="description" style={{ ...bc, fontSize: '0.7rem', fontWeight: 700, color: textDim, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Description</Label>
                <Textarea
                  id="description"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                  placeholder="Enter pool description..."
                  style={{ background: card, border: `1px solid ${border}`, color: text, marginTop: '0.35rem', resize: 'none' }}
                />
              </div>

              {/* Pool Type */}
              <div>
                <Label htmlFor="pool_type" style={{ ...bc, fontSize: '0.7rem', fontWeight: 700, color: textDim, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Pool Type</Label>
                <div style={{ marginTop: '0.35rem' }}>
                  <Select
                    value={editForm.pool_type}
                    onValueChange={(value: 'normal' | 'knockout') => setEditForm({ ...editForm, pool_type: value })}
                  >
                    <SelectTrigger style={{ background: card, border: `1px solid ${border}`, color: text }}>
                      <SelectValue placeholder="Select pool type" />
                    </SelectTrigger>
                    <SelectContent style={{ background: card, border: `1px solid ${border}`, color: text }}>
                      <SelectItem value="normal">Normal Pool</SelectItem>
                      <SelectItem value="knockout">Knockout Pool</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.4rem' }}>
                  Normal pools disable tie breakers during regular weeks (tie breakers only used in tie-breaker weeks {PERIOD_WEEKS.join(', ')}, and Super Bowl in playoffs).
                  Knockout pools always use tie breakers.
                </p>
              </div>

              {/* Tie Breaker fields */}
              <div className="admin-3col-grid">
                <div>
                  <Label style={{ ...bc, fontSize: '0.7rem', fontWeight: 700, color: textDim, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Tie Breaker Method</Label>
                  <div style={{ marginTop: '0.35rem' }}>
                    <Select
                      value={editForm.tie_breaker_method}
                      onValueChange={(value) => setEditForm({ ...editForm, tie_breaker_method: value })}
                    >
                      <SelectTrigger style={{ background: card, border: `1px solid ${border}`, color: text }}>
                        <SelectValue placeholder="Select tie breaker method" />
                      </SelectTrigger>
                      <SelectContent style={{ background: card, border: `1px solid ${border}`, color: text }}>
                        <SelectItem value="total_points">Total Points</SelectItem>
                        <SelectItem value="correct_picks">Correct Picks</SelectItem>
                        <SelectItem value="confidence_points">Confidence Points</SelectItem>
                        <SelectItem value="monday_night_total">Monday Night Total</SelectItem>
                        <SelectItem value="highest_scoring_game">Highest Scoring Game</SelectItem>
                        <SelectItem value="lowest_scoring_game">Lowest Scoring Game</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="tie_breaker_question" style={{ ...bc, fontSize: '0.7rem', fontWeight: 700, color: textDim, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Tie Breaker Question</Label>
                  <Input
                    id="tie_breaker_question"
                    value={editForm.tie_breaker_question}
                    onChange={(e) => setEditForm({ ...editForm, tie_breaker_question: e.target.value })}
                    placeholder={
                      editForm.tie_breaker_method === 'monday_night_total'
                        ? "e.g., What will be the total points scored in Monday night's game?"
                        : editForm.tie_breaker_method === 'highest_scoring_game'
                        ? "e.g., What will be the total points in the highest scoring game?"
                        : editForm.tie_breaker_method === 'lowest_scoring_game'
                        ? "e.g., What will be the total points in the lowest scoring game?"
                        : editForm.tie_breaker_method === 'custom'
                        ? "Enter your custom tie breaker question"
                        : "e.g., Enter tie breaker question"
                    }
                    style={{ background: card, border: `1px solid ${border}`, color: text, marginTop: '0.35rem' }}
                  />
                </div>
                <div>
                  <Label htmlFor="tie_breaker_answer" style={{ ...bc, fontSize: '0.7rem', fontWeight: 700, color: textDim, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Tie Breaker Answer</Label>
                  <Input
                    id="tie_breaker_answer"
                    type="number"
                    value={editForm.tie_breaker_answer}
                    onChange={(e) => setEditForm({ ...editForm, tie_breaker_answer: parseInt(e.target.value) })}
                    placeholder="0"
                    style={{ background: card, border: `1px solid ${border}`, color: text, marginTop: '0.35rem' }}
                  />
                </div>
              </div>

              {/* Active toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <input
                  type="checkbox"
                  id="is_active"
                  checked={editForm.is_active}
                  onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                  style={{ accentColor: green, width: 15, height: 15 }}
                />
                <Label htmlFor="is_active" style={{ ...bc, fontSize: '0.75rem', fontWeight: 700, color: textMid, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer' }}>
                  Pool is active
                </Label>
              </div>

            </div>
          </div>
        </section>
      )}

      {/* TABS */}
      <section style={{ background: surface, borderBottom: `1px solid ${border}`, position: 'sticky', top: 57, zIndex: 40 }}>
        <div className="lp-inner">
          <div style={{ display: 'flex', gap: '0.25rem', overflowX: 'auto', paddingTop: '0.5rem' }}>
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

      {/* TAB CONTENT */}
      <section style={{ background: bg, padding: '2.5rem 0', minHeight: '50vh' }}>
        <div className="lp-inner">

          {/* Overview */}
          {activeTab === 'overview' && (
            <div>
              <div className="admin-2col-grid">
                {[
                  { label: 'Pool Name', value: pool.name },
                  { label: 'Season', value: String(pool.season) },
                  { label: 'Status', value: pool.is_active ? 'Active' : 'Inactive', accent: pool.is_active ? greenHi : textDim },
                  { label: 'Created By', value: pool.created_by },
                ].map(({ label, value, accent }) => (
                  <div key={label} style={{ background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '1.1rem 1.25rem' }}>
                    <p style={{ ...bc, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                      {label}
                    </p>
                    <p style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: accent || text, lineHeight: 1.2 }}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Participants */}
          {activeTab === 'participants' && (
            <ParticipantManagement poolId={pool.id} poolName={pool.name} />
          )}

          {/* Test Picks (dev only) */}
          {process.env.NODE_ENV === 'development' && activeTab === 'test-picks' && (
            <TestPicks
              poolId={pool.id}
              poolName={pool.name}
              weekNumber={currentWeek}
              seasonType={currentSeasonType}
            />
          )}

          {/* Links */}
          {activeTab === 'links' && (
            <ParticipantLinks
              poolId={pool.id}
              poolName={pool.name}
              weekNumber={currentWeek}
              seasonType={currentSeasonType}
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
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.35rem',
                      padding: '0.5rem 0.9rem',
                      background: green, color: text,
                      border: 'none', borderRadius: 6,
                      ...bc, fontWeight: 700, fontSize: '0.75rem',
                      letterSpacing: '0.07em', textTransform: 'uppercase',
                      cursor: 'pointer',
                    }}
                  >
                    <Trophy style={{ width: 12, height: 12 }} />
                    Manage Playoff Confidence Points
                  </button>
                </div>
              </div>
              <PlayoffParticipantsList poolId={pool.id} poolSeason={pool.season} />
            </div>
          )}

          {/* Season Review */}
          {activeTab === 'season-review' && (
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '2rem', textAlign: 'center' }}>
              <Trophy style={{ width: 40, height: 40, color: gold, margin: '0 auto 1rem' }} />
              <h3 style={{ ...bc, fontWeight: 800, fontSize: '1.1rem', color: text, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                Season Review
              </h3>
              <p style={{ ...b, fontSize: '0.85rem', color: textMid, marginBottom: '1.5rem' }}>
                View comprehensive statistics and achievements for the {pool.season} season
              </p>
              <button
                onClick={() => router.push(`/season-review/${pool.id}/${pool.season}`)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                  padding: '0.6rem 1.1rem',
                  background: green, color: text,
                  border: 'none', borderRadius: 6,
                  ...bc, fontWeight: 700, fontSize: '0.78rem',
                  letterSpacing: '0.07em', textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
              >
                <Trophy style={{ width: 13, height: 13 }} />
                View Season Review
              </button>
            </div>
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

          {/* Settings */}
          {activeTab === 'settings' && (
            <PoolSettings
              poolId={pool.id}
              poolName={pool.name}
              onPoolDeleted={() => router.push(createPageUrl('adminpools'))}
            />
          )}

        </div>
      </section>

      {/* FOOTER */}
      <Footer pageName="Pool Management" />
    </div>
  );
}

export default function PoolDetailsPage() {
  return (
    <AuthProvider>
      <AdminGuard>
        <PoolDetailsContent />
      </AdminGuard>
    </AuthProvider>
  );
}
