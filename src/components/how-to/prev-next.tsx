import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';

const card    = 'oklch(20% 0.03 255)';
const border  = 'oklch(26% 0.03 255)';
const greenHi = 'oklch(59% 0.15 155)';
const textDim = 'oklch(50% 0.018 255)';
const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;

interface GuideLink {
  label: string;
  href: string;
}

export function PrevNext({ prev, next }: { prev?: GuideLink; next?: GuideLink }) {
  return (
    <nav aria-label="Guide navigation" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginTop: '3rem', paddingTop: '1.5rem', borderTop: `1px solid ${border}`, flexWrap: 'wrap' }}>
      {prev ? (
        <Link href={prev.href} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1rem', background: card, border: `1px solid ${border}`, borderRadius: 8, textDecoration: 'none', maxWidth: '48%' }}>
          <ArrowLeft style={{ width: 15, height: 15, color: greenHi, flexShrink: 0 }} />
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', ...bc, fontWeight: 600, fontSize: '0.65rem', color: textDim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Previous</span>
            <span style={{ display: 'block', ...bc, fontWeight: 700, fontSize: '0.85rem', color: greenHi, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{prev.label}</span>
          </span>
        </Link>
      ) : <span />}
      {next ? (
        <Link href={next.href} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1rem', background: card, border: `1px solid ${border}`, borderRadius: 8, textDecoration: 'none', maxWidth: '48%', marginLeft: 'auto', textAlign: 'right' }}>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', ...bc, fontWeight: 600, fontSize: '0.65rem', color: textDim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Next</span>
            <span style={{ display: 'block', ...bc, fontWeight: 700, fontSize: '0.85rem', color: greenHi, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{next.label}</span>
          </span>
          <ArrowRight style={{ width: 15, height: 15, color: greenHi, flexShrink: 0 }} />
        </Link>
      ) : <span />}
    </nav>
  );
}
