'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Users, Trophy, Plus, X, Pencil, ShieldCheck, ShieldOff, UserPlus, ArrowLeftRight, Search, Trash2, Copy } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { renameHuddle, setHuddleActive, deleteHuddle } from '@/actions/huddles';
import { initiateHuddleTransfer } from '@/actions/huddleTransfers';
import { loadHuddleMembers, addHuddleMember, removeHuddleMember, addHuddleMemberToPool, HuddleMember } from '@/actions/huddleMembers';
import { loadPoolsByHuddleId } from '@/actions/loadPools';
import { getPoolParticipants, removeParticipantFromPool } from '@/actions/adminActions';
import { CreatePoolDialog } from '@/components/pools/create-pool-dialog';
import { clonePool } from '@/actions/clonePool';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { AppNav } from '@/components/layout/AppNav';
import { debugError } from '@/lib/utils';

// Design tokens (matches admin pages / app-wide dark theme)
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

const inputStyle = { ...b, background: surface, border: `1px solid ${border}`, color: text, padding: '0.45rem 0.7rem', borderRadius: 6, fontSize: '0.85rem', boxSizing: 'border-box' as const };

interface PoolRow {
  id: string;
  name: string;
  season: number;
  is_active: boolean;
}

interface PoolParticipant {
  id: string;
  name: string;
  email?: string;
}

interface LeagueManagerProps {
  huddleId: string;
  initialName: string;
  onBack: () => void;
  backLabel?: string;
  /** Super-admin managing another commissioner's League — shows the owner's
   * email and the activate/deactivate control, and hides pool creation
   * (a new pool needs an owning commissioner; that's the commissioner's own
   * call, not the admin's, to avoid misattributing ownership). */
  isAdminView?: boolean;
  commissionerEmail?: string;
  initialIsActive?: boolean;
}

export function LeagueManager({
  huddleId, initialName, onBack, backLabel = 'Back',
  isAdminView = false, commissionerEmail, initialIsActive = true,
}: LeagueManagerProps) {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [leagueName, setLeagueName] = useState(initialName);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [members, setMembers] = useState<HuddleMember[]>([]);
  const [pools, setPools] = useState<PoolRow[]>([]);
  const [participantsByPool, setParticipantsByPool] = useState<Record<string, PoolParticipant[]>>({});
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [createPoolOpen, setCreatePoolOpen] = useState(false);
  const [isActiveState, setIsActiveState] = useState(initialIsActive);
  const [isTogglingActive, setIsTogglingActive] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferEmail, setTransferEmail] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [deleteHuddleOpen, setDeleteHuddleOpen] = useState(false);
  const [deleteHuddleConfirmation, setDeleteHuddleConfirmation] = useState('');
  const [deleteCascadePools, setDeleteCascadePools] = useState(false);
  const [isDeletingHuddle, setIsDeletingHuddle] = useState(false);
  const [cloningPoolId, setCloningPoolId] = useState<string | null>(null);
  const [isFreePlan, setIsFreePlan] = useState(false);

  const load = useCallback(async () => {
    try {
      const [memberList, poolList] = await Promise.all([
        loadHuddleMembers(huddleId),
        loadPoolsByHuddleId(huddleId),
      ]);
      setMembers(memberList);
      setPools(poolList as PoolRow[]);

      const participantEntries = await Promise.all(
        (poolList as PoolRow[]).map(async (pool) => [pool.id, await getPoolParticipants(pool.id)] as const)
      );
      setParticipantsByPool(Object.fromEntries(participantEntries));
    } catch (error) {
      debugError('Failed to load league:', error);
      toast({ title: 'Error', description: 'Failed to load this League.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [huddleId, toast]);

  useEffect(() => { load(); }, [load]);

  // Clone is a Standard-plan feature — this only pre-emptively disables the
  // button with an explanation; performClone() re-checks the plan
  // server-side regardless, so a stale/failed read here is a UX nicety, not
  // a security boundary. Not relevant in admin view (that Clone button is
  // gated separately, per-pool, in the super-admin pools list).
  useEffect(() => {
    if (isAdminView || !user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/plan-status?adminId=${user.id}`);
        const data = await res.json();
        if (!cancelled) setIsFreePlan(!(data.success && data.plan !== 'free'));
      } catch {
        if (!cancelled) setIsFreePlan(true);
      }
    })();
    return () => { cancelled = true; };
  }, [isAdminView, user?.id]);

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return members;
    return members.filter(m =>
      m.name.toLowerCase().includes(q) || (m.email ?? '').toLowerCase().includes(q)
    );
  }, [members, memberSearch]);

  // m.poolIds comes from the huddle_member_id link on participants, which
  // only gets set when someone's added via "Add from Roster" — a direct
  // admin add, a self-joined pool link, or older data from before that
  // linkage existed all miss it. Falling back to a name match against each
  // pool's actual participants catches those too, so both the roster's "In
  // X of Y pools" count and the "Add from Roster" list agree with reality.
  const effectivePoolIdsByMember = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const m of members) {
      const nameLower = m.name.trim().toLowerCase();
      const ids = new Set(m.poolIds);
      for (const pool of pools) {
        if ((participantsByPool[pool.id] ?? []).some(p => p.name.trim().toLowerCase() === nameLower)) {
          ids.add(pool.id);
        }
      }
      map.set(m.id, ids);
    }
    return map;
  }, [members, pools, participantsByPool]);

  const handleRename = async () => {
    const result = await renameHuddle(huddleId, nameDraft);
    if (!result.success) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
      return;
    }
    setLeagueName(nameDraft.trim());
    setEditingName(false);
  };

  const handleInitiateTransfer = async () => {
    if (!user?.email) return;
    setIsTransferring(true);
    try {
      const result = await initiateHuddleTransfer(huddleId, user.email, transferEmail);
      if (!result.success) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
        return;
      }
      setTransferEmail('');
      setTransferOpen(false);
      toast({ title: 'Transfer Requested', description: `Check your email to confirm — ${transferEmail} has been asked to confirm too.` });
    } finally {
      setIsTransferring(false);
    }
  };

  const handleDeleteHuddle = async () => {
    if (!user?.email) return;
    setIsDeletingHuddle(true);
    try {
      const result = await deleteHuddle(huddleId, user.email, deleteCascadePools);
      if (!result.success) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
        return;
      }
      toast({
        title: 'League Deleted',
        description: result.poolsDeleted > 0
          ? `${leagueName} and its ${result.poolsDeleted} pool${result.poolsDeleted === 1 ? '' : 's'} have been deleted.`
          : `${leagueName} has been deleted.`,
      });
      onBack();
    } finally {
      setIsDeletingHuddle(false);
    }
  };

  const handleClonePool = async (pool: PoolRow) => {
    if (!user?.email) return;
    setCloningPoolId(pool.id);
    try {
      const result = await clonePool(pool.id, user.email);
      if (!result.success) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
        return;
      }
      toast({
        title: 'Pool Cloned',
        description: `"${result.poolName}" created with ${result.participantsCloned} participant${result.participantsCloned === 1 ? '' : 's'}.`,
      });
      await load();
    } finally {
      setCloningPoolId(null);
    }
  };

  const handleToggleActive = async () => {
    if (!user?.email) return;
    setIsTogglingActive(true);
    const next = !isActiveState;
    const result = await setHuddleActive(huddleId, next, user.email);
    if (!result.success) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    } else {
      setIsActiveState(next);
      toast({ title: next ? 'League Activated' : 'League Deactivated', description: leagueName });
    }
    setIsTogglingActive(false);
  };

  const handleAddMember = async () => {
    setIsAddingMember(true);
    try {
      const result = await addHuddleMember(huddleId, memberName, memberEmail);
      if (!result.success) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
        return;
      }
      setMembers(prev => [...prev, result.member].sort((a, b2) => a.name.localeCompare(b2.name)));
      setMemberName('');
      setMemberEmail('');
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    const result = await removeHuddleMember(memberId);
    if (!result.success) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
      return;
    }
    setMembers(prev => prev.filter(m => m.id !== memberId));
  };

  const handleAddToPool = async (member: HuddleMember, poolId: string) => {
    const result = await addHuddleMemberToPool(member.id, poolId);
    if (!result.success) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
      return;
    }
    await load();
    toast({ title: 'Added', description: `${member.name} added to the pool.` });
  };

  const handleRemoveFromPool = async (participantId: string, poolId: string) => {
    await removeParticipantFromPool(participantId);
    setParticipantsByPool(prev => ({
      ...prev,
      [poolId]: (prev[poolId] ?? []).filter(p => p.id !== participantId),
    }));
    await load();
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
        <div className="animate-spin rounded-full h-16 w-16" style={{ borderWidth: '3px', borderStyle: 'solid', borderColor: border, borderTopColor: green }} />
      </div>
    );
  }

  return (
    <div style={{ background: bg, minHeight: '100vh' }}>

      {/* ── NAV ── */}
      <AppNav
        isAuthenticated
        isSuperAdmin={isAdminView}
        onSignOut={signOut}
        rightSlot={
          <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.6rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer', flexShrink: 0 }}>
            <ArrowLeft style={{ width: 12, height: 12 }} /> {backLabel}
          </button>
        }
      />

      {/* ── LEAGUE NAME ── */}
      <section style={{ background: surface, padding: '2rem 0' }}>
        <div className="lp-inner">
          {isAdminView && commissionerEmail && (
            <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginBottom: '0.5rem' }}>Commissioner: {commissionerEmail}</p>
          )}
          {editingName ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', maxWidth: 420 }}>
              <input autoFocus value={nameDraft} onChange={e => setNameDraft(e.target.value)} style={{ ...inputStyle, flex: 1, fontSize: '1.1rem' }} />
              <button onClick={handleRename} style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0.5rem 0.8rem', background: green, color: text, border: 'none', borderRadius: 6, cursor: 'pointer' }}>Save</button>
              <button onClick={() => setEditingName(false)} style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0.5rem 0.8rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 6, cursor: 'pointer' }}>Cancel</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h1 style={{ ...bc, fontWeight: 900, fontSize: '1.75rem', color: text, textTransform: 'uppercase', letterSpacing: '-0.01em' }}>{leagueName}</h1>
              <button onClick={() => { setNameDraft(leagueName); setEditingName(true); }} title="Rename League" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.6rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                <Pencil style={{ width: 11, height: 11 }} /> Rename
              </button>
              {!isAdminView && (
                <button onClick={() => setTransferOpen(v => !v)} title="Transfer this Huddle to another commissioner" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.6rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  <ArrowLeftRight style={{ width: 11, height: 11 }} /> Transfer Huddle
                </button>
              )}
              {isAdminView && (
                <button
                  onClick={handleToggleActive}
                  disabled={isTogglingActive}
                  title={isActiveState ? 'Deactivate League' : 'Activate League'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.6rem',
                    background: isActiveState ? 'oklch(46% 0.14 155 / 0.15)' : 'oklch(62% 0.22 25 / 0.15)',
                    color: isActiveState ? greenHi : liveRed,
                    border: `1px solid ${isActiveState ? 'oklch(46% 0.14 155 / 0.4)' : 'oklch(62% 0.22 25 / 0.4)'}`,
                    borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase',
                    cursor: isTogglingActive ? 'not-allowed' : 'pointer', opacity: isTogglingActive ? 0.6 : 1,
                  }}
                >
                  {isActiveState ? <ShieldCheck style={{ width: 11, height: 11 }} /> : <ShieldOff style={{ width: 11, height: 11 }} />}
                  {isActiveState ? 'Active' : 'Inactive'} — {isTogglingActive ? 'Updating…' : `Click to ${isActiveState ? 'deactivate' : 'activate'}`}
                </button>
              )}
            </div>
          )}

          {transferOpen && (
            <div style={{ marginTop: '1.25rem', background: card, border: `1px solid ${border}`, borderLeft: `3px solid ${gold}`, borderRadius: 8, padding: '1.1rem 1.25rem', maxWidth: 520 }}>
              <p style={{ ...bc, fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.08em', color: gold, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Transfer This Huddle</p>
              <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginBottom: '0.75rem', lineHeight: 1.5 }}>
                Hands off {leagueName} — its roster and every pool in it — to another commissioner. They must already have a Sunday Huddle account. Nothing changes until you both confirm by email.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  placeholder="commissioner@example.com"
                  value={transferEmail}
                  onChange={e => setTransferEmail(e.target.value)}
                  style={{ ...inputStyle, flex: '1 1 220px' }}
                />
                <button
                  onClick={handleInitiateTransfer}
                  disabled={isTransferring || !transferEmail.trim()}
                  style={{ padding: '0.5rem 0.9rem', background: green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: (isTransferring || !transferEmail.trim()) ? 'not-allowed' : 'pointer', opacity: (isTransferring || !transferEmail.trim()) ? 0.6 : 1 }}
                >
                  {isTransferring ? 'Sending…' : 'Send Transfer Request'}
                </button>
                <button
                  onClick={() => { setTransferOpen(false); setTransferEmail(''); }}
                  style={{ padding: '0.5rem 0.9rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${green}, transparent)` }} />

      {/* ── ROSTER ── */}
      <section style={{ background: bg, padding: '2.5rem 0' }}>
        <div className="lp-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <span style={{ display: 'block', width: 3, height: 22, background: green, borderRadius: 2 }} />
            <h2 style={{ ...bc, fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.06em', color: text, textTransform: 'uppercase' }}>
              League Roster ({memberSearch.trim() ? `${filteredMembers.length} of ${members.length}` : members.length})
            </h2>
            {members.length > 5 && (
              <div style={{ position: 'relative', marginLeft: 'auto', flex: '0 1 240px', minWidth: 180 }}>
                <Search style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: textDim }} />
                <input
                  placeholder="Filter roster…"
                  value={memberSearch}
                  onChange={e => setMemberSearch(e.target.value)}
                  style={{ ...inputStyle, width: '100%', paddingLeft: '1.85rem' }}
                />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '0.4rem' }}>
            <div style={{ flex: '1 1 160px' }}>
              <label style={{ ...bc, fontSize: '0.6rem', fontWeight: 700, color: textDim, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.3rem' }}>Name</label>
              <input placeholder="Full name" value={memberName} onChange={e => setMemberName(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex: '1 1 220px' }}>
              <label style={{ ...bc, fontSize: '0.6rem', fontWeight: 700, color: textDim, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.3rem' }}>
                Email <span style={{ textTransform: 'none', fontWeight: 400 }}>(optional)</span>
              </label>
              <input placeholder="Leave blank to notify manually" value={memberEmail} onChange={e => setMemberEmail(e.target.value)} style={inputStyle} />
            </div>
            <button onClick={handleAddMember} disabled={isAddingMember || !memberName.trim()} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.9rem', background: green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: (isAddingMember || !memberName.trim()) ? 'not-allowed' : 'pointer', opacity: (isAddingMember || !memberName.trim()) ? 0.6 : 1 }}>
              <UserPlus style={{ width: 13, height: 13 }} /> Add to League
            </button>
          </div>
          <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginBottom: '1.25rem' }}>
            Name is required. Add an email so this person can be invited automatically when you add them to a pool — or leave it blank and notify them yourself.
          </p>

          {members.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', background: surface, border: `1px solid ${border}`, borderRadius: 8 }}>
              <Users style={{ width: 32, height: 32, color: textDim, margin: '0 auto 0.75rem' }} />
              <p style={{ ...b, color: textDim, fontSize: '0.85rem' }}>No members yet. Add people to the League roster, then assign them into pools below.</p>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', background: surface, border: `1px solid ${border}`, borderRadius: 8 }}>
              <Search style={{ width: 32, height: 32, color: textDim, margin: '0 auto 0.75rem' }} />
              <p style={{ ...b, color: textDim, fontSize: '0.85rem' }}>No members match &quot;{memberSearch}&quot;.</p>
            </div>
          ) : (
            <div id="members-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '18rem', overflowY: 'auto', paddingRight: '0.35rem' }}>
              {filteredMembers.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: surface, border: `1px solid ${border}`, borderRadius: 8, padding: '0.75rem 1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ ...b, fontSize: '0.88rem', color: text, fontWeight: 600 }}>{m.name}</span>
                    <span style={{ ...b, fontSize: '0.78rem', color: textDim, marginLeft: '0.6rem', fontStyle: m.email ? 'normal' : 'italic' }}>
                      {m.email ?? 'No email — notify manually'}
                    </span>
                  </div>
                  <span style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.08em', color: textDim, background: 'oklch(26% 0.03 255 / 0.6)', padding: '0.15rem 0.5rem', borderRadius: 4, textTransform: 'uppercase' }}>
                    In {effectivePoolIdsByMember.get(m.id)?.size ?? m.poolIds.length} of {pools.length} pool{pools.length === 1 ? '' : 's'}
                  </span>
                  <button onClick={() => handleRemoveMember(m.id)} title="Remove from League" style={{ display: 'flex', alignItems: 'center', padding: '0.3rem', background: 'transparent', color: textDim, border: 'none', cursor: 'pointer' }}>
                    <X style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${green}, transparent)` }} />

      {/* ── POOLS IN THIS LEAGUE ── */}
      <section style={{ background: surface, padding: '2.5rem 0 3rem' }}>
        <div className="lp-inner">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ display: 'block', width: 3, height: 22, background: green, borderRadius: 2 }} />
              <h2 style={{ ...bc, fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.06em', color: text, textTransform: 'uppercase' }}>Pools In This League ({pools.length})</h2>
            </div>
            {!isAdminView && (
              <button
                onClick={() => setCreatePoolOpen(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.9rem', background: green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
              >
                <Plus style={{ width: 13, height: 13 }} /> Create Pool
              </button>
            )}
          </div>

          {pools.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', background: card, border: `1px solid ${border}`, borderRadius: 8 }}>
              <Trophy style={{ width: 32, height: 32, color: textDim, margin: '0 auto 0.75rem' }} />
              <p style={{ ...b, color: textDim, fontSize: '0.85rem' }}>No pools yet{isAdminView ? '.' : ' — create the first one for this League above.'}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {pools.map(pool => {
                const current = participantsByPool[pool.id] ?? [];
                const notYetIn = members.filter(m => !effectivePoolIdsByMember.get(m.id)?.has(pool.id));
                return (
                  <div key={pool.id} style={{ background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
                      <span style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text }}>{pool.name}</span>
                      <span style={{ ...b, fontSize: '0.75rem', color: textDim }}>{pool.season} Season</span>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.15rem 0.5rem', borderRadius: 4,
                        background: pool.is_active ? 'oklch(46% 0.14 155 / 0.15)' : 'oklch(50% 0.018 255 / 0.15)',
                        border: `1px solid ${pool.is_active ? 'oklch(46% 0.14 155 / 0.4)' : border}`,
                        ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.08em', textTransform: 'uppercase',
                        color: pool.is_active ? greenHi : textDim,
                      }}>
                        {pool.is_active ? 'Active' : 'Inactive'}
                      </span>
                      {!isAdminView && (
                        <button
                          onClick={() => handleClonePool(pool)}
                          disabled={cloningPoolId === pool.id || isFreePlan}
                          title={
                            isFreePlan
                              ? 'Cloning a pool for next season is included with the Standard plan — upgrade to unlock it.'
                              : "Clone this pool's settings and participants into a new pool for next season"
                          }
                          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.7rem', background: 'transparent', color: gold, border: `1px solid color-mix(in oklch, ${gold} 40%, ${border})`, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: (cloningPoolId === pool.id || isFreePlan) ? 'not-allowed' : 'pointer', opacity: (cloningPoolId === pool.id || isFreePlan) ? 0.5 : 1 }}
                        >
                          <Copy style={{ width: 12, height: 12 }} />
                          {cloningPoolId === pool.id ? 'Cloning…' : 'Clone'}
                        </button>
                      )}
                      <button
                        onClick={() => router.push(`/league/pool/${pool.id}`)}
                        style={{ marginLeft: isAdminView ? 'auto' : undefined, display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.7rem', background: 'transparent', color: greenHi, border: `1px solid oklch(46% 0.14 155 / 0.4)`, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}
                      >
                        Manage Pool
                      </button>
                    </div>

                    {current.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.85rem' }}>
                        {current.map(p => (
                          <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', ...b, fontSize: '0.78rem', color: textMid, background: surface, border: `1px solid ${border}`, borderRadius: 999, padding: '0.25rem 0.5rem 0.25rem 0.7rem' }}>
                            {p.name}
                            <button onClick={() => handleRemoveFromPool(p.id, pool.id)} title="Remove from pool" style={{ display: 'flex', background: 'transparent', border: 'none', color: textDim, cursor: 'pointer', padding: 0 }}>
                              <X style={{ width: 11, height: 11 }} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {notYetIn.length > 0 && (
                      <div>
                        <p style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Add from roster</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                          {notYetIn.map(m => (
                            <button key={m.id} onClick={() => handleAddToPool(m, pool.id)} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', ...b, fontSize: '0.78rem', color: greenHi, background: 'oklch(46% 0.14 155 / 0.12)', border: `1px solid oklch(46% 0.14 155 / 0.4)`, borderRadius: 999, padding: '0.25rem 0.6rem', cursor: 'pointer' }}>
                              <Plus style={{ width: 11, height: 11 }} /> {m.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {!isAdminView && (
        <>
          <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${liveRed}, transparent)` }} />

          {/* ── DANGER ZONE ── */}
          <section style={{ background: bg, padding: '2.5rem 0 3rem' }}>
            <div className="lp-inner">
              <div style={{ background: card, border: `1px solid color-mix(in oklch, ${liveRed} 35%, ${border})`, borderRadius: 8, padding: '1.25rem', maxWidth: 560 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                  <Trash2 style={{ width: 16, height: 16, color: liveRed }} />
                  <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', color: liveRed, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Danger Zone</p>
                </div>
                <p style={{ ...b, fontSize: '0.8rem', color: textDim, marginBottom: '1rem' }}>
                  Deleting {leagueName} is permanent. It must have no pools left — transfer or delete them first.
                </p>

                <Dialog
                  open={deleteHuddleOpen}
                  onOpenChange={(open) => { setDeleteHuddleOpen(open); if (!open) { setDeleteHuddleConfirmation(''); setDeleteCascadePools(false); } }}
                >
                  <DialogTrigger asChild>
                    <button type="button" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.85rem', background: `color-mix(in oklch, ${liveRed} 15%, ${surface})`, color: liveRed, border: `1px solid color-mix(in oklch, ${liveRed} 40%, ${border})`, borderRadius: 6, cursor: 'pointer', ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      <Trash2 style={{ width: 12, height: 12 }} />
                      Delete Huddle
                    </button>
                  </DialogTrigger>
                  <DialogContent style={{ maxWidth: '28rem', background: card, border: `1px solid ${border}` }}>
                    <DialogHeader>
                      <DialogTitle style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: liveRed, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Delete Huddle</DialogTitle>
                      <DialogDescription asChild>
                        <div style={{ ...b, fontSize: '0.8rem', color: textDim }}>
                          <p style={{ marginBottom: '0.5rem' }}>Are you sure you want to delete &quot;{leagueName}&quot;? This action cannot be undone.</p>
                          <p>Its roster will be deleted too. By default it must have zero pools — check the box below to delete its pools too.</p>
                        </div>
                      </DialogDescription>
                    </DialogHeader>

                    <div style={{ padding: '0.75rem 0' }}>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer', marginBottom: '1rem' }}>
                        <Checkbox
                          checked={deleteCascadePools}
                          onCheckedChange={(v) => setDeleteCascadePools(v === true)}
                          style={{ marginTop: '0.15rem' }}
                        />
                        <span style={{ ...b, fontSize: '0.8rem', color: text, lineHeight: 1.5 }}>
                          Also delete every pool in this Huddle — and everything tied to them: participants, picks, scores, standings, and winners. This cannot be undone.
                        </span>
                      </label>
                      {deleteCascadePools && (
                        <div style={{ background: 'oklch(20% 0.06 25)', border: `1px solid color-mix(in oklch, ${liveRed} 40%, transparent)`, borderRadius: 6, padding: '0.6rem 0.85rem', marginBottom: '1rem' }}>
                          <p style={{ ...b, fontSize: '0.76rem', color: 'oklch(85% 0.09 25)' }}>
                            This will permanently erase every pool in &quot;{leagueName}&quot; and all of their history. There is no undo.
                          </p>
                        </div>
                      )}

                      <p style={{ ...b, fontSize: '0.8rem', color: textMid, marginBottom: '0.5rem' }}>
                        To confirm deletion, type <span style={{ fontFamily: 'monospace', fontWeight: 700, color: liveRed }}>{leagueName}</span> below:
                      </p>
                      <input
                        type="text"
                        placeholder="Enter League name to confirm"
                        value={deleteHuddleConfirmation}
                        onChange={(e) => setDeleteHuddleConfirmation(e.target.value)}
                        style={{ ...inputStyle, border: `1px solid ${deleteHuddleConfirmation.length > 0 ? (deleteHuddleConfirmation === leagueName ? 'oklch(50% 0.14 155)' : liveRed) : border}` }}
                      />
                      {deleteHuddleConfirmation.length > 0 && (
                        <p style={{ ...b, fontSize: '0.75rem', color: deleteHuddleConfirmation === leagueName ? 'oklch(59% 0.15 155)' : liveRed, marginTop: '0.25rem' }}>
                          {deleteHuddleConfirmation === leagueName ? '✓ Name matches — deletion enabled' : '✗ Name does not match'}
                        </p>
                      )}
                    </div>

                    <DialogFooter style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      <button type="button" onClick={() => setDeleteHuddleOpen(false)} style={{ ...bc, padding: '0.45rem 0.85rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 6, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteHuddle}
                        disabled={isDeletingHuddle || deleteHuddleConfirmation !== leagueName}
                        style={{ ...bc, display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.85rem', background: (isDeletingHuddle || deleteHuddleConfirmation !== leagueName) ? surface : `color-mix(in oklch, ${liveRed} 20%, ${surface})`, color: (isDeletingHuddle || deleteHuddleConfirmation !== leagueName) ? textDim : liveRed, border: `1px solid ${(isDeletingHuddle || deleteHuddleConfirmation !== leagueName) ? border : `color-mix(in oklch, ${liveRed} 40%, ${border})`}`, borderRadius: 6, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: (isDeletingHuddle || deleteHuddleConfirmation !== leagueName) ? 'not-allowed' : 'pointer' }}
                      >
                        <Trash2 style={{ width: 12, height: 12 }} />
                        {isDeletingHuddle ? 'Deleting…' : 'Delete Huddle'}
                      </button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </section>
        </>
      )}

      {!isAdminView && (
        <CreatePoolDialog
          open={createPoolOpen}
          onOpenChange={setCreatePoolOpen}
          onPoolCreated={() => {
            load();
            toast({ title: 'Pool Created', description: 'New pool is now part of your League.' });
          }}
          leagueName={leagueName}
          huddleId={huddleId}
        />
      )}
    </div>
  );
}
