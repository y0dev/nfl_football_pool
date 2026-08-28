'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import {
  getPoolPayoutConfig, getActiveParticipantCount, getPayoutRecords,
  savePayoutCalculation, markPayoutPaid, PayoutRecordInput,
} from '@/actions/poolPayouts';
import {
  PayoutConfig, calculatePayouts, computeTotalPool, computeWeeklyDollarAmount,
  computeQuarterDollarAmount, computeOverallAllocation, formatCurrency, StandingEntry,
} from '@/lib/payouts';
import { getRegularSeasonPeriods, getPlayoffRoundName } from '@/lib/utils';
import { DollarSign, RefreshCw, Check, AlertTriangle, Calendar, Trophy, CalendarRange } from 'lucide-react';
import { SharePayoutsButton, PoolTypeLabel } from '@/components/admin/payout-share';

const card    = 'oklch(20% 0.03 255)';
const surface = 'oklch(17% 0.028 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const gold    = 'oklch(74% 0.16 72)';
const amber   = 'oklch(72% 0.16 60)';
const text    = 'oklch(95% 0.006 255)';
const textDim = 'oklch(50% 0.018 255)';
const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

const cardStyle = { background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '1.25rem' };
const SEASON_TYPE_WEEKS: Record<number, number> = { 1: 4, 2: 18, 3: 4 };
const SEASON_TYPE_LABELS: Record<number, string> = { 1: 'Preseason', 2: 'Regular Season', 3: 'Postseason' };

interface PayoutCalculatorProps {
  poolId: string;
  /** Only used for the "Share Payouts" image (pool name shown on the card) — never fetched or persisted here. */
  poolName?: string;
  season: number;
  seasonScope: number[];
  defaultSeasonType: number;
  defaultWeek: number;
  /** Pick'em pools compute standings from src/lib/pickem.ts instead of the
   * Confidence leaderboard endpoints — see fetchPickemWeekStandings/
   * fetchPickemSeasonStandings above. Everything past the fetch (the actual
   * payout math) is identical either way. */
  isPickem?: boolean;
  /** Only used to label the pool type on the shared image — Survivor never
   * reaches QuarterCalculator regardless (see showQuarterOption gating). */
  isSurvivor?: boolean;
  /** Quarter (Q1-Q4) payouts — see the gating comment in pool-workspace.tsx. */
  showQuarterOption?: boolean;
}

interface LeaderboardRow { participant_id: string; participant_name: string; total_points: number }

// adminEmail is sent as x-admin-email so this admin-only panel (already
// behind AdminGuard login) isn't asked to satisfy the *participant*
// password gate these endpoints also enforce for a private pool — see
// isAdminForPool in src/lib/pool-access.ts.
function adminHeaders(adminEmail: string | null | undefined): HeadersInit | undefined {
  return adminEmail ? { 'x-admin-email': adminEmail } : undefined;
}

async function fetchWeekLeaderboard(poolId: string, week: number, seasonType: number, season: number, adminEmail: string | null | undefined): Promise<StandingEntry[]> {
  const res = await fetch(`/api/leaderboard?poolId=${poolId}&week=${week}&seasonType=${seasonType}&season=${season}`, { headers: adminHeaders(adminEmail) });
  const data = await res.json();
  if (!data.success) return [];
  return (data.leaderboard as LeaderboardRow[])
    .map(r => ({ participantId: r.participant_id, participantName: r.participant_name, score: r.total_points }))
    .sort((a, b2) => b2.score - a.score);
}

async function fetchSeasonLeaderboard(poolId: string, season: number, currentWeek: number, currentSeasonType: number, adminEmail: string | null | undefined): Promise<StandingEntry[]> {
  const res = await fetch(`/api/leaderboard/season?poolId=${poolId}&season=${season}&currentWeek=${currentWeek}&currentSeasonType=${currentSeasonType}`, { headers: adminHeaders(adminEmail) });
  const data = await res.json();
  if (!data.success) return [];
  return (data.leaderboard as LeaderboardRow[])
    .map(r => ({ participantId: r.participant_id, participantName: r.participant_name, score: r.total_points }))
    .sort((a, b2) => b2.score - a.score);
}

// Quarter standings reuse the same period-leaderboard endpoint the app's own
// Period tab (src/app/api/periods/leaderboard/route.ts) already uses — that
// endpoint's regular-season branch (seasonType 2) computes Q1-Q4 standings
// via computeSeasonReview(), and its seasonType-3 branch computes the
// combined "Playoffs" period. A pool whose season scope includes the
// postseason gets a "Playoffs" option alongside Q1-Q4, so seasonType is 2
// for a quarter and 3 for the playoff period.
interface PeriodLeaderboardRow { participant_id: string; name: string; total_points: number }

async function fetchQuarterLeaderboard(poolId: string, season: number, periodName: string, seasonType: number, adminEmail: string | null | undefined): Promise<StandingEntry[]> {
  const res = await fetch(`/api/periods/leaderboard?poolId=${poolId}&season=${season}&periodName=${periodName}&seasonType=${seasonType}`, { headers: adminHeaders(adminEmail) });
  const data = await res.json();
  if (!data.success) return [];
  return (data.data.leaderboard as PeriodLeaderboardRow[])
    .map(r => ({ participantId: r.participant_id, participantName: r.name, score: r.total_points }))
    .sort((a, b2) => b2.score - a.score);
}

// Pick'em adapter — maps computePickemWeekResult/computePickemSeasonSummary
// (src/lib/pickem.ts, the one authoritative Pick'em service) into the same
// generic StandingEntry[] shape the Confidence adapters above produce, so
// calculatePayouts/computeOverallAllocation below run completely unchanged.
// Pick'em's "score" here is its correct-pick count — never turned into a
// fake confidence score, just relabeled through the same generic field.
async function fetchPickemWeekStandings(poolId: string, week: number, seasonType: number, adminEmail: string | null | undefined): Promise<StandingEntry[]> {
  const res = await fetch(`/api/pickem/week?poolId=${poolId}&week=${week}&seasonType=${seasonType}`, { headers: adminHeaders(adminEmail) });
  const data = await res.json();
  if (!data.success) return [];
  return (data.result.participants as Array<{ participantId: string; participantName: string; correctCount: number }>)
    .map(p => ({ participantId: p.participantId, participantName: p.participantName, score: p.correctCount }))
    .sort((a, b2) => b2.score - a.score);
}

async function fetchPickemSeasonStandings(poolId: string, adminEmail: string | null | undefined): Promise<StandingEntry[]> {
  const res = await fetch(`/api/pickem/season?poolId=${poolId}`, { headers: adminHeaders(adminEmail) });
  const data = await res.json();
  if (!data.success) return [];
  return (data.summary.participants as Array<{ participantId: string; participantName: string; seasonCorrectCount: number }>)
    .map(p => ({ participantId: p.participantId, participantName: p.participantName, score: p.seasonCorrectCount }))
    .sort((a, b2) => b2.score - a.score);
}

export function PayoutCalculator({ poolId, poolName, season, seasonScope, defaultSeasonType, defaultWeek, isPickem, isSurvivor, showQuarterOption }: PayoutCalculatorProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [config, setConfig] = useState<PayoutConfig | null>(null);
  const [participantCount, setParticipantCount] = useState(0);

  const availableSeasonTypes = seasonScope.length > 0 ? seasonScope : [2];

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      const [cfg, count] = await Promise.all([getPoolPayoutConfig(poolId), getActiveParticipantCount(poolId)]);
      setConfig(cfg);
      setParticipantCount(count);
      setIsLoading(false);
    })();
  }, [poolId]);

  const totalPool = config ? computeTotalPool(config.entryFee, participantCount) : 0;

  if (isLoading) {
    return <div style={cardStyle}><p style={{ ...b, color: textDim, fontSize: '0.85rem' }}>Loading payout configuration…</p></div>;
  }

  if (!config || !config.enabled) {
    return (
      <div style={{ ...cardStyle, textAlign: 'center', padding: '2.5rem' }}>
        <DollarSign style={{ width: 32, height: 32, color: textDim, margin: '0 auto 0.75rem' }} />
        <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', color: text, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Payouts Not Configured</p>
        <p style={{ ...b, fontSize: '0.85rem', color: textDim }}>Enable payout tracking in this pool&apos;s Settings tab to use the calculator.</p>
      </div>
    );
  }

  const poolTypeLabel: PoolTypeLabel = isSurvivor ? 'Survivor' : isPickem ? "Pick'em" : 'Confidence';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ background: card, border: `1px solid ${border}`, borderLeft: `3px solid ${gold}`, borderRadius: 8, padding: '0.75rem 1rem', flex: '1 1 200px' }}>
          <p style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', color: textDim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total Prize Pool</p>
          <p style={{ ...bc, fontWeight: 900, fontSize: '1.4rem', color: gold }}>{formatCurrency(totalPool)}</p>
          <p style={{ ...b, fontSize: '0.7rem', color: textDim }}>
            {config.entryFee ? `${formatCurrency(config.entryFee)} × ${participantCount} participant${participantCount !== 1 ? 's' : ''}` : 'No entry fee configured'}
          </p>
        </div>
      </div>

      {config.weeklyEnabled && (
        <WeeklyCalculator
          poolId={poolId} poolName={poolName} poolTypeLabel={poolTypeLabel} season={season} config={config} totalPool={totalPool}
          availableSeasonTypes={availableSeasonTypes} defaultSeasonType={defaultSeasonType} defaultWeek={defaultWeek}
          requestedBy={user?.email ?? ''} toast={toast} isPickem={isPickem}
        />
      )}

      {showQuarterOption && config.quarterEnabled && (
        <QuarterCalculator
          poolId={poolId} poolName={poolName} poolTypeLabel={poolTypeLabel} season={season} config={config} totalPool={totalPool}
          seasonScope={availableSeasonTypes} requestedBy={user?.email ?? ''} toast={toast}
        />
      )}

      {config.overallEnabled && (
        <OverallCalculator
          poolId={poolId} poolName={poolName} poolTypeLabel={poolTypeLabel} season={season} config={config} totalPool={totalPool}
          defaultSeasonType={defaultSeasonType}
          requestedBy={user?.email ?? ''} toast={toast} isPickem={isPickem}
        />
      )}

      {!config.weeklyEnabled && !config.overallEnabled && !(showQuarterOption && config.quarterEnabled) && (
        <div style={{ ...cardStyle, textAlign: 'center', color: textDim, fontSize: '0.85rem', ...b }}>
          Neither weekly nor overall payouts are enabled — turn one on in Settings to calculate payouts.
        </div>
      )}
    </div>
  );
}

function ResultsTable({
  results, onTogglePaid,
}: {
  results: { id?: string; place: number; placeLabel: string; participantName: string; amount: number; tied: boolean; needsManualResolution?: boolean; note?: string; paid?: boolean }[];
  onTogglePaid?: (index: number) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      {results.map((r, i) => (
        <div key={i}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: surface, border: `1px solid ${r.needsManualResolution ? amber : border}`, borderRadius: 6, padding: '0.6rem 0.85rem' }}>
            <span style={{ ...bc, fontWeight: 800, fontSize: '0.8rem', color: r.tied ? amber : gold, width: '3rem', flexShrink: 0 }}>{r.placeLabel}</span>
            <span style={{ ...b, fontSize: '0.85rem', color: text, flex: 1, minWidth: 0 }}>{r.participantName}</span>
            <span style={{ ...bc, fontWeight: 800, fontSize: '0.95rem', color: r.needsManualResolution ? textDim : greenHi, flexShrink: 0 }}>
              {r.needsManualResolution ? '—' : formatCurrency(r.amount)}
            </span>
            {onTogglePaid && !r.needsManualResolution && (
              <button
                type="button"
                onClick={() => onTogglePaid(i)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.6rem', background: r.paid ? 'oklch(46% 0.14 155 / 0.15)' : 'transparent', color: r.paid ? greenHi : textDim, border: `1px solid ${r.paid ? 'oklch(46% 0.14 155 / 0.4)' : border}`, borderRadius: 5, cursor: 'pointer', ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.05em', textTransform: 'uppercase', flexShrink: 0 }}
              >
                {r.paid && <Check style={{ width: 11, height: 11 }} />}
                {r.paid ? 'Paid' : 'Mark Paid'}
              </button>
            )}
          </div>
          {r.note && (
            <p style={{ ...b, fontSize: '0.7rem', color: r.needsManualResolution ? amber : textDim, marginTop: '0.2rem', marginLeft: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              {r.needsManualResolution && <AlertTriangle style={{ width: 11, height: 11, flexShrink: 0 }} />}
              {r.note}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function WeeklyCalculator({
  poolId, poolName, poolTypeLabel, season, config, totalPool, availableSeasonTypes, defaultSeasonType, defaultWeek, requestedBy, toast, isPickem,
}: {
  poolId: string; poolName?: string; poolTypeLabel: PoolTypeLabel; season: number; config: PayoutConfig; totalPool: number;
  availableSeasonTypes: number[]; defaultSeasonType: number; defaultWeek: number;
  requestedBy: string; toast: ReturnType<typeof useToast>['toast']; isPickem?: boolean;
}) {
  const [seasonType, setSeasonType] = useState(availableSeasonTypes.includes(defaultSeasonType) ? defaultSeasonType : availableSeasonTypes[0]);
  const [week, setWeek] = useState(defaultWeek || 1);
  const [standings, setStandings] = useState<StandingEntry[] | null>(null);
  const [records, setRecords] = useState<Record<string, { id: string; paid: boolean }>>({});
  const [isCalculating, setIsCalculating] = useState(false);

  const weeklyDollar = computeWeeklyDollarAmount(config, totalPool);

  const runCalculation = useCallback(async () => {
    setIsCalculating(true);
    try {
      const rows = isPickem
        ? await fetchPickemWeekStandings(poolId, week, seasonType, requestedBy)
        : await fetchWeekLeaderboard(poolId, week, seasonType, season, requestedBy);
      setStandings(rows);
      // Scoped to the selected season phase: a full-scope pool's Regular-season
      // Week N and Postseason Week N records share the same `week` number, and
      // are keyed by participant here (not `place` — tied participants share a
      // place), so the phase filter is what keeps the two apart.
      const existing = await getPayoutRecords(poolId, 'weekly', season, week, undefined, seasonType);
      setRecords(Object.fromEntries(existing.filter(r => r.participant_id).map(r => [r.participant_id, { id: r.id, paid: r.paid }])));
    } finally {
      setIsCalculating(false);
    }
  }, [poolId, week, seasonType, season, isPickem, requestedBy]);

  const results = useMemo(() => {
    if (!standings) return [];
    const calculated = calculatePayouts(config.weeklyPositions, weeklyDollar, standings, config.tiePolicy);
    return calculated.map(r => ({ ...r, id: records[r.participantId]?.id, paid: records[r.participantId]?.paid ?? false }));
  }, [standings, config, weeklyDollar, records]);

  const handleSaveAndTogglePaid = async (index: number) => {
    const row = results[index];
    if (!requestedBy) return;

    // Persist the current calculation first (so a record exists to mark
    // paid), then flip that specific row's paid status. Keyed by
    // participant, not place — tied participants legitimately share a
    // place (Step 14), so place alone isn't a unique identity.
    if (!row.id) {
      const inputs: PayoutRecordInput[] = results.filter(r => !r.needsManualResolution).map(r => ({
        scope: 'weekly', season, week, seasonType, place: r.place,
        participantId: r.participantId, participantName: r.participantName, amount: r.amount,
      }));
      const saveResult = await savePayoutCalculation(poolId, requestedBy, inputs);
      if (!saveResult.success) { toast({ title: 'Error', description: saveResult.error, variant: 'destructive' }); return; }
      const existing = await getPayoutRecords(poolId, 'weekly', season, week, undefined, seasonType);
      setRecords(Object.fromEntries(existing.filter(r => r.participant_id).map(r => [r.participant_id, { id: r.id, paid: r.paid }])));
      const refreshed = existing.find(r => r.participant_id === row.participantId);
      if (refreshed) {
        const result = await markPayoutPaid(refreshed.id, requestedBy, !refreshed.paid);
        if (!result.success) { toast({ title: 'Error', description: result.error, variant: 'destructive' }); return; }
        setRecords(prev => ({ ...prev, [row.participantId]: { id: refreshed.id, paid: !refreshed.paid } }));
      }
      return;
    }

    const result = await markPayoutPaid(row.id, requestedBy, !row.paid);
    if (!result.success) { toast({ title: 'Error', description: result.error, variant: 'destructive' }); return; }
    setRecords(prev => ({ ...prev, [row.participantId]: { id: row.id!, paid: !row.paid } }));
  };

  const maxWeek = SEASON_TYPE_WEEKS[seasonType] ?? 18;

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <Calendar style={{ width: 15, height: 15, color: greenHi }} />
        <p style={{ ...bc, fontWeight: 800, fontSize: '0.85rem', color: text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Weekly Payout Calculator</p>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {availableSeasonTypes.length > 1 && (
          <div style={{ display: 'flex', gap: '0.25rem', background: surface, border: `1px solid ${border}`, borderRadius: 6, padding: '0.2rem' }}>
            {availableSeasonTypes.map(st => (
              <button key={st} type="button" onClick={() => setSeasonType(st)} style={{ padding: '0.35rem 0.6rem', background: seasonType === st ? green : 'transparent', color: seasonType === st ? text : textDim, border: 'none', borderRadius: 4, cursor: 'pointer', ...bc, fontWeight: 700, fontSize: '0.68rem' }}>
                {SEASON_TYPE_LABELS[st]}
              </button>
            ))}
          </div>
        )}
        <div>
          <label style={{ ...bc, fontSize: '0.62rem', fontWeight: 700, color: textDim, textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>Week</label>
          <select value={week} onChange={e => setWeek(parseInt(e.target.value))} style={{ ...b, background: surface, border: `1px solid ${border}`, color: text, padding: '0.4rem 0.6rem', borderRadius: 6, fontSize: '0.85rem' }}>
            {Array.from({ length: maxWeek }, (_, i) => i + 1).map(w => (
              <option key={w} value={w}>{seasonType === 3 ? getPlayoffRoundName(w) : `Week ${w}`}</option>
            ))}
          </select>
        </div>
        <button
          type="button" onClick={runCalculation} disabled={isCalculating}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem', background: green, color: text, border: 'none', borderRadius: 6, cursor: isCalculating ? 'not-allowed' : 'pointer', ...bc, fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}
        >
          <RefreshCw style={{ width: 12, height: 12 }} className={isCalculating ? 'animate-spin' : ''} />
          {isCalculating ? 'Calculating…' : 'Calculate'}
        </button>
      </div>

      <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginBottom: '0.75rem' }}>
        Weekly Prize Pool: <strong style={{ color: text }}>{formatCurrency(weeklyDollar)}</strong>
      </p>

      {standings === null ? (
        <p style={{ ...b, fontSize: '0.82rem', color: textDim }}>Choose a week and click Calculate.</p>
      ) : results.length === 0 ? (
        <p style={{ ...b, fontSize: '0.82rem', color: textDim }}>No scores recorded for Week {week} yet.</p>
      ) : (
        <>
          <ResultsTable results={results} onTogglePaid={handleSaveAndTogglePaid} />
          <SharePayoutsButton
            poolName={poolName} poolTypeLabel={poolTypeLabel}
            timeframeLabel={`${seasonType !== 2 ? SEASON_TYPE_LABELS[seasonType] + ' ' : ''}Week ${week} Payout`}
            entryFee={config.entryFee} tiePolicy={config.tiePolicy} results={results}
          />
        </>
      )}
    </div>
  );
}

function OverallCalculator({
  poolId, poolName, poolTypeLabel, season, config, totalPool, defaultSeasonType, requestedBy, toast, isPickem,
}: {
  poolId: string; poolName?: string; poolTypeLabel: PoolTypeLabel; season: number; config: PayoutConfig; totalPool: number; defaultSeasonType: number;
  requestedBy: string; toast: ReturnType<typeof useToast>['toast']; isPickem?: boolean;
}) {
  const [standings, setStandings] = useState<StandingEntry[] | null>(null);
  const [records, setRecords] = useState<Record<string, { id: string; paid: boolean }>>({});
  const [isCalculating, setIsCalculating] = useState(false);
  const [weeksPaid, setWeeksPaid] = useState(0);

  const weeklyDollar = config.weeklyEnabled ? computeWeeklyDollarAmount(config, totalPool) : 0;
  const overallDollar = computeOverallAllocation(totalPool, weeklyDollar, config.weeklyEnabled ? weeksPaid : 0);

  const runCalculation = useCallback(async () => {
    setIsCalculating(true);
    try {
      const rows = isPickem
        ? await fetchPickemSeasonStandings(poolId, requestedBy)
        : await fetchSeasonLeaderboard(poolId, season, SEASON_TYPE_WEEKS[defaultSeasonType] ?? 18, defaultSeasonType, requestedBy);
      setStandings(rows);
      const existing = await getPayoutRecords(poolId, 'overall', season);
      setRecords(Object.fromEntries(existing.filter(r => r.participant_id).map(r => [r.participant_id, { id: r.id, paid: r.paid }])));
      if (config.weeklyEnabled && weeksPaid === 0) {
        const weeklyExisting = await getPayoutRecords(poolId, 'weekly', season);
        // Count phase+week combos, not bare week numbers — for a full-scope
        // pool a paid Regular-season Week 1 and a paid Postseason Week 1 are
        // two distinct weekly payouts and both should be subtracted here.
        const distinctWeeks = new Set(weeklyExisting.map(r => `${r.season_type}-${r.week}`)).size;
        setWeeksPaid(distinctWeeks);
      }
    } finally {
      setIsCalculating(false);
    }
  }, [poolId, season, defaultSeasonType, config.weeklyEnabled, weeksPaid, isPickem, requestedBy]);

  const results = useMemo(() => {
    if (!standings) return [];
    const calculated = calculatePayouts(config.overallPositions, overallDollar, standings, config.tiePolicy);
    return calculated.map(r => ({ ...r, id: records[r.participantId]?.id, paid: records[r.participantId]?.paid ?? false }));
  }, [standings, config, overallDollar, records]);

  const handleSaveAndTogglePaid = async (index: number) => {
    const row = results[index];
    if (!requestedBy) return;

    if (!row.id) {
      const inputs: PayoutRecordInput[] = results.filter(r => !r.needsManualResolution).map(r => ({
        scope: 'overall', season, week: 0, seasonType: null, place: r.place,
        participantId: r.participantId, participantName: r.participantName, amount: r.amount,
      }));
      const saveResult = await savePayoutCalculation(poolId, requestedBy, inputs);
      if (!saveResult.success) { toast({ title: 'Error', description: saveResult.error, variant: 'destructive' }); return; }
      const existing = await getPayoutRecords(poolId, 'overall', season);
      setRecords(Object.fromEntries(existing.filter(r => r.participant_id).map(r => [r.participant_id, { id: r.id, paid: r.paid }])));
      const refreshed = existing.find(r => r.participant_id === row.participantId);
      if (refreshed) {
        const result = await markPayoutPaid(refreshed.id, requestedBy, !refreshed.paid);
        if (!result.success) { toast({ title: 'Error', description: result.error, variant: 'destructive' }); return; }
        setRecords(prev => ({ ...prev, [row.participantId]: { id: refreshed.id, paid: !refreshed.paid } }));
      }
      return;
    }

    const result = await markPayoutPaid(row.id, requestedBy, !row.paid);
    if (!result.success) { toast({ title: 'Error', description: result.error, variant: 'destructive' }); return; }
    setRecords(prev => ({ ...prev, [row.participantId]: { id: row.id!, paid: !row.paid } }));
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <Trophy style={{ width: 15, height: 15, color: gold }} />
        <p style={{ ...bc, fontWeight: 800, fontSize: '0.85rem', color: text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Overall Payout Calculator</p>
      </div>

      {config.weeklyEnabled && (
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ ...bc, fontSize: '0.62rem', fontWeight: 700, color: textDim, textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>
            Weeks of Weekly Payouts (to subtract from the total pool)
          </label>
          <input
            type="number" min={0} value={weeksPaid}
            onChange={e => setWeeksPaid(parseInt(e.target.value) || 0)}
            style={{ ...b, background: surface, border: `1px solid ${border}`, color: text, padding: '0.4rem 0.6rem', borderRadius: 6, fontSize: '0.85rem', width: '6rem' }}
          />
          <p style={{ ...b, fontSize: '0.7rem', color: textDim, marginTop: '0.25rem' }}>
            Defaults to the number of distinct weeks a weekly payout has been calculated for — adjust if that doesn&apos;t match how many weeks you actually paid out.
          </p>
        </div>
      )}

      <button
        type="button" onClick={runCalculation} disabled={isCalculating}
        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem', background: green, color: text, border: 'none', borderRadius: 6, cursor: isCalculating ? 'not-allowed' : 'pointer', ...bc, fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.75rem' }}
      >
        <RefreshCw style={{ width: 12, height: 12 }} className={isCalculating ? 'animate-spin' : ''} />
        {isCalculating ? 'Calculating…' : 'Calculate Final Standings'}
      </button>

      <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginBottom: '0.75rem' }}>
        Overall Prize Pool: <strong style={{ color: text }}>{formatCurrency(overallDollar)}</strong>
        {config.weeklyEnabled && ` (${formatCurrency(totalPool)} total − ${formatCurrency(weeklyDollar * weeksPaid)} paid weekly)`}
      </p>

      {standings === null ? (
        <p style={{ ...b, fontSize: '0.82rem', color: textDim }}>Click Calculate to pull the current season standings.</p>
      ) : results.length === 0 ? (
        <p style={{ ...b, fontSize: '0.82rem', color: textDim }}>No scores recorded for this season yet.</p>
      ) : (
        <>
          <ResultsTable results={results} onTogglePaid={handleSaveAndTogglePaid} />
          <SharePayoutsButton
            poolName={poolName} poolTypeLabel={poolTypeLabel} timeframeLabel="Season Payout"
            entryFee={config.entryFee} tiePolicy={config.tiePolicy} results={results}
          />
        </>
      )}
    </div>
  );
}

const QUARTER_PERIODS = getRegularSeasonPeriods();
const PLAYOFFS_PERIOD = 'Playoffs';

/** Rendered when showQuarterOption is true (Confidence pools with the regular
 * season and/or the postseason in scope — see pool-workspace.tsx) and
 * quarterEnabled is on. Mirrors WeeklyCalculator exactly: same ResultsTable,
 * same save/mark-paid flow, same share button — only the standings source (a
 * quarter/period instead of a single week) and dollar-amount config fields
 * differ. When the pool's season scope includes the postseason, a "Playoffs"
 * period is offered alongside Q1-Q4 and scored via seasonType 3. */
function QuarterCalculator({
  poolId, poolName, poolTypeLabel, season, config, totalPool, seasonScope, requestedBy, toast,
}: {
  poolId: string; poolName?: string; poolTypeLabel: PoolTypeLabel; season: number; config: PayoutConfig; totalPool: number;
  seasonScope: number[];
  requestedBy: string; toast: ReturnType<typeof useToast>['toast'];
}) {
  const periodOptions = useMemo(() => {
    const names = seasonScope.includes(2) ? QUARTER_PERIODS.map(p => p.name) : [];
    if (seasonScope.includes(3)) names.push(PLAYOFFS_PERIOD);
    return names;
  }, [seasonScope]);

  const [periodName, setPeriodName] = useState(periodOptions[0] ?? QUARTER_PERIODS[0].name);
  const [standings, setStandings] = useState<StandingEntry[] | null>(null);
  const [records, setRecords] = useState<Record<string, { id: string; paid: boolean }>>({});
  const [isCalculating, setIsCalculating] = useState(false);

  const periodSeasonType = periodName === PLAYOFFS_PERIOD ? 3 : 2;
  const quarterDollar = computeQuarterDollarAmount(config, totalPool);

  const runCalculation = useCallback(async () => {
    setIsCalculating(true);
    try {
      const rows = await fetchQuarterLeaderboard(poolId, season, periodName, periodSeasonType, requestedBy);
      setStandings(rows);
      const existing = await getPayoutRecords(poolId, 'quarter', season, undefined, periodName, periodSeasonType);
      setRecords(Object.fromEntries(existing.filter(r => r.participant_id).map(r => [r.participant_id, { id: r.id, paid: r.paid }])));
    } finally {
      setIsCalculating(false);
    }
  }, [poolId, season, periodName, periodSeasonType, requestedBy]);

  const results = useMemo(() => {
    if (!standings) return [];
    const calculated = calculatePayouts(config.quarterPositions, quarterDollar, standings, config.tiePolicy);
    return calculated.map(r => ({ ...r, id: records[r.participantId]?.id, paid: records[r.participantId]?.paid ?? false }));
  }, [standings, config, quarterDollar, records]);

  const handleSaveAndTogglePaid = async (index: number) => {
    const row = results[index];
    if (!requestedBy) return;

    if (!row.id) {
      const inputs: PayoutRecordInput[] = results.filter(r => !r.needsManualResolution).map(r => ({
        scope: 'quarter', season, week: 0, seasonType: periodSeasonType, periodName, place: r.place,
        participantId: r.participantId, participantName: r.participantName, amount: r.amount,
      }));
      const saveResult = await savePayoutCalculation(poolId, requestedBy, inputs);
      if (!saveResult.success) { toast({ title: 'Error', description: saveResult.error, variant: 'destructive' }); return; }
      const existing = await getPayoutRecords(poolId, 'quarter', season, undefined, periodName, periodSeasonType);
      setRecords(Object.fromEntries(existing.filter(r => r.participant_id).map(r => [r.participant_id, { id: r.id, paid: r.paid }])));
      const refreshed = existing.find(r => r.participant_id === row.participantId);
      if (refreshed) {
        const result = await markPayoutPaid(refreshed.id, requestedBy, !refreshed.paid);
        if (!result.success) { toast({ title: 'Error', description: result.error, variant: 'destructive' }); return; }
        setRecords(prev => ({ ...prev, [row.participantId]: { id: refreshed.id, paid: !refreshed.paid } }));
      }
      return;
    }

    const result = await markPayoutPaid(row.id, requestedBy, !row.paid);
    if (!result.success) { toast({ title: 'Error', description: result.error, variant: 'destructive' }); return; }
    setRecords(prev => ({ ...prev, [row.participantId]: { id: row.id!, paid: !row.paid } }));
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <CalendarRange style={{ width: 15, height: 15, color: greenHi }} />
        <p style={{ ...bc, fontWeight: 800, fontSize: '0.85rem', color: text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quarter Payout Calculator</p>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.25rem', background: surface, border: `1px solid ${border}`, borderRadius: 6, padding: '0.2rem' }}>
          {periodOptions.map(name => (
            <button key={name} type="button" onClick={() => { setPeriodName(name); setStandings(null); }} style={{ padding: '0.35rem 0.6rem', background: periodName === name ? green : 'transparent', color: periodName === name ? text : textDim, border: 'none', borderRadius: 4, cursor: 'pointer', ...bc, fontWeight: 700, fontSize: '0.68rem' }}>
              {name}
            </button>
          ))}
        </div>
        <button
          type="button" onClick={runCalculation} disabled={isCalculating}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem', background: green, color: text, border: 'none', borderRadius: 6, cursor: isCalculating ? 'not-allowed' : 'pointer', ...bc, fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}
        >
          <RefreshCw style={{ width: 12, height: 12 }} className={isCalculating ? 'animate-spin' : ''} />
          {isCalculating ? 'Calculating…' : 'Calculate'}
        </button>
      </div>

      <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginBottom: '0.75rem' }}>
        {periodName === PLAYOFFS_PERIOD ? 'Playoffs' : 'Quarter'} Prize Pool: <strong style={{ color: text }}>{formatCurrency(quarterDollar)}</strong>
      </p>

      {standings === null ? (
        <p style={{ ...b, fontSize: '0.82rem', color: textDim }}>Choose a {periodName === PLAYOFFS_PERIOD ? 'period' : 'quarter'} and click Calculate.</p>
      ) : results.length === 0 ? (
        <p style={{ ...b, fontSize: '0.82rem', color: textDim }}>No scores recorded for {periodName} yet.</p>
      ) : (
        <>
          <ResultsTable results={results} onTogglePaid={handleSaveAndTogglePaid} />
          <SharePayoutsButton
            poolName={poolName} poolTypeLabel={poolTypeLabel}
            timeframeLabel={periodName === PLAYOFFS_PERIOD ? 'Playoffs Payout' : `Quarter ${periodName.replace('Q', '')} Payout`}
            entryFee={config.entryFee} tiePolicy={config.tiePolicy} results={results}
          />
        </>
      )}
    </div>
  );
}
