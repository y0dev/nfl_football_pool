import type { ReactNode } from 'react';
import Link from 'next/link';
import { BrandLogo } from '@/components/ui/brand-logo';
import { Footer } from '@/components/layout/Footer';
import { Breadcrumbs, type BreadcrumbItem } from './breadcrumbs';
import { PrevNext } from './prev-next';
import { getGuideNeighbors } from '@/lib/how-to-guides';

const bg      = 'oklch(13% 0.025 255)';
const surface = 'oklch(17% 0.028 255)';
const card    = 'oklch(20% 0.03 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const gold    = 'oklch(74% 0.16 72)';
const amber   = 'oklch(72% 0.16 60)';
const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

/** Shared nav header for every /how-to page — matches the public-page nav
 * pattern used on /how-it-works and /faq, with a How To link added. */
function HowToNav() {
  return (
    <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'oklch(13% 0.025 255 / 0.95)', backdropFilter: 'blur(14px)', borderBottom: `1px solid ${border}` }}>
      <div className="lp-inner" style={{ paddingTop: '0.75rem', paddingBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', rowGap: '0.5rem' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0, textDecoration: 'none' }}>
            <BrandLogo variant="icon" size={32} />
            <span style={{ ...bc, fontWeight: 800, fontSize: '0.95rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Sunday Huddle
            </span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap', rowGap: '0.5rem' }}>
            <Link href="/how-to" style={{ ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.06em', color: text, textTransform: 'uppercase', textDecoration: 'none' }}>
              How To
            </Link>
            <Link href="/how-it-works" style={{ ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.06em', color: textMid, textTransform: 'uppercase', textDecoration: 'none' }}>
              How It Works
            </Link>
            <Link href="/faq" style={{ ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.06em', color: textMid, textTransform: 'uppercase', textDecoration: 'none' }}>
              FAQ
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

interface GuideLayoutProps {
  /** Current guide's slug — used to look up Previous/Next neighbors. Omit on the landing page. */
  slug?: string;
  breadcrumbs: BreadcrumbItem[];
  title: ReactNode;
  intro?: string;
  children: ReactNode;
}

export function GuideLayout({ slug, breadcrumbs, title, intro, children }: GuideLayoutProps) {
  const { prev, next } = slug ? getGuideNeighbors(slug) : {};

  return (
    <div style={{ background: bg, minHeight: '100vh' }}>
      <HowToNav />

      <section style={{ background: bg, padding: 'clamp(1.5rem, 3vw, 2.5rem) 0 1rem' }}>
        <div className="lp-inner">
          <Breadcrumbs items={breadcrumbs} />
        </div>
      </section>

      <section style={{ padding: '0 0 3rem' }}>
        <div className="lp-inner" style={{ maxWidth: '48rem' }}>
          <h1 style={{ ...bc, fontWeight: 900, fontSize: 'clamp(1.6rem, 3.5vw, 2.25rem)', color: text, textTransform: 'uppercase', marginBottom: intro ? '0.6rem' : '1.5rem' }}>
            {title}
          </h1>
          {intro && (
            <p style={{ ...b, fontSize: '0.95rem', color: textMid, lineHeight: 1.6, marginBottom: '1.5rem' }}>{intro}</p>
          )}

          {children}

          {slug && (prev || next) && <PrevNext prev={prev && { label: prev.title, href: `/how-to/${prev.slug}` }} next={next && { label: next.title, href: `/how-to/${next.slug}` }} />}
        </div>
      </section>

      <Footer pageName="How To" />
    </div>
  );
}

export { bg, surface, card, border, green, greenHi, text, textMid, textDim, gold, amber, bc, b };
