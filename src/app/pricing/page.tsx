'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Check } from 'lucide-react';
import { Footer } from '@/components/layout/Footer';
import { BrandLogo } from '@/components/ui/brand-logo';

// Design tokens (matches landing page / app-wide dark theme)
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

export default function PricingPage() {
  const router = useRouter();

  return (
    <div style={{ background: bg, minHeight: '100vh' }}>

      {/* ── NAV ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'oklch(13% 0.025 255 / 0.95)',
        backdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${border}`,
      }}>
        <div className="lp-inner" style={{ paddingTop: '0.75rem', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', rowGap: '0.5rem' }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0, textDecoration: 'none' }}>
              <BrandLogo variant="icon" size={32} />
              <span style={{
                ...bc, fontWeight: 800, fontSize: '0.95rem',
                letterSpacing: '0.07em', color: text, textTransform: 'uppercase',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                Sunday Huddle
              </span>
            </Link>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap', rowGap: '0.5rem' }}>
              <div className="lp-nav-links">
                <Link href="/how-it-works" style={{ ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.06em', color: textMid, textTransform: 'uppercase', textDecoration: 'none' }}>
                  How It Works
                </Link>
                <Link href="/faq" style={{ ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.06em', color: textMid, textTransform: 'uppercase', textDecoration: 'none' }}>
                  FAQ
                </Link>
                <Link href="/pricing" style={{ ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.06em', color: text, textTransform: 'uppercase', textDecoration: 'none' }}>
                  Pricing
                </Link>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                <button
                  onClick={() => router.push('/')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.45rem 0.9rem',
                    background: 'transparent', color: textMid,
                    border: `1px solid ${border}`, borderRadius: 6,
                    ...bc, fontWeight: 700, fontSize: '0.78rem',
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span className="pools-nav-label">Home</span>
                </button>
                <button
                  onClick={() => router.push('/register')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.45rem 0.9rem',
                    background: green, color: text, border: 'none', borderRadius: 6,
                    ...bc, fontWeight: 700, fontSize: '0.78rem',
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span className="pools-nav-label">Create Pool</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{
        background: bg,
        backgroundImage: `repeating-linear-gradient(
          0deg, transparent, transparent 59px,
          oklch(100% 0 0 / 0.022) 59px, oklch(100% 0 0 / 0.022) 60px
        )`,
        padding: 'clamp(3rem, 7vw, 4.5rem) 0 2.5rem',
      }}>
        <div className="lp-inner" style={{ textAlign: 'center' }}>
          <p style={{
            ...bc, fontWeight: 700, fontSize: '0.67rem',
            letterSpacing: '0.28em', color: greenHi,
            textTransform: 'uppercase', marginBottom: '1.1rem',
          }}>
            Plans &amp; Pricing
          </p>
          <h1 style={{
            ...bc, fontWeight: 900,
            fontSize: 'clamp(2.5rem, 6vw, 3.75rem)',
            lineHeight: 0.95, letterSpacing: '-0.01em',
            color: text, textTransform: 'uppercase',
            marginBottom: '1rem',
          }}>
            Run Your Season, <span style={{ color: gold }}>Your Way</span>
          </h1>
          <p style={{ ...b, fontSize: '1rem', lineHeight: 1.72, color: textMid, maxWidth: '52ch', margin: '0 auto' }}>
            Pricing is per season — roughly 6 months of NFL action. Start free, upgrade when you need more room.
          </p>
        </div>
      </section>

      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${green}, transparent)` }} />

      {/* ── PLANS ── */}
      <section style={{ background: surface, padding: '3rem 0' }}>
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
                <button
                  onClick={() => router.push('/register')}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                    padding: '0.6rem 1rem', background: 'transparent', color: textMid,
                    border: `1px solid ${border}`, borderRadius: 6,
                    ...bc, fontWeight: 700, fontSize: '0.78rem',
                    letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
                  }}
                >
                  Start Free
                </button>
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
                <button
                  onClick={() => router.push('/register')}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                    padding: '0.6rem 1rem', background: green, color: text,
                    border: 'none', borderRadius: 6,
                    ...bc, fontWeight: 700, fontSize: '0.78rem',
                    letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
                  }}
                >
                  Get Started
                </button>
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
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.25rem' }}>
                  {ADDON_FEATURES.map(f => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                      <Check style={{ width: 14, height: 14, color: gold, flexShrink: 0, marginTop: 2 }} />
                      <span style={{ ...b, fontSize: '0.83rem', color: textMid }}>{f}</span>
                    </li>
                  ))}
                </ul>
                <p style={{ ...b, fontSize: '0.78rem', color: textDim, lineHeight: 1.6 }}>
                  Available once you&apos;re on Standard — manage add-on pools from your account after signing up.
                </p>
              </div>
            </div>

          </div>

          <p style={{ ...b, fontSize: '0.85rem', color: textMid, textAlign: 'center', marginTop: '2rem' }}>
            Already a commissioner?{' '}
            <Link href="/login" style={{ color: greenHi }}>Sign in</Link> to manage your plan from account settings.
          </p>
          <p style={{ ...b, fontSize: '0.78rem', color: textDim, textAlign: 'center', marginTop: '0.5rem' }}>
            Payments are handled manually for now. You&apos;ll receive a confirmation email once your plan is active.
          </p>
        </div>
      </section>

      <Footer pageName="Pricing" />
    </div>
  );
}
