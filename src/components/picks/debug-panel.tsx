import type { ReactNode } from 'react';
import { showDebugPanel } from '@/lib/utils';

// Shared #debug-panel / #debug-panel-controls / #debug-panel-picks —
// originally Confidence-only (src/components/picks/pool-picks-content.tsx),
// extracted so Pick'em and Survivor render the exact same structure, ids,
// and seven dev toggles instead of a separate/simplified panel per pool
// type. Confidence's own render call is a pure extraction — same fields,
// same JSX, same ids, same 7 checkboxes. Renders nothing outside
// development (showDebugPanel() gates NODE_ENV + NEXT_PUBLIC_SHOW_DEBUG_PANEL),
// so none of this — including devUnlockToMakePicks — is ever reachable in
// production regardless of caller state.

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;
const greenHi = 'oklch(59% 0.15 155)';

export interface DebugPanelProps {
  poolType: string;
  poolId: string;
  currentWeek: number | string | null;
  currentSeasonType: number | string | null;
  gamesCount: number;
  gamesStarted: boolean;
  weekEnded: boolean;
  selectedUserLabel: string | null;
  hasSubmittedSelected: boolean | null;
  simulatedSubmitted?: boolean;
  showLeaderboard: boolean;
  weekHasPicks: boolean;

  forceWeekUnlocked: boolean;
  onForceWeekUnlockedChange: (v: boolean) => void;
  forcePicks: boolean;
  onForcePicksChange: (v: boolean) => void;
  devSimInProgress: boolean;
  onDevSimInProgressChange: (v: boolean) => void;
  devSimFinished: boolean;
  onDevSimFinishedChange: (v: boolean) => void;
  devForceLeaderboard: boolean;
  onDevForceLeaderboardChange: (v: boolean) => void;
  devSimSubmitted: boolean;
  onDevSimSubmittedChange: (v: boolean) => void;
  devUnlockToMakePicks: boolean;
  onDevUnlockToMakePicksChange: (v: boolean) => void;

  /** Extra, pool-type-specific debug content (e.g. Pick'em's/Survivor's
   * per-game table) — rendered after #debug-panel-picks, inside the same
   * outer #debug-panel container. Optional; adds to the required block, never
   * replaces any part of it. */
  children?: ReactNode;
}

export function DebugPanel(props: DebugPanelProps) {
  if (!showDebugPanel()) return null;
  const {
    poolType, poolId, currentWeek, currentSeasonType, gamesCount, gamesStarted, weekEnded,
    selectedUserLabel, hasSubmittedSelected, simulatedSubmitted, showLeaderboard, weekHasPicks,
    forceWeekUnlocked, onForceWeekUnlockedChange,
    forcePicks, onForcePicksChange,
    devSimInProgress, onDevSimInProgressChange,
    devSimFinished, onDevSimFinishedChange,
    devForceLeaderboard, onDevForceLeaderboardChange,
    devSimSubmitted, onDevSimSubmittedChange,
    devUnlockToMakePicks, onDevUnlockToMakePicksChange,
    children,
  } = props;

  return (
    <div id="debug-panel" style={{ background: `oklch(58% 0.15 250 / 0.08)`, border: `1px solid oklch(58% 0.15 250 / 0.25)`, borderRadius: 8, padding: '1rem 1.25rem' }}>
      <div style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', color: 'oklch(68% 0.12 250)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Debug Info</div>
      <div style={{ ...b, fontSize: '0.68rem', color: 'oklch(65% 0.1 250)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
        <p><strong>Pool Type:</strong> {poolType}</p>
        <p><strong>Games Started:</strong> {gamesStarted ? 'Yes' : 'No'} | <strong>Week Ended:</strong> {weekEnded ? 'Yes' : 'No'} | <strong>Games:</strong> {gamesCount}</p>
        <p><strong>Selected User:</strong> {selectedUserLabel ?? 'None'} | <strong>Has Submitted:</strong> {hasSubmittedSelected == null ? 'N/A' : hasSubmittedSelected ? 'Yes' : 'No'}{simulatedSubmitted ? ' (simulated)' : ''}</p>
        <p><strong>Leaderboard:</strong> {showLeaderboard ? 'Shown' : 'Hidden'} | <strong>Week Has Picks:</strong> {weekHasPicks ? 'Yes' : 'No'}</p>
        <p><strong>Pool ID:</strong> {poolId} | <strong>Week:</strong> {currentWeek} | <strong>Season Type:</strong> {currentSeasonType}</p>
      </div>
      <div id="debug-panel-controls" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.75rem', borderTop: `1px solid oklch(58% 0.15 250 / 0.2)`, paddingTop: '0.75rem' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={forceWeekUnlocked}
            onChange={(e) => onForceWeekUnlockedChange(e.target.checked)}
            style={{ accentColor: 'oklch(58% 0.15 250)', width: 14, height: 14 }}
          />
          <span style={{ ...b, fontSize: '0.72rem', color: 'oklch(68% 0.12 250)' }}>Force week unlocked (ignore kickoff gate)</span>
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={forcePicks}
            onChange={(e) => onForcePicksChange(e.target.checked)}
            style={{ accentColor: 'oklch(58% 0.15 250)', width: 14, height: 14 }}
          />
          <span style={{ ...b, fontSize: '0.72rem', color: 'oklch(68% 0.12 250)' }}>Force show picks form (ignore games started / week ended)</span>
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={devSimInProgress}
            onChange={(e) => onDevSimInProgressChange(e.target.checked)}
            style={{ accentColor: 'oklch(72% 0.16 60)', width: 14, height: 14 }}
          />
          <span style={{ ...b, fontSize: '0.72rem', color: 'oklch(68% 0.12 250)' }}>Simulate in-progress (shows &quot;Games Started&quot; banner, locks picks)</span>
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={devSimFinished}
            onChange={(e) => onDevSimFinishedChange(e.target.checked)}
            style={{ accentColor: 'oklch(46% 0.14 155)', width: 14, height: 14 }}
          />
          <span style={{ ...b, fontSize: '0.72rem', color: 'oklch(68% 0.12 250)' }}>Simulate finished — varied scores, home wins (pair with &quot;Force show picks form&quot;)</span>
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={devForceLeaderboard}
            onChange={(e) => onDevForceLeaderboardChange(e.target.checked)}
            style={{ accentColor: 'oklch(74% 0.16 72)', width: 14, height: 14 }}
          />
          <span style={{ ...b, fontSize: '0.72rem', color: 'oklch(68% 0.12 250)' }}>Force show week leaderboard</span>
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={devSimSubmitted}
            onChange={(e) => onDevSimSubmittedChange(e.target.checked)}
            style={{ accentColor: 'oklch(65% 0.12 290)', width: 14, height: 14 }}
          />
          <span style={{ ...b, fontSize: '0.72rem', color: 'oklch(68% 0.12 250)' }}>Simulate picks submitted for the selected user (shows the locked/submitted view — nothing is written to the database)</span>
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={devUnlockToMakePicks}
            onChange={(e) => onDevUnlockToMakePicksChange(e.target.checked)}
            style={{ accentColor: 'oklch(62% 0.22 25)', width: 14, height: 14 }}
          />
          <span style={{ ...b, fontSize: '0.72rem', color: 'oklch(68% 0.12 250)' }}>Unlock to make picks — bypass the &quot;already submitted&quot; lock for the selected user (dev only, nothing is written to the database)</span>
        </label>
      </div>
      <div id="debug-panel-picks" style={{ background: `oklch(46% 0.14 155 / 0.08)`, margin: '1rem 0', border: `1px solid oklch(46% 0.14 155 / 0.25)`, borderRadius: 6, padding: '0.75rem 1rem' }}>
        <p style={{ ...b, fontSize: '0.78rem', color: greenHi }}>
          <strong>Main picks section reached!</strong> Games started: {gamesStarted ? 'Yes' : 'No'}, Week ended: {weekEnded ? 'Yes' : 'No'}
        </p>
      </div>
      {children}
    </div>
  );
}
