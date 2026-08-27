'use client';

// Shared image-generation for payout results (Weekly, Overall Season, and
// Quarter) — ONE implementation, fed different data by each caller in
// payout-calculator.tsx. No existing image/graphic-generation pattern exists
// anywhere else in the app (checked: no html2canvas/dom-to-image dependency,
// no canvas usage, and the app's existing "Share" buttons — SharePoolButton,
// the Survivor picks share action — only ever share a link/text via
// navigator.share, never a file/image), so this introduces one.
//
// Uses html2canvas-pro (not plain html2canvas): this app's entire design
// system is oklch()-based inline styles, and stock html2canvas 1.4.1's color
// parser throws on modern CSS color functions ("Attempting to parse an
// unsupported color function 'lab'") — caught by manually exercising this
// exact button in a real browser before calling it done, not just from a
// code read. html2canvas-pro is the actively-maintained fork adding oklch/
// lab/color() support, with an identical API — verified as a drop-in.

import { useRef, useState } from 'react';
import { Share2, Loader2 } from 'lucide-react';
import { TiePolicy, formatCurrency } from '@/lib/payouts';

const bg      = 'oklch(13% 0.025 255)';
const card    = 'oklch(20% 0.03 255)';
const surface = 'oklch(17% 0.028 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const gold    = 'oklch(74% 0.16 72)';
const amber   = 'oklch(72% 0.16 60)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

export type PoolTypeLabel = 'Confidence' | "Pick'em" | 'Survivor';

export interface SharePayoutResult {
  placeLabel: string;
  participantName: string;
  amount: number;
  tied: boolean;
  needsManualResolution?: boolean;
  note?: string;
}

const TIE_POLICY_LABEL: Record<TiePolicy, string> = {
  split: 'Split equally',
  tie_breaker: "Pool's tie-breaker",
  commissioner: 'Commissioner decides',
};

interface PayoutShareCardProps {
  poolName?: string;
  poolTypeLabel: PoolTypeLabel;
  timeframeLabel: string;
  entryFee: number | null;
  tiePolicy: TiePolicy;
  results: SharePayoutResult[];
}

/** The actual card that gets rasterized. Fixed pixel width (not responsive
 * units) on purpose — html2canvas renders this off-screen at a size nothing
 * else on the page constrains, and a fixed width keeps the exported image's
 * proportions predictable regardless of the viewer's own screen. 640px is
 * legible at typical phone screen widths and holds up fine when shrunk to a
 * group-chat thumbnail. */
export function PayoutShareCard({ poolName, poolTypeLabel, timeframeLabel, entryFee, tiePolicy, results }: PayoutShareCardProps) {
  const hasTies = results.some(r => r.tied);
  return (
    <div style={{ width: 640, background: bg, padding: '2rem', boxSizing: 'border-box', fontFamily: 'var(--font-barlow)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <p style={{ ...bc, fontWeight: 900, fontSize: '1.5rem', color: text, textTransform: 'uppercase', letterSpacing: '0.01em', margin: 0 }}>
            {poolName || 'Sunday Huddle Pool'}
          </p>
          <p style={{ ...bc, fontWeight: 700, fontSize: '0.75rem', color: greenHi, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0.25rem 0 0' }}>
            {poolTypeLabel} Pool
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, background: green, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ ...bc, fontWeight: 900, fontSize: '0.8rem', color: text }}>SH</span>
          </div>
          <span style={{ ...bc, fontWeight: 800, fontSize: '0.7rem', color: textDim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sunday Huddle</span>
        </div>
      </div>

      <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1.25rem 1.5rem', marginBottom: '1.25rem' }}>
        <p style={{ ...bc, fontWeight: 800, fontSize: '1.05rem', color: gold, textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
          {timeframeLabel}
        </p>
        <p style={{ ...b, fontSize: '0.85rem', color: textMid, margin: '0.35rem 0 0' }}>
          {entryFee ? `Entry fee: ${formatCurrency(entryFee)}` : 'No entry fee configured'}
          {hasTies ? ` · Ties: ${TIE_POLICY_LABEL[tiePolicy]}` : ''}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
        {results.map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', background: surface, border: `1px solid ${border}`, borderRadius: 8, padding: '0.7rem 1rem' }}>
            <span style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', color: r.tied ? amber : gold, width: '3.25rem', flexShrink: 0 }}>{r.placeLabel}</span>
            <span style={{ ...b, fontSize: '0.95rem', color: text, flex: 1, minWidth: 0 }}>{r.participantName}</span>
            <span style={{ ...bc, fontWeight: 800, fontSize: '1.05rem', color: r.needsManualResolution ? textDim : greenHi, flexShrink: 0 }}>
              {r.needsManualResolution ? 'TBD' : formatCurrency(r.amount)}
            </span>
          </div>
        ))}
      </div>

      <div style={{ borderTop: `1px solid ${border}`, paddingTop: '1rem' }}>
        <p style={{ ...b, fontSize: '0.72rem', color: textDim, lineHeight: 1.5, margin: 0 }}>
          Sunday Huddle does not process payments — this is a calculated summary only. The commissioner is responsible for collecting entry fees and paying winners outside the app.
        </p>
      </div>
    </div>
  );
}

async function rasterizeToPngBlob(node: HTMLElement): Promise<Blob | null> {
  const { default: html2canvas } = await import('html2canvas-pro');
  const canvas = await html2canvas(node, { backgroundColor: null, scale: 2 });
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

type SharePayoutsButtonProps = PayoutShareCardProps;

/** Only rendered by callers once results actually exist (same "results exist"
 * condition already gating the on-screen ResultsTable) — see each Calculator
 * in payout-calculator.tsx. Works identically for Weekly, Overall, and
 * Quarter: all three pass this the same normalized props. */
export function SharePayoutsButton(props: SharePayoutsButtonProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleShare = async () => {
    const node = cardRef.current;
    if (!node || isGenerating) return;
    setIsGenerating(true);
    try {
      const blob = await rasterizeToPngBlob(node);
      if (!blob) return;

      const filename = `${(props.poolName || 'sunday-huddle-pool').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${props.timeframeLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
      const file = new File([blob], filename, { type: 'image/png' });

      const canShareFile = typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
      if (canShareFile) {
        try {
          await navigator.share({ files: [file], title: `${props.timeframeLabel} — ${props.poolName ?? 'Sunday Huddle'}` });
          return;
        } catch (e) {
          // AbortError means the person cancelled the share sheet — not a
          // failure, and definitely not something that should fall through
          // to also triggering a download.
          if (e instanceof Error && e.name === 'AbortError') return;
        }
      }
      triggerDownload(blob, filename);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div style={{ marginTop: '0.85rem' }}>
      {/* Rendered off-screen (not display:none — html2canvas needs real
          layout) so it never affects the visible settings/results UI. */}
      <div style={{ position: 'fixed', top: 0, left: -9999, pointerEvents: 'none' }} aria-hidden="true">
        <div ref={cardRef}>
          <PayoutShareCard {...props} />
        </div>
      </div>

      <button
        type="button"
        onClick={handleShare}
        disabled={isGenerating}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.5rem 0.9rem', background: 'transparent', color: isGenerating ? textDim : textMid,
          border: `1px solid ${border}`, borderRadius: 6, cursor: isGenerating ? 'not-allowed' : 'pointer',
          ...bc, fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase',
        }}
      >
        {isGenerating
          ? <><Loader2 style={{ width: 13, height: 13 }} className="animate-spin" /> Generating…</>
          : <><Share2 style={{ width: 13, height: 13 }} /> Share Payouts</>}
      </button>
    </div>
  );
}

