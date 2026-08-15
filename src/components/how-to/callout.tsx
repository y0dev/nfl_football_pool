const surface = 'oklch(17% 0.028 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

export interface CalloutItem {
  label: string;
  description: string;
}

/** Numbered callout list explaining the ①②③ markers pointed at in a
 * screenshot above it. Use sparingly — only where a screenshot has enough
 * distinct clickable elements that labeling them helps. */
export function Callout({ items }: { items: CalloutItem[] }) {
  return (
    <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 10, padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <span style={{
            flexShrink: 0, width: 24, height: 24, borderRadius: '50%', background: green, color: text,
            display: 'flex', alignItems: 'center', justifyContent: 'center', ...bc, fontWeight: 800, fontSize: '0.75rem',
          }}>
            {i + 1}
          </span>
          <div>
            <p style={{ ...bc, fontWeight: 700, fontSize: '0.85rem', color: greenHi, textTransform: 'uppercase', letterSpacing: '0.03em', margin: 0 }}>{item.label}</p>
            <p style={{ ...b, fontSize: '0.85rem', color: textMid, margin: '0.15rem 0 0' }}>{item.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
