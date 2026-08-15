import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { GuideLayout, card, border, greenHi, text, textMid, textDim, gold, bc, b } from '@/components/how-to/guide-layout';
import { HOW_TO_GUIDES } from '@/lib/how-to-guides';

export const metadata = { title: 'How To Use Sunday Huddle' };

export default function HowToLandingPage() {
  return (
    <GuideLayout
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'How To' }]}
      title={<>How To Use <span style={{ color: gold }}>Sunday Huddle</span></>}
      intro="Everything you need to get your Huddle running — from creating your first pool to tracking standings all season."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {HOW_TO_GUIDES.map((guide, i) => (
          <Link
            key={guide.slug}
            href={`/how-to/${guide.slug}`}
            style={{
              display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.1rem 1.25rem',
              background: card, border: `1px solid ${border}`, borderRadius: 10, textDecoration: 'none',
            }}
          >
            <span style={{
              flexShrink: 0, width: 34, height: 34, borderRadius: '50%', background: 'oklch(26% 0.03 255)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', ...bc, fontWeight: 800, fontSize: '0.95rem', color: greenHi,
            }}>
              {i + 1}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{guide.title}</span>
              <span style={{ display: 'block', ...b, fontSize: '0.85rem', color: textMid, marginTop: '0.15rem' }}>{guide.summary}</span>
            </span>
            <ArrowRight style={{ width: 16, height: 16, color: textDim, flexShrink: 0 }} />
          </Link>
        ))}
      </div>
    </GuideLayout>
  );
}
