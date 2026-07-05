'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Search, Plus, Home } from 'lucide-react';
import { Footer } from '@/components/layout/Footer';
import { BrandLogo } from '@/components/ui/brand-logo';
import { isPricingVisible } from '@/lib/billing';

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

export default function NotFound() {
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
                {isPricingVisible() && (
                  <Link href="/pricing" style={{ ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.06em', color: textMid, textTransform: 'uppercase', textDecoration: 'none' }}>
                    Pricing
                  </Link>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                <button
                  onClick={() => router.push('/')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.45rem 0.9rem',
                    background: green, color: text, border: 'none', borderRadius: 6,
                    ...bc, fontWeight: 700, fontSize: '0.78rem',
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  <Home className="h-3.5 w-3.5" />
                  <span className="pools-nav-label">Home</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* ── 404 ── */}
      <section style={{
        background: bg,
        backgroundImage: `repeating-linear-gradient(
          0deg, transparent, transparent 59px,
          oklch(100% 0 0 / 0.022) 59px, oklch(100% 0 0 / 0.022) 60px
        )`,
        padding: 'clamp(3.5rem, 10vw, 6rem) 0 clamp(2.5rem, 6vw, 3.5rem)',
      }}>
        <div className="lp-inner" style={{ textAlign: 'center' }}>
          <p style={{
            ...bc, fontWeight: 900,
            fontSize: 'clamp(5rem, 18vw, 9rem)',
            lineHeight: 0.9, letterSpacing: '-0.02em',
            color: gold, marginBottom: '0.5rem',
          }}>
            404
          </p>
          <h1 style={{
            ...bc, fontWeight: 900,
            fontSize: 'clamp(1.75rem, 4.5vw, 2.5rem)',
            color: text, textTransform: 'uppercase', letterSpacing: '0.02em',
            marginBottom: '0.75rem',
          }}>
            Incomplete Pass
          </h1>
          <p style={{ ...b, fontSize: '1rem', lineHeight: 1.72, color: textMid, maxWidth: '48ch', margin: '0 auto' }}>
            That page doesn&apos;t exist, was moved, or the link you followed is out of date.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '2rem' }}>
            <button
              onClick={() => router.push('/')}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.65rem 1.25rem',
                background: green, color: text, border: 'none', borderRadius: 6,
                ...bc, fontWeight: 700, fontSize: '0.8rem',
                letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
              }}
            >
              <Home className="h-3.5 w-3.5" />
              Go Home
            </button>
            <button
              onClick={() => router.back()}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.65rem 1.25rem',
                background: 'transparent', color: textMid,
                border: `1px solid ${border}`, borderRadius: 6,
                ...bc, fontWeight: 700, fontSize: '0.8rem',
                letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
              }}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Go Back
            </button>
          </div>
        </div>
      </section>

      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${green}, transparent)` }} />

      {/* ── LOOKING FOR A POOL ── */}
      <section style={{ background: surface, padding: '3rem 0' }}>
        <div className="lp-inner">
          <div style={{
            background: card, border: `1px solid ${border}`, borderRadius: 10,
            padding: '1.75rem', maxWidth: '640px', margin: '0 auto', textAlign: 'center',
          }}>
            <h2 style={{ ...bc, fontWeight: 800, fontSize: '1.1rem', color: text, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
              Looking for a pool?
            </h2>
            <p style={{ ...b, fontSize: '0.88rem', color: textMid, marginBottom: '1.25rem', lineHeight: 1.65 }}>
              Make sure you have the correct invite link from your commissioner, or search for your pool by name.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => router.push('/pools')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.6rem 1.1rem', background: 'transparent', color: textMid,
                  border: `1px solid ${border}`, borderRadius: 6,
                  ...bc, fontWeight: 700, fontSize: '0.78rem',
                  letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
                }}
              >
                <Search className="h-3.5 w-3.5" />
                Find a Pool
              </button>
              <button
                onClick={() => router.push('/register')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.6rem 1.1rem',
                  background: 'oklch(74% 0.16 72 / 0.12)', color: gold,
                  border: `1px solid oklch(74% 0.16 72 / 0.4)`, borderRadius: 6,
                  ...bc, fontWeight: 700, fontSize: '0.78rem',
                  letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Create a Pool
              </button>
            </div>
          </div>
        </div>
      </section>

      <Footer pageName="Not Found" />
    </div>
  );
}
