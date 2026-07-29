'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Users } from 'lucide-react';
import { useAuth, AuthProvider } from '@/lib/auth';
import { AdminGuard } from '@/components/auth/admin-guard';
import { loadAllHuddlesForCommissioner, createAdditionalHuddleForCommissioner } from '@/actions/huddles';
import { LeagueManager } from '@/components/league/league-manager';
import { useToast } from '@/hooks/use-toast';
import { debugError } from '@/lib/utils';

const bg      = 'oklch(13% 0.025 255)';
const surface = 'oklch(17% 0.028 255)';
const card    = 'oklch(20% 0.03 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

interface HuddleRecord {
  id: string;
  name: string;
}

function LeagueContent() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [huddles, setHuddles] = useState<HuddleRecord[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [newHuddleName, setNewHuddleName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const load = useCallback(async () => {
    if (!user?.email) return;
    try {
      const list = await loadAllHuddlesForCommissioner(user.email);
      setHuddles(list);
      setSelectedId(prev => prev && list.some(h => h.id === prev) ? prev : (list[0]?.id ?? null));
    } catch (err) {
      debugError('[SH][UI][POOL] Failed to load Huddles:', err);
    }
  }, [user?.email]);

  useEffect(() => { load(); }, [load]);

  const handleCreateHuddle = async () => {
    if (!user?.email) return;
    setIsCreating(true);
    try {
      const result = await createAdditionalHuddleForCommissioner(user.email, newHuddleName);
      if (!result.success) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
        return;
      }
      setNewHuddleName('');
      setCreatingOpen(false);
      await load();
      setSelectedId(result.huddle.id);
      toast({ title: 'Huddle Created', description: result.huddle.name });
    } finally {
      setIsCreating(false);
    }
  };

  if (!huddles || !selectedId) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
        <div className="animate-spin rounded-full h-16 w-16" style={{ borderWidth: '3px', borderStyle: 'solid', borderColor: border, borderTopColor: green }} />
      </div>
    );
  }

  return (
    <div style={{ background: bg, minHeight: '100vh' }}>
      {huddles.length > 1 && (
        <div style={{ background: surface, borderBottom: `1px solid ${border}`, padding: '0.75rem 0' }}>
          <div className="lp-inner" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {huddles.map(h => (
              <button
                key={h.id}
                onClick={() => setSelectedId(h.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.8rem',
                  background: selectedId === h.id ? green : 'transparent',
                  color: selectedId === h.id ? text : textMid,
                  border: `1px solid ${selectedId === h.id ? green : border}`,
                  borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer',
                }}
              >
                <Users style={{ width: 12, height: 12 }} /> {h.name}
              </button>
            ))}
            <button
              onClick={() => setCreatingOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.8rem', marginLeft: 'auto', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}
            >
              <Plus style={{ width: 12, height: 12 }} /> New Huddle
            </button>
          </div>
        </div>
      )}

      {huddles.length === 1 && (
        <div style={{ background: surface, borderBottom: `1px solid ${border}`, padding: '0.6rem 0' }}>
          <div className="lp-inner" style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setCreatingOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.7rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}
            >
              <Plus style={{ width: 11, height: 11 }} /> Create Another Huddle
            </button>
          </div>
        </div>
      )}

      {creatingOpen && (
        <div style={{ background: card, borderBottom: `1px solid ${border}`, padding: '1rem 0' }}>
          <div className="lp-inner" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              autoFocus
              placeholder="New Huddle name"
              value={newHuddleName}
              onChange={e => setNewHuddleName(e.target.value)}
              style={{ ...b, flex: '1 1 220px', background: surface, border: `1px solid ${border}`, color: text, padding: '0.5rem 0.75rem', borderRadius: 6, fontSize: '0.85rem', boxSizing: 'border-box' }}
            />
            <button
              onClick={handleCreateHuddle}
              disabled={isCreating || newHuddleName.trim().length < 3}
              style={{ padding: '0.5rem 0.9rem', background: green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: (isCreating || newHuddleName.trim().length < 3) ? 'not-allowed' : 'pointer', opacity: (isCreating || newHuddleName.trim().length < 3) ? 0.6 : 1 }}
            >
              {isCreating ? 'Creating…' : 'Create'}
            </button>
            <button
              onClick={() => { setCreatingOpen(false); setNewHuddleName(''); }}
              style={{ padding: '0.5rem 0.9rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
          <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.5rem' }} className="lp-inner">
            Each Huddle has its own roster and pools. Your plan determines how many Huddles you can run.
          </p>
        </div>
      )}

      <LeagueManager
        key={selectedId}
        huddleId={selectedId}
        initialName={huddles.find(h => h.id === selectedId)?.name ?? ''}
        onBack={() => router.push('/dashboard')}
        backLabel="Back"
      />
    </div>
  );
}

export default function LeaguePage() {
  return (
    <AuthProvider>
      <AdminGuard>
        <LeagueContent />
      </AdminGuard>
    </AuthProvider>
  );
}
