'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trophy, Calendar, Target, Layers, HelpCircle } from 'lucide-react';
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

export default function HowItWorksPage() {
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
                <Link href="/how-it-works" style={{ ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.06em', color: text, textTransform: 'uppercase', textDecoration: 'none' }}>
                  How It Works
                </Link>
                <Link href="/faq" style={{ ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.06em', color: textMid, textTransform: 'uppercase', textDecoration: 'none' }}>
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
            Rules &amp; Scoring
          </p>
          <h1 style={{
            ...bc, fontWeight: 900,
            fontSize: 'clamp(2.5rem, 6vw, 3.75rem)',
            lineHeight: 0.95, letterSpacing: '-0.01em',
            color: text, textTransform: 'uppercase',
            marginBottom: '1rem',
          }}>
            How It Works
          </h1>
          <p style={{ ...b, fontSize: '1rem', lineHeight: 1.72, color: textMid, maxWidth: '60ch' }}>
            Everything you need to know about picks, confidence points, and how winners are decided — every week and all season long.
          </p>
        </div>
      </section>

      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${green}, transparent)` }} />

      {/* ── THE BASICS ── */}
      <section style={{ background: surface, padding: '3.5rem 0' }}>
        <div className="lp-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <Target className="h-5 w-5" style={{ color: gold, flexShrink: 0 }} />
            <h2 style={{ ...bc, fontWeight: 800, fontSize: 'clamp(1.4rem, 3vw, 1.9rem)', letterSpacing: '0.04em', color: text, textTransform: 'uppercase' }}>
              Making Picks &amp; Confidence Points
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem', marginBottom: '1.75rem' }}>
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '1.25rem 1.5rem' }}>
              <p style={{ ...bc, fontWeight: 800, fontSize: '1.5rem', color: gold, marginBottom: '0.4rem' }}>1</p>
              <h3 style={{ ...bc, fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.06em', color: text, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Pick every game</h3>
              <p style={{ ...b, fontSize: '0.85rem', lineHeight: 1.6, color: textMid }}>Each week, pick who you think wins every game on the schedule.</p>
            </div>
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '1.25rem 1.5rem' }}>
              <p style={{ ...bc, fontWeight: 800, fontSize: '1.5rem', color: gold, marginBottom: '0.4rem' }}>2</p>
              <h3 style={{ ...bc, fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.06em', color: text, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Assign confidence points</h3>
              <p style={{ ...b, fontSize: '0.85rem', lineHeight: 1.6, color: textMid }}>Rank your picks by giving each one a point value — 1 up to the number of games that week. Each value is used exactly once.</p>
            </div>
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '1.25rem 1.5rem' }}>
              <p style={{ ...bc, fontWeight: 800, fontSize: '1.5rem', color: gold, marginBottom: '0.4rem' }}>3</p>
              <h3 style={{ ...bc, fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.06em', color: text, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Score on results</h3>
              <p style={{ ...b, fontSize: '0.85rem', lineHeight: 1.6, color: textMid }}>Pick right, earn the points you assigned. Pick wrong, earn nothing for that game — regardless of how confident you were.</p>
            </div>
          </div>

          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '1.25rem 1.5rem' }}>
            <p style={{ ...bc, fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.14em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Example — a 3-game week
            </p>
            <p style={{ ...b, fontSize: '0.85rem', lineHeight: 1.75, color: textMid }}>
              You&apos;re most sure about the Chiefs winning, so they get your highest value: <strong style={{ color: text }}>3 points</strong>. You&apos;re least sure about a close game, so it gets <strong style={{ color: text }}>1 point</strong>. If the Chiefs win and your 1-point pick loses, you score <strong style={{ color: text }}>3 points</strong> that week — not 4, because the wrong pick earned zero.
            </p>
          </div>

          <p style={{ ...b, fontSize: '0.82rem', lineHeight: 1.65, color: textDim, marginTop: '1.25rem' }}>
            You can update your picks until the first game of the week kicks off. Once that game starts, your picks for the whole week lock in — after that, only your commissioner can make changes for you.
          </p>
        </div>
      </section>

      {/* ── SEASON STRUCTURE ── */}
      <section style={{ background: bg, padding: '3.5rem 0' }}>
        <div className="lp-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <Calendar className="h-5 w-5" style={{ color: greenHi, flexShrink: 0 }} />
            <h2 style={{ ...bc, fontWeight: 800, fontSize: 'clamp(1.4rem, 3vw, 1.9rem)', letterSpacing: '0.04em', color: text, textTransform: 'uppercase' }}>
              The Season, Start to Finish
            </h2>
          </div>
          <p style={{ ...b, fontSize: '0.88rem', lineHeight: 1.7, color: textMid, maxWidth: '68ch', marginBottom: '1.75rem' }}>
            A commissioner chooses which part of the NFL calendar their pool covers when they create it. Not every pool runs every phase below — check with your commissioner, or look at which tabs show up on your pool&apos;s dashboard.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
            <div style={{ background: surface, border: `1px solid ${border}`, borderTop: `3px solid ${textDim}`, borderRadius: 8, padding: '1.5rem' }}>
              <h3 style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Preseason</h3>
              <p style={{ ...b, fontSize: '0.85rem', lineHeight: 1.65, color: textMid }}>4 warm-up weeks. Picks work the same way, but results don&apos;t count toward quarter prizes or the season championship.</p>
            </div>
            <div style={{ background: surface, border: `1px solid ${border}`, borderTop: `3px solid ${green}`, borderRadius: 8, padding: '1.5rem' }}>
              <h3 style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Regular Season</h3>
              <p style={{ ...b, fontSize: '0.85rem', lineHeight: 1.65, color: textMid }}>18 weeks, split into four quarters. This is where quarter prizes and the season championship are earned.</p>
            </div>
            <div style={{ background: surface, border: `1px solid ${border}`, borderTop: `3px solid ${gold}`, borderRadius: 8, padding: '1.5rem' }}>
              <h3 style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Playoffs</h3>
              <p style={{ ...b, fontSize: '0.85rem', lineHeight: 1.65, color: textMid }}>Wild Card through the Super Bowl. A different, bracket-style pick format — details below.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── QUARTERS & PERIOD PRIZES ── */}
      <section style={{ background: surface, padding: '3.5rem 0' }}>
        <div className="lp-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <Layers className="h-5 w-5" style={{ color: gold, flexShrink: 0 }} />
            <h2 style={{ ...bc, fontWeight: 800, fontSize: 'clamp(1.4rem, 3vw, 1.9rem)', letterSpacing: '0.04em', color: text, textTransform: 'uppercase' }}>
              Quarters &amp; Tie-Breakers
            </h2>
          </div>
          <p style={{ ...b, fontSize: '0.88rem', lineHeight: 1.7, color: textMid, maxWidth: '68ch', marginBottom: '1.5rem' }}>
            The regular season is split into four quarters (Q1&ndash;Q4). At the end of each one, standings for that stretch of weeks are tallied, and if your commissioner has period prizes turned on, a quarter winner is crowned.
          </p>
          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '1.25rem 1.5rem' }}>
            <p style={{ ...bc, fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.14em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Ties
            </p>
            <p style={{ ...b, fontSize: '0.85rem', lineHeight: 1.75, color: textMid }}>
              If two or more players are tied at the end of a quarter, the tie is broken by whoever predicted the total combined score of that week&apos;s Monday Night Football game most accurately. The same method breaks ties for the season championship and, using the Super Bowl instead of Monday Night, for playoff pools.
            </p>
          </div>
        </div>
      </section>

      {/* ── PLAYOFFS FORMAT ── */}
      <section style={{ background: bg, padding: '3.5rem 0' }}>
        <div className="lp-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <Trophy className="h-5 w-5" style={{ color: gold, flexShrink: 0 }} />
            <h2 style={{ ...bc, fontWeight: 800, fontSize: 'clamp(1.4rem, 3vw, 1.9rem)', letterSpacing: '0.04em', color: text, textTransform: 'uppercase' }}>
              Playoff Pools Work Differently
            </h2>
          </div>
          <p style={{ ...b, fontSize: '0.88rem', lineHeight: 1.7, color: textMid, maxWidth: '68ch', marginBottom: '1.75rem' }}>
            When the playoffs start, it&apos;s not weekly game-by-game confidence points anymore — it&apos;s one bracket-wide submission.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ ...bc, fontWeight: 900, fontSize: '1.5rem', lineHeight: 1, color: gold, opacity: 0.5, flexShrink: 0, width: 32 }}>01</div>
              <div>
                <h3 style={{ ...bc, fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.05em', color: text, textTransform: 'uppercase', marginBottom: '0.3rem' }}>Rank the field once</h3>
                <p style={{ ...b, fontSize: '0.85rem', lineHeight: 1.65, color: textMid, maxWidth: '64ch' }}>Before the bracket kicks off, assign confidence points 1 through 14 across all 14 playoff teams (7 from each conference) &mdash; your own ranking of who goes furthest. Once submitted, it&apos;s locked and can&apos;t be changed.</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ ...bc, fontWeight: 900, fontSize: '1.5rem', lineHeight: 1, color: gold, opacity: 0.5, flexShrink: 0, width: 32 }}>02</div>
              <div>
                <h3 style={{ ...bc, fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.05em', color: text, textTransform: 'uppercase', marginBottom: '0.3rem' }}>Earn points every round a team wins</h3>
                <p style={{ ...b, fontSize: '0.85rem', lineHeight: 1.65, color: textMid, maxWidth: '64ch' }}>Each round &mdash; Wild Card, Divisional, Conference Championship, Super Bowl &mdash; a team that wins its game earns you the points you assigned it, again. A team you ranked highly that keeps advancing pays off every single round.</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ ...bc, fontWeight: 900, fontSize: '1.5rem', lineHeight: 1, color: gold, opacity: 0.5, flexShrink: 0, width: 32 }}>03</div>
              <div>
                <h3 style={{ ...bc, fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.05em', color: text, textTransform: 'uppercase', marginBottom: '0.3rem' }}>Eliminated teams stop scoring</h3>
                <p style={{ ...b, fontSize: '0.85rem', lineHeight: 1.65, color: textMid, maxWidth: '64ch' }}>A team that loses (or never plays again) earns you nothing further. Whoever has the most points once the Super Bowl is decided wins the playoff pool.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ CROSS-LINK ── */}
      <section style={{ background: surface, padding: '3rem 0' }}>
        <div className="lp-inner">
          <Link
            href="/faq"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
              background: card, border: `1px solid ${border}`, borderRadius: 8,
              padding: '1.25rem 1.5rem', textDecoration: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <HelpCircle className="h-5 w-5" style={{ color: greenHi, flexShrink: 0 }} />
              <div>
                <h3 style={{ ...bc, fontWeight: 700, fontSize: '0.95rem', letterSpacing: '0.05em', color: text, textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                  Have more questions?
                </h3>
                <p style={{ ...b, fontSize: '0.82rem', color: textMid }}>Check the FAQ for quick answers on ties, edits, and playoffs.</p>
              </div>
            </div>
            <span style={{ ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.08em', color: greenHi, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              View FAQ &rarr;
            </span>
          </Link>
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

      <Footer pageName="How It Works" />
    </div>
  );
}
