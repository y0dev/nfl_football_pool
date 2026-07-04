'use client';

import { useState, useEffect } from 'react';
import { Check, Plus, ArrowLeft, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/lib/auth';
import { AdminGuard } from '@/components/auth/admin-guard';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { BrandLogo } from '@/components/ui/brand-logo';
import { Footer } from '@/components/layout/Footer';
import { useToast } from '@/hooks/use-toast';

type Plan = 'free' | 'standard' | 'pro';

interface PlanStatus {
  plan: Plan;
  isTrialActive: boolean;
  daysLeft: number;
  trialEndsAt: string | null;
}

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

const FREE_FEATURES = [
  '1 pool',
  'Up to 15 participants',
  'Weekly picks & confidence points',
  'Live leaderboard',
  'Period standings (Q1-Q4)',
];

const STANDARD_FEATURES = [
  '1 pool',
  'Up to 30 participants',
  'Weekly picks & confidence points',
  'Live leaderboard',
  'Period standings (Q1-Q4)',
  'Email pick reminders',
  'Tiebreaker questions',
  'Season & playoff tracking',
];

const ADDON_FEATURES = [
  'Each additional pool',
  'Up to 30 participants per pool',
  'All Standard features included',
];

function UpgradeContent() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [extraPools, setExtraPools] = useState(1);
  const [planStatus, setPlanStatus] = useState<PlanStatus | null>(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState(true);
  const [isDowngrading, setIsDowngrading] = useState(false);

  const totalAddon = extraPools * 15;

  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/admin/plan-status?adminId=${user.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) setPlanStatus(data);
      })
      .finally(() => setIsLoadingPlan(false));
  }, [user?.id]);

  const currentPlan = planStatus?.plan ?? 'free';

  const handleDowngrade = async () => {
    if (!user?.id) return;
    setIsDowngrading(true);
    try {
      const res = await fetch('/api/admin/downgrade-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user.id }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to downgrade');

      setPlanStatus(prev => prev ? { ...prev, plan: 'free', isTrialActive: false, daysLeft: 0, trialEndsAt: null } : prev);
      toast({ title: 'Plan Updated', description: "You're now on the Free plan." });
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed to downgrade', variant: 'destructive' });
    } finally {
      setIsDowngrading(false);
    }
  };

  return (
    <div style={{ background: bg, minHeight: '100vh' }}>

      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'oklch(13% 0.025 255 / 0.95)',
        backdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${border}`,
      }}>
        <div className="lp-inner" style={{ paddingTop: '0.75rem', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0 }}>
              <BrandLogo variant="icon" size={28} />
              <span style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                Sunday Huddle
              </span>
            </div>
            <button
              onClick={() => router.back()}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'transparent', border: `1px solid ${border}`, color: textMid, borderRadius: 6, padding: '0.4rem 0.8rem', ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer', flexShrink: 0 }}
            >
              <ArrowLeft style={{ width: 12, height: 12 }} /> <span className="pools-nav-label">Back</span>
            </button>
          </div>
        </div>
      </nav>

      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${green}, transparent)` }} />

      {/* Header */}
      <section style={{ padding: 'clamp(2.5rem, 6vw, 4rem) 0 2rem' }}>
        <div className="lp-inner" style={{ textAlign: 'center' }}>
          <p style={{ ...bc, fontWeight: 700, fontSize: '0.67rem', letterSpacing: '0.28em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.75rem' }}>
            Plans &amp; Pricing
          </p>
          <h1 style={{ ...bc, fontWeight: 900, fontSize: 'clamp(2rem, 5vw, 3rem)', color: text, textTransform: 'uppercase', letterSpacing: '-0.01em', marginBottom: '0.75rem' }}>
            Run Your Season, <span style={{ color: gold }}>Your Way</span>
          </h1>
          <p style={{ ...b, fontSize: '0.95rem', color: textMid, maxWidth: '48ch', margin: '0 auto' }}>
            Pricing is per season — roughly 6 months of NFL action. Cancel or change plans between seasons, no lock-in.
          </p>
        </div>
      </section>

      {isLoadingPlan && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '0 0 1.5rem' }}>
          <Loader2 className="animate-spin" style={{ width: 18, height: 18, color: textDim }} />
        </div>
      )}

      {!isLoadingPlan && planStatus?.isTrialActive && (
        <div className="lp-inner" style={{ marginBottom: '1.5rem' }}>
          <div style={{ background: 'oklch(74% 0.16 72 / 0.1)', border: `1px solid oklch(74% 0.16 72 / 0.35)`, borderRadius: 8, padding: '0.85rem 1.25rem', textAlign: 'center' }}>
            <p style={{ ...b, fontSize: '0.85rem', color: gold }}>
              You&apos;re on a Standard trial — <strong>{planStatus.daysLeft} day{planStatus.daysLeft !== 1 ? 's' : ''} left</strong>. It reverts to Free automatically unless you upgrade.
            </p>
          </div>
        </div>
      )}

      {/* Plans */}
      <section style={{ padding: '1rem 0 3rem' }}>
        <div className="lp-inner">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', alignItems: 'start' }}>

            {/* Free */}
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '1.5rem', borderBottom: `1px solid ${border}` }}>
                <p style={{ ...bc, fontWeight: 700, fontSize: '0.63rem', letterSpacing: '0.22em', color: textDim, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Free</p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', marginBottom: '0.4rem' }}>
                  <span style={{ ...bc, fontWeight: 900, fontSize: '2.25rem', color: text, lineHeight: 1 }}>$0</span>
                  <span style={{ ...b, fontSize: '0.8rem', color: textDim }}>/season</span>
                </div>
                <p style={{ ...b, fontSize: '0.82rem', color: textMid }}>Get started with a single pool for a small group.</p>
              </div>
              <div style={{ padding: '1.25rem' }}>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.25rem' }}>
                  {FREE_FEATURES.map(f => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                      <Check style={{ width: 14, height: 14, color: greenHi, flexShrink: 0, marginTop: 2 }} />
                      <span style={{ ...b, fontSize: '0.83rem', color: textMid }}>{f}</span>
                    </li>
                  ))}
                </ul>
                {currentPlan === 'free' ? (
                  <div style={{ padding: '0.55rem 1rem', background: surface, border: `1px solid ${border}`, borderRadius: 6, textAlign: 'center', ...bc, fontWeight: 700, fontSize: '0.72rem', color: textDim, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Current plan
                  </div>
                ) : (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        disabled={isDowngrading}
                        style={{ width: '100%', padding: '0.55rem 1rem', background: 'transparent', border: `1px solid ${border}`, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.72rem', color: textMid, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: isDowngrading ? 'not-allowed' : 'pointer', opacity: isDowngrading ? 0.6 : 1 }}
                      >
                        {isDowngrading ? 'Downgrading…' : 'Downgrade to Free'}
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Downgrade to Free?
                        </AlertDialogTitle>
                        <AlertDialogDescription style={{ color: textMid }}>
                          You&apos;ll lose email pick reminders, tiebreaker questions, and any pools beyond your first. This takes effect immediately.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDowngrade}>Downgrade to Free</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>

            {/* Standard */}
            <div style={{ background: card, border: `1px solid ${green}`, borderTop: `3px solid ${green}`, borderRadius: 10, overflow: 'hidden', position: 'relative' }}>
              <div style={{ position: 'absolute', top: '1rem', right: '1rem', ...bc, fontWeight: 700, fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.2rem 0.5rem', background: `${green}30`, color: greenHi, border: `1px solid ${green}50`, borderRadius: 4 }}>
                Most popular
              </div>
              <div style={{ padding: '1.5rem', borderBottom: `1px solid ${border}` }}>
                <p style={{ ...bc, fontWeight: 700, fontSize: '0.63rem', letterSpacing: '0.22em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Standard</p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', marginBottom: '0.4rem' }}>
                  <span style={{ ...bc, fontWeight: 900, fontSize: '2.25rem', color: text, lineHeight: 1 }}>$30</span>
                  <span style={{ ...b, fontSize: '0.8rem', color: textDim }}>/season</span>
                </div>
                <p style={{ ...b, fontSize: '0.82rem', color: textMid }}>Everything you need to run a great pool all season.</p>
              </div>
              <div style={{ padding: '1.25rem' }}>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.25rem' }}>
                  {STANDARD_FEATURES.map(f => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                      <Check style={{ width: 14, height: 14, color: greenHi, flexShrink: 0, marginTop: 2 }} />
                      <span style={{ ...b, fontSize: '0.83rem', color: textMid }}>{f}</span>
                    </li>
                  ))}
                </ul>
                {currentPlan === 'free' ? (
                  <a
                    href="mailto:devdoesit17@gmail.com?subject=Sunday Huddle — Standard Plan&body=I'd like to upgrade to the Standard plan ($30/season)."
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '0.6rem 1rem',
                      background: green, color: text,
                      border: 'none', borderRadius: 6,
                      ...bc, fontWeight: 700, fontSize: '0.78rem',
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                      textDecoration: 'none', cursor: 'pointer',
                    }}
                  >
                    Upgrade to Standard
                  </a>
                ) : (
                  <div style={{ padding: '0.55rem 1rem', background: 'oklch(46% 0.14 155 / 0.15)', border: `1px solid ${green}`, borderRadius: 6, textAlign: 'center', ...bc, fontWeight: 700, fontSize: '0.72rem', color: greenHi, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    {planStatus?.isTrialActive ? 'Current Plan (Trial)' : 'Current Plan'}
                  </div>
                )}
              </div>
            </div>

            {/* Add-on pools */}
            <div style={{ background: card, border: `1px solid ${border}`, borderTop: `3px solid ${gold}`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '1.5rem', borderBottom: `1px solid ${border}` }}>
                <p style={{ ...bc, fontWeight: 700, fontSize: '0.63rem', letterSpacing: '0.22em', color: gold, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Add-on Pools</p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', marginBottom: '0.4rem' }}>
                  <span style={{ ...bc, fontWeight: 900, fontSize: '2.25rem', color: text, lineHeight: 1 }}>$15</span>
                  <span style={{ ...b, fontSize: '0.8rem', color: textDim }}>/pool/season</span>
                </div>
                <p style={{ ...b, fontSize: '0.82rem', color: textMid }}>Add more pools on top of Standard. Each extra pool includes all Standard features.</p>
              </div>
              <div style={{ padding: '1.25rem' }}>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.5rem' }}>
                  {ADDON_FEATURES.map(f => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                      <Check style={{ width: 14, height: 14, color: gold, flexShrink: 0, marginTop: 2 }} />
                      <span style={{ ...b, fontSize: '0.83rem', color: textMid }}>{f}</span>
                    </li>
                  ))}
                </ul>

                {/* Pool counter */}
                <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
                  <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.1em', color: textDim, textTransform: 'uppercase', marginBottom: '0.6rem' }}>Extra pools needed</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button
                      onClick={() => setExtraPools(p => Math.max(1, p - 1))}
                      style={{ width: 28, height: 28, borderRadius: 5, border: `1px solid ${border}`, background: card, color: text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', ...bc, fontWeight: 700, fontSize: '1rem' }}
                    >−</button>
                    <span style={{ ...bc, fontWeight: 900, fontSize: '1.5rem', color: text, minWidth: 24, textAlign: 'center' }}>{extraPools}</span>
                    <button
                      onClick={() => setExtraPools(p => p + 1)}
                      style={{ width: 28, height: 28, borderRadius: 5, border: `1px solid ${border}`, background: card, color: text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', ...bc, fontWeight: 700, fontSize: '1rem' }}
                    >
                      <Plus style={{ width: 12, height: 12 }} />
                    </button>
                    <span style={{ ...b, fontSize: '0.82rem', color: textMid, marginLeft: 'auto' }}>= <strong style={{ color: gold }}>${totalAddon}/season</strong></span>
                  </div>
                </div>

                <a
                  href={`mailto:devdoesit17@gmail.com?subject=Sunday Huddle — Add-on Pools&body=I'd like to add ${extraPools} extra pool${extraPools !== 1 ? 's' : ''} to my Standard plan ($${totalAddon}/season).`}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0.6rem 1rem',
                    background: 'oklch(74% 0.16 72 / 0.12)', color: gold,
                    border: `1px solid oklch(74% 0.16 72 / 0.4)`,
                    borderRadius: 6,
                    ...bc, fontWeight: 700, fontSize: '0.78rem',
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    textDecoration: 'none', cursor: 'pointer',
                  }}
                >
                  Request {extraPools} Extra Pool{extraPools !== 1 ? 's' : ''}
                </a>
              </div>
            </div>

          </div>

          {/* Footer note */}
          <p style={{ ...b, fontSize: '0.78rem', color: textDim, textAlign: 'center', marginTop: '2rem' }}>
            Payments are handled manually for now. You will receive a confirmation email once your plan is active.
          </p>
        </div>
      </section>

      <Footer pageName="Upgrade" />
    </div>
  );
}

export default function UpgradePage() {
  return (
    <AuthProvider>
      <AdminGuard>
        <UpgradeContent />
      </AdminGuard>
    </AuthProvider>
  );
}
