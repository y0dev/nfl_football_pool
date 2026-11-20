'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Trophy } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { SurvivorPoolState } from '@/lib/survivor';
import { debugError } from '@/lib/utils';

const surface = 'oklch(17% 0.028 255)';
const border  = 'oklch(26% 0.03 255)';
const greenHi = 'oklch(59% 0.15 155)';
const amber   = 'oklch(72% 0.16 60)';
const gold    = 'oklch(74% 0.16 72)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

function storedAdminEmail(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('nfl-pool-user');
    return stored ? (JSON.parse(stored) as { email?: string }).email ?? null : null;
  } catch {
    return null;
  }
}

/**
 * Commissioner control for declaring (and, after a corrected game result,
 * re-declaring) a Survivor pool's winner. finalizeSurvivorSeason() never
 * runs on its own, so when a result changes after finalizing this panel is
 * what tells the commissioner the stored winner is now wrong.
 */
export function SurvivorFinalizePanel({ poolId, onFinalized }: { poolId: string; onFinalized?: () => void }) {
  const [state, setState] = useState<SurvivorPoolState | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const email = storedAdminEmail();
      const res = await fetch(`/api/survivor/state?poolId=${poolId}`, { headers: email ? { 'x-admin-email': email } : undefined });
      const data = await res.json();
      if (data?.success) setState(data.state);
    } catch (error) {
      debugError('Error loading Survivor finalization status:', error);
    }
  }, [poolId]);

  useEffect(() => { load(); }, [load]);

  const finalize = async () => {
    setIsFinalizing(true);
    setMessage(null);
    try {
      const res = await fetch('/api/survivor/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poolId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to finalize');
      await load();
      onFinalized?.();
      setMessage('Season finalized — standings now show the winner from current results.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to finalize');
    } finally {
      setIsFinalizing(false);
    }
  };

  if (!state?.finalization) return null;
  const f = state.finalization;
  const nameOf = (id: string) => state.participants.find(p => p.participantId === id)?.participantName ?? 'Unknown';
  const names = (ids: string[] | null) => (ids && ids.length > 0 ? ids.map(nameOf).join(', ') : 'no one');
  const finalizedOn = f.finalizedAt ? new Date(f.finalizedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : null;

  const outdated = f.status === 'outdated';
  const accent = outdated ? amber : f.status === 'up_to_date' ? greenHi : gold;
  // Readiness gates re-finalizing too: the server rejects it otherwise.
  const canFinalize = f.readyToFinalize && f.status !== 'up_to_date';

  return (
    <div
      role={outdated ? 'alert' : undefined}
      style={{ background: outdated ? 'oklch(72% 0.16 60 / 0.08)' : surface, border: `1px solid ${outdated ? 'oklch(72% 0.16 60 / 0.5)' : border}`, borderRadius: 8, padding: '0.85rem 1rem', marginBottom: '0.9rem' }}
    >
      <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start' }}>
        {outdated
          ? <AlertTriangle aria-hidden style={{ width: 18, height: 18, color: amber, flexShrink: 0, marginTop: 2 }} />
          : f.status === 'up_to_date'
            ? <CheckCircle2 aria-hidden style={{ width: 18, height: 18, color: greenHi, flexShrink: 0, marginTop: 2 }} />
            : <Trophy aria-hidden style={{ width: 18, height: 18, color: gold, flexShrink: 0, marginTop: 2 }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ ...bc, fontWeight: 800, fontSize: '0.78rem', letterSpacing: '0.1em', color: accent, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
            {outdated
              ? 'Re-finalize needed — a result changed'
              : f.status === 'up_to_date'
                ? 'Season finalized'
                : f.readyToFinalize ? 'Ready to finalize' : 'Season in progress'}
          </p>
          <p style={{ ...b, fontSize: '0.82rem', color: outdated ? text : textMid, lineHeight: 1.55 }}>
            {outdated ? (
              <>
                You finalized{finalizedOn ? ` on ${finalizedOn}` : ''} with <strong>{names(f.finalizedWinnerIds)}</strong> as the winner,
                but a game result has changed since. Current results say <strong>{names(f.currentWinnerIds)}</strong>.
                Standings keep showing the old winner until you re-finalize.
                {!f.readyToFinalize && f.notReadyReason ? <> You can re-finalize once this is settled: {f.notReadyReason}</> : null}
              </>
            ) : f.status === 'up_to_date' ? (
              <>Winner: <strong style={{ color: text }}>{names(f.finalizedWinnerIds)}</strong>{finalizedOn ? ` · finalized ${finalizedOn}` : ''}. Matches current results.</>
            ) : f.readyToFinalize ? (
              <>Every game is final (or one player remains). Finalizing declares <strong style={{ color: text }}>{names(f.currentWinnerIds)}</strong> the winner.</>
            ) : (
              <>{f.notReadyReason ?? "Finalize once the last game in this pool's scope is final, or only one player is left."}</>
            )}
          </p>
          {message && <p style={{ ...b, fontSize: '0.75rem', color: textDim, marginTop: '0.4rem' }}>{message}</p>}
        </div>
        {canFinalize && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                disabled={isFinalizing}
                style={{ flexShrink: 0, padding: '0.35rem 0.75rem', background: outdated ? amber : 'transparent', color: outdated ? 'oklch(13% 0.025 255)' : gold, border: `1px solid ${outdated ? amber : gold}`, borderRadius: 6, ...bc, fontWeight: 800, fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: isFinalizing ? 'not-allowed' : 'pointer', opacity: isFinalizing ? 0.6 : 1 }}
              >
                {isFinalizing ? 'Finalizing…' : outdated ? 'Re-finalize' : 'Finalize Season'}
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{outdated ? 'Re-finalize this Survivor pool?' : 'Finalize this Survivor pool?'}</AlertDialogTitle>
                <AlertDialogDescription>
                  {names(f.currentWinnerIds)} will be recorded as the winner, based on current game results.
                  {outdated ? ` This replaces ${names(f.finalizedWinnerIds)}.` : ''}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={finalize}>{outdated ? 'Re-finalize' : 'Finalize'}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
