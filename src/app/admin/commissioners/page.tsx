'use client';

import { useState, useMemo, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft, Search, Users, Eye, EyeOff,
  RefreshCw, Key, UserX, UserCheck, Trash2, LogOut, AlertTriangle, Zap,
  ChevronLeft, ChevronRight, Send,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { AuthProvider } from '@/lib/auth';
import { AdminGuard } from '@/components/auth/admin-guard';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Footer } from '@/components/layout/Footer';
import { useToast } from '@/hooks/use-toast';
import { useAdminDomain } from '@/lib/admin-domain.client';
import { AdminUser } from '@/lib/admin-domain.types';
import { AdminDomainRules } from '@/lib/admin-domain.rules';

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
const PAGE_SIZE = 10;

function planColor(plan: string) {
  if (plan === 'pro')      return greenHi;
  if (plan === 'standard') return gold;
  return textDim;
}

const inputStyle = {
  ...b, background: surface, border: `1px solid ${border}`, color: text,
  padding: '0.5rem 0.75rem', width: '100%', borderRadius: 6,
  boxSizing: 'border-box' as const, fontSize: '0.875rem',
};

function CommissionersManagementContent() {
  const { signOut, user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { commissioners, stats, isLoading, refresh, actions } = useAdminDomain();

  const [searchTerm, setSearchTerm]                   = useState('');
  const [page, setPage]                               = useState(0);
  const [isLoggingOut, setIsLoggingOut]               = useState(false);
  const [isProcessing, setIsProcessing]               = useState(false);
  const [selected, setSelected]                       = useState<AdminUser | null>(null);
  const [resetOpen, setResetOpen]                     = useState(false);
  const [newPassword, setNewPassword]                 = useState('');
  const [showPassword, setShowPassword]               = useState(false);
  const [passwordError, setPasswordError]             = useState('');

  // Plan upgrade
  const [planOpen, setPlanOpen]         = useState(false);
  const [planTarget, setPlanTarget]     = useState<AdminUser | null>(null);
  const [planCurrent, setPlanCurrent]   = useState<{ plan: string; isTrialActive: boolean; daysLeft: number } | null>(null);
  const [planSelected, setPlanSelected] = useState<'free' | 'standard' | 'pro'>('free');
  const [planTrialDays, setPlanTrialDays] = useState(0);
  const [planFetching, setPlanFetching] = useState(false);
  const [planSaving, setPlanSaving]     = useState(false);
  const [planError, setPlanError]       = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoGroup, setPromoGroup]     = useState<'free' | 'standard'>('free');

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return q
      ? commissioners.filter(c => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q))
      : commissioners;
  }, [commissioners, searchTerm]);

  useEffect(() => { setPage(0); }, [searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleToggle = async (c: AdminUser) => {
    setIsProcessing(true);
    await actions.toggle(c);
    setIsProcessing(false);
  };

  const handleDelete = async (c: AdminUser) => {
    setIsProcessing(true);
    await actions.remove(c);
    setIsProcessing(false);
  };

  const handleResetPassword = async () => {
    if (!selected) return;
    const err = AdminDomainRules.validatePassword(newPassword.trim());
    if (err) { setPasswordError(err); return; }
    setPasswordError('');
    setIsProcessing(true);
    await actions.resetPassword(selected, newPassword.trim());
    setIsProcessing(false);
    setResetOpen(false);
    setNewPassword('');
    setSelected(null);
  };

  const promoCounts = {
    free:     commissioners.filter(c => c.isActive && c.plan === 'free').length,
    standard: commissioners.filter(c => c.isActive && c.plan === 'standard').length,
  };
  const promoTargetCount = promoCounts[promoGroup];

  const handleSendPromo = async () => {
    setPromoLoading(true);
    try {
      const res = await fetch('/api/super-admin/send-promotion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-email': user?.email ?? '' },
        body: JSON.stringify({ group: promoGroup }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to send promotions');
      toast({ title: 'Promotions Sent', description: `Sent to ${data.sent} commissioner${data.sent !== 1 ? 's' : ''}` });
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed to send', variant: 'destructive' });
    } finally {
      setPromoLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try { await signOut(); router.push('/admin/login'); }
    catch { setIsLoggingOut(false); }
  };

  const handleOpenPlan = async (c: AdminUser) => {
    setPlanTarget(c);
    setPlanCurrent(null);
    setPlanSelected('free');
    setPlanTrialDays(0);
    setPlanError('');
    setPlanOpen(true);
    setPlanFetching(true);
    try {
      const res = await fetch(`/api/admin/plan-status?adminId=${c.id}`);
      const data = await res.json();
      if (data.success) {
        setPlanCurrent({ plan: data.plan, isTrialActive: data.isTrialActive, daysLeft: data.daysLeft });
        setPlanSelected(data.plan as 'free' | 'standard' | 'pro');
      }
    } catch { /* ignore */ } finally {
      setPlanFetching(false);
    }
  };

  const handleUpdatePlan = async () => {
    if (!planTarget) return;
    setPlanSaving(true);
    setPlanError('');
    try {
      const res = await fetch('/api/super-admin/update-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: planTarget.id, plan: planSelected, trialDays: planTrialDays }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to update plan');
      setPlanOpen(false);
    } catch (e) {
      setPlanError(e instanceof Error ? e.message : 'Failed to update plan');
    } finally {
      setPlanSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
        <div className="animate-spin rounded-full h-16 w-16" style={{ borderWidth: '3px', borderStyle: 'solid', borderColor: border, borderTopColor: green }} />
      </div>
    );
  }

  const statItems = [
    { label: 'Total',    value: stats.commissioners, color: gold,    sub: 'All time' },
    { label: 'Active',   value: stats.active,        color: greenHi, sub: 'Currently active' },
    { label: 'Inactive', value: stats.inactive,      color: liveRed, sub: 'Deactivated' },
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
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: green, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Users style={{ width: 14, height: 14, color: text }} />
                </div>
                <span style={{ ...bc, fontWeight: 800, fontSize: '0.92rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase' }}>Commissioners</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
              <button onClick={refresh} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.75rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 6, ...bc, fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}>
                <RefreshCw style={{ width: 12, height: 12 }} /> Refresh
              </button>
              <button onClick={() => router.push('/admin/create-commissioner')} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.75rem', background: green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <Users style={{ width: 12, height: 12 }} /> Add Commissioner
              </button>
              <button onClick={handleLogout} disabled={isLoggingOut} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.75rem', background: liveRed, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: isLoggingOut ? 'not-allowed' : 'pointer', opacity: isLoggingOut ? 0.6 : 1 }}>
                <LogOut style={{ width: 12, height: 12 }} /> Logout
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
          <div className="admin-3col-grid" style={{ marginBottom: 0 }}>
            {statItems.map(({ label, value, color, sub }) => (
              <div key={label} style={{ background: card, border: `1px solid ${border}`, borderLeft: `3px solid ${color}`, borderRadius: 8, padding: '1.25rem' }}>
                <div style={{ ...bc, fontWeight: 900, fontSize: '2.25rem', color, lineHeight: 1, letterSpacing: '0.02em' }}>{value}</div>
                <div style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', color: text, letterSpacing: '0.07em', textTransform: 'uppercase', marginTop: '0.3rem' }}>{label}</div>
                <div style={{ ...b, fontSize: '0.7rem', color: textDim, marginTop: '0.15rem' }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* Plan breakdown */}
          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '1.1rem 1.5rem', marginTop: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem', flexWrap: 'wrap' as const }}>
            <div>
              <div style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', color: textDim, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.65rem' }}>Accounts by Plan</div>
              <div style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap' as const }}>
                {([
                  { label: 'Free',     value: stats.byPlan.free,     color: textDim },
                  { label: 'Standard', value: stats.byPlan.standard, color: gold },
                  { label: 'Pro',      value: stats.byPlan.pro,      color: greenHi },
                ]).map(({ label, value, color }) => (
                  <div key={label}>
                    <div style={{ ...bc, fontWeight: 900, fontSize: '2rem', color, lineHeight: 1 }}>{value}</div>
                    <div style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', color: text, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '0.25rem' }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  disabled={promoLoading || (promoCounts.free === 0 && promoCounts.standard === 0)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem', background: (promoCounts.free === 0 && promoCounts.standard === 0) ? 'transparent' : 'oklch(74% 0.16 72 / 0.1)', color: (promoCounts.free === 0 && promoCounts.standard === 0) ? textDim : gold, border: `1px solid ${(promoCounts.free === 0 && promoCounts.standard === 0) ? border : 'oklch(74% 0.16 72 / 0.45)'}`, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: (promoCounts.free === 0 && promoCounts.standard === 0) ? 'not-allowed' : 'pointer', opacity: promoLoading ? 0.6 : 1, flexShrink: 0 }}
                >
                  <Send style={{ width: 13, height: 13 }} />
                  {promoLoading ? 'Sending…' : 'Send Promo'}
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Send Promotional Email
                  </AlertDialogTitle>
                  <AlertDialogDescription style={{ color: textMid }}>
                    Choose which group of active commissioners should receive an upgrade offer email with a plan comparison and a link to sign in.
                  </AlertDialogDescription>
                </AlertDialogHeader>

                <div>
                  <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.1em', color: textDim, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Target Group</p>
                  <div style={{ display: 'flex', gap: '0.35rem', background: 'oklch(13% 0.025 255)', border: `1px solid ${border}`, borderRadius: 6, padding: '0.25rem' }}>
                    {(['free', 'standard'] as const).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setPromoGroup(g)}
                        style={{
                          flex: 1, padding: '0.4rem 0.5rem',
                          background: promoGroup === g ? (g === 'standard' ? 'oklch(74% 0.16 72 / 0.2)' : 'oklch(30% 0.03 255)') : 'transparent',
                          color: promoGroup === g ? (g === 'standard' ? gold : textMid) : textDim,
                          border: `1px solid ${promoGroup === g ? (g === 'standard' ? 'oklch(74% 0.16 72 / 0.5)' : border) : 'transparent'}`,
                          borderRadius: 4,
                          ...bc, fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.07em', textTransform: 'uppercase',
                          cursor: 'pointer',
                        }}
                      >
                        {g === 'free' ? 'Free Only' : 'Standard'}
                      </button>
                    ))}
                  </div>
                  <p style={{ ...b, fontSize: '0.78rem', color: textMid, marginTop: '0.5rem' }}>
                    Will send to <strong style={{ color: text }}>{promoTargetCount} commissioner{promoTargetCount !== 1 ? 's' : ''}</strong> on the {promoGroup} plan.
                  </p>
                </div>

                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleSendPromo} disabled={promoTargetCount === 0} style={{ background: gold, color: 'oklch(13% 0.025 255)', border: 'none', opacity: promoTargetCount === 0 ? 0.5 : 1 }}>
                    {promoLoading ? 'Sending…' : 'Send Emails'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </section>

      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${green}, transparent)` }} />

      {/* ── LIST ── */}
      <section id="commissioners-list" style={{ background: bg, padding: '3rem 0' }}>
        <div className="lp-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <span style={{ display: 'block', width: 3, height: 22, background: green, borderRadius: 2 }} />
            <h3 style={{ ...bc, fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.06em', color: text, textTransform: 'uppercase' }}>
              All Commissioners ({filtered.length})
            </h3>
          </div>
          {filtered.length > 0 && (
            <p style={{ ...b, fontSize: '0.75rem', color: textDim, marginBottom: '1rem', marginTop: '-0.75rem' }}>
              Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
          )}

          <div style={{ marginBottom: '1.25rem', maxWidth: 400 }}>
            <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: textDim }} />
              <Input
                placeholder="Search by name or email…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ background: card, border: `1px solid ${border}`, color: text, ...b, fontSize: '0.85rem', paddingLeft: '2.25rem' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', background: surface, border: `1px solid ${border}`, borderRadius: 8 }}>
                <Users style={{ width: 40, height: 40, color: textDim, margin: '0 auto 1rem' }} />
                <p style={{ ...b, color: textDim, fontSize: '0.9rem' }}>
                  {searchTerm ? 'No commissioners match your search.' : 'No commissioners created yet.'}
                </p>
              </div>
            ) : paginated.map((c) => (
              <div key={c.id} style={{ background: surface, border: `1px solid ${border}`, borderRadius: 8, padding: '1.25rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg, oklch(46% 0.14 155), oklch(62% 0.12 270))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ ...bc, fontWeight: 900, fontSize: '1rem', color: text }}>
                        {(c.name?.charAt(0) || c.email.charAt(0)).toUpperCase()}
                      </span>
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
                        <span style={{ ...bc, fontWeight: 700, fontSize: '1rem', color: text }}>{c.name || 'Unnamed Commissioner'}</span>
                        <span style={{ ...bc, fontWeight: 600, fontSize: '0.65rem', letterSpacing: '0.1em', color: c.isActive ? greenHi : liveRed, background: c.isActive ? 'oklch(46% 0.14 155 / 0.15)' : 'oklch(50% 0.22 25 / 0.15)', padding: '0.15rem 0.4rem', borderRadius: 4, textTransform: 'uppercase' }}>
                          {c.isActive ? 'Active' : 'Inactive'}
                        </span>
                        <span style={{ ...bc, fontWeight: 700, fontSize: '0.63rem', letterSpacing: '0.1em', color: planColor(c.plan), background: `${planColor(c.plan)}1a`, border: `1px solid ${planColor(c.plan)}55`, padding: '0.15rem 0.4rem', borderRadius: 4, textTransform: 'uppercase' }}>
                          {c.plan}{c.isTrialActive ? ` · ${c.daysLeft}d trial` : ''}
                        </span>
                      </div>
                      <p style={{ ...b, fontSize: '0.82rem', color: textMid }}>{c.email}</p>
                      <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.2rem' }}>
                        Created {new Date(c.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <button
                      onClick={() => handleOpenPlan(c)}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.7rem', background: 'oklch(46% 0.14 155 / 0.12)', color: greenHi, border: `1px solid oklch(46% 0.14 155 / 0.4)`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
                    >
                      <Zap style={{ width: 11, height: 11 }} /> Change Plan
                    </button>
                    <button
                      onClick={() => { setSelected(c); setResetOpen(true); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.7rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
                    >
                      <Key style={{ width: 11, height: 11 }} /> Reset Password
                    </button>

                    {AdminDomainRules.canToggle(c) && (
                      <button
                        onClick={() => handleToggle(c)}
                        disabled={isProcessing}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.7rem', background: c.isActive ? 'oklch(50% 0.22 25 / 0.15)' : 'oklch(46% 0.14 155 / 0.15)', color: c.isActive ? liveRed : greenHi, border: `1px solid ${c.isActive ? liveRed : greenHi}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: isProcessing ? 'not-allowed' : 'pointer', opacity: isProcessing ? 0.6 : 1 }}
                      >
                        {c.isActive
                          ? <><UserX style={{ width: 11, height: 11 }} /> Deactivate</>
                          : <><UserCheck style={{ width: 11, height: 11 }} /> Activate</>}
                      </button>
                    )}

                    {AdminDomainRules.canDelete(c) && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            disabled={isProcessing}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.7rem', background: 'oklch(50% 0.22 25 / 0.15)', color: liveRed, border: `1px solid ${liveRed}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: isProcessing ? 'not-allowed' : 'pointer', opacity: isProcessing ? 0.6 : 1 }}
                          >
                            <Trash2 style={{ width: 11, height: 11 }} /> Delete
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: liveRed, ...bc, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                              <AlertTriangle style={{ width: 16, height: 16 }} /> Delete Commissioner
                            </AlertDialogTitle>
                            <AlertDialogDescription style={{ color: textMid }}>
                              Permanently delete <strong style={{ color: text }}>{c.name || c.email}</strong>? This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(c)}
                              disabled={isProcessing}
                              style={{ background: 'oklch(50% 0.22 25 / 0.2)', color: liveRed, border: `1px solid ${liveRed}`, opacity: isProcessing ? 0.6 : 1 }}
                            >
                              {isProcessing ? 'Deleting…' : 'Delete Permanently'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              </div>
            ))}
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

      <Footer pageName="Commissioner HQ" />

      {/* Plan Upgrade Dialog */}
      <Dialog open={planOpen} onOpenChange={(o) => { setPlanOpen(o); if (!o) { setPlanTarget(null); setPlanCurrent(null); setPlanError(''); } }}>
        <DialogContent style={{ maxWidth: '26rem', background: card, border: `1px solid ${border}` }}>
          <DialogHeader>
            <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              <Zap style={{ width: 15, height: 15, color: greenHi }} /> Change Plan
            </DialogTitle>
            <DialogDescription style={{ ...b, fontSize: '0.8rem', color: textDim }}>
              {planTarget?.name || planTarget?.email}
            </DialogDescription>
          </DialogHeader>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', paddingTop: '0.25rem' }}>

            {/* Current status */}
            {planFetching ? (
              <p style={{ ...b, fontSize: '0.8rem', color: textDim }}>Loading current plan…</p>
            ) : planCurrent && (
              <div style={{ padding: '0.65rem 0.875rem', background: 'oklch(17% 0.028 255)', border: `1px solid ${border}`, borderRadius: 7 }}>
                <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.1em', color: textDim, textTransform: 'uppercase', marginBottom: '0.2rem' }}>Current Plan</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ ...bc, fontWeight: 800, fontSize: '0.95rem', color: planCurrent.plan === 'pro' ? greenHi : planCurrent.plan === 'standard' ? gold : textMid, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {planCurrent.plan}
                  </span>
                  {planCurrent.isTrialActive && (
                    <span style={{ ...bc, fontSize: '0.65rem', fontWeight: 700, color: gold, background: 'oklch(74% 0.16 72 / 0.12)', border: `1px solid oklch(74% 0.16 72 / 0.35)`, padding: '0.1rem 0.4rem', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Trial · {planCurrent.daysLeft}d left
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Plan selector */}
            <div>
              <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.1em', color: textDim, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Set Plan</p>
              <div style={{ display: 'flex', gap: '0.35rem', background: 'oklch(13% 0.025 255)', border: `1px solid ${border}`, borderRadius: 6, padding: '0.25rem' }}>
                {(['free', 'standard', 'pro'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlanSelected(p)}
                    style={{
                      flex: 1, padding: '0.4rem 0.5rem',
                      background: planSelected === p
                        ? p === 'pro' ? green : p === 'standard' ? 'oklch(74% 0.16 72 / 0.2)' : 'oklch(30% 0.03 255)'
                        : 'transparent',
                      color: planSelected === p
                        ? p === 'pro' ? text : p === 'standard' ? gold : textMid
                        : textDim,
                      border: `1px solid ${planSelected === p
                        ? p === 'pro' ? green : p === 'standard' ? 'oklch(74% 0.16 72 / 0.5)' : border
                        : 'transparent'}`,
                      borderRadius: 4,
                      ...bc, fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.07em', textTransform: 'uppercase',
                      cursor: 'pointer',
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.4rem' }}>
                {planSelected === 'free' && '1 pool · 15 participants per pool'}
                {planSelected === 'standard' && '1 pool · 30 participants per pool'}
                {planSelected === 'pro' && '3 pools · 75 participants per pool'}
              </p>
            </div>

            {/* Trial extension */}
            <div>
              <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.1em', color: textDim, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                Grant Trial Days <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={planTrialDays}
                  onChange={e => setPlanTrialDays(Math.max(0, parseInt(e.target.value) || 0))}
                  style={{ ...b, background: 'oklch(13% 0.025 255)', border: `1px solid ${border}`, color: text, padding: '0.45rem 0.65rem', borderRadius: 6, fontSize: '0.875rem', width: '5rem', textAlign: 'center' }}
                />
                <span style={{ ...b, fontSize: '0.8rem', color: textDim }}>days from today</span>
              </div>
              <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.35rem' }}>
                {planTrialDays > 0
                  ? `Trial grants Standard access for ${planTrialDays} days, regardless of plan setting above.`
                  : 'Leave at 0 to keep existing trial date unchanged.'}
              </p>
            </div>

            {planError && (
              <p style={{ ...b, fontSize: '0.78rem', color: liveRed, background: `oklch(62% 0.22 25 / 0.08)`, border: `1px solid oklch(62% 0.22 25 / 0.3)`, borderRadius: 5, padding: '0.4rem 0.65rem' }}>
                {planError}
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button onClick={() => setPlanOpen(false)} style={{ padding: '0.45rem 0.875rem', background: 'transparent', border: `1px solid ${border}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.78rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: textMid, cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={handleUpdatePlan}
                disabled={planSaving || planFetching}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.875rem', background: planSaving || planFetching ? border : green, color: planSaving || planFetching ? textDim : text, border: 'none', borderRadius: 5, ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: planSaving || planFetching ? 'not-allowed' : 'pointer' }}
              >
                <Zap style={{ width: 12, height: 12 }} />
                {planSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetOpen} onOpenChange={(o) => { setResetOpen(o); if (!o) { setNewPassword(''); setSelected(null); setPasswordError(''); } }}>
        <DialogContent style={{ maxWidth: '26rem' }}>
          <DialogHeader>
            <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              <Key style={{ width: 16, height: 16, color: greenHi }} /> Reset Password
            </DialogTitle>
            <DialogDescription style={{ ...b, fontSize: '0.8rem', color: textDim }}>
              Set a new password for <strong style={{ color: text }}>{selected?.name || selected?.email}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '0.25rem' }}>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="e.g. MyPass1!"
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setPasswordError(''); }}
                style={{ ...inputStyle, border: `1px solid ${passwordError ? liveRed : border}` }}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 0, top: 0, height: '100%', padding: '0 0.75rem', background: 'transparent', border: 'none', color: textDim, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                {showPassword ? <EyeOff style={{ width: 14, height: 14 }} /> : <Eye style={{ width: 14, height: 14 }} />}
              </button>
            </div>
            <p style={{ ...b, fontSize: '0.75rem', color: textDim, marginTop: '-0.5rem' }}>
              Min {AdminDomainRules.passwordMinLength()} chars · uppercase · lowercase · number · special character
            </p>
            {passwordError && (
              <p style={{ ...b, fontSize: '0.78rem', color: liveRed, background: `oklch(62% 0.22 25 / 0.08)`, border: `1px solid oklch(62% 0.22 25 / 0.3)`, borderRadius: 5, padding: '0.4rem 0.65rem', marginTop: '-0.25rem' }}>
                {passwordError}
              </p>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button onClick={() => { setResetOpen(false); setNewPassword(''); setSelected(null); setPasswordError(''); }} style={{ padding: '0.45rem 0.875rem', background: 'transparent', border: `1px solid ${border}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.78rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: textMid, cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                disabled={!newPassword || isProcessing}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.875rem', background: green, color: text, border: 'none', borderRadius: 5, ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: (!newPassword || isProcessing) ? 'not-allowed' : 'pointer', opacity: (!newPassword || isProcessing) ? 0.6 : 1 }}
              >
                {isProcessing
                  ? <><RefreshCw style={{ width: 12, height: 12, animation: 'spin 0.8s linear infinite' }} /> Resetting…</>
                  : <><Key style={{ width: 12, height: 12 }} /> Reset Password</>}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CommissionersManagementPage() {
  return (
    <AuthProvider>
      <AdminGuard>
        <CommissionersManagementContent />
      </AdminGuard>
    </AuthProvider>
  );
}
