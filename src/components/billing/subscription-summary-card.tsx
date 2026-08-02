import Link from 'next/link';
import { CreditCard, Users, Trophy, Layers, Plus } from 'lucide-react';
import { PlanBadge } from './plan-badge';
import type { SubscriptionSummary } from '@/lib/subscription';

const surface = 'oklch(17% 0.028 255)';
const cardBg  = 'oklch(20% 0.03 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const gold    = 'oklch(74% 0.16 72)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

function StatTile({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ style?: React.CSSProperties }>; label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 8, padding: '0.9rem 1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
        <Icon style={{ width: 12, height: 12, color: textDim }} />
        <span style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.1em', color: textDim, textTransform: 'uppercase' }}>{label}</span>
      </div>
      <p style={{ ...bc, fontWeight: 900, fontSize: '1.35rem', color: text, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.25rem' }}>{sub}</p>}
    </div>
  );
}

function FeatureRow({ label, included }: { label: string; included: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0' }}>
      <span style={{ ...b, fontSize: '0.82rem', color: textMid }}>{label}</span>
      <span style={{
        ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.06em', textTransform: 'uppercase',
        color: included ? greenHi : textDim,
      }}>
        {included ? 'Included' : 'Not Included'}
      </span>
    </div>
  );
}

/**
 * Central "what does this commissioner have" card — same SubscriptionSummary
 * shape backs the dashboard, Account page, and Purchases empty state so the
 * numbers can never disagree between screens (see src/lib/subscription.ts).
 */
export function SubscriptionSummaryCard({ summary, currentSeason }: { summary: SubscriptionSummary; currentSeason: number }) {
  const isStandard = summary.plan === 'standard';
  const purchasedLabel = summary.standardPurchasedAt
    ? new Date(summary.standardPurchasedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : summary.billingExempt ? 'Comped' : summary.isTrialActive ? 'Trial' : '—';

  return (
    <div style={{ background: cardBg, border: `1px solid ${border}`, borderTop: `3px solid ${isStandard ? gold : border}`, borderRadius: 10, padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <div>
          <p style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.22em', color: textDim, textTransform: 'uppercase', marginBottom: '0.4rem' }}>
            Current Plan
          </p>
          <PlanBadge plan={summary.plan} isTrialActive={summary.isTrialActive} daysLeft={summary.daysLeft} />
        </div>
        {!isStandard && !summary.billingExempt && (
          <Link href="/upgrade" style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
            padding: '0.45rem 0.85rem', background: green, color: text,
            borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.72rem',
            letterSpacing: '0.06em', textTransform: 'uppercase', textDecoration: 'none',
          }}>
            Upgrade to Standard
          </Link>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <StatTile
          icon={CreditCard}
          label={isStandard ? 'Purchased' : 'Season'}
          value={isStandard ? purchasedLabel : String(currentSeason)}
          sub={isStandard ? 'No auto-renewal' : undefined}
        />
        <StatTile icon={Trophy} label="Huddles" value={`${summary.huddlesUsed} / ${summary.huddleLimit}`} sub="Used" />
        <StatTile icon={Users} label="Participants" value={String(summary.participantsTotal)} sub="Total" />
        <StatTile
          icon={Layers}
          label="Pools"
          value={summary.poolsUsed === null ? '—' : `${summary.poolsUsed} / ${summary.poolLimit}`}
          sub={summary.poolsUsed === null ? 'No Huddle yet' : 'Used (primary Huddle)'}
        />
      </div>

      {isStandard && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap',
          background: surface, border: `1px solid ${border}`, borderLeft: `3px solid ${gold}`, borderRadius: 8,
          padding: '0.85rem 1rem', marginBottom: '1.25rem',
        }}>
          <div>
            <p style={{ ...bc, fontWeight: 700, fontSize: '0.6rem', letterSpacing: '0.18em', color: gold, textTransform: 'uppercase', marginBottom: '0.2rem' }}>
              Additional Pools
            </p>
            <p style={{ ...b, fontSize: '0.85rem', color: text }}>
              {summary.addonPools > 0
                ? <><strong>{summary.addonPools}</strong> purchased</>
                : "You haven't purchased any additional pools yet."}
            </p>
          </div>
          <Link href="/upgrade" style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
            padding: '0.4rem 0.8rem', background: 'oklch(74% 0.16 72 / 0.12)', color: gold,
            border: `1px solid oklch(74% 0.16 72 / 0.4)`, borderRadius: 6,
            ...bc, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase', textDecoration: 'none',
          }}>
            <Plus style={{ width: 11, height: 11 }} /> Buy a Pool
          </Link>
        </div>
      )}

      <div style={{ borderTop: `1px solid ${border}`, paddingTop: '0.25rem' }}>
        <FeatureRow label="Clone Season" included={isStandard} />
        <div style={{ height: 1, background: border }} />
        <FeatureRow label="Automatic Reminders" included={isStandard} />
      </div>
    </div>
  );
}
