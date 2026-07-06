'use client';

import type { PriceInfo } from '@/lib/pricing';
import { getSaleLabel } from '@/lib/pricing';

// Design tokens (matches landing page / app-wide dark theme)
const gold    = 'oklch(74% 0.16 72)';
const text    = 'oklch(95% 0.006 255)';
const textDim = 'oklch(50% 0.018 255)';

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

/**
 * Plan price with sale comparison: when a sale is active the list price is
 * struck through next to the effective price, with a sale badge.
 *   $50̶  $30 /season  [SALE]
 */
export function PriceTag({ price, suffix }: { price: PriceInfo; suffix: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.45rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
      {price.onSale && (
        <span
          aria-label={`Regular price $${price.list}`}
          style={{ ...bc, fontWeight: 700, fontSize: '1.35rem', color: textDim, textDecoration: 'line-through', lineHeight: 1 }}
        >
          ${price.list}
        </span>
      )}
      <span style={{ ...bc, fontWeight: 900, fontSize: '2.25rem', color: price.onSale ? gold : text, lineHeight: 1 }}>
        ${price.effective}
      </span>
      <span style={{ ...b, fontSize: '0.8rem', color: textDim }}>{suffix}</span>
      {price.onSale && (
        <span style={{
          ...bc, fontWeight: 700, fontSize: '0.6rem', letterSpacing: '0.12em',
          textTransform: 'uppercase', color: gold,
          background: 'oklch(74% 0.16 72 / 0.14)', border: '1px solid oklch(74% 0.16 72 / 0.45)',
          padding: '0.18rem 0.45rem', borderRadius: 4, alignSelf: 'center',
        }}>
          {getSaleLabel()}
        </span>
      )}
    </div>
  );
}
