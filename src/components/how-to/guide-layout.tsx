import type { ReactNode } from 'react';
import { Footer } from '@/components/layout/Footer';
import { AppNav } from '@/components/layout/AppNav';
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
      <AppNav isAuthenticated={false} />

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
