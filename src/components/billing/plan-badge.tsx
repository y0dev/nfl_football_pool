import type { Plan } from '@/lib/plan';

const text    = 'oklch(95% 0.006 255)';
const textDim = 'oklch(50% 0.018 255)';
const gold    = 'oklch(74% 0.16 72)';
const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;

// Free/Standard today; add an entry here for each future plan rather than
// branching on plan name at call sites.
const PLAN_STYLES: Record<Plan, { label: string; dot: string; color: string; background: string; border: string }> = {
  free: {
    label: 'Free Plan',
    dot: 'oklch(60% 0.01 255)',
    color: textDim,
    background: 'oklch(26% 0.02 255 / 0.5)',
    border: 'oklch(35% 0.02 255)',
  },
  standard: {
    label: 'Standard Commissioner',
    dot: gold,
    color: gold,
    background: 'oklch(74% 0.16 72 / 0.12)',
    border: 'oklch(74% 0.16 72 / 0.4)',
  },
};

export function PlanBadge({ plan, isTrialActive, daysLeft }: { plan: Plan; isTrialActive?: boolean; daysLeft?: number }) {
  const style = PLAN_STYLES[plan] ?? PLAN_STYLES.free;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
      padding: '0.3rem 0.75rem', borderRadius: 999,
      background: style.background, border: `1px solid ${style.border}`,
      ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.05em',
      color: style.color, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: style.dot, flexShrink: 0 }} />
      {style.label}
      {isTrialActive && (
        <span style={{ color: text, opacity: 0.75 }}>· Trial, {daysLeft}d left</span>
      )}
    </span>
  );
}
