'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, ChevronDown } from 'lucide-react';
import { Footer } from '@/components/layout/Footer';
import { BrandLogo } from '@/components/ui/brand-logo';

// Design tokens (matches landing page / app-wide dark theme)
const bg      = 'oklch(13% 0.025 255)';
const surface = 'oklch(17% 0.028 255)';
const card    = 'oklch(20% 0.03 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

const faqs = [
  {
    q: 'How many confidence points do I get each week?',
    a: 'One point value per game on the schedule that week, from 1 up to the number of games (capped at 16 for a full 16-game week). Each value can only be used once — so if you have 14 games, you assign every number from 1 to 14, one per pick.',
  },
  {
    q: 'What happens if I pick the wrong team?',
    a: 'You earn zero points for that pick, no matter how many confidence points you assigned it. That\'s what makes confidence points risky — betting big on the wrong game costs you the most.',
  },
  {
    q: 'Can I change my picks after I submit them?',
    a: 'Yes, the commissioner can make changes for you up until the kicks off of the first game of that week. Once the first game starts, the pick are locks in for that week — but picks for the other games that week stay open until each one starts.',
  },
  {
    q: 'Does my pool include the playoffs?',
    a: 'It depends on how your commissioner set it up. Some pools run regular season only, some add playoffs, and some run preseason through the Super Bowl. Check with your commissioner, or look at the tabs available on your pool\'s dashboard — a Playoffs tab only appears if your pool includes it.',
  },
  {
    q: 'What breaks a tie?',
    a: 'Your predicted total combined score for that week\'s Monday Night Football game (or the Super Bowl, during that week). Closest guess to the actual combined score wins the tie.',
  },
  {
    q: 'Who wins the season?',
    a: 'Whoever has the most total points across the regular season. Preseason and playoff points are tracked separately and don\'t count toward the season championship.',
  },
  {
    q: 'What are quarter winners?',
    a: 'The regular season is split into four quarters. Standings are tallied at the end of each one and a quarter winner is crowned, if your commissioner has period prizes turned on for the pool.',
  },
  {
    q: 'What\'s the point of the preseason weeks?',
    a: 'If a commissioner opts into preseason, it works like a normal pick\'em week — pick winners, assign points, see standings. It\'s just practice: preseason results don\'t count toward quarter prizes or the season championship.',
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 8, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '1rem', padding: '1rem 1.25rem', background: 'transparent', border: 'none',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ ...b, fontWeight: 600, fontSize: '0.92rem', color: text }}>{q}</span>
        <ChevronDown
          className="h-4 w-4"
          style={{ color: textDim, flexShrink: 0, transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>
      {open && (
        <div style={{ padding: '0 1.25rem 1.1rem' }}>
          <p style={{ ...b, fontSize: '0.86rem', lineHeight: 1.65, color: textMid }}>{a}</p>
        </div>
      )}
    </div>
  );
}

export default function FaqPage() {
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
                <Link href="/faq" style={{ ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.06em', color: text, textTransform: 'uppercase', textDecoration: 'none' }}>
                  FAQ
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
        padding: 'clamp(3rem, 7vw, 4.5rem) 0 clamp(2.5rem, 6vw, 3.5rem)',
      }}>
        <div className="lp-inner">
          <p style={{
            ...bc, fontWeight: 700, fontSize: '0.67rem',
            letterSpacing: '0.28em', color: greenHi,
            textTransform: 'uppercase', marginBottom: '1.1rem',
            display: 'flex', alignItems: 'center', gap: '0.55rem',
          }}>
            <span style={{ display: 'inline-block', width: 20, height: 2, background: greenHi, borderRadius: 1, flexShrink: 0 }} />
            Frequently Asked Questions
          </p>
          <h1 style={{
            ...bc, fontWeight: 900,
            fontSize: 'clamp(2.5rem, 6vw, 3.75rem)',
            lineHeight: 0.95, letterSpacing: '-0.01em',
            color: text, textTransform: 'uppercase',
            marginBottom: '1rem',
          }}>
            FAQ
          </h1>
          <p style={{ ...b, fontSize: '1rem', lineHeight: 1.72, color: textMid, maxWidth: '60ch' }}>
            Quick answers on picks, ties, and playoffs. New to Sunday Huddle?{' '}
            <Link href="/how-it-works" style={{ color: greenHi }}>Read How It Works</Link> for the full walkthrough.
          </p>
        </div>
      </section>

      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${green}, transparent)` }} />

      {/* ── FAQ LIST ── */}
      <section style={{ background: surface, padding: '3.5rem 0' }}>
        <div className="lp-inner">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '760px', margin: '0 auto' }}>
            {faqs.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ background: bg, padding: '3.5rem 0' }}>
        <div className="lp-inner" style={{ textAlign: 'center' }}>
          <h2 style={{ ...bc, fontWeight: 900, fontSize: 'clamp(1.5rem, 3.5vw, 2rem)', color: text, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '0.75rem' }}>
            Ready to make your picks?
          </h2>
          <p style={{ ...b, fontSize: '0.9rem', color: textMid, marginBottom: '1.5rem' }}>
            Join a pool with an invite, or start your own in minutes.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => router.push('/pools')}
              style={{
                padding: '0.65rem 1.25rem',
                background: 'transparent', color: textMid,
                border: `1px solid ${border}`, borderRadius: 6,
                ...bc, fontWeight: 700, fontSize: '0.8rem',
                letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
              }}
            >
              Find a Pool
            </button>
            <button
              onClick={() => router.push('/register')}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.65rem 1.25rem',
                background: green, color: text, border: 'none', borderRadius: 6,
                ...bc, fontWeight: 700, fontSize: '0.8rem',
                letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Create a Pool
            </button>
          </div>
        </div>
      </section>

      <Footer pageName="FAQ" />
    </div>
  );
}
