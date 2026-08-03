'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Users, Trophy, ChevronRight, ArrowLeft } from 'lucide-react';
import { useAuth, AuthProvider } from '@/lib/auth';
import { AdminGuard } from '@/components/auth/admin-guard';
import { AppNav } from '@/components/layout/AppNav';
import { loadHuddleForCommissioner, loadAllHuddlesForCommissioner, createAdditionalHuddleForCommissioner, CommissionerHuddleSummary } from '@/actions/huddles';
import { useToast } from '@/hooks/use-toast';
import { debugError, createPageUrl } from '@/lib/utils';

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

function MyHuddlesContent() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await signOut();
      router.push(createPageUrl(user?.is_super_admin ? 'adminlogin' : 'login'));
    } catch (err) {
      debugError('Error signing out:', err);
    }
  };

  const [huddles, setHuddles] = useState<CommissionerHuddleSummary[] | null>(null);
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [newHuddleName, setNewHuddleName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const load = useCallback(async () => {
    if (!user?.email) return;
    try {
      // Guarantees at least one Huddle exists (first-time commissioners).
      await loadHuddleForCommissioner(user.email);
      const list = await loadAllHuddlesForCommissioner(user.email);
      setHuddles(list);
    } catch (err) {
      debugError('Failed to load Huddles:', err);
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
      toast({ title: 'Huddle Created', description: result.huddle.name });
    } finally {
      setIsCreating(false);
    }
  };

  if (!huddles) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
        <div className="animate-spin rounded-full h-16 w-16" style={{ borderWidth: '3px', borderStyle: 'solid', borderColor: border, borderTopColor: green }} />
      </div>
    );
  }

  return (
    <div style={{ background: bg, minHeight: '100vh' }}>
      {/* ── NAV ── */}
      <AppNav isAuthenticated isSuperAdmin={user?.is_super_admin === true} onSignOut={handleLogout} />

      <section style={{ background: bg, padding: '2.5rem 0 3rem' }}>
        <div className="lp-inner">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ display: 'block', width: 3, height: 22, background: green, borderRadius: 2 }} />
              <h1 style={{ ...bc, fontWeight: 900, fontSize: '1.4rem', letterSpacing: '-0.01em', color: text, textTransform: 'uppercase' }}>
                Your Huddles ({huddles.length})
              </h1>
            </div>
            <button
              onClick={() => setCreatingOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.9rem', background: green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
            >
              <Plus style={{ width: 13, height: 13 }} /> Create Huddle
            </button>
          </div>

          {creatingOpen && (
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
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
              <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.5rem' }}>
                Each Huddle has its own roster and pools. Your plan determines how many Huddles you can run.
              </p>
            </div>
          )}

          {huddles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', background: surface, border: `1px solid ${border}`, borderRadius: 8 }}>
              <Users style={{ width: 32, height: 32, color: textDim, margin: '0 auto 0.75rem' }} />
              <p style={{ ...b, color: textDim, fontSize: '0.9rem' }}>No Huddles yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {huddles.map(h => (
                <button
                  key={h.id}
                  onClick={() => router.push(`/league/${h.id}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '1rem', width: '100%', textAlign: 'left',
                    background: surface, border: `1px solid ${border}`, borderLeft: `3px solid ${green}`, borderRadius: 8,
                    padding: '1.1rem 1.25rem', cursor: 'pointer',
                  }}
                >
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: `linear-gradient(135deg, ${green}, ${greenHi})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Trophy style={{ width: 16, height: 16, color: text }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ ...bc, fontWeight: 800, fontSize: '1.05rem', color: text }}>{h.name}</p>
                    <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginTop: '0.1rem' }}>
                      {h.poolCount} pool{h.poolCount === 1 ? '' : 's'}
                    </p>
                  </div>
                  <ChevronRight style={{ width: 16, height: 16, color: textMid, flexShrink: 0 }} />
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default function MyHuddlesPage() {
  return (
    <AuthProvider>
      <AdminGuard>
        <MyHuddlesContent />
      </AdminGuard>
    </AuthProvider>
  );
}
