import type { ReactNode } from 'react';
import { Footer } from '@/components/layout/Footer';
import { AppNav } from '@/components/layout/AppNav';
import { Breadcrumbs, type BreadcrumbItem } from '@/components/how-to/breadcrumbs';
import { bg, surface, card, border, greenHi, text, textMid, textDim, bc, b } from '@/components/how-to/guide-layout';

export { bg, surface, card, border, greenHi, text, textMid, textDim, bc, b };

export interface TocItem {
  id: string;
  label: string;
}

interface LegalLayoutProps {
  breadcrumbCurrent: string;
  eyebrow: string;
  title: string;
  effectiveDate: string;
  lastUpdated: string;
  intro: ReactNode;
  toc: TocItem[];
  children: ReactNode;
}

/** Shared shell for /terms and /privacy — mirrors the marketing-page hero
 * pattern (see faq/page.tsx, how-it-works/page.tsx) rather than the how-to
 * GuideLayout, since these are standalone legal documents, not tutorial
 * steps with prev/next neighbors. Reuses the same design tokens and
 * Breadcrumbs component so the pages read as native Sunday Huddle pages. */
export function LegalLayout({ breadcrumbCurrent, eyebrow, title, effectiveDate, lastUpdated, intro, toc, children }: LegalLayoutProps) {
  const breadcrumbs: BreadcrumbItem[] = [{ label: 'Home', href: '/' }, { label: breadcrumbCurrent }];

  return (
    <div style={{ background: bg, minHeight: '100vh' }}>
      <AppNav isAuthenticated={false} />

      {/* ── HERO ── */}
      <section
        style={{
          background: bg,
          backgroundImage: `repeating-linear-gradient(
            0deg, transparent, transparent 59px,
            oklch(100% 0 0 / 0.022) 59px, oklch(100% 0 0 / 0.022) 60px
          )`,
          padding: 'clamp(2.5rem, 6vw, 3.5rem) 0 clamp(2rem, 5vw, 2.75rem)',
        }}
      >
        <div className="lp-inner">
          <div style={{ marginBottom: '1.1rem' }}>
            <Breadcrumbs items={breadcrumbs} />
          </div>
          <p
            style={{
              ...bc, fontWeight: 700, fontSize: '0.67rem',
              letterSpacing: '0.28em', color: greenHi,
              textTransform: 'uppercase', marginBottom: '1.1rem',
              display: 'flex', alignItems: 'center', gap: '0.55rem',
            }}
          >
            <span style={{ display: 'inline-block', width: 20, height: 2, background: greenHi, borderRadius: 1, flexShrink: 0 }} />
            {eyebrow}
          </p>
          <h1
            style={{
              ...bc, fontWeight: 900,
              fontSize: 'clamp(2.25rem, 5.5vw, 3.25rem)',
              lineHeight: 0.98, letterSpacing: '-0.01em',
              color: text, textTransform: 'uppercase',
              marginBottom: '1rem',
            }}
          >
            {title}
          </h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1.5rem', marginBottom: '1.1rem' }}>
            <p style={{ ...b, fontSize: '0.8rem', color: textDim }}>
              <span style={{ color: textMid }}>Effective:</span> {effectiveDate}
            </p>
            <p style={{ ...b, fontSize: '0.8rem', color: textDim }}>
              <span style={{ color: textMid }}>Last updated:</span> {lastUpdated}
            </p>
          </div>
          <div style={{ ...b, fontSize: '1rem', lineHeight: 1.72, color: textMid, maxWidth: '68ch' }}>
            {intro}
          </div>
        </div>
      </section>

      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, oklch(46% 0.14 155), transparent)` }} />

      {/* ── TOC + CONTENT ── */}
      <section style={{ background: surface, padding: '3rem 0 3.5rem' }}>
        <div className="lp-inner" style={{ maxWidth: '52rem' }}>
          <nav
            aria-label="Table of contents"
            style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1.5rem 1.5rem 1.25rem', marginBottom: '2.5rem' }}
          >
            <p style={{ ...bc, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.2em', color: textDim, textTransform: 'uppercase', marginBottom: '0.9rem' }}>
              Contents
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '0.5rem 1rem' }}>
              {toc.map((item, i) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  style={{ ...b, fontSize: '0.85rem', color: textMid, textDecoration: 'none', display: 'flex', gap: '0.5rem' }}
                >
                  <span style={{ color: textDim, flexShrink: 0 }}>{i + 1}.</span>
                  <span>{item.label}</span>
                </a>
              ))}
            </div>
          </nav>

          <div className="legal-body">{children}</div>
        </div>
      </section>

      <Footer pageName={breadcrumbCurrent} />
    </div>
  );
}

interface SectionProps {
  id: string;
  number: number;
  title: string;
  children: ReactNode;
}

/** One numbered section — heading gets scroll-margin-top so the sticky
 * AppNav (position: sticky, top: 0) never covers it when a TOC/anchor link
 * jumps here. */
export function Section({ id, number, title, children }: SectionProps) {
  return (
    <section id={id} style={{ scrollMarginTop: '5rem', padding: '1.75rem 0', borderTop: `1px solid ${border}` }}>
      <h2 style={{ ...bc, fontWeight: 800, fontSize: '1.3rem', color: text, textTransform: 'uppercase', letterSpacing: '0.01em', marginBottom: '0.9rem', display: 'flex', gap: '0.6rem' }}>
        <span style={{ color: greenHi }}>{number}.</span>
        {title}
      </h2>
      <div style={{ ...b, fontSize: '0.92rem', lineHeight: 1.75, color: textMid, display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
        {children}
      </div>
    </section>
  );
}
