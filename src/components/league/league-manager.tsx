'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Users, Trophy, Plus, X, Pencil, ShieldCheck, ShieldOff, UserPlus } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { renameHuddle, setHuddleActive } from '@/actions/huddles';
import { loadHuddleMembers, addHuddleMember, removeHuddleMember, addHuddleMemberToPool, HuddleMember } from '@/actions/huddleMembers';
import { loadPoolsByHuddleId } from '@/actions/loadPools';
import { getPoolParticipants, removeParticipantFromPool } from '@/actions/adminActions';
import { CreatePoolDialog } from '@/components/pools/create-pool-dialog';
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
  const { user } = useAuth();
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

  const handleRename = async () => {
    const result = await renameHuddle(huddleId, nameDraft);
    if (!result.success) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
      return;
    }
    setLeagueName(nameDraft.trim());
    setEditingName(false);
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
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'oklch(13% 0.025 255 / 0.95)', backdropFilter: 'blur(14px)', borderBottom: `1px solid ${border}` }}>
        <div className="lp-inner" style={{ paddingTop: '0.75rem', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
            <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.6rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer', flexShrink: 0 }}>
              <ArrowLeft style={{ width: 12, height: 12 }} /> {backLabel}
            </button>
            <div style={{ width: 1, height: 20, background: border, flexShrink: 0 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: gold, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Trophy style={{ width: 14, height: 14, color: bg }} />
              </div>
              <span style={{ ...bc, fontWeight: 800, fontSize: '0.92rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                {isAdminView ? 'Manage League' : 'Manage Your League'}
              </span>
            </div>
          </div>
        </div>
      </nav>

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
        </div>
      </section>

      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${green}, transparent)` }} />

      {/* ── ROSTER ── */}
      <section style={{ background: bg, padding: '2.5rem 0' }}>
        <div className="lp-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <span style={{ display: 'block', width: 3, height: 22, background: green, borderRadius: 2 }} />
            <h2 style={{ ...bc, fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.06em', color: text, textTransform: 'uppercase' }}>League Roster ({members.length})</h2>
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
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {members.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: surface, border: `1px solid ${border}`, borderRadius: 8, padding: '0.75rem 1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ ...b, fontSize: '0.88rem', color: text, fontWeight: 600 }}>{m.name}</span>
                    <span style={{ ...b, fontSize: '0.78rem', color: textDim, marginLeft: '0.6rem', fontStyle: m.email ? 'normal' : 'italic' }}>
                      {m.email ?? 'No email — notify manually'}
                    </span>
                  </div>
                  <span style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.08em', color: textDim, background: 'oklch(26% 0.03 255 / 0.6)', padding: '0.15rem 0.5rem', borderRadius: 4, textTransform: 'uppercase' }}>
                    In {m.poolIds.length} of {pools.length} pool{pools.length === 1 ? '' : 's'}
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
                const notYetIn = members.filter(m => !m.poolIds.includes(pool.id));
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
                      <button
                        onClick={() => router.push(`/league/pool/${pool.id}`)}
                        style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.7rem', background: 'transparent', color: greenHi, border: `1px solid oklch(46% 0.14 155 / 0.4)`, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}
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
