'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { getPoolPayoutConfig, setPoolPayoutConfig, getActiveParticipantCount } from '@/actions/poolPayouts';
import {
  PayoutConfig, PayoutPosition, TiePolicy, WeeklyAmountType,
  validatePayoutPositions, validateEntryFee, validateWeeklyAmount,
  computeTotalPool, computeWeeklyDollarAmount, computeOverallAllocation,
  defaultPositionSplit, formatCurrency, ordinal, DEFAULT_PAYOUT_CONFIG,
} from '@/lib/payouts';
import { DollarSign, Info, Plus, Trash2, Save, AlertTriangle } from 'lucide-react';

const card    = 'oklch(20% 0.03 255)';
const surface = 'oklch(17% 0.028 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const gold    = 'oklch(74% 0.16 72)';
const amber   = 'oklch(72% 0.16 60)';
const blue    = 'oklch(58% 0.15 250)';
const red     = 'oklch(60% 0.22 25)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

const cardStyle = { background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '1.25rem' };
const labelStyle = { ...bc, fontSize: '0.68rem', fontWeight: 700 as const, color: textDim, textTransform: 'uppercase' as const, letterSpacing: '0.08em', display: 'block', marginBottom: '0.35rem' };
const inputStyle = { ...b, background: surface, border: `1px solid ${border}`, color: text, padding: '0.5rem 0.75rem', width: '100%', borderRadius: 6, boxSizing: 'border-box' as const, fontSize: '0.875rem' };

function OnOffToggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: '0.35rem', background: 'oklch(13% 0.025 255)', border: `1px solid ${border}`, borderRadius: 6, padding: '0.25rem', width: 'fit-content' }}>
      {([false, true] as const).map(val => (
        <button
          key={String(val)}
          type="button"
          disabled={disabled}
          onClick={() => onChange(val)}
          style={{
            padding: '0.35rem 0.9rem',
            background: value === val ? (val ? green : 'oklch(26% 0.03 255)') : 'transparent',
            color: value === val ? text : textDim,
            border: 'none', borderRadius: 4,
            ...bc, fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.07em', textTransform: 'uppercase',
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          {val ? 'On' : 'Off'}
        </button>
      ))}
    </div>
  );
}

function PositionsEditor({
  positions, onChange, accent,
}: { positions: PayoutPosition[]; onChange: (p: PayoutPosition[]) => void; accent: string }) {
  const total = positions.reduce((sum, p) => sum + (Number.isFinite(p.percentage) ? p.percentage : 0), 0);
  const totalOk = Math.abs(total - 100) < 0.01;

  const applyPreset = (count: number) => onChange(defaultPositionSplit(count));

  const updatePercentage = (place: number, value: number) => {
    onChange(positions.map(p => p.place === place ? { ...p, percentage: value } : p));
  };

  const removePosition = (place: number) => {
    const remaining = positions.filter(p => p.place !== place).sort((a, b2) => a.place - b2.place);
    onChange(remaining.map((p, i) => ({ ...p, place: i + 1 })));
  };

  const addPosition = () => {
    onChange([...positions, { place: positions.length + 1, percentage: 0 }]);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => applyPreset(n)}
            style={{
              padding: '0.3rem 0.65rem',
              background: positions.length === n ? accent : 'transparent',
              color: positions.length === n ? 'oklch(13% 0.025 255)' : textMid,
              border: `1px solid ${positions.length === n ? accent : border}`,
              borderRadius: 5, cursor: 'pointer',
              ...bc, fontWeight: 700, fontSize: '0.72rem',
            }}
          >
            {n} Winner{n > 1 ? 's' : ''}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {positions.map(p => (
          <div key={p.place} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ ...bc, fontWeight: 700, fontSize: '0.8rem', color: text, width: '3.5rem', flexShrink: 0 }}>
              {ordinal(p.place)}
            </span>
            <input
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={Number.isFinite(p.percentage) ? p.percentage : ''}
              onChange={e => updatePercentage(p.place, parseFloat(e.target.value))}
              style={{ ...inputStyle, width: '6rem', flex: '0 0 auto' }}
            />
            <span style={{ ...b, fontSize: '0.8rem', color: textDim }}>%</span>
            {positions.length > 1 && (
              <button type="button" onClick={() => removePosition(p.place)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: textDim, cursor: 'pointer', padding: '0.25rem' }}>
                <Trash2 style={{ width: 14, height: 14 }} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.75rem' }}>
        <button type="button" onClick={addPosition} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'transparent', border: `1px dashed ${border}`, borderRadius: 6, padding: '0.35rem 0.7rem', color: textMid, cursor: 'pointer', ...bc, fontWeight: 700, fontSize: '0.7rem' }}>
          <Plus style={{ width: 12, height: 12 }} /> Add Position
        </button>
        <span style={{ ...bc, fontWeight: 800, fontSize: '0.85rem', color: totalOk ? greenHi : red }}>
          Total: {total.toFixed(2)}%
        </span>
      </div>
      {!totalOk && (
        <p style={{ ...b, fontSize: '0.75rem', color: red, marginTop: '0.35rem' }}>Payout percentages must total 100%.</p>
      )}
    </div>
  );
}

interface PayoutSettingsProps {
  poolId: string;
  isLocked?: boolean;
}

export function PayoutSettings({ poolId, isLocked }: PayoutSettingsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [config, setConfig] = useState<PayoutConfig>(DEFAULT_PAYOUT_CONFIG);
  const [participantCount, setParticipantCount] = useState(0);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      const [cfg, count] = await Promise.all([
        getPoolPayoutConfig(poolId),
        getActiveParticipantCount(poolId),
      ]);
      setConfig(cfg);
      setParticipantCount(count);
      setIsLoading(false);
    })();
  }, [poolId]);

  const errors = useMemo(() => {
    const list: string[] = [];
    const feeErr = validateEntryFee(config.entryFee);
    if (feeErr) list.push(feeErr);
    if (config.weeklyEnabled) {
      const amtErr = validateWeeklyAmount(config.weeklyAmountType, config.weeklyAmount);
      if (amtErr) list.push(`Weekly payouts: ${amtErr}`);
      const posErr = validatePayoutPositions(config.weeklyPositions);
      if (posErr) list.push(`Weekly payouts: ${posErr}`);
    }
    if (config.overallEnabled) {
      const posErr = validatePayoutPositions(config.overallPositions);
      if (posErr) list.push(`Overall payouts: ${posErr}`);
    }
    return list;
  }, [config]);

  const totalPool = computeTotalPool(config.entryFee, participantCount);
  const weeklyDollar = config.weeklyEnabled ? computeWeeklyDollarAmount(config, totalPool) : 0;
  // Preview assumes a full 17-week regular season for illustration only —
  // the calculator uses the pool's real season scope when it actually runs.
  const overallDollar = config.overallEnabled
    ? computeOverallAllocation(totalPool, config.weeklyEnabled ? weeklyDollar : 0, config.weeklyEnabled ? 17 : 0)
    : 0;

  const handleSave = async () => {
    if (!user?.email || errors.length > 0) return;
    setIsSaving(true);
    try {
      const result = await setPoolPayoutConfig(poolId, user.email, config);
      if (result.success) {
        toast({ title: 'Success', description: 'Payout settings saved.' });
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div style={cardStyle}>
        <p style={{ ...bc, fontWeight: 800, fontSize: '0.85rem', color: text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Payouts</p>
        <div style={{ marginTop: '0.85rem' }}>
          {['75%', '50%'].map((w, i) => (
            <div key={i} style={{ height: 12, background: surface, borderRadius: 4, marginBottom: '0.5rem', width: w }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...cardStyle, borderLeft: `3px solid ${config.enabled ? gold : border}`, opacity: isLocked ? 0.55 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <DollarSign style={{ width: 16, height: 16, color: config.enabled ? gold : textDim }} />
          <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', color: text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Payouts</p>
        </div>
        <OnOffToggle value={config.enabled} onChange={v => setConfig({ ...config, enabled: v })} disabled={isLocked} />
      </div>

      {!config.enabled ? (
        <div>
          <p style={{ ...b, fontSize: '0.8rem', color: textDim }}>Payouts are not configured for this pool.</p>
          <Link href="/how-to/payouts" style={{ ...b, fontSize: '0.78rem', color: greenHi, marginTop: '0.35rem', display: 'inline-block' }}>Not sure how payouts work? Learn how →</Link>
        </div>
      ) : (
        <fieldset disabled={isLocked} style={{ border: 'none', padding: 0, margin: 0 }}>
          {/* Money disclaimer (Step 3) */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', background: `${blue}0f`, border: `1px solid color-mix(in oklch, ${blue} 30%, ${border})`, borderRadius: 6, padding: '0.75rem 0.9rem', marginBottom: '1.25rem' }}>
            <Info style={{ width: 14, height: 14, color: blue, flexShrink: 0, marginTop: 2 }} />
            <p style={{ ...b, fontSize: '0.78rem', color: textMid, lineHeight: 1.55 }}>
              This is <strong style={{ color: text }}>not payment processing</strong>. Sunday Huddle does not collect entry fees or distribute winnings — you&apos;re responsible for collecting entry fees and paying winners outside the app. Sunday Huddle only calculates the payout amounts based on the rules you configure below.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Entry fee */}
            <div>
              <label style={labelStyle}>Entry Fee <span style={{ color: textDim, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional — used for calculations only)</span></label>
              <div style={{ position: 'relative', maxWidth: '12rem' }}>
                <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: textDim, fontSize: '0.875rem' }}>$</span>
                <input
                  type="number" min={0} step={0.01}
                  value={config.entryFee ?? ''}
                  onChange={e => setConfig({ ...config, entryFee: e.target.value === '' ? null : parseFloat(e.target.value) })}
                  placeholder="0.00"
                  style={{ ...inputStyle, paddingLeft: '1.5rem' }}
                />
              </div>
              <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.3rem' }}>
                Sunday Huddle does not collect this money — leave blank for a pool with no money involved.
              </p>
            </div>

            {/* Weekly payouts */}
            <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 8, padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: config.weeklyEnabled ? '1rem' : 0 }}>
                <p style={{ ...bc, fontWeight: 700, fontSize: '0.8rem', color: text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Weekly Payouts</p>
                <OnOffToggle value={config.weeklyEnabled} onChange={v => setConfig({ ...config, weeklyEnabled: v })} />
              </div>
              {config.weeklyEnabled && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={labelStyle}>Weekly Prize Pool</label>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.25rem', background: 'oklch(13% 0.025 255)', border: `1px solid ${border}`, borderRadius: 6, padding: '0.2rem' }}>
                        {(['fixed', 'percentage'] as WeeklyAmountType[]).map(t => (
                          <button
                            key={t} type="button"
                            onClick={() => setConfig({ ...config, weeklyAmountType: t })}
                            style={{ padding: '0.3rem 0.6rem', background: config.weeklyAmountType === t ? green : 'transparent', color: config.weeklyAmountType === t ? text : textDim, border: 'none', borderRadius: 4, cursor: 'pointer', ...bc, fontWeight: 700, fontSize: '0.68rem', textTransform: 'uppercase' }}
                          >
                            {t === 'fixed' ? '$ Fixed' : '% of Pool'}
                          </button>
                        ))}
                      </div>
                      <div style={{ position: 'relative', width: '8rem' }}>
                        {config.weeklyAmountType === 'fixed' && <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: textDim, fontSize: '0.875rem' }}>$</span>}
                        <input
                          type="number" min={0} step={0.01}
                          value={config.weeklyAmount ?? ''}
                          onChange={e => setConfig({ ...config, weeklyAmount: e.target.value === '' ? null : parseFloat(e.target.value) })}
                          style={{ ...inputStyle, paddingLeft: config.weeklyAmountType === 'fixed' ? '1.5rem' : '0.75rem' }}
                        />
                        {config.weeklyAmountType === 'percentage' && <span style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: textDim, fontSize: '0.875rem' }}>%</span>}
                      </div>
                    </div>
                    {config.weeklyAmountType === 'percentage' && (
                      <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.3rem' }}>Percentage of the total prize pool (entry fee × participants), paid out each week.</p>
                    )}
                  </div>
                  <div>
                    <label style={labelStyle}>Weekly Winners</label>
                    <PositionsEditor positions={config.weeklyPositions} onChange={p => setConfig({ ...config, weeklyPositions: p })} accent={greenHi} />
                  </div>
                </div>
              )}
            </div>

            {/* Overall payouts */}
            <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 8, padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: config.overallEnabled ? '1rem' : 0 }}>
                <p style={{ ...bc, fontWeight: 700, fontSize: '0.8rem', color: text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Overall Season Payout</p>
                <OnOffToggle value={config.overallEnabled} onChange={v => setConfig({ ...config, overallEnabled: v })} />
              </div>
              {config.overallEnabled && (
                <div>
                  <label style={labelStyle}>Overall Winners</label>
                  <PositionsEditor positions={config.overallPositions} onChange={p => setConfig({ ...config, overallPositions: p })} accent={gold} />
                </div>
              )}
            </div>

            {/* Tie policy */}
            <div>
              <label style={labelStyle}>If Participants Tie</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {([
                  { value: 'split', label: 'Split tied payouts equally', desc: 'Combined payout for the tied positions is divided evenly among the tied participants.' },
                  { value: 'tie_breaker', label: "Use this pool's existing tie-breaker", desc: 'Ranks tied participants using the same Monday-night tie-breaker the leaderboard uses.' },
                  { value: 'commissioner', label: 'I’ll decide manually', desc: 'The calculator flags the tie instead of splitting automatically.' },
                ] as { value: TiePolicy; label: string; desc: string }[]).map(opt => (
                  <label key={opt.value} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer', padding: '0.6rem 0.75rem', background: config.tiePolicy === opt.value ? 'oklch(26% 0.03 255)' : 'transparent', border: `1px solid ${config.tiePolicy === opt.value ? greenHi : border}`, borderRadius: 6 }}>
                    <input type="radio" name="tie_policy" checked={config.tiePolicy === opt.value} onChange={() => setConfig({ ...config, tiePolicy: opt.value })} style={{ marginTop: 3 }} />
                    <span>
                      <span style={{ display: 'block', ...b, fontWeight: 600, fontSize: '0.85rem', color: text }}>{opt.label}</span>
                      <span style={{ display: 'block', ...b, fontSize: '0.75rem', color: textDim, marginTop: '0.1rem' }}>{opt.desc}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Live preview (Step 15) */}
            {(config.weeklyEnabled || config.overallEnabled) && (
              <div style={{ background: 'oklch(19% 0.04 72)', border: `1px solid oklch(35% 0.1 72)`, borderRadius: 8, padding: '1rem' }}>
                <p style={{ ...bc, fontWeight: 800, fontSize: '0.78rem', color: gold, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.75rem' }}>Payout Preview</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <PreviewRow label="Entry Fee" value={config.entryFee ? formatCurrency(config.entryFee) : '—'} />
                  <PreviewRow label="Active Participants" value={String(participantCount)} />
                  <PreviewRow label="Total Contributions" value={formatCurrency(totalPool)} strong />
                  {config.weeklyEnabled && <PreviewRow label={`Weekly Payout${config.weeklyAmountType === 'percentage' ? ' (per week)' : ''}`} value={formatCurrency(weeklyDollar)} />}
                  {config.overallEnabled && (
                    <PreviewRow
                      label="Overall Allocation"
                      value={formatCurrency(overallDollar)}
                      note={
                        config.weeklyEnabled && overallDollar === 0 && weeklyDollar > 0
                          ? 'Weekly payouts alone would exceed the total prize pool over a full season, so nothing is left for overall — lower the weekly amount or entry fee, or raise participants.'
                          : config.weeklyEnabled
                          ? 'Assumes a 17-week season for this preview — the calculator uses the real schedule.'
                          : undefined
                      }
                    />
                  )}
                </div>
                {config.overallEnabled && (
                  <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: `1px solid oklch(35% 0.1 72 / 0.5)` }}>
                    {config.overallPositions.filter(p => p.percentage > 0).sort((a, b2) => a.place - b2.place).map(p => (
                      <PreviewRow key={p.place} label={`${ordinal(p.place)} Place — ${p.percentage}%`} value={formatCurrency(round2(overallDollar * p.percentage / 100))} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {errors.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', background: `${red}12`, border: `1px solid color-mix(in oklch, ${red} 35%, ${border})`, borderRadius: 6, padding: '0.75rem 0.9rem' }}>
                <AlertTriangle style={{ width: 14, height: 14, color: red, flexShrink: 0, marginTop: 2 }} />
                <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  {errors.map((e, i) => <li key={i} style={{ ...b, fontSize: '0.78rem', color: red }}>{e}</li>)}
                </ul>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || errors.length > 0}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: (isSaving || errors.length > 0) ? surface : green, color: (isSaving || errors.length > 0) ? textDim : text, border: 'none', borderRadius: 6, cursor: (isSaving || errors.length > 0) ? 'not-allowed' : 'pointer', ...bc, fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}
            >
              <Save style={{ width: 13, height: 13 }} />
              {isSaving ? 'Saving…' : 'Save Payout Settings'}
            </button>
          </div>
        </fieldset>
      )}
    </div>
  );
}

function PreviewRow({ label, value, strong, note }: { label: string; value: string; strong?: boolean; note?: string }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <span style={{ ...b, fontSize: '0.8rem', color: textMid }}>{label}</span>
        <span style={{ ...bc, fontWeight: strong ? 800 : 700, fontSize: strong ? '0.95rem' : '0.85rem', color: strong ? gold : text }}>{value}</span>
      </div>
      {note && <p style={{ ...b, fontSize: '0.68rem', color: textDim, marginTop: '0.1rem' }}>{note}</p>}
    </div>
  );
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
