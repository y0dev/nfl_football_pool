import type { ReactNode } from 'react';

const green   = 'oklch(46% 0.14 155)';
const text    = 'oklch(95% 0.006 255)';
const gold    = 'oklch(74% 0.16 72)';
const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;

/** One numbered step in a guide's workflow (e.g. "1. Open Your Huddle").
 * Wraps a heading + a screenshot + explanation. */
export function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '2rem' }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', ...bc, fontWeight: 800, fontSize: '1.1rem', color: text, margin: 0 }}>
        <span style={{
          flexShrink: 0, width: 30, height: 30, borderRadius: '50%', background: green, color: text,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 800,
        }}>
          {number}
        </span>
        <span style={{ color: gold }}>{title}</span>
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>{children}</div>
    </section>
  );
}
