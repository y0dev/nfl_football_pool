import Link from 'next/link';
import { Info } from 'lucide-react';
import { ALL_SALES_FINAL_DETAIL } from '@/lib/pricing';

// Design tokens (matches landing page / app-wide dark theme)
const gold    = 'oklch(74% 0.16 72)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

/**
 * The no-refund policy, shown wherever someone can pay. `variant="banner"`
 * is the prominent box above the plans; `variant="inline"` is the one-liner
 * directly under a pay button.
 */
export function SalesFinalNotice({ variant = 'banner' }: { variant?: 'banner' | 'inline' }) {
  if (variant === 'inline') {
    return (
      <p style={{ ...b, fontSize: '0.72rem', color: textMid, textAlign: 'center', marginTop: '0.55rem', lineHeight: 1.5 }}>
        <strong style={{ color: gold }}>All sales are final</strong> — no refunds.
      </p>
    );
  }

  return (
    <div
      role="note"
      style={{
        display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
        maxWidth: 720, margin: '0 auto 1.75rem',
        background: 'oklch(74% 0.16 72 / 0.08)',
        border: '1px solid oklch(74% 0.16 72 / 0.4)',
        borderRadius: 8, padding: '0.85rem 1.1rem',
      }}
    >
      <Info aria-hidden style={{ width: 18, height: 18, color: gold, flexShrink: 0, marginTop: 2 }} />
      <div>
        <p style={{ ...bc, fontWeight: 800, fontSize: '0.8rem', letterSpacing: '0.12em', color: gold, textTransform: 'uppercase', marginBottom: '0.2rem' }}>
          All sales are final
        </p>
        <p style={{ ...b, fontSize: '0.83rem', color: text, lineHeight: 1.55 }}>
          {ALL_SALES_FINAL_DETAIL} Each purchase covers one NFL season, through the Super Bowl. Not sure yet? Start on Free and
          upgrade when you&apos;re ready.{' '}
          <Link href="/terms#payments" style={{ color: gold, textDecoration: 'underline' }}>See Terms</Link>.
        </p>
      </div>
    </div>
  );
}
