import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const text    = 'oklch(95% 0.006 255)';
const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;

export interface BreadcrumbItem {
  label: string;
  /** Omit on the last (current-page) item — it renders as plain text, not a link. */
  href?: string;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem', ...bc, fontWeight: 600, fontSize: '0.75rem', letterSpacing: '0.03em' }}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', minWidth: 0 }}>
            {item.href && !isLast ? (
              <Link href={item.href} style={{ color: textMid, textDecoration: 'none' }}>
                {item.label}
              </Link>
            ) : (
              <span style={{ color: isLast ? text : textMid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} aria-current={isLast ? 'page' : undefined}>
                {item.label}
              </span>
            )}
            {!isLast && <ChevronRight style={{ width: 12, height: 12, color: textDim, flexShrink: 0 }} />}
          </span>
        );
      })}
    </nav>
  );
}
